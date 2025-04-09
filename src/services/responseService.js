/**
 * API 回應格式標準化服務
 * 提供統一的 API 回應格式處理
 */
import { getCorsHeaders } from './corsService.js';

/**
 * 生成成功回應
 * @param {any} data - 回應資料
 * @param {string|null} message - 可選的成功訊息
 * @param {number} status - HTTP 狀態碼，預設 200
 * @returns {Response} - 標準格式的成功回應
 */
export function successResponse(data = null, message = null, status = 200) {
  const responseBody = {
    success: true,
    timestamp: new Date().toISOString()
  };
  
  // 如果有資料則添加
  if (data !== null) {
    responseBody.data = data;
  }
  
  // 如果有訊息則添加
  if (message) {
    responseBody.message = message;
  }
  
  return new Response(JSON.stringify(responseBody), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders()
    }
  });
}

/**
 * 生成錯誤回應
 * @param {string} message - 錯誤訊息
 * @param {number} status - HTTP 狀態碼
 * @param {string|null} errorCode - 錯誤代碼
 * @returns {Response} - 標準格式的錯誤回應
 */
export function errorResponse(message, status = 400, errorCode = null) {
  const responseBody = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  
  // 如果有錯誤代碼則添加
  if (errorCode) {
    responseBody.errorCode = errorCode;
  }
  
  return new Response(JSON.stringify(responseBody), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders()
    }
  });
}

/**
 * 將現有回應轉換為標準格式
 * @param {Response} originalResponse - 原始回應對象
 * @returns {Promise<Response>} - 標準格式的回應
 */
export async function standardizeResponse(originalResponse) {
  try {
    // 讀取原始回應內容
    const originalBody = await originalResponse.json();
    
    // 檢查回應是否已經符合標準格式
    if (originalBody.success === true || originalBody.success === false) {
      // 如果已經是標準格式，只添加時間戳（如果沒有）
      if (!originalBody.timestamp) {
        originalBody.timestamp = new Date().toISOString();
      }
      
      return new Response(JSON.stringify(originalBody), {
        status: originalResponse.status,
        headers: originalResponse.headers
      });
    }
    
    // 根據狀態碼判斷是成功還是錯誤回應
    if (originalResponse.ok) {
      return successResponse(originalBody);
    } else {
      const errorMsg = originalBody.error || originalBody.message || '未知錯誤';
      return errorResponse(errorMsg, originalResponse.status);
    }
  } catch (error) {
    // 如果無法解析JSON，返回原始回應
    console.error('標準化回應時出錯:', error);
    return originalResponse;
  }
}
