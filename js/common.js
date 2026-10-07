/* =========================================================
   common.js — 全站共用工具
   1) KMB 官方 API 端點與呼叫封裝
   2) 導覽列自動注入
   3) JSON 語法高亮、時間格式化、複製按鈕
   ========================================================= */

/* ---------- 1. 官方 API 設定（整理自 API Specifications PDF） ---------- */
const KMB_BASE = 'https://data.etabus.gov.hk';

const Endpoints = {
  // 路線清單：所有 KMB 路線
  routeList:      ()                    => '/v1/transport/kmb/route/',
  // 單一路線：方向用 outbound / inbound
  route:          (route, dir, st)      => `/v1/transport/kmb/route/${route}/${dir}/${st}`,
  // 站點清單：所有巴士站
  stopList:       ()                    => '/v1/transport/kmb/stop',
  // 單一站點
  stop:           (stopId)              => `/v1/transport/kmb/stop/${stopId}`,
  // 路線-站點清單：所有路線的所有站
  routeStopList:  ()                    => '/v1/transport/kmb/route-stop',
  // 某路線方向的站點序列
  routeStop:      (route, dir, st)      => `/v1/transport/kmb/route-stop/${route}/${dir}/${st}`,
  // 某站某路線的到站時間
  eta:            (stopId, route, st)   => `/v1/transport/kmb/eta/${stopId}/${route}/${st}`,
  // 某站所有路線的到站時間
  stopEta:        (stopId)              => `/v1/transport/kmb/stop-eta/${stopId}`,
  // 某路線（兩個方向全程）的到站時間
  routeEta:       (route, st)           => `/v1/transport/kmb/route-eta/${route}/${st}`,
};

/* 呼叫 KMB API，回傳一個「完整」的結果物件，方便教學示範觀察每個欄位 */
async function kmbFetch(path) {
  const url = KMB_BASE + path;
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const ms = Math.round(performance.now() - t0);
    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (e) { /* 非 JSON */ }
    return { ok: res.ok, status: res.status, url, ms, data, raw };
  } catch (err) {
    return {
      ok: false, status: 0, url,
      ms: Math.round(performance.now() - t0),
      data: null, raw: '', error: String(err && err.message ? err.message : err),
    };
  }
}

/* ---------- 2. 導覽列與頁尾自動注入 ---------- */
const NAV_ITEMS = [
  { href: 'index.html',         label: '首頁' },
  { href: 'tutorial.html',      label: '教學' },
  { href: 'playground.html',    label: '互動測試台' },
  { href: 'bus-app.html',       label: '巴士 App' },
  { href: 'api-reference.html', label: 'API 文件' },
];

function injectChrome() {
  const page = document.body.dataset.page || '';
  const links = NAV_ITEMS.map(it =>
    `<a href="${it.href}" class="${it.href === page ? 'active' : ''}">${it.label}</a>`
  ).join('');

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <nav class="nav">
      <a class="brand" href="index.html">
        <span class="logo">巴</span>
        <span>KMB Bus API 學習站</span>
      </a>
      <div class="nav-links">${links}</div>
    </nav>`;
  document.body.insertBefore(header, document.body.firstChild);

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="inner">
      <p><strong>KMB Bus API 學習站</strong> — 由零開始學會呼叫 API，並用九巴／龍運實時到站資料做實戰。</p>
      <p class="muted">資料來源：KMB / LWB Open Data（data.etabus.gov.hk）。本網站為教學示範，非官方網站。</p>
    </div>`;
  document.body.appendChild(footer);
}

/* ---------- 3. 小工具 ---------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pretty(obj) {
  try { return JSON.stringify(obj, null, 2); }
  catch (e) { return String(obj); }
}

/* JSON 字串 → 有顏色的 HTML（簡單版高亮） */
function highlightJSON(json) {
  const s = esc(json);
  return s.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
    (m) => {
      let cls = 'num';
      if (/^"/.test(m)) cls = /:$/.test(m) ? 'key' : 'str';
      else if (/true|false/.test(m)) cls = 'tag';
      else if (/null/.test(m)) cls = 'punct';
      return `<span class="${cls}">${m}</span>`;
    }
  );
}

/* ISO 時間 → 香港時間 HH:MM:SS */
function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleTimeString('zh-HK', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Hong_Kong',
  });
}

/* 距離現在幾分鐘（可為負 -> 已過）*/
function minutesUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return Math.round((d.getTime() - Date.now()) / 60000);
}

/* 方向代碼轉中文：bound/dir 用的是 O / I */
function dirName(code) {
  const c = String(code || '').toUpperCase();
  if (c === 'O' || c.startsWith('OUT')) return '去程 Outbound';
  if (c === 'I' || c.startsWith('IN')) return '回程 Inbound';
  return code || '—';
}

/* 把 bound（O/I）轉成 path 用的方向（outbound/inbound）*/
function toPathDir(boundOrDir) {
  const c = String(boundOrDir || '').toUpperCase();
  return c.startsWith('I') ? 'inbound' : 'outbound';
}

/* 判斷回應的 data 是否「查無資料」（空物件 / 空陣列 / 不存在）
   注意：KMB 對「參數合法但查無資料」會回 200 + 空 data，而不是錯誤碼。 */
function isEmptyData(data) {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') return Object.keys(data).length === 0;
  return false;
}

document.addEventListener('DOMContentLoaded', injectChrome);


/* ---------- 4. API 請求記錄（頁面內建「迷你版 F12 Network」） ----------
   把 window.fetch 包一層，凡是「本站發出」的請求都會被記錄下來，
   再畫進頁面上的 #req-log-body 面板（若該頁有這個元素）。 */
const RequestLog = {
  max: 60,
  seq: 0,
  entries: [],
  listeners: [],
  add(entry) {
    this.seq += 1;
    this.entries.unshift(Object.assign({ n: this.seq }, entry));
    if (this.entries.length > this.max) this.entries.length = this.max;
    this.emit();
  },
  clear() { this.entries = []; this.emit(); },
  subscribe(fn) { this.listeners.push(fn); fn(this.entries); },
  emit() { this.listeners.forEach((fn) => fn(this.entries)); },
};

/* 安裝 fetch 記錄器（在 common.js 載入時就執行，早於其他頁面程式） */
function installFetchLogger() {
  if (window.__reqLogInstalled || typeof window.fetch !== 'function') return;
  window.__reqLogInstalled = true;
  const orig = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : ((input && input.url) || String(input));
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    const t0 = performance.now();
    try {
      const res = await orig(input, init);
      const cl = res.headers.get('content-length');   // Content-Length 是 CORS 可讀的安全標頭
      RequestLog.add({
        url, method, status: res.status, ok: res.ok,
        ms: Math.round(performance.now() - t0),
        bytes: cl == null ? null : parseInt(cl, 10),
      });
      return res;
    } catch (err) {
      RequestLog.add({
        url, method, status: 0, ok: false,
        ms: Math.round(performance.now() - t0), bytes: null,
        error: String(err && err.message ? err.message : err),
      });
      throw err;
    }
  };
}
installFetchLogger();

/* 把完整網址縮短成好讀的路徑（去掉官方網域 / 本機 origin） */
function shortUrl(url) {
  return String(url)
    .replace(KMB_BASE, '')
    .replace(location.origin + '/kmb', '/kmb')
    .replace(location.origin, '');
}

/* 依狀態碼產生彩色標籤（共用給請求記錄面板） */
function httpPill(status, ok) {
  if (status === 0) return `<span class="pill err">連線失敗</span>`;
  const cls = ok ? 'ok' : (status >= 500 ? 'warn' : 'err');
  return `<span class="pill ${cls}">HTTP ${status}</span>`;
}

/* 把請求記錄畫進 #req-log-body（若頁面沒有這個元素就略過） */
function initRequestLog() {
  const body = document.getElementById('req-log-body');
  if (!body) return;
  const countEl = document.getElementById('req-log-count');
  const clearBtn = document.getElementById('req-log-clear');

  function row(e) {
    const size = e.bytes == null ? '—' : (e.bytes / 1024).toFixed(1) + ' KB';
    return `<div class="req-row">
      <span class="n">#${e.n}</span>
      <span class="m">${esc(e.method)}</span>
      <span class="u">${esc(shortUrl(e.url))}</span>
      <span>${httpPill(e.status, e.ok)}</span>
      <span class="meta">${e.ms} ms</span>
      <span class="meta">${size}</span>
    </div>`;
  }

  function render(list) {
    if (countEl) countEl.textContent = list.length ? `共 ${list.length} 筆（最新在上）` : '';
    body.innerHTML = list.length
      ? list.map(row).join('')
      : `<div class="req-empty">還沒有任何請求。按上面的按鈕送出一次，這裡就會出現記錄。</div>`;
  }

  if (clearBtn) clearBtn.addEventListener('click', () => RequestLog.clear());
  RequestLog.subscribe(render);
}
document.addEventListener('DOMContentLoaded', initRequestLog);


/* ---------- 5. 複製程式碼按鈕 ---------- */
function copyCode(btn) {
  const target = document.getElementById(btn.dataset.copy);
  if (!target) return;
  const text = target.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const old = btn.textContent;
    btn.textContent = '已複製 ✓';
    setTimeout(() => { btn.textContent = old; }, 1400);
  }).catch(() => {
    btn.textContent = '複製失敗';
    setTimeout(() => { btn.textContent = '複製'; }, 1400);
  });
}

/* 產生一個附「複製」鈕的程式碼區塊（動態建立用）*/
function codeBlockHTML(id, label, code) {
  return `
    <div class="code-head"><span>${esc(label)}</span>
      <button class="copy-btn" data-copy="${id}" onclick="copyCode(this)">複製</button></div>
    <pre class="code" id="${id}">${esc(code)}</pre>`;
}

/* ---------- 6. 註冊 Service Worker（PWA：可加到主畫面、可離線）---------- */
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* file:// 或舊瀏覽器：忽略 */ });
  });
}

