/**
 * 門禁通行證 - OTP 生成與顯示功能
 * 重構版本：改善程式碼結構、減少重複功能、增強可維護性
 */

// ========== 配置與常量 ==========
const OTPApp = {
  // 配置選項
  config: {
    debug: false,                   // 是否顯示除錯訊息
    otpUpdateInterval: 1000,        // OTP更新頻率(毫秒)
    qrLevel: 'M',                   // QR碼容錯率
    otpPeriod: 30,                  // OTP更新週期(秒)
    otpDigits: 6,                   // OTP位數
    otpAlgorithm: 'SHA1'            // OTP演算法
  },
  
  // 自動更新配置
  autoUpdate: {
    enabled: true,                  // 是否啟用自動更新
    checkInterval: 60 * 1000,       // 檢查間隔 (60秒)
    autoReload: true,               // 自動重新載入頁面
    notifyBeforeReload: true,       // 重新載入前通知用戶
    reloadDelay: 3000,              // 通知後延遲重載時間 (3秒)
    lastVersion: null,              // 記錄最後檢測到的版本
    debug: false                    // 自動更新偵錯日誌
  },
  
  // 儲存鍵名
  storage: {
    LOCAL: 'user_data',
    SESSION: 'user_data_session',
    COOKIE: 'user_data_cookie',
    DB_NAME: 'OTPDatabase',
    DB_VERSION: 2,
    STORE_NAME: 'userData'
  },
  
  // 狀態
  state: {
    userData: null,                 // 用戶數據
    qrCodeGenerator: null           // QR碼生成器
  },
  
  // DOM元素參考
  elements: {
    userInfo: null,
    otpContainer: null,
    otpCode: null,
    timerProgress: null,
    timerText: null,
    addToHomePrompt: null,
    debugInfo: null
  },

  // ========== 初始化 ==========
  /**
   * 初始化應用
   */
  init() {
    this.initDOMElements();
    
    if (this.config.debug) {
      this.elements.debugInfo.style.display = 'block';
    }
    
    this.debug('頁面已載入，初始化OTP應用');
    this.debug('頁面載入時間:', new Date().toISOString());
    
    // 檢查緩存狀態
    this.checkCacheStatus();
    
    // 檢查OTPAuth庫
    if (this.checkDependencies()) {
      this.initializeApp();
    }
    
    // 設置Service Worker
    this.setupServiceWorker();
    
    // 暴露公開API到全局
    this.exposeGlobalAPI();
  },
  
  /**
   * 初始化DOM元素參考
   */
  initDOMElements() {
    this.elements.userInfo = document.getElementById('user-info');
    this.elements.otpContainer = document.getElementById('otp-container');
    this.elements.otpCode = document.getElementById('otp-code');
    this.elements.timerProgress = document.getElementById('timer-progress');
    this.elements.timerText = document.getElementById('timer-text');
    this.elements.addToHomePrompt = document.getElementById('add-to-home');
    this.elements.debugInfo = document.getElementById('debug-info');
  },
  
  /**
   * 檢查必要依賴
   * @returns {boolean} - 依賴是否已加載
   */
  checkDependencies() {
    if (typeof OTPAuth === 'undefined') {
      this.debug('OTPAuth庫未載入，嘗試動態載入');
      this.loadOTPAuthLibrary();
      return false;
    }
    return true;
  },
  
  /**
   * 動態載入OTPAuth庫
   */
  loadOTPAuthLibrary() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/otpauth/dist/otpauth.umd.min.js';
    script.onload = () => {
      this.debug('OTPAuth庫已動態載入');
      this.initializeApp();
    };
    script.onerror = () => {
      this.debug('OTPAuth庫載入失敗');
      alert('無法載入必要的庫，請檢查您的網路連接或稍後重試。');
    };
    document.head.appendChild(script);
  },
  
  /**
   * 設置Service Worker
   */
  setupServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      this.debug('此瀏覽器不支持 Service Worker');
      return;
    }
    
    // 監聽Service Worker訊息
    navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
    
    // 註冊Service Worker
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          this.debug('ServiceWorker 註冊成功，範圍: ', registration.scope);
          
          // 檢查更新 - 直接更新
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            this.debug('發現新版本的ServiceWorker');
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.debug('新版本已安裝，直接重新載入頁面');
                window.location.reload();
              }
            });
          });
          
          // 初次檢查
          setTimeout(() => this.checkForAppUpdates(), 1000);
          
          // 設置定期檢查
          if (this.autoUpdate.enabled) {
            // 針對 iOS 設備縮短檢查間隔
            const checkInterval = this.isIOSDevice() ? 
              Math.min(this.autoUpdate.checkInterval, 30000) : 
              this.autoUpdate.checkInterval;
            
            setInterval(() => this.checkForAppUpdates(), checkInterval);
          }
        })
        .catch(error => {
          this.debug('ServiceWorker 註冊失敗: ', error);
        });
    });
  },
  
  /**
   * 處理Service Worker訊息
   * @param {MessageEvent} event - 訊息事件
   */
  handleServiceWorkerMessage(event) {
    const message = event.data;
    this.debug(`收到 Service Worker 消息: ${message.type}`);
    
    switch (message.type) {
      case 'CHECK_UPDATES':
        this.debug(`收到更新檢查請求，時間戳: ${message.timestamp}`);
        this.checkForAppUpdates();
        break;
        
      case 'VERSION_INFO':
        this.debug(`收到版本信息響應，版本: ${message.version}, 開發模式: ${message.devMode}`);
        this.handleVersionInfo(message);
        break;
        
      case 'SW_ACTIVATED':
        this.debug(`Service Worker 已激活，版本: ${message.version}`);
        break;
    }
  },
  
  /**
   * 初始化應用
   */
  initializeApp() {
    this.debug('應用初始化開始');
    this.debug('當前頁面URL:', window.location.href);
    this.checkStorageStatus();
    
    // 按優先順序加載用戶數據：URL > 儲存
    const urlData = this.getUserDataFromUrl();
    
    if (urlData && urlData.id && urlData.secret) {
      this.debug('使用URL中的數據');
      this.clearAllStoredData();
      this.state.userData = urlData;
      
      if (this.saveUserDataToStorage(this.state.userData)) {
        this.debug('URL數據已成功保存到存儲');
      }
      
      this.setupOTP();
      return;
    }
    
    this.debug('URL中無數據，嘗試從存儲中獲取');
    const storageData = this.getUserDataFromStorage();
    
    if (storageData && storageData.id && storageData.secret) {
      this.debug('使用本地存儲中的數據');
      this.state.userData = storageData;
      this.saveUserDataToStorage(this.state.userData);
      this.setupOTP();
      return;
    }
    
    // 如果都沒有數據，顯示錯誤
    this.debug('沒有找到用戶數據，顯示錯誤信息');
    this.elements.userInfo.textContent = '未找到通行證數據';
    this.elements.otpCode.textContent = '錯誤';
    
    // 顯示添加到主螢幕提示
    this.showAddToHomeScreenPrompt();
  },
  
  /**
   * 顯示添加到主螢幕提示 
   */
  showAddToHomeScreenPrompt() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        window.navigator.standalone;
    
    if ((isIOS || isAndroid) && !isStandalone) {
      this.elements.addToHomePrompt.classList.add('visible');
    }
  },
  
  // ========== OTP相關功能 ==========
  /**
   * 設置OTP通行證
   */
  setupOTP() {
    if (!this.state.userData) {
      this.debug('無法設置OTP，用戶數據無效');
      return;
    }
    
    this.debug('設置OTP通行證', this.state.userData);
    
    // 更新用戶資訊
    this.elements.userInfo.textContent = `${this.state.userData.name || '未知用戶'}`;
    
    // 初始化QR碼生成器
    this.initQRCodeGenerator();
    
    // 立即生成第一個TOTP
    this.updateTOTP();
    
    // 啟動更新定時器
    this.startUpdateTimers();
    
    // 添加頁面可見性事件
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.debug('頁面變為可見狀態，立即更新TOTP');
        this.updateTOTP();
      }
    });
  },
  
  /**
   * 初始化QR碼生成器
   */
  initQRCodeGenerator() {
    try {
      // 獲取畫布元素並調整大小
      const canvas = document.getElementById('qrCanvas');
      const container = canvas.parentElement;
      
      // 確保正方形尺寸 - 使用容器的寬度
      const containerWidth = container.clientWidth;
      
      // 設置正確的QR碼大小
      this.state.qrCodeGenerator = new QRious({
        element: canvas,
        size: Math.min(containerWidth, containerWidth), // 確保是正方形
        level: this.config.qrLevel,
        backgroundAlpha: 1,
        foreground: '#000000',
        background: '#FFFFFF'
      });
      
      // 添加窗口大小變化監聽，以便在旋轉設備或調整窗口大小時重新調整QR碼
      window.addEventListener('resize', () => {
        this.resizeQRCode();
      });
      
      this.debug('QR碼生成器初始化成功，尺寸:', containerWidth);
    } catch (e) {
      this.debug('QR碼生成器初始化失敗:', e);
    }
  },
  
  /**
   * 在窗口大小變化時調整QR碼尺寸
   */
  resizeQRCode() {
    if (!this.state.qrCodeGenerator) return;
    
    const canvas = document.getElementById('qrCanvas');
    if (!canvas) return;
    
    // 獲取父容器的寬度來確定大小
    const containerWidth = canvas.parentElement.clientWidth;
    
    // 設定正方形尺寸
    const size = containerWidth;
    
    this.state.qrCodeGenerator.size = size;
    this.debug('QR碼尺寸已調整為:', size);
    
    // 在調整大小後更新當前TOTP的QR碼
    this.updateTOTP();
  },
  
  /**
   * 啟動更新定時器
   */
  startUpdateTimers() {
    // 倒計時定時器 - 每秒更新
    this.debug('啟動倒計時定時器');
    setInterval(() => this.updateTimer(), 1000);
    
    // OTP更新定時器
    this.debug('啟動OTP更新定時器，間隔: ' + this.config.otpUpdateInterval + 'ms');
    setInterval(() => this.updateTOTP(), this.config.otpUpdateInterval);
  },
  
  /**
   * 更新倒計時
   */
  updateTimer() {
    // 獲取當前UNIX時間戳（秒）
    const now = Math.floor(Date.now() / 1000);
    
    // 計算距離下一個30秒週期的剩餘秒數
    const secondsRemaining = this.config.otpPeriod - (now % this.config.otpPeriod);
    
    // 更新進度條和文字
    this.elements.timerProgress.style.width = `${(secondsRemaining / this.config.otpPeriod) * 100}%`;
    this.elements.timerText.textContent = `更新時間: ${secondsRemaining}秒`;
  },
  
  /**
   * 更新TOTP和QR碼
   */
  updateTOTP() {
    if (!this.state.userData || !this.state.userData.secret) {
      this.debug('無法生成TOTP，用戶數據無效', this.state.userData);
      return;
    }
    
    // 生成新的TOTP
    const totp = this.generateTOTP(this.state.userData.secret);
    this.elements.otpCode.textContent = totp;
    
    // 更新QR碼
    this.updateQRCode(totp);
    
    this.debug('TOTP已更新:', totp);
  },
  
  /**
   * 生成TOTP
   * @param {string} secret - 金鑰
   * @returns {string} - TOTP碼
   */
  generateTOTP(secret) {
    try {
      this.debug('嘗試生成TOTP，金鑰:', secret);
      
      // 檢查金鑰是否有效
      if (!secret || typeof secret !== 'string' || secret.length < 16) {
        this.debug('金鑰格式無效');
        return '------';
      }
      
      // 使用OTPAuth庫生成TOTP
      const totp = new OTPAuth.TOTP({
        issuer: 'HomeDoorAccess',
        label: 'Door',
        algorithm: this.config.otpAlgorithm,
        digits: this.config.otpDigits,
        period: this.config.otpPeriod,
        secret: OTPAuth.Secret.fromBase32(secret)
      });
      
      const code = totp.generate();
      this.debug('生成的TOTP碼:', code);
      return code;
    } catch (error) {
      this.debug('TOTP生成錯誤:', error);
      return '------';
    }
  },
  
  /**
   * 更新QR碼
   * @param {string} totp - TOTP值
   */
  updateQRCode(totp) {
    // 確保userData中有id，取其前6位作為前綴
    if (!this.state.userData || !this.state.userData.id || this.state.userData.id.length < 6) {
      this.debug('無法生成帶前綴的QR碼，用戶ID無效');
      return;
    }
    
    const prefix = this.state.userData.id.substring(0, 6);
    // 生成QR碼內容 - 用戶ID前6位 + TOTP值
    const qrContent = prefix + totp;
    
    this.debug('QR碼內容（帶前綴）:', qrContent);
    
    // 更新QR碼
    if (this.state.qrCodeGenerator) {
      this.state.qrCodeGenerator.value = qrContent;
      this.debug('QR碼已更新為:', qrContent);
    } else {
      this.debug('QR生成器未初始化');
    }
  },
  
  // ========== 數據存儲功能 ==========
  /**
   * 保存用戶數據到多個存儲位置
   * @param {Object} data - 用戶數據
   * @returns {boolean} - 是否成功保存
   */
  saveUserDataToStorage(data) {
    try {
      if (!data || !data.id || !data.secret) {
        this.debug('保存數據失敗: 數據不完整');
        return false;
      }
      
      let savedCount = 0;
      
      // 嘗試保存到LocalStorage
      if (this.saveToLocalStorage(data)) savedCount++;
      
      // 嘗試保存到SessionStorage
      if (this.saveToSessionStorage(data)) savedCount++;
      
      // 嘗試保存到Cookie
      if (this.saveToCookie(data)) savedCount++;
      
      // 保存到IndexedDB
      this.saveToIndexedDB(data);
      
      // 驗證數據保存
      this.checkStorageStatus();
      
      return savedCount > 0;
    } catch (error) {
      this.debug('保存數據錯誤:', error);
      return false;
    }
  },
  
  /**
   * 保存到LocalStorage
   * @param {Object} data - 用戶數據
   * @returns {boolean} - 是否成功
   */
  saveToLocalStorage(data) {
    try {
      const jsonData = JSON.stringify(data);
      localStorage.setItem(this.storage.LOCAL, jsonData);
      this.debug('數據已保存到 localStorage');
      return true;
    } catch (e) {
      this.debug('保存到 localStorage 失敗:', e);
      return false;
    }
  },
  
  /**
   * 保存到SessionStorage
   * @param {Object} data - 用戶數據
   * @returns {boolean} - 是否成功
   */
  saveToSessionStorage(data) {
    try {
      const jsonData = JSON.stringify(data);
      sessionStorage.setItem(this.storage.SESSION, jsonData);
      this.debug('數據已保存到 sessionStorage');
      return true;
    } catch (e) {
      this.debug('保存到 sessionStorage 失敗:', e);
      return false;
    }
  },
  
  /**
   * 保存到Cookie
   * @param {Object} data - 用戶數據
   * @returns {boolean} - 是否成功
   */
  saveToCookie(data) {
    try {
      // 設置為30天過期
      const expires = new Date();
      expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      // 僅保存必要信息以避免Cookie大小限制
      const cookieData = {
        id: data.id,
        name: data.name,
        secret: data.secret
      };
      
      document.cookie = `${this.storage.COOKIE}=${encodeURIComponent(JSON.stringify(cookieData))};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
      this.debug('數據已保存到 Cookie');
      return true;
    } catch (e) {
      this.debug('保存到 Cookie 失敗:', e);
      return false;
    }
  },
  
  /**
   * 保存到IndexedDB
   * @param {Object} data - 用戶數據
   */
  saveToIndexedDB(data) {
    if (!window.indexedDB) {
      this.debug('此瀏覽器不支持 IndexedDB');
      return;
    }
    
    const request = indexedDB.open(this.storage.DB_NAME, this.storage.DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(this.storage.STORE_NAME)) {
        const store = db.createObjectStore(this.storage.STORE_NAME, { keyPath: 'id' });
        store.createIndex('id', 'id', { unique: true });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction([this.storage.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.storage.STORE_NAME);
      
      const storeRequest = store.put(data);
      
      storeRequest.onsuccess = () => {
        this.debug('數據成功保存到 IndexedDB');
      };
      
      storeRequest.onerror = (e) => {
        this.debug('保存到 IndexedDB 失敗:', e.target.error);
      };
      
      transaction.oncomplete = () => db.close();
    };
    
    request.onerror = (event) => {
      this.debug('打開 IndexedDB 失敗:', event.target.error);
    };
  },
  
  /**
   * 從存儲中獲取用戶數據
   * @returns {Object|null} - 用戶數據或null
   */
  getUserDataFromStorage() {
    let data = null;
    let source = '';
    
    // 首先嘗試從 localStorage 讀取
    data = this.getFromLocalStorage();
    if (data) {
      source = 'localStorage';
    }
    
    // 如果 localStorage 失敗，嘗試從 sessionStorage 讀取
    if (!data) {
      data = this.getFromSessionStorage();
      if (data) {
        source = 'sessionStorage';
      }
    }
    
    // 如果仍然沒有，嘗試從 Cookie 讀取
    if (!data) {
      data = this.getFromCookie();
      if (data) {
        source = 'cookie';
      }
    }
    
    // 如果有數據，驗證其有效性並同步到其他存儲
    if (data && data.id && data.secret) {
      this.debug(`成功從 ${source} 獲取有效數據`);
      this.saveUserDataToStorage(data);
      return data;
    } else if (data) {
      this.debug(`從 ${source} 獲取的數據無效`);
    }
    
    // 最後嘗試從 IndexedDB 讀取
    this.debug('快速存儲方法無數據，嘗試從 IndexedDB 讀取');
    this.loadFromIndexedDB();
    
    return null; // IndexedDB 將異步返回結果
  },
  
  /**
   * 從LocalStorage獲取數據
   * @returns {Object|null} - 用戶數據或null
   */
  getFromLocalStorage() {
    try {
      const storedData = localStorage.getItem(this.storage.LOCAL);
      if (storedData) {
        const data = JSON.parse(storedData);
        this.debug('從 localStorage 獲取的數據:', data);
        return data;
      }
    } catch (e) {
      this.debug('從 localStorage 讀取失敗:', e);
    }
    return null;
  },
  
  /**
   * 從SessionStorage獲取數據
   * @returns {Object|null} - 用戶數據或null
   */
  getFromSessionStorage() {
    try {
      const storedData = sessionStorage.getItem(this.storage.SESSION);
      if (storedData) {
        const data = JSON.parse(storedData);
        this.debug('從 sessionStorage 獲取的數據:', data);
        return data;
      }
    } catch (e) {
      this.debug('從 sessionStorage 讀取失敗:', e);
    }
    return null;
  },
  
  /**
   * 從Cookie獲取數據
   * @returns {Object|null} - 用戶數據或null
   */
  getFromCookie() {
    try {
      const cookieName = this.storage.COOKIE + "=";
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.indexOf(cookieName) === 0) {
          const encodedData = cookie.substring(cookieName.length);
          const jsonData = decodeURIComponent(encodedData);
          const data = JSON.parse(jsonData);
          this.debug('從 Cookie 獲取的數據:', data);
          return data;
        }
      }
    } catch (e) {
      this.debug('從 Cookie 讀取失敗:', e);
    }
    return null;
  },
  
  /**
   * 從IndexedDB加載數據
   */
  loadFromIndexedDB() {
    if (!window.indexedDB) {
      this.debug('此瀏覽器不支持 IndexedDB');
      return;
    }
    
    const request = indexedDB.open(this.storage.DB_NAME, this.storage.DB_VERSION);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(this.storage.STORE_NAME)) {
        this.debug('IndexedDB 中沒有 userData 存儲');
        return;
      }
      
      const transaction = db.transaction([this.storage.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.storage.STORE_NAME);
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = (event) => {
        const results = event.target.result;
        if (results && results.length > 0) {
          const data = results[0];
          this.debug('從 IndexedDB 讀取到數據:', data);
          
          if (data && data.id && data.secret) {
            this.state.userData = data;
            
            // 同步到其他存儲
            this.saveToLocalStorage(this.state.userData);
            this.saveToSessionStorage(this.state.userData);
            
            // 設置 OTP
            this.setupOTP();
          } else {
            this.debug('從 IndexedDB 讀取的數據不完整');
          }
        } else {
          this.debug('IndexedDB 中沒有找到數據');
        }
      };
      
      getAllRequest.onerror = (event) => {
        this.debug('從 IndexedDB 讀取數據失敗:', event.target.error);
      };
      
      transaction.oncomplete = () => db.close();
    };
    
    request.onerror = (event) => {
      this.debug('打開 IndexedDB 失敗:', event.target.error);
    };
  },
  
  /**
   * 從URL獲取用戶數據
   * @returns {Object|null} - 用戶數據或null
   */
  getUserDataFromUrl() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const encodedData = urlParams.get('data');
      
      if (encodedData) {
        const decodedData = decodeURIComponent(atob(encodedData));
        const data = JSON.parse(decodedData);
        this.debug('從URL獲取的數據:', data);
        
        if (data && data.id && data.secret) {
          return data;
        } else {
          this.debug('URL中的數據無效或不完整');
        }
      }
    } catch (error) {
      this.debug('解析URL數據錯誤:', error);
    }
    
    return null;
  },
  
  /**
   * 清除所有存儲的數據
   */
  clearAllStoredData() {
    try {
      localStorage.removeItem(this.storage.LOCAL);
      sessionStorage.removeItem(this.storage.SESSION);
      document.cookie = `${this.storage.COOKIE}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;`;
      
      if (window.indexedDB) {
        const request = indexedDB.deleteDatabase(this.storage.DB_NAME);
        request.onsuccess = () => {
          this.debug('成功清除 IndexedDB 數據庫');
        };
        request.onerror = (event) => {
          this.debug('清除 IndexedDB 數據庫失敗:', event.target.error);
        };
      }
      
      this.state.userData = null;
      this.debug('所有存儲數據已清除');
    } catch (e) {
      this.debug('清除數據發生錯誤:', e);
    }
  },
  
  // ========== 自動更新相關 ==========
  /**
   * 檢查應用更新
   */
  checkForAppUpdates() {
    this.debug('開始檢查應用更新');
    
    if (navigator.serviceWorker.controller) {
      this.debug('發現 Service Worker 控制器，發送獲取版本消息');
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'GET_VERSION',
          timestamp: Date.now()
        });
      } catch(e) {
        this.debug(`發送獲取版本消息失敗: ${e}`, true);
      }
    } else {
      this.debug('未找到 Service Worker 控制器，無法檢查更新');
      
      // 檢查是否已註冊但尚未控制頁面
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
          this.debug('Service Worker 已註冊但尚未控制頁面，嘗試重新加載');
          // 在 iOS 上嘗試強制激活
          if (this.isIOSDevice()) {
            reg.active.postMessage({action: 'skipWaiting'});
            this.debug('已發送 skipWaiting 消息到 Service Worker');
          }
        } else {
          this.debug('無 Service Worker 註冊記錄');
        }
      });
    }
  },
  
  /**
   * 處理版本信息
   * @param {Object} info - 版本信息
   */
  handleVersionInfo(info) {
    this.debug(`處理版本信息: ${JSON.stringify(info)}`);
    
    // 首次收到版本信息，記錄版本號
    if (this.autoUpdate.lastVersion === null) {
      this.autoUpdate.lastVersion = info.version;
      this.debug(`首次記錄版本: ${this.autoUpdate.lastVersion}`);
      return;
    }
    
    // 如果版本不同，則需要更新
    if (info.version !== this.autoUpdate.lastVersion) {
      this.debug(`發現新版本! 當前: ${this.autoUpdate.lastVersion}, 新版本: ${info.version}`);
      
      if (this.autoUpdate.autoReload) {
        if (this.autoUpdate.notifyBeforeReload) {
          this.debug('顯示更新通知');
          this.showUpdateNotification(info.version);
        } else {
          this.debug('直接重新載入頁面');
          window.location.reload();
        }
      } else {
        this.debug('自動重新載入已禁用，不執行更新');
      }
      
      this.autoUpdate.lastVersion = info.version;
    } else {
      this.debug(`版本未變更: ${info.version}`);
    }
  },
  
  /**
   * 顯示更新通知
   * @param {string} version - 新版本號
   */
  showUpdateNotification(version) {
    this.debug(`創建更新通知，版本: ${version}`);
    
    // 建立通知元素
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
      <div class="update-notification-content">
        <span>發現新版本 (${version})，頁面將在 ${this.autoUpdate.reloadDelay/1000} 秒後自動重新載入</span>
        <button onclick="window.location.reload()">立即重新載入</button>
      </div>
    `;
    
    // 添加到文檔
    document.body.appendChild(notification);
    this.addUpdateNotificationStyles();
    
    // 設置延遲重新載入
    this.debug(`設置 ${this.autoUpdate.reloadDelay}ms 後自動重新載入頁面`);
    setTimeout(() => {
      this.debug('延遲時間到，準備重新載入頁面');
      window.location.reload();
    }, this.autoUpdate.reloadDelay);
  },
  
  /**
   * 添加更新通知樣式
   */
  addUpdateNotificationStyles() {
    if (!document.getElementById('update-notification-style')) {
      const style = document.createElement('style');
      style.id = 'update-notification-style';
      style.textContent = `
        .update-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background-color: #4CAF50;
          color: white;
          padding: 15px;
          border-radius: 4px;
          z-index: 9999;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          animation: slideIn 0.3s ease;
        }
        .update-notification-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }
        .update-notification button {
          background-color: white;
          color: #4CAF50;
          border: none;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      this.debug('更新通知樣式已添加');
    }
  },
  
  // ========== 工具函數 ==========
  /**
   * 檢查是否為iOS設備
   * @returns {boolean} - 是否是iOS設備
   */
  isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  },
  
  /**
   * 檢查緩存狀態
   */
  checkCacheStatus() {
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        this.debug('當前緩存列表:', cacheNames.join(', '));
      });
    } else {
      this.debug('此瀏覽器不支持 Cache API');
    }
  },
  
  /**
   * 檢查存儲狀態
   */
  checkStorageStatus() {
    try {
      const localData = localStorage.getItem(this.storage.LOCAL);
      const sessionData = sessionStorage.getItem(this.storage.SESSION);
      const cookieData = this.getFromCookie();
      
      this.debug('==== 存儲狀態檢查 ====');
      this.debug('- localStorage: ' + (localData ? '有數據' : '無數據'));
      this.debug('- sessionStorage: ' + (sessionData ? '有數據' : '無數據'));
      this.debug('- Cookie: ' + (cookieData ? '有數據' : '無數據'));
      this.debug('- userData變量: ' + (this.state.userData ? '有數據' : '無數據'));
      
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          this.debug('- localStorage 數據檢查: id=' + parsed.id + 
                ', secret=' + (parsed.secret ? parsed.secret.substring(0, 4) + '...' : '無') + 
                ', secret長度=' + (parsed.secret ? parsed.secret.length : 0));
        } catch(e) {
          this.debug('- localStorage 數據解析失敗');
        }
      }
      
      if (cookieData) {
        this.debug('- Cookie 數據檢查: id=' + cookieData.id + 
              ', secret=' + (cookieData.secret ? cookieData.secret.substring(0, 4) + '...' : '無') +
              ', secret長度=' + (cookieData.secret ? cookieData.secret.length : 0));
      }
    } catch (e) {
      this.debug('檢查存儲狀態時發生錯誤:', e);
    }
  },
  
  /**
   * 輸出除錯資訊
   * @param {string} message - 消息
   * @param {*} obj - 附加對象
   */
  debug(message, obj) {
    if (!this.config.debug) return;
    
    const timestamp = new Date().toISOString().substring(11, 19);
    let logMessage = `[${timestamp}] ${message}`;
    
    if (obj !== undefined) {
      if (typeof obj === 'object') {
        logMessage += '\n' + JSON.stringify(obj, null, 2);
      } else {
        logMessage += '\n' + obj;
      }
    }
    
    console.log(logMessage);
    
    // 添加到頁面
    if (this.elements.debugInfo) {
      this.elements.debugInfo.textContent = logMessage + '\n\n' + (this.elements.debugInfo.textContent || '');
      
      // 限制行數
      if (this.elements.debugInfo.textContent.split('\n').length > 20) {
        const lines = this.elements.debugInfo.textContent.split('\n');
        this.elements.debugInfo.textContent = lines.slice(0, 20).join('\n');
      }
    }
  },
  
  /**
   * 暴露公開API到全局對象
   */
  exposeGlobalAPI() {
    window.otpUtils = {
      clearData: this.clearAllStoredData.bind(this),
      generateTOTP: this.generateTOTP.bind(this),
      checkStorage: this.checkStorageStatus.bind(this),
      debug: this.debug.bind(this),
      reload: this.initializeApp.bind(this)
    };
    
    // 用於自動更新偵錯
    window.debugAutoUpdate = {
      check: this.checkForAppUpdates.bind(this),
      log: this.debug.bind(this),
      isIOS: this.isIOSDevice(),
      config: this.autoUpdate
    };
  }
};

// 頁面載入時初始化應用
document.addEventListener('DOMContentLoaded', () => OTPApp.init());
