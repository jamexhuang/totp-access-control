/**
 * 管理員相關 API 處理模組
 * 封裝所有與管理員相關的請求處理邏輯
 */
import { addLog } from '../services/logService.js';
import { 
  createAdmin, getAllAdmins, getAdminByUsername, toggleAdminStatus, 
  setAdminPassword, updateAdminUsername, updateAdminPassword, 
  updateAdminEmail, isAdminUsernameExists
} from '../models/admins.js';

/**
 * 處理獲取當前管理員信息請求
 * @param {Object} db - 資料庫連接對象
 * @param {Request} request - 請求對象
 * @param {Object} authResult - 認證結果
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleGetCurrentAdmin(db, request, authResult) {
  try {
    // 從資料庫獲取最新的管理員資訊
    const admin = await getAdminByUsername(db, authResult.user.username);
    
    if (!admin) {
      return new Response(JSON.stringify({ error: '找不到管理員資訊' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(admin), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('獲取當前管理員信息錯誤:', error);
    return new Response(JSON.stringify({ error: `獲取管理員信息失敗: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理更新管理員用戶名請求
 * @param {Object} db - 資料庫連接對象
 * @param {Request} request - 請求對象
 * @param {Object} authResult - 認證結果
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleUpdateUsername(db, request, authResult) {
  try {
    const data = await request.json();
    const { newUsername } = data;
    
    if (!newUsername || newUsername.trim() === '') {
      return new Response(JSON.stringify({ success: false, error: '新使用者名稱不能為空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 檢查新使用者名稱是否符合規則
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) {
      return new Response(JSON.stringify({ success: false, error: '使用者名稱只能包含字母、數字和下劃線，長度3-20位' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 更新使用者名稱
    const currentUsername = authResult.user.username;
    console.log(`準備將使用者名稱從 ${currentUsername} 更改為 ${newUsername}`);
    
    const updateResult = await updateAdminUsername(db, currentUsername, newUsername);
    
    if (!updateResult.success) {
      return new Response(JSON.stringify({ success: false, error: updateResult.error || '更新使用者名稱失敗' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 記錄更改日誌
    await addLog(db, authResult.user.user_id, currentUsername, `更改使用者名稱: ${currentUsername} -> ${newUsername}`);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: '使用者名稱已成功更新，請重新登入',
      username: newUsername
    }), {
      headers: { 
        'Content-Type': 'application/json',
        // 清除會話，要求用戶重新登入
        'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
      }
    });
  } catch (error) {
    console.error('處理使用者名稱更新請求時出錯:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `更新使用者名稱時發生錯誤: ${error.message}` 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理更新管理員密碼請求
 * @param {Object} db - 資料庫連接對象
 * @param {Request} request - 請求對象
 * @param {Object} authResult - 認證結果
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleUpdatePassword(db, request, authResult) {
  try {
    const data = await request.json();
    const { currentPassword, newPassword } = data;
    
    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({ success: false, error: '當前密碼和新密碼不能為空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 檢查新密碼長度
    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ success: false, error: '新密碼至少需要6個字元' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`用戶 ${authResult.user.username} 正在嘗試更改密碼`);
    
    // 更新密碼
    const updateResult = await updateAdminPassword(db, authResult.user.username, currentPassword, newPassword);
    
    if (!updateResult.success) {
      return new Response(JSON.stringify({ success: false, error: updateResult.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 記錄日誌
    await addLog(db, authResult.user.user_id, authResult.user.username, '更新管理員密碼');
    
    return new Response(JSON.stringify({ 
      success: true,
      message: '密碼已成功更新，請使用新密碼重新登入'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        // 清除會話，要求用戶重新登入
        'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
      }
    });
  } catch (error) {
    console.error('處理密碼更新請求時出錯:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `更新密碼時發生錯誤: ${error.message}` 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理更新管理員信箱請求
 * @param {Object} db - 資料庫連接對象
 * @param {Request} request - 請求對象
 * @param {Object} authResult - 認證結果
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleUpdateEmail(db, request, authResult) {
  try {
    const data = await request.json();
    const { email } = data;
    
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: '請提供有效的電子信箱地址' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 更新信箱
    await updateAdminEmail(db, authResult.user.username, email);
    
    // 記錄日誌
    await addLog(db, authResult.user.user_id, authResult.user.username, '更新管理員信箱');
    
    return new Response(JSON.stringify({ 
      success: true,
      message: '信箱已成功更新'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('處理信箱更新請求時出錯:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `更新信箱時發生錯誤: ${error.message}` 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理獲取所有管理員請求
 * @param {Object} db - 資料庫連接對象
 * @param {Request} request - 請求對象
 * @param {Object} authResult - 認證結果
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleGetAllAdmins(db, request, authResult) {
  try {
    const admins = await getAllAdmins(db);
    return new Response(JSON.stringify(admins), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('獲取所有管理員錯誤:', error);
    return new Response(JSON.stringify({ error: `獲取管理員列表失敗: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理切換管理員狀態請求
 * @param {Object} db - 資料庫連接對象
 * @param {string} adminId - 管理員ID
 * @param {Request} request - 請求對象
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleToggleAdminStatus(db, adminId, request) {
  try {
    const result = await toggleAdminStatus(db, adminId);
    
    if (!result.success) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: result.error || '操作失敗' 
      }), { 
        status: result.error && result.error.includes('找不到') ? 404 : 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    return new Response(JSON.stringify({ success: true }), { 
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('切換管理員狀態錯誤:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `切換管理員狀態時發生錯誤: ${error.message}` 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理設置管理員密碼請求
 * @param {Object} db - 資料庫連接對象
 * @param {string} adminId - 管理員ID
 * @param {Request} request - 請求對象
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleSetAdminPassword(db, adminId, request) {
  try {
    const body = await request.json();
    if (!body.newPassword) {
      return new Response(JSON.stringify({ success: false, error: '缺少新密碼' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await setAdminPassword(db, adminId, body.newPassword);
    return new Response(JSON.stringify({ success: result.success, error: result.error }), { 
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('設置管理員密碼錯誤:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `設置管理員密碼時發生錯誤: ${error.message}` 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理創建新管理員請求
 * @param {Object} db - 資料庫連接對象
 * @param {Request} request - 請求對象
 * @param {Object} authResult - 認證結果
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleCreateAdmin(db, request, authResult) {
  try {
    const data = await request.json();
    const { username, password, email = '' } = data;
    
    if (!username || !password) {
      return new Response(JSON.stringify({ success: false, error: '使用者名稱和密碼不能為空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 檢查使用者名稱格式
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return new Response(JSON.stringify({ success: false, error: '使用者名稱只能包含字母、數字和下劃線，長度3-20位' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 檢查密碼長度
    if (password.length < 6) {
      return new Response(JSON.stringify({ success: false, error: '密碼至少需要6個字元' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 檢查使用者名稱是否已存在
    const exists = await isAdminUsernameExists(db, username);
    if (exists) {
      return new Response(JSON.stringify({ success: false, error: '該使用者名稱已被使用' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 直接傳遞對象而非散列密碼，讓 createAdmin 內部處理散列
    const result = await createAdmin(db, { username, password, email });
    
    if (!result.success) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: result.error || '創建管理員失敗'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 記錄日誌
    await addLog(db, authResult.user.user_id, authResult.user.username, `創建管理員: ${username}`);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `已成功創建管理員: ${username}`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('創建管理員錯誤:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `創建管理員時發生錯誤: ${error.message}` 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 處理刪除管理員請求
 * @param {Object} db - 資料庫連接對象
 * @param {string} adminId - 管理員ID
 * @param {Request} request - 請求對象
 * @param {Object} authResult - 認證結果
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleDeleteAdmin(db, adminId, request, authResult) {
  try {
    // 檢查要刪除的管理員ID是否存在
    const admin = await db.prepare(
      "SELECT username, is_disabled FROM admins WHERE id = ?"
    ).bind(adminId).first();
    
    if (!admin) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '找不到該管理員'
      }), { 
        status: 404, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    // 檢查是否在嘗試刪除當前登入的管理員
    if (admin.username === authResult.user.username) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '無法刪除當前登入的管理員'
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    // 檢查是否是最後一個啟用的管理員
    if (!admin.is_disabled) {
      const { count } = await db.prepare(
        "SELECT COUNT(*) as count FROM admins WHERE is_disabled = 0"
      ).first();
      
      if (count <= 1) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: '無法刪除最後一個啟用的管理員，系統必須至少保留一個啟用的管理員'
        }), { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // 先刪除與該管理員相關的會話，以避免外鍵約束問題
    await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(adminId).run();
    
    // 刪除管理員
    await db.prepare("DELETE FROM admins WHERE id = ?").bind(adminId).run();
    
    // 記錄操作日誌
    await addLog(db, authResult.user.user_id, authResult.user.username, `刪除管理員: ${admin.username}`);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `已成功刪除管理員 ${admin.username}`
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('刪除管理員錯誤:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `刪除管理員時發生錯誤: ${error.message}` 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 管理員API路由處理函數
 * @param {Object} db - 資料庫連接對象
 * @param {Request} request - 請求對象
 * @param {Object} authResult - 認證結果
 * @returns {Promise<Response|null>} - HTTP 響應或 null (如果不是管理員API)
 */
export async function handleAdminRequests(db, request, authResult) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // 檢查是否是管理員API
  if (!path.startsWith('/api/admins')) {
    return null;
  }
  
  console.log(`處理管理員API請求: ${method} ${path}`);
  
  // 處理各種管理員API路徑
  
  // 獲取當前管理員資訊
  if (path === '/api/admins/current' && method === 'GET') {
    return await handleGetCurrentAdmin(db, request, authResult);
  }
  
  // 更新管理員使用者名稱
  if (path === '/api/admins/username' && method === 'POST') {
    return await handleUpdateUsername(db, request, authResult);
  }
  
  // 更新管理員密碼
  if (path === '/api/admins/password' && method === 'POST') {
    return await handleUpdatePassword(db, request, authResult);
  }
  
  // 更新管理員信箱
  if (path === '/api/admins/email' && method === 'POST') {
    return await handleUpdateEmail(db, request, authResult);
  }
  
  // 取得所有管理員
  if (path === '/api/admins' && method === 'GET') {
    return await handleGetAllAdmins(db, request, authResult);
  }
  
  // 創建新管理員
  if (path === '/api/admins' && method === 'POST') {
    return await handleCreateAdmin(db, request, authResult);
  }
  
  // 切換管理員啟用/停用
  if (path.match(/^\/api\/admins\/\d+\/toggle-status$/) && method === 'POST') {
    const adminId = path.split('/')[3];
    return await handleToggleAdminStatus(db, adminId, request);
  }
  
  // 修改其他管理員密碼
  if (path.match(/^\/api\/admins\/\d+\/password$/) && method === 'POST') {
    const adminId = path.split('/')[3];
    return await handleSetAdminPassword(db, adminId, request);
  }
  
  // 刪除管理員
  if (path.match(/^\/api\/admins\/\d+$/) && method === 'DELETE') {
    const adminId = path.split('/')[3];
    return await handleDeleteAdmin(db, adminId, request, authResult);
  }
  
  // 如果沒有匹配的路由
  return new Response(JSON.stringify({ error: `未找到管理員API路由: ${path}` }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
