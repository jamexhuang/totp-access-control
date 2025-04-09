import * as OTPAuth from 'otpauth';

// 驗證TOTP - 修改為6位數SHA-1
export function verifyTOTP(secret, token) {
  try {
    // 去除空格和可能的其他干擾字元
    token = token.trim();
    if (!/^\d{6}$/.test(token)) {
      console.log(`令牌格式不正確: ${token}`);
      return false;
    }
    
    const totp = new OTPAuth.TOTP({
      issuer: 'HomeDoorAccess',
      label: 'Door',
      algorithm: 'SHA1',  // 改用 SHA1 算法
      digits: 6,          // 改為 6 位數
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });
    
    // 擴大時間窗口，處理時間同步問題
    const result = totp.validate({ token, window: 2 });
    console.log(`TOTP驗證結果: ${result !== null ? '成功' : '失敗'}, 令牌: ${token}, 金鑰: ${secret.substring(0, 8)}...`);
    return result !== null;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}

// 新增：針對包含用戶ID前綴的驗證方法
export function verifyTOTPWithPrefix(secret, tokenWithPrefix) {
  try {
    // 令牌格式應為：前6位用戶ID + 6位TOTP
    if (!/^[a-zA-Z0-9]{6}\d{6}$/.test(tokenWithPrefix)) {
      console.log(`帶前綴令牌格式不正確: ${tokenWithPrefix}`);
      return {
        success: false,
        prefix: null,
        token: null
      };
    }
    
    // 分離前綴和令牌
    const prefix = tokenWithPrefix.substring(0, 6);
    const token = tokenWithPrefix.substring(6);
    
    const totp = new OTPAuth.TOTP({
      issuer: 'HomeDoorAccess',
      label: 'Door',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });
    
    // 擴大時間窗口，處理時間同步問題
    const result = totp.validate({ token, window: 2 });
    console.log(`TOTP驗證結果: ${result !== null ? '成功' : '失敗'}, 令牌: ${token}, 前綴: ${prefix}, 金鑰: ${secret.substring(0, 8)}...`);
    
    return {
      success: result !== null,
      prefix: prefix,
      token: token
    };
  } catch (error) {
    console.error('TOTP with prefix verification error:', error);
    return {
      success: false,
      prefix: null,
      token: null,
      error: error.message
    };
  }
}
