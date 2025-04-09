// 緩存版本號 - 更改此值可使緩存更新
const CACHE_VERSION = 'v1.0.3';
const CACHE_NAME = `otp-app-${CACHE_VERSION}`;

// 開發模式配置
const DEV_MODE = {
  enabled: true,                   // 設置為 true 啟用開發模式
  checkInterval: 30 * 1000,        // 每30秒檢查一次更新
  lastChecked: Date.now()          // 最後檢查時間
};

// 需要緩存的資源列表
const STATIC_CACHE_URLS = [
  '/',
  '/otp.html',
  '/css/style.css',
  '/manifest.json',
  '/icons/icon-256x256.png',
  '/icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js',
  'https://cdn.jsdelivr.net/npm/otpauth/dist/otpauth.umd.min.js',
  'https://cdn.jsdelivr.net/npm/html5-qrcode/html5-qrcode.min.js'
];

// 黑名單域名和協議 - 這些將被排除在緩存之外
const BLACKLIST_DOMAINS = [
  'scriptcdn.net',
  '3001.scriptcdn.net',
  'analytics',
  'tracking',
  'adservice',
  'facebook.net',
  'doubleclick.net'
];

// 檢查是否為可緩存的請求
function isCacheableRequest(url) {
  // 檢查 URL 是否是有效的字符串
  if (typeof url !== 'string' && !(url instanceof URL)) {
    return false;
  }
  
  let urlObj;
  try {
    // 確保我們有一個 URL 對象
    urlObj = new URL(typeof url === 'string' ? url : url.toString());
  } catch (e) {
    console.error('[Service Worker] 無效的 URL:', url, e);
    return false;
  }

  // 只接受 http 和 https 協議
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    console.log(`[Service Worker] 非 HTTP/HTTPS 協議不緩存: ${urlObj.protocol}`);
    return false;
  }

  // 檢查黑名單域名
  for (const domain of BLACKLIST_DOMAINS) {
    if (urlObj.hostname.includes(domain)) {
      console.log(`[Service Worker] 黑名單域名不緩存: ${urlObj.hostname}`);
      return false;
    }
  }

  return true;
}

// 設備檢測 - 修改以消除對window的引用
function isIOSDevice() {
  // 在Service Worker中無法使用window對象，改用navigator.userAgent檢查
  return (/iPad|iPhone|iPod/.test(navigator.userAgent) && 
          !navigator.userAgent.includes('MSStream')); // 不用window.MSStream
}

// Service Worker 安裝事件 - 緩存靜態資源
self.addEventListener('install', event => {
  console.log('[Service Worker] 安裝中...');
  
  // 提前進入激活狀態，不等待其他頁面關閉
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] 緩存靜態資源');
        // 過濾資源列表，只緩存可緩存的資源
        const cacheableUrls = STATIC_CACHE_URLS.filter(url => isCacheableRequest(url));
        return cache.addAll(cacheableUrls);
      })
      .catch(error => {
        console.error('[Service Worker] 緩存失敗:', error);
      })
  );
});

// Service Worker 激活事件 - 清理舊緩存
self.addEventListener('activate', event => {
  console.log('[Service Worker] 激活中...');
  
  // 立即接管網站頁面
  self.clients.claim();
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 刪除不是當前版本的緩存
          if (cacheName.startsWith('otp-app-') && cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 刪除舊緩存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 通知所有客戶端 Service Worker 已激活
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: CACHE_VERSION
          });
        });
      });
    })
  );
  
  // 如果開發模式已啟用，啟動定期檢查更新
  if (DEV_MODE.enabled) {
    startDevModeUpdates();
  }
});

// 開發模式下的更新檢查
function startDevModeUpdates() {
  console.log('[Service Worker] 開發模式已啟用，將定期檢查更新');
  
  // 定期檢查更新
  setInterval(() => {
    checkForUpdates();
  }, DEV_MODE.checkInterval);
  
  // 初次激活時立即檢查一次
  setTimeout(() => {
    checkForUpdates();
  }, 1000);
}

// 檢查更新函數
function checkForUpdates() {
  console.log('[Service Worker] 檢查更新...');
  DEV_MODE.lastChecked = Date.now();
  
  // 強制重新註冊自己，檢查是否有新版本
  self.registration.update().then(() => {
    console.log('[Service Worker] 已檢查更新');
  }).catch(err => {
    console.error('[Service Worker] 檢查更新失敗:', err);
  });
  
  // 通知所有客戶端進行檢查
  self.clients.matchAll({ type: 'window' }).then(clients => {
    console.log(`[Service Worker] 找到 ${clients.length} 個客戶端，發送檢查更新訊息`);
    
    clients.forEach((client, index) => {
      console.log(`[Service Worker] 向客戶端 ${index + 1} 發送更新檢查訊息`);
      try {
        client.postMessage({
          type: 'CHECK_UPDATES',
          timestamp: Date.now()
        });
        console.log(`[Service Worker] 已成功向客戶端 ${index + 1} 發送訊息`);
      } catch(e) {
        console.error(`[Service Worker] 向客戶端 ${index + 1} 發送訊息失敗:`, e);
      }
    });
  }).catch(err => {
    console.error('[Service Worker] 獲取客戶端列表失敗:', err);
  });
}

// Service Worker 攔截請求事件
self.addEventListener('fetch', event => {
  // 獲取請求URL
  let url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    console.error('[Service Worker] 無效的請求 URL:', event.request.url);
    return; // 無效 URL，直接放行請求
  }
  
  // 檢查是否可以緩存此請求
  if (!isCacheableRequest(url.toString())) {
    console.log('[Service Worker] 跳過不可緩存的請求:', url.toString());
    return; // 跳過不可緩存的請求
  }
  
  // 特殊處理帶有data參數的請求 - 確保不會被緩存影響數據設置
  if (url.search.includes('data=')) {
    console.log('[Service Worker] 處理含有數據參數的請求:', url.pathname);
    // 直接放行，不做任何緩存干預
    return;
  }
  
  // 特殊處理主頁面 - 網絡優先，但在離線時使用緩存
  if (url.pathname.endsWith('/otp.html') || url.pathname === '/') {
    console.log('[Service Worker] 處理主頁面請求:', url.pathname);
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 如果成功從網絡獲取，更新緩存
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                console.log('[Service Worker] 更新頁面緩存:', url.pathname);
                cache.put(event.request, responseToCache);
              })
              .catch(err => {
                console.error('[Service Worker] 緩存頁面失敗:', err);
              });
          }
          return response;
        })
        .catch(() => {
          // 如果網絡失敗，嘗試從緩存獲取
          console.log('[Service Worker] 網絡請求失敗，使用緩存:', url.pathname);
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // 如果沒有特定頁面的緩存，則嘗試返回主頁
              return caches.match('/otp.html');
            })
            .catch(err => {
              console.error('[Service Worker] 緩存匹配失敗:', err);
              // 確保返回有效的 Response
              return new Response('離線模式，無法訪問頁面', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: {'Content-Type': 'text/plain'}
              });
            });
        })
    );
    return;
  }

  // 跳過處理 API 請求
  if (url.pathname.includes('/api/')) {
    console.log('[Service Worker] 跳過 API 請求:', url.pathname);
    return;
  }

  // 處理非 GET 請求
  if (event.request.method !== 'GET') {
    console.log('[Service Worker] 跳過非 GET 請求:', event.request.method, url.pathname);
    return;
  }
  
  // 靜態資源使用緩存優先策略
  console.log('[Service Worker] 處理靜態資源:', url.pathname);
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 如果有緩存，直接返回緩存
        if (cachedResponse) {
          // 在後台仍然發起網絡請求以更新緩存
          fetch(event.request)
            .then(networkResponse => {
              // 如果網絡請求成功，更新緩存
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME)
                  .then(cache => {
                    console.log('[Service Worker] 後台更新資源緩存:', url.pathname);
                    try {
                      cache.put(event.request, networkResponse.clone());
                    } catch (err) {
                      console.error('[Service Worker] 緩存資源失敗:', err);
                    }
                  })
                  .catch(err => {
                    console.error('[Service Worker] 打開緩存失敗:', err);
                  });
              }
            })
            .catch(error => {
              console.log('[Service Worker] 後台更新失敗:', error);
            });
            
          return cachedResponse;
        }
        
        // 如果沒有緩存，嘗試網絡請求
        return fetch(event.request)
          .then(networkResponse => {
            // 檢查是否為有效響應
            if (!networkResponse || !networkResponse.status || networkResponse.status !== 200) {
              console.log('[Service Worker] 網絡請求返回非200狀態:', networkResponse?.status);
              return networkResponse;
            }

            // 如果網絡請求成功，緩存結果並返回
            try {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  console.log('[Service Worker] 緩存新獲取的資源:', url.pathname);
                  try {
                    cache.put(event.request, responseToCache);
                  } catch (err) {
                    console.error('[Service Worker] 緩存資源失敗:', err);
                  }
                })
                .catch(err => {
                  console.error('[Service Worker] 打開緩存失敗:', err);
                });
            } catch (err) {
              console.error('[Service Worker] 處理響應時出錯:', err);
            }
            
            return networkResponse;
          })
          .catch(error => {
            console.log('[Service Worker] 網絡請求失敗:', error);
            
            // 對於特定資源類型可以返回備用內容
            try {
              const extension = url.pathname.split('.').pop().toLowerCase();
              if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'gif') {
                // 如果是圖片，可以返回一個預設圖片
                return caches.match('/icons/icon-192x192.png')
                  .then(fallbackResponse => {
                    if (fallbackResponse) return fallbackResponse;
                    // 如果無法找到預設圖片，返回空白圖片
                    return new Response('',
                      { 
                        status: 200, 
                        statusText: 'OK',
                        headers: { 'Content-Type': 'image/gif', 'Content-Length': '0' }
                      }
                    );
                  });
              } else if (extension === 'js') {
                // 如果是JS，返回一個空的JS響應
                return new Response('console.log("離線模式，部分功能可能不可用");', {
                  headers: { 'Content-Type': 'application/javascript' }
                });
              } else if (extension === 'css') {
                // 如果是CSS，返回一個空的CSS響應
                return new Response('/* 離線模式 */', {
                  headers: { 'Content-Type': 'text/css' }
                });
              }
            } catch (err) {
              console.error('[Service Worker] 創建備用響應失敗:', err);
            }
            
            // 其他資源類型，返回通用錯誤響應
            return new Response('資源暫時無法訪問', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
      .catch(err => {
        console.error('[Service Worker] 緩存匹配出錯:', err);
        // 確保返回有效響應
        return new Response('處理請求時發生錯誤', {
          status: 500,
          statusText: 'Internal Error',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});

// 處理 Service Worker 消息
self.addEventListener('message', event => {
  console.log('[Service Worker] 收到消息:', event.data);
  
  if (!event.data) {
    console.log('[Service Worker] 收到空消息，忽略');
    return; // 忽略空消息
  }
  
  // 處理各種消息類型
  try {
    if (event.data.action === 'skipWaiting') {
      self.skipWaiting();
    }
    
    // 檢查緩存
    if (event.data.action === 'checkCache') {
      caches.keys().then(cacheNames => {
        event.ports[0].postMessage({
          type: 'cacheStatus',
          caches: cacheNames
        });
      }).catch(err => {
        console.error('[Service Worker] 檢查緩存失敗:', err);
        event.ports[0].postMessage({
          type: 'cacheStatus',
          error: err.message
        });
      });
    }
    
    // 清理緩存
    if (event.data.action === 'clearCache') {
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('[Service Worker] 清理緩存:', cacheName);
            return caches.delete(cacheName);
          })
        ).then(() => {
          event.ports[0].postMessage({
            type: 'cacheCleaned'
          });
        });
      }).catch(err => {
        console.error('[Service Worker] 清理緩存失敗:', err);
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'error',
            message: err.message
          });
        }
      });
    }
    
    // 自動更新相關消息
    if (event.data.type === 'REQUEST_UPDATE_CHECK') {
      console.log('[Service Worker] 收到請求更新檢查訊息，執行檢查');
      checkForUpdates();
    } else if (event.data.type === 'GET_VERSION') {
      console.log('[Service Worker] 收到獲取版本訊息');
      if (event.source) {
        console.log(`[Service Worker] 回覆版本信息: ${CACHE_VERSION}, 開發模式: ${DEV_MODE.enabled}`);
        try {
          event.source.postMessage({
            type: 'VERSION_INFO',
            version: CACHE_VERSION,
            devMode: DEV_MODE.enabled,
            lastChecked: DEV_MODE.lastChecked,
            timestamp: Date.now()
          });
          console.log('[Service Worker] 版本信息已發送');
        } catch(e) {
          console.error('[Service Worker] 發送版本信息失敗:', e);
        }
      } else {
        console.error('[Service Worker] 無法回覆版本信息: event.source 不存在');
      }
    }
  } catch (err) {
    console.error('[Service Worker] 處理消息時出錯:', err);
  }
});

// 告知客戶端 Service Worker 已可用
self.addEventListener('activate', async () => {
  // 這裡重複添加事件監聽器是為了確保消息傳遞，實際上這部分邏輯已經在上面處理過
});

// 特殊處理 iOS 設備上的 PWA 緩存問題
if (isIOSDevice()) {
  console.log('[Service Worker] 檢測到 iOS 設備，應用特定的緩存策略');
  // iOS PWA 模式下，localStorage 和 sessionStorage 可能會被清除
  // 注意：在Service Worker中無法訪問localStorage和sessionStorage
  
  // 添加針對 iOS 的額外日誌
  console.log('[Service Worker][iOS] Service Worker 版本:', CACHE_VERSION);
  console.log('[Service Worker][iOS] 用戶代理:', navigator.userAgent);
  
  // 針對 iOS 的定期檢查更新間隔縮短
  if (DEV_MODE.enabled) {
    console.log('[Service Worker][iOS] 為 iOS 設置更頻繁的更新檢查');
    setInterval(() => {
      console.log('[Service Worker][iOS] 執行 iOS 專用定期更新檢查');
      checkForUpdates();
    }, 15000); // iOS 上每15秒檢查一次
  }
}
