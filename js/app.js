/* =====================================================================
   NEMSU Navigator — UI logic (sidebar, search, cards, routing, tour)
   ===================================================================== */
(function () {
  const D = window.NEMSU, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const eng = new D.Engine($('#map'));
  window.NEMSU_ENGINE = eng;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const catOf = id => D.CATEGORIES.find(c => c.id === id);
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('nemsu.' + k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('nemsu.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  const isMobile = () => window.innerWidth <= 820;
  const state = { filter: 'all', text: '', selected: null, prevCam: null, fav: store.get('fav', []), recent: store.get('recent', []), tourOn: false, walking: false, tourI: 0, from: 'gate1', dirOpen: false, introDone: false };
  const B = id => D.BUILDINGS.find(b => b.id === id);

  /* ---------- helpers ---------- */
  let toastT; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
  function manilaNow() {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: D.TIMEZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const g = t => p.find(x => x.type === t).value, day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
    return { day, min: (parseInt(g('hour'), 10) % 24) * 60 + parseInt(g('minute'), 10) };
  }
  const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  function isOpen(b) {
    const h = b.hours, n = manilaNow(); if (!h.days.includes(n.day)) return false;
    const close = n.day === 6 && h.satClose ? toMin(h.satClose) : toMin(h.close);
    return n.min >= toMin(h.open) && n.min < close;
  }
  const badge = b => isOpen(b) ? '<span class="badge open">Open now</span>' : '<span class="badge closed">Closed</span>';
  const numEl = b => `<span class="num" style="--c:${catOf(b.cat).color}">${b.n}</span>`;
  function legendAuto() { const busy = !$('#routeCard').hidden || state.tourOn; $('#legend').style.display = (busy && !isMobile()) ? 'none' : ''; }
  function updateInsets(instant) {
    legendAuto();
    if (state.walking) { const m0 = isMobile(), d0 = !$('#detail').hidden; eng.setInsets({ l: 0, r: 0, t: 0, b: 0 }, instant); return; }
    const m = isMobile(), detailOpen = !$('#detail').hidden;
    if (m) {
      const sheetH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-h')) || innerHeight * 0.46;
      const bottom = detailOpen ? innerHeight * 0.6 : state.tourOn ? 230 : ((document.body.classList.contains('sb-hidden') ? 0 : sheetH) + ($('#routeCard').hidden ? 0 : 130));
      eng.setInsets({ l: 0, r: 0, t: 64, b: bottom }, instant);
    } else {
      eng.setInsets({ l: document.body.classList.contains('sb-hidden') ? 0 : 362, r: detailOpen ? 460 : 76, t: 64, b: (!$('#routeCard').hidden || state.tourOn) ? 150 : 0 }, instant);
    }
  }

  /* ---------- chips, legend, list ---------- */
  function buildChips() {
    const chips = [{ id: 'all', label: 'All', color: '#5f6f7a' }].concat(D.CATEGORIES);
    $('#chips').innerHTML = chips.map(c => `<button class="chip${c.id === state.filter ? ' active' : ''}" data-cat="${c.id}" style="--c:${c.color}"><i></i>${esc(c.label)}</button>`).join('');
    $$('#chips .chip').forEach(el => el.onclick = () => { state.filter = el.dataset.cat; eng.filter = state.filter; eng.dirty = true; buildChips(); renderList(); });
  }
  function buildLegend() {
    $('#legendBody').innerHTML =
      D.CATEGORIES.map(c => `<div class="lg"><i style="--c:${c.color}"></i>${esc(c.label)}</div>`).join('') +
      `<div class="lg-sep">Map symbols</div>` +
      `<div class="lg"><span class="ic">◉</span>Pulsing ring = selected</div>` +
      `<div class="lg"><span class="ic" style="color:#1a73e8">┅</span>Walking route</div>` +
      `<div class="lg"><span class="ic">🌉</span>Overpass over main road</div>` +
      D.FACILITY_TYPES.map(f => `<div class="lg"><span class="ic">${f.icon}</span>${esc(f.label)}</div>`).join('');
    const lg = $('#legend'); if (store.get('legendCollapsed', innerHeight < 900) || (isMobile())) { lg.classList.add('collapsed'); $('#legendToggle').setAttribute('aria-expanded', 'false'); }
    $('#legendToggle').onclick = () => { lg.classList.toggle('collapsed'); const c = lg.classList.contains('collapsed'); $('#legendToggle').setAttribute('aria-expanded', String(!c)); store.set('legendCollapsed', c); };
  }
  function matchesText(b, t) {
    if (!t) return true; t = t.toLowerCase();
    return [b.name, b.short, ...b.aliases, ...b.offices].some(x => x.toLowerCase().includes(t));
  }
  function renderList() {
    const items = D.BUILDINGS.filter(b => (state.filter === 'all' || b.cat === state.filter) && matchesText(b, state.text));
    $('#count').textContent = `${items.length} of ${D.BUILDINGS.length} buildings`;
    $('#list').innerHTML = items.map(b => `<li class="item${state.selected === b.id ? ' active' : ''}" data-id="${b.id}" tabindex="0">${numEl(b)}<div class="meta"><b>${esc(b.name)}</b><small>${esc(catOf(b.cat).label)} · ${b.floors} floor${b.floors > 1 ? 's' : ''}</small>${badge(b)}</div><button class="fav${state.fav.includes(b.id) ? ' on' : ''}" data-fav="${b.id}" aria-label="Favorite">★</button></li>`).join('') || '<li class="sg-empty">No buildings match.</li>';
    $$('#list .item').forEach(el => {
      el.onclick = e => { if (e.target.dataset.fav) { toggleFav(e.target.dataset.fav); return; } selectBuilding(el.dataset.id); if (isMobile()) setSheet(PEEK); };
      el.onkeydown = e => { if (e.key === 'Enter') selectBuilding(el.dataset.id); };
    });
    renderQuick();
  }
  function toggleFav(id) { const i = state.fav.indexOf(id); i < 0 ? state.fav.push(id) : state.fav.splice(i, 1); store.set('fav', state.fav); renderList(); if (state.selected) renderDetail(); }
  function pushRecent(id) { state.recent = [id, ...state.recent.filter(x => x !== id)].slice(0, 6); store.set('recent', state.recent); }
  function renderQuick() {
    const ids = [...state.fav, ...state.recent.filter(x => !state.fav.includes(x))].slice(0, 8);
    $('#quickRow').hidden = !ids.length;
    $('#quickItems').innerHTML = ids.map(id => { const b = B(id); return b ? `<button class="qi" data-id="${id}">${state.fav.includes(id) ? '<span class="star">★</span>' : '🕘'} ${esc(b.short)}</button>` : ''; }).join('');
    $$('#quickItems .qi').forEach(el => el.onclick = () => selectBuilding(el.dataset.id));
  }

  /* ---------- selection / fly-to ---------- */
  function selectBuilding(id, o = {}) {
    const b = B(id); if (!b) return;
    if (state.tourOn && o.card !== false) endTour(true);
    if (!state.selected && !state.prevCam && !state.walking) state.prevCam = Object.assign({}, eng.cam);
    state.selected = id; eng.select(id); eng.focusPoint = o.card === false ? eng.focusPoint : null;
    history.replaceState(null, '', '#b=' + id);
    if (o.card !== false) { pushRecent(id); state.dirOpen = false; renderDetail(); showDetail(true); }
    updateInsets();
    renderList();
    if (o.fly !== false && !state.walking) { const tg = { x: b.x, y: b.y, zoom: o.zoom || eng.zoomFor(b), tilt: Math.max(eng.cam.tilt, 45) }; if (o.yaw !== undefined) tg.yaw = o.yaw; eng.flyTo(tg, o.dur || 1000); }
  }
  function deselect(back = true) {
    if (!state.selected) return;
    state.selected = null; eng.select(null); showDetail(false); history.replaceState(null, '', location.pathname + location.search);
    updateInsets(); renderList();
    if (back && state.prevCam && !state.walking) { eng.flyTo(state.prevCam, 1000); }
    state.prevCam = null;
  }
  function showDetail(on) {
    $('#detail').hidden = !on; document.body.classList.toggle('has-detail', on);
  }
  eng.on('click', (id, hit) => {
    closePop();
    if (hit && hit.facility) { toast(hit.facility.name); return; }
    if (id) selectBuilding(id); else if (state.tourOn) { /* ignore ground clicks during the tour */ } else deselect();
  });
  eng.on('hover', () => { });
  eng.on('camera', () => {
    $('#compassNeedle').style.transform = `rotate(${eng.cam.yaw}deg)`;
    $('#btn3dTxt').textContent = eng.cam.tilt < 10 ? '3D' : '2D';
  });
  let lastScale = 0; eng.on('scale', px => { const w = Math.round(px); if (Math.abs(w - lastScale) > 1) { lastScale = w; $('#scaleLine').style.width = Math.max(30, Math.min(200, w)) + 'px'; } });

  /* ---------- detail card + full page ---------- */
  function photoHTML(b, big) {
    if (!b.photo) return `<div class="nophoto"><div><b>🏢</b>Photo coming soon<br><small>Add it to <code>assets/img/</code> and set <code>photo</code> in data.js</small></div></div>`;
    return `<img src="assets/img/${b.photo}" alt="${esc(b.name)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'nophoto',innerHTML:'<div><b>🏢</b>Photo not found</div>'}))">`;
  }
  function fromOptions(b) {
    return '<optgroup label="Gates">' + D.GATES.map(g => `<option value="gate:${g.id}"${state.from === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('') + '</optgroup>' +
      '<optgroup label="Buildings">' + D.BUILDINGS.filter(x => x.id !== b.id).map(x => `<option value="b:${x.id}"${state.from === x.id ? ' selected' : ''}>${x.n}. ${esc(x.name)}</option>`).join('') + '</optgroup>';
  }
  function renderDetail() {
    const b = B(state.selected); if (!b) return; const cat = catOf(b.cat), fav = state.fav.includes(b.id);
    $('#detail').style.setProperty('--c', cat.color);
    $('#detail').innerHTML = `
      <div class="d-photo">${photoHTML(b)}<button class="d-close" id="dClose" aria-label="Close">✕</button><div class="d-num">${numEl(b)}</div></div>
      <div class="d-body">
        <h2>${esc(b.name)}</h2>
        <div class="d-meta"><span class="pill" style="--c:${cat.color}">${esc(cat.label)}</span><span>${b.floors} floor${b.floors > 1 ? 's' : ''}</span>${badge(b)}</div>
        <p>${esc(b.desc)}</p>
        <div class="d-sec">Offices inside</div><div class="tags">${b.offices.map(o => `<span class="tag">${esc(o)}</span>`).join('')}</div>
        <div class="d-sec">Rooms</div><div class="tags">${b.rooms.map(o => `<span class="tag room">${esc(o)}</span>`).join('')}</div>
        <div class="d-hours"><span>🕒 ${esc(b.hours.label)}</span>${badge(b)}</div>
        <div class="d-tip">💡 ${esc(b.tip)}</div>
        ${b.approx ? '<div class="approx">⚠ This building is not on the layout map — its position is approximate.</div>' : ''}
        ${state.dirOpen ? `<div class="d-dir"><label for="fromSel">From</label><select id="fromSel">${fromOptions(b)}</select></div>` : ''}
        <div class="d-actions">
          <button class="primary" id="dDir">🧭 ${state.dirOpen ? 'Update directions' : 'Get directions'}</button>
          <button class="ghost" id="dShare">🔗 Copy share link</button>
          <button class="ghost" id="dFull">📖 Full page</button>
          <button class="ghost" id="dFav">${fav ? '★ Saved' : '☆ Save'}</button>
        </div>
      </div>`;
    $('#dClose').onclick = () => deselect();
    $('#dDir').onclick = () => { if (!state.dirOpen) { state.dirOpen = true; renderDetail(); } const sel = $('#fromSel'); applyRoute(sel.value); };
    if (state.dirOpen) $('#fromSel').onchange = e => applyRoute(e.target.value);
    $('#dShare').onclick = () => copyLink(b);
    $('#dFull').onclick = () => openFull(b);
    $('#dFav').onclick = () => toggleFav(b.id);
  }
  function shareURL(b) { return location.href.split('#')[0] + '#b=' + b.id; }
  function copyLink(b) {
    const url = shareURL(b);
    const done = () => toast('Link copied — it opens the map on ' + b.name);
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, fallback); else fallback();
    function fallback() { const t = document.createElement('textarea'); t.value = url; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { prompt('Copy this link:', url); } t.remove(); }
  }
  function openFull(b) {
    const cat = catOf(b.cat);
    $('#fullpageInner').innerHTML = `
      <button class="fp-x" id="fpClose" aria-label="Close">✕</button>
      <div class="fp-hero">${photoHTML(b, true)}<div class="shade"></div><div class="fp-title">${numEl(b)}<h2 style="display:inline">${esc(b.name)}</h2><div style="margin-top:8px;font-size:14px;opacity:.95">${esc(cat.label)} · ${b.floors} floor${b.floors > 1 ? 's' : ''} ${badge(b)}</div></div></div>
      <div class="fp-body">
        <div><div class="fp-card" style="border:0;padding:0"><h4>About this building</h4><p>${esc(b.desc)}</p></div>
          <div class="d-tip">💡 <b>Freshman tip:</b> ${esc(b.tip)}</div>
          ${b.photo2 ? `<div class="fp-gallery"><img src="assets/img/${b.photo}" alt=""><img src="assets/img/${b.photo2}" alt=""></div>` : ''}
          <div class="fp-actions" style="margin-top:16px"><button class="primary" id="fpDir">🧭 Get directions</button><button class="ghost" id="fpShare">🔗 Copy share link</button></div></div>
        <div><div class="fp-card"><h4>Offices inside</h4><ul>${b.offices.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>
          <div class="fp-card"><h4>Rooms</h4><ul>${b.rooms.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>
          <div class="fp-card"><h4>Office hours</h4><div>${esc(b.hours.label)}</div><div style="margin-top:6px">${badge(b)}</div></div></div>
      </div>`;
    $('#fullpage').hidden = false;
    $('#fpClose').onclick = closeFull; $('#fpShare').onclick = () => copyLink(b);
    $('#fpDir').onclick = () => { closeFull(); state.dirOpen = true; renderDetail(); applyRoute($('#fromSel').value); };
  }
  function closeFull() { $('#fullpage').hidden = true; }
  $('#fullpage').addEventListener('click', e => { if (e.target.id === 'fullpage') closeFull(); });

  /* ---------- wayfinding ---------- */
  function refOf(v) { const [t, id] = v.split(':'); return t === 'gate' ? { type: 'gate', id } : { type: 'b', id }; }
  function nameOf(ref) { return ref.type === 'gate' ? D.GATES.find(g => g.id === ref.id).name.replace(/ \(.*\)/, '') : B(ref.id).name; }
  function applyRoute(v) {
    const b = B(state.selected); if (!b) return;
    const from = refOf(v); state.from = from.id;
    const r = eng.computeRoute(from, { type: 'b', id: b.id });
    if (!r) { toast('Sorry, no walking path found.'); return; }
    eng.setRoute(r);
    $('#routeFrom').textContent = nameOf(from); $('#routeTo').textContent = b.name;
    $('#routeTime').textContent = '🚶 ' + r.minutes + ' min'; $('#routeDist').textContent = Math.round(r.meters / 5) * 5 + ' m';
    $('#routeNote').textContent = r.usesOverpass ? 'Route crosses the main road using the overpass.' : '';
    $('#routeCard').hidden = false; updateInsets();
    if (!state.walking) eng.frameRoute(r.pts);
  }
  function clearRoute() { eng.setRoute(null); $('#routeCard').hidden = true; updateInsets(); if (state.selected && !state.walking) { const b = B(state.selected); eng.flyTo({ x: b.x, y: b.y, zoom: eng.zoomFor(b) }, 900); } }
  $('#clearRoute').onclick = clearRoute;

  /* ---------- guided tour ---------- */
  function resolveStep(s) {
    let t = s.target;
    if (s.type === 'department') t = store.get('dept', s.target);
    const g = D.GATES.find(g => g.id === t); if (g) return { gate: g };
    return { b: B(t) };
  }
  function buildTourList() {
    $('#tourList').innerHTML = D.TOUR.map((s, i) => `<li data-i="${i}"><span class="st">${i + 1}</span><div><b>${esc(s.title)}</b><small>${esc(s.tip)}</small></div></li>`).join('');
    $$('#tourList li').forEach(li => li.onclick = () => { startTour(+li.dataset.i); if (isMobile()) setSheet(PEEK); });
  }
  function startTour(i = 0) {
    if (state.walking) stopWalk(true);
    state.tourOn = true; document.body.classList.add('touring');
    if (state.selected) deselect(false);
    if (!state.prevCam) state.prevCam = Object.assign({}, eng.cam);
    showDetail(false); $('#routeCard').hidden = true; eng.setRoute(null);
    $('#tourCard').hidden = false; showStep(i);
  }
  function showStep(i) {
    state.tourI = i; const s = D.TOUR[i], n = D.TOUR.length, r = resolveStep(s);
    $('#tourStep').textContent = `Step ${i + 1} of ${n}`; $('#tourProg').style.width = ((i + 1) / n * 100) + '%';
    $('#tourTitle').textContent = s.title; $('#tourTip').textContent = s.tip;
    $('#tourBack').disabled = i === 0; $('#tourNext').textContent = i === n - 1 ? 'Finish ✓' : 'Next ›';
    const dep = s.type === 'department'; $('#tourDept').hidden = !dep;
    if (dep) {
      const cur = store.get('dept', s.target);
      $('#deptSelect').innerHTML = D.BUILDINGS.filter(b => b.cat === 'classes').map(b => `<option value="${b.id}"${b.id === cur ? ' selected' : ''}>${esc(b.name)}</option>`).join('');
      $('#deptSelect').onchange = e => { store.set('dept', e.target.value); showStep(i); };
    }
    updateInsets();
    if (r.gate) { state.selected = null; eng.select(null); eng.focusPoint = { x: r.gate.x, y: r.gate.y }; eng.flyTo({ x: r.gate.x, y: r.gate.y, zoom: s.zoom || 2.4, tilt: 50 }, 1000); renderList(); }
    else if (r.b) { eng.focusPoint = null; state.selected = r.b.id; eng.select(r.b.id); renderList(); eng.flyTo({ x: r.b.x, y: r.b.y, zoom: s.zoom || eng.zoomFor(r.b), tilt: 50 }, 1000); }
  }
  function endTour(silent) {
    state.tourOn = false; document.body.classList.remove('touring'); $('#tourCard').hidden = true; eng.focusPoint = null;
    state.selected = null; eng.select(null); updateInsets(); renderList();
    if (!silent && state.prevCam) eng.flyTo(state.prevCam, 1000); state.prevCam = null;
  }
  $('#tourNext').onclick = () => { if (state.tourI >= D.TOUR.length - 1) { endTour(); toast('Tour complete — welcome to NEMSU! 🎉'); } else showStep(state.tourI + 1); };
  $('#tourBack').onclick = () => state.tourI > 0 && showStep(state.tourI - 1);
  $('#tourSkip').onclick = () => endTour();
  $('#tourBtn').onclick = () => startTour(0);
  $('#startTour').onclick = () => { startTour(0); if (isMobile()) setSheet(PEEK); };

  /* ---------- search with aliases + live suggestions ---------- */
  const FAC_WORDS = { restroom: ['restroom', 'restrooms', 'cr', 'comfort room', 'toilet', 'bathroom'], canteen: ['canteen', 'cafeteria', 'food', 'eat', 'snack'], ramp: ['ramp', 'ramps', 'pwd', 'wheelchair', 'accessible'] };
  function search(q) {
    q = q.trim().toLowerCase(); if (!q) return [];
    const out = [];
    D.BUILDINGS.forEach(b => {
      let best = 0, why = '';
      [[b.name, 60], [b.short, 70], ...b.aliases.map(a => [a, 90]), ...b.offices.map(o => [o, 55]), ...b.rooms.map(r => [r, 40])].forEach(([t, w]) => {
        const tl = t.toLowerCase(); let s = 0;
        if (tl === q) s = w + 30; else if (q.length <= 2) s = 0;
        else if (tl.startsWith(q)) s = w + 15; else if (tl.split(/[\s\-–/&(),]+/).some(x => x.startsWith(q))) s = w + 8; else if (tl.includes(q)) s = w;
        if (s > best) { best = s; why = t; }
      });
      if (best) out.push({ b, score: best, why });
    });
    out.sort((a, c) => c.score - a.score);
    const fac = D.FACILITY_TYPES.filter(f => FAC_WORDS[f.id].some(w => w === q || (q.length > 2 && w.startsWith(q)))).map(f => ({ fac: f, score: 200 }));
    return fac.concat(out).slice(0, 7);
  }
  let sgItems = [], sgActive = -1;
  function renderSuggest() {
    const q = $('#search').value; $('#searchClear').hidden = !q;
    sgItems = search(q); sgActive = sgItems.length ? 0 : -1;
    const box = $('#suggest'); if (!q.trim()) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = sgItems.map((r, i) => r.fac
      ? `<div class="sg${i === 0 ? ' active' : ''}" data-i="${i}" role="option"><span class="num" style="--c:${r.fac.color}">${r.fac.icon}</span><div><b>Show ${esc(r.fac.label)} on the map</b><small>Facility layer</small></div></div>`
      : `<div class="sg${i === 0 ? ' active' : ''}" data-i="${i}" role="option">${numEl(r.b)}<div><b>${esc(r.b.name)}</b><small>${r.why.toLowerCase() !== r.b.name.toLowerCase() ? `matches “${esc(r.why)}” · ` : ''}${esc(catOf(r.b.cat).label)}</small></div></div>`).join('') || '<div class="sg-empty">No match — try “registrar”, “library”, “gym”…</div>';
    $$('#suggest .sg').forEach(el => el.onmousedown = e => { e.preventDefault(); pickSuggest(+el.dataset.i); });
  }
  function pickSuggest(i) {
    const r = sgItems[i]; if (!r) return;
    $('#suggest').hidden = true; $('#search').blur();
    if (r.fac) { setLayer(r.fac.id, true); const f = D.FACILITIES.find(f => f.type === r.fac.id); if (f) eng.flyToPoint(f.x, f.y, 2.2); toast(r.fac.label + ' shown on the map'); $('#search').value = ''; $('#searchClear').hidden = true; }
    else { selectBuilding(r.b.id); $('#search').value = r.b.name; $('#searchClear').hidden = false; }
    state.text = ''; renderList();
  }
  $('#search').addEventListener('input', () => { renderSuggest(); state.text = $('#search').value; renderList(); });
  $('#search').addEventListener('focus', renderSuggest);
  $('#search').addEventListener('blur', () => setTimeout(() => ($('#suggest').hidden = true), 120));
  $('#search').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!sgItems.length) return; sgActive = (sgActive + (e.key === 'ArrowDown' ? 1 : -1) + sgItems.length) % sgItems.length; $$('#suggest .sg').forEach((el, i) => el.classList.toggle('active', i === sgActive)); }
    else if (e.key === 'Enter') { e.preventDefault(); pickSuggest(Math.max(0, sgActive)); }
    else if (e.key === 'Escape') { $('#suggest').hidden = true; $('#search').blur(); e.stopPropagation(); }
  });
  $('#searchClear').onclick = () => {           // X = clear the text, close suggestions, drop the search selection
    $('#search').value = ''; state.text = ''; $('#suggest').hidden = true; $('#searchClear').hidden = true;
    if (state.selected && !state.walking && !state.tourOn) deselect();
    renderList(); $('#search').blur();
  };
  $('#searchClear').addEventListener('mousedown', e => e.preventDefault());

  /* ---------- controls ---------- */
  $('#btnZoomIn').onclick = () => eng.flyTo({ zoom: eng.cam.zoom * 1.4 }, 350);
  $('#btnZoomOut').onclick = () => eng.flyTo({ zoom: eng.cam.zoom / 1.4 }, 350);
  $('#btnRotate').onclick = () => eng.flyTo({ yaw: eng.cam.yaw + 45 }, 600);
  $('#btnCompass').onclick = () => eng.flyTo({ yaw: 0 }, 600);
  $('#btn3d').onclick = () => state.walking ? toast('Exit walk view to switch to 2D') : eng.cam.tilt > 10 ? eng.flyTo({ tilt: 0, yaw: 0 }, 800) : eng.flyTo({ tilt: 52 }, 800);
  $('#btnReset').onclick = () => { if (state.walking) { eng.flyTo({ yaw: 0, tilt: 66 }, 600); return; } if (state.selected) { const b = B(state.selected); eng.flyTo({ x: b.x, y: b.y, zoom: eng.zoomFor(b), yaw: 0, tilt: 52 }, 900); } else eng.flyTo(D.DEFAULT_CAM, 1000); };
  $('#btnHome').onclick = () => { if (state.walking) stopWalk(false); if (state.tourOn) endTour(true); state.prevCam = null; if (state.selected) deselect(false); eng.flyTo(D.DEFAULT_CAM, 1100); };
  $('#btnNight').onclick = () => { const n = eng.nightT < 0.5; eng.nightT = n ? 1 : 0; document.body.classList.toggle('night', n); $('#btnNightIco').textContent = n ? '☀️' : '🌙'; store.set('night', n); eng.dirty = true; };
  function setLayer(id, on) { eng.layers[id] = on; eng.dirty = true; buildLayerMenu(); }
  function buildLayerMenu() {
    $('#layerMenu').innerHTML = '<h5>Facilities</h5>' + D.FACILITY_TYPES.map(f => `<label><input type="checkbox" data-l="${f.id}"${eng.layers[f.id] ? ' checked' : ''}> <span>${f.icon}</span> ${esc(f.label)}</label>`).join('');
    $$('#layerMenu input').forEach(i => i.onchange = () => { eng.layers[i.dataset.l] = i.checked; eng.dirty = true; });
  }
  $('#btnLayers').onclick = e => { e.stopPropagation(); const m = $('#layerMenu'); m.hidden = !m.hidden; $('#btnLayers').classList.toggle('on', !m.hidden); };
  function closePop() { $('#layerMenu').hidden = true; $('#btnLayers').classList.remove('on'); }
  $('#layerMenu').onclick = e => e.stopPropagation();
  document.addEventListener('click', e => { if (!e.target.closest('.ctl-wrap')) closePop(); });
  $$('.tab').forEach(t => t.onclick = () => { $$('.tab').forEach(x => x.classList.toggle('active', x === t)); $$('.tabpanel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + t.dataset.tab)); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('#fullpage').hidden) closeFull(); else if (state.tourOn) endTour(); else if (state.selected) deselect(); else if (state.walking) stopWalk(); }
    else if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
      if (e.key === '+' || e.key === '=') $('#btnZoomIn').click(); else if (e.key === '-') $('#btnZoomOut').click();
      else if (state.walking) { /* keys used for walking */ } else if (e.key === 'ArrowRight' && state.tourOn) $('#tourNext').click(); else if (e.key === 'ArrowLeft' && state.tourOn) $('#tourBack').click();
    }
  });

  /* ---------- WALK VIEW (joystick) ---------- */
  function startWalk() {
    if (state.walking) return;
    if (state.tourOn) endTour(true); closeFull(); closePop();
    const g = D.GATES.find(g => g.id === 'gate1'); let sp;
    if (state.selected) { const b = B(state.selected); sp = eng.snap(b.x, b.y); } else sp = eng.snap(g.x, g.y + 12);   // just inside the main gate
    if (!state.prevCam) state.prevCam = Object.assign({}, eng.cam);
    state.walking = true; document.body.classList.add('walking'); $('#walkHud').hidden = false; $('#walkNear').hidden = true;
    let heading = state.selected ? 0 : 180; if (state.selected) { const b0 = B(state.selected); heading = Math.atan2(b0.x - sp.px, -(b0.y - sp.py)) * 180 / Math.PI; }
    updateInsets(true); eng.startWalk(sp.px, sp.py, heading);
    setWalkCam(false);
    toast(isMobile() ? 'First person has no joystick — tap 🎥 for third person to use it' : 'Walk view: W A S D to move · drag to look · click a building · V = camera');
  }
  function stopWalk(silent) {
    if (!state.walking) return;
    eng.stopWalk(); state.walking = false; eng.walk.third = false; document.body.classList.remove('walking', 'walk-third'); $('#walkHud').hidden = true;
    updateInsets();
    if (!silent) { if (state.selected) { const b = B(state.selected); eng.flyTo({ x: b.x, y: b.y, zoom: eng.zoomFor(b), tilt: 50 }, 1000); } else eng.flyTo(D.DEFAULT_CAM, 1100); state.prevCam = null; }
  }
  /* first person <-> third person camera */
  function setWalkCam(third) {
    eng.walk.third = !!third; document.body.classList.toggle('walk-third', !!third); eng.dirty = true;
    $('#walkView span').textContent = third ? '1st person' : '3rd person';
    $('#walkHint').textContent = third ? 'Joystick or W A S D = move · Q E = turn · drag = look around · click a building to read about it · V = camera' : 'W A S D / arrows = move · Q E = turn · drag = look around · click a building to read about it · V = camera';
  }
  $('#walkView').onclick = () => setWalkCam(!eng.walk.third);
  $('#walkBtn').onclick = startWalk; $('#btnWalk').onclick = () => (state.walking ? stopWalk() : startWalk()); $('#walkExit').onclick = () => stopWalk();
  eng.on('near', id => { const b = id && B(id), el = $('#walkNear'); el.hidden = !b; if (b) { el.textContent = '📍 ' + b.name; el.dataset.id = id; } });
  $('#walkNear').onclick = e => selectBuilding(e.currentTarget.dataset.id);
  (function joystick() {
    const base = $('#joy'), th = $('#joyThumb'); let pid = null; const R = 54;
    const set = (x, y) => { th.style.transform = `translate(${x}px,${y}px)`; eng.walk.joy = { x: x / R, y: -y / R }; };
    const move = e => { const r = base.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } set(dx, dy); };
    base.addEventListener('pointerdown', e => { pid = e.pointerId; base.setPointerCapture(pid); move(e); e.preventDefault(); });
    base.addEventListener('pointermove', e => { if (e.pointerId === pid) move(e); });
    const end = e => { if (e.pointerId === pid) { pid = null; set(0, 0); } };
    base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
  })();
  const KEYS = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', q: 'tl', e: 'tr' };
  const keyHandler = v => e => { if (!state.walking || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return; const k = KEYS[e.key.toLowerCase()]; if (k) { eng.walk.keys[k] = v; e.preventDefault(); } else if (e.key.toLowerCase() === 'v' && v) setWalkCam(!eng.walk.third); };
  document.addEventListener('keydown', keyHandler(1)); document.addEventListener('keyup', keyHandler(0));

  /* ---------- mobile bottom sheet (draggable) ---------- */
  const PEEK = 96; let HALF = Math.round(innerHeight * 0.46), FULL = Math.round(innerHeight * 0.86);
  function setSheet(h) { document.documentElement.style.setProperty('--sheet-h', Math.round(h) + 'px'); updateInsets(); }
  (function sheet() {
    const sb = $('#sidebar'); let drag = null;
    const start = e => { if (!isMobile()) return; if (e.target.closest('.tabpanel') && e.currentTarget !== $('#sheetHandle')) return; drag = { y: e.clientY, h: sb.getBoundingClientRect().height, t: performance.now(), y0: e.clientY }; sb.classList.add('dragging'); e.currentTarget.setPointerCapture(e.pointerId); };
    const move = e => { if (!drag) return; const h = Math.max(PEEK, Math.min(FULL, drag.h + (drag.y - e.clientY))); setSheet(h); };
    const end = e => { if (!drag) return; sb.classList.remove('dragging'); const h = sb.getBoundingClientRect().height, v = (drag.y0 - e.clientY) / (performance.now() - drag.t); const pts = [PEEK, HALF, FULL]; let t = pts.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a); if (Math.abs(v) > 0.5) t = v > 0 ? pts.find(p => p > h + 10) || FULL : [...pts].reverse().find(p => p < h - 10) || PEEK; setSheet(t); drag = null; };
    [$('#sheetHandle'), document.querySelector('.tabs')].forEach(el => { el.addEventListener('pointerdown', start); el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.style.touchAction = 'none'; });
    $('#searchWrap').addEventListener('focusin', () => { if (isMobile() && parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-h')) > HALF) setSheet(HALF); });
    window.addEventListener('resize', () => { HALF = Math.round(innerHeight * 0.46); FULL = Math.round(innerHeight * 0.86); updateInsets(true); });
    setSheet(isMobile() ? Math.round(innerHeight * 0.4) : HALF);
  })();

  /* ---------- welcome flash + intro drop ---------- */
  function buildWelcome() {
    const h = $('#welcomeText'), txt = 'WELCOME IN NEMSU CANTILAN CAMPUS';
    let i = 0;
    h.innerHTML = txt.split(' ').map(w => '<span class="w">' + w.split('').map(c => `<span style="animation-delay:${0.25 + (i++) * 0.045}s">${c}</span>`).join('') + '</span>').join(' ');
  }
  let welcomeClosed = false;
  function closeWelcome() {
    if (welcomeClosed) return; welcomeClosed = true; $('#welcome').classList.add('hide');
    const hashB = (location.hash.match(/#b=([\w-]+)/) || [])[1];
    const t = hashB && B(hashB);
    if (t) {
      selectBuilding(hashB, { dur: 3000, yaw: 0 });
    } else eng.flyTo(D.DEFAULT_CAM, 3200, u => 1 - Math.pow(1 - u, 3)).then(() => { state.introDone = true; });
  }
  $('#welcome').addEventListener('click', closeWelcome);
  setTimeout(closeWelcome, 3900);
  window.addEventListener('hashchange', () => { const m = location.hash.match(/#b=([\w-]+)/); if (m && B(m[1]) && state.selected !== m[1]) selectBuilding(m[1]); });

  /* ---------- hide / show the buildings list and the search bar ---------- */
  function setSidebar(hidden) { document.body.classList.toggle('sb-hidden', hidden); store.set('sbHidden', hidden); updateInsets(); }
  $('#sbToggle').onclick = () => setSidebar(!document.body.classList.contains('sb-hidden'));
  $('#searchToggle').onclick = () => { const h = document.body.classList.toggle('search-hidden'); store.set('searchHidden', h); if (!h) setTimeout(() => $('#search').focus(), 50); else $('#suggest').hidden = true; };
  if (store.get('sbHidden', false)) document.body.classList.add('sb-hidden');
  if (store.get('searchHidden', false)) document.body.classList.add('search-hidden');

  /* ---------- init ---------- */
  if (isMobile()) D.DEFAULT_CAM.zoom = 0.66;
  buildWelcome(); buildChips(); buildLegend(); buildLayerMenu(); buildTourList(); renderList(); updateInsets(true);
  // start high above the campus, then "drop" in after the welcome box
  Object.assign(eng.cam, { x: 870, y: 335, yaw: -40, tilt: 8, zoom: 0.3 });
  if (store.get('night', false)) { eng.nightT = eng.night = 1; document.body.classList.add('night'); $('#btnNightIco').textContent = '☀️'; }
  eng.emit('camera');
  window.NEMSU_APP = { eng, selectBuilding, startTour, applyRoute };
})();
