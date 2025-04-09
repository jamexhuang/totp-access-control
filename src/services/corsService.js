/**
 * CORS 服務模組
 * 處理所有與跨域資源共享相關的邏輯
 */

/**
 * 獲取標準 CORS 標頭
 */
export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * 處理 CORS 預檢請求
 */
export function handleOptionsRequest() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders()
  });
}

/**
 * 為回應添加 CORS 標頭
 */
export function addCorsHeaders(response) {
  const newHeaders = new Headers(response.headers);
  const corsHeaders = getCorsHeaders();
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
