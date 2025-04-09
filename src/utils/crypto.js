/**
 * 加密工具模組
 * 提供ID生成、密鑰創建等功能
 */
import { customAlphabet } from 'nanoid';
import bcrypt from 'bcryptjs';

/**
 * 生成唯一ID
 * 使用自訂字母表生成10位隨機字串
 * @returns {string} 生成的ID
 */
export const nanoid = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 
  10
);

/**
 * 生成TOTP密鑰
 * 使用Base32字母表生成32位密鑰，適用於TOTP演算法
 * @returns {string} 32位Base32編碼的密鑰
 */
export function generateSecret() {
  // 生成32個字元的隨機密鑰
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // Base32 字母表
  const generateId = customAlphabet(alphabet, 32);
  return generateId();
}

/**
 * 哈希密碼
 * 使用bcrypt演算法加鹽哈希密碼
 * @param {string} password - 原始密碼
 * @param {number} [saltRounds=10] - 加鹽輪數，預設10輪
 * @returns {Promise<string>} 哈希後的密碼
 */
export async function hashPassword(password, saltRounds = 10) {
  return await bcrypt.hash(password, saltRounds);
}

/**
 * 驗證密碼
 * 檢查密碼是否與已存儲的哈希值匹配
 * @param {string} password - 待驗證的密碼
 * @param {string} hash - 存儲的密碼哈希
 * @returns {Promise<boolean>} 密碼是否匹配
 */
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}
