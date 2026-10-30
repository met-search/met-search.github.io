/* PNC mock - #SA ACCOUNT MANAGER (admin).
   Create and manage user-ids: details, credentials, and exactly which transaction codes each one may use.
   A user's codes = their base set (ENQ / UPD / ADMIN) + codes added - codes removed. */
'use strict';
(function (P) {
  const T = P.T;
  const L = P.lib;
  const W = 78;

  const UID_RE = /^[A-Z0-9]{3,8}$/, PW_RE = /^[A-Z0-9]{4,8}$/;
  const MODES_RE = /^((LIVE|TRNG|DEMO) ?)+$/;
  const CAT_ORDER = ['NAMES', 'WANTED/MISSING', 'ARREST/COURT', 'VEHICLES', 'DRIVERS', 'PROPERTY', 'GENERAL', 'ACCESS CONTROL', 'SIMULATOR'];

  const findUser = id => P.db.users.find(u => u.id === String(id || '').toUpperCase().trim());
  const toIn = iso => iso ? iso.split('-').reverse().join('') : '';
  const log = (uid, note) => P.logTx('#SA', uid, note);
  const codesIn = cat => Object.keys(P.TX).filter(c => P.TX[c].cat === cat).sort();
  const isOn = (u, tc) => P.allowed(u, tc);

  function status(u) {
    if (u.barred) return { t: 'BARRED', c: 'warn' };
    if (u.expires && u.expires < P.today()) return { t: 'EXPIRED', c: 'warn' };
    return { t: 'ACTIVE', c: 'rev' };
  }

  /* keep allow/deny minimal: allow only holds codes the base set lacks, deny only codes it has */
  function tidy(u) {
    u.allow = [...new Set(u.allow || [])].filter(c => P.TX[c] && !P.roleAllows(u.role, c)).sort();
    u.deny = [...new Set(u.deny || [])].filter(c => P.TX[c] && P.roleAllows(u.role, c) && !P.ALWAYS.includes(c)).sort();
  }

  /* "#NE #VE", category words (NAMES, VEHICLES, WANTED, ARREST, ACCESS...) or ALL -> list of codes */
  function parseCodes(str) {
    const out = [];
    for (const tok of String(str || '').split(/[\s,]+/).filter(Boolean)) {
      if (tok === 'ALL') { out.push(...Object.keys(P.TX)); continue; }
      if (tok.startsWith('#')) {
        if (!P.TX[tok]) return { err: `E: ${tok} IS NOT A TRANSACTION CODE` };
        out.push(tok);
        continue;
      }
      const cat = CAT_ORDER.find(c => c === tok || c.split(/[ /]/)[0] === tok);
      if (!cat) return { err: `E: ${tok} IS NOT A CODE OR CATEGORY` };
      out.push(...codesIn(cat));
    }
    return [...new Set(out)];
  }

  /* ---------------------------------------------------------------- permission grid */

  function grid(u) {
    const rows = [];
    for (const cat of CAT_ORDER) {
      const codes = codesIn(cat);
      for (let i = 0; i < codes.length; i += 13) {
        const row = [P.pad(i ? '' : cat.split(/[ /]/)[0], 10)];
        for (const c of codes.slice(i, i + 13)) {
          const base = P.roleAllows(u.role, c), on = isOn(u, c);
          row.push({ t: c, c: on ? (base ? '' : 'rev') : (base ? 'warn' : 'dim') }, ' ');
        }
        rows.push(row);
      }
    }
    rows.push('', ['KEY: ', { t: '#XX', c: '' }, ' FROM BASE SET  ', { t: '#XX', c: 'rev' }, ' ADDED  ',
      { t: '#XX', c: 'warn' }, ' REMOVED  ', { t: '#XX', c: 'dim' }, ' NOT AVAILABLE']);
    return rows;
  }

  const permSummary = u => {
    const n = Object.keys(P.TX).filter(c => isOn(u, c)).length;
    return `${n} CODES - ${u.role} SET` + (u.allow.length ? ` +${u.allow.length} ADDED` : '') + (u.deny.length ? ` -${u.deny.length} REMOVED` : '');
  };

  /* ---------------------------------------------------------------- screens */

  function listScreen(msg) {
    const users = P.db.users;
    users.forEach(tidy);
    const lines = [' NO  USER-ID   NAME                       FCE   SET    STATUS   PERMS   LAST LOGON', ' --  ' + '-'.repeat(73)];
    users.forEach((u, i) => {
      const st = status(u), extra = (u.allow.length ? '+' + u.allow.length : '') + (u.deny.length ? '-' + u.deny.length : '');
      lines.push([` ${String(i + 1).padStart(2)}  ${P.pad(u.id, 9)} ${P.pad(u.name, 26)} ${P.pad(u.fs, 5)} ${P.pad(u.role, 6)} `,
        { t: P.pad(st.t, 7), c: st.c }, `  ${P.pad(extra || 'STD', 7)} ${u.lastOn ? P.dt(u.lastOn) : 'NEVER'}`]);
    });
    lines.push('', ` ${String(users.length + 1).padStart(2)}  ** CREATE A NEW ACCOUNT **`);
    return P.report({
      title: 'ACCOUNT MANAGER - ' + users.length + ' USER-ID(S)', id: 'SA000M01', lines, msg,
      select: { label: 'ENTER NO. OF ACCOUNT TO MANAGE (OR ' + (users.length + 1) + ' TO CREATE)', max: users.length + 1,
        pick: n => n > users.length ? createForm() : accountScreen(users[n - 1]) }
    });
  }

  function accountScreen(u, msg) {
    tidy(u);
    const st = status(u);
    const lines = [
      `  USER-ID          : ${u.id}`,
      `  NAME / RANK      : ${u.name}`,
      `  FORCE / STATION  : ${u.fs}  (${P.forceName(u.fs)})`,
      `  BASE SET         : ${u.role} - ${P.ROLES[u.role]}`,
      `  MODES            : ${u.modes.join(' ')}`,
      ['  STATUS           : ', { t: ` ${st.t} `, c: st.c }, `   FAILED LOGONS: ${u.fails || 0} OF 3`],
      `  ACCOUNT EXPIRES  : ${u.expires ? P.dt4(u.expires) : 'NEVER'}`,
      `  PASSWORD         : SET${u.mustChange ? ' - MUST BE CHANGED AT NEXT LOGON' : ''}`,
      `  CREATED          : ${P.stamp(u.created)}${u.createdBy ? ' BY ' + u.createdBy : ''}`,
      `  LAST LOGON       : ${u.lastOn ? P.stamp(u.lastOn) : 'NEVER'}`,
      ...P.wrap(u.notes || '-', '  NOTES            : ', W, ' '.repeat(21)),
      '',
      [{ t: ' 1 DETAILS  2 PASSWORD/LOGIN  3 PERMISSIONS  4 ACTIVITY  5 DELETE  6 LIST ', c: 'rev' }],
      '',
      L.sectionHead('PERMISSIONS - ' + permSummary(u)),
      ...grid(u)
    ];
    const pick = {
      1: () => detailsForm(u), 2: () => credForm(u), 3: () => permForm(u),
      4: () => activity(u), 5: () => deleteForm(u), 6: () => listScreen()
    };
    return P.report({ title: 'ACCOUNT MANAGER - ' + u.id, id: 'SA100M01', lines, msg,
      select: { label: 'ENTER 1-6', max: 6, pick: n => pick[n]() } });
  }

  /* back to the account with B in the first field */
  const backPre = (u, field) => raw => String(raw[field] || '').trim().toUpperCase() === 'B' ? accountScreen(u) : null;

  function createForm() {
    return P.form({
      title: 'ACCOUNT MANAGER - CREATE NEW ACCOUNT', id: 'SA200M01',
      intro: ['BASE SETS: ENQ (ENQUIRY ONLY)  UPD (ENQUIRY + UPDATE)  ADMIN (EVERYTHING).',
        'YOU CAN ADD OR REMOVE SINGLE CODES ON THE PERMISSIONS SCREEN AFTERWARDS.'],
      vals: { fs: T.user.fs, role: 'ENQ', modes: 'LIVE TRNG', must: 'Y' },
      fields: [
        { n: 'uid', l: 'USER-ID', len: 8, req: true, re: UID_RE, fmt: '3-8 LETTERS/NUMBERS', hint: '(E.G. 99PC4321)' },
        { n: 'name', l: 'NAME / RANK', len: 30, req: true },
        { n: 'fs', l: 'FORCE / STATION', len: 4, req: true, re: L.FS_RE, fmt: 'NNAA' },
        { n: 'role', l: 'BASE SET', len: 5, req: true, opts: Object.keys(P.ROLES), hint: '(ENQ UPD ADMIN)' },
        { n: 'modes', l: 'MODES', len: 14, req: true, re: MODES_RE, fmt: 'LIVE TRNG DEMO' },
        { n: 'copy', l: 'COPY PERMS FROM', len: 8, hint: '(OPTIONAL USER-ID)', gap: true },
        { n: 'pw', l: 'PASSWORD', len: 8, req: true, pw: true, re: PW_RE, fmt: '4-8 LETTERS/NUMBERS' },
        { n: 'pw2', l: 'CONFIRM PASSWORD', len: 8, req: true, pw: true },
        { n: 'must', l: 'CHANGE AT 1ST LOGON', len: 1, opts: ['Y', 'N'], hint: '(Y/N)' },
        { n: 'expires', l: 'ACCOUNT EXPIRES', len: 8, date: true, hint: '(BLANK = NEVER)', gap: true },
        { n: 'notes', l: 'NOTES', len: 50 }
      ],
      submit: v => {
        if (findUser(v.uid)) return { err: 'E: USER-ID ' + v.uid + ' ALREADY EXISTS', field: 'uid' };
        if (v.pw !== v.pw2) return { err: 'E: PASSWORDS DO NOT MATCH', field: 'pw2' };
        const src = v.copy ? findUser(v.copy) : null;
        if (v.copy && !src) return { err: 'E: NO TRACE OF USER-ID ' + v.copy, field: 'copy' };
        const u = { id: v.uid, pw: v.pw, name: v.name, fs: v.fs, role: v.role, modes: v.modes.trim().split(/\s+/),
          allow: src ? [...(src.allow || [])] : [], deny: src ? [...(src.deny || [])] : [],
          mustChange: v.must === 'Y', expires: v.expires || null, notes: v.notes,
          created: new Date().toISOString(), createdBy: T.user.id, lastOn: null, lastOff: null, fails: 0, barred: false };
        tidy(u);
        P.db.users.push(u);
        P.save();
        log(u.id, 'CREATE ACCOUNT');
        return accountScreen(u, 'I: ACCOUNT ' + u.id + ' CREATED' + (src ? ' - PERMISSIONS COPIED FROM ' + src.id : ''));
      }
    });
  }

  function detailsForm(u) {
    return P.form({
      title: 'ACCOUNT MANAGER - DETAILS - ' + u.id, id: 'SA300M01', pre: backPre(u, 'name'),
      intro: ['CHANGE ANY FIELD AND SEND. B IN NAME / RANK GOES BACK WITHOUT SAVING.'],
      vals: { name: u.name, fs: u.fs, role: u.role, modes: u.modes.join(' '), expires: toIn(u.expires), notes: u.notes || '' },
      fields: [
        { n: 'name', l: 'NAME / RANK', len: 30, req: true },
        { n: 'fs', l: 'FORCE / STATION', len: 4, req: true, re: L.FS_RE, fmt: 'NNAA' },
        { n: 'role', l: 'BASE SET', len: 5, req: true, opts: Object.keys(P.ROLES), hint: '(ENQ UPD ADMIN)' },
        { n: 'modes', l: 'MODES', len: 14, req: true, re: MODES_RE, fmt: 'LIVE TRNG DEMO' },
        { n: 'expires', l: 'ACCOUNT EXPIRES', len: 8, date: true, hint: '(BLANK = NEVER)' },
        { n: 'notes', l: 'NOTES', len: 50 }
      ],
      submit: v => {
        if (u === T.user && v.role !== 'ADMIN' && u.role === 'ADMIN') return { err: 'E: CANNOT REMOVE ADMIN FROM YOUR OWN USER-ID', field: 'role' };
        if (u === T.user && !v.modes.includes(T.mode)) return { err: 'E: CANNOT REMOVE THE MODE YOU ARE LOGGED ON IN', field: 'modes' };
        if (u === T.user && v.expires && v.expires < P.today()) return { err: 'E: CANNOT EXPIRE YOUR OWN USER-ID', field: 'expires' };
        Object.assign(u, { name: v.name, fs: v.fs, role: v.role, modes: v.modes.trim().split(/\s+/), expires: v.expires || null, notes: v.notes });
        tidy(u);
        P.save();
        log(u.id, 'AMEND DETAILS');
        return accountScreen(u, 'I: DETAILS UPDATED');
      }
    });
  }

  function credForm(u) {
    return P.form({
      title: 'ACCOUNT MANAGER - PASSWORD / LOGIN - ' + u.id, id: 'SA400M01', pre: backPre(u, 'uid'),
      intro: ['LEAVE NEW PASSWORD BLANK TO KEEP THE CURRENT ONE. B IN USER-ID GOES BACK.',
        'BARRED USERS CANNOT LOG ON. UNBARRING ALSO RESETS THE FAILED LOGON COUNT.'],
      vals: { uid: u.id, must: u.mustChange ? 'Y' : 'N', bar: u.barred ? 'Y' : 'N' },
      fields: [
        { n: 'uid', l: 'USER-ID', len: 8, req: true, hint: '(CHANGE TO RENAME)' },
        { n: 'pw', l: 'NEW PASSWORD', len: 8, pw: true, re: PW_RE, fmt: '4-8 LETTERS/NUMBERS' },
        { n: 'pw2', l: 'CONFIRM PASSWORD', len: 8, pw: true, gap: true },
        { n: 'must', l: 'CHANGE AT NEXT LOGON', len: 1, opts: ['Y', 'N'], hint: '(Y/N)' },
        { n: 'bar', l: 'BARRED', len: 1, opts: ['Y', 'N'], hint: '(Y/N)' }
      ],
      submit: v => {
        if (!UID_RE.test(v.uid)) return { err: 'E: INVALID FORMAT - USER-ID (3-8 LETTERS/NUMBERS)', field: 'uid' };
        if (v.uid !== u.id && findUser(v.uid)) return { err: 'E: USER-ID ' + v.uid + ' ALREADY EXISTS', field: 'uid' };
        if (v.pw !== v.pw2) return { err: 'E: PASSWORDS DO NOT MATCH', field: v.pw ? 'pw2' : 'pw' };
        if (u === T.user && v.bar === 'Y') return { err: 'E: CANNOT BAR YOUR OWN USER-ID', field: 'bar' };
        const notes = [];
        if (v.uid !== u.id) { notes.push('RENAMED FROM ' + u.id); u.id = v.uid; }
        if (v.pw) { u.pw = v.pw; notes.push('PASSWORD RESET'); }
        u.mustChange = v.must === 'Y';
        if (v.bar === 'Y' && !u.barred) notes.push('BARRED');
        if (v.bar === 'N' && u.barred) notes.push('UNBARRED');
        u.barred = v.bar === 'Y';
        if (!u.barred) u.fails = 0;
        P.save();
        log(u.id, 'LOGIN: ' + (notes.join(', ') || 'NO CHANGE'));
        return accountScreen(u, ('I: LOGIN DETAILS UPDATED' + (notes.length ? ' - ' + notes.join(', ') : '')).slice(0, W));
      }
    });
  }

  function permForm(u, msg) {
    tidy(u);
    return P.form({
      title: 'ACCOUNT MANAGER - PERMISSIONS - ' + u.id, id: 'SA500M01', msg,
      intro: [...grid(u), '',
        'ENTER CODES (#VE #VU) OR WHOLE CATEGORIES (NAMES VEHICLES DRIVERS WANTED',
        'ARREST PROPERTY GENERAL ACCESS SIMULATOR, OR ALL). SEND ALL BLANK TO GO BACK.'],
      fields: [
        { n: 'add', l: 'ALLOW', len: 55 },
        { n: 'remove', l: 'BLOCK', len: 55 },
        { n: 'reset', l: 'RESET TO BASE SET', len: 1, opts: ['Y', 'N'], def: 'N', hint: '(Y = CLEAR ALL CHANGES)' }
      ],
      submit: v => {
        if (!v.add && !v.remove && v.reset !== 'Y') return accountScreen(u);
        const add = parseCodes(v.add), rem = parseCodes(v.remove);
        if (add.err) return { err: add.err, field: 'add' };
        if (rem.err) return { err: rem.err, field: 'remove' };
        if (u === T.user && rem.includes('#SA')) return { err: 'E: CANNOT BLOCK #SA ON YOUR OWN USER-ID', field: 'remove' };
        if (v.reset === 'Y') { u.allow = []; u.deny = []; }
        for (const c of add) { u.deny = u.deny.filter(x => x !== c); if (!P.roleAllows(u.role, c)) u.allow.push(c); }
        for (const c of rem) { u.allow = u.allow.filter(x => x !== c); if (P.roleAllows(u.role, c)) u.deny.push(c); }
        tidy(u);
        const kept = rem.filter(c => P.ALWAYS.includes(c));
        P.save();
        log(u.id, `PERMISSIONS: +${add.length} -${rem.length}${v.reset === 'Y' ? ' RESET' : ''}`);
        return permForm(u, ('I: SAVED - ' + permSummary(u) + (kept.length ? ' (' + kept.join(' ') + ' ALWAYS ALLOWED)' : '')).slice(0, W));
      }
    });
  }

  function activity(u) {
    const list = P.db.log.filter(e => e.user === u.id).reverse().slice(0, 300);
    const lines = ['DATE/TIME      TC  MODE ORIGINATOR             RC DATA / NOTE', '-'.repeat(W)];
    for (const e of list) lines.push(`${P.stamp(e.ts)} ${e.tcode} ${P.pad(e.mode, 4)} ${P.pad(e.orig, 22)} ${P.pad(e.reason, 2)} ${P.pad(e.note || e.data, 28)}`);
    if (!list.length) lines.push('NO TRANSACTIONS RECORDED FOR THIS USER-ID');
    return P.report({ title: `ACTIVITY - ${u.id} - LAST ${list.length} TRANSACTION(S)`, id: 'SA600M01', lines,
      select: { label: 'ENTER 1 TO RETURN TO THE ACCOUNT', max: 1, pick: () => accountScreen(u) } });
  }

  function deleteForm(u) {
    return P.form({
      title: 'ACCOUNT MANAGER - DELETE - ' + u.id, id: 'SA700M01',
      intro: ['** THIS PERMANENTLY REMOVES THE USER-ID. ITS AUDIT LOG ENTRIES ARE KEPT. **'],
      fields: [{ n: 'confirm', l: 'TYPE THE USER-ID TO CONFIRM', len: 8, hint: '(BLANK = GO BACK)' }],
      submit: v => {
        if (!v.confirm) return accountScreen(u);
        if (v.confirm !== u.id) return { err: 'E: USER-ID DOES NOT MATCH', field: 'confirm' };
        if (u === T.user) return { err: 'E: CANNOT DELETE THE USER-ID CURRENTLY LOGGED ON', field: 'confirm' };
        P.db.users.splice(P.db.users.indexOf(u), 1);
        P.save();
        log(u.id, 'DELETE ACCOUNT');
        return listScreen('I: ACCOUNT ' + u.id + ' DELETED');
      }
    });
  }

  P.TX['#SA'] = {
    d: 'ACCOUNT MANAGER (USERS & PERMISSIONS)', role: 'ADMIN', cat: 'ACCESS CONTROL',
    run: data => {
      if (data === 'NEW') return createForm();
      if (data) { const u = findUser(data); return u ? accountScreen(u) : P.blank('I: NO TRACE OF USER-ID ' + data); }
      return listScreen();
    }
  };

})(window.PNC);
