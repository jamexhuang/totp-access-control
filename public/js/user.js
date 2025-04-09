/**
 * 用戶管理系統
 * 用於管理用戶、生成通行證和記錄系統日誌
 */

// ========== 狀態管理 ==========
const state = {
  currentTab: null,
  usersList: null,
  logsList: null
};

// ========== 常量定義 ==========
const API_ENDPOINTS = {
  USERS: '/api/users',
  LOGS: '/api/logs',
  ADMINS: '/api/admins'
};

// ========== 初始化 ==========
/**
 * 頁面加載時初始化
 */
document.addEventListener('DOMContentLoaded', function() {
  // 初始化DOM引用
  initializeDOMReferences();
  
  // 根據URL hash顯示相應標籤
  activateTabFromHash();
  
  // 註冊事件監聽器
  registerEventListeners();
  
  // 檢查網絡狀態
  checkNetworkStatus();
  
  // 加載初始數據
  initializeData();
});

/**
 * 初始化DOM元素引用
 */
function initializeDOMReferences() {
  state.usersList = document.getElementById('users-list');
  state.logsList = document.getElementById('logs-list');
}

/**
 * 根據URL hash激活對應標籤
 */
function activateTabFromHash() {
  const hash = window.location.hash || '#users';
  const triggerTabEl = document.querySelector(`button[data-bs-target="${hash}"]`);
  if (triggerTabEl) {
    new bootstrap.Tab(triggerTabEl).show();
    state.currentTab = hash.replace('#', '');
  }
}

/**
 * 註冊事件監聽器
 */
function registerEventListeners() {
  // 單選按鈕事件
  document.querySelectorAll('input[name="user-type"]').forEach(radio => {
    radio.addEventListener('change', function() {
      document.getElementById('expiry-days-container').style.display = 
        this.value === 'temporary' ? 'block' : 'none';
    });
  });
  
  // 按鈕事件
  document.getElementById('refresh-users-btn').addEventListener('click', loadUsers);
  document.getElementById('refresh-logs-btn').addEventListener('click', loadLogs);
  document.getElementById('add-user-form').addEventListener('submit', addUser);
  document.getElementById('refresh-security-check').addEventListener('click', checkDefaultAdminStatus);
  
  // 網絡恢復事件
  window.addEventListener('online', () => {
    showNotification('網絡已恢復連接', 'success');
    loadUsers();
    loadLogs();
  });
  
  window.addEventListener('offline', () => {
    showNotification('網絡已斷開連接，部分功能可能不可用', 'warning');
  });
}

/**
 * 檢查網絡狀態
 */
function checkNetworkStatus() {
  if (!navigator.onLine) {
    showNotification('您目前處於離線狀態，部分功能可能無法正常使用', 'warning');
  }
}

/**
 * 初始化數據
 */
function initializeData() {
  // 檢查安全狀態
  checkDefaultAdminStatus();
  
  // 加載用戶和日誌
  loadUsers();
  loadLogs();
}

// ========== 安全功能 ==========
/**
 * 檢查默認管理員(admin)是否已被停用
 */
async function checkDefaultAdminStatus() {
  updateUIState('security-check-status', 'loading', '檢查中...');
  
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.ADMINS);
    if (!response.ok) {
      throw new Error('無法獲取管理員列表');
    }
    
    const admins = await response.json();
    const defaultAdmin = admins.find(admin => admin.username === 'admin');
    
    // 如果找不到admin帳號，表示它可能已被刪除
    if (!defaultAdmin) {
      enableUserCreation();
      updateUIState('security-check-status', 'success', '預設管理員已被刪除，系統安全設置正常');
      return;
    }
    
    // 檢查admin帳號是否已停用
    if (!defaultAdmin.is_disabled) {
      disableUserCreation();
      updateUIState('security-check-status', 'warning', '預設管理員尚未停用，存在安全風險！');
    } else {
      enableUserCreation();
      updateUIState('security-check-status', 'success', '預設管理員已停用，系統安全設置正常');
    }
  } catch (error) {
    console.error('檢查預設管理員狀態出錯:', error);
    updateUIState('security-check-status', 'error', '檢查失敗: ' + error.message);
    disableUserCreation('無法檢查預設管理員狀態，請確保您有足夠權限或重新登入');
  }
}

/**
 * 禁用新增用戶功能並顯示警告
 */
function disableUserCreation(customMessage) {
  const warningElement = document.getElementById('security-warning');
  const addUserForm = document.getElementById('add-user-form');
  
  // 顯示警告訊息
  warningElement.classList.remove('d-none');
  
  if (customMessage) {
    warningElement.querySelector('p').textContent = customMessage;
  }
  
  // 禁用表單的所有輸入元素和按鈕
  const formInputs = addUserForm.querySelectorAll('input, button');
  formInputs.forEach(input => {
    input.disabled = true;
  });
  
  // 添加視覺提示
  addUserForm.classList.add('opacity-50');
  addUserForm.querySelector('button[type="submit"]').innerHTML = 
    '<i class="bi bi-lock-fill"></i> 已鎖定 (請先停用預設管理員)';
}

/**
 * 啟用新增用戶功能並隱藏警告
 */
function enableUserCreation() {
  const warningElement = document.getElementById('security-warning');
  const addUserForm = document.getElementById('add-user-form');
  
  // 隱藏警告訊息
  warningElement.classList.add('d-none');
  
  // 啟用表單的所有輸入元素和按鈕
  const formInputs = addUserForm.querySelectorAll('input, button');
  formInputs.forEach(input => {
    input.disabled = false;
  });
  
  // 移除視覺提示
  addUserForm.classList.remove('opacity-50');
  addUserForm.querySelector('button[type="submit"]').innerHTML = '新增用戶';
}

// ========== 用戶管理功能 ==========
/**
 * 加載用戶列表
 */
async function loadUsers() {
  updateUIState('users-list', 'loading', '正在載入用戶數據...');
  
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.USERS);
    if (!response.ok) {
      throw new Error(`伺服器返回錯誤: ${response.status}`);
    }
    
    const users = await response.json();
    renderUsersList(users);
  } catch (error) {
    console.error('載入用戶失敗:', error);
    updateUIState('users-list', 'error', 
      error.name === 'AbortError' ? '請求超時' : `載入失敗: ${error.message}`);
  }
}

/**
 * 渲染用戶列表
 * @param {Array} users - 用戶數據陣列
 */
function renderUsersList(users) {
  if (!state.usersList) return;
  
  state.usersList.innerHTML = users.length ? '' : 
    '<tr><td colspan="6" class="text-center">沒有用戶數據</td></tr>';
  
  users.forEach(user => {
    const row = document.createElement('tr');
    const truncatedId = user.id.slice(0, 8) + (user.id.length > 8 ? '...' : '');
    const userType = user.is_temporary ? '臨時用戶' : '正式用戶';
    const createdDate = moment(user.created_at).format('YYYY-MM-DD HH:mm');
    
    // 用戶狀態標籤
    let statusText = user.is_disabled ? 
      '<span class="badge bg-danger">已停用</span>' : 
      '<span class="badge bg-success">已啟用</span>';
    
    // 如果是臨時用戶，顯示過期狀態
    if (!user.is_disabled && user.is_temporary && user.temporary_expiry) {
      const expiryDate = new Date(user.temporary_expiry);
      const now = new Date();
      const daysLeft = Math.ceil((expiryDate - now)/(1000*60*60*24));
      
      statusText += expiryDate < now ? 
        ' <span class="badge bg-danger">已過期</span>' : 
        ` <span class="badge bg-warning">剩餘${daysLeft}天</span>`;
    }

    // 操作按鈕
    const actionButtons = [
      createActionButton('info', 'qr-code', '查看QR碼', 
        `showUserQR('${escapeString(user.id)}','${escapeString(user.name)}')`),
      createActionButton('warning', user.is_disabled ? 'check-circle' : 'x-circle', 
        user.is_disabled ? '啟用' : '停用', 
        `toggleUserStatus('${escapeString(user.id)}','${escapeString(user.name)}',${user.is_disabled})`),
      createActionButton('danger', 'trash', '刪除', 
        `deleteUser('${escapeString(user.id)}','${escapeString(user.name)}')`),
    ];
    
    row.innerHTML = `
      <td title="${user.id}">${truncatedId}</td>
      <td>${user.name}</td>
      <td>${userType}</td>
      <td>${statusText}</td>
      <td>${createdDate}</td>
      <td class="d-flex gap-2">${actionButtons.join('')}</td>
    `;
    state.usersList.appendChild(row);
  });
}

/**
 * 創建操作按鈕HTML
 */
function createActionButton(colorClass, icon, title, onclick) {
  return `
    <button class="btn btn-sm btn-${colorClass}" 
            onclick="${onclick}" 
            title="${title}">
      <i class="bi bi-${icon}"></i>
      ${title !== '查看QR碼' && title !== '刪除' ? title : ''}
    </button>
  `;
}

/**
 * 添加新用戶
 */
async function addUser(e) {
  e.preventDefault();
  
  const name = document.getElementById('user-name').value.trim();
  const isTemporary = document.getElementById('user-type-temporary').checked;
  const expiryDays = parseInt(document.getElementById('expiry-days').value);

  // 驗證輸入
  if (!name) {
    showNotification('請輸入使用者名稱', 'warning');
    return;
  }
  
  if (isTemporary && (!expiryDays || expiryDays <= 0)) {
    showNotification('請輸入有效天數', 'warning');
    return;
  }

  // 顯示加載狀態
  const submitBtn = document.querySelector('#add-user-form button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 處理中...';
  
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.USERS, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name, is_temporary: isTemporary, expiry_days: expiryDays })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '伺服器錯誤');

    // 重置表單
    document.getElementById('add-user-form').reset();
    document.getElementById('expiry-days-container').style.display = 'none';
    
    // 重新加載用戶列表並顯示QR碼
    loadUsers();
    showUserQR(result.id, result.name);
    showNotification(`已成功創建用戶: ${result.name}`, 'success');
  } catch (error) {
    console.error('添加用戶失敗:', error);
    showNotification(`新增用戶失敗: ${error.message}`, 'error');
  } finally {
    // 恢復按鈕狀態
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
}

/**
 * 顯示用戶QR碼
 */
async function showUserQR(userId, userName) {
  try {
    // 顯示加載狀態
    const qrcodeDiv = document.getElementById('qrcode');
    qrcodeDiv.innerHTML = '<div class="d-flex justify-content-center my-4"><div class="spinner-border text-primary" role="status"></div></div><p class="text-center">正在生成QR碼...</p>';
    
    document.getElementById('qr-user-name').textContent = userName;
    new bootstrap.Modal('#userQRModal').show();
    
    // 獲取用戶數據
    const response = await fetchWithTimeout(`${API_ENDPOINTS.USERS}/${userId}`);
    if (!response.ok) throw new Error('無法獲取用戶資料');
    
    const user = await response.json();
    
    // 生成通行證數據
    const userData = {
      id: userId,
      name: userName,
      secret: user.secret
    };
    
    // 編碼URL
    const otpUrl = `${window.location.origin}/otp.html?data=${utf8ToBase64(JSON.stringify(userData))}`;
    
    // 生成QR碼
    const qr = qrcode(0, 'M');
    qr.addData(otpUrl);
    qr.make();
    
    // 更新QR碼容器
    qrcodeDiv.innerHTML = '';
    
    // 創建QR碼容器
    const qrContainer = document.createElement('div');
    qrContainer.className = 'qr-code-container';
    qrContainer.innerHTML = qr.createImgTag(5);
    qrcodeDiv.appendChild(qrContainer);
    
    // 添加操作按鈕
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'mt-3 text-center';
    buttonsDiv.innerHTML = `
      <a href="${otpUrl}" target="_blank" class="btn btn-sm btn-primary">
        <i class="bi bi-box-arrow-up-right"></i> 打開通行證頁面
      </a>
      <button onclick="copyToClipboard('${otpUrl}')" class="btn btn-sm btn-outline-secondary ms-2">
        <i class="bi bi-clipboard"></i> 複製鏈接
      </button>
    `;
    qrcodeDiv.appendChild(buttonsDiv);
  } catch (error) {
    console.error('QR碼生成失敗:', error);
    document.getElementById('qrcode').innerHTML = 
      `<div class="alert alert-danger">QR碼生成失敗: ${error.message}</div>`;
  }
}

/**
 * 切換用戶狀態（啟用/停用）
 */
async function toggleUserStatus(userId, userName, isDisabled) {
  if (!confirm(`確定要${isDisabled ? '啟用' : '停用'}用戶 "${userName}" 嗎？`)) return;
  
  try {
    const response = await fetchWithTimeout(`${API_ENDPOINTS.USERS}/${userId}/toggle-status`, { 
      method: 'POST' 
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '狀態切換失敗');
    }
    
    loadUsers();
    showNotification(`已${isDisabled ? '啟用' : '停用'}用戶: ${userName}`, 'success');
  } catch (error) {
    console.error('切換用戶狀態失敗:', error);
    showNotification(`狀態切換失敗: ${error.message}`, 'error');
  }
}

/**
 * 刪除用戶
 */
async function deleteUser(userId, userName) {
  if (!confirm(`確定刪除用戶 "${userName}"？此操作無法復原！`)) return;
  
  try {
    const response = await fetchWithTimeout(`${API_ENDPOINTS.USERS}/${userId}`, { 
      method: 'DELETE' 
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '刪除用戶失敗');
    }
    
    loadUsers();
    showNotification(`已成功刪除用戶: ${userName}`, 'success');
  } catch (error) {
    console.error('刪除用戶失敗:', error);
    showNotification(`刪除失敗: ${error.message}`, 'error');
  }
}

// ========== 日誌功能 ==========
/**
 * 加載系統日誌
 */
async function loadLogs() {
  updateUIState('logs-list', 'loading', '正在載入日誌數據...');
  
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.LOGS);
    if (!response.ok) {
      throw new Error(`伺服器返回錯誤: ${response.status}`);
    }
    
    const result = await response.json();
    
    // 處理不同格式的API返回結構
    let logs;
    if (result.success && result.data) {
      logs = result.data; // 新格式
    } else if (Array.isArray(result)) {
      logs = result; // 舊格式
    } else {
      logs = [];
      console.warn('無法識別日誌回應格式:', result);
    }
    
    renderLogsList(logs);
  } catch (error) {
    console.error('載入日誌失敗:', error);
    updateUIState('logs-list', 'error', 
      error.name === 'AbortError' ? '請求超時' : `載入失敗: ${error.message}`);
  }
}

/**
 * 渲染日誌列表
 * @param {Array} logs - 日誌數據陣列
 */
function renderLogsList(logs) {
  if (!state.logsList) return;
  
  if (!Array.isArray(logs)) {
    console.error('日誌數據不是陣列:', logs);
    logs = [];
  }
  
  state.logsList.innerHTML = logs.length ? '' : 
    '<tr><td colspan="4" class="text-center">沒有日誌記錄</td></tr>';
  
  logs.forEach(log => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${log.id}</td>
      <td>${log.user_name || '系統'}</td>
      <td>${log.action}</td>
      <td>${moment(log.timestamp).format('YYYY-MM-DD HH:mm:ss')}</td>
    `;
    state.logsList.appendChild(row);
  });
}

// ========== 工具函數 ==========
/**
 * 帶超時的fetch請求
 * @param {string} url - 請求URL
 * @param {Object} options - fetch選項
 * @param {number} timeout - 超時時間(毫秒)
 * @returns {Promise} - fetch響應
 */
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  options.signal = controller.signal;
  
  try {
    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 更新UI狀態(加載/錯誤/成功)
 * @param {string} elementId - 元素ID
 * @param {string} state - 狀態類型(loading/error/success)
 * @param {string} message - 顯示訊息
 */
function updateUIState(elementId, state, message) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  // 處理表格元素特殊情況
  if (element.tagName === 'TBODY') {
    switch (state) {
      case 'loading':
        element.innerHTML = `<tr><td colspan="6" class="text-center">
          <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
          ${message}
        </td></tr>`;
        break;
      case 'error':
        element.innerHTML = `<tr><td colspan="6" class="text-center text-danger">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>${message}
        </td></tr>`;
        break;
      case 'empty':
        element.innerHTML = `<tr><td colspan="6" class="text-center text-muted">
          ${message}
        </td></tr>`;
        break;
    }
  }
  // 處理一般元素
  else {
    switch (state) {
      case 'loading':
        element.innerHTML = `
          <div class="d-flex align-items-center">
            <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
            <span>${message}</span>
          </div>`;
        break;
      case 'error':
        element.innerHTML = `
          <div class="text-danger">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>${message}
          </div>`;
        break;
      case 'success':
        element.innerHTML = `
          <div class="text-success">
            <i class="bi bi-check-circle-fill me-2"></i>${message}
          </div>`;
        break;
      case 'warning':
        element.innerHTML = `
          <div class="text-warning">
            <i class="bi bi-exclamation-circle-fill me-2"></i>${message}
          </div>`;
        break;
    }
  }
}

/**
 * 顯示通知訊息
 * @param {string} message - 通知訊息
 * @param {string} type - 通知類型(success/warning/error)
 */
function showNotification(message, type = 'info') {
  // 檢查是否支持Toasts
  if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
    // 創建Toast元素
    const toastContainer = document.getElementById('toast-container') || 
                          createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center border-0 bg-${getBootstrapColor(type)}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <i class="bi ${getIconForType(type)} me-2"></i>
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // 初始化Toast
    const toastInstance = new bootstrap.Toast(toast, { 
      autohide: true,
      delay: 3000
    });
    
    // 顯示Toast
    toastInstance.show();
    
    // 監聽隱藏事件，移除元素
    toast.addEventListener('hidden.bs.toast', () => {
      toast.remove();
    });
  } else {
    // 降級方案：使用alert
    alert(message);
  }
}

/**
 * 創建Toast容器
 */
function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
  container.style.zIndex = '1090';
  document.body.appendChild(container);
  return container;
}

/**
 * 獲取通知類型對應的Bootstrap顏色類
 */
function getBootstrapColor(type) {
  switch (type) {
    case 'success': return 'success';
    case 'error': return 'danger';
    case 'warning': return 'warning';
    default: return 'info';
  }
}

/**
 * 獲取通知類型對應的圖標
 */
function getIconForType(type) {
  switch (type) {
    case 'success': return 'bi-check-circle-fill';
    case 'error': return 'bi-exclamation-triangle-fill';
    case 'warning': return 'bi-exclamation-circle-fill';
    default: return 'bi-info-circle-fill';
  }
}

/**
 * 轉義字符串以防止XSS攻擊
 * @param {string} str - 需要轉義的字符串
 * @returns {string} - 轉義後的字符串
 */
function escapeString(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/**
 * 將文本複製到剪貼板
 * @param {string} text - 要複製的文本
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => showNotification('連結已複製到剪貼板', 'success'))
    .catch(() => showNotification('複製失敗，請手動複製', 'error'));
}

/**
 * UTF-8字符串轉Base64編碼
 * @param {string} str - 要編碼的字符串
 * @returns {string} - Base64編碼字符串
 */
function utf8ToBase64(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  }));
}

// 將函數暴露至全局作用域，以便HTML中的onclick事件可以調用
window.showUserQR = showUserQR;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
window.copyToClipboard = copyToClipboard;
