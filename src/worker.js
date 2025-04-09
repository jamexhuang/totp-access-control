// 導入模塊
import { initializeDb, checkSystemStartTime } from './models/db.js';
import { checkAndAddDefaultUsers } from './models/users.js';
import { checkAndAddDefaultAdmin } from './models/admins.js';
// 導入認證服務
import { authMiddleware } from './services/authService.js';
// 導入路由處理器
import { handleRoutes } from './routes/index.js';
import { handleOptionsRequest, addCorsHeaders } from './services/corsService.js';
import { handleError } from './services/errorService.js';

// 全域狀態追蹤初始化
let isDbInitialized = false;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    console.log(`收到請求: ${request.method} ${url.pathname}`);

    try {
      // 處理 CORS 預檢請求
      if (request.method === 'OPTIONS') {
        return handleOptionsRequest();
      }
      
      // 初始化應用程式
      const db = env.DB;
      await initializeAppIfNeeded(db, env.NODE_ENV);
      const startTime = await checkSystemStartTime(env);
      
      // 認證處理
      const authResult = await authMiddleware(db, request);
      
      // 路由處理
      const response = await handleRoutes(request, env, ctx, db, authResult, startTime);
      
      // 加入 CORS 標頭
      return addCorsHeaders(response);
    } catch (error) {
      return handleError(error, env.NODE_ENV);
    }
  }
};

/**
 * 初始化應用程式資源(只在必要時執行)
 */
async function initializeAppIfNeeded(db, environment) {
  if (!isDbInitialized || environment === 'development') {
    console.log('初始化應用資源...');
    await initializeDb(db);
    await checkAndAddDefaultUsers(db);
    await checkAndAddDefaultAdmin(db);
    isDbInitialized = true;
  }
}