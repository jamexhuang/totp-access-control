import bcrypt from 'bcryptjs';
import { DEFAULT_ADMIN } from '../config/constants.js';

/**
 * 檢查並添加默認管理員帳戶
 * @param {D1Database} db - 資料庫連接對象
 * @returns {Promise<Object>} - 操作結果
 */
export async function checkAndAddDefaultAdmin(db) {
  try {
    // 檢查管理員帳戶是否已存在（任何用戶，不僅僅是admin）
    const { count } = await db.prepare("SELECT COUNT(*) as count FROM admins").first();
    
    // 如果不存在任何管理員，則添加默認管理員
    if (count === 0) {
      await db.prepare(
        "INSERT INTO admins (username, password, email, created_at) VALUES (?, ?, ?, ?)"
      ).bind(DEFAULT_ADMIN.username, DEFAULT_ADMIN.password, DEFAULT_ADMIN.email, Date.now()).run();
      
      console.log(`添加了默認管理員帳戶: ${DEFAULT_ADMIN.username}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('檢查與添加默認管理員帳戶錯誤:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 檢查管理員使用者名稱是否已存在
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} username - 使用者名稱
 * @param {number|null} excludeId - 排除的ID
 * @returns {Promise<boolean>} - 是否存在
 */
export async function isAdminUsernameExists(db, username, excludeId = null) {
  try {
    let query = "SELECT COUNT(*) as count FROM admins WHERE username = ?";
    let params = [username];
    
    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }
    
    const { count } = await db.prepare(query).bind(...params).first();
    return count > 0;
  } catch (error) {
    console.error('檢查管理員使用者名稱是否存在時出錯:', error);
    throw error;
  }
}

/**
 * 驗證管理員憑證
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} username - 使用者名稱
 * @param {string} password - 密碼
 * @returns {Promise<Object>} - 驗證結果
 */
export async function verifyAdminCredentials(db, username, password) {
  try {
    console.log(`嘗試驗證用戶: ${username}`);
    
    // 查詢管理員資訊
    const admin = await db.prepare(
      "SELECT * FROM admins WHERE username = ?"
    ).bind(username).first();
    
    // 如果在資料庫中沒有找到該使用者名稱，檢查是否是預設的admin帳號
    if (!admin) {
      // 特殊情況：僅當使用者名稱是"admin"且密碼是"admin123"時
      if (username === "admin" && password === "admin123") {
        console.log('使用默認管理員憑據登錄');
        return {
          valid: true,
          admin: {
            username: "admin",
            email: "admin@example.com"
          }
        };
      }
      
      console.log(`使用者名稱不存在: ${username}`);
      return { valid: false, reason: '使用者名稱不存在' };
    }
    
    // 檢查帳戶是否被停用
    if (admin.is_disabled) {
      console.log(`用戶 ${username} 已被停用`);
      return { valid: false, reason: '此帳戶已被停用' };
    }
    
    // 驗證密碼
    let passwordValid = false;
    try {
      // 嘗試使用bcrypt比較密碼
      passwordValid = await bcrypt.compare(password, admin.password);
      console.log(`密碼驗證結果: ${passwordValid}`);
    } catch (compareError) {
      console.error('bcrypt密碼比較錯誤:', compareError);
      // bcrypt出錯時，嘗試直接比較（僅對默認密碼）
      if (password === "admin123" && admin.password === DEFAULT_ADMIN.password) {
        console.log('回退到直接比較默認密碼');
        passwordValid = true;
      }
    }
    
    if (!passwordValid) {
      return { valid: false, reason: '密碼不正確' };
    }
    
    return { 
      valid: true, 
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email || ''
      }
    };
  } catch (error) {
    console.error('驗證管理員憑據錯誤:', error);
    return { valid: false, reason: '驗證憑據時發生錯誤: ' + error.message };
  }
}

/**
 * 更新管理員使用者名稱
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} currentUsername - 當前使用者名稱
 * @param {string} newUsername - 新使用者名稱
 * @returns {Promise<Object>} - 更新結果
 */
export async function updateAdminUsername(db, currentUsername, newUsername) {
  try {
    console.log(`嘗試將管理員使用者名稱從 ${currentUsername} 更改為 ${newUsername}`);
    
    // 檢查新使用者名稱是否已存在
    const exists = await isAdminUsernameExists(db, newUsername);
    if (exists) {
      console.log(`使用者名稱 ${newUsername} 已存在`);
      return { success: false, error: '該使用者名稱已被使用' };
    }
    
    // 查詢admin表中當前用戶的紀錄
    const admin = await db.prepare(
      "SELECT id FROM admins WHERE username = ?"
    ).bind(currentUsername).first();
    
    if (!admin) {
      console.log(`未找到使用者名稱為 ${currentUsername} 的紀錄`);
      return { success: false, error: '未找到要更新的用戶記錄' };
    }
    
    console.log(`找到用戶ID: ${admin.id}，準備更新...`);
    
    // 使用D1批處理API更新所有相關表
    await db.batch([
      // 1. 更新管理員表
      db.prepare("UPDATE admins SET username = ? WHERE id = ?")
        .bind(newUsername, admin.id),
      
      // 2. 更新會話表
      db.prepare("UPDATE sessions SET username = ? WHERE user_id = ?")
        .bind(newUsername, admin.id.toString())
    ]);
    
    console.log(`成功將管理員使用者名稱從 ${currentUsername} 更改為 ${newUsername}`);
    return { success: true };
  } catch (error) {
    console.error('更新管理員使用者名稱時出錯:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 更新管理員密碼
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} username - 使用者名稱
 * @param {string} currentPassword - 當前密碼
 * @param {string} newPassword - 新密碼
 * @returns {Promise<Object>} - 更新結果
 */
export async function updateAdminPassword(db, username, currentPassword, newPassword) {
  try {
    console.log(`嘗試更新用戶 ${username} 的密碼`);
    
    // 驗證當前密碼
    const verifyResult = await verifyAdminCredentials(db, username, currentPassword);
    if (!verifyResult.valid) {
      console.log('當前密碼驗證失敗');
      return { success: false, error: '當前密碼不正確' };
    }
    
    // 哈希新密碼
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(newPassword, 10);
      console.log('新密碼哈希成功');
    } catch (hashError) {
      console.error('哈希新密碼失敗:', hashError);
      return { success: false, error: '處理新密碼時出錯' };
    }
    
    // 更新密碼
    await db.prepare(
      "UPDATE admins SET password = ? WHERE username = ?"
    ).bind(hashedPassword, username).run();
    
    console.log(`用戶 ${username} 的密碼已成功更新`);
    return { success: true };
  } catch (error) {
    console.error('更新密碼時出錯:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 獲取管理員ID
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} username - 使用者名稱
 * @returns {Promise<string>} - 管理員ID
 */
export async function getAdminIdByUsername(db, username) {
  try {
    // 首先檢查管理員表
    const admin = await db.prepare("SELECT id FROM admins WHERE username = ?").bind(username).first();
    if (admin && admin.id) {
      return admin.id.toString();
    }
    
    // 如果管理員表沒有找到，使用一個固定格式的ID
    return `admin_${username}`;
  } catch (error) {
    console.error('獲取管理員ID錯誤:', error);
    // 失敗時返回一個基於使用者名稱的ID
    return `admin_${username}_${Date.now()}`;
  }
}

/**
 * 獲取所有管理員
 * @param {D1Database} db - 資料庫連接對象
 * @returns {Promise<Array>} - 管理員列表
 */
export async function getAllAdmins(db) {
  const { results } = await db.prepare(
    "SELECT id, username, email, is_disabled FROM admins"
  ).all();
  return results || [];
}

/**
 * 獲取管理員詳情
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} username - 使用者名稱
 * @returns {Promise<Object>} - 管理員詳情
 */
export async function getAdminByUsername(db, username) {
  return await db.prepare(
    "SELECT id, username, email, created_at, last_login FROM admins WHERE username = ?"
  ).bind(username).first();
}

/**
 * 切換管理員啟用/停用狀態
 * @param {D1Database} db - 資料庫連接對象
 * @param {number} id - 管理員ID
 * @returns {Promise<Object>} - 操作結果
 */
export async function toggleAdminStatus(db, id) {
  const admin = await db.prepare(
    "SELECT is_disabled FROM admins WHERE id = ?"
  ).bind(id).first();
  
  if (!admin) {
    return { success: false, error: '找不到該管理員' };
  }
  
  // 如果要停用（當前是啟用狀態），檢查是否是最後一個啟用的管理員
  if (!admin.is_disabled) {
    const { count } = await db.prepare(
      "SELECT COUNT(*) as count FROM admins WHERE is_disabled = 0"
    ).first();
    
    if (count <= 1) {
      return { 
        success: false, 
        error: '無法停用最後一個啟用的管理員帳戶，系統必須至少保留一個啟用的管理員' 
      };
    }
  }
  
  const newStatus = admin.is_disabled ? 0 : 1;
  await db.prepare(
    "UPDATE admins SET is_disabled = ? WHERE id = ?"
  ).bind(newStatus, id).run();
  
  return { success: true };
}

/**
 * 直接變更管理員密碼（管理功能）
 * @param {D1Database} db - 資料庫連接對象
 * @param {number} id - 管理員ID
 * @param {string} newPassword - 新密碼
 * @returns {Promise<Object>} - 操作結果
 */
export async function setAdminPassword(db, id, newPassword) {
  try {
    const hashedPwd = await bcrypt.hash(newPassword, 10);
    await db.prepare(
      "UPDATE admins SET password = ? WHERE id = ?"
    ).bind(hashedPwd, id).run();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 創建新管理員
 * @param {D1Database} db - 資料庫連接對象
 * @param {Object} data - 管理員資料
 * @returns {Promise<Object>} - 操作結果
 */
export async function createAdmin(db, { username, password, email = '' }) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db.prepare(
      "INSERT INTO admins (username, password, email, created_at, is_disabled) VALUES (?, ?, ?, ?, 0)"
    ).bind(username, hashedPassword, email, Date.now()).run();
    
    return { 
      success: true,
      message: `已成功創建管理員: ${username}`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 更新管理員信箱
 * @param {D1Database} db - 資料庫連接對象
 * @param {string} username - 使用者名稱
 * @param {string} email - 新信箱
 * @returns {Promise<boolean>} - 是否成功
 */
export async function updateAdminEmail(db, username, email) {
  await db.prepare(
    "UPDATE admins SET email = ? WHERE username = ?"
  ).bind(email, username).run();
  return true;
}
