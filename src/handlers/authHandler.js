/**
 * 認證相關 API 處理模組
 * 封裝所有與認證相關的請求處理邏輯
 */
import { verifyTurnstileToken, createSession, verifySession, deleteSession } from '../services/authService.js';
import { verifyAdminCredentials } from '../models/admins.js';
import { addLog } from '../services/logService.js';

/**
 * 處理登錄請求
 * @param {Request} request - 請求對象
 * @param {Object} db - 資料庫連接對象
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleLogin(request, db) {
  try {
    console.log('開始處理登錄請求...');
    
    let formData;
    try {
      formData = await request.json();
      console.log('解析請求數據成功');
    } catch (parseError) {
      console.error('解析請求數據失敗:', parseError);
      return new Response(JSON.stringify({ success: false, error: '無法解析請求數據' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { username, password, turnstileToken } = formData;
    
    console.log(`嘗試用戶: ${username} 登錄`);
    
    if (!username || !password) {
      console.log('使用者名稱或密碼為空');
      return new Response(JSON.stringify({ success: false, error: '使用者名稱和密碼不能為空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 驗證Turnstile
    if (!turnstileToken) {
      console.log('未提供 Turnstile 令牌');
      return new Response(JSON.stringify({ success: false, error: '請完成人機驗證' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('開始驗證 Turnstile 令牌...');
    
    const clientIP = request.headers.get('CF-Connecting-IP');
    const turnstileValid = await verifyTurnstileToken(turnstileToken, clientIP);
    
    if (!turnstileValid) {
      console.log('管理員登錄失敗 - Turnstile 驗證失敗');
      return new Response(JSON.stringify({ success: false, error: '人機驗證失敗，請重試' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('開始驗證用戶憑據...');
    
    // 驗證管理員憑據
    const authResult = await verifyAdminCredentials(db, username, password);
    
    console.log(`用戶憑據驗證結果: ${authResult.valid}`);
    
    if (!authResult.valid) {
      await addLog(db, null, username, '管理員登錄失敗 - 帳號或密碼錯誤');
      // 返回200狀態碼但標示登錄失敗，並顯示通用錯誤信息
      return new Response(JSON.stringify({ success: false, error: '帳號或密碼錯誤' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('用戶憑據驗證成功，獲取用戶ID...');
    
    // 確保 user_id 永遠不為 null
    let userId = null;
    if (authResult.admin.id) {
      // 如果有管理員 ID，使用該 ID
      userId = authResult.admin.id.toString();
    } else {
      // 否則生成一個基於使用者名稱的臨時 ID
      userId = `admin_${username}`;  // 這裡直接使用內置邏輯而非調用函數
    }
    
    console.log(`為用戶 ${username} 獲取到ID: ${userId}`);
    console.log('開始創建會話...');
    
    // 記錄登錄日誌
    await addLog(db, null, username, '管理員登錄');
    console.log('登錄日誌已記錄');
    
    // 創建會話
    const sessionResult = await createSession(db, userId, username, authResult.admin.email);
    
    console.log(`創建會話結果: ${sessionResult.success}`);
    
    if (!sessionResult.success) {
      console.error('創建會話失敗:', sessionResult.error);
      return new Response(JSON.stringify({ success: false, error: `創建會話失敗: ${sessionResult.error}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('登錄過程完成，準備返回成功響應...');
    
    return new Response(JSON.stringify({ 
      success: true,
      redirect: formData.redirect || '/',
      session: {
        username: sessionResult.session.username,
        expiresAt: sessionResult.session.expires_at
      }
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Set-Cookie': `session=${sessionResult.session.session_id}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`
      }
    });
  } catch (error) {
    console.error('登錄處理錯誤:', error);
    return new Response(JSON.stringify({ success: false, error: `登錄處理發生錯誤: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理會話檢查請求
 * @param {Request} request - 請求對象
 * @param {Object} db - 資料庫連接對象
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleSessionCheck(request, db) {
  const cookies = request.headers.get('Cookie') || '';
  const sessionMatch = cookies.match(/session=([^;]+)/);
  
  if (!sessionMatch) {
    return new Response(JSON.stringify({ authenticated: false }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const sessionId = sessionMatch[1];
  const sessionResult = await verifySession(db, sessionId);
  
  return new Response(JSON.stringify({
    authenticated: sessionResult.valid,
    user: sessionResult.valid ? sessionResult.session : null
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * 處理登出請求
 * @param {Request} request - 請求對象
 * @param {Object} db - 資料庫連接對象
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleLogout(request, db) {
  try {
    console.log('處理登出請求...');
    
    const url = new URL(request.url);
    const cookies = request.headers.get('Cookie') || '';
    const sessionMatch = cookies.match(/session=([^;]+)/);
    
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      console.log(`找到會話ID: ${sessionId}，嘗試刪除...`);
      
      const deleteResult = await deleteSession(db, sessionId);
      if (deleteResult.success) {
        console.log('成功刪除會話');
      } else {
        console.error('刪除會話失敗:', deleteResult.error);
      }
    } else {
      console.log('未找到會話，無需刪除');
    }
    
    // 使用完整的URL路徑進行重定向
    const baseUrl = url.origin;
    const redirectUrl = `${baseUrl}/login.html`;
    console.log(`重定向到: ${redirectUrl}`);
    
    // 創建重定向響應
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
      }
    });
  } catch (error) {
    console.error('登出處理錯誤:', error);
    // 即使出錯，也嘗試重定向回登入頁面
    const url = new URL(request.url);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${url.origin}/login.html?error=${encodeURIComponent('登出過程中發生錯誤')}`,
        'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
      }
    });
  }
}
