/**
 * API 路由處理模組
 * 負責處理所有 /api/ 路徑下的請求
 */
import { handleAdminRequests } from '../handlers/adminHandler.js';
import { handleUserRequests } from '../handlers/userHandler.js';
import { handleSystemRequests } from '../handlers/systemHandler.js';

// 定義 API 路由表
const API_ROUTES = [
  {
    pathMatch: path => path.startsWith('/api/admins'),
    handler: handleAdminRequests
  },
  {
    pathMatch: path => path.startsWith('/api/users') || path === '/api/verify',
    handler: handleUserRequests
  },
  {
    pathMatch: path => path === '/api/logs' || path === '/api/status',
    handler: handleSystemRequests
  }
];

/**
 * 處理 API 路由
 * @param {Request} request - 請求對象
 * @param {D1Database} db - 資料庫連接
 * @param {Object} authResult - 認證結果
 * @param {number} startTime - 系統啟動時間
 * @returns {Promise<Response|null>} - HTTP 響應或 null (如果不是 API 路由)
 */
export async function handleApiRoutes(request, db, authResult, startTime) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 檢查是否是 API 路由
  if (!path.startsWith('/api/')) {
    return null;
  }

  console.log(`處理 API 路由: ${request.method} ${path}`);
  
  // 遍歷路由表查找匹配的處理函數
  for (const route of API_ROUTES) {
    if (route.pathMatch(path)) {
      // 統一參數順序：request, db, [其他可選參數]
      if (route.handler === handleSystemRequests) {
        return await route.handler(request, db, startTime);
      } else {
        return await route.handler(db, request, authResult);
      }
    }
  }
  
  // 如果沒有匹配的 API 路由
  return new Response(JSON.stringify({ error: '未找到 API 路由' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
