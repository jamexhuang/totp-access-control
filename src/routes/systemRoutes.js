/**
 * 系統相關路由處理模組
 * 負責處理日誌和系統狀態等 API
 */
import { getRecentLogs } from '../services/logService.js';
import { successResponse, errorResponse } from '../services/responseService.js';

/**
 * 處理系統相關路由
 * @param {Request} request - 請求對象
 * @param {D1Database} db - 資料庫連接
 * @param {number} startTime - 系統啟動時間
 * @returns {Promise<Response|null>} - HTTP 響應或 null (如果不是系統路由)
 */
export async function handleSystemRoutes(request, db, startTime) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // 日誌 API
  if (path === '/api/logs' && method === 'GET') {
    try {
      const logs = await getRecentLogs(db, 100);
      return successResponse(logs, '成功獲取系統日誌');
    } catch (error) {
      console.error('獲取日誌錯誤:', error);
      return errorResponse(error.message, 500, 'LOGS_FETCH_ERROR');
    }
  }
  
  // 系統狀態 API
  if (path === '/api/status' && method === 'GET') {
    try {
      const now = Date.now();
      
      // 獲取用戶數量
      const { count: userCount } = await db.prepare(
        "SELECT COUNT(*) as count FROM users"
      ).first();
      
      // 獲取啟用的用戶數量
      const { count: activeUserCount } = await db.prepare(
        "SELECT COUNT(*) as count FROM users WHERE is_disabled = 0"
      ).first();
      
      // 獲取日誌數量
      const { count: logCount } = await db.prepare(
        "SELECT COUNT(*) as count FROM logs"
      ).first();
      
      // 獲取最後一條日誌
      const lastLog = await db.prepare(
        "SELECT * FROM logs ORDER BY timestamp DESC LIMIT 1"
      ).first();
      
      const statusData = {
        uptime: now - startTime,
        start_time: startTime,
        current_time: now,
        user_count: userCount,
        active_user_count: activeUserCount,
        log_count: logCount,
        last_activity: lastLog || null
      };
      
      return successResponse(statusData, '成功獲取系統狀態');
    } catch (error) {
      console.error('獲取系統狀態錯誤:', error);
      return errorResponse(error.message, 500, 'STATUS_FETCH_ERROR');
    }
  }
  
  // 如果不是系統路由
  return null;
}
