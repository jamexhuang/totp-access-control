// 動態插入導航欄內容
function loadNavbar() {
  // 獲取當前路徑
  const currentPath = window.location.pathname;
  
  // 決定當前活動頁面的ID
  let activeNavId;
  
  // 1. 嘗試從localStorage獲取上次點擊的導航項目
  const lastClickedNav = localStorage.getItem('activeNavId');
  
  // 2. 如果有存儲的狀態並且不是來自頁面刷新，直接使用它
  if (lastClickedNav && document.referrer) {
    activeNavId = lastClickedNav;
    console.log(`使用localStorage中的導航狀態: ${activeNavId}`);
  } 
  // 3. 否則根據URL路徑決定
  else {
    // 簡化路徑比較
    const pageName = currentPath.split('/').pop().split('.')[0];
    
    // 映射頁面名稱到導航ID
    switch(pageName) {
      case '':
      case 'index':
        activeNavId = 'nav-home';
        break;
      case 'user':
        activeNavId = 'nav-user';
        break;
      case 'scanner':
        activeNavId = 'nav-scanner';
        break;
      case 'otp':
        activeNavId = 'nav-otp';
        break;
      case 'diagnostic':
        activeNavId = 'nav-diagnostic';
        break;
      case 'admin':
        activeNavId = 'nav-admin';
        break;
      default:
        activeNavId = 'nav-home';
        break;
    }
    
    console.log(`根據URL路徑【${currentPath}】識別頁面: ${pageName}, 導航ID: ${activeNavId}`);
  }
  
  // 創建導航欄HTML
  const navbarHTML = `
    <!-- 漢堡菜單按鈕 -->
    <button class="navbar-toggler" id="navbar-toggler" type="button" aria-label="切換導航">
      <i class="bi bi-list"></i>
    </button>
    
    <!-- 側邊欄背景遮罩 -->
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    
    <!-- 側邊欄導航 -->
    <div class="sidebar" id="sidebar">
      <a href="/" class="sidebar-brand">
        <i class="bi bi-shield-lock me-2"></i> <span>智慧門禁系統</span>
      </a>
      <ul class="nav flex-column">
        <li class="nav-item">
          <a class="nav-link ${activeNavId === 'nav-home' ? 'active' : ''}" href="/" id="nav-home" data-navid="nav-home">
            <i class="bi bi-speedometer2"></i> <span>系統狀態</span>
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activeNavId === 'nav-user' ? 'active' : ''}" href="/user.html" id="nav-user" data-navid="nav-user">
            <i class="bi bi-people"></i> <span>用戶管理</span>
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activeNavId === 'nav-scanner' ? 'active' : ''}" href="/scanner.html" id="nav-scanner" data-navid="nav-scanner">
            <i class="bi bi-qr-code-scan"></i> <span>掃描器</span>
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activeNavId === 'nav-otp' ? 'active' : ''}" href="/otp.html" id="nav-otp" data-navid="nav-otp">
            <i class="bi bi-key"></i> <span>通行證</span>
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activeNavId === 'nav-diagnostic' ? 'active' : ''}" href="/diagnostic.html" id="nav-diagnostic" data-navid="nav-diagnostic">
            <i class="bi bi-activity"></i> <span>系統診斷</span>
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activeNavId === 'nav-admin' ? 'active' : ''}" href="/admin.html" id="nav-admin" data-navid="nav-admin">
            <i class="bi bi-gear"></i> <span>管理員設定</span>
          </a>
        </li>
      </ul>
      
      <div class="position-absolute bottom-0 w-100 mb-3">
        <ul class="nav flex-column">
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
              <i class="bi bi-person-circle"></i> <span id="username">用戶</span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">
              <li><div class="dropdown-item-text"><span id="user-email">用戶信箱</span></div></li>
              <li><a class="dropdown-item" href="/admin.html#settings"><i class="bi bi-gear me-2"></i> 帳戶設定</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item" href="/auth/logout"><i class="bi bi-box-arrow-right me-2"></i> 登出</a></li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  `;
  
  // 在頁面開始處插入導航欄HTML
  document.body.insertAdjacentHTML('afterbegin', navbarHTML);
  
  // 設置導航欄點擊事件
  setTimeout(() => {
    // 獲取導航元素
    const navbarToggler = document.getElementById('navbar-toggler');
    const sidebar = document.getElementById('sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    
    // 側邊欄切換邏輯
    if (navbarToggler) {
      navbarToggler.addEventListener('click', function() {
        sidebar.classList.toggle('show');
        sidebarBackdrop.classList.toggle('show');
      });
    }
    
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', function() {
        sidebar.classList.remove('show');
        sidebarBackdrop.classList.remove('show');
      });
    }
    
    // 為所有導航連結添加點擊事件，記錄當前活動頁面
    document.querySelectorAll('.sidebar .nav-link').forEach(navLink => {
      navLink.addEventListener('click', function() {
        const navId = this.getAttribute('data-navid');
        if (navId) {
          localStorage.setItem('activeNavId', navId);
          console.log(`保存點擊的導航ID: ${navId}`);
        }
      });
    });
    
    // 如果有活動頁面，手動應用active類
    if (activeNavId) {
      document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
      });
      const activeLink = document.getElementById(activeNavId);
      if (activeLink) {
        activeLink.classList.add('active');
      }
    }
  }, 100);
}

// 當DOM載入完成後插入導航欄
document.addEventListener('DOMContentLoaded', loadNavbar);
