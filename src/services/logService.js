/**
 * 系統日誌服務
 * 處理所有與系統日誌相關的操作
 */

/**
 * 添加系統日誌
 * @param {Object} db - 資料庫連接物件
 * @param {string|null} user_id - 用戶ID
 * @param {string} user_name - 用戶名稱
 * @param {string} action - 操作描述
 * @returns {Promise<boolean>} - 操作結果
 */
export async function addLog(db, user_id, user_name, action) {
  try {
    // 若 user_id 不存在於 users 資料表，將其設為 null
    if (user_id) {
      const userExists = await db.prepare("SELECT id FROM users WHERE id = ?")
        .bind(user_id)
        .first();
      if (!userExists) {
        user_id = null;
      }
    }
    const timestamp = Date.now();
    await db.prepare("INSERT INTO logs (user_id, user_name, action, timestamp) VALUES (?, ?, ?, ?)")
      .bind(user_id, user_name, action, timestamp)
      .run();
    return true;
  } catch (error) {
    console.error('Error adding log:', error);
    return false;
  }
}

/**
 * 獲取最近的系統日誌
 * @param {Object} db - 資料庫連接物件
 * @param {number} limit - 返回記錄數量限制
 * @returns {Promise<Array>} - 日誌記錄列表
 */
export async function getRecentLogs(db, limit = 100) {
  try {
    const { results } = await db.prepare(
      "SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?"
    ).bind(limit).all();
    return results;
  } catch (error) {
    console.error('Error fetching logs:', error);
    return [];
  }
}
