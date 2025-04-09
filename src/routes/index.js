/**
 * 路由總入口模組
 * 整合所有路由處理邏輯
 */
import { handleAuthRoutes } from './authRoutes.js';
import { handleApiRoutes } from './apiRoutes.js';
import { errorResponse } from '../services/responseService.js';

/**
 * 處理所有路由
 * @param {Request} request - 請求對象
 * @param {Object} env - 環境變量
 * @param {Object} context - 執行上下文
 * @param {D1Database} db - 資料庫連接
 * @param {Object} authResult - 認證結果
 * @param {number} startTime - 系統啟動時間
 * @returns {Promise<Response|null>} - HTTP 響應或 null
 */
export async function handleRoutes(request, env, context, db, authResult, startTime) {
  // 1. 嘗試處理認證路由
  const authResponse = await handleAuthRoutes(request, db);
  if (authResponse) {
    return authResponse;
  }
  
  // 2. 認證驗證失敗處理
  if (!authResult.authenticated) {
    if (authResult.isApiRequest) {
      // API請求返回JSON格式的錯誤響應
      return errorResponse(authResult.reason || '未授權的API存取', 401, 'UNAUTHORIZED');
    } else {
      // 網頁請求重定向到登入頁面
      return Response.redirect(authResult.redirectUrl, 302);
    }
  }
  
  // 3. 處理API路由
  const apiResponse = await handleApiRoutes(request, db, authResult, startTime);
  if (apiResponse) {
    return apiResponse;
  }
  
  // 4. 處理靜態資源
  return env.ASSETS.fetch(request);
}
