document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  const redirect = urlParams.get('redirect') || '/';
  
  const errorElement = document.getElementById('error-message');
  const loginForm = document.getElementById('login-form');
  const loginButton = document.getElementById('login-button');
  const helpLink = document.getElementById('help-link');
  
  // 如有錯誤參數，顯示錯誤
  if (error) showError(decodeURIComponent(error));
  
  // 登錄表單提交處理
  loginForm.addEventListener('submit', onLoginSubmit);
  
  // 幫助連結點擊事件
  helpLink.addEventListener('click', showHelpInfo);
  
  function onLoginSubmit(e) {
    e.preventDefault();
    disableLoginButton(true, '<i class="bi bi-hourglass-split"></i> 登錄中...');
    
    hideError();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value;
    
    if (!turnstileToken) {
      showError('請完成人機驗證');
      disableLoginButton(false, '<i class="bi bi-box-arrow-in-right"></i> 登錄');
      return;
    }
    sendLoginRequest(username, password, turnstileToken);
  }
  
  async function sendLoginRequest(username, password, turnstileToken) {
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, turnstileToken, redirect })
      });
      
      if (!response.ok) {
        throw new Error(`伺服器返回錯誤碼: ${response.status}`);
      }
      const result = await response.json();
      
      if (result.success) {
        window.location.href = result.redirect;
      } else {
        showError(result.error || '登錄失敗，請檢查您的憑據');
        resetTurnstile();
        disableLoginButton(false, '<i class="bi bi-box-arrow-in-right"></i> 登錄');
      }
    } catch (err) {
      console.error('登錄請求錯誤:', err);
      showError(`登錄失敗: ${err.message}`);
      disableLoginButton(false, '<i class="bi bi-box-arrow-in-right"></i> 登錄');
    }
  }
  
  function resetTurnstile() {
    if (window.turnstile) {
      window.turnstile.reset();
    }
  }
  
  function showHelpInfo() {
    alert('默認管理員帳戶：\n使用者名稱: admin\n密碼: admin123\n\n請登錄後盡快修改密碼！');
  }
  
  function showError(msg) {
    errorElement.textContent = msg;
    errorElement.style.display = 'block';
  }
  
  function hideError() {
    errorElement.style.display = 'none';
  }
  
  function disableLoginButton(disabled, text) {
    loginButton.disabled = disabled;
    loginButton.innerHTML = text;
  }
});
