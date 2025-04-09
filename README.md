# home-otp

這是一個簡易的門禁系統，使用 TOTP 驗證與管理員後台進行使用者與行為紀錄管理。

This project is for Cloudflare Workers!

## 特色
- 提供管理員後台，可管理使用者、查看日誌
- 支援管理員多帳號、密碼與信箱管理

## 安裝與執行
1. 安裝相依套件：
   ```
   npm install
   ```
2. 執行開發伺服器：
   ```
   npm run dev
   ```
3. 使用瀏覽器開啟對應網址查看系統介面。

## 進階設定
1. 如需替換 Turnstile 金鑰或其他外部服務憑證，請在 wrangler.toml 或相關環境變數中進行設定。
2. 可以直接修改 .gitignore 來排除不想提交至版本控制的檔案，例如憑證、部署設定等。

## 部署流程
1. 若要在 Cloudflare Workers 上部署，請先安裝 wrangler。
   ```
   npm install -g wrangler
   ```
2. 登入並設定 Cloudflare 帳號後，於專案根目錄執行：
   ```
   wrangler publish
   ```
3. 部署完成後，即可使用自動分配的子網域存取門禁系統。

## 系統使用方式
1. 管理員可透過 /login.html 登入後台，新增使用者與查看驗證日誌。
2. 一般使用者透過 /otp.html 執行動態碼功能，以產生並掃描 TOTP QR 碼實現驗證。
3. 所有 API 端點均位於 /api/ 路徑，需先經過登入並持有有效的 session Cookie。

## 常見問題
- 遇到無法登入後台或忘記密碼時，可參考預設管理員帳號 (admin / admin123) 進行登入，並於登入後立即重新設定安全密碼。
- 如需重置資料庫結構，請清除舊的 D1 資料庫後重新部署即可。

## 貢獻
歡迎提出 issue 或 pull request，讓此專案更臻完善。

## TODO
- 讓Session長期化(三個月)，但要可以遠端關閉Session、顯示IP、時間等安全性的功能 (session.html)
- 遠端控制scanner運作時間、運作狀態 (scanner.html)
- 新增一個強制開門的裝置
- 把secret key用env變數儲存