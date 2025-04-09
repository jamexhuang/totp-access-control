/**
 * 門禁控制服務
 * 處理所有與門禁系統的API通訊
 */

/**
 * 觸發開門操作
 * @param {string} username - 授權用戶的名稱
 * @returns {Promise<Object>} - 操作結果
 */

import { DOOR_API } from '../config/constants.js';

export async function triggerDoorOpen(username) {
  try {
    console.log(`觸發開門操作，授權用戶: ${username}`);
    
    const doorApiUrl = DOOR_API.url;
    const doorApiToken = DOOR_API.apikey;
    
    // 添加超時處理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超時
    
    try {
      const response = await fetch(doorApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${doorApiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "entity_id": "script.open_door"
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId); // 清除超時
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`開門API調用失敗，狀態碼: ${response.status}, 錯誤: ${errorText}`);
        return { success: false, error: `API調用失敗: ${response.status}`, details: errorText };
      }
      
      const responseData = await response.json().catch(() => ({}));
      console.log('開門API調用成功，響應:', responseData);
      return { success: true, response: responseData };
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        console.error('開門API調用超時');
        return { success: false, error: '開門API調用超時', timeout: true };
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('觸發開門操作時出錯:', error);
    return { success: false, error: error.message, stack: error.stack };
  }
}
