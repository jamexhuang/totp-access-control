import { getActiveUsers, getUserById, createUser, getUsersByIdPrefix } from '../models/users.js';
import { addLog } from './logService.js';
import { verifyTOTP, verifyTOTPWithPrefix } from '../utils/otp.js';
import { triggerDoorOpen } from './doorService.js';

/**
 * 用戶驗證服務
 * 整合用戶驗證、權限檢查等功能
 */

/**
 * 驗證用戶的TOTP令牌
 * @param {Object} db - 資料庫連接
 * @param {string} token - TOTP令牌或帶前綴的令牌
 * @returns {Promise<Object>} - 驗證結果
 */
export async function verifyUserToken(db, token) {
  try {
    // 檢查令牌是否包含前綴格式 (6位用戶ID前綴 + 6位TOTP)
    const isPrefixedToken = /^[a-zA-Z0-9]{6}\d{6}$/.test(token);
    const now = Date.now();

    if (isPrefixedToken) {
      // 從令牌中提取前綴
      const prefix = token.substring(0, 6);
      const totpCode = token.substring(6);

      console.log(`檢測到帶前綴的令牌: 前綴=${prefix}, TOTP=${totpCode}`);

      // 獲取與前綴匹配的用戶列表
      const matchingUsers = await getUsersByIdPrefix(db, prefix);
      
      if (matchingUsers.length === 0) {
        return {
          success: false,
          message: '未找到匹配用戶ID前綴的用戶'
        };
      }

      // 遍歷匹配前綴的用戶，驗證TOTP
      for (const user of matchingUsers) {
        if (user.is_disabled) continue;
        
        if (user.is_temporary && user.temporary_expiry && now > user.temporary_expiry) continue;
        
        if (verifyTOTP(user.secret, totpCode)) {
          return {
            success: true,
            user
          };
        }
      }
      
      return {
        success: false,
        message: '無效的令牌或未授權的用戶'
      };
    } else {
      // 沒有前綴，使用原有方法遍歷所有用戶
      const users = await getActiveUsers(db);
      
      for (const user of users) {
        if (user.is_disabled) continue;
        
        if (user.is_temporary && user.temporary_expiry && now > user.temporary_expiry) continue;
        
        if (verifyTOTP(user.secret, token)) {
          return {
            success: true,
            user
          };
        }
      }
      
      return {
        success: false,
        message: '無效的令牌或未授權的用戶'
      };
    }
  } catch (error) {
    console.error('令牌驗證錯誤:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 整合驗證和開門邏輯
 */
export async function verifyAndOpenDoor(db, token) {
  const verifyResult = await verifyUserToken(db, token);
  
  if (!verifyResult.success) {
    return verifyResult;
  }
  
  // 記錄進入日誌
  await addLog(db, verifyResult.user.id, verifyResult.user.name, '進入');
  
  // 嘗試開門
  const doorResult = await triggerDoorOpen(verifyResult.user.name);
  
  // 記錄開門結果
  if (doorResult.success) {
    await addLog(db, verifyResult.user.id, verifyResult.user.name, '開門操作成功');
  } else {
    await addLog(db, verifyResult.user.id, verifyResult.user.name, 
                `開門操作失敗: ${doorResult.error || '未知錯誤'}`);
  }
  
  return {
    success: true,
    user: {
      id: verifyResult.user.id,
      name: verifyResult.user.name
    },
    door_triggered: true,
    door_status: {
      success: doorResult.success,
      message: doorResult.success ? '開門信號已發送' : `開門失敗: ${doorResult.error}`,
      details: doorResult
    }
  };
}
