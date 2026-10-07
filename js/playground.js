/* =========================================================
   playground.js — 互動測試台
   ========================================================= */

const PG_ENDPOINTS = [
  { name: '1. 路線清單 Route List', desc: '取得所有 KMB 路線（每天 05:00 更新）。',
    path: '/v1/transport/kmb/route/', params: [] },
  { name: '2. 路線 Route', desc: '取得指定路線、方向、服務類型的資料。',
    path: '/v1/transport/kmb/route/{route}/{direction}/{service_type}',
    params: [
      { key: 'route', label: 'route 路線號', value: '74B' },
      { key: 'direction', label: 'direction 方向', type: 'select', options: ['outbound', 'inbound'], value: 'outbound' },
      { key: 'service_type', label: 'service_type 服務類型', type: 'select', options: ['1', '2'], value: '1' },
    ] },
  { name: '3. 站點清單 Stop List', desc: '取得所有巴士站（每天 05:00 更新）。',
    path: '/v1/transport/kmb/stop', params: [] },
  { name: '4. 站點 Stop', desc: '用站點 ID（16 字元）取得站名與座標。',
    path: '/v1/transport/kmb/stop/{stop_id}',
    params: [{ key: 'stop_id', label: 'stop_id 站點 ID', value: 'A3ADFCDF8487ADB9' }] },
  { name: '5. 路線-站點清單 Route-Stop List', desc: '取得所有路線的所有站點（每天 05:00 更新）。',
    path: '/v1/transport/kmb/route-stop', params: [] },
  { name: '6. 路線-站點 Route-Stop', desc: '取得指定路線方向沿途的站點序列。',
    path: '/v1/transport/kmb/route-stop/{route}/{direction}/{service_type}',
    params: [
      { key: 'route', label: 'route 路線號', value: '1A' },
      { key: 'direction', label: 'direction 方向', type: 'select', options: ['outbound', 'inbound'], value: 'outbound' },
      { key: 'service_type', label: 'service_type 服務類型', type: 'select', options: ['1', '2'], value: '1' },
    ] },
  { name: '7. ETA 到站時間（站＋路線）', desc: '指定站點與路線的預計到站時間。',
    path: '/v1/transport/kmb/eta/{stop_id}/{route}/{service_type}',
    params: [
      { key: 'stop_id', label: 'stop_id 站點 ID', value: 'A60AE774B09A5E44' },
      { key: 'route', label: 'route 路線號', value: '40' },
      { key: 'service_type', label: 'service_type 服務類型', type: 'select', options: ['1', '2'], value: '1' },
    ] },
  { name: '8. 站點 ETA Stop ETA', desc: '指定站點「所有路線」的預計到站時間。',
    path: '/v1/transport/kmb/stop-eta/{stop_id}',
    params: [{ key: 'stop_id', label: 'stop_id 站點 ID', value: 'B8B04CD1E568B8F6' }] },
  { name: '9. 路線 ETA Route ETA', desc: '指定路線「兩個方向全程」的預計到站時間。',
    path: '/v1/transport/kmb/route-eta/{route}/{service_type}',
    params: [
      { key: 'route', label: 'route 路線號', value: '3M' },
      { key: 'service_type', label: 'service_type 服務類型', type: 'select', options: ['1', '2'], value: '2' },
    ] },
];

/* 依目前選項與輸入，組出請求路徑 */
function buildPath(ep, values) {
  let p = ep.path;
  ep.params.forEach((pr) => {
    p = p.replace('{' + pr.key + '}', encodeURIComponent(values[pr.key] || ''));
  });
  return p;
}

/* 用「完整網址」送出（可切換官方 / 本機代理） */
async function fetchURL(url) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (e) {}
    return { ok: res.ok, status: res.status, url, ms: Math.round(performance.now() - t0), data, raw };
  } catch (e) {
    return { ok: false, status: 0, url, ms: Math.round(performance.now() - t0), data: null, raw: '', error: String(e.message || e) };
  }
}

function pgPill(r) {
  if (r.status === 0) return `<span class="pill err">連線失敗</span>`;
  return `<span class="pill ${r.ok ? 'ok' : (r.status >= 500 ? 'warn' : 'err')}">HTTP ${r.status}</span>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('pg-endpoint');
  const desc = document.getElementById('pg-desc');
  const paramBox = document.getElementById('pg-params');
  const urlLine = document.getElementById('pg-url');
  const statusLine = document.getElementById('pg-status');
  const out = document.getElementById('pg-out');
  const proxyChk = document.getElementById('pg-proxy');

  // 填入端點下拉
  PG_ENDPOINTS.forEach((ep, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = ep.name;
    sel.appendChild(o);
  });

  function renderParams() {
    const ep = PG_ENDPOINTS[sel.value];
    desc.textContent = ep.desc;
    if (!ep.params.length) {
      paramBox.innerHTML = `<p class="muted">這個端點不需要任何參數，直接送出即可。</p>`;
      return;
    }
    paramBox.innerHTML = ep.params.map((pr) => {
      const id = 'pg-' + pr.key;
      if (pr.type === 'select') {
        const opts = pr.options.map(o =>
          `<option value="${o}" ${o === pr.value ? 'selected' : ''}>${o}</option>`).join('');
        return `<div class="field"><label for="${id}">${esc(pr.label)}</label>
          <select id="${id}">${opts}</select></div>`;
      }
      return `<div class="field"><label for="${id}">${esc(pr.label)}</label>
        <input type="text" id="${id}" value="${esc(pr.value)}"></div>`;
    }).join('');
  }

  function collect() {
    const ep = PG_ENDPOINTS[sel.value];
    const values = {};
    ep.params.forEach((pr) => {
      const el = document.getElementById('pg-' + pr.key);
      values[pr.key] = el ? el.value.trim() : '';
    });
    return values;
  }

  sel.addEventListener('change', () => {
    renderParams(); out.innerHTML = '';
    statusLine.textContent = '尚未送出請求。'; urlLine.textContent = '';
  });

  document.getElementById('pg-clear').addEventListener('click', () => {
    out.innerHTML = ''; statusLine.textContent = '已清除。'; urlLine.textContent = '';
  });

  document.getElementById('pg-send').addEventListener('click', async () => {
    const ep = PG_ENDPOINTS[sel.value];
    const path = buildPath(ep, collect());

    let base = KMB_BASE;
    if (proxyChk.checked) {
      if (location.protocol === 'file:') {
        statusLine.innerHTML = `<span class="pill err">無法使用代理</span> 你現在是用「檔案」方式開啟網頁，請改用 <code>node server.js</code> 後的 http://localhost:3000`;
        return;
      }
      base = location.origin + '/kmb';
    }
    const url = base + path;

    urlLine.innerHTML = `<span class="m">GET</span> <span class="p">${esc(url)}</span>`;
    statusLine.innerHTML = `<span class="spinner"></span> 請求中…`;
    out.innerHTML = '';

    const r = await fetchURL(url);
    if (r.status === 0) {
      statusLine.innerHTML = `${pgPill(r)} ${esc(r.error || '')}`;
      out.innerHTML = `<div class="warn">連線失敗。可能原因：沒有上網、被防火牆阻擋，或（使用代理時）沒有先啟動 <code>node server.js</code>。</div>`;
      return;
    }
    statusLine.innerHTML = `${pgPill(r)}　耗時 ${r.ms} ms　回應大小約 ${(r.raw.length / 1024).toFixed(1)} KB`;

    const text = r.data ? pretty(r.data) : (r.raw || '(沒有內容)');
    out.innerHTML = `
      <div class="code-head"><span>回應內容（JSON）</span></div>
      <pre class="code">${highlightJSON(text)}</pre>`;
  });

  renderParams();
});

