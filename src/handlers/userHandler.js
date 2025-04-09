/**
 * 用戶相關 API 處理模組
 * 封裝所有與用戶相關的請求處理邏輯
 */
import { isUserNameExists, toggleUserStatus, deleteUser, getAllUsers, getUserById, createUser } from '../models/users.js';
import { addLog } from '../services/logService.js';
import { verifyAndOpenDoor } from '../services/userService.js';

/**
 * 處理獲取所有用戶請求
 * @param {D1Database} db - 資料庫連接對象
 * @param {Request} request - 請求對象
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleGetAllUsers(db) {
  try {
    const result = await getAllUsers(db);
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return new Response(JSON.stringify(result.users), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('獲取所有用戶錯誤:', error);
    return new Response(JSON.stringify({ error: `獲取用戶列表失敗: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理創建用戶請求
 * @param {D1Database} db - 資料庫連接對象
 * @param {Request} request - 請求對象
 * @param {Object} authResult - 認證結果
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleCreateUser(db, request, authResult) {
  try {
    const data = await request.json();
    const { name, is_temporary = false, expiry_days = 0 } = data;
    
    if (!name) {
      return new Response(JSON.stringify({ error: '使用者名稱不能為空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 檢查使用者名稱是否已存在
    const nameCheckResult = await isUserNameExists(db, name);
    if (!nameCheckResult.success) {
      throw new Error(nameCheckResult.error);
    }
    
    if (nameCheckResult.exists) {
      return new Response(JSON.stringify({ error: '該使用者名稱已存在' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user = await createUser(db, { name, is_temporary, expiry_days });
    
    await addLog(db, authResult.user.user_id, authResult.user.username, `創建用戶: ${name}`);
    
    return new Response(JSON.stringify(user), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('創建用戶錯誤:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理切換用戶狀態請求
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} userId - 用戶ID
 * @param {Object} authResult - 認證結果
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleToggleUserStatus(db, userId, authResult) {
  try {
    const result = await toggleUserStatus(db, userId);
    
    if (!result.success) {
      return new Response(JSON.stringify({ success: false, error: result.error }), {
        status: result.error && result.error.includes('不存在') ? 404 : 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 添加日誌
    const action = result.user.is_disabled ? '停用用戶' : '啟用用戶';
    await addLog(db, authResult.user.user_id, authResult.user.username, `${action}: ${result.user.name}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      user: result.user
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('切換用戶狀態錯誤:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理刪除用戶請求
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} userId - 用戶ID
 * @param {Object} authResult - 認證結果
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleDeleteUser(db, userId, authResult) {
  try {
    const result = await deleteUser(db, userId);
    
    if (!result.success) {
      return new Response(JSON.stringify({ success: false, error: result.error || '刪除失敗' }), {
        status: (result.error && result.error.includes('不存在')) ? 404 : 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 添加日誌
    await addLog(db, authResult.user.user_id, authResult.user.username, `刪除用戶: ${result.user.name}`);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('刪除用戶錯誤:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理獲取用戶詳情請求
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} userId - 用戶ID
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleGetUserDetail(db, userId) {
  try {
    const result = await getUserById(db, userId);
    
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error || '用戶不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(result.user), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('獲取用戶詳情錯誤:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理驗證OTP請求
 * @param {D1Database} db - 資料庫連接對象
 * @param {Request} request - 請求對象
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleVerifyOTP(db, request) {
  try {
    const data = await request.json();
    const { token } = data;
    
    if (!token) {
      return new Response(JSON.stringify({ error: '無效的令牌' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 日誌以便除錯 - 遮蓋部分信息以增加安全性
    let logToken;
    if (token.length > 8) {
      // 帶前綴的令牌 (6位前綴 + 6位TOTP)
      logToken = `${token.substring(0, 3)}***${token.substring(token.length - 2)}`;
    } else {
      // 純TOTP令牌
      logToken = `${token.substring(0, 2)}***${token.substring(token.length - 1)}`;
    }
    
    console.log(`收到驗證請求，令牌: ${logToken}`);
    
    // 使用整合後的驗證和開門服務
    const result = await verifyAndOpenDoor(db, token);
    
    if (!result.success) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: result.message || '無效的令牌或未授權的用戶' 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('驗證處理錯誤:', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 用戶API路由處理函數
 * @param {D1Database} db - 資料庫連接對象
 * @param {Request} request - 請求對象
 * @param {Object} authResult - 認證結果
 * @returns {Promise<Response|null>} - HTTP 響應或 null (如果不是用戶API)
 */
export async function handleUserRequests(db, request, authResult) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // 檢查是否是用戶API
  if (!path.startsWith('/api/users') && path !== '/api/verify') {
    return null;
  }
  
  console.log(`處理用戶API請求: ${method} ${path}`);
  
  // 處理各種用戶API路徑
  
  // 獲取所有用戶
  if (path === '/api/users' && method === 'GET') {
    return await handleGetAllUsers(db);
  }
  
  // 創建新用戶
  if (path === '/api/users' && method === 'POST') {
    return await handleCreateUser(db, request, authResult);
  }
  
  // 停用/啟用用戶
  if (path.match(/^\/api\/users\/[^\/]+\/toggle-status$/) && method === 'POST') {
    const userId = path.split('/')[3];
    return await handleToggleUserStatus(db, userId, authResult);
  }
  
  // 刪除用戶
  if (path.match(/^\/api\/users\/[^\/]+$/) && method === 'DELETE') {
    const userId = path.split('/')[3];
    return await handleDeleteUser(db, userId, authResult);
  }
  
  // 獲取用戶詳情
  if (path.match(/^\/api\/users\/[^\/]+$/) && method === 'GET') {
    const userId = path.split('/')[3];
    return await handleGetUserDetail(db, userId);
  }
  
  // 驗證OTP
  if (path === '/api/verify' && method === 'POST') {
    return await handleVerifyOTP(db, request);
  }
  
  // 如果沒有匹配的路由
  return new Response(JSON.stringify({ error: `未找到用戶API路由: ${path}` }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
