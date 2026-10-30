/* ViSOR mock: logon, session timer, hash router and every screen. */
(function () {
  'use strict';

  const D = window.VISOR_DATA;
  const Store = window.VisorStore;
  const VMap = window.VisorMap;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const cssToken = s => String(s || '').replace(/[^A-Za-z]+/g, '-');

  const SESSION_SECONDS = 30 * 60;
  const ALL_AGENCIES = D.AGENCIES.concat(D.NATIONAL_AGENCIES);

  const state = {
    user: null,
    timeLeft: SESSION_SECONDS,
    flash: null,
    find: null,
    adv: {
      criteria: {},
      forces: new Set(),
      agencies: new Set(ALL_AGENCIES),
      divisions: new Set(),
      results: null,
      label: '',
      sort: { key: 'name', dir: 1 }
    }
  };

  // ================================================================ helpers
  function fmtDate(iso) {
    if (!iso) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
    const x = new Date(iso);
    return isNaN(x) ? iso : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
  }
  function fmtDateTime(iso) {
    const x = new Date(iso);
    return isNaN(x) ? '' : `${fmtDate(iso)} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
  }
  function isoToday() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function age(dob) {
    if (!dob) return '';
    const b = new Date(dob), n = new Date();
    if (isNaN(b)) return '';
    let a = n.getFullYear() - b.getFullYear();
    const m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
    return a;
  }
  const fullName = n => `${(n.surname || '').toUpperCase()}, ${n.forenames || ''}`;
  const typeOf = code => D.NOMINAL_TYPES.find(t => t.code === code);
  const typeLabel = code => { const t = typeOf(code); return t ? `${t.code} - ${t.label}` : (code || ''); };
  const markerLabel = code => (D.WARNING_MARKERS.find(m => m[0] === code) || [code, code])[1];
  const regionOf = force => D.FORCE_REGION[force];
  const canUpdate = () => state.user && state.user.role !== 'READ';
  const isAdmin = () => state.user && state.user.role === 'ADMIN';
  const isMine = n => state.user && (n.offenderManager || '').toUpperCase() === state.user.name.toUpperCase();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const userKey = name => `${name}.${state.user.username}`;

  function riskPill(r) { return r ? `<span class="pill risk-${cssToken(r)}">${esc(r)}</span>` : ''; }
  function statusText(s) { return `<span class="status-${cssToken(s)}">${esc(s)}</span>`; }
  function go(path) { location.hash = '#' + path; }
  function flash(msg, err) { state.flash = { msg, err }; }

  function page(title, body, right) {
    const f = state.flash;
    state.flash = null;
    return `<div class="page-head"><h1>${esc(title)}</h1><div class="right">${right || ''}</div></div>` +
      (f ? `<div class="flash${f.err ? ' err' : ''}">${esc(f.msg)}</div>` : '') + body;
  }
  function panel(title, body, right) {
    return `<div class="panel"><div class="panel-h"><span>${esc(title)}</span><span>${right || ''}</span></div><div class="panel-b">${body}</div></div>`;
  }
  function options(list, value, blank = true) {
    return (blank ? '<option value=""></option>' : '') + list.map(o => {
      const [v, t] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}"${String(value) === String(v) ? ' selected' : ''}>${esc(t)}</option>`;
    }).join('');
  }
  function forceOptions(value) {
    return '<option value=""></option>' + D.REGIONS.map(r =>
      `<optgroup label="${esc(r.label)}">${options(r.forces, value, false)}</optgroup>`).join('');
  }
  function download(filename, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // Tooltip (classic yellow "info tip").
  const tip = $('#tooltip');
  function showTip(html, e) { tip.innerHTML = html; tip.hidden = false; moveTip(e); }
  function moveTip(e) {
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 6);
    const y = Math.min(e.clientY + 16, window.innerHeight - tip.offsetHeight - 6);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function hideTip() { tip.hidden = true; }

  // ================================================================ searching
  function soundex(s) {
    s = String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!s) return '';
    const codes = { B: 1, F: 1, P: 1, V: 1, C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2, D: 3, T: 3, L: 4, M: 5, N: 5, R: 6 };
    let out = s[0], prev = codes[s[0]] || 0;
    for (let i = 1; i < s.length && out.length < 4; i++) {
      const c = codes[s[i]] || 0;
      if (c && c !== prev) out += c;
      if (s[i] !== 'H' && s[i] !== 'W') prev = c;
    }
    return out.padEnd(4, '0');
  }

  // Prefix match by default; * and ? act as wildcards.
  function textMatch(value, pattern) {
    if (!pattern) return true;
    value = String(value || '').toUpperCase();
    pattern = pattern.trim().toUpperCase();
    if (/[*?]/.test(pattern)) {
      const re = '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
      return new RegExp(re).test(value);
    }
    return value.startsWith(pattern);
  }

  function matchNominal(n, c) {
    if (c.surname) {
      const bare = c.surname.replace(/[*?]/g, '').toUpperCase();
      const hit = c.soundex ? soundex(n.surname) === soundex(bare) : textMatch(n.surname, c.surname);
      const aliasHit = bare && (n.aliases || '').toUpperCase().includes(bare);
      if (!hit && !aliasHit) return false;
    }
    if (c.forenames) {
      const parts = (n.forenames || '').split(/\s+/);
      if (!textMatch(n.forenames, c.forenames) && !parts.some(p => textMatch(p, c.forenames))) return false;
    }
    if (c.dob && n.dob !== c.dob) return false;
    if (c.ref && !textMatch(n.ref, c.ref)) return false;
    if (c.pnc && !textMatch(n.pnc, c.pnc)) return false;
    if (!c.includeArchived && n.status === 'Archived') return false;
    if (c.gender && n.gender !== c.gender) return false;
    if (c.type && n.type !== c.type) return false;
    if (c.risk && n.risk !== c.risk) return false;
    if (c.mappa && String(n.mappaLevel) !== c.mappa) return false;
    if (c.status && n.status !== c.status) return false;
    if (c.ageFrom || c.ageTo) {
      const a = age(n.dob);
      if (a === '' || (c.ageFrom && a < +c.ageFrom) || (c.ageTo && a > +c.ageTo)) return false;
    }
    if (c.om && !(n.offenderManager || '').toUpperCase().includes(c.om.toUpperCase())) return false;
    if (c.vrm) {
      const v = c.vrm.replace(/\s/g, '').toUpperCase();
      if (!(n.vehicles || []).some(x => (x.vrm || '').replace(/\s/g, '').toUpperCase().includes(v))) return false;
    }
    if (c.address) {
      const a = c.address.toUpperCase();
      if (!(n.addresses || []).some(x => (x.address || '').toUpperCase().includes(a))) return false;
    }
    if (c.marker && !(n.markers || []).includes(c.marker)) return false;
    if (c.forces && c.forces.size && !c.forces.has(n.force)) return false;
    if (c.agencies && n.agency && !c.agencies.has(n.agency)) return false;
    if (c.divisions && c.divisions.size && !c.divisions.has(n.area)) return false;
    return true;
  }

  function sortValue(n, key) {
    if (key === 'name') return fullName(n);
    if (key === 'age') return Number(age(n.dob)) || 0;
    if (key === 'risk') return D.RISK_LEVELS.indexOf(n.risk);
    return String(n[key] == null ? '' : n[key]).toUpperCase();
  }

  const RESULT_COLS = [
    ['ref', 'ViSOR Ref'], ['name', 'Name'], ['dob', 'DOB'], ['age', 'Age'], ['gender', 'Sex'], ['type', 'Type'],
    ['risk', 'Risk'], ['mappaLevel', 'MAPPA'], ['force', 'Owning Force'], ['offenderManager', 'Offender Manager'], ['status', 'Status']
  ];
  function resultsTable(list, sort) {
    if (!list.length) return '<div class="notice">No nominals found matching the search criteria.</div>';
    const head = RESULT_COLS.map(([k, t]) => {
      const arrow = sort && sort.key === k ? (sort.dir > 0 ? ' &#9650;' : ' &#9660;') : '';
      return `<th${sort ? ` data-sort="${k}"` : ''}>${t}${arrow}</th>`;
    }).join('');
    const rows = list.map(n => `<tr class="click" data-id="${esc(n.id)}">
        <td>${esc(n.ref)}</td><td><a href="#nominal/${esc(n.id)}">${esc(fullName(n))}</a></td>
        <td>${esc(fmtDate(n.dob))}</td><td class="num">${esc(age(n.dob))}</td><td>${esc(n.gender)}</td>
        <td title="${esc(typeLabel(n.type))}">${esc(n.type)}</td><td>${riskPill(n.risk)}</td><td>${esc(n.mappaLevel)}</td>
        <td>${esc(n.force)}</td><td>${esc(n.offenderManager) || '<span class="muted">Unallocated</span>'}</td>
        <td>${statusText(n.status)}</td></tr>`).join('');
    return `<div class="muted" style="margin-bottom:4px">${list.length} nominal(s) found.</div>
      <table class="grid"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  function bindRows(root) {
    $$('tr[data-id]', root).forEach(tr => tr.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      go('nominal/' + tr.dataset.id);
    }));
  }

  // ================================================================ logon / session
  function renderLogo() {
    $('#login-logo').innerHTML = `
      <svg viewBox="0 0 230 300" aria-label="ViSOR">
        <path d="M30,165 A82,20 0 0 1 194,165" fill="none" stroke="#6b6b6b" stroke-width="15"/>
        <path d="M30,165 A82,20 0 0 1 194,165" fill="none" stroke="#bdbdbd" stroke-width="5"/>
        <circle cx="112" cy="58" r="36" fill="#fff" stroke="#d62020" stroke-width="10"/>
        <path d="M28,118 Q112,92 196,118 L118,238 L106,238 Z" fill="#fff" stroke="#d62020" stroke-width="10" stroke-linejoin="round"/>
        <path d="M30,165 A82,20 0 0 0 194,165" fill="none" stroke="#6b6b6b" stroke-width="15"/>
        <path d="M30,165 A82,20 0 0 0 194,165" fill="none" stroke="#d9d9d9" stroke-width="5"/>
        <g font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="58" fill="#333">
          <text x="6" y="292">V</text><text x="46" y="292">&#305;</text><text x="66" y="292">SOR</text>
        </g>
        <circle cx="54" cy="245" r="7" fill="#d62020"/>
      </svg>`;
  }

  // Fictional crest: blue star badge (deliberately not any real force's insignia).
  const CREST = `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <polygon fill="#d7dde9" stroke="#7b88a6" points="50,2 61,22 84,16 78,39 98,50 78,61 84,84 61,78 50,98 39,78 16,84 22,61 2,50 22,39 16,16 39,22"/>
      <circle cx="50" cy="50" r="27" fill="#1f3c88" stroke="#fff" stroke-width="3"/>
      <circle cx="50" cy="50" r="17" fill="#fff"/>
      <path d="M50,37 l4,9 10,1 -8,6 3,10 -9,-6 -9,6 3,-10 -8,-6 10,-1 z" fill="#c41e1e"/>
    </svg>`;

  function startSession(acct) {
    state.user = { username: acct.username, name: acct.name, role: acct.role, agency: acct.agency, force: acct.force, unit: acct.unit };
    try { sessionStorage.setItem('visor.session', acct.username); } catch (e) { /* ignore */ }
    const last = Store.getItem('lastlogon.' + acct.username, null);
    state.user.lastLogon = last;
    Store.setItem('lastlogon.' + acct.username, new Date().toISOString());
    $('#login-screen').hidden = true;
    $('#app').hidden = false;
    $('#sb-crest').innerHTML = CREST;
    $('#sb-user').innerHTML = `${esc(state.user.name)}<small>${esc(state.user.unit)}</small><small>${esc(state.user.force)}</small>`;
    resetTimer();
    render();
  }

  function logout(msg) {
    state.user = null;
    try { sessionStorage.removeItem('visor.session'); } catch (e) { /* ignore */ }
    $('#app').hidden = true;
    $('#login-screen').hidden = false;
    $('#lg-user').value = '';
    $('#lg-pass').value = '';
    $('#login-msg').textContent = msg || '';
    hideTip();
    history.replaceState(null, '', location.pathname);
    $('#lg-user').focus();
  }

  function resetTimer() { state.timeLeft = SESSION_SECONDS; drawTimer(); }
  function drawTimer() {
    const t = $('#timer');
    t.textContent = `${pad(Math.floor(state.timeLeft / 60))}:${pad(state.timeLeft % 60)}`;
    t.classList.toggle('warn', state.timeLeft <= 60);
  }
  function tick() {
    const d = new Date();
    $('#clock').textContent = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    if (!state.user) return;
    state.timeLeft--;
    drawTimer();
    if (state.timeLeft <= 0) logout('Your session has expired due to inactivity. Please log on again.');
  }

  // ================================================================ router
  const routes = {
    home: viewHome, find: viewFind, advanced: viewAdvanced, nominal: viewNominal, edit: viewEdit, new: viewEdit,
    nominals: viewNominals, orphaned: viewOrphaned, diary: viewDiary, todo: viewTodo, generate: viewGenerate,
    report: viewReport, stats: viewStats, meeting: viewMeeting, info: viewInfo, help: viewHelp,
    password: viewPassword, contact: viewContact, moveuser: viewMoveUser, whitepages: viewWhitePages,
    messages: viewMessages, release: viewRelease
  };

  function render() {
    if (!state.user) return;
    hideTip();
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    const name = routes[parts[0]] ? parts[0] : 'home';
    const main = $('#main');
    main.innerHTML = '';
    routes[name](main, ...parts.slice(1));
    const hash = '#' + parts.filter(Boolean).join('/');
    $$('#sidebar a').forEach(a => {
      const h = a.getAttribute('href');
      a.classList.toggle('active', h === hash || (h === '#' + name && !$$('#sidebar a').some(b => b.getAttribute('href') === hash)));
    });
    window.scrollTo(0, 0);
  }

  // ================================================================ HOME
  function viewHome(main) {
    const all = Store.all();
    const mine = all.filter(isMine);
    const recent = Store.list(userKey('recent')).map(id => Store.get(id)).filter(Boolean);
    const diaryToday = Store.list(userKey('diary')).filter(e => e.date === isoToday());
    const tasks = Store.list(userKey('todo')).filter(t => !t.done);
    const last = state.user.lastLogon ? fmtDateTime(state.user.lastLogon) : 'Never';

    main.innerHTML = page('Home', `
      <div class="cols-2">
        <div>
          ${panel('Welcome', `Welcome to ViSOR, <b>${esc(state.user.name)}</b>.<br>
            You last logged on: <b>${esc(last)}</b>. Access level: <b>${esc(state.user.role)}</b>.<br><br>
            <span class="muted">All access to nominal records is audited. Only view records you have a policing or
            public protection purpose to view.</span>`)}
          ${panel('System Bulletins', D.BULLETINS.map(b =>
            `<div class="log-entry"><span class="when">${esc(fmtDate(b.date))}</span> &nbsp;${esc(b.text)}</div>`).join(''))}
          ${panel('Recently Viewed Nominals', recent.length
            ? `<table class="grid"><tbody>${recent.map(n => `<tr class="click" data-id="${esc(n.id)}"><td>${esc(n.ref)}</td>
                <td><a href="#nominal/${esc(n.id)}">${esc(fullName(n))}</a></td><td>${esc(fmtDate(n.dob))}</td><td>${statusText(n.status)}</td></tr>`).join('')}</tbody></table>`
            : '<span class="muted">No nominals viewed this session.</span>')}
        </div>
        <div>
          ${panel('Quick Find', `<form id="qf" class="toolbar">Surname <input type="text" name="surname" size="18">
              <button type="submit">Find</button> <a href="#advanced/find">Advanced</a></form>`)}
          ${panel('My Caseload', `<table class="form">
              <tr><th>Nominals I manage</th><td><a href="#nominals">${mine.length}</a></td></tr>
              <tr><th>Very High / High risk</th><td>${mine.filter(n => n.risk === 'High' || n.risk === 'Very High').length}</td></tr>
              <tr><th>Wanted / Missing</th><td>${mine.filter(n => n.status === 'Wanted / Missing').length}</td></tr>
              <tr><th>Diary entries today</th><td><a href="#diary">${diaryToday.length}</a></td></tr>
              <tr><th>Outstanding tasks</th><td><a href="#todo">${tasks.length}</a></td></tr>
              <tr><th>Orphaned records (all)</th><td><a href="#orphaned">${all.filter(isOrphan).length}</a></td></tr>
            </table>`)}
          ${canUpdate() ? panel('Actions', `<a class="btn" href="#new">Create New Nominal</a>`) : ''}
        </div>
      </div>`);
    bindRows(main);
    $('#qf').addEventListener('submit', e => {
      e.preventDefault();
      state.find = { surname: e.target.surname.value.trim() };
      go('find');
    });
  }

  // ================================================================ FIND NOMINAL
  function viewFind(main) {
    const c = state.find || {};
    main.innerHTML = page('Find Nominal', `
      ${panel('Search Criteria', `
        <form id="find-form">
          <table class="form">
            <tr><th>Surname</th><td><input type="text" name="surname" value="${esc(c.surname)}">
              <label><input type="checkbox" name="soundex"${c.soundex ? ' checked' : ''}> Soundex</label></td></tr>
            <tr><th>Forename(s)</th><td><input type="text" name="forenames" value="${esc(c.forenames)}"></td></tr>
            <tr><th>Date of Birth</th><td><input type="date" name="dob" value="${esc(c.dob)}"></td></tr>
            <tr><th>ViSOR Reference</th><td><input type="text" name="ref" value="${esc(c.ref)}" placeholder="VR/19/*"></td></tr>
            <tr><th>PNC ID</th><td><input type="text" name="pnc" value="${esc(c.pnc)}"></td></tr>
            <tr><th>Options</th><td><label><input type="checkbox" name="includeArchived"${c.includeArchived ? ' checked' : ''}> Include archived records</label></td></tr>
          </table>
          <div class="form-actions"><button type="submit">Search</button><button type="button" id="find-clear">Clear</button>
            ${canUpdate() ? '<a class="btn" href="#new">Create New Nominal</a>' : ''}</div>
          <p class="muted">Searches match the start of a name. Use * and ? as wildcards (e.g. <b>H*VES</b>). Aliases are searched too.</p>
        </form>`)}
      <div id="find-results"></div>`);

    const form = $('#find-form');
    const run = () => {
      const crit = {
        surname: form.surname.value.trim(), forenames: form.forenames.value.trim(), dob: form.dob.value,
        ref: form.ref.value.trim(), pnc: form.pnc.value.trim(),
        soundex: form.soundex.checked, includeArchived: form.includeArchived.checked
      };
      state.find = crit;
      const any = crit.surname || crit.forenames || crit.dob || crit.ref || crit.pnc;
      const box = $('#find-results');
      if (!any) { box.innerHTML = '<div class="flash err">Enter at least one search criterion.</div>'; return; }
      const list = Store.all().filter(n => matchNominal(n, crit)).sort((a, b) => fullName(a).localeCompare(fullName(b)));
      box.innerHTML = panel('Search Results', resultsTable(list));
      bindRows(box);
    };
    form.addEventListener('submit', e => { e.preventDefault(); run(); });
    $('#find-clear').addEventListener('click', () => { state.find = null; render(); });
    if (state.find && Object.values(state.find).some(v => v && v !== true)) run();
    form.surname.focus();
  }

  // ================================================================ ADVANCED SEARCH
  function viewAdvanced(main, tab) {
    tab = ['find', 'map', 'scotland', 'grid'].includes(tab) ? tab : 'map';
    const tabs = [['find', 'Find'], ['map', 'UK Map'], ['scotland', 'Scotland Map'], ['grid', 'Search Grid']]
      .map(([k, t]) => `<a class="tab${k === tab ? ' active' : ''}" href="#advanced/${k}">${t}</a>`).join('');
    main.innerHTML = page('Advanced Search', `<div class="tabs">${tabs}</div><div id="adv-body"></div>`);
    const body = $('#adv-body');
    ({ find: advFind, map: advMap, scotland: advScotland, grid: advGrid })[tab](body);
  }

  // The Find tab combines its criteria with the area selection; the map tabs search by area only.
  function runAdvanced(label, extra, withCriteria) {
    const a = state.adv;
    const crit = Object.assign({}, withCriteria ? a.criteria : {}, { forces: a.forces, agencies: a.agencies }, extra || {});
    a.results = Store.all().filter(n => matchNominal(n, crit));
    a.label = label;
    go('advanced/grid');
  }

  function advFind(body) {
    const c = state.adv.criteria;
    const types = D.NOMINAL_TYPES.map(t => [t.code, `${t.code} - ${t.label}`]);
    body.innerHTML = `
      <form id="adv-form">
        <div class="cols-2">
          <div>${panel('Person', `<table class="form">
            <tr><th>Surname</th><td><input type="text" name="surname" value="${esc(c.surname)}">
              <label><input type="checkbox" name="soundex"${c.soundex ? ' checked' : ''}> Soundex</label></td></tr>
            <tr><th>Forename(s)</th><td><input type="text" name="forenames" value="${esc(c.forenames)}"></td></tr>
            <tr><th>Sex</th><td><select name="gender">${options(['Male', 'Female', 'Unknown'], c.gender)}</select></td></tr>
            <tr><th>Age range</th><td><input type="number" name="ageFrom" min="0" max="120" style="width:60px" value="${esc(c.ageFrom)}">
              to <input type="number" name="ageTo" min="0" max="120" style="width:60px" value="${esc(c.ageTo)}"></td></tr>
            <tr><th>Warning marker</th><td><select name="marker">${options(D.WARNING_MARKERS.map(m => [m[0], `${m[0]} - ${m[1]}`]), c.marker)}</select></td></tr>
            <tr><th>Address contains</th><td><input type="text" name="address" value="${esc(c.address)}"></td></tr>
            <tr><th>Vehicle VRM</th><td><input type="text" name="vrm" value="${esc(c.vrm)}"></td></tr>
          </table>`)}</div>
          <div>${panel('Management', `<table class="form">
            <tr><th>Nominal type</th><td><select name="type">${options(types, c.type)}</select></td></tr>
            <tr><th>Risk level</th><td><select name="risk">${options(D.RISK_LEVELS, c.risk)}</select></td></tr>
            <tr><th>MAPPA level</th><td><select name="mappa">${options(['1', '2', '3'], c.mappa)}</select></td></tr>
            <tr><th>Record status</th><td><select name="status">${options(D.STATUSES, c.status)}</select></td></tr>
            <tr><th>Offender Manager</th><td><input type="text" name="om" value="${esc(c.om)}"></td></tr>
            <tr><th>Options</th><td><label><input type="checkbox" name="includeArchived"${c.includeArchived ? ' checked' : ''}> Include archived</label></td></tr>
            <tr><th>Area filter</th><td>${state.adv.forces.size
              ? `<b>${state.adv.forces.size}</b> force area(s) selected on the <a href="#advanced/map">UK Map</a>`
              : 'All areas (<a href="#advanced/map">select on UK Map</a>)'}<br>
              ${state.adv.agencies.size}/${ALL_AGENCIES.length} agencies selected</td></tr>
          </table>`)}</div>
        </div>
        <div class="form-actions"><button type="submit">Search</button><button type="button" id="adv-clear">Clear Criteria</button></div>
      </form>`;
    const form = $('#adv-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(form);
      const crit = {};
      for (const [k, v] of fd.entries()) if (String(v).trim()) crit[k] = String(v).trim();
      crit.soundex = form.soundex.checked;
      crit.includeArchived = form.includeArchived.checked;
      state.adv.criteria = crit;
      runAdvanced('Advanced Find', null, true);
    });
    $('#adv-clear').addEventListener('click', () => { state.adv.criteria = {}; render(); });
  }

  function advMap(body) {
    const a = state.adv;
    const counts = {};
    Store.all().forEach(n => {
      const r = regionOf(n.force);
      if (r && n.status !== 'Archived') counts[r.id] = (counts[r.id] || 0) + 1;
    });
    const regionBlock = r => `
      <div class="area-h"><a data-region-toggle="${r.id}">${esc(r.label)}</a>${r.id === 'scotland' ? '<a class="sub" href="#advanced/scotland">Scotland Map</a>' : ''}</div>
      ${r.forces.map(f => `<label class="area-item" data-region="${r.id}">
        <input type="checkbox" data-force="${esc(f)}"${a.forces.has(f) ? ' checked' : ''}><span class="ico"></span>${esc(f)}</label>`).join('')}`;
    const agencyBox = list => list.map(g => `<label class="agency-item"><input type="checkbox" data-agency="${esc(g)}"${a.agencies.has(g) ? ' checked' : ''}> ${esc(g)}</label>`).join('');
    const legend = [['England', '#a6d9cf'], ['Ireland', VMap.COLORS.ireland], ['Scotland', VMap.COLORS.scotland], ['Wales', VMap.COLORS.wales]];

    body.innerHTML = `
      <div class="adv-map">
        <div>
          <div class="map-title">ACPO Regions and Areas</div>
          <div class="map-wrap" id="uk-map"></div>
          <div class="legend">
            <div class="legend-h">Country</div>
            ${legend.map(([n, c]) => `<div class="legend-row"><span class="swatch" style="background:${c}"></span>${n}</div>`).join('')}
            <div class="legend-h">Key</div>
            <div class="legend-row"><span class="swatch" style="background:#fff;border:2px solid #c41e1e"></span>Area selected</div>
            <div class="legend-row"><b style="width:14px;text-align:center">3</b>Active nominals in region</div>
          </div>
        </div>
        <div>
          <div class="area-h">Agencies to Search</div>${agencyBox(D.AGENCIES)}
          <div class="area-h">National Searches</div>${agencyBox(D.NATIONAL_AGENCIES)}
          <div style="margin-top:4px"><a id="ag-all">Check All</a> | <a id="ag-none">Clear All</a></div>
        </div>
        <div>
          <div class="areas-top"><span><a id="ar-all">Check All</a> | <a id="ar-none">Clear All</a></span>
            <a id="search-area" class="search-area">Search For Nominals In Area</a></div>
          <div class="area-cols">
            <div>${D.REGIONS.filter(r => r.col === 1).map(regionBlock).join('')}</div>
            <div>${D.REGIONS.filter(r => r.col === 2).map(regionBlock).join('')}</div>
          </div>
        </div>
      </div>`;

    const hover = (id, on) => {
      map.highlight(id, on);
      $$(`.area-item[data-region="${id}"]`, body).forEach(el => el.classList.toggle('hover', on));
    };
    const regionTip = id => {
      const r = D.REGIONS.find(x => x.id === id);
      const sel = r.forces.filter(f => a.forces.has(f)).length;
      return `<b>${esc(r.label)}</b>${r.forces.map(esc).join('<br>')}<br><i>${counts[id] || 0} active nominal(s) &middot; ${sel}/${r.forces.length} selected</i><br><i>Click to select / deselect</i>`;
    };
    const syncRegion = id => {
      const r = D.REGIONS.find(x => x.id === id);
      map.select(id, r.forces.some(f => a.forces.has(f)));
    };
    const toggleRegion = id => {
      const r = D.REGIONS.find(x => x.id === id);
      const allOn = r.forces.every(f => a.forces.has(f));
      r.forces.forEach(f => allOn ? a.forces.delete(f) : a.forces.add(f));
      $$(`.area-item[data-region="${id}"] input`, body).forEach(cb => { cb.checked = !allOn; });
      syncRegion(id);
      syncButton();
    };
    const syncButton = () => $('#search-area').classList.toggle('ready', a.forces.size > 0);

    const map = VMap.uk($('#uk-map'), {
      counts,
      onEnter: (id, e) => { hover(id, true); showTip(regionTip(id), e); },
      onMove: (id, e) => moveTip(e),
      onLeave: id => { hover(id, false); hideTip(); },
      onClick: (id, e) => { toggleRegion(id); showTip(regionTip(id), e); }
    });
    D.REGIONS.forEach(r => syncRegion(r.id));
    syncButton();

    $$('.area-item', body).forEach(el => {
      el.addEventListener('mouseenter', () => hover(el.dataset.region, true));
      el.addEventListener('mouseleave', () => hover(el.dataset.region, false));
    });
    $$('input[data-force]', body).forEach(cb => cb.addEventListener('change', () => {
      cb.checked ? a.forces.add(cb.dataset.force) : a.forces.delete(cb.dataset.force);
      syncRegion(regionOf(cb.dataset.force).id);
      syncButton();
    }));
    $$('[data-region-toggle]', body).forEach(el => el.addEventListener('click', () => toggleRegion(el.dataset.regionToggle)));
    $$('input[data-agency]', body).forEach(cb => cb.addEventListener('change', () => {
      cb.checked ? a.agencies.add(cb.dataset.agency) : a.agencies.delete(cb.dataset.agency);
    }));
    const setAll = (sel, on, set, key) => $$(sel, body).forEach(cb => {
      cb.checked = on;
      on ? set.add(cb.dataset[key]) : set.delete(cb.dataset[key]);
    });
    $('#ag-all').addEventListener('click', () => setAll('input[data-agency]', true, a.agencies, 'agency'));
    $('#ag-none').addEventListener('click', () => setAll('input[data-agency]', false, a.agencies, 'agency'));
    $('#ar-all').addEventListener('click', () => { setAll('input[data-force]', true, a.forces, 'force'); D.REGIONS.forEach(r => syncRegion(r.id)); syncButton(); });
    $('#ar-none').addEventListener('click', () => { setAll('input[data-force]', false, a.forces, 'force'); D.REGIONS.forEach(r => syncRegion(r.id)); syncButton(); });
    $('#search-area').addEventListener('click', () => {
      if (!a.forces.size) { alert('Please select at least one area to search.'); return; }
      if (!a.agencies.size) { alert('Please select at least one agency to search.'); return; }
      runAdvanced(`Area search: ${a.forces.size} force area(s)`, { includeArchived: false });
    });
  }

  function advScotland(body) {
    const a = state.adv;
    const inScot = Store.all().filter(n => n.force === 'Police Scotland' && n.status !== 'Archived');
    const count = name => inScot.filter(n => n.area === name).length;
    body.innerHTML = `
      <div class="adv-map" style="grid-template-columns: 380px minmax(0,1fr)">
        <div><div class="map-title">Police Scotland Divisions</div><div class="map-wrap" id="scot-map"></div></div>
        <div>
          <div class="areas-top"><span><a id="dv-all">Check All</a> | <a id="dv-none">Clear All</a></span>
            <a id="dv-search" class="search-area ready">Search For Nominals In Division</a></div>
          <div class="area-h">Police Scotland</div>
          ${D.SCOTLAND_DIVISIONS.map(d => `<label class="area-item" data-div="${esc(d.name)}">
            <input type="checkbox" data-division="${esc(d.name)}"${a.divisions.has(d.name) ? ' checked' : ''}><span class="ico"></span>${esc(d.name)}
            <span class="muted">(${count(d.name)})</span></label>`).join('')}
          <p class="muted">Leave all divisions clear to search the whole of Police Scotland.</p>
        </div>
      </div>`;
    const hover = (name, on) => {
      map.highlight(name, on);
      $$('.area-item', body).filter(el => el.dataset.div === name).forEach(el => el.classList.toggle('hover', on));
    };
    const toggle = name => {
      a.divisions.has(name) ? a.divisions.delete(name) : a.divisions.add(name);
      map.select(name, a.divisions.has(name));
      $$('input[data-division]', body).filter(cb => cb.dataset.division === name).forEach(cb => { cb.checked = a.divisions.has(name); });
    };
    const map = VMap.scotland($('#scot-map'), {
      divisions: D.SCOTLAND_DIVISIONS,
      onEnter: (name, e) => { hover(name, true); showTip(`<b>${esc(name)}</b>${count(name)} active nominal(s)<br><i>Click to select / deselect</i>`, e); },
      onMove: (n, e) => moveTip(e),
      onLeave: name => { hover(name, false); hideTip(); },
      onClick: name => toggle(name)
    });
    D.SCOTLAND_DIVISIONS.forEach(d => map.select(d.name, a.divisions.has(d.name)));
    $$('.area-item', body).forEach(el => {
      el.addEventListener('mouseenter', () => hover(el.dataset.div, true));
      el.addEventListener('mouseleave', () => hover(el.dataset.div, false));
    });
    $$('input[data-division]', body).forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked !== a.divisions.has(cb.dataset.division)) toggle(cb.dataset.division);
    }));
    const setAll = on => D.SCOTLAND_DIVISIONS.forEach(d => { if (a.divisions.has(d.name) !== on) toggle(d.name); });
    $('#dv-all').addEventListener('click', () => setAll(true));
    $('#dv-none').addEventListener('click', () => setAll(false));
    $('#dv-search').addEventListener('click', () => {
      const label = a.divisions.size ? `Police Scotland: ${a.divisions.size} division(s)` : 'Police Scotland: all divisions';
      runAdvanced(label, { forces: new Set(['Police Scotland']), divisions: a.divisions, includeArchived: false });
    });
  }

  function advGrid(body) {
    const a = state.adv;
    if (!a.results) {
      body.innerHTML = '<div class="notice">No search has been run yet. Use the <a href="#advanced/find">Find</a>, <a href="#advanced/map">UK Map</a> or <a href="#advanced/scotland">Scotland Map</a> tabs to search.</div>';
      return;
    }
    // Re-read records so edits made since the search show up.
    const list = a.results.map(n => Store.get(n.id)).filter(Boolean);
    const { key, dir } = a.sort;
    list.sort((x, y) => {
      const p = sortValue(x, key), q = sortValue(y, key);
      return (p < q ? -1 : p > q ? 1 : 0) * dir;
    });
    body.innerHTML = `
      <div class="toolbar"><b>${esc(a.label)}</b><span class="muted">&middot; click a column heading to sort</span>
        <span style="flex:1"></span><button type="button" id="grid-csv"${list.length ? '' : ' disabled'}>Export CSV</button>
        <button type="button" id="grid-print">Print</button></div>
      ${resultsTable(list, a.sort)}`;
    bindRows(body);
    $$('th[data-sort]', body).forEach(th => th.addEventListener('click', () => {
      a.sort = { key: th.dataset.sort, dir: a.sort.key === th.dataset.sort ? -a.sort.dir : 1 };
      advGrid(body);
    }));
    $('#grid-print').addEventListener('click', () => window.print());
    $('#grid-csv').addEventListener('click', () => {
      const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const rows = [RESULT_COLS.map(c => q(c[1])).join(',')].concat(list.map(n =>
        RESULT_COLS.map(([k]) => q(k === 'name' ? fullName(n) : k === 'age' ? age(n.dob) : n[k])).join(',')));
      download('visor-search.csv', rows.join('\r\n'), 'text/csv');
    });
  }

  // ================================================================ NOMINAL RECORD
  const SILHOUETTE = `<svg viewBox="0 0 112 142" aria-label="No photograph">
      <rect width="112" height="142" fill="#d9dde5"/>
      <circle cx="56" cy="52" r="24" fill="#a9b0bf"/>
      <path d="M14,142 Q16,92 56,88 Q96,92 98,142 Z" fill="#a9b0bf"/>
      <text x="56" y="136" text-anchor="middle" font-size="8" fill="#6b7385">NO IMAGE</text></svg>`;

  function rememberRecent(id) {
    const key = userKey('recent');
    const list = Store.list(key).filter(x => x !== id);
    list.unshift(id);
    Store.setList(key, list.slice(0, 8));
  }

  function rowsTable(cols, rows, empty) {
    if (!rows || !rows.length) return `<span class="muted">${empty}</span>`;
    return `<table class="grid"><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${cols.map(([k, , f]) => `<td>${esc(f ? f(r[k]) : r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function viewNominal(main, id, tab) {
    const n = Store.get(id);
    if (!n) { main.innerHTML = page('Nominal', '<div class="flash err">Nominal record not found. It may have been deleted.</div>'); return; }
    rememberRecent(id);
    tab = tab || 'summary';
    const t = typeOf(n.type);
    const region = regionOf(n.force);
    const TABS = [['summary', 'Summary'], ['personal', 'Personal Details'], ['addresses', 'Addresses'],
      ['offences', 'Offences &amp; Orders'], ['vehicles', 'Vehicles'], ['associates', 'Associates'],
      ['risk', 'Risk &amp; MAPPA'], ['log', `Activity Log (${(n.log || []).length})`]];
    const current = (n.addresses || []).find(x => !x.to && x.type !== 'Previous');

    const sections = {
      summary: () => `<div class="cols-2"><div>${panel('Key Details', `<table class="form">
          <tr><th>Nominal type</th><td>${esc(typeLabel(n.type))}</td></tr>
          <tr><th>MAPPA</th><td>Category ${t ? t.mappaCat : '-'} &middot; Level ${esc(n.mappaLevel || '-')}</td></tr>
          <tr><th>Risk level</th><td>${riskPill(n.risk)}</td></tr>
          <tr><th>Current address</th><td>${current ? esc(current.address) : '<span class="muted">None recorded</span>'}</td></tr>
          <tr><th>Notification</th><td>${esc(n.notification)}</td></tr>
          <tr><th>Registration</th><td>${esc(fmtDate(n.registered))} to ${esc(fmtDate(n.expiry) || 'not set')}</td></tr>
        </table>`)}</div><div>${panel('Risk Summary', n.riskNotes ? `<div class="pre">${esc(n.riskNotes)}</div>` : '<span class="muted">None recorded.</span>')}
          ${panel('Latest Activity', (n.log || []).slice(-3).reverse().map(logHtml).join('') || '<span class="muted">None.</span>')}</div></div>`,
      personal: () => panel('Personal Details', `<table class="form">
          <tr><th>Surname</th><td>${esc(n.surname)}</td></tr>
          <tr><th>Forename(s)</th><td>${esc(n.forenames)}</td></tr>
          <tr><th>Aliases / AKA</th><td>${esc(n.aliases) || '<span class="muted">None</span>'}</td></tr>
          <tr><th>Date of birth</th><td>${esc(fmtDate(n.dob))} (age ${esc(age(n.dob))})</td></tr>
          <tr><th>Place of birth</th><td>${esc(n.pob)}</td></tr>
          <tr><th>Sex</th><td>${esc(n.gender)}</td></tr>
          <tr><th>Ethnic appearance</th><td>${esc((D.ETHNICITY.find(e => e[0] === n.ethnicity) || ['', n.ethnicity])[1])}</td></tr>
          <tr><th>Height</th><td>${n.height ? esc(n.height) + ' cm' : ''}</td></tr>
          <tr><th>Build</th><td>${esc(n.build)}</td></tr>
          <tr><th>Hair</th><td>${esc(n.hair)}</td></tr>
          <tr><th>Eyes</th><td>${esc(n.eyes)}</td></tr>
          <tr><th>Scars / marks / tattoos</th><td class="pre">${esc(n.marks)}</td></tr>
          <tr><th>PNC ID</th><td>${esc(n.pnc)}</td></tr>
          <tr><th>CRO number</th><td>${esc(n.cro)}</td></tr>
        </table>`),
      addresses: () => panel('Addresses', rowsTable([['type', 'Type'], ['address', 'Address'], ['from', 'From', fmtDate], ['to', 'To', v => fmtDate(v) || 'Current']],
        n.addresses, 'No addresses recorded.')),
      offences: () => panel('Offences', rowsTable([['date', 'Date', fmtDate], ['offence', 'Offence'], ['court', 'Court'], ['sentence', 'Sentence / Disposal']],
        n.offences, 'No offences recorded.')) +
        panel('Orders / Licence Conditions', n.orders ? `<div class="pre">${esc(n.orders)}</div>` : '<span class="muted">None recorded.</span>'),
      vehicles: () => panel('Vehicles', rowsTable([['vrm', 'VRM'], ['make', 'Make'], ['model', 'Model'], ['colour', 'Colour']],
        n.vehicles, 'No vehicles recorded.')),
      associates: () => panel('Associates', rowsTable([['name', 'Name'], ['relationship', 'Relationship'], ['notes', 'Notes']],
        n.associates, 'No associates recorded.')),
      risk: () => panel('Risk & MAPPA', `<table class="form">
          <tr><th>Risk level</th><td>${riskPill(n.risk)}</td></tr>
          <tr><th>MAPPA category</th><td>${t ? `Category ${t.mappaCat} (${esc(t.label)})` : ''}</td></tr>
          <tr><th>MAPPA level</th><td>${esc(n.mappaLevel)}</td></tr>
          <tr><th>Warning markers</th><td>${(n.markers || []).map(m => `<span class="marker">${esc(m)} - ${esc(markerLabel(m))}</span>`).join('') || 'None'}</td></tr>
          <tr><th>Risk summary</th><td class="pre">${esc(n.riskNotes)}</td></tr>
        </table>`),
      log: () => panel('Activity Log', `
          ${canUpdate() ? `<form id="log-form"><textarea name="text" rows="3" placeholder="Add a log entry (visit, contact, intelligence, review...)"></textarea>
            <div class="form-actions"><select name="kind">${options(['Note', 'Home Visit', 'Contact', 'Intelligence', 'Risk Review', 'MAPPA Meeting'], 'Note', false)}</select>
            <button type="submit">Add Entry</button></div></form><hr>` : ''}
          ${(n.log || []).slice().reverse().map(logHtml).join('') || '<span class="muted">No entries.</span>'}`)
    };
    if (!sections[tab]) tab = 'summary';

    main.innerHTML = page('Nominal Record', `
      <div class="class-banner">RESTRICTED</div>
      <div class="nom-head">
        <div class="nom-photo">${n.photo ? `<img src="${esc(n.photo)}" alt="Photograph">` : SILHOUETTE}</div>
        <div class="nom-id">
          <div class="nom-name">${esc(fullName(n))}</div>
          <div>${(n.markers || []).map(m => `<span class="marker" title="${esc(markerLabel(m))}">${esc(m)}</span>`).join('')}</div>
          <div class="nom-meta">
            <b>ViSOR Ref</b><span>${esc(n.ref)}</span><b>PNC ID</b><span>${esc(n.pnc)}</span>
            <b>Date of Birth</b><span>${esc(fmtDate(n.dob))} (${esc(age(n.dob))})</span><b>Sex</b><span>${esc(n.gender)}</span>
            <b>Type</b><span>${esc(typeLabel(n.type))}</span><b>Status</b><span>${statusText(n.status)}</span>
            <b>Owning Force</b><span>${esc(n.force)}${region ? ` (${esc(region.label)})` : ''}</span><b>Division / LPA</b><span>${esc(n.area)}</span>
            <b>Offender Mgr</b><span>${esc(n.offenderManager) || '<span class="status-Wanted-Missing">UNALLOCATED</span>'}</span><b>Lead Agency</b><span>${esc(n.agency)}</span>
          </div>
          <div class="muted">Created ${esc(fmtDateTime(n.created))} by ${esc(n.createdBy)} &middot; Last updated ${esc(fmtDateTime(n.updated))}</div>
        </div>
        <div class="nom-actions">
          ${canUpdate() ? `<a class="btn" href="#edit/${esc(n.id)}">Edit Record</a>` : ''}
          ${canUpdate() ? `<a class="btn" href="#nominal/${esc(n.id)}/log">Add Log Entry</a>` : ''}
          ${canUpdate() && !n.offenderManager ? '<button type="button" id="nm-claim">Take Ownership</button>' : ''}
          <a class="btn" href="#report/${esc(n.id)}">Generate Report</a>
          ${canUpdate() ? `<button type="button" id="nm-archive">${n.status === 'Archived' ? 'Reactivate' : 'Archive'}</button>` : ''}
          ${isAdmin() ? '<button type="button" class="danger" id="nm-delete">Delete</button>' : ''}
        </div>
      </div>
      <div class="tabs">${TABS.map(([k, l]) => `<a class="tab${k === tab ? ' active' : ''}" href="#nominal/${esc(n.id)}/${k}">${l}</a>`).join('')}</div>
      ${sections[tab]()}`, '<a href="javascript:history.back()">&laquo; Back</a>');

    const addLog = (text) => {
      n.log = n.log || [];
      n.log.push({ ts: new Date().toISOString(), user: state.user.name, text });
      Store.save(n);
    };
    const logForm = $('#log-form');
    if (logForm) logForm.addEventListener('submit', e => {
      e.preventDefault();
      const text = logForm.text.value.trim();
      if (!text) return;
      addLog(`[${logForm.kind.value}] ${text}`);
      flash('Log entry added.');
      render();
    });
    const claim = $('#nm-claim');
    if (claim) claim.addEventListener('click', () => {
      n.offenderManager = state.user.name;
      n.agency = n.agency || state.user.agency;
      addLog('Ownership taken by ' + state.user.name + '.');
      flash('You are now the Offender Manager for this nominal.');
      render();
    });
    const arch = $('#nm-archive');
    if (arch) arch.addEventListener('click', () => {
      const reactivate = n.status === 'Archived';
      if (!confirm(reactivate ? 'Reactivate this record?' : 'Archive this record? It will be hidden from searches by default.')) return;
      n.status = reactivate ? 'Active' : 'Archived';
      addLog(reactivate ? 'Record reactivated.' : 'Record archived.');
      flash(reactivate ? 'Record reactivated.' : 'Record archived.');
      render();
    });
    const del = $('#nm-delete');
    if (del) del.addEventListener('click', () => {
      if (prompt(`Type DELETE to permanently delete ${fullName(n)} (${n.ref}).`) !== 'DELETE') return;
      Store.remove(n.id);
      flash(`Record ${n.ref} deleted.`);
      go('nominals');
    });
  }

  function logHtml(l) {
    return `<div class="log-entry"><span class="when">${esc(fmtDateTime(l.ts))} &middot; ${esc(l.user)}</span><div class="pre">${esc(l.text)}</div></div>`;
  }

  // ================================================================ CREATE / EDIT
  const ROW_DEFS = {
    addresses: { title: 'Addresses', one: 'Address', cols: [['type', 'Type', D.ADDRESS_TYPES], ['address', 'Address'], ['from', 'From', 'date'], ['to', 'To', 'date']] },
    offences: { title: 'Offences', one: 'Offence', cols: [['date', 'Date', 'date'], ['offence', 'Offence'], ['court', 'Court'], ['sentence', 'Sentence / Disposal']] },
    vehicles: { title: 'Vehicles', one: 'Vehicle', cols: [['vrm', 'VRM'], ['make', 'Make'], ['model', 'Model'], ['colour', 'Colour']] },
    associates: { title: 'Associates', one: 'Associate', cols: [['name', 'Name'], ['relationship', 'Relationship'], ['notes', 'Notes']] }
  };

  function formSections() {
    const types = D.NOMINAL_TYPES.map(t => [t.code, `${t.code} - ${t.label}`]);
    return [
      ['Identification', [
        ['surname', 'Surname', 'text', true], ['forenames', 'Forename(s)', 'text', true], ['aliases', 'Aliases / AKA', 'text'],
        ['dob', 'Date of Birth', 'date', true], ['pob', 'Place of Birth', 'text'], ['gender', 'Sex', ['Male', 'Female', 'Unknown'], true],
        ['ethnicity', 'Ethnic Appearance', D.ETHNICITY], ['pnc', 'PNC ID', 'text'], ['cro', 'CRO Number', 'text'],
        ['photo', 'Photograph URL', 'text']]],
      ['Description', [
        ['height', 'Height (cm)', 'number'], ['build', 'Build', D.BUILDS], ['hair', 'Hair', 'text'], ['eyes', 'Eyes', 'text'],
        ['marks', 'Scars / Marks / Tattoos', 'textarea']]],
      ['Registration & Management', [
        ['type', 'Nominal Type', types, true], ['status', 'Record Status', D.STATUSES, true], ['risk', 'Risk Level', D.RISK_LEVELS],
        ['mappaLevel', 'MAPPA Level', ['1', '2', '3']], ['force', 'Owning Force', 'force', true], ['area', 'Division / LPA', 'text'],
        ['agency', 'Lead Agency', ALL_AGENCIES], ['offenderManager', 'Offender Manager', 'text'], ['omContact', 'OM Contact Number', 'text'],
        ['registered', 'Registration Date', 'date'], ['expiry', 'Registration Expiry', 'text'], ['notification', 'Notification Period', D.NOTIFICATION]]],
      ['Orders & Risk', [['orders', 'Orders / Licence Conditions', 'textarea'], ['riskNotes', 'Risk Summary', 'textarea']]]
    ];
  }

  function fieldHtml([key, label, type, required], n) {
    const v = n[key] == null ? '' : n[key];
    let input;
    if (Array.isArray(type)) input = `<select name="${key}">${options(type, v)}</select>`;
    else if (type === 'force') input = `<select name="${key}">${forceOptions(v)}</select>`;
    else if (type === 'textarea') input = `<textarea name="${key}" rows="3">${esc(v)}</textarea>`;
    else input = `<input type="${type}" name="${key}" value="${esc(v)}"${key === 'surname' ? ' style="text-transform:uppercase"' : ''}${key === 'expiry' ? ' placeholder="dd/mm/yyyy or Indefinite"' : ''}>`;
    return `<tr><th>${label}${required ? ' <span class="req">*</span>' : ''}</th><td>${input}</td></tr>`;
  }

  function rowEditorRow(def, r) {
    return `<tr>${def.cols.map(([k, , type]) => {
      const v = r[k] == null ? '' : r[k];
      const input = Array.isArray(type)
        ? `<select data-f="${k}">${options(type, v)}</select>`
        : `<input type="${type || 'text'}" data-f="${k}" value="${esc(v)}">`;
      return `<td>${input}</td>`;
    }).join('')}<td style="width:1%"><button type="button" class="danger" data-remove>Remove</button></td></tr>`;
  }

  function rowEditor(key, rows) {
    const def = ROW_DEFS[key];
    return panel(def.title, `<table class="grid"><thead><tr>${def.cols.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead>
      <tbody data-rows="${key}">${(rows || []).map(r => rowEditorRow(def, r)).join('')}</tbody></table>
      <div class="toolbar"><button type="button" data-add="${key}">Add ${def.one}</button></div>`);
  }

  function viewEdit(main, id) {
    if (!canUpdate()) { main.innerHTML = page('Access Denied', '<div class="flash err">Your account has read-only access and cannot create or edit records.</div>'); return; }
    const existing = id ? Store.get(id) : null;
    if (id && !existing) { main.innerHTML = page('Edit Nominal', '<div class="flash err">Nominal record not found.</div>'); return; }
    const n = existing ? JSON.parse(JSON.stringify(existing)) : {
      status: 'Active', registered: isoToday(), offenderManager: state.user.name, agency: state.user.agency,
      force: state.user.force, markers: [], addresses: [], offences: [], vehicles: [], associates: []
    };
    const sections = formSections();

    main.innerHTML = page(existing ? `Edit Nominal: ${fullName(existing)} (${existing.ref})` : 'Create New Nominal', `
      <form id="nom-form" novalidate>
        <div class="errors" id="form-errors"></div>
        <div class="cols-2">
          <div>${sections.slice(0, 2).map(([t, fields]) => panel(t, `<table class="form">${fields.map(f => fieldHtml(f, n)).join('')}</table>`)).join('')}</div>
          <div>${sections.slice(2, 3).map(([t, fields]) => panel(t, `<table class="form">${fields.map(f => fieldHtml(f, n)).join('')}</table>`)).join('')}
            ${panel('Warning Markers', `<div class="chk-list">${D.WARNING_MARKERS.map(([c, l]) =>
              `<label><input type="checkbox" name="markers" value="${c}"${(n.markers || []).includes(c) ? ' checked' : ''}> ${c} - ${l}</label>`).join('')}</div>`)}
          </div>
        </div>
        ${sections.slice(3).map(([t, fields]) => panel(t, `<table class="form">${fields.map(f => fieldHtml(f, n)).join('')}</table>`)).join('')}
        ${Object.keys(ROW_DEFS).map(k => rowEditor(k, n[k])).join('')}
        <div class="form-actions">
          <button type="submit"><b>Save Record</b></button>
          <a class="btn" href="${existing ? '#nominal/' + esc(existing.id) : '#nominals'}">Cancel</a>
        </div>
      </form>`);

    const form = $('#nom-form');
    form.addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      if (add) {
        const key = add.dataset.add;
        $(`tbody[data-rows="${key}"]`, form).insertAdjacentHTML('beforeend', rowEditorRow(ROW_DEFS[key], {}));
      }
      const rm = e.target.closest('[data-remove]');
      if (rm) rm.closest('tr').remove();
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const data = {};
      sections.forEach(([, fields]) => fields.forEach(([k]) => { data[k] = String(form.elements[k].value || '').trim(); }));
      data.surname = data.surname.toUpperCase();
      data.markers = $$('input[name="markers"]:checked', form).map(cb => cb.value);
      Object.keys(ROW_DEFS).forEach(key => {
        data[key] = $$(`tbody[data-rows="${key}"] tr`, form).map(tr => {
          const o = {};
          $$('[data-f]', tr).forEach(inp => { o[inp.dataset.f] = inp.value.trim(); });
          return o;
        }).filter(o => Object.values(o).some(Boolean));
      });

      const errors = [];
      sections.forEach(([, fields]) => fields.forEach(([k, label, , req]) => { if (req && !data[k]) errors.push(`${label} is required.`); }));
      if (data.dob && new Date(data.dob) > new Date()) errors.push('Date of Birth cannot be in the future.');
      if (data.photo && !/^(https?:|nui:|data:image\/)/i.test(data.photo)) errors.push('Photograph URL must start with http(s)://');
      const dupe = Store.all().find(x => x.id !== (existing && existing.id) && x.surname === data.surname &&
        (x.forenames || '').toUpperCase() === data.forenames.toUpperCase() && x.dob === data.dob);
      if (dupe) errors.push(`A nominal with the same name and date of birth already exists (${dupe.ref}).`);
      if (errors.length) {
        $('#form-errors').innerHTML = `<div class="flash err"><b>The record could not be saved:</b><ul>${errors.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
        window.scrollTo(0, 0);
        return;
      }

      const now = new Date().toISOString();
      let rec;
      if (existing) {
        const changed = Object.keys(data).filter(k => JSON.stringify(existing[k] == null ? '' : existing[k]) !== JSON.stringify(data[k]));
        rec = Object.assign(existing, data);
        rec.log = rec.log || [];
        rec.log.push({ ts: now, user: state.user.name, text: changed.length ? `Record updated: ${changed.join(', ')}.` : 'Record saved (no changes).' });
      } else {
        rec = Object.assign({ id: Store.newId(), ref: Store.nextRef(), created: now, createdBy: state.user.name }, data);
        rec.log = [{ ts: now, user: state.user.name, text: 'Nominal record created.' }];
      }
      Store.save(rec);
      flash(existing ? 'Record saved successfully.' : `New nominal created with reference ${rec.ref}.`);
      go('nominal/' + rec.id);
    });
    form.surname.focus();
  }

  // ================================================================ LISTS
  const isOrphan = n => n.status !== 'Archived' && !n.offenderManager;

  function viewNominals(main, which) {
    const all = which === 'all';
    const list = Store.all().filter(n => all || isMine(n)).sort((a, b) => fullName(a).localeCompare(fullName(b)));
    main.innerHTML = page(all ? 'All Nominals' : 'My Nominals', `
      <div class="toolbar">
        <a class="tab${all ? '' : ' active'}" href="#nominals">Managed by me</a>
        <a class="tab${all ? ' active' : ''}" href="#nominals/all">All nominals</a>
        <span style="flex:1"></span>${canUpdate() ? '<a class="btn" href="#new">Create New Nominal</a>' : ''}
      </div>
      ${list.length ? resultsTable(list) : `<div class="notice">You are not recorded as the Offender Manager for any nominals.
        <a href="#nominals/all">View all nominals</a> or <a href="#orphaned">find orphaned records</a> to take ownership.</div>`}`);
    bindRows(main);
  }

  function viewOrphaned(main) {
    const list = Store.all().filter(isOrphan);
    main.innerHTML = page('Find Orphaned', `
      <p>Orphaned records are active nominals with no Offender Manager allocated. Open a record and use
        <b>Take Ownership</b> to allocate it to yourself.</p>${resultsTable(list)}`);
    bindRows(main);
  }

  // ================================================================ DIARY / TO DO / MEETING
  function viewDiary(main, mode) {
    const key = userKey('diary');
    const all = Store.list(key);
    const previous = mode === 'previous';
    const day = previous ? null : (sessionStorage.getItem('visor.diaryDay') || isoToday());
    const list = (previous ? all.filter(e => e.date < isoToday()) : all.filter(e => e.date === day))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time) * (previous ? 1 : -1));
    const noms = Store.all().slice().sort((a, b) => fullName(a).localeCompare(fullName(b)));

    main.innerHTML = page(previous ? 'Diary: Previous Entries' : 'Diary', `
      ${previous ? '' : panel('Diary Date', `<div class="toolbar"><button type="button" id="d-prev">&laquo;</button>
          <input type="date" id="d-day" value="${esc(day)}"><button type="button" id="d-next">&raquo;</button>
          <button type="button" id="d-today">Today</button></div>`)}
      ${previous ? '' : panel('New Entry', `<form id="d-form" class="toolbar">
          <input type="time" name="time" value="09:00">
          <select name="nominal"><option value="">(no nominal)</option>${noms.map(x => `<option value="${esc(x.id)}">${esc(fullName(x))} - ${esc(x.ref)}</option>`).join('')}</select>
          <input type="text" name="text" size="50" placeholder="e.g. Home visit, risk review due">
          <button type="submit">Add</button></form>`)}
      ${panel(previous ? 'Entries before today' : `Entries for ${fmtDate(day)}`, list.length
        ? `<table class="grid"><thead><tr><th>Date</th><th>Time</th><th>Nominal</th><th>Entry</th><th></th></tr></thead><tbody>
          ${list.map(e => { const nm = e.nominal && Store.get(e.nominal); return `<tr><td>${esc(fmtDate(e.date))}</td><td>${esc(e.time)}</td>
            <td>${nm ? `<a href="#nominal/${esc(nm.id)}">${esc(fullName(nm))}</a>` : ''}</td><td>${esc(e.text)}</td>
            <td style="width:1%"><button type="button" class="danger" data-del="${esc(e.id)}">Delete</button></td></tr>`; }).join('')}</tbody></table>`
        : '<span class="muted">No diary entries.</span>')}`);

    $$('[data-del]', main).forEach(b => b.addEventListener('click', () => {
      Store.setList(key, all.filter(e => e.id !== b.dataset.del));
      render();
    }));
    if (previous) return;
    const setDay = d => { sessionStorage.setItem('visor.diaryDay', d); render(); };
    const shift = n => { const d = new Date(day); d.setDate(d.getDate() + n); setDay(d.toISOString().slice(0, 10)); };
    $('#d-day').addEventListener('change', e => e.target.value && setDay(e.target.value));
    $('#d-prev').addEventListener('click', () => shift(-1));
    $('#d-next').addEventListener('click', () => shift(1));
    $('#d-today').addEventListener('click', () => setDay(isoToday()));
    $('#d-form').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      if (!f.text.value.trim()) return;
      all.push({ id: uid(), date: day, time: f.time.value, nominal: f.nominal.value, text: f.text.value.trim() });
      Store.setList(key, all);
      render();
    });
  }

  function viewTodo(main, mode) {
    const key = userKey('todo');
    const all = Store.list(key);
    const previous = mode === 'previous';
    const list = all.filter(t => !!t.done === previous).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
    main.innerHTML = page(previous ? 'To Do List: Completed' : 'To Do List', `
      ${previous ? '' : panel('New Task', `<form id="t-form" class="toolbar">
          <input type="text" name="text" size="50" placeholder="Task description"> Due <input type="date" name="due">
          <select name="priority">${options(['Normal', 'High', 'Urgent'], 'Normal', false)}</select>
          <button type="submit">Add Task</button></form>`)}
      ${panel(previous ? 'Completed Tasks' : 'Outstanding Tasks', list.length
        ? `<table class="grid"><thead><tr><th></th><th>Task</th><th>Priority</th><th>Due</th><th></th></tr></thead><tbody>
          ${list.map(t => `<tr><td style="width:1%"><input type="checkbox" data-done="${esc(t.id)}"${t.done ? ' checked' : ''}></td>
            <td>${esc(t.text)}</td><td>${t.priority === 'Normal' ? 'Normal' : `<b class="status-Wanted-Missing">${esc(t.priority)}</b>`}</td>
            <td>${esc(fmtDate(t.due))}${!t.done && t.due && t.due < isoToday() ? ' <b class="status-Wanted-Missing">OVERDUE</b>' : ''}</td>
            <td style="width:1%"><button type="button" class="danger" data-del="${esc(t.id)}">Delete</button></td></tr>`).join('')}</tbody></table>`
        : '<span class="muted">No tasks.</span>')}`);
    $$('[data-done]', main).forEach(cb => cb.addEventListener('change', () => {
      const t = all.find(x => x.id === cb.dataset.done);
      t.done = cb.checked;
      Store.setList(key, all);
      render();
    }));
    $$('[data-del]', main).forEach(b => b.addEventListener('click', () => { Store.setList(key, all.filter(x => x.id !== b.dataset.del)); render(); }));
    const f = $('#t-form');
    if (f) f.addEventListener('submit', e => {
      e.preventDefault();
      if (!f.text.value.trim()) return;
      all.push({ id: uid(), text: f.text.value.trim(), due: f.due.value, priority: f.priority.value, done: false });
      Store.setList(key, all);
      render();
    });
  }

  function viewMeeting(main) {
    const key = 'meetings';
    const all = Store.list(key).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const noms = Store.all().filter(n => n.status !== 'Archived').sort((a, b) => fullName(a).localeCompare(fullName(b)));
    main.innerHTML = page('MAPPA Meetings', `
      ${canUpdate() ? panel('Schedule Meeting', `<form id="m-form"><table class="form">
          <tr><th>Nominal</th><td><select name="nominal">${noms.map(n => `<option value="${esc(n.id)}">${esc(fullName(n))} - ${esc(n.ref)}</option>`).join('')}</select></td></tr>
          <tr><th>Date / Time</th><td><input type="date" name="date" value="${isoToday()}"> <input type="time" name="time" value="10:00"></td></tr>
          <tr><th>MAPPA Level</th><td><select name="level">${options(['1', '2', '3'], '2', false)}</select></td></tr>
          <tr><th>Venue</th><td><input type="text" name="venue"></td></tr>
          <tr><th>Attendees</th><td><input type="text" name="attendees" placeholder="Police, Probation, Housing, Social Care..."></td></tr>
          <tr><th>Notes</th><td><textarea name="notes" rows="2"></textarea></td></tr>
        </table><div class="form-actions"><button type="submit">Schedule</button></div></form>`) : ''}
      ${panel('Meetings', all.length ? `<table class="grid"><thead><tr><th>Date</th><th>Time</th><th>Nominal</th><th>Level</th><th>Venue</th><th>Attendees</th><th>Notes</th><th></th></tr></thead><tbody>
        ${all.map(m => { const n = Store.get(m.nominal); return `<tr><td>${esc(fmtDate(m.date))}${m.date < isoToday() ? ' <span class="muted">(past)</span>' : ''}</td><td>${esc(m.time)}</td>
          <td>${n ? `<a href="#nominal/${esc(n.id)}">${esc(fullName(n))}</a>` : '<span class="muted">Deleted</span>'}</td><td>${esc(m.level)}</td>
          <td>${esc(m.venue)}</td><td>${esc(m.attendees)}</td><td>${esc(m.notes)}</td>
          <td style="width:1%">${canUpdate() ? `<button type="button" class="danger" data-del="${esc(m.id)}">Cancel</button>` : ''}</td></tr>`; }).join('')}
        </tbody></table>` : '<span class="muted">No meetings scheduled.</span>')}`);
    $$('[data-del]', main).forEach(b => b.addEventListener('click', () => {
      if (!confirm('Cancel this meeting?')) return;
      Store.setList(key, all.filter(m => m.id !== b.dataset.del));
      render();
    }));
    const f = $('#m-form');
    if (f) f.addEventListener('submit', e => {
      e.preventDefault();
      if (!f.nominal.value || !f.date.value) return;
      const m = { id: uid(), nominal: f.nominal.value, date: f.date.value, time: f.time.value, level: f.level.value,
        venue: f.venue.value.trim(), attendees: f.attendees.value.trim(), notes: f.notes.value.trim() };
      all.push(m);
      Store.setList(key, all);
      const n = Store.get(m.nominal);
      if (n) {
        n.log = n.log || [];
        n.log.push({ ts: new Date().toISOString(), user: state.user.name, text: `[MAPPA Meeting] Level ${m.level} meeting scheduled for ${fmtDate(m.date)} ${m.time}.` });
        Store.save(n);
      }
      flash('Meeting scheduled.');
      render();
    });
  }

  // ================================================================ GENERATE / REPORT / STATS
  function viewGenerate(main) {
    const noms = Store.all().slice().sort((a, b) => fullName(a).localeCompare(fullName(b)));
    main.innerHTML = page('Generate', `
      ${panel('Nominal Report', `<div class="toolbar"><select id="g-nom">${noms.map(n => `<option value="${esc(n.id)}">${esc(fullName(n))} - ${esc(n.ref)}</option>`).join('')}</select>
        <button type="button" id="g-report">Generate Report</button></div>`)}
      ${panel('Database', `<p>The database is held in this browser. Export it to share between machines, or to back it up.</p>
        <div class="toolbar"><button type="button" id="g-export">Export Database (.json)</button>
        ${isAdmin() ? `<button type="button" id="g-import">Import Database (.json)</button><input type="file" id="g-file" accept=".json,application/json" hidden>
          <button type="button" class="danger" id="g-reset">Reset to Demo Data</button>` : '<span class="muted">Import and reset require ADMIN access.</span>'}</div>`)}`);
    $('#g-report').addEventListener('click', () => go('report/' + $('#g-nom').value));
    $('#g-export').addEventListener('click', () => download(`visor-export-${isoToday()}.json`, Store.exportJSON()));
    if (!isAdmin()) return;
    $('#g-import').addEventListener('click', () => $('#g-file').click());
    $('#g-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      file.text().then(text => {
        if (!confirm('Importing replaces every nominal currently held. Continue?')) return;
        try { flash(`Imported ${Store.importJSON(text)} nominal record(s).`); } catch (err) { flash('Import failed: ' + err.message, true); }
        render();
      });
    });
    $('#g-reset').addEventListener('click', () => {
      if (!confirm('Reset the database to the demo records? All changes will be lost.')) return;
      Store.reset();
      flash('Database reset to demo data.');
      render();
    });
  }

  function viewReport(main, id) {
    const n = Store.get(id);
    if (!n) { main.innerHTML = page('Report', '<div class="flash err">Nominal not found.</div>'); return; }
    const t = typeOf(n.type);
    const table = (cols, rows) => rows && rows.length
      ? `<table class="grid"><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(r =>
          `<tr>${cols.map(([k]) => `<td>${esc(/^(date|from|to)$/.test(k) ? fmtDate(r[k]) : r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : '<span class="muted">None recorded.</span>';
    main.innerHTML = `
      <div class="toolbar no-print"><a href="#nominal/${esc(n.id)}">&laquo; Back to record</a><button type="button" onclick="window.print()">Print</button></div>
      <div class="report">
        <div class="class-banner">RESTRICTED</div>
        <h1 style="font-size:15px;margin:6px 0">ViSOR Nominal Report: ${esc(fullName(n))}</h1>
        <div class="muted">Generated ${esc(fmtDateTime(new Date().toISOString()))} by ${esc(state.user.name)}</div>
        <h2>Identification</h2>
        <table class="form">
          <tr><th>ViSOR Ref</th><td>${esc(n.ref)}</td><th>PNC ID</th><td>${esc(n.pnc)}</td></tr>
          <tr><th>Date of Birth</th><td>${esc(fmtDate(n.dob))} (${esc(age(n.dob))})</td><th>Sex</th><td>${esc(n.gender)}</td></tr>
          <tr><th>Aliases</th><td colspan="3">${esc(n.aliases)}</td></tr>
          <tr><th>Description</th><td colspan="3">${esc([n.height && n.height + 'cm', n.build, n.hair && 'Hair: ' + n.hair, n.eyes && 'Eyes: ' + n.eyes].filter(Boolean).join(', '))}</td></tr>
          <tr><th>Marks</th><td colspan="3">${esc(n.marks)}</td></tr>
          <tr><th>Warning markers</th><td colspan="3">${(n.markers || []).map(m => `${esc(m)} (${esc(markerLabel(m))})`).join(', ') || 'None'}</td></tr>
        </table>
        <h2>Management</h2>
        <table class="form">
          <tr><th>Type</th><td>${esc(typeLabel(n.type))}</td><th>Status</th><td>${esc(n.status)}</td></tr>
          <tr><th>MAPPA</th><td>Category ${t ? t.mappaCat : '-'} / Level ${esc(n.mappaLevel)}</td><th>Risk</th><td>${esc(n.risk)}</td></tr>
          <tr><th>Owning Force</th><td>${esc(n.force)}</td><th>Division / LPA</th><td>${esc(n.area)}</td></tr>
          <tr><th>Offender Manager</th><td>${esc(n.offenderManager)}</td><th>Contact</th><td>${esc(n.omContact)}</td></tr>
          <tr><th>Registered</th><td>${esc(fmtDate(n.registered))}</td><th>Expiry</th><td>${esc(fmtDate(n.expiry))}</td></tr>
        </table>
        <h2>Addresses</h2>${table(ROW_DEFS.addresses.cols, n.addresses)}
        <h2>Offences</h2>${table(ROW_DEFS.offences.cols, n.offences)}
        <h2>Orders / Licence Conditions</h2><div class="pre">${esc(n.orders) || '<span class="muted">None recorded.</span>'}</div>
        <h2>Risk Summary</h2><div class="pre">${esc(n.riskNotes) || '<span class="muted">None recorded.</span>'}</div>
        <h2>Vehicles</h2>${table(ROW_DEFS.vehicles.cols, n.vehicles)}
        <h2>Associates</h2>${table(ROW_DEFS.associates.cols, n.associates)}
        <div class="class-banner" style="margin-top:16px">RESTRICTED</div>
      </div>`;
  }

  function viewStats(main) {
    const all = Store.all();
    const active = all.filter(n => n.status !== 'Archived');
    const bars = (title, pairs) => {
      const max = Math.max(1, ...pairs.map(p => p[1]));
      return panel(title, pairs.map(([label, v]) => `<div class="bar-row"><span>${esc(label)}</span>
        <div><div class="bar" style="width:${(v / max) * 100}%"></div></div><span>${v}</span></div>`).join(''));
    };
    const countBy = (list, fn, keys) => keys.map(k => [k, list.filter(n => fn(n) === k).length]);
    main.innerHTML = page('Statistics', `
      <p>${all.length} records held &middot; ${active.length} not archived &middot; ${all.filter(isOrphan).length} orphaned.</p>
      <div class="cols-2"><div>
        ${bars('Active nominals by type', D.NOMINAL_TYPES.map(t => [`${t.code} - ${t.label}`, active.filter(n => n.type === t.code).length]))}
        ${bars('Active nominals by region', D.REGIONS.map(r => [r.label, active.filter(n => regionOf(n.force) === r).length]))}
      </div><div>
        ${bars('Risk level', countBy(active, n => n.risk, D.RISK_LEVELS))}
        ${bars('MAPPA level', countBy(active, n => String(n.mappaLevel), ['1', '2', '3']).map(([k, v]) => ['Level ' + k, v]))}
        ${bars('Record status', countBy(all, n => n.status, D.STATUSES))}
      </div></div>`);
  }

  // ================================================================ USER / INFO PAGES
  function viewInfo(main) {
    main.innerHTML = page('Info', panel('About ViSOR', `
      <p><b>ViSOR</b> (Violent and Sex Offender Register) is a shared database used by Police, Probation and Prison
      services to manage the risk posed by registered sex offenders, violent offenders and potentially dangerous persons
      under the Multi-Agency Public Protection Arrangements (MAPPA).</p>
      <p><b>Nominal types:</b> ${D.NOMINAL_TYPES.map(t => `${t.code} (${esc(t.label)}, MAPPA Cat ${t.mappaCat})`).join('; ')}.</p>
      <p><b>MAPPA levels:</b> Level 1 ordinary agency management; Level 2 active multi-agency management;
      Level 3 senior multi-agency management for the highest-risk cases.</p>
      <p class="muted">This is a fictional mock-up made for roleplay. It holds no real data.</p>`));
  }

  function viewHelp(main) {
    main.innerHTML = page('Help', panel('Using ViSOR', `
      <p><b>Find Nominal</b> searches by name, date of birth or reference. Names match from the start; use <b>*</b> and <b>?</b>
      as wildcards. Tick <b>Soundex</b> to match names that sound alike (e.g. SMITH / SMYTHE).</p>
      <p><b>Advanced Search</b>: <i>Find</i> holds detailed criteria. <i>UK Map</i> lets you hover over a region to see its forces,
      and click a region (or tick forces) to select it. Then press <b>Search For Nominals In Area</b>. <i>Scotland Map</i> works the
      same for Police Scotland divisions. Results appear in the <i>Search Grid</i>, which can be sorted and exported.</p>
      <p><b>Creating a record</b>: Nominals &rarr; Create New. Fields marked <span class="req">*</span> are required.</p>
      <p><b>Orphaned records</b> have no Offender Manager. Open one and press <b>Take Ownership</b>.</p>
      <p><b>Session timeout</b>: you are logged out after 30 minutes without activity (counter at top right).</p>`));
  }

  function viewPassword(main) {
    main.innerHTML = page('Password Reset', panel('Change Password', `
      <form id="pw-form"><table class="form">
        <tr><th>Current password</th><td><input type="password" name="old"></td></tr>
        <tr><th>New password</th><td><input type="password" name="pw1"></td></tr>
        <tr><th>Confirm new password</th><td><input type="password" name="pw2"></td></tr>
      </table><div class="form-actions"><button type="submit">Submit</button></div></form>
      <p class="muted">Passwords must be at least 8 characters and contain letters and numbers.</p>`));
    $('#pw-form').addEventListener('submit', e => {
      e.preventDefault();
      // Demo accounts are fixed in js/data.js, so this only acknowledges the request.
      flash('Your password reset request has been forwarded to the ViSOR Helpdesk.');
      render();
    });
  }

  function viewContact(main) {
    const key = userKey('contact');
    const c = Store.getItem(key, { phone: '', mobile: '', email: '', unit: state.user.unit });
    main.innerHTML = page('Contact Details', panel(state.user.name, `
      <form id="c-form"><table class="form">
        <tr><th>Username</th><td>${esc(state.user.username)}</td></tr>
        <tr><th>Agency / Force</th><td>${esc(state.user.agency)} / ${esc(state.user.force)}</td></tr>
        <tr><th>Unit</th><td><input type="text" name="unit" value="${esc(c.unit)}"></td></tr>
        <tr><th>Telephone</th><td><input type="text" name="phone" value="${esc(c.phone)}"></td></tr>
        <tr><th>Mobile</th><td><input type="text" name="mobile" value="${esc(c.mobile)}"></td></tr>
        <tr><th>Secure e-mail</th><td><input type="text" name="email" value="${esc(c.email)}"></td></tr>
      </table><div class="form-actions"><button type="submit">Save</button></div></form>`));
    $('#c-form').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Store.setItem(key, { unit: f.unit.value.trim(), phone: f.phone.value.trim(), mobile: f.mobile.value.trim(), email: f.email.value.trim() });
      flash('Contact details saved.');
      render();
    });
  }

  function viewMoveUser(main) {
    main.innerHTML = page('Move User', panel('Request transfer to another force / agency', `
      <form id="mu-form"><table class="form">
        <tr><th>Current</th><td>${esc(state.user.agency)} / ${esc(state.user.force)}</td></tr>
        <tr><th>New agency</th><td><select name="agency">${options(ALL_AGENCIES, state.user.agency)}</select></td></tr>
        <tr><th>New force area</th><td><select name="force">${forceOptions(state.user.force)}</select></td></tr>
        <tr><th>Reason</th><td><textarea name="reason" rows="2"></textarea></td></tr>
      </table><div class="form-actions"><button type="submit">Submit Request</button></div></form>`));
    $('#mu-form').addEventListener('submit', e => {
      e.preventDefault();
      flash('Move request submitted. It must be approved by your local ViSOR Single Point of Contact.');
      render();
    });
  }

  function viewWhitePages(main) {
    main.innerHTML = page('White Pages', `
      <div class="toolbar">Filter <input type="text" id="wp-q" size="30"></div>
      <table class="grid"><thead><tr><th>Name</th><th>Agency</th><th>Force / Area</th><th>Unit</th><th>Telephone</th></tr></thead>
      <tbody>${D.WHITE_PAGES.map(u => `<tr data-q="${esc(Object.values(u).join(' ').toUpperCase())}"><td>${esc(u.name)}</td><td>${esc(u.agency)}</td>
        <td>${esc(u.force)}</td><td>${esc(u.unit)}</td><td>${esc(u.phone)}</td></tr>`).join('')}</tbody></table>`);
    $('#wp-q').addEventListener('input', e => {
      const q = e.target.value.toUpperCase();
      $$('tr[data-q]', main).forEach(tr => { tr.hidden = !tr.dataset.q.includes(q); });
    });
  }

  function viewMessages(main) {
    main.innerHTML = page('Messages', '<div class="notice">You have no messages.</div>');
  }

  function viewRelease(main) {
    const notes = [
      ['10.4.2', '2019-04-30', 'Advanced Search: UK Map now highlights regions on hover. Search Grid can be exported to CSV.'],
      ['10.4.0', '2019-01-14', 'Find Orphaned added. Take Ownership button on nominal records.'],
      ['10.3.1', '2018-09-03', 'Session timeout reduced to 30 minutes. Soundex option added to Find Nominal.'],
      ['10.2.0', '2018-03-22', 'MAPPA meeting scheduler. Warning markers shown on record header.']
    ];
    main.innerHTML = page('Release Notes', notes.map(([v, d, t]) => panel(`Release ${v}`, `<span class="muted">${esc(fmtDate(d))}</span><br>${esc(t)}`)).join(''));
  }

  // ================================================================ boot
  renderLogo();
  $('#login-form').addEventListener('submit', e => {
    e.preventDefault();
    const user = $('#lg-user').value.trim().toUpperCase();
    const pass = $('#lg-pass').value;
    const acct = D.ACCOUNTS.find(a => a.username === user && a.password.toUpperCase() === pass.toUpperCase());
    if (!acct) {
      $('#login-msg').textContent = 'Invalid username or password.';
      $('#lg-pass').value = '';
      $('#lg-pass').focus();
      return;
    }
    $('#login-msg').textContent = '';
    if (!location.hash) history.replaceState(null, '', '#home');
    startSession(acct);
  });
  $('#logout').addEventListener('click', e => { e.preventDefault(); logout('You have logged out of ViSOR.'); });
  ['click', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (state.user) resetTimer(); }, true));
  window.addEventListener('hashchange', render);
  setInterval(tick, 1000);
  tick();

  let resumed = null;
  try { resumed = sessionStorage.getItem('visor.session'); } catch (e) { /* ignore */ }
  const acct = resumed && D.ACCOUNTS.find(a => a.username === resumed);
  if (acct) startSession(acct); else $('#lg-user').focus();
})();
