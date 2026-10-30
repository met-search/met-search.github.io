/* PNC mock - terminal engine: screen rendering, forms, paged reports,
   command line (TCODE / ORIG / REASON / DATA / PTR), logon and keyboard. */
'use strict';
(function (P) {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const W = 78;          // usable screen width in characters
  const BODY_ROWS = 16;  // report lines per page

  const T = P.T = { user: null, mode: 'LIVE', screen: null, ctx: {}, seq: 0 };
  const TX = P.TX = {};  // transaction registry, filled by transactions.js
  const LEVEL = { ENQ: 1, UPD: 2, ADMIN: 3 };

  /* ================================================================ helpers */

  P.esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  P.pad = (s, n) => { s = String(s ?? ''); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); };
  P.center = (s, w = W) => ' '.repeat(Math.max(0, Math.floor((w - s.length) / 2))) + s;
  P.cols = (left, right, w = W) => P.pad(left, Math.max(left.length + 1, w - right.length)) + right;

  /* word-wrap text into lines of `width`; first line prefixed with `indent`, the rest with `hang` */
  P.wrap = function (text, indent = '', width = W, hang = indent) {
    const out = [];
    let line = '';
    const pre = () => out.length ? hang : indent;
    for (const word of String(text || '').split(/\s+/).filter(Boolean)) {
      if (line && pre().length + line.length + 1 + word.length > width) { out.push(pre() + line); line = word; }
      else line = line ? line + ' ' + word : word;
    }
    if (line) out.push(pre() + line);
    return out;
  };

  const two = n => String(n).padStart(2, '0');
  P.today = () => { const d = new Date(); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`; };
  P.dt = iso => { if (!iso) return ''; if (iso === 'UNLIMITED') return 'UNLIMITED'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y.slice(2)}`; };
  P.dt4 = iso => { if (!iso) return ''; if (iso === 'UNLIMITED') return 'UNLIMITED'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
  P.time = iso => { const d = iso ? new Date(iso) : new Date(); return `${two(d.getHours())}:${two(d.getMinutes())}`; };
  P.stamp = iso => { const d = iso ? new Date(iso) : new Date(); return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${two(d.getHours())}:${two(d.getMinutes())}`; };
  P.addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`; };
  P.age = dob => { if (!dob) return ''; const t = new Date(), b = new Date(dob + 'T12:00:00'); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return a; };

  /* accepts DDMMYYYY, DD/MM/YYYY, DDMMYY, DD/MM/YY, DD.MM.YYYY -> ISO, or null */
  P.parseDate = function (str) {
    const s = String(str || '').replace(/[\/.\-\s]/g, '');
    let d, m, y;
    if (/^\d{8}$/.test(s)) { d = +s.slice(0, 2); m = +s.slice(2, 4); y = +s.slice(4); }
    else if (/^\d{6}$/.test(s)) { d = +s.slice(0, 2); m = +s.slice(2, 4); y = +s.slice(4); y += y > (new Date().getFullYear() % 100) + 1 ? 1900 : 2000; }
    else return null;
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return `${y}-${two(m)}-${two(d)}`;
  };

  P.forceName = fs => P.FORCES[String(fs || '').slice(0, 2)] || 'UNKNOWN FORCE';

  /* ================================================================ rendering */

  function segHtml(row) {
    if (row == null) return '';
    if (typeof row === 'string') return P.esc(row);
    return row.map(seg => {
      if (typeof seg === 'string') return P.esc(seg);
      if (seg.f) {
        const len = seg.len || 10;
        return `<input class="fld" data-f="${seg.f}" maxlength="${len}" style="width:${len}ch" placeholder="${'.'.repeat(len)}"` +
          `${seg.pw ? ' type="password"' : ''}${seg.mixed ? ' data-mixed="1"' : ''} autocomplete="off" spellcheck="false">`;
      }
      return `<span class="${seg.c || ''}">${P.esc(seg.t)}</span>`;
    }).join('');
  }

  function headerRow(s) {
    const uid = T.user ? T.user.id : '';
    const tc = (s.tcode || '#--').slice(1);
    const left = `${P.stamp()}  ${P.pad(uid, 8)} ${tc}${P.db.term.slice(-2)}/${String(T.seq).padStart(4, '0')}`;
    return P.cols(left, s.id || 'PR000M00');
  }

  function reportFooter(s) {
    const last = s.page >= s.pages.length - 1;
    const rows = [''];
    rows.push(P.cols(last ? '** END OF REPORT **' : '(CONTINUED ON NEXT PAGE)', `PAGE ${s.page + 1} OF ${s.pages.length}`));
    if (s.select) rows.push([`${s.select.label || 'ENTER SELECTION NUMBER'} `, { f: 'sel', len: String(s.select.max).length }]);
    rows.push(['PAGE ', { f: 'page', len: 3 }, '   HELP ', { f: 'help', len: 4 }, ' '.repeat(36), 'ABANDON TRANSACTION? ', { f: 'abandon', len: 1 }]);
    return rows;
  }

  function render() {
    const s = T.screen;
    if (!s) return;
    const rows = [];
    if (!s.noHeader) {
      rows.push(headerRow(s));
      rows.push(s.title ? [{ t: P.center(s.title), c: 'bright' }] : '');
      rows.push('');
    }
    rows.push(...(s.pages ? s.pages[s.page] : s.rows || []));
    if (s.pages) rows.push(...reportFooter(s));
    $('#content').innerHTML = rows.map(r => `<div class="row">${segHtml(r)}</div>`).join('');

    const ph = $('#photo'), img = $('#photo img');
    ph.hidden = !s.photo || !!prefs.nophoto;
    if (!ph.hidden && img.getAttribute('src') !== s.photo) { $('#photo .cap').textContent = 'PNC PHOTOGRAPH - F6 HIDE'; img.src = s.photo; }

    const msg = $('#msg');
    msg.innerHTML = s.msg ? `<span>${P.esc(s.msg)}</span>` : '';
    msg.className = s.err ? 'err' : '';

    const inputs = $$('#content .fld');
    for (const i of inputs) { const v = s.vals && s.vals[i.dataset.f]; if (v != null) i.value = v; }
    let target = null;
    if (s.focus && s.focus.startsWith('c-')) target = $('#' + s.focus);
    else if (s.focus) target = $(`#content .fld[data-f="${s.focus}"]`);
    if (!target) target = inputs.find(i => !i.value) || inputs[0] || (T.user ? $('#c-tcode') : null);
    if (target) { target.focus(); const n = target.value.length; try { target.setSelectionRange(n, n); } catch (e) { /* password */ } }
    status();
  }

  function cmdSnap() { return $('#c-tcode').value.trim().toUpperCase() + '|' + $('#c-data').value.trim().toUpperCase(); }

  /* show a screen object (or a plain message string) */
  P.show = function (s) {
    if (!s) return;
    if (typeof s === 'string') s = P.blank(s);
    if (!s.tcode && T.user) s.tcode = $('#c-tcode').value.trim().toUpperCase();
    T.screen = s;
    render();
    s.snap = cmdSnap();
  };

  function collect() {
    const v = {};
    for (const i of $$('#content .fld')) v[i.dataset.f] = i.value;
    return v;
  }

  /* error on the current screen object */
  P.err = function (s, msg, field) { s.msg = msg; s.err = true; s.focus = field || null; return s; };
  P.info = function (s, msg) { s.msg = msg; s.err = false; return s; };

  /* ================================================================ screen builders */

  P.blank = function (msg, err) {
    return { rows: [], msg: msg || '', err: !!err, focus: 'c-tcode', vals: {} };
  };

  P.page = function ({ title, id, rows, msg, err }) {
    return { title, id, rows: rows || [], msg: msg || '', err: !!err, focus: 'c-tcode', vals: {} };
  };

  /* paged report. select: { label, max, pick(n) } adds a selection field */
  P.report = function ({ title, id, lines, select, msg }) {
    const pages = [];
    for (let i = 0; i < Math.max(1, lines.length); i += BODY_ROWS) pages.push(lines.slice(i, i + BODY_ROWS));
    const s = { title, id, pages, page: 0, select, vals: {}, msg: msg || '' };
    s.focus = select ? 'sel' : 'page';
    s.onSend = v => {
      if ((v.abandon || '').toUpperCase() === 'Y') return P.blank('I: TRANSACTION ABANDONED');
      if ((v.help || '').trim()) return P.info(Object.assign(s, { vals: {} }), 'I: ENTER PAGE NUMBER, OR SEND FOR NEXT PAGE. Y IN ABANDON TO QUIT.');
      if (select && v.sel && v.sel.trim()) {
        const n = parseInt(v.sel, 10);
        if (!(n >= 1 && n <= select.max)) { s.vals = {}; return P.err(s, 'E: INVALID SELECTION - ENTER 1 TO ' + select.max, 'sel'); }
        return select.pick(n);
      }
      if (v.page && v.page.trim()) {
        const n = parseInt(v.page, 10);
        s.vals = {};
        if (!(n >= 1 && n <= pages.length)) return P.err(s, 'E: INVALID PAGE NUMBER', 'page');
        s.page = n - 1; s.msg = ''; s.err = false;
        return s;
      }
      return P.turn(s, +1);
    };
    return s;
  };

  P.turn = function (s, dir) {
    if (!s || !s.pages) return s;
    const n = s.page + dir;
    s.vals = {};
    s.err = false;
    if (n < 0) s.msg = 'I: FIRST PAGE OF REPORT';
    else if (n >= s.pages.length) s.msg = 'I: LAST PAGE - END OF REPORT';
    else { s.page = n; s.msg = ''; }
    return s;
  };

  /* formatted input screen.
     field: { n, l, len, req, opts, date, unl, num, re, hint, pw, mixed, def, gap } | { h: heading } | { txt }
     (mixed: keep the case as typed, e.g. web links)
     pre(rawVals, screen): optional hook before validation; return a screen to short-circuit */
  P.form = function ({ title, id, fields, vals, submit, intro, msg, pre }) {
    const lw = Math.max(...fields.filter(f => f.n).map(f => f.l.length));
    const rows = [];
    if (intro) rows.push(...[].concat(intro), '');
    for (const f of fields) {
      if (f.h !== undefined) { if (rows.length) rows.push(''); rows.push([{ t: f.h, c: 'bright' }]); continue; }
      if (f.txt !== undefined) { rows.push(f.txt); continue; }
      const seg = ['  ' + P.pad(f.l, lw) + ' : ', { f: f.n, len: f.len, pw: f.pw, mixed: f.mixed }];
      if (f.hint) seg.push(' ' + f.hint);
      rows.push(seg);
      if (f.gap) rows.push('');
    }
    const s = { title, id, rows, vals: Object.assign({}, vals || {}), msg: msg || '' };
    s.onSend = v => {
      if (pre) { const r = pre(v, s); if (r) return r; }  /* runs before validation, e.g. BACK / QUIT */
      const out = {};
      for (const f of fields) {
        if (!f.n) continue;
        let x = String(v[f.n] || '').trim();
        if (!f.mixed) x = x.toUpperCase();
        if (!x && f.def != null) x = f.def;
        if (!x) {
          if (f.req) return P.err(s, 'E: MANDATORY FIELD MISSING - ' + f.l, f.n);
          out[f.n] = '';
          continue;
        }
        if (f.opts && !f.opts.includes(x)) return P.err(s, ('E: INVALID ' + f.l + '. VALID: ' + f.opts.join(' ')).slice(0, W), f.n);
        if (f.date) {
          if (f.unl && /^9{6,8}$/.test(x)) x = 'UNLIMITED';
          else { const d = P.parseDate(x); if (!d) return P.err(s, 'E: INVALID DATE - ' + f.l + ' (DDMMYYYY)', f.n); x = d; }
        }
        if (f.num && !/^\d+$/.test(x)) return P.err(s, 'E: NUMERIC VALUE REQUIRED - ' + f.l, f.n);
        if (f.re && !f.re.test(x)) return P.err(s, 'E: INVALID FORMAT - ' + f.l + (f.fmt ? ' (' + f.fmt + ')' : ''), f.n);
        out[f.n] = x;
      }
      const r = submit(out, s);
      if (r && r.err && !r.rows && !r.pages) return P.err(s, r.err, r.field);
      return r;
    };
    return s;
  };

  /* ================================================================ audit log */

  P.logTx = function (tcode, data, note) {
    const c = id => $('#' + id).value.trim().toUpperCase();
    P.db.log.push({
      ts: new Date().toISOString(), user: T.user ? T.user.id : '-', mode: T.mode, term: P.db.term,
      tcode, orig: c('c-orig'), reason: c('c-reason'), data: String(data || '').slice(0, 67), note: note || ''
    });
    if (P.db.log.length > 5000) P.db.log.splice(0, P.db.log.length - 5000);
    P.save();
  };

  /* a user's transaction set: their role's codes, plus codes added (u.allow), minus codes removed (u.deny).
     Menu, clear and logoff can never be removed. */
  P.ALWAYS = ['#MM', '#CL', '#XX'];
  P.roleAllows = (role, tc) => !!(TX[tc] && LEVEL[role] >= LEVEL[TX[tc].role || 'ENQ']);
  P.allowed = (u, tc) => {
    if (!u || !TX[tc]) return false;
    if (P.ALWAYS.includes(tc)) return true;
    if ((u.deny || []).includes(tc)) return false;
    return (u.allow || []).includes(tc) || P.roleAllows(u.role, tc);
  };

  /* ================================================================ dispatch */

  function flash(msg, focus) {
    const s = T.screen || P.blank('');
    s.msg = msg; s.err = true; s.focus = focus || 'c-tcode';
    T.screen = s;
    render();
    s.snap = cmdSnap();
  }

  function dispatch(tc, data) {
    if (!tc) return flash('E: ENTER A TRANSACTION CODE. #MM FOR MENU');
    if (!/^#[A-Z0-9]{2}$/.test(tc)) return flash('E: INVALID TRANSACTION CODE FORMAT - MUST BE # FOLLOWED BY 2 CHARACTERS');
    const tx = TX[tc];
    if (!tx) return flash('E: ' + tc + ' IS NOT A VALID TRANSACTION CODE. #MM FOR MENU');
    if (!P.allowed(T.user, tc)) return flash('E: ' + tc + ' NOT IN TRANSACTION SET FOR USER-ID ' + T.user.id);
    if (!tx.free) {
      const orig = $('#c-orig').value.trim(), reason = $('#c-reason').value.trim();
      if (orig.length < 4) return flash('E: ORIGINATOR MUST BE AT LEAST 4 CHARACTERS (WHO/WHY/WHERE)', 'c-orig');
      if (!/^\d[A-Z0-9]?$/i.test(reason)) return flash('E: INVALID REASON CODE - FIRST CHARACTER MUST BE 0-9', 'c-reason');
    }
    T.seq++;
    if (!tx.nolog) P.logTx(tc, data);
    later(() => {
      let s;
      try { s = tx.run(data); }
      catch (e) { console.error(e); s = P.blank('E: SYSTEM ERROR IN ' + tc + ' - ' + e.message, true); }
      if (!s) return;
      if (typeof s === 'string') s = P.blank(s, /^E:/.test(s));
      s.tcode = tc;
      P.show(s);
      if ($('#c-ptr').value.toUpperCase() === 'Y' && (s.pages || s.rows)) {
        $('#c-ptr').value = 'N';
        setTimeout(() => window.print(), 50);
      }
    }, tx.nolog || tx.instant);
  }

  /* the host takes a moment to answer: show TRANSACTION IN PROGRESS, ignore Enter meanwhile.
     Transactions that open a file picker run at once (browsers only allow that straight after a key press). */
  function later(fn, instant) {
    if (instant || prefs.nodelay) return fn();
    T.busy = true;
    $('#msg').className = '';
    $('#msg').innerHTML = '<span class="blink">TRANSACTION IN PROGRESS...</span>';
    setTimeout(() => { T.busy = false; fn(); }, 300 + Math.random() * 600);
  }
  P.dispatch = dispatch;

  /* run a transaction directly (menu shortcuts, F-keys) */
  P.run = function (tc, data) {
    if (!T.user) return;
    $('#c-tcode').value = tc;
    $('#c-data').value = data || '';
    dispatch(tc, (data || '').toUpperCase());
  };

  function send() {
    if (!T.user) return logonSubmit();
    const tc = $('#c-tcode').value.trim().toUpperCase();
    const data = $('#c-data').value.trim().toUpperCase();
    const s = T.screen;
    if (s && s.onSend && s.snap === cmdSnap()) {
      const v = collect();
      Object.assign(s.vals, v);
      const tx = TX[s.tcode];
      later(() => {
        let r;
        try { r = s.onSend(v, s); }
        catch (e) { console.error(e); r = P.err(s, 'E: SYSTEM ERROR - ' + e.message); }
        if (!r) return;
        if (typeof r === 'string') r = P.blank(r, /^E:/.test(r));
        if (!r.tcode) r.tcode = tc;
        P.show(r);
      }, tx && tx.instant);
      return;
    }
    dispatch(tc, data);
  }

  function clearScreen() {
    if (!T.user) return P.logon();
    $('#c-data').value = '';
    P.show(P.blank(''));
  }

  /* ================================================================ logon / logoff */

  P.logon = function (msg, err) {
    $('#cmd').hidden = true;
    T.user = null;
    T.screen = null;
    const s = {
      noHeader: true, vals: { mode: 'LIVE' }, msg: msg || '', err: !!err, focus: 'uid',
      rows: [
        '', '', '',
        P.center('L O G O N'),
        '', '', '',
        ['        USER-ID   : ', { f: 'uid', len: 8 }, '            PASSWORD      : ', { f: 'pw', len: 8, pw: true }],
        '',
        ['        MODE      : ', { f: 'mode', len: 4 }, '                NEW PASSWORD  : ', { f: 'npw', len: 8, pw: true }],
        '', '', '', '',
        P.center('WARNING'),
        P.center('YOU ARE ACCESSING THE POLICE NATIONAL COMPUTER.'),
        P.center('UNAUTHORISED ACCESS TO OR MISUSE OF THIS SYSTEM IS PROHIBITED'),
        P.center('AND CONSTITUTES AN OFFENCE UNDER THE COMPUTER MISUSE ACT 1990.'),
        P.center('IF YOU DO NOT HAVE AUTHORISATION YOU MUST NOT LOGON TO THIS SYSTEM'),
        '', '',
        [{ t: P.center('ALL ACTIONS ARE MONITORED AND RECORDED AT ALL TIMES'), c: 'dim' }]
      ]
    };
    T.screen = s;
    render();
    status();
  };

  function logonSubmit() {
    const s = T.screen;
    const v = collect();
    const uid = v.uid.trim().toUpperCase(), pw = v.pw.trim().toUpperCase();
    const mode = (v.mode.trim() || 'LIVE').toUpperCase(), npw = v.npw.trim().toUpperCase();
    s.vals = { uid, mode };
    const fail = (m, f) => { P.err(s, m, f); render(); };
    if (!uid) return fail('E: ENTER USER-ID', 'uid');
    if (!pw) return fail('E: ENTER PASSWORD', 'pw');
    const u = P.db.users.find(x => x.id === uid);
    if (!u) return fail('E: INVALID USER-ID OR PASSWORD', 'uid');
    if (u.barred) return fail('E: USER-ID ' + uid + ' IS BARRED - CONTACT YOUR FORCE PNC BUREAU', 'uid');
    if (u.pw !== pw) {
      u.fails = (u.fails || 0) + 1;
      if (u.fails >= 3 && u.role !== 'ADMIN') u.barred = true;
      P.save();
      return fail(u.barred ? 'E: 3 INVALID ATTEMPTS - USER-ID ' + uid + ' NOW BARRED' : `E: INVALID USER-ID OR PASSWORD - ATTEMPT ${u.fails} OF 3`, 'pw');
    }
    if (!['LIVE', 'TRNG', 'DEMO'].includes(mode)) return fail('E: INVALID MODE - ENTER LIVE, TRNG OR DEMO', 'mode');
    if (!u.modes.includes(mode)) return fail('E: USER-ID NOT AUTHORISED FOR MODE ' + mode, 'mode');
    if (u.expires && u.expires < P.today()) return fail('E: USER-ID EXPIRED ON ' + P.dt(u.expires) + ' - CONTACT YOUR FORCE PNC BUREAU', 'uid');
    if (u.mustChange && !npw) return fail('E: PASSWORD MUST BE CHANGED - ENTER A NEW PASSWORD', 'npw');
    if (npw) {
      if (!/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{8}$/.test(npw)) return fail('E: NEW PASSWORD MUST BE 8 CHARACTERS, LETTERS AND NUMBERS ONLY, AND CONTAIN BOTH', 'npw');
      if (npw === u.pw) return fail('E: NEW PASSWORD MUST DIFFER FROM CURRENT PASSWORD', 'npw');
      u.pw = npw;
      u.mustChange = false;
    }
    const prev = u.lastOff || u.lastOn;
    u.fails = 0;
    u.lastOn = new Date().toISOString();
    T.user = u;
    T.mode = mode;
    T.seq = 0;
    T.ctx = {};
    P.data(mode);
    P.save();
    $('#cmd').hidden = false;
    $('#c-tcode').value = '';
    $('#c-data').value = '';
    $('#c-ptr').value = 'N';
    P.logTx('#XA', '', 'LOGON');
    P.show(welcome(prev, !!npw));
  }

  function welcome(prev, changed) {
    const u = T.user;
    const d = P.data(T.mode);
    const rows = [
      '',
      [{ t: P.center('ONLY AUTHORISED USERS MAY PROCEED'), c: 'bright' }],
      '',
      P.center(prev ? 'LAST LOGGED OFF : ' + P.stamp(prev).replace(' ', ' AT ') : 'FIRST LOGON FOR THIS USER-ID'),
      '', '',
      '  USER-ID   : ' + P.pad(u.id, 10) + '  NAME : ' + u.name,
      '  FCE/STN   : ' + P.pad(u.fs, 10) + '  FORCE: ' + P.forceName(u.fs),
      '  ACCESS    : ' + P.ROLES[u.role] + ((u.allow || []).length || (u.deny || []).length ? ' (CUSTOMISED)' : ''),
      ['  MODE      : ', { t: T.mode, c: T.mode === 'LIVE' ? 'rev' : 'warn' }, T.mode === 'LIVE' ? '' : '   ** NON-LIVE FILES IN USE **'],
      '',
      `  BULLETIN BOARD : ${d.bulletin.length} MESSAGE(S) - USE #BB TO VIEW`,
      '',
      '  ENTER A TRANSACTION CODE IN THE TCODE FIELD, AN ORIGINATOR AND A REASON',
      '  CODE, THEN PRESS SEND (ENTER). LEAVE DATA BLANK FOR THE FORMATTED SCREEN.',
      '',
      '  #MM  TRANSACTION MENU        #NE  NAMES ENQUIRY       #VE  VRM ENQUIRY',
      '  #PE  PROPERTY ENQUIRY        #DL  DRIVERS ENQUIRY     #XX  LOGOFF'
    ];
    return P.page({ id: 'XA000M01', rows, msg: changed ? 'I: PASSWORD CHANGED' : '' });
  }

  P.logoff = function () {
    if (!T.user) return P.logon();
    P.logTx('#XX', '', 'LOGOFF');
    T.user.lastOff = new Date().toISOString();
    P.save();
    for (const id of ['c-tcode', 'c-orig', 'c-reason', 'c-data']) $('#' + id).value = '';
    P.logon('I: LOGGED OFF AT ' + P.time());
  };

  /* ================================================================ database tools */

  P.exportDb = function () {
    const blob = new Blob([JSON.stringify(P.db, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pnc-database-' + P.today().replace(/-/g, '') + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  P.importDb = function () { $('#importfile').value = ''; $('#importfile').click(); };
  $('#importfile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then(txt => {
      const obj = JSON.parse(txt);
      if (!obj || !Array.isArray(obj.users) || typeof obj.modes !== 'object') throw new Error('not a PNC database file');
      if (!Array.isArray(obj.log)) obj.log = [];
      if (!obj.term) obj.term = P.db.term;
      P.replaceDb(obj);
      P.logon('I: DATABASE IMPORTED - PLEASE LOG ON');
    }).catch(err => flash('E: IMPORT FAILED - ' + String(err.message).toUpperCase()));
  });

  /* pick an image file, shrink it to 320px and hand back a JPEG data URL (null if unreadable) */
  P.pickPhoto = function (cb) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => {
        const k = Math.min(1, 320 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        cb(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); cb(null); };
      img.src = url;
    };
    inp.click();
  };

  /* ================================================================ status / prefs */

  function status() {
    $('#sb-term').textContent = `${P.db.term}/${T.user ? T.mode : '----'}`;
    $('#tb-id').textContent = T.user ? 'id' + T.user.id.toLowerCase() : 'id----';
  }

  function cursorPos(el) {
    const scr = $('#screen').getBoundingClientRect(), r = el.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle($('.row') || el).lineHeight) || 20;
    const ch = r.width / (el.maxLength > 0 ? el.maxLength : 1);
    const caret = el.selectionStart != null ? el.selectionStart : 0;
    return `${Math.round((r.top - scr.top) / lh) + 1} ${Math.round((r.left - scr.left) / ch) + caret}`;
  }

  const prefs = (() => { try { return JSON.parse(localStorage.getItem('pnc.prefs')) || {}; } catch (e) { return {}; } })();
  function applyPrefs() {
    document.body.dataset.ph = prefs.ph || 'green';
    document.body.classList.toggle('noscan', prefs.noscan !== false);
    document.documentElement.style.setProperty('--zoom', prefs.zoom || 1);
  }
  function savePrefs() { try { localStorage.setItem('pnc.prefs', JSON.stringify(prefs)); } catch (e) { /* ignore */ } applyPrefs(); }

  /* ================================================================ input handling */

  function fields() { return $$('#content .fld, #cmd:not([hidden]) .fld'); }
  function moveFocus(from, dir) {
    const list = fields();
    const i = list.indexOf(from);
    const next = list[(i + dir + list.length) % list.length];
    if (next) { next.focus(); next.select(); }
  }

  function handleKey(key, e) {
    if (!$('#keyhelp').hidden) { if (key === 'Escape' || key === 'Enter') $('#keyhelp').hidden = true; return true; }
    if (T.busy && (key === 'Enter' || key === 'Escape')) return true;
    switch (key) {
      case 'Enter': send(); return true;
      case 'Escape': clearScreen(); return true;
      case 'PageDown': case 'F8': if (T.screen && T.screen.pages) { P.turn(T.screen, +1); render(); } return true;
      case 'PageUp': case 'F7': if (T.screen && T.screen.pages) { P.turn(T.screen, -1); render(); } return true;
      case 'F1': if (T.user) P.run('#MM'); return true;
      case 'F6': prefs.nophoto = !prefs.nophoto; savePrefs(); render(); return true;
      case 'F9': window.print(); return true;
      case 'F12': P.logoff(); return true;
      case 'ArrowDown': case 'ArrowUp':
        if (e && e.target.classList && e.target.classList.contains('fld')) { moveFocus(e.target, key === 'ArrowDown' ? 1 : -1); return true; }
        return false;
    }
    return false;
  }

  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (handleKey(e.key, e)) e.preventDefault();
  });

  document.addEventListener('input', e => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('fld')) return;
    if (el.type !== 'password' && !el.dataset.mixed) {
      const p = el.selectionStart;
      el.value = el.value.toUpperCase();
      try { el.setSelectionRange(p, p); } catch (x) { /* ignore */ }
    }
    if (el.maxLength > 0 && el.value.length >= el.maxLength && el.selectionStart === el.maxLength &&
        e.inputType && e.inputType.startsWith('insert')) moveFocus(el, 1);
    $('#sb-pos').textContent = cursorPos(el);
  });
  document.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('fld')) $('#sb-pos').textContent = cursorPos(e.target); });

  /* typing while no field has focus (e.g. after selecting text) goes to the first field */
  document.addEventListener('keydown', e => {
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = document.activeElement;
    if (a && (a.classList.contains('fld') || a.tagName === 'INPUT')) return;
    const f = fields();
    if (f.length) f[0].focus();
  }, true);

  $('#fkeys').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) handleKey(b.dataset.key);
  });

  function closeMenus() { $$('.dropdown').forEach(d => d.classList.remove('open')); }
  document.addEventListener('click', e => {
    const m = e.target.closest('[data-menu]');
    if (m) { const dd = $('#menu-' + m.dataset.menu); const open = dd.classList.contains('open'); closeMenus(); if (!open) dd.classList.add('open'); return; }
    const a = e.target.closest('[data-act]');
    if (!e.target.closest('.dropdown')) closeMenus();
    if (!a) return;
    closeMenus();
    const isAdmin = T.user && T.user.role === 'ADMIN';
    switch (a.dataset.act) {
      case 'logoff': P.logoff(); break;
      case 'export': if (isAdmin) P.exportDb(); else flash('E: ADMINISTRATOR LOGON REQUIRED TO EXPORT'); break;
      case 'import': if (isAdmin) P.importDb(); else flash('E: ADMINISTRATOR LOGON REQUIRED TO IMPORT'); break;
      case 'reset':
        if (!isAdmin) { flash('E: ADMINISTRATOR LOGON REQUIRED TO RESET'); break; }
        if (confirm('Reset the whole database (all modes, users and log) to the seed data?')) { P.resetAll(); P.logon('I: DATABASE RESET TO SEED DATA - PLEASE LOG ON'); }
        break;
      case 'ph-green': prefs.ph = 'green'; savePrefs(); break;
      case 'ph-amber': prefs.ph = 'amber'; savePrefs(); break;
      case 'ph-white': prefs.ph = 'white'; savePrefs(); break;
      case 'scan': prefs.noscan = !prefs.noscan; savePrefs(); break;
      case 'delay': prefs.nodelay = !prefs.nodelay; savePrefs(); flash(prefs.nodelay ? 'I: RESPONSE DELAY OFF' : 'I: RESPONSE DELAY ON'); break;
      case 'bigger': prefs.zoom = Math.min(1.6, +((prefs.zoom || 1) + 0.1).toFixed(1)); savePrefs(); break;
      case 'smaller': prefs.zoom = Math.max(0.6, +((prefs.zoom || 1) - 0.1).toFixed(1)); savePrefs(); break;
      case 'keys': $('#keyhelp').hidden = !$('#keyhelp').hidden; break;
    }
    const f = fields(); if (f.length && $('#keyhelp').hidden) f[0].focus();
  });

  /* ================================================================ boot */

  P.boot = function () {
    P.load();
    applyPrefs();
    const lines = [
      'SRG GATEWAY  - SECURE REMOTE GATEWAY',
      'NEGOTIATING SESSION .......... OK',
      `TERMINAL ${P.db.term} ............. REGISTERED`,
      'CONNECTING TO HOST PNC-A ..... CONNECTED',
      '',
      'PNC SIMULATION - ALL RECORDS ARE FICTIONAL'
    ];
    const c = $('#content');
    c.innerHTML = '';
    let i = 0;
    const tick = () => {
      if (i < lines.length) {
        c.insertAdjacentHTML('beforeend', `<div class="row">${P.esc(lines[i++])}</div>`);
        setTimeout(tick, 140);
      } else {
        $('#tb-conn').textContent = 'Connected to host';
        $('#tb-conn').classList.add('ok');
        setTimeout(() => P.logon(), 250);
      }
    };
    tick();
  };

})(window.PNC);
