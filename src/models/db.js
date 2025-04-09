// 資料庫初始化和管理模型

/**
 * 初始化資料庫結構，確保所有必要的表和欄位存在
 * @param {D1Database} db - Cloudflare D1資料庫實例
 * @returns {Promise<Object>} - 初始化結果
 */
export async function initializeDb(db) {
  try {
    // 嘗試使用 transaction 來確保資料庫操作能夠完整執行
    await db.batch([
      // 創建用戶表
      db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          secret TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          is_temporary BOOLEAN DEFAULT FALSE,
          temporary_expiry INTEGER,
          is_disabled BOOLEAN DEFAULT FALSE
        )
      `),
      
      // 創建日誌表
      db.prepare(`
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          user_name TEXT,
          action TEXT,
          timestamp INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `),
      
      // 創建會話表 - 修改結構，確保與實際資料庫結構一致
      db.prepare(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          username TEXT NOT NULL,
          email TEXT,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          last_activity INTEGER NOT NULL
        )
      `)
    ]);
    
    // 確保管理員表存在
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        created_at INTEGER NOT NULL,
        last_login INTEGER
      )
    `).run();
    
    // 檢查是否需要添加 is_disabled 欄位（相容現有資料庫）
    try {
      const tableInfo = await db.prepare("PRAGMA table_info(users)").all();
      const hasDisabledField = tableInfo.results.some(col => col.name === 'is_disabled');
      
      if (!hasDisabledField) {
        console.log('正在添加 is_disabled 欄位到用戶表...');
        await db.prepare("ALTER TABLE users ADD COLUMN is_disabled BOOLEAN DEFAULT FALSE").run();
      }
    } catch (e) {
      console.error('檢查或添加 is_disabled 欄位失敗:', e);
    }

    // 確保 admins 表有 is_disabled 欄位 (類似先前對 users 的做法)
    try {
      const adminTableInfo = await db.prepare("PRAGMA table_info(admins)").all();
      const hasAdminDisabledField = adminTableInfo.results.some(col => col.name === 'is_disabled');
      if (!hasAdminDisabledField) {
        console.log('正在為admins表新增 is_disabled 欄位...');
        await db.prepare("ALTER TABLE admins ADD COLUMN is_disabled BOOLEAN DEFAULT FALSE").run();
      }
    } catch (e) {
      console.error('檢查或添加 admins.is_disabled 欄位失敗:', e);
    }
    
    return { success: true };
  } catch (error) {
    console.error('初始化資料庫錯誤:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 檢查系統啟動時間，若不存在則設置
 * @param {Object} env - 環境變數對象，包含KV存儲
 * @returns {Promise<number>} - 系統啟動時間的時間戳
 */
export async function checkSystemStartTime(env) {
  let startTime = await env.HOME_OTP.get('system:start_time');
  if (!startTime) {
    startTime = Date.now().toString();
    await env.HOME_OTP.put('system:start_time', startTime);
  }
  return parseInt(startTime);
}
