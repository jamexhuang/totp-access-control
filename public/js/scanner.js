/**
 * 智能門禁掃描器系統
 * 用於掃描和驗證TOTP二維碼，處理門禁授權
 */

// ========== 配置常量 ==========
const SECURITY_SETTINGS = {
    MIN_API_INTERVAL: 1000,           // 最小API請求間隔 (1秒)
    MAX_CONSECUTIVE_FAILURES: 5,      // 最大連續失敗次數
    LOCKDOWN_DURATION: 5 * 60 * 1000, // 鎖定時間 (5分鐘)
    FAILURE_RESET_TIMEOUT: 60 * 1000  // 失敗計數器重置時間 (1分鐘)
  };
  
  const QR_CONFIG = {
    fps: 20,           // 固定幀率
    qrbox: 350,        // 掃描範圍
    disableFlip: false,
    aspectRatio: 1
  };
  
  // ========== 狀態管理 ==========
  const securityState = {
    lastApiCallTime: 0,          // 上次API調用時間
    consecutiveFailures: 0,      // 連續失敗次數
    isLocked: false,             // 系統是否鎖定
    lockdownStartTime: 0,        // 鎖定開始時間
    lockdownEndTime: 0,          // 鎖定結束時間
    lockdownTimer: null,         // 鎖定倒計時計時器
    failureResetTimer: null,     // 失敗計數器重置計時器
    processedTokens: new Set(),  // 已處理的令牌集合
    failedTOTPs: new Set()       // 已知失敗的TOTP集合
  };
  
  // 掃描器狀態
  let html5QrCode = null;
  let currentCamera = 'environment'; // 預設使用後置攝影機
  let lastScannedCode = '';
  let lastScannedTime = 0;
  
  // ========== DOM元素快取 ==========
  const elements = {
    // 初始化為null，頁面載入後再取得實際DOM元素
    statusIndicator: null,
    scannerStatus: null,
    userInfo: null,
    statusSuccess: null,
    statusError: null,
    statusWarning: null,
    successMessage: null,
    errorMessage: null,
    warningMessage: null,
    logContainer: null,
    cameraSwitch: null,
    securityStatusText: null,
    failureCounter: null,
    lockdownPanel: null,
    lockdownTimer: null,
    unlockBtn: null,
    dimmingScreen: null
  };
  
  // ========== 核心掃描功能 ==========
  /**
   * 初始化DOM元素參考
   */
  function initializeElements() {
    elements.statusIndicator = document.getElementById('status-indicator');
    elements.scannerStatus = document.getElementById('scanner-status');
    elements.userInfo = document.getElementById('user-info');
    elements.statusSuccess = document.getElementById('status-success');
    elements.statusError = document.getElementById('status-error');
    elements.statusWarning = document.getElementById('status-warning');
    elements.successMessage = document.getElementById('success-message');
    elements.errorMessage = document.getElementById('error-message');
    elements.warningMessage = document.getElementById('warning-message');
    elements.logContainer = document.getElementById('log-container');
    elements.cameraSwitch = document.getElementById('camera-switch');
    elements.securityStatusText = document.getElementById('securityStatusText');
    elements.failureCounter = document.getElementById('failureCounter');
    elements.lockdownPanel = document.getElementById('lockdown-panel');
    elements.lockdownTimer = document.getElementById('lockdown-timer');
    elements.unlockBtn = document.getElementById('unlock-btn');
    elements.dimmingScreen = document.getElementById('dimming-screen');
  }
  
  /**
   * 啟動掃描器
   */
  function startScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
      return; // 如果已經在掃描中，則不重新初始化
    }
  
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("qr-reader");
    }
  
    updateStatus('正在啟動攝影機...');
  
    // 開始掃描，使用當前選擇的攝影機
    html5QrCode.start(
      { facingMode: currentCamera },
      QR_CONFIG,
      onScanSuccess,
      () => {} // 空函數代替onScanFailure，避免不必要的錯誤日誌
    ).then(() => {
      updateStatus('準備就緒，等待掃描...');
      addLog(`${currentCamera === 'environment' ? '後置' : '前置'}攝影機已啟動`);
    }).catch((err) => {
      addLog(`啟動掃描器失敗: ${err}`, true);
      updateStatus('掃描器啟動失敗');
      
      // 如果失敗，嘗試切換攝影機
      if (err.toString().includes('NotFoundError') || err.toString().includes('NotAllowedError')) {
        addLog('嘗試切換到另一個攝影機...');
        currentCamera = currentCamera === 'environment' ? 'user' : 'environment';
        updateCameraLabel();
        
        // 延遲一下再嘗試
        setTimeout(() => tryAlternativeCamera(), 1000);
      }
    });
  }
  
  /**
   * 嘗試使用另一個攝影機
   */
  function tryAlternativeCamera() {
    html5QrCode.start(
      { facingMode: currentCamera },
      QR_CONFIG,
      onScanSuccess,
      () => {}
    ).then(() => {
      updateStatus('準備就緒，等待掃描...');
      addLog(`${currentCamera === 'environment' ? '後置' : '前置'}攝影機已啟動`);
    }).catch((err) => {
      addLog(`兩種攝影機都無法啟動: ${err}`, true);
      updateStatus('無法訪問攝影機，請檢查權限設定');
    });
  }
  
  /**
   * 更新掃描器狀態
   * @param {string} message - 狀態訊息
   */
  function updateStatus(message) {
    elements.scannerStatus.textContent = message;
  }
  
  /**
   * QR碼掃描成功處理
   * @param {string} decodedText - 解碼後的文字
   */
  function onScanSuccess(decodedText) {
    // 防止處理相同的QR碼（短時間內）
    const now = Date.now();
    if (decodedText === lastScannedCode && now - lastScannedTime < 3000) {
      return;
    }
  
    lastScannedCode = decodedText;
    lastScannedTime = now;
  
    // 停止掃描器，處理完後再重啟
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().then(() => {
        updateStatus('掃描已暫停，正在處理...');
        addLog('掃描器已暫停 3 秒');
        
        // 處理QR碼
        processQRCode(decodedText);
        
        // 3秒後重新啟動掃描器
        setTimeout(() => {
          startScanner();
          addLog('掃描器已恢復');
        }, 3000);
      }).catch(error => {
        console.error('暫停掃描器失敗:', error);
        // 即使暫停失敗，也處理QR碼
        processQRCode(decodedText);
      });
    } else {
      // 如果掃描器不在運行中，直接處理QR碼
      processQRCode(decodedText);
    }
  }
  
  /**
   * 處理掃描到的QR碼
   * @param {string} qrData - QR碼內容
   */
  function processQRCode(qrData) {
    // 更新掃描狀態
    elements.statusIndicator.classList.add('active');
    updateStatus('正在處理掃描結果...');
  
    // 將掃描內容記錄到日誌
    addLog(`掃描到QR碼，正在驗證...`);
  
    try {
      // 移除掃描可能產生的空格和換行符
      let token = qrData.trim();
      
      // 檢查是否符合 "6位前綴 + 6位數字TOTP" 格式
      if (/^[a-zA-Z0-9]{6}\d{6}$/.test(token)) {
        // 發送到伺服器進行驗證
        verifyTOTP(token);
      } else if (/^\d{6}$/.test(token)) {
        // 檢查是否只是6位數字（舊式TOTP，沒有前綴）
        addLog(`掃描到舊式TOTP，無前綴: ${token}`);
        verifyTOTP(token);
      } else {
        // 嘗試提取數字部分
        const matches = qrData.match(/\d{6}/);
        if (matches && matches.length > 0) {
          token = matches[0];
          addLog(`提取到可能的TOTP: ${token}`);
          verifyTOTP(token);
        } else {
          // 不是有效的TOTP格式
          showError('無效的QR碼格式，請掃描有效的TOTP碼');
        }
      }
    } catch (error) {
      // 如果解析失敗，顯示錯誤
      showError(`QR碼處理錯誤: ${error.message}`);
    }
  }
  
  // ========== API操作 ==========
  /**
   * 驗證TOTP
   * @param {string} totp - TOTP令牌
   */
  async function verifyTOTP(totp) {
    try {
      // 檢查系統是否被鎖定
      if (securityState.isLocked) {
        addLog(`系統已鎖定，拒絕驗證`, true);
        showWarning('系統已鎖定，請稍後再試');
        return;
      }
      
      // 檢查API請求頻率
      const now = Date.now();
      if (now - securityState.lastApiCallTime < SECURITY_SETTINGS.MIN_API_INTERVAL) {
        addLog(`API請求頻率過高，拒絕驗證`, true);
        const waitTime = Math.ceil((SECURITY_SETTINGS.MIN_API_INTERVAL - (now - securityState.lastApiCallTime)) / 1000);
        showWarning(`請求過於頻繁，請等待 ${waitTime} 秒`);
        return;
      }
      
      // 檢查是否為已知失敗的TOTP
      if (securityState.failedTOTPs.has(totp)) {
        addLog(`已知失敗的TOTP: ${totp.substring(0, 2)}****，不增加失敗計數`, true);
        showError('此認證碼已驗證失敗，請嘗試新的認證碼');
        return;
      }
      
      // 更新最後API呼叫時間
      securityState.lastApiCallTime = now;
      
      addLog(`嘗試驗證TOTP: ${totp.substring(0, 2)}******`);
      
      // 記錄API請求開始時間
      const apiStartTime = performance.now();
      
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: totp })
      });
      
      const responseData = await response.json();
      
      // 計算API響應時間
      const apiResponseTime = (performance.now() - apiStartTime).toFixed(2);
      
      // 記錄API響應
      logApiResponse('/api/verify', 'POST', 
        { token: totp.substring(0, 2) + '******' }, 
        responseData, response.status, apiResponseTime);
      
      // 處理API響應
      handleVerificationResponse(responseData, apiResponseTime);
    } catch (error) {
      // 網路錯誤或其他問題
      showError(`驗證請求錯誤: ${error.message}`);
      addLog(`驗證錯誤: ${error.message}`, true);
      elements.doorStatus.style.display = 'none';
    } finally {
      // 重設掃描狀態
      resetScannerState();
    }
  }
  
  /**
   * 處理驗證響應
   * @param {Object} responseData - API響應數據
   * @param {string} apiResponseTime - API響應時間
   */
  function handleVerificationResponse(responseData, apiResponseTime) {
    // 從新的回應格式中提取實際結果數據
    const result = responseData.data || responseData;
    const success = responseData.success !== undefined ? responseData.success : (result.success || false);
    const doorStatusDiv = document.getElementById('door-status');
    
    if (success) {
      // 驗證成功處理
      resetFailureCount();
      securityState.failedTOTPs.delete(lastScannedCode);
      securityState.processedTokens.clear();
      
      // 處理開門狀態
      let doorStatus = '';
      doorStatusDiv.className = 'door-status';
      
      if (result.door_status) {
        if (result.door_status.success) {
          doorStatus = '開門信號已發送';
          doorStatusDiv.classList.add('door-success');
        } else {
          doorStatus = `開門失敗: ${result.door_status.message || '未知錯誤'}`;
          doorStatusDiv.classList.add('door-error');
        }
        doorStatusDiv.textContent = doorStatus;
        doorStatusDiv.style.display = 'inline-block';
      } else {
        doorStatusDiv.style.display = 'none';
      }
      
      const doorMessage = result.door_triggered ? '並嘗試開門' : '';
      showSuccess(`${result.user.name} ${doorMessage}`);
      addLog(`驗證成功: ${result.user.name} 已授權進入 ${doorStatus} (響應時間: ${apiResponseTime}ms)`);
    } else {
      // 驗證失敗處理
      const errorMessage = responseData.error || result.message || '未知錯誤';
      securityState.failedTOTPs.add(lastScannedCode);
      incrementFailureCount();
      showError(errorMessage);
      addLog(`驗證失敗: ${errorMessage} (響應時間: ${apiResponseTime}ms)`);
      doorStatusDiv.style.display = 'none';
    }
    
    updateSecurityStatusDisplay();
  }
  
  /**
   * 重設掃描器狀態
   */
  function resetScannerState() {
    setTimeout(() => {
      elements.statusIndicator.classList.remove('active');
      updateStatus('準備就緒，等待掃描...');
      
      // 5秒後隱藏成功/錯誤資訊
      setTimeout(() => {
        elements.statusSuccess.style.display = 'none';
        elements.statusError.style.display = 'none';
        elements.statusWarning.style.display = 'none';
        elements.userInfo.textContent = '尚未識別用戶';
        document.getElementById('door-status').style.display = 'none';
      }, 5000);
    }, 1000);
  }
  
  /**
   * 記錄API響應
   * @param {string} url - API URL
   * @param {string} method - 請求方法
   * @param {Object} requestData - 請求數據
   * @param {Object} responseData - 響應數據
   * @param {number} status - 狀態碼
   * @param {string} responseTime - 響應時間
   */
  function logApiResponse(url, method, requestData, responseData, status, responseTime) {
    const logEntry = {
      time: new Date().toISOString(),
      url,
      method,
      requestData,
      responseData,
      status,
      responseTime: `${responseTime}ms`
    };
  
    console.log('API 請求日誌:', logEntry);
    addLog(`API ${method} ${url}: ${status} [${responseTime}ms] ${JSON.stringify(responseData).substring(0, 30)}...`);
  }
  
  // ========== 安全功能 ==========
  /**
   * 增加失敗計數
   */
  function incrementFailureCount() {
    securityState.consecutiveFailures++;
    updateSecurityStatusDisplay();
  
    // 清除先前的重置計時器
    if (securityState.failureResetTimer) {
      clearTimeout(securityState.failureResetTimer);
    }
  
    // 如果超過最大失敗次數，鎖定系統
    if (securityState.consecutiveFailures >= SECURITY_SETTINGS.MAX_CONSECUTIVE_FAILURES) {
      lockSystem();
    } else {
      // 設置重置計時器 - 如果一段時間內沒有新失敗，重置計數器
      securityState.failureResetTimer = setTimeout(
        resetFailureCount, 
        SECURITY_SETTINGS.FAILURE_RESET_TIMEOUT
      );
    }
  
    // 添加日誌
    const isLocked = securityState.consecutiveFailures >= SECURITY_SETTINGS.MAX_CONSECUTIVE_FAILURES;
    addLog(`連續失敗次數增加至: ${securityState.consecutiveFailures} ${isLocked ? '(系統已鎖定)' : ''}`, isLocked);
  }
  
  /**
   * 重置失敗計數
   */
  function resetFailureCount() {
    // 如果計數器不為0，記錄日誌
    if (securityState.consecutiveFailures > 0) {
      addLog(`連續失敗計數器已重置 (之前值: ${securityState.consecutiveFailures})`);
    }
  
    // 重置計數器
    securityState.consecutiveFailures = 0;
  
    // 清除重置計時器
    if (securityState.failureResetTimer) {
      clearTimeout(securityState.failureResetTimer);
      securityState.failureResetTimer = null;
    }
  
    updateSecurityStatusDisplay();
  }
  
  /**
   * 鎖定系統
   */
  function lockSystem() {
    if (securityState.isLocked) return; // 已經鎖定，不重複操作
  
    // 設置鎖定狀態
    securityState.isLocked = true;
    securityState.lockdownStartTime = Date.now();
    securityState.lockdownEndTime = securityState.lockdownStartTime + SECURITY_SETTINGS.LOCKDOWN_DURATION;
  
    // 顯示鎖定面板
    elements.lockdownPanel.style.display = 'block';
    playSound('warning');
    updateSecurityStatusDisplay();
    addLog('系統已鎖定，過多連續失敗嘗試', true);
  
    // 開始倒計時
    updateLockdownTimer();
    securityState.lockdownTimer = setInterval(updateLockdownTimer, 1000);
  
    // 停止掃描器
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().catch(err => {
        console.error('停止掃描器失敗:', err);
      });
    }
  
    showWarning('系統已鎖定，請等待或聯絡管理員');
  }
  
  /**
   * 解鎖系統
   */
  function unlockSystem() {
    if (!securityState.isLocked) return; // 沒有鎖定，不需要操作
  
    // 清除鎖定狀態
    securityState.isLocked = false;
    securityState.lockdownStartTime = 0;
    securityState.lockdownEndTime = 0;
  
    // 清除倒計時計時器
    if (securityState.lockdownTimer) {
      clearInterval(securityState.lockdownTimer);
      securityState.lockdownTimer = null;
    }
  
    // 隱藏鎖定面板
    elements.lockdownPanel.style.display = 'none';
    resetFailureCount();
    
    // 清除相關集合
    securityState.processedTokens.clear();
    securityState.failedTOTPs.clear();
  
    addLog('系統已手動解鎖');
    startScanner();
    updateSecurityStatusDisplay();
  }
  
  /**
   * 更新鎖定計時器顯示
   */
  function updateLockdownTimer() {
    if (!securityState.isLocked) return;
  
    const now = Date.now();
    const remainingTime = Math.max(0, securityState.lockdownEndTime - now);
  
    // 如果時間到，自動解鎖
    if (remainingTime <= 0) {
      unlockSystem();
      return;
    }
  
    // 計算分鐘和秒數
    const minutes = Math.floor(remainingTime / 60000);
    const seconds = Math.floor((remainingTime % 60000) / 1000);
  
    // 更新顯示
    elements.lockdownTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * 檢查會話
   */
  async function checkSession() {
    try {
      const response = await fetch('/auth/check');
      const data = await response.json();
      
      if (!data.authenticated) {
        // 未登錄，重定向到登入頁面
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
      }
    } catch (error) {
      console.error('檢查會話錯誤:', error);
      window.location.href = '/login.html?error=session_check_failed';
    }
  }
  
  // ========== UI功能 ==========
  /**
   * 更新安全狀態顯示
   */
  function updateSecurityStatusDisplay() {
    // 更新狀態文字
    if (securityState.isLocked) {
      elements.securityStatusText.textContent = '系統已鎖定';
      elements.statusIndicator.className = 'status-indicator danger';
    } else if (securityState.consecutiveFailures >= SECURITY_SETTINGS.MAX_CONSECUTIVE_FAILURES - 1) {
      elements.securityStatusText.textContent = '警告';
      elements.statusIndicator.className = 'status-indicator warning';
    } else {
      elements.securityStatusText.textContent = '正常';
      elements.statusIndicator.className = 'status-indicator';
    }
  
    // 更新失敗計數顯示
    elements.failureCounter.textContent = securityState.consecutiveFailures;
  
    // 根據失敗次數改變計數器顏色
    elements.failureCounter.className = 'attempt-counter';
    if (securityState.consecutiveFailures === 0) {
      elements.failureCounter.classList.add('low');
    } else if (securityState.consecutiveFailures < SECURITY_SETTINGS.MAX_CONSECUTIVE_FAILURES - 1) {
      elements.failureCounter.classList.add('medium');
    } else {
      elements.failureCounter.classList.add('high');
    }
  }
  
  /**
   * 更新攝影機標籤顯示
   */
  function updateCameraLabel() {
    elements.cameraSwitch.innerHTML = `切換鏡頭 (${currentCamera === 'environment' ? '後置' : '前置'})`;
  }
  
  /**
   * 顯示成功資訊
   * @param {string} userName - 用戶名稱
   */
  function showSuccess(userName) {
    elements.userInfo.textContent = userName;
    elements.statusSuccess.style.display = 'block';
    elements.statusError.style.display = 'none';
    elements.statusWarning.style.display = 'none';
    elements.successMessage.textContent = `用戶 ${userName} 已授權進入`;
    playSound('success');
  }
  
  /**
   * 顯示錯誤資訊
   * @param {string} message - 錯誤訊息
   */
  function showError(message) {
    elements.userInfo.textContent = '驗證失敗';
    elements.statusSuccess.style.display = 'none';
    elements.statusError.style.display = 'block';
    elements.statusWarning.style.display = 'none';
    elements.errorMessage.textContent = message;
    playSound('error');
  }
  
  /**
   * 顯示警告資訊
   * @param {string} message - 警告訊息
   */
  function showWarning(message) {
    elements.userInfo.textContent = '安全警告';
    elements.statusSuccess.style.display = 'none';
    elements.statusError.style.display = 'none';
    elements.statusWarning.style.display = 'block';
    elements.warningMessage.textContent = message;
    playSound('warning');
  }
  
  /**
   * 暗色模式開關
   */
  function toggleDimmingMode() {
    elements.dimmingScreen.style.display = 'flex';
    addLog('已開啟暗色模式');
  }
  
  // ========== 輔助功能 ==========
  /**
   * 添加日誌條目
   * @param {string} message - 日誌訊息
   * @param {boolean} isError - 是否為錯誤
   */
  function addLog(message, isError = false) {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
  
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${isError ? 'log-error' : ''}`;
    logEntry.innerHTML = `<span class="log-time">[${timeString}]</span> ${message}`;
  
    elements.logContainer.prepend(logEntry);
  
    // 限制日誌條目數量
    while (elements.logContainer.children.length > 100) {
      elements.logContainer.removeChild(elements.logContainer.lastChild);
    }
  }
  
  /**
   * 播放聲音
   * @param {string} type - 聲音類型 (success/error/warning)
   */
  function playSound(type) {
    try {
      const soundTypeMap = {
        'success': 'success-sound',
        'error': 'error-sound',
        'warning': 'warning-sound'
      };
      
      const soundId = soundTypeMap[type];
      if (!soundId) return;
      
      const soundElement = document.getElementById(soundId);
      if (soundElement) {
        soundElement.volume = 0.5; // 設置音量
        soundElement.play().catch(e => {
          console.warn('播放音效失敗:', e);
        });
      }
    } catch (error) {
      console.error('播放聲音出錯:', error);
    }
  }
  
  /**
   * 自動重新整理功能設置
   */
  function setupAutoRefresh() {
    // 設置檢查間隔 (每分鐘檢查一次)
    setInterval(() => {
      const now = new Date();
      
      // 判斷是否為凌晨4點0分
      if (now.getHours() === 4 && now.getMinutes() === 0) {
        addLog('已達到設定的自動重新整理時間 (凌晨4點)，準備重新載入頁面...', false);
        
        // 設置短暫延遲以確保日誌記錄
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    }, 60000); // 每分鐘檢查一次
  
    addLog('已設置每日凌晨4點自動重新整理');
  }
  
  /**
   * 嘗試從 localStorage 載入之前保存的攝影機選擇
   */
  function loadCameraPreference() {
    try {
      const savedCamera = localStorage.getItem('preferredCamera');
      if (savedCamera) {
        currentCamera = savedCamera;
        updateCameraLabel();
      }
    } catch (e) {
      console.log('無法從 localStorage 載入攝影機設置');
    }
  }
  
  // ========== 事件監聽 ==========
  /**
   * 初始化事件監聽器
   */
  function initEventListeners() {
    // 攝影機切換
    elements.cameraSwitch.addEventListener('click', () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          // 切換攝影機
          currentCamera = currentCamera === 'environment' ? 'user' : 'environment';
          
          // 保存用戶選擇
          try {
            localStorage.setItem('preferredCamera', currentCamera);
          } catch (e) {
            console.log('無法保存攝影機設置到 localStorage');
          }
          
          // 更新標籤
          updateCameraLabel();
          
          // 重新開始掃描
          startScanner();
          
          // 添加日誌
          addLog(`已切換至${currentCamera === 'environment' ? '後置' : '前置'}攝影機`);
        }).catch(err => {
          console.error('停止掃描失敗:', err);
          addLog(`切換攝影機失敗: ${err}`, true);
        });
      }
    });
  
    // 暗色模式按鈕事件監聽
    document.getElementById('dimming-mode').addEventListener('click', toggleDimmingMode);
  
    // 點擊暗色模式螢幕退出
    elements.dimmingScreen.addEventListener('click', function() {
      this.style.display = 'none';
      addLog('已關閉暗色模式');
    });
  
    // 控制面板折疊開關
    const toggleControls = document.getElementById('toggle-controls');
    const controlsContainer = document.getElementById('controls-container');
  
    toggleControls.addEventListener('click', function() {
      if (controlsContainer.style.display === 'none') {
        controlsContainer.style.display = 'block';
        this.innerHTML = '<i class="bi bi-chevron-down"></i>';
      } else {
        controlsContainer.style.display = 'none';
        this.innerHTML = '<i class="bi bi-chevron-up"></i>';
      }
    });
  
    // 解鎖按鈕事件監聽器
    elements.unlockBtn.addEventListener('click', function() {
      if (confirm('確認要解除系統鎖定嗎?')) {
        unlockSystem();
      }
    });
  }
  
  // ========== 初始化 ==========
  /**
   * 初始化應用程式
   */
  function initApp() {
    initializeElements();
    loadCameraPreference();
    updateSecurityStatusDisplay();
    setupAutoRefresh();
    initEventListeners();
    startScanner();
  }
  
  // 頁面載入時的初始化
  window.addEventListener('DOMContentLoaded', function() {
    // 檢查會話
    checkSession();
    initApp();
  });