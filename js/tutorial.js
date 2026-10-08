/* =========================================================
   tutorial.js — 教學頁各章的互動示範
   依賴 common.js（kmbFetch / Endpoints / esc / pretty / highlightJSON）
   ========================================================= */

/* 顯示狀態碼的彩色標籤 */
function statusPill(r) {
  if (r.status === 0) return `<span class="pill err">連線失敗</span>`;
  const cls = r.ok ? 'ok' : (r.status >= 500 ? 'warn' : 'err');
  return `<span class="pill ${cls}">HTTP ${r.status}</span>`;
}

/* 顯示一段 JSON 回應 */
function jsonBox(title, obj, raw) {
  const text = obj ? pretty(obj) : (raw || '(沒有內容)');
  return `
    <div class="code-head"><span>${esc(title)}</span></div>
    <pre class="code">${highlightJSON(text)}</pre>`;
}

/* ---------- 實驗室共用工具 ---------- */

/* 送出「任意完整網址」（不補 KMB_BASE），回傳結構與 kmbFetch 相同 */
async function labFetch(url) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (e) { /* 非 JSON */ }
    return { ok: res.ok, status: res.status, url, ms: Math.round(performance.now() - t0), data, raw };
  } catch (err) {
    return {
      ok: false, status: 0, url, ms: Math.round(performance.now() - t0),
      data: null, raw: '', error: String(err && err.message ? err.message : err),
    };
  }
}

/* 依狀態碼給一句「這是誰的問題」 */
function httpCulprit(status) {
  if (status === 0) return '這不是 HTTP 錯誤，而是「連不上」——通常是網址打錯、沒有網絡，或被瀏覽器的 CORS 安全機制擋下。';
  if (status >= 500) return '5xx：對方（伺服器）的問題，通常只能等或重試。';
  if (status >= 400) return '4xx：你（請求方）的問題，回頭檢查自己送出的東西。';
  if (status >= 300) return '3xx：重新導向。';
  if (status >= 200) return '2xx：成功。';
  return '1xx：資訊性回應。';
}

/* 解析簡易 JSON Path（支援 $.a.b 與 $.a[0].b），錯誤時回 { ok:false, error } */
function resolveJSONPath(root, exprRaw) {
  const expr = String(exprRaw == null ? '' : exprRaw).trim();
  if (!expr) return { ok: false, error: '請先輸入一個 JSON Path，例如 $.data.route' };
  if (expr[0] !== '$') return { ok: false, error: 'JSON Path 要以 $ 開頭，例如 $.data.route' };
  if (expr === '$') return { ok: true, value: root };
  if (expr[1] !== '.' && expr[1] !== '[') return { ok: false, error: '語法看起來怪怪的，應該是 $.a.b 或 $.a[0].b 這種寫法' };
  const re = /\[\s*(\d+)\s*\]|\.([A-Za-z_$][\w$]*)/g;
  re.lastIndex = 1;
  const tokens = [];
  let consumed = 1, m;
  while ((m = re.exec(expr)) !== null) {
    if (m.index !== consumed) return { ok: false, error: '語法看起來怪怪的，應該是 $.a.b 或 $.a[0].b 這種寫法' };
    consumed = re.lastIndex;
    tokens.push(m[1] != null ? Number(m[1]) : m[2]);
  }
  if (consumed !== expr.length) return { ok: false, error: '語法看起來怪怪的，應該是 $.a.b 或 $.a[0].b 這種寫法' };
  let cur = root;
  for (const t of tokens) {
    if (typeof t === 'number') {
      if (!Array.isArray(cur)) return { ok: false, error: `[${t}] 不是陣列，不能用索引` };
      if (t >= cur.length) return { ok: false, error: `索引 [${t}] 超出範圍（這個陣列只有 ${cur.length} 筆）` };
      cur = cur[t];
    } else {
      if (cur === null || typeof cur !== 'object') return { ok: false, error: `取不到「${t}」：上一層不是物件` };
      if (!Object.prototype.hasOwnProperty.call(cur, t)) return { ok: false, error: `找不到欄位「${t}」` };
      cur = cur[t];
    }
  }
  return { ok: true, value: cur };
}

document.addEventListener('DOMContentLoaded', () => {
  /* -------- 第 4 章：第一個請求（路線清單） -------- */
  const btnFirst = document.getElementById('btn-first');
  if (btnFirst) {
    btnFirst.addEventListener('click', async () => {
      const status = document.getElementById('first-status');
      const out = document.getElementById('first-out');
      status.innerHTML = `<span class="spinner"></span> 正在向九巴要資料…`;
      out.innerHTML = '';

      const r = await kmbFetch(Endpoints.routeList());
      if (!r.ok) {
        status.innerHTML = `${statusPill(r)} 花了 ${r.ms} ms`;
        out.innerHTML = jsonBox('錯誤回應', r.data, r.raw);
        return;
      }
      const list = r.data.data || [];
      status.innerHTML = `${statusPill(r)}　共 <b>${list.length}</b> 筆路線　花了 ${r.ms} ms`;

      const rows = list.slice(0, 8).map(x => `
        <tr><td><code>${esc(x.route)}</code></td><td>${esc(dirName(x.bound))}</td>
        <td>${esc(x.orig_tc)}</td><td>${esc(x.dest_tc)}</td></tr>`).join('');
      out.innerHTML = `
        <p class="muted" style="margin-top:10px">以下是頭 8 筆（共 ${list.length} 筆）：</p>
        <table class="data">
          <tr><th>路線</th><th>方向</th><th>起點</th><th>目的地</th></tr>
          ${rows}
        </table>`;
    });
  }

  /* -------- 第 5 章：查指定路線（Route API） -------- */
  const btn5 = document.getElementById('ch5-go');
  if (btn5) {
    btn5.addEventListener('click', async () => {
      const route = document.getElementById('ch5-route').value.trim();
      const dir   = document.getElementById('ch5-dir').value;
      const st    = document.getElementById('ch5-st').value;
      const status = document.getElementById('ch5-status');
      const out = document.getElementById('ch5-out');
      status.innerHTML = `<span class="spinner"></span> 查詢中…`;
      out.innerHTML = '';

      const r = await kmbFetch(Endpoints.route(route, dir, st));
      status.innerHTML = `${statusPill(r)}　${esc(r.url)}　花 ${r.ms} ms`;
      if (!r.ok) { out.innerHTML = jsonBox('錯誤回應', r.data, r.raw); return; }

      const d = r.data.data;
      if (isEmptyData(d)) {
        out.innerHTML = `<div class="warn">狀態碼 200，但查無此路線／組合（data 是空的）。請確認路線號、方向、服務類型是否正確。</div>`
          + jsonBox('完整回應', r.data);
        return;
      }
      out.innerHTML = `
        <div class="note" style="margin-top:10px">
          <strong>${esc(d.route)}（${esc(dirName(d.bound))}）</strong>
          ${esc(d.orig_tc)} → ${esc(d.dest_tc)}
        </div>` + jsonBox('完整回應', r.data);
    });
  }

  /* -------- 第 6 章：兩種「得不到資料」的比較 -------- */
  const btn6bad = document.getElementById('ch6-422');
  if (btn6bad) {
    btn6bad.addEventListener('click', async () => {
      const status = document.getElementById('ch6-status');
      const out = document.getElementById('ch6-out');
      status.innerHTML = `<span class="spinner"></span> 送出一個「方向不合法」的請求…`;
      out.innerHTML = '';
      // 方向只有 outbound / inbound，這裡故意用 sideways
      const r = await kmbFetch(Endpoints.route('74B', 'sideways', '1'));
      status.innerHTML = `${statusPill(r)}　${esc(r.url)}`;
      out.innerHTML = jsonBox('伺服器回應', r.data, r.raw) + `
        <p class="muted">👆 方向拼錯 → 狀態碼 <b>422</b>，內容只有 <code>code</code> 與 <code>message</code>。</p>`;
    });
  }

  const btn6empty = document.getElementById('ch6-empty');
  if (btn6empty) {
    btn6empty.addEventListener('click', async () => {
      const status = document.getElementById('ch6-status');
      const out = document.getElementById('ch6-out');
      status.innerHTML = `<span class="spinner"></span> 送出一個「不存在但格式合法」的路線…`;
      out.innerHTML = '';
      // 路線號 999XYZ 不存在，但格式合法 → 回 200 + 空 data
      const r = await kmbFetch(Endpoints.route('999XYZ', 'outbound', '1'));
      const empty = r.data && isEmptyData(r.data.data);
      status.innerHTML = `${statusPill(r)}　${esc(r.url)}`;
      out.innerHTML = jsonBox('伺服器回應', r.data, r.raw) + `
        <p class="muted">👆 狀態碼是 <b>200</b>（成功），但 <code>data</code> 是空的 ${empty ? '→ 代表<b>查無此路線</b>。' : ''}
        所以程式要另外判斷 data 是否為空。</p>`;
    });
  }

  /* -------- 第 7 章：用 F12 觀察 API（示範請求） -------- */
  const btnF12 = document.getElementById('f12-go');
  if (btnF12) {
    btnF12.addEventListener('click', async () => {
      const status = document.getElementById('f12-status');
      const out = document.getElementById('f12-out');
      status.innerHTML = `<span class="spinner"></span> 正在送出請求…（記得先開 F12 → Network）`;
      out.innerHTML = '';

      const r = await kmbFetch(Endpoints.routeList());
      status.innerHTML = `${statusPill(r)}　${esc(r.url)}　耗時 ${r.ms} ms`;
      const list = (r.data && r.data.data) || [];
      out.innerHTML = `<p class="muted" style="margin-top:8px">這次請求已經留在 Network 面板（以及下方「請求記錄」）中。回應共 ${Array.isArray(list) ? list.length : 0} 條路線。</p>`;
    });
  }

  /* -------- 第 8 章：輸入路線，顯示目的地 -------- */
  const btn7 = document.getElementById('ch8-go');
  if (btn7) {
    btn7.addEventListener('click', async () => {
      const route = document.getElementById('ch8-route').value.trim();
      const status = document.getElementById('ch8-status');
      const out = document.getElementById('ch8-out');
      if (!route) { status.textContent = '請先輸入路線號。'; return; }
      status.innerHTML = `<span class="spinner"></span> 查詢中…`;
      out.innerHTML = '';

      const r = await kmbFetch(Endpoints.route(route, 'outbound', '1'));
      if (!r.ok) {
        status.innerHTML = statusPill(r);
        out.innerHTML = `<div class="warn">查不到路線 <b>${esc(route)}</b>（HTTP ${r.status}）。可能：路線號打錯、或這條線這個方向沒有服務。</div>`;
        return;
      }
      const d = r.data.data;
      if (isEmptyData(d)) {
        status.innerHTML = `${statusPill(r)}　花 ${r.ms} ms`;
        out.innerHTML = `<div class="warn">狀態碼 200，但查無路線 <b>${esc(route)}</b>（data 是空的）。這條線可能沒有 outbound / 服務類型 1 的班次。</div>`;
        return;
      }
      status.innerHTML = `${statusPill(r)}　花 ${r.ms} ms`;
      out.innerHTML = `
        <div class="note" style="margin-top:10px">
          <strong>路線 ${esc(d.route)}：${esc(d.orig_tc)} → ${esc(d.dest_tc)}</strong>
          服務類型 ${esc(d.service_type)}、方向 ${esc(dirName(d.bound))}
        </div>`;
    });
  }

  /* -------- 第 4 章：網址實驗室（自由改網址、真呼叫） -------- */
  const ulGo = document.getElementById('ul-go');
  if (ulGo) {
    const ulUrl = document.getElementById('ul-url');
    const ulStatus = document.getElementById('ul-status');
    const ulOut = document.getElementById('ul-out');

    document.querySelectorAll('.ul-sample').forEach(b => b.addEventListener('click', () => {
      ulUrl.value = b.dataset.url;
      ulStatus.textContent = '已套用範例，按「送出這個網址」看看結果。';
      ulOut.innerHTML = '';
    }));

    ulGo.addEventListener('click', async () => {
      const url = ulUrl.value.trim();
      ulOut.innerHTML = '';
      if (!url) { ulStatus.innerHTML = '<span class="pill err">未送出</span> 請先輸入一個網址。'; return; }
      if (!/^https?:\/\//i.test(url)) {
        ulStatus.innerHTML = '<span class="pill err">未送出</span> 網址要以 <code>https://</code> 開頭。';
        return;
      }
      ulStatus.innerHTML = `<span class="spinner"></span> 送出中…`;
      const r = await labFetch(url);
      ulStatus.innerHTML = `${statusPill(r)}　${esc(r.url)}　花 ${r.ms} ms`;
      if (r.status === 0) {
        ulOut.innerHTML = `<div class="warn"><strong>連線失敗</strong>${esc(r.error || '')}<br>${httpCulprit(0)}</div>`;
        return;
      }
      ulOut.innerHTML = `<div class="${r.ok ? 'tip' : 'warn'}">${httpCulprit(r.status)}</div>` + jsonBox('伺服器回應', r.data, r.raw);
    });
  }

  /* -------- 第 12 章：動詞實驗室（前端模擬 API） -------- */
  const vlGo = document.getElementById('vl-go');
  if (vlGo) {
    const vlMethod = document.getElementById('vl-method');
    const vlPath = document.getElementById('vl-path');
    const vlBodyWrap = document.getElementById('vl-body-wrap');
    const vlBody = document.getElementById('vl-body');
    const vlStatus = document.getElementById('vl-status');
    const vlOut = document.getElementById('vl-out');
    const seed = () => ([{ route: '74B', dest_tc: '觀塘碼頭' }, { route: '1A', dest_tc: '中秀茂坪' }]);
    let vlDB = seed();

    const simPill = (s) => `<span class="pill ${s >= 200 && s < 300 ? 'ok' : (s >= 500 ? 'warn' : 'err')}">HTTP ${s}</span>`;

    function simServer(method, path, rawBody) {
      const segs = path.split('/').filter(Boolean);
      const id = segs[2];
      if (!(segs[0] === 'api' && segs[1] === 'routes')) {
        return { status: 404, body: { error: 'Not Found', message: `找不到這個路徑：${path}` } };
      }
      if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
        return { status: 405, body: { error: 'Method Not Allowed', message: `這個資源不支援 ${method}，請改用 GET / POST / PUT / DELETE。` } };
      }
      if (method === 'GET') {
        if (!id) return { status: 200, body: { type: 'RouteList', data: vlDB } };
        const found = vlDB.find(x => x.route === id);
        return found
          ? { status: 200, body: { type: 'Route', data: found } }
          : { status: 404, body: { error: 'Not Found', message: `找不到路線 ${id}` } };
      }
      let body = null;
      if (method !== 'DELETE') {
        if (!rawBody.trim()) return { status: 400, body: { error: 'Bad Request', message: '缺少 Request Body' } };
        try { body = JSON.parse(rawBody); }
        catch (e) { return { status: 400, body: { error: 'Bad Request', message: 'Request Body 不是合法的 JSON：' + e.message } }; }
      }
      if (method === 'POST') {
        if (!body || !body.route) return { status: 422, body: { error: 'Unprocessable Entity', message: '缺少必填欄位 route' } };
        if (vlDB.some(x => x.route === body.route)) return { status: 409, body: { error: 'Conflict', message: `路線 ${body.route} 已存在，不能重複新增` } };
        vlDB.push({ route: body.route, dest_tc: body.dest_tc || '' });
        return { status: 201, body: { message: '已新增路線', data: body } };
      }
      if (!id) return { status: 400, body: { error: 'Bad Request', message: `${method} 必須指定資源 id，例如 /api/routes/74B` } };
      const idx = vlDB.findIndex(x => x.route === id);
      if (idx < 0) return { status: 404, body: { error: 'Not Found', message: `找不到路線 ${id}` } };
      if (method === 'PUT') {
        vlDB[idx] = Object.assign({}, vlDB[idx], body);
        return { status: 200, body: { message: '已更新路線', data: vlDB[idx] } };
      }
      vlDB.splice(idx, 1);
      return { status: 200, body: { message: '已刪除路線', route: id } };
    }

    function vlToggleBody() { vlBodyWrap.classList.toggle('hidden', !['POST', 'PUT'].includes(vlMethod.value)); }
    vlMethod.addEventListener('change', () => { vlToggleBody(); vlOut.innerHTML = ''; vlStatus.textContent = ''; });
    document.getElementById('vl-reset').addEventListener('click', () => {
      vlDB = seed();
      vlStatus.innerHTML = '<span class="pill ok">已重設</span> 示範資料已還原成最初兩筆。';
      vlOut.innerHTML = '';
    });
    vlGo.addEventListener('click', () => {
      const method = vlMethod.value;
      const path = vlPath.value;
      const res = simServer(method, path, vlBody.value);
      vlStatus.innerHTML = `${simPill(res.status)}　<b>${method}</b> ${esc(path)}　<span class="muted">（模擬，未連網）</span>`;
      vlOut.innerHTML = `<div class="${res.status >= 200 && res.status < 300 ? 'tip' : 'warn'}">${httpCulprit(res.status)}</div>` + jsonBox('伺服器回應', res.body);
    });
    vlToggleBody();
  }

  /* -------- 第 13 章：認證模擬器 -------- */
  const alGo = document.getElementById('al-go');
  if (alGo) {
    const alToken = document.getElementById('al-token');
    const alSend = document.getElementById('al-send');
    const alStatus = document.getElementById('al-status');
    const alOut = document.getElementById('al-out');

    alGo.addEventListener('click', () => {
      const headers = { Accept: 'application/json' };
      if (alSend.checked) headers.Authorization = alToken.value.trim();

      let status, body;
      if (!headers.Authorization) {
        status = 401; body = { error: 'Unauthorized', message: '缺少 Authorization 標頭——伺服器不知道你是誰。' };
      } else if (!/^Bearer\s+\S+/i.test(headers.Authorization)) {
        status = 401; body = { error: 'Unauthorized', message: 'Authorization 格式不對，應該是 "Bearer <token>"。' };
      } else {
        status = 200; body = { type: 'Route', data: { route: '74B', dest_tc: '觀塘碼頭' } };
      }

      alStatus.innerHTML = `<span class="pill ${status === 200 ? 'ok' : 'err'}">HTTP ${status}</span>　<span class="muted">（模擬，未連網）</span>`;
      const headerLines = Object.keys(headers).map(k => k + ': ' + headers[k]).join('\n');
      alOut.innerHTML =
        `<div class="code-head"><span>這次送出的標頭（Request Headers）</span></div>
         <pre class="code">${esc(headerLines)}</pre>` +
        `<div class="${status === 200 ? 'tip' : 'warn'}">${httpCulprit(status)}</div>` +
        jsonBox('伺服器回應', body);
    });
  }

  /* -------- 第 14 章：JSON Path 探索器 -------- */
  const jlGo = document.getElementById('jl-go');
  if (jlGo) {
    const jlJson = document.getElementById('jl-json');
    const jlPath = document.getElementById('jl-path');
    const jlStatus = document.getElementById('jl-status');
    const jlOut = document.getElementById('jl-out');

    document.querySelectorAll('.jl-sample').forEach(b => b.addEventListener('click', () => {
      jlPath.value = b.dataset.path;
      jlOut.innerHTML = ''; jlStatus.textContent = '';
    }));

    document.getElementById('jl-fetch').addEventListener('click', async () => {
      jlStatus.innerHTML = `<span class="spinner"></span> 正在抓 74B 的真實資料…`;
      jlOut.innerHTML = '';
      const r = await kmbFetch(Endpoints.route('74B', 'outbound', '1'));
      if (!r.ok || !r.data || !r.data.data) {
        jlStatus.innerHTML = `${statusPill(r)} 目前抓不到資料，請稍後再試（或改看上面的範例 JSON）。`;
        return;
      }
      jlJson.value = pretty(r.data);
      jlStatus.innerHTML = `${statusPill(r)} 已把真實回應放進上面的框框，試著查 <code>$.data.route</code>。`;
    });

    jlGo.addEventListener('click', () => {
      let obj;
      try { obj = JSON.parse(jlJson.value); }
      catch (e) {
        jlStatus.innerHTML = '<span class="pill err">JSON 有錯</span>';
        jlOut.innerHTML = `<div class="warn"><strong>上面的 JSON 格式不正確</strong>${esc(e.message)}<br>JSON 很嚴格：少了逗號、用了單引號、多了逗號都會被拒絕。</div>`;
        return;
      }
      const res = resolveJSONPath(obj, jlPath.value);
      if (!res.ok) {
        jlStatus.innerHTML = `<span class="pill err">找不到</span> <code>${esc(jlPath.value)}</code>`;
        jlOut.innerHTML = `<div class="warn"><strong>查不到這個路徑</strong>${esc(res.error)}</div>`;
        return;
      }
      jlStatus.innerHTML = `<span class="pill ok">找到了</span> <code>${esc(jlPath.value)}</code>`;
      const v = res.value;
      if (v !== null && typeof v === 'object') {
        jlOut.innerHTML = jsonBox('對到的內容', v);
      } else {
        jlOut.innerHTML = `<div class="note"><strong>對到的值</strong><code class="inline">${esc(JSON.stringify(v))}</code> <span class="muted">（型別：${typeof v}）</span></div>`;
      }
    });
  }

  /* -------- 側邊目錄：三橫線鈕展開／收合 -------- */
  const tocEl = document.getElementById('toc');
  const tocToggle = document.getElementById('toc-toggle');
  if (tocEl && tocToggle) {
    const layoutEl = document.querySelector('.layout');
    const setToc = (open) => {
      tocEl.classList.toggle('collapsed', !open);
      if (layoutEl) layoutEl.classList.toggle('toc-collapsed', !open);
      tocToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    tocToggle.addEventListener('click', () =>
      setToc(tocToggle.getAttribute('aria-expanded') !== 'true'));
    /* 手機：點選章節後自動收合，把空間還給文章 */
    tocEl.querySelectorAll('.toc-links a').forEach(a => {
      a.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 900px)').matches) setToc(false);
      });
    });
  }

  /* -------- 側邊目錄：捲動時高亮目前章節 -------- */
  const chapters = Array.from(document.querySelectorAll('.chapter'));
  const tocLinks = Array.from(document.querySelectorAll('.toc a'));
  if (chapters.length && tocLinks.length && 'IntersectionObserver' in window) {
    const map = {};
    tocLinks.forEach(a => { map[a.getAttribute('href').slice(1)] = a; });
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          tocLinks.forEach(a => a.classList.remove('active'));
          const link = map[en.target.id];
          if (link) link.classList.add('active');
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });
    chapters.forEach(c => obs.observe(c));
  }
});
