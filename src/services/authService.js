import { nanoid } from '../utils/crypto.js';
import { TURNSTILE_CONFIG } from '../config/constants.js';

/**
 * 驗證Turnstile token
 * @param {string} token - Turnstile令牌
 * @param {string} ip - 客戶端IP地址
 * @returns {Promise<boolean>} - 驗證結果
 */
export async function verifyTurnstileToken(token, ip) {
  try {
    console.log('開始驗證 Turnstile 令牌:', token.substring(0, 20) + '...');
    
    // 使用 JSON 格式發送請求
    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const result = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        secret: TURNSTILE_CONFIG.secretKey,
        response: token,
        remoteip: ip || ''
      })
    });
    
    if (!result.ok) {
      console.error(`Turnstile API 請求失敗: ${result.status} ${result.statusText}`);
      return false;
    }
    
    const outcome = await result.json();
    console.log('Turnstile 驗證結果:', outcome);
    
    if (!outcome.success && outcome['error-codes']) {
      console.error('Turnstile 錯誤碼:', outcome['error-codes']);
    }
    
    return outcome.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

/**
 * 創建新會話
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} user_id - 用戶ID
 * @param {string} username - 用戶名稱
 * @param {string} email - 用戶電子郵件
 * @returns {Promise<Object>} - 創建會話結果
 */
export async function createSession(db, user_id, username, email) {
  try {
    console.log(`嘗試為用戶 ${username} (ID: ${user_id}) 創建會話...`);
    
    const sessionId = nanoid();
    const now = Date.now();
    // 會話有效期24小時
    const expiresAt = now + (24 * 60 * 60 * 1000);
    
    console.log(`生成的會話 ID: ${sessionId}`);
    
    // 處理 email 可能為 undefined 的情況
    const safeEmail = email || '';
    
    try {
      // 確保使用正確的列名和參數數量
      await db.prepare(
        "INSERT INTO sessions (session_id, user_id, username, email, created_at, expires_at, last_activity) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(sessionId, user_id, username, safeEmail, now, expiresAt, now).run();
      
      console.log(`會話記錄已成功插入資料庫`);
    } catch (dbError) {
      console.error('插入會話記錄失敗:', dbError);
      return { success: false, error: `插入會話記錄失敗: ${dbError.message}` };
    }
    
    try {
      // 更新管理員最後登錄時間
      await db.prepare(
        "UPDATE admins SET last_login = ? WHERE username = ?"
      ).bind(now, username).run();
      
      console.log(`已更新管理員 ${username} 的最後登錄時間`);
    } catch (updateError) {
      // 更新最後登錄時間失敗不應該影響會話創建，所以只記錄錯誤
      console.error('更新管理員最後登錄時間失敗:', updateError);
    }
    
    return { 
      success: true, 
      session: {
        session_id: sessionId,
        user_id: user_id,
        username,
        email: safeEmail,
        expires_at: expiresAt
      } 
    };
  } catch (error) {
    console.error('創建會話錯誤:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 驗證會話
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} sessionId - 會話ID
 * @returns {Promise<Object>} - 驗證結果
 */
export async function verifySession(db, sessionId) {
  try {
    if (!sessionId) {
      return { valid: false, reason: '未提供會話ID' };
    }
    
    const session = await db.prepare(
      "SELECT * FROM sessions WHERE session_id = ?"
    ).bind(sessionId).first();
    
    if (!session) {
      return { valid: false, reason: '會話不存在' };
    }
    
    const now = Date.now();
    
    // 檢查會話是否過期
    if (now > session.expires_at) {
      // 刪除過期會話
      await db.prepare("DELETE FROM sessions WHERE session_id = ?").bind(sessionId).run();
      return { valid: false, reason: '會話已過期' };
    }
    
    // 更新最後活動時間
    await db.prepare(
      "UPDATE sessions SET last_activity = ? WHERE session_id = ?"
    ).bind(now, sessionId).run();
    
    return { 
      valid: true, 
      session: {
        user_id: session.user_id,
        username: session.username,
        email: session.email,
        expires_at: session.expires_at
      }
    };
  } catch (error) {
    console.error('驗證會話錯誤:', error);
    return { valid: false, reason: '驗證會話時發生錯誤' };
  }
}

/**
 * 刪除會話
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} sessionId - 會話ID
 * @returns {Promise<Object>} - 刪除結果
 */
export async function deleteSession(db, sessionId) {
  try {
    await db.prepare("DELETE FROM sessions WHERE session_id = ?").bind(sessionId).run();
    return { success: true };
  } catch (error) {
    console.error('刪除會話錯誤:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 會話認證中間件
 * @param {D1Database} db - 資料庫連接對象
 * @param {Request} request - HTTP請求對象
 * @returns {Promise<Object>} - 認證結果
 */
export async function authMiddleware(db, request) {
  try {
    // 排除不需要認證的路徑
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 檢查是否是API請求
    const isApiRequest = path.startsWith('/api/');
    
    // 不需要認證的路徑列表
    const publicPaths = [
      '/otp.html',
      '/login.html',
      '/style.css',
      '/auth/login',
      '/auth/check',
      '/auth/logout',
      '/api/verify',
    ];
    
    // 檢查是否是靜態資源
    const isStaticResource = path.match(/\.(js|css|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/);
    
    // 如果是公共路徑或靜態資源，不需要驗證
    if (publicPaths.some(p => path.startsWith(p)) || isStaticResource) {
      return { authenticated: true };
    }
    
    // 檢查會話Cookie
    const cookies = request.headers.get('Cookie') || '';
    const sessionMatch = cookies.match(/session=([^;]+)/);
    
    if (!sessionMatch) {
      return { 
        authenticated: false, 
        isApiRequest,
        redirectUrl: `/login.html?redirect=${encodeURIComponent(url.pathname + url.search)}`
      };
    }
    
    const sessionId = sessionMatch[1];
    const sessionResult = await verifySession(db, sessionId);
    
    if (!sessionResult.valid) {
      return { 
        authenticated: false, 
        isApiRequest,
        reason: sessionResult.reason,
        redirectUrl: `/login.html?redirect=${encodeURIComponent(url.pathname + url.search)}&error=${encodeURIComponent(sessionResult.reason)}`
      };
    }
    
    return { 
      authenticated: true, 
      user: sessionResult.session
    };
  } catch (error) {
    console.error('認證中間件錯誤:', error);
    const isApiRequest = new URL(request.url).pathname.startsWith('/api/');
    return { 
      authenticated: false, 
      isApiRequest,
      reason: '認證過程發生錯誤',
      redirectUrl: '/login.html?error=auth_error'
    };
  }
}

/**
 * 檢查用戶登入權限
 * 根據用戶角色和權限判斷能否訪問特定功能
 */
export async function checkUserPermission(db, userId, permissionType) {
  // 實現權限檢查邏輯
}

// 其他認證或權限相關功能...
