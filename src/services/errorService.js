/**
 * 錯誤處理服務模組
 * 統一處理應用程式中的各種錯誤
 */
import { errorResponse } from './responseService.js';

/**
 * 錯誤類型對應表
 */
const ERROR_TYPES = {
  'ValidationError': { status: 400, message: '請求參數無效', code: 'VALIDATION_ERROR' },
  'AuthError': { status: 401, message: '認證失敗', code: 'AUTH_ERROR' },
  'NotFoundError': { status: 404, message: '資源不存在', code: 'NOT_FOUND' },
  'ForbiddenError': { status: 403, message: '拒絕存取', code: 'FORBIDDEN' },
  'default': { status: 500, message: '伺服器內部錯誤', code: 'SERVER_ERROR' }
};

/**
 * 處理應用程式錯誤並返回適當的響應
 * @param {Error} error - 捕獲的錯誤對象
 * @param {string} environment - 執行環境 (production, development)
 * @returns {Response} - 標準化的錯誤響應
 */
export function handleError(error, environment) {
  console.error('應用程式錯誤:', error);
  
  // 查找錯誤類型或使用預設值
  const errorType = ERROR_TYPES[error.name] || ERROR_TYPES.default;
  
  // 在開發環境顯示詳細錯誤信息
  const message = environment === 'production' 
    ? errorType.message 
    : `${errorType.message}: ${error.message}`;
  
  return errorResponse(message, errorType.status, errorType.code);
}

/**
 * 創建標準錯誤響應 (保留向後兼容)
 * @param {string} message - 錯誤信息
 * @param {number} status - HTTP 狀態碼
 * @returns {Response} - 格式化的錯誤響應
 * @deprecated 使用 errorResponse 替代
 */
export function createErrorResponse(message, status = 500) {
  return errorResponse(message, status);
}
