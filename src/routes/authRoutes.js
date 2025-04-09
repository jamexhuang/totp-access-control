/**
 * 認證相關路由處理模組
 * 負責處理所有 /auth/ 路徑下的請求
 */
import { handleLogin, handleSessionCheck, handleLogout } from '../handlers/authHandler.js';

// 定義認證路由表
const AUTH_ROUTES = [
  {
    path: '/auth/login',
    method: 'POST',
    handler: handleLogin
  },
  {
    path: '/auth/check',
    method: 'GET',
    handler: handleSessionCheck
  },
  {
    path: '/auth/logout',
    method: 'GET',
    handler: handleLogout
  }
];

/**
 * 處理認證相關路由
 * @param {Request} request - 請求對象
 * @param {D1Database} db - 資料庫連接
 * @returns {Promise<Response|null>} - HTTP 響應或 null (如果不是認證路由)
 */
export async function handleAuthRoutes(request, db) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // 檢查是否是認證路由
  if (!path.startsWith('/auth/')) {
    return null;
  }

  console.log(`處理認證路由: ${method} ${path}`);

  // 遍歷路由表查找匹配的處理函數
  for (const route of AUTH_ROUTES) {
    if (route.path === path && route.method === method) {
      return await route.handler(request, db);
    }
  }

  // 如果沒有匹配的認證路由
  return new Response(JSON.stringify({ error: '未找到認證路由' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
