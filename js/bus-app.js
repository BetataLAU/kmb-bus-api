/* =========================================================
   bus-app.js — 九巴實時到站 App
   依賴 common.js（kmbFetch / Endpoints / dirName / toPathDir / formatTime / minutesUntil）
   ========================================================= */

const state = {
  routeIndex: null,        // /route/ 的路線清單
  stopMap: null,           // stopId -> {name_tc, ...}
  current: null,           // { route, pathDir, st, bound, stopId, stopName }
  refreshTimer: null,
  countdown: 0,
  countdownTimer: null,
};

/* ---------- 資料載入 ---------- */
async function loadRouteIndex() {
  if (state.routeIndex) return state.routeIndex;
  const r = await kmbFetch(Endpoints.routeList());
  if (!r.ok) throw new Error('無法取得路線清單（HTTP ' + r.status + '）');
  state.routeIndex = r.data.data || [];
  return state.routeIndex;
}

async function loadStopMap() {
  if (state.stopMap) return state.stopMap;
  const r = await kmbFetch(Endpoints.stopList());
  if (!r.ok) throw new Error('無法取得站點清單（HTTP ' + r.status + '）');
  const map = {};
  (r.data.data || []).forEach((s) => { map[s.stop] = s; });
  state.stopMap = map;
  return map;
}

/* ---------- 步驟 1：路線 ---------- */
function fillDatalist(index) {
  const dl = document.getElementById('route-datalist');
  const nums = Array.from(new Set(index.map((x) => x.route)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  dl.innerHTML = nums.map((n) => `<option value="${esc(n)}"></option>`).join('');
}

async function onQueryRoute() {
  const input = document.getElementById('route-input');
  const hint = document.getElementById('route-hint');
  const vBox = document.getElementById('variant-box');
  const vSel = document.getElementById('variant-select');
  const q = input.value.trim();

  if (!q) { hint.textContent = '請輸入路線號碼。'; return; }
  hint.innerHTML = `<span class="spinner"></span> 載入中…`;

  let index;
  try { index = await loadRouteIndex(); }
  catch (e) { hint.textContent = e.message; return; }

  // 找符合的路線（忽略大小寫），並去掉重複的方向/服務類型組合
  const matches = index.filter((x) => String(x.route).toUpperCase() === q.toUpperCase());
  if (!matches.length) {
    hint.textContent = `查不到路線「${q}」。請確認號碼是否正確（大小寫要一致）。`;
    vBox.classList.add('hidden');
    return;
  }

  const seen = new Set();
  const variants = [];
  matches.forEach((m) => {
    const key = m.bound + '|' + m.service_type;
    if (seen.has(key)) return;
    seen.add(key);
    variants.push(m);
  });

  vSel.innerHTML = variants.map((m, i) =>
    `<option value="${i}">${esc(dirName(m.bound))}　·　服務類型 ${esc(m.service_type)}　·　${esc(m.orig_tc)} → ${esc(m.dest_tc)}</option>`
  ).join('');

  vSel.dataset.route = q;
  vSel._variants = variants;
  vBox.classList.remove('hidden');
  hint.textContent = `找到 ${variants.length} 個方向／服務類型。`;

  // 自動載入第一個
  vSel.onchange = () => loadVariant(q, variants[Number(vSel.value)]);
  loadVariant(q, variants[0]);
}

/* 載入指定路線方向沿途的站點 */
async function loadVariant(route, variant) {
  const stopsBox = document.getElementById('stops-box');
  const count = document.getElementById('stop-count');
  const pathDir = toPathDir(variant.bound);
  stopsBox.innerHTML = `<p class="muted"><span class="spinner"></span> 載入站點中…</p>`;
  count.textContent = '';

  let stopMap;
  try { stopMap = await loadStopMap(); }
  catch (e) { stopsBox.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }

  const r = await kmbFetch(Endpoints.routeStop(route, pathDir, variant.service_type));
  if (!r.ok) {
    stopsBox.innerHTML = `<p class="muted">此方向／服務類型沒有站點資料（HTTP ${r.status}）。</p>`;
    return;
  }

  const list = (r.data.data || []).slice().sort((a, b) => Number(a.seq) - Number(b.seq));
  count.textContent = `（共 ${list.length} 站）`;

  if (!list.length) { stopsBox.innerHTML = `<p class="muted">沒有站點資料。</p>`; return; }

  stopsBox.innerHTML = `<div class="stop-list">` + list.map((s) => {
    const info = stopMap[s.stop];
    const name = info ? info.name_tc : '（未知站名）';
    return `<div class="stop-item" data-stop="${esc(s.stop)}" data-name="${esc(name)}" data-seq="${esc(s.seq)}">
      <span class="stop-seq">${esc(s.seq)}</span>
      <span>${esc(name)}</span>
    </div>`;
  }).join('') + `</div>`;

  // 綁定點擊事件
  Array.from(stopsBox.querySelectorAll('.stop-item')).forEach((el) => {
    el.addEventListener('click', () => {
      state.current = {
        route, pathDir, st: variant.service_type,
        bound: variant.bound, stopId: el.dataset.stop, stopName: el.dataset.name,
      };
      loadEta(true);
    });
  });
}

/* ---------- 步驟 2：即時到站時間 ---------- */
async function loadEta(reset) {
  if (!state.current) return;
  const status = document.getElementById('eta-status');
  const box = document.getElementById('eta-box');
  const title = document.getElementById('eta-title');
  const refreshBtn = document.getElementById('btn-refresh');

  if (reset) {
    clearInterval(state.refreshTimer);
    clearInterval(state.countdownTimer);
    state.countdown = 30;
    box.innerHTML = '';
    refreshBtn.classList.remove('hidden');
  }

  const { route, stopId, stopName } = state.current;
  title.innerHTML = `站點：<b>${esc(stopName)}</b>　<span class="muted">(ID: ${esc(stopId)})</span>`;
  status.innerHTML = `<span class="spinner"></span> 取得即時到站時間…`;

  const r = await kmbFetch(Endpoints.stopEta(stopId));
  if (!r.ok) {
    status.innerHTML = `取得失敗（HTTP ${r.status}）。`;
    box.innerHTML = '';
    return;
  }

  const list = r.data.data || [];
  // 排序：路線 → 第幾班
  list.sort((a, b) => String(a.route).localeCompare(String(b.route), undefined, { numeric: true })
    || (a.eta_seq - b.eta_seq));

  if (!list.length) {
    box.innerHTML = `<p class="muted">此站暫時沒有到站資料。</p>`;
  } else {
    box.innerHTML = list.map((e) => {
      const isMine = String(e.route).toUpperCase() === String(route).toUpperCase();
      const mins = minutesUntil(e.eta);
      let big, cls = '';
      if (e.eta == null || mins == null) { big = '—'; cls = 'na'; }
      else if (mins <= 1) { big = '即將到站'; cls = 'due'; }
      else { big = mins + ' 分鐘'; }

      const timeStr = e.eta ? formatTime(e.eta) : '暫無資料';
      const remark = e.rmk_tc ? `　<span class="pill warn">${esc(e.rmk_tc)}</span>` : '';

      return `<div class="bus-eta-item" style="${isMine ? 'border-color:var(--red); box-shadow:0 0 0 2px var(--red-soft) inset' : ''}">
        <div class="route-chip">${esc(e.route)}</div>
        <div>
          <div style="font-weight:700">往 ${esc(e.dest_tc)} ${isMine ? '<span class="pill err">你查的路線</span>' : ''}</div>
          <div class="muted" style="font-size:.85rem">
            第 ${esc(e.eta_seq)} 班　·　方向 ${esc(dirName(e.dir))}　·　服務 ${esc(e.service_type)}
            ${remark}
          </div>
        </div>
        <div class="eta-min">
          <div class="big ${cls}">${big}</div>
          <div class="sub">${esc(timeStr)}</div>
        </div>
      </div>`;
    }).join('');
  }

  // 安排 30 秒後自動更新
  if (reset) {
    state.refreshTimer = setInterval(() => loadEta(false), 30000);
    state.countdownTimer = setInterval(() => {
      state.countdown = Math.max(0, state.countdown - 1);
      const s = document.getElementById('eta-status');
      if (s) s.innerHTML = `<span class="pill ok">已更新</span> 　自動更新倒數：${state.countdown} 秒（資料時間 ${formatTime(r.data.generated_timestamp)}）`;
    }, 1000);
  }
  status.innerHTML = `<span class="pill ok">已更新</span> 　自動更新倒數：${state.countdown} 秒（資料時間 ${formatTime(r.data.generated_timestamp)}）`;
}

/* ---------- 初始化 ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('route-input');
  const hint = document.getElementById('route-hint');

  document.getElementById('btn-route').addEventListener('click', onQueryRoute);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onQueryRoute(); });
  document.getElementById('btn-refresh').addEventListener('click', () => loadEta(true));

  // 預先載入路線清單，填入 datalist（失敗時靜默）
  hint.innerHTML = `<span class="spinner"></span> 正在載入路線清單…`;
  loadRouteIndex().then((index) => {
    fillDatalist(index);
    hint.innerHTML = `已載入 ${index.length} 條路線。輸入後按 Enter 或「查詢路線」。`;
  }).catch((e) => { hint.textContent = e.message; });
});

