// 開發模式相關設置
export const DEV_MODE_CONFIG = {
  enabled: true,            // 是否啟用開發模式 (生產環境應設為 false)
  autoUpdate: true,         // 啟用前端自動更新
  updateInterval: 60000,    // 更新檢查間隔 (毫秒)
  notifyBeforeReload: true  // 重新載入前是否通知用戶
};

// Turnstile 配置
export const TURNSTILE_CONFIG = (env) => ({
  siteKey: env.TURNSTILE_SITE_KEY,
  secretKey: env.TURNSTILE_SECRET_KEY,
});



// 默認管理員帳戶
export const DEFAULT_ADMIN = {
  username: "admin",
  password: "$2a$12$aeVH0vUkAFsi8fNSVyB7bOZ1jRrr6pdTaJzrCbm6iYjHUaWLky4iu", // 默認密碼: admin123
  email: "admin@example.com"
};

// 只保留管理者作為預設用戶
export const DEFAULT_USERS = [
  { name: "管理者", is_temporary: false }
];

export const DOOR_API = {
  //HAOS API
  url: "https://home.yourdomain.com/api/services/script/your_script",
  apikey: "your_api_key",
};