/**
 * 系統相關 API 處理模組
 * 封裝所有與系統相關的請求處理邏輯
 */
import { getRecentLogs } from '../services/logService.js';
import { successResponse, errorResponse } from '../services/responseService.js';

/**
 * 處理系統請求
 * @param {Request} request - 請求對象
 * @param {D1Database} db - 資料庫連接
 * @param {number} startTime - 系統啟動時間
 * @returns {Promise<Response>} - HTTP 響應
 */
export async function handleSystemRequests(request, db, startTime) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // 日誌 API
  if (path === '/api/logs' && method === 'GET') {
    return await handleGetLogs(db);
  }
  
  // 系統狀態 API
  if (path === '/api/status' && method === 'GET') {
    return await handleGetStatus(db, startTime);
  }
  
  return errorResponse(`未找到系統API路由: ${path}`, 404, 'ROUTE_NOT_FOUND');
}

/**
 * 處理取得日誌請求
 * @param {D1Database} db - 資料庫連接
 * @returns {Promise<Response>} - HTTP 響應
 */
async function handleGetLogs(db) {
  try {
    const logs = await getRecentLogs(db, 100);
    return successResponse(logs, '成功獲取系統日誌');
  } catch (error) {
    console.error('獲取日誌錯誤:', error);
    return errorResponse(error.message, 500, 'LOGS_FETCH_ERROR');
  }
}

/**
 * 處理取得系統狀態請求
 * @param {D1Database} db - 資料庫連接
 * @param {number} startTime - 系統啟動時間
 * @returns {Promise<Response>} - HTTP 響應
 */
async function handleGetStatus(db, startTime) {
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
