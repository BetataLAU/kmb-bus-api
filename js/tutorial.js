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

  /* -------- 第 7 章：輸入路線，顯示目的地 -------- */
  const btn7 = document.getElementById('ch7-go');
  if (btn7) {
    btn7.addEventListener('click', async () => {
      const route = document.getElementById('ch7-route').value.trim();
      const status = document.getElementById('ch7-status');
      const out = document.getElementById('ch7-out');
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
