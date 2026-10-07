# KMB Bus API 學習站 🚌

一個給「完全不懂 API 的新手」的免費教學網站。用香港九巴（KMB）／龍運（LWB）官方公開的**實時到站資料 API**，
由淺入深學會 API，最後做出一個真的能用的「巴士到站時間 App」。

資料來源：[data.etabus.gov.hk](https://data.etabus.gov.hk)（依官方兩份 PDF 規格整理）。

> 🌐 **線上版（GitHub Pages）**：<https://betatalau.github.io/kmb-bus-api/>
> 用 iPhone 的 Safari 打開 → 分享 → 加入主畫面，即可當 App 使用。

---

## 一、怎麼用？（最簡單）

**方法 A：直接雙擊開啟（免安裝、免設定）**

1. 用檔案總管打開這個資料夾。
2. 雙擊 `index.html`（用 Chrome / Edge / Firefox 都可以）。

因為九巴 API 允許跨來源存取，瀏覽器可以直接呼叫它，所以**不用任何伺服器就能運作**。

> ⚠️ 若你的瀏覽器因為 `file://` 安全性限制而擋住請求，改用下面「方法 B」。

**方法 B：用附帶的小伺服器（推薦）**

需要電腦已安裝 Node.js。在資料夾開一個終端機（PowerShell）輸入：

```powershell
node server.js
```

然後在瀏覽器打開 <http://localhost:3000>。

---

## 二、網站包含什麼

| 頁面 | 內容 |
|------|------|
| `index.html` | 首頁 + 學習路線圖 + API 總覽 |
| `tutorial.html` | **15 章教學**（由淺入深），每章有可互動的實戰按鈕 |
| `playground.html` | **互動測試台**：選端點、填參數、送出、看 JSON |
| `bus-app.html` | **實用巴士 App**：查路線 → 看站點 → 即時到站（30 秒自動更新） |
| `api-reference.html` | **API 參考文件**：端點與欄位對照表（整理自兩份 PDF） |

### 教學 15 章
1. 什麼是 API？（餐廳比喻）
2. 認識 HTTP 請求（方法 / URL / 參數 / 標頭）
3. 什麼是 JSON？
4. 你的第一個請求（動手按）
5. 路徑與參數
6. 狀態碼與錯誤處理
7. 用瀏覽器 F12 觀察 API（開發者工具）
8. 用 JavaScript 呼叫 API
9. 組合實戰：做一個到站 App
10. 進階：打造自己的 API（代理伺服器）
11. 一次呼叫的完整解剖（請求 4 要素 × 回應 3 要素）
12. HTTP 動詞與 CRUD（＋常用狀態碼一覽）
13. Headers 與認證（API Key／Token／mTLS）
14. 同步 vs 非同步（＋JSON Path）
15. 讀懂 API 規格書（＋名詞小辭典、記住 3 句話）

### 教學頁內建的可動手「小介面」
除了文字，最相關的章節還內建了可以直接輸入／修改、按下去就送出的「實驗室」。**故意輸入錯誤也會示範 ERROR**：

| 章節 | 小介面 | 玩什麼 |
|------|--------|--------|
| 第 4 章 | 🧪 網址實驗室 | 自己改 API 網址並送出，立刻看到狀態碼與回應（改錯 → 422 / 連線失敗） |
| 第 12 章 | 🎛️ 動詞實驗室 | 前端模擬 API，練習 GET/POST/PUT/DELETE 與 200/201/400/404/405/409/422 |
| 第 13 章 | 🔐 認證模擬器 | 切換是否帶 `Authorization` 標頭，示範 401 Unauthorized |
| 第 14 章 | 🔎 JSON Path 探索器 | 輸入 `$.` 路徑查值，欄位打錯會提示「找不到」 |

---

## 三、資料夾結構

```
Bus API/
├─ index.html            首頁
├─ tutorial.html         15 章教學
├─ playground.html       互動測試台
├─ bus-app.html          實時到站 App
├─ api-reference.html    API 參考文件
├─ css/style.css         共用樣式
├─ js/
│  ├─ common.js          API 封裝、導覽列、工具函式
│  ├─ tutorial.js        教學頁互動
│  ├─ playground.js      測試台邏輯
│  └─ bus-app.js         巴士 App 邏輯
├─ server.js             選用：本機伺服器 + API 代理
└─ (原始 PDF 兩份)
```

---

## 四、這個 API 有哪些端點

基底網址：`https://data.etabus.gov.hk`

| # | 功能 | 端點 |
|---|------|------|
| 1 | 全部路線 | `GET /v1/transport/kmb/route/` |
| 2 | 指定路線 | `GET /v1/transport/kmb/route/{route}/{direction}/{service_type}` |
| 3 | 全部站點 | `GET /v1/transport/kmb/stop` |
| 4 | 指定站點 | `GET /v1/transport/kmb/stop/{stop_id}` |
| 5 | 全部路線-站點 | `GET /v1/transport/kmb/route-stop` |
| 6 | 指定路線站點 | `GET /v1/transport/kmb/route-stop/{route}/{direction}/{service_type}` |
| 7 | 站＋路線 到站時間 | `GET /v1/transport/kmb/eta/{stop_id}/{route}/{service_type}` |
| 8 | 站（全部路線）到站時間 | `GET /v1/transport/kmb/stop-eta/{stop_id}` |
| 9 | 路線（兩方向）到站時間 | `GET /v1/transport/kmb/route-eta/{route}/{service_type}` |

- `direction` 用 `outbound` / `inbound`（回傳資料裡的方向欄位是 `O` / `I`）。
- 狀態碼：`200` 成功、`422` 參數錯誤、`500` 伺服器錯誤。

---

## 五、server.js 額外提供的端點

| 端點 | 說明 |
|------|------|
| `http://localhost:3000/kmb/...` | 代理到九巴官方 API（示範「自己蓋一層 API」） |
| `http://localhost:3000/api/hello` | 自建 API 範例，回傳你自己的 JSON |

改 `PORT` 環境變數即可換埠，例如：`$env:PORT=8080; node server.js`

---

## 六、安裝成 App（PWA）🚀

這個網站已支援 **PWA**，可以直接「加到主畫面」當作 App 使用（**免 App Store、免 Mac、免 $99**）：

**iPhone / iPad**
1. 用 **Safari** 開啟網站網址（需 `https://`）。
2. 點下方「**分享**」圖示。
3. 選「**加入主畫面**」→ 命名 → 完成。
4. 桌面即出現「KMB Bus」圖示，點開是全螢幕、可離線開啟外框。

**Android / 電腦（Chrome / Edge）**
- 網址列右側會出現「安裝」圖示，或由選單選「安裝應用程式 / 加到主畫面」。

> ⚠️ Service Worker 需要 `https://` 或 `http://localhost`。用 `file://` 直接開啟時 PWA 不會啟用（但網站功能仍正常）。要測試請先跑 `node server.js` 開 <http://localhost:3000>。

**PWA 相關檔案**：`manifest.webmanifest`、`sw.js`、`icons/`（App 圖示）。

---

## 七、備註

- 本網站純屬教學示範，非九巴官方網站。
- 資料版權屬 KMB / LWB 所有，請遵守其開放資料使用條款。
