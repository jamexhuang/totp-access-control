import { nanoid, generateSecret } from '../utils/crypto.js';
import { DEFAULT_USERS } from '../config/constants.js';

/**
 * 檢查並添加預設用戶，只添加管理者且避免重複添加
 * @param {D1Database} db - 資料庫連接對象
 * @returns {Promise<Object>} - 操作結果，包含 {success, [error]} 欄位
 */
export async function checkAndAddDefaultUsers(db) {
  try {
    for (const defaultUser of DEFAULT_USERS) {
      // 檢查使用者名稱是否已存在
      const { count } = await db.prepare("SELECT COUNT(*) as count FROM users WHERE name = ?").bind(defaultUser.name).first();
      
      // 只有在不存在時才添加
      if (count === 0) {
        const id = nanoid();
        const secret = generateSecret();
        await db.prepare(
          "INSERT INTO users (id, name, secret, created_at, is_temporary, temporary_expiry, is_disabled) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(id, defaultUser.name, secret, Date.now(), defaultUser.is_temporary ? 1 : 0, null, 0).run();
        
        console.log(`添加了預設用戶: ${defaultUser.name}`);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('檢查與添加預設用戶錯誤:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 檢查使用者名稱是否已存在
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} name - 使用者名稱
 * @returns {Promise<Object>} - 檢查結果，包含 {exists, [error]} 欄位
 */
export async function isUserNameExists(db, name) {
  try {
    const { count } = await db.prepare("SELECT COUNT(*) as count FROM users WHERE name = ?").bind(name).first();
    return { success: true, exists: count > 0 };
  } catch (error) {
    console.error('檢查使用者名稱是否存在時出錯:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 獲取所有用戶列表
 * @param {D1Database} db - 資料庫連接對象
 * @returns {Promise<Object>} - 查詢結果，包含 {success, users, [error]} 欄位
 */
export async function getAllUsers(db) {
  try {
    const { results } = await db.prepare(
      "SELECT id, name, created_at, is_temporary, temporary_expiry, is_disabled FROM users"
    ).all();
    return { success: true, users: results || [] };
  } catch (error) {
    console.error('獲取所有用戶失敗:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 根據ID獲取用戶詳情
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} id - 用戶ID
 * @returns {Promise<Object>} - 查詢結果，包含 {success, user, [error]} 欄位
 */
export async function getUserById(db, id) {
  try {
    const user = await db.prepare(
      "SELECT id, name, secret, created_at, is_temporary, temporary_expiry, is_disabled FROM users WHERE id = ?"
    ).bind(id).first();
    
    if (!user) {
      return { success: false, error: '用戶不存在' };
    }
    
    return { success: true, user };
  } catch (error) {
    console.error('獲取用戶詳情失敗:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 創建新用戶
 * @param {D1Database} db - 資料庫連接對象
 * @param {Object} userData - 用戶資料
 * @returns {Promise<Object>} - 創建的用戶資料
 */
export async function createUser(db, { name, is_temporary = false, expiry_days = 0 }) {
  const id = nanoid();
  const secret = generateSecret();
  const created_at = Date.now();
  
  // 如果是臨時用戶，計算過期時間
  let temporary_expiry = null;
  if (is_temporary && expiry_days > 0) {
    temporary_expiry = created_at + (expiry_days * 24 * 60 * 60 * 1000);
  }
  
  await db.prepare(
    "INSERT INTO users (id, name, secret, created_at, is_temporary, temporary_expiry, is_disabled) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, name, secret, created_at, is_temporary ? 1 : 0, temporary_expiry, 0).run();
  
  return { 
    id, 
    name, 
    secret, 
    created_at, 
    is_temporary,
    temporary_expiry,
    is_disabled: false
  };
}

/**
 * 切換用戶啟用/停用狀態
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} id - 用戶ID
 * @returns {Promise<Object>} - 更新後的用戶狀態
 */
export async function toggleUserStatus(db, id) {
  try {
    // 查詢用戶當前狀態
    const user = await db.prepare(
      "SELECT id, name, is_disabled FROM users WHERE id = ?"
    ).bind(id).first();
    
    if (!user) {
      return { success: false, error: '用戶不存在' };
    }
    
    // 切換狀態
    const newStatus = user.is_disabled ? 0 : 1;
    await db.prepare(
      "UPDATE users SET is_disabled = ? WHERE id = ?"
    ).bind(newStatus, id).run();
    
    return { 
      success: true,
      user: { 
        id: user.id, 
        name: user.name, 
        is_disabled: newStatus === 1 
      }
    };
  } catch (error) {
    console.error('切換用戶狀態失敗:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 刪除用戶
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} id - 用戶ID
 * @returns {Promise<Object>} - 刪除操作結果
 */
export async function deleteUser(db, id) {
  try {
    const user = await db.prepare(
      "SELECT name FROM users WHERE id = ?"
    ).bind(id).first();
    
    if (!user) {
      return { success: false, error: '用戶不存在' };
    }
    
    // 先刪除與該用戶相關的所有日誌記錄，解決外鍵約束問題
    await db.prepare("DELETE FROM logs WHERE user_id = ?").bind(id).run();
    
    // 然後刪除用戶
    await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    
    return { success: true, user: { id, name: user.name } };
  } catch (error) {
    console.error('刪除用戶失敗:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 取得所有有效的用戶（未停用且未過期）
 * @param {D1Database} db - 資料庫連接對象
 * @returns {Promise<Array>} - 有效用戶列表
 */
export async function getActiveUsers(db) {
  const now = Date.now();
  const { results } = await db.prepare(`
    SELECT * FROM users 
    WHERE is_disabled = 0 
    AND (is_temporary = 0 OR temporary_expiry IS NULL OR temporary_expiry > ?)
  `).bind(now).all();
  
  return results || [];
}

/**
 * 根據用戶ID前綴查找用戶
 * @param {D1Database} db - 數據庫連接對象
 * @param {string} idPrefix - 用戶ID前綴（通常是前6個字符）
 * @returns {Promise<Array>} - 匹配前綴的用戶列表
 */
export async function getUsersByIdPrefix(db, idPrefix) {
  try {
    // 使用LIKE查詢匹配以指定前綴開頭的ID
    const query = `
      SELECT * FROM users 
      WHERE id LIKE ? || '%'
    `;
    
    const users = await db.prepare(query).bind(idPrefix).all();
    
    if (users.error) {
      throw new Error(users.error);
    }
    
    return users.results || [];
  } catch (error) {
    console.error('根據ID前綴獲取用戶失敗:', error);
    throw error;
  }
}
