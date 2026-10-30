/* PNC mock - transaction codes. Each entry: P.TX['#XX'] = { d, role, cat, run(data) }.
   Codes and screen behaviour follow the PNC User Manual (Appendix 5a), simplified for roleplay. */
'use strict';
(function (P) {
  const T = P.T;
  const D = () => P.data(T.mode);
  const W = 78;

  function reg(code, d, role, cat, run, opts) {
    P.TX[code] = Object.assign({ d, role, cat, run }, opts || {});
  }

  /* ================================================================ shared helpers */

  const CHK = 'ABCDEFGHJKLMNPQRTUVWXYZ';
  const check = s => { let h = 0; for (const c of s) h = (h * 7 + c.charCodeAt(0)) % 23; return CHK[h]; };
  function nextSeq() { const d = D(); d.seq = (d.seq || 1000) + 1; return d.seq; }
  const yy = () => P.today().slice(2, 4);

  function newPncId() {
    let id;
    do { const n = String(300000 + nextSeq() * 7 % 699999); id = `${yy()}/${n}${check(n)}`; } while (findPerson(id));
    return id;
  }
  function newPropId() {
    let id;
    do { const n = String(5000000 + nextSeq() * 13 % 4999999); id = `${yy()}/${n}${check(n)}`; } while (D().property.some(p => p.propId === id));
    return id;
  }
  const newAsRef = fs => { const n = String(nextSeq()).padStart(5, '0'); return `${yy()}/${fs}/01/${n}${check(n)}`; };

  const FS_RE = /^\d{2}[A-Z0-9]{2}$/;
  const fsField = (n = 'fs', l = 'FORCE/STATION') => ({ n, l, len: 4, req: true, re: FS_RE, fmt: 'NNAA', init: () => T.user.fs });
  const sectionHead = (t, c = 'rev') => [{ t: ` ${t} `, c }];
  const twoCol = (obj, w = 38, per = 2) => {
    const items = Object.entries(obj).map(([k, v]) => P.pad(`${k} ${v}`, w).slice(0, w));
    const rows = [];
    for (let i = 0; i < items.length; i += per) rows.push(' ' + items.slice(i, i + per).join(' ').trimEnd());
    return rows;
  };
  const ftin = cm => { if (!cm) return ''; let i = Math.round(cm / 2.54), f = Math.floor(i / 12); i -= f * 12; return `${f}'${i}"`; };
  const log = (code, key, note) => P.logTx(code, key, note);
  const banner = (text, c = 'warn') => [{ t: P.pad(P.center(text), W), c }];

  /* record who changed what: newest first, 50 kept */
  function stamp(rec, code, note) {
    rec.updated = new Date().toISOString();
    rec.updatedBy = T.user.fs;
    (rec.history = rec.history || []).unshift({ ts: rec.updated, user: T.user.id, fs: T.user.fs, tc: code, note: String(note || '').slice(0, 40) });
    if (rec.history.length > 50) rec.history.length = 50;
  }
  function historyLines(rec) {
    const h = rec.history || [];
    if (!h.length) return [`LAST UPDATED: ${rec.updated ? P.stamp(rec.updated) + ' BY ' + rec.updatedBy : 'NO UPDATES SINCE CREATION'}`];
    const L = [sectionHead(`UPDATE HISTORY - LAST UPDATED ${P.stamp(h[0].ts)} BY ${h[0].user}`)];
    for (const e of h.slice(0, 10)) L.push(`  ${P.stamp(e.ts)}  ${P.pad(e.user, 8)} ${e.fs}  ${e.tc}  ${e.note}`);
    if (h.length > 10) L.push(`  ... ${h.length - 10} EARLIER UPDATE(S) NOT SHOWN`);
    return L;
  }

  /* turn a list of updated values into a form initial-values object */
  function initVals(fields, base) {
    const v = Object.assign({}, base);
    for (const f of fields) if (f.init && v[f.n] == null) v[f.n] = f.init();
    return v;
  }

  /* ================================================================ NAMES */

  function findPerson(id) {
    id = String(id || '').trim().toUpperCase();
    if (!id) return null;
    return D().persons.find(p => p.pncId === id || (p.cro && p.cro === id)) || null;
  }
  const PNCID_RE = /^\d{2}\/\d{1,7}[A-Z]$/, CRO_RE = /^\d{1,6}\/\d{2}[A-Z]$/;

  function soundex(s) {
    s = String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!s) return '';
    const map = { B: 1, F: 1, P: 1, V: 1, C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2, D: 3, T: 3, L: 4, M: 5, N: 5, R: 6 };
    let out = s[0], last = map[s[0]] || 0;
    for (const c of s.slice(1)) {
      const code = map[c] || 0;
      if (code && code !== last) out += code;
      if (c !== 'H' && c !== 'W') last = code;
    }
    return (out + '000').slice(0, 4);
  }

  function searchPersons(q) {
    const sx = soundex(q.surname);
    const hits = [];
    for (const p of D().persons) {
      let score = 0;
      if (q.surname) {
        const sn = q.surname;
        const aliasSurnames = (p.aliases || []).map(a => a.split(',')[0].trim());
        if (sn.endsWith('*')) { if (p.surname.startsWith(sn.slice(0, -1))) score = 3; else if (aliasSurnames.some(a => a.startsWith(sn.slice(0, -1)))) score = 2; }
        else if (p.surname === sn) score = 3;
        else if (aliasSurnames.includes(sn)) score = 2;
        else if (soundex(p.surname) === sx) score = 1;
        if (!score) continue;
      }
      if (q.forename) {
        const f = q.forename.replace(/\*$/, '');
        if (!p.forenames.split(' ').some(n => n.startsWith(f))) continue;
      }
      if (q.dob) {
        if (p.dob === q.dob) score += 3;
        else if (Math.abs(+p.dob.slice(0, 4) - +q.dob.slice(0, 4)) <= 2) score += 0;
        else continue;
      }
      if (q.sex && p.sex !== q.sex) continue;
      if (q.eth && p.eth !== q.eth) continue;
      if (q.height && Math.abs((p.height || 0) - q.height) > 10) continue;
      hits.push({ p, score });
    }
    return hits.sort((a, b) => b.score - a.score || a.p.surname.localeCompare(b.p.surname) || a.p.forenames.localeCompare(b.p.forenames)).map(h => h.p);
  }

  function flags(p) {
    const f = [];
    if (p.wm.length) f.push('WM');
    if (p.warnings.length) f.push('WS');
    if (p.oi.length) f.push('OI');
    if (p.arrests.some(a => a.status === 'IMPENDING PROSECUTION')) f.push('IP');
    if (p.convictions.length) f.push('CV');
    if ((p.disposals || []).length) f.push('CA');
    if (p.firearms && ['VALID', 'REVIEW'].includes(p.firearms.status)) f.push('FC');
    return f.join(' ');
  }

  /* ---------------------------------------------------------------- cross-references */

  const fullName = p => `${p.surname}, ${p.forenames}`;
  const linkedVehicles = p => D().vehicles.filter(v => v.keeper && (v.keeper.pncId ? v.keeper.pncId === p.pncId : v.keeper.name === fullName(p)));
  const linkedDriver = p => D().drivers.find(d => d.surname === p.surname && d.forenames === p.forenames && d.dob === p.dob) || null;
  const driverPerson = d => D().persons.find(p => p.surname === d.surname && p.forenames === d.forenames && p.dob === d.dob) || null;
  function keeperPerson(v) {
    const k = v.keeper;
    if (!k) return null;
    return k.pncId ? findPerson(k.pncId) : D().persons.find(p => fullName(p) === k.name) || null;
  }

  /* bold lines at the very top of a person record */
  const WM_BANNER = { WANTED: 'SUBJECT IS WANTED', MISSING: 'SUBJECT IS MISSING', ABSCOND: 'SUBJECT IS WANTED - ABSCONDER',
    RECALL: 'SUBJECT IS WANTED - RECALL TO PRISON', LOCATE: 'SUBJECT TO BE LOCATED - SEE REPORT', DESERT: 'SUBJECT IS WANTED - DESERTER', DETAINED: 'SUBJECT IS DETAINED' };
  function personBanners(p, prefix = '') {
    const B = [];
    for (const c of new Set(p.wm.map(w => w.cls))) B.push(banner(`** ${prefix}${WM_BANNER[c] || 'WANTED/MISSING REPORT HELD'} **`));
    if (p.warnings.length) B.push(banner(`** ${prefix}WARNING SIGNALS: ${p.warnings.map(w => w.code).join(' ')} **`));
    const fa = p.firearms;
    if (fa && ['VALID', 'REVIEW'].includes(fa.status)) B.push(banner(`** ${prefix}FIREARMS CERTIFICATE HOLDER - ${fa.type} ${fa.status} **`));
    else if (fa && fa.status === 'REVOKED') B.push(banner(`** ${prefix}FIREARMS CERTIFICATE REVOKED **`, 'rev'));
    if (p.markers.some(m => m.code === 'SO' || m.code === 'VS')) B.push(banner(`** ${prefix}REGISTERED SEX OFFENDER / VISOR **`));
    const dr = linkedDriver(p);
    if (dr && driverStatus(dr) === 'DISQUALIFIED') B.push(banner(`** ${prefix}DISQUALIFIED DRIVER **`));
    if (p.oi.length) B.push(banner(`** ${prefix}OPERATIONAL INFORMATION HELD: ${[...new Set(p.oi.map(o => o.type))].join(' ')} **`, 'rev'));
    if (p.arrests.some(a => a.status === 'IMPENDING PROSECUTION')) B.push(banner(`** ${prefix}IMPENDING PROSECUTION **`, 'rev'));
    if (!prefix && p.bio && p.bio.dna === 'R') B.push(banner('** DNA SAMPLE REQUIRED **', 'rev'));
    return B;
  }

  function personList(list, title, cut) {
    const lines = [' NO  NAME                           DOB       SEX  PNCID        FLAGS', ' --  ' + '-'.repeat(72)];
    list.forEach((p, i) => {
      const row = ` ${String(i + 1).padStart(2)}  ${P.pad(p.surname + ', ' + p.forenames, 30)} ${P.dt4(p.dob)}  ${p.sex}   ${P.pad(p.pncId, 12)} ${flags(p)}`;
      lines.push(p.wm.length ? [{ t: row, c: 'bright' }] : row);
    });
    lines.push('', ' FLAGS: WM WANTED/MISSING  WS WARNING SIGNALS  OI OPERATIONAL INFO', '        IP IMPENDING PROSECUTION  CV CONVICTIONS  CA CAUTIONS/PNDS',
      '        FC FIREARMS CERTIFICATE HOLDER');
    return P.report({
      title: `${title} - ${list.length} RECORD(S) FOUND`, id: 'PR201M02', lines,
      select: { label: 'ENTER NO. OF RECORD TO DISPLAY', max: list.length, pick: n => showPerson(list[n - 1], '', cut) }
    });
  }

  function personLines(p, cut) {
    const L = personBanners(p);
    if (L.length) L.push('');
    L.push(P.cols(`PNCID: ${p.pncId}    CRO: ${p.cro || 'NONE'}`, `OWNER: ${p.creator}  CREATED: ${P.dt(p.created)}`));
    L.push([{ t: `${p.surname}, ${p.forenames}`, c: 'bright' }]);
    L.push(`SEX: ${p.sex}    DOB: ${P.dt4(p.dob)} (AGE ${P.age(p.dob)})    POB: ${p.pob || 'NOT KNOWN'}`);
    L.push(`ETHNIC APP: IC${p.eth} ${P.ETHNIC[p.eth] || ''}    NATIONALITY: ${p.nat || 'NOT KNOWN'}`);
    L.push(`HEIGHT: ${p.height ? p.height + 'CM (' + ftin(p.height) + ')' : 'NOT KNOWN'}    BUILD: ${p.build || '-'}`);
    L.push(`HAIR: ${p.hair || '-'}    EYES: ${p.eyes || '-'}`);
    const bio = p.bio || {}, bioTxt = (c, where) => c === 'Y' ? `TAKEN (${where})` : P.BIO[c] || 'NOT TAKEN';
    L.push(['DNA: ', bio.dna === 'R' ? { t: 'REQUIRED', c: 'warn' } : bioTxt(bio.dna, 'NDNAD'), '   FINGERPRINTS: ',
      bio.fp === 'R' ? { t: 'REQUIRED', c: 'warn' } : bioTxt(bio.fp, 'IDENT1'), `   PHOTO: ${p.photo ? 'HELD (F6)' : 'NONE'}`]);
    if (p.aliases.length) L.push(...P.wrap('ALIAS/AKA: ' + p.aliases.join('; '), ''));
    L.push('');

    if (p.wm.length) {
      L.push(sectionHead(`*** WANTED / MISSING - ${p.wm.length} REPORT(S) ***`, 'warn'));
      for (const w of p.wm) {
        L.push([` ${w.no}. `, { t: ` ${w.cls} `, c: 'warn' }, ` ${w.offence}`]);
        L.push(`    INC DATE: ${P.dt(w.inc)}   OWNER: ${w.owner}   REF: ${w.ref || '-'}   WEED: ${P.dt(w.weed) || 'UNLIMITED'}`);
        L.push(...P.wrap(w.text, '    '));
        if (w.action) L.push(...P.wrap('ACTION: ' + w.action, '    '));
      }
      L.push('');
    }

    if (p.warnings.length) {
      L.push(sectionHead('WARNING SIGNALS'));
      for (const w of p.warnings) L.push(`  ${w.code}  ${P.pad(P.WARNINGS[w.code] || '?', 36)} ${w.fs}  ${P.dt(w.date)}`);
    } else L.push('NO WARNING SIGNALS');
    if (p.markers.length) {
      L.push(sectionHead('INFORMATION MARKERS'));
      for (const m of p.markers) L.push(`  ${m.code}  ${P.pad(P.MARKERS[m.code] || '?', 36)} ${m.fs}  ${P.dt(m.date)}`);
    }
    L.push('');

    const fa = p.firearms;
    if (fa) {
      const live = ['VALID', 'REVIEW'].includes(fa.status);
      L.push(sectionHead('FIREARMS LICENSING', live ? 'warn' : 'rev'));
      L.push(`  ${fa.type} ${P.FIREARM_CERTS[fa.type] || ''}   NO. ${fa.certNo || '-'}`);
      L.push(['  STATUS: ', { t: ` ${fa.status} `, c: live ? 'warn' : 'rev' }, `   ISSUED: ${P.dt(fa.issued) || '-'}   EXPIRES: ${P.dt(fa.expires) || '-'}`]);
      if (fa.holdings) L.push(...P.wrap('HOLDINGS: ' + fa.holdings, '  '));
      if (fa.notes) L.push(...P.wrap('NOTES: ' + fa.notes, '  '));
      L.push('');
    }

    if (p.oi.length) {
      L.push(sectionHead('OPERATIONAL INFORMATION'));
      p.oi.forEach((o, i) => {
        L.push(` ${i + 1}. ${o.cat} - ${o.type} ${P.OI_TYPES[o.type] || ''}`);
        L.push(`    START: ${P.dt(o.start)}   WEED: ${P.dt(o.weed) || 'UNLIMITED'}   OWNER: ${o.owner}`);
        L.push(...P.wrap(o.text, '    '));
      });
      L.push('');
    }

    const imp = p.arrests.filter(a => a.status === 'IMPENDING PROSECUTION');
    if (imp.length) {
      L.push(sectionHead('IMPENDING PROSECUTIONS'));
      imp.forEach((a, i) => {
        L.push(` ${i + 1}. A/S ${a.asRef}  ${a.type || 'ARREST'} ${P.dt(a.date)} BY ${a.fs}`);
        a.offences.forEach((o, j) => L.push(...P.wrap(`${j + 1}. ${o}`, '    ', W, '       ')));
      });
      L.push('');
    }

    const dr = linkedDriver(p), vehs = linkedVehicles(p);
    L.push(sectionHead('LINKED RECORDS'));
    if (dr) {
      const st = driverStatus(dr);
      L.push(['  DRIVING LICENCE: ', `${dr.driverNo}  `, st === 'DISQUALIFIED' ? { t: ' DISQUALIFIED ', c: 'warn' } : st.split(' - ')[0], '  (#DL)']);
    } else L.push('  DRIVING LICENCE: NO MATCHING DRIVER RECORD');
    if (!vehs.length) L.push('  KEEPER OF VEHICLES: NONE');
    for (const v of vehs) L.push(`  KEEPER OF: ${P.pad(fmtVrm(v.vrm), 9)} ${P.pad(`${v.colour} ${v.make} ${v.model}`, 30)} ${v.reports.map(r => r.type).join(' ')}${anprActive(v) ? ' ANPR-' + v.anpr.action : ''}`);
    L.push('');

    if (cut) { L.push('** CUT-DOWN ENQUIRY - USE #NE FOR FULL RECORD **'); return L; }

    L.push(sectionHead('ADDRESSES'));
    if (!p.addresses.length) L.push('  NONE RECORDED');
    p.addresses.forEach((a, i) => {
      L.push(...P.wrap(`${i + 1}. ${P.pad(a.type, 4)} ${a.text}${a.postcode ? ' ' + a.postcode : ''}  (FROM ${P.dt(a.from)})`, ' '));
    });
    if (p.marks.length) {
      L.push(sectionHead('MARKS / SCARS / TATTOOS'));
      p.marks.forEach((m, i) => L.push(` ${i + 1}. ${m}`));
    }
    L.push('');

    const offCount = p.convictions.reduce((n, c) => n + c.offences.length, 0);
    L.push(sectionHead(`CONVICTION HISTORY - ${p.convictions.length} CONVICTION(S) FOR ${offCount} OFFENCE(S)`));
    if (!p.convictions.length) L.push('  NO CONVICTIONS RECORDED');
    [...p.convictions].sort((a, b) => a.date.localeCompare(b.date)).forEach((c, i) => {
      L.push(`${String(i + 1).padStart(3)}. ${P.dt(c.date)} AT ${c.court}`);
      if (c.sentenced) L.push(`     SENTENCED ON ${P.dt(c.sentenced)} AT ${c.sentCourt || c.court}`);
      c.offences.forEach((o, j) => {
        L.push(...P.wrap(`${j + 1}. ${o.title}`, '      ', 66, '         '));
        L.push(`         OFFENCE DATE ${P.dt(o.offDate) || '-'}   PLEA ${o.plea || '-'}`);
        L.push(...P.wrap(o.result, '         '));
      });
    });

    const disp = p.disposals || [];
    L.push('', sectionHead(`CAUTIONS / PENALTY NOTICES / COMMUNITY RESOLUTIONS - ${disp.length}`));
    if (!disp.length) L.push('  NONE RECORDED');
    disp.forEach((x, i) => {
      L.push(`${String(i + 1).padStart(3)}. ${P.dt(x.date)}  ${P.pad(x.type, 3)} ${P.pad(P.DISPOSALS[x.type] || x.type, 28)} BY ${x.fs}`);
      L.push(...P.wrap(x.offence, '      '));
      if (x.detail) L.push(...P.wrap(x.detail, '      '));
    });

    const nc = p.arrests.filter(a => a.status !== 'IMPENDING PROSECUTION');
    if (nc.length) {
      L.push('', sectionHead('NON-CONVICTION DISPOSALS'));
      nc.forEach((a, i) => {
        L.push(` ${i + 1}. A/S ${a.asRef}  ${P.dt(a.date)}  ${a.status}`);
        a.offences.forEach((o, j) => L.push(...P.wrap(`${j + 1}. ${o}`, '    ', W, '       ')));
      });
    }
    L.push('', ...historyLines(p));
    return L;
  }

  function showPerson(p, msg, cut) {
    T.ctx.pncId = p.pncId;
    const s = P.report({ title: cut ? 'NAMES CUT-DOWN ENQUIRY' : 'NAMES ENQUIRY - PERSON RECORD', id: cut ? 'PR201M05' : 'PR201M04', lines: personLines(p, cut), msg });
    s.photo = p.photo || null;
    return s;
  }

  function parseNameData(data) {
    const parts = data.split('/').map(s => s.trim());
    const q = { surname: parts.shift() };
    for (const part of parts) {
      if (/^\d{6,8}$/.test(part)) q.dob = P.parseDate(part);
      else if (/^[MFU]$/.test(part)) q.sex = part;
      else if (!q.forename) q.forename = part;
    }
    return q;
  }

  function nameEnquiry(data, cut) {
    if (PNCID_RE.test(data) || CRO_RE.test(data)) {
      const p = findPerson(data);
      return p ? showPerson(p, '', cut) : P.blank('I: NO TRACE OF RECORD WITH PNCID/CRO ' + data);
    }
    const q = parseNameData(data);
    if (!q.surname) return P.blank('E: SURNAME REQUIRED', true);
    const hits = searchPersons(q);
    if (!hits.length) return P.blank(`I: NO TRACE - ${data}`);
    if (hits.length === 1 && hits[0].surname === q.surname.replace(/\*$/, '')) return showPerson(hits[0], 'I: 1 RECORD FOUND', cut);
    return personList(hits, cut ? 'NAMES CUT-DOWN ENQUIRY' : 'NAMES ENQUIRY', cut);
  }

  function nameForm(title, cut) {
    return P.form({
      title, id: 'PR201M01',
      intro: ['ENTER NAME AS SURNAME/FORENAME (E.G. HUGHES/DANIEL). * AFTER A NAME FOR', 'PREFIX SEARCH. OR ENTER A PNCID/CRO IN NUMBER ENQUIRY.'],
      fields: [
        { h: 'NAME ENQUIRY' },
        { n: 'name', l: 'NAME', len: 40 },
        { n: 'dob', l: 'DOB', len: 8, date: true, hint: '(DDMMYYYY)' },
        { n: 'sex', l: 'SEX', len: 1, opts: ['M', 'F', 'U'] },
        { n: 'eth', l: 'COLOUR (IC)', len: 1, opts: ['0', '1', '2', '3', '4', '5', '6'], hint: '(1-6)' },
        { n: 'height', l: 'HEIGHT', len: 3, num: true, hint: '(CM)' },
        { h: 'NUMBER ENQUIRY' },
        { n: 'number', l: 'NUMBER', len: 12 }
      ],
      submit: v => {
        if (v.number) {
          const p = findPerson(v.number);
          return p ? showPerson(p, '', cut) : { err: 'I: NO TRACE OF NUMBER ' + v.number, field: 'number' };
        }
        if (!v.name) return { err: 'E: ENTER A NAME OR A NUMBER', field: 'name' };
        const q = parseNameData(v.name);
        if (v.dob) q.dob = v.dob;
        if (v.sex) q.sex = v.sex;
        if (v.eth) q.eth = v.eth;
        if (v.height) q.height = +v.height;
        const hits = searchPersons(q);
        if (!hits.length) return { err: 'I: NO TRACE - ' + v.name, field: 'name' };
        return hits.length === 1 ? showPerson(hits[0], 'I: 1 RECORD FOUND', cut) : personList(hits, title, cut);
      }
    });
  }

  reg('#NE', 'NAMES ENQUIRY', 'ENQ', 'NAMES', data => data ? nameEnquiry(data) : nameForm('NAME ENQUIRY'));
  reg('#NQ', 'NAMES CUT-DOWN ENQUIRY', 'ENQ', 'NAMES', data => data ? nameEnquiry(data, true) : nameForm('NAMES CUT-DOWN ENQUIRY', true));

  reg('#NO', 'WM/DD ENQUIRY', 'ENQ', 'NAMES', data => {
    const filt = (data || '').trim();
    const list = D().persons.filter(p => p.wm.some(w => !filt || w.cls === filt || w.owner.startsWith(filt)));
    if (!list.length) return P.blank('I: NO WANTED/MISSING REPORTS' + (filt ? ' MATCHING ' + filt : ''));
    const lines = [' NO  CLASS     NAME                        DOB       OWNER  INC DATE', ' --  ' + '-'.repeat(68)];
    list.forEach((p, i) => {
      const w = p.wm.find(x => !filt || x.cls === filt || x.owner.startsWith(filt));
      lines.push(` ${String(i + 1).padStart(2)}  ${P.pad(w.cls, 9)} ${P.pad(p.surname + ', ' + p.forenames, 27)} ${P.dt(p.dob)}  ${P.pad(w.owner, 6)} ${P.dt(w.inc)}`);
    });
    lines.push('', ' DATA MAY CONTAIN A CLASS (E.G. MISSING) OR FORCE/STATION CODE TO FILTER.');
    return P.report({ title: 'WANTED / MISSING ENQUIRY', id: 'PR301M01', lines, select: { max: list.length, pick: n => showPerson(list[n - 1]) } });
  });

  /* QUEST: find people from a description rather than a name */
  reg('#QE', 'QUEST DESCRIPTIVE SEARCH', 'ENQ', 'NAMES', () => P.form({
    title: 'QUEST - DESCRIPTIVE SEARCH', id: 'PR205M01',
    intro: ['DESCRIBE THE SUBJECT. EVERY FIELD FILLED MUST MATCH. MARKS: ALL WORDS MUST', 'APPEAR IN ONE MARK, E.G. TATTOO ROSE. AREA SEARCHES ADDRESSES AND POSTCODES.'],
    fields: [
      { n: 'sex', l: 'SEX', len: 1, opts: ['M', 'F', 'U'] },
      { n: 'agefrom', l: 'AGE FROM', len: 3, num: true }, { n: 'ageto', l: 'AGE TO', len: 3, num: true },
      { n: 'hfrom', l: 'HEIGHT FROM (CM)', len: 3, num: true }, { n: 'hto', l: 'HEIGHT TO (CM)', len: 3, num: true },
      { n: 'eth', l: 'ETHNIC APP (IC)', len: 1, opts: ['0', '1', '2', '3', '4', '5', '6'], hint: '(1-6)' },
      { n: 'build', l: 'BUILD', len: 10 }, { n: 'hair', l: 'HAIR', len: 15, hint: '(PART, E.G. GINGER)' }, { n: 'eyes', l: 'EYES', len: 10 },
      { n: 'marks', l: 'MARKS / TATTOOS', len: 30 },
      { n: 'area', l: 'AREA / POSTCODE', len: 20, hint: '(E.G. SALFORD OR M30)' },
      { n: 'ws', l: 'WARNING SIGNAL', len: 2, opts: Object.keys(P.WARNINGS) },
      { n: 'wanted', l: 'WANTED/MISSING ONLY', len: 1, opts: ['Y', 'N'], def: 'N' }
    ],
    submit: q => {
      const set = Object.entries(q).filter(([k, x]) => x && !(k === 'wanted' && x === 'N'));
      if (!set.length) return { err: 'E: ENTER AT LEAST ONE DESCRIPTION FIELD', field: 'sex' };
      const has = (a, b) => !b || String(a || '').includes(b);
      const words = q.marks.split(/\s+/).filter(Boolean);
      const list = D().persons.filter(p => {
        const age = P.age(p.dob);
        return (!q.sex || p.sex === q.sex) && (!q.eth || p.eth === q.eth) &&
          (!q.agefrom || age >= +q.agefrom) && (!q.ageto || age <= +q.ageto) &&
          (!q.hfrom || (p.height || 0) >= +q.hfrom) && (!q.hto || (p.height && p.height <= +q.hto)) &&
          has(p.build, q.build) && has(p.hair, q.hair) && has(p.eyes, q.eyes) &&
          (!words.length || p.marks.some(m => words.every(w => m.includes(w)))) &&
          (!q.area || p.addresses.some(a => has(`${a.text} ${a.postcode || ''}`, q.area))) &&
          (!q.ws || p.warnings.some(w => w.code === q.ws)) && (q.wanted !== 'Y' || p.wm.length);
      }).sort((a, b) => a.surname.localeCompare(b.surname));
      if (!list.length) return { err: 'I: NO PERSONS MATCH THAT DESCRIPTION', field: 'sex' };
      return personList(list, 'QUEST SEARCH');
    }
  }));

  /* ---------------------------------------------------------------- names updates */

  const idFields = () => [
    { n: 'pncid', l: 'PNCID/CRO NUMBER', len: 12, req: true },
    { n: 'check', l: 'CHECKNAME (SURNAME)', len: 20, req: true, gap: true }
  ];
  function checked(v) {
    const p = findPerson(v.pncid);
    if (!p) return { err: 'E: NO TRACE OF PNCID/CRO ' + v.pncid, field: 'pncid' };
    if (p.surname !== v.check) return { err: 'E: CHECKNAME DOES NOT MATCH SURNAME HELD ON RECORD', field: 'check' };
    return p;
  }

  /* builds a names update transaction requiring PNCID + CHECKNAME */
  function personUpdate(code, d, id, fields, apply, intro, role = 'UPD', cat = 'NAMES') {
    reg(code, d, role, cat, data => {
      const all = [...idFields(), ...fields];
      return P.form({
        title: d, id, intro, fields: all,
        vals: initVals(all, { pncid: data || T.ctx.pncId || '' }),
        submit: v => {
          const p = checked(v);
          if (p.err) return p;
          const r = apply(p, v);
          if (r && r.err) return r;
          if (r === 'DELETED') return P.blank('I: RECORD ' + v.pncid + ' DELETED');
          stamp(p, code, r);
          P.save();
          log(code, p.pncId, 'UPDATE: ' + r);
          return showPerson(p, ('I: UPDATE COMPLETE - ' + r).slice(0, W));
        }
      });
    });
  }

  reg('#NU', 'NAMES UPDATE - CREATE PERSON', 'UPD', 'NAMES', () => {
    const fields = [
      { n: 'surname', l: 'SURNAME', len: 20, req: true, re: /^[A-Z][A-Z' -]*$/ },
      { n: 'forenames', l: 'FORENAME(S)', len: 30, req: true },
      { n: 'dob', l: 'DATE OF BIRTH', len: 8, req: true, date: true, hint: '(DDMMYYYY)' },
      { n: 'sex', l: 'SEX', len: 1, req: true, opts: ['M', 'F', 'U'], hint: '(M/F/U)' },
      { n: 'eth', l: 'ETHNIC APP (IC)', len: 1, req: true, opts: ['0', '1', '2', '3', '4', '5', '6'], hint: '(1-6, 0 UNKNOWN)' },
      { n: 'height', l: 'HEIGHT (CM)', len: 3, num: true },
      { n: 'build', l: 'BUILD', len: 10 },
      { n: 'hair', l: 'HAIR', len: 15 },
      { n: 'eyes', l: 'EYES', len: 10 },
      { n: 'pob', l: 'PLACE OF BIRTH', len: 20 },
      { n: 'nat', l: 'NATIONALITY', len: 15 },
      { n: 'cro', l: 'CRO NUMBER', len: 10 },
      { n: 'addr', l: 'HOME ADDRESS', len: 50 },
      { n: 'postcode', l: 'POSTCODE', len: 8 },
      fsField('fs', 'OWNER FCE/STN'),
      { n: 'confirm', l: 'CONFIRM CREATE', len: 1, opts: ['Y', 'N'], hint: '(Y IF POSSIBLE DUPLICATE)' }
    ];
    return P.form({
      title: 'NAMES UPDATE - CREATE NEW PERSON RECORD', id: 'PR210M01', fields, vals: initVals(fields, {}),
      submit: v => {
        const dup = D().persons.find(p => p.surname === v.surname && p.dob === v.dob);
        if (dup && v.confirm !== 'Y') return { err: `E: POSSIBLE DUPLICATE ${dup.pncId} - ENTER Y IN CONFIRM CREATE`, field: 'confirm' };
        if (v.cro && findPerson(v.cro)) return { err: 'E: CRO NUMBER ALREADY HELD ON ANOTHER RECORD', field: 'cro' };
        const p = {
          pncId: newPncId(), cro: v.cro, surname: v.surname, forenames: v.forenames, dob: v.dob, sex: v.sex, eth: v.eth,
          height: v.height ? +v.height : null, build: v.build, hair: v.hair, eyes: v.eyes, pob: v.pob, nat: v.nat,
          aliases: [], addresses: v.addr ? [{ type: 'HOME', text: v.addr, postcode: v.postcode, from: P.today() }] : [],
          warnings: [], markers: [], marks: [], wm: [], oi: [], arrests: [], convictions: [],
          disposals: [], firearms: null, bio: { dna: 'N', fp: 'N' }, photo: null, history: [],
          created: P.today(), creator: v.fs
        };
        stamp(p, '#NU', 'RECORD CREATED');
        D().persons.push(p);
        P.save();
        log('#NU', p.pncId, 'CREATE PERSON ' + p.surname);
        return showPerson(p, 'I: PERSON RECORD CREATED - PNCID ' + p.pncId);
      }
    });
  });

  personUpdate('#NN', 'NOMINAL & DESCRIPTIVE DETAILS UPDATE', 'PR210M02', [
    { txt: '  LEAVE A FIELD BLANK TO KEEP THE CURRENT VALUE.' },
    { n: 'forenames', l: 'FORENAME(S)', len: 30 },
    { n: 'dob', l: 'DATE OF BIRTH', len: 8, date: true },
    { n: 'sex', l: 'SEX', len: 1, opts: ['M', 'F', 'U'] },
    { n: 'eth', l: 'ETHNIC APP (IC)', len: 1, opts: ['0', '1', '2', '3', '4', '5', '6'] },
    { n: 'height', l: 'HEIGHT (CM)', len: 3, num: true },
    { n: 'build', l: 'BUILD', len: 10 },
    { n: 'hair', l: 'HAIR', len: 15 },
    { n: 'eyes', l: 'EYES', len: 10 },
    { n: 'pob', l: 'PLACE OF BIRTH', len: 20 },
    { n: 'nat', l: 'NATIONALITY', len: 15 },
    { n: 'cro', l: 'CRO NUMBER', len: 10 },
    { n: 'alias', l: 'ADD ALIAS', len: 40, hint: '(SURNAME, FORENAMES)' },
    { n: 'dna', l: 'DNA', len: 1, opts: ['Y', 'N', 'R'], hint: '(Y TAKEN, N NOT TAKEN, R REQUIRED)' },
    { n: 'fp', l: 'FINGERPRINTS', len: 1, opts: ['Y', 'N', 'R'], hint: '(Y TAKEN, N NOT TAKEN, R REQUIRED)' }
  ], (p, v) => {
    const changed = [];
    for (const k of ['forenames', 'dob', 'sex', 'eth', 'build', 'hair', 'eyes', 'pob', 'nat', 'cro']) if (v[k]) { p[k] = v[k]; changed.push(k.toUpperCase()); }
    for (const k of ['dna', 'fp']) if (v[k]) { p.bio = Object.assign({ dna: 'N', fp: 'N' }, p.bio, { [k]: v[k] }); changed.push(k === 'fp' ? 'PRINTS' : 'DNA'); }
    if (v.height) { p.height = +v.height; changed.push('HEIGHT'); }
    if (v.alias) { p.aliases.push(v.alias); changed.push('ALIAS'); }
    if (!changed.length) return { err: 'E: NO CHANGES ENTERED', field: 'forenames' };
    return changed.join(', ') + ' AMENDED';
  });

  function codeUpdate(code, d, id, key, table) {
    personUpdate(code, d, id, [
      { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['A', 'D'], hint: '(A ADD, D DELETE)' },
      { n: 'code', l: 'CODE', len: 2, req: true, opts: Object.keys(table) },
      fsField(),
      { n: 'date', l: 'DATE', len: 8, date: true, init: () => P.dt4(P.today()).replace(/\//g, '') }
    ], (p, v) => {
      const list = p[key];
      const i = list.findIndex(x => x.code === v.code);
      if (v.action === 'A') {
        if (i >= 0) return { err: `E: ${v.code} ALREADY PRESENT ON RECORD`, field: 'code' };
        list.push({ code: v.code, fs: v.fs, date: v.date || P.today() });
        return `${v.code} ${table[v.code]} ADDED`;
      }
      if (i < 0) return { err: `E: ${v.code} NOT PRESENT ON RECORD`, field: 'code' };
      list.splice(i, 1);
      return `${v.code} DELETED`;
    }, ['VALID CODES:', ...twoCol(table)]);
  }
  codeUpdate('#NW', 'WARNING SIGNAL UPDATE', 'PR220M01', 'warnings', P.WARNINGS);
  codeUpdate('#NI', 'INFORMATION MARKER UPDATE', 'PR220M02', 'markers', P.MARKERS);

  personUpdate('#NA', 'HOME ADDRESS UPDATE', 'PR230M01', [
    { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['A', 'D'], hint: '(A ADD, D DELETE)' },
    { n: 'type', l: 'ADDRESS TYPE', len: 4, opts: ['HOME', 'PREV', 'WORK', 'NFA'], def: 'HOME', hint: '(HOME/PREV/WORK/NFA)' },
    { n: 'text', l: 'ADDRESS', len: 50 },
    { n: 'postcode', l: 'POSTCODE', len: 8 },
    { n: 'from', l: 'FROM DATE', len: 8, date: true },
    { n: 'no', l: 'ADDRESS NO. (DELETE)', len: 2, num: true }
  ], (p, v) => {
    if (v.action === 'D') {
      const n = +v.no;
      if (!(n >= 1 && n <= p.addresses.length)) return { err: 'E: ENTER A VALID ADDRESS NO. TO DELETE', field: 'no' };
      p.addresses.splice(n - 1, 1);
      return 'ADDRESS ' + n + ' DELETED';
    }
    if (!v.text && v.type !== 'NFA') return { err: 'E: MANDATORY FIELD MISSING - ADDRESS', field: 'text' };
    if (v.type === 'HOME' || v.type === 'NFA') p.addresses.forEach(a => { if (a.type === 'HOME' || a.type === 'NFA') a.type = 'PREV'; });
    p.addresses.unshift({ type: v.type, text: v.text || 'NO FIXED ABODE', postcode: v.postcode, from: v.from || P.today() });
    return v.type + ' ADDRESS ADDED';
  });

  personUpdate('#NM', 'MARKS AND SCARS UPDATE', 'PR230M02', [
    { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['A', 'D'], hint: '(A ADD, D DELETE)' },
    { n: 'text', l: 'DESCRIPTION', len: 50, hint: '' },
    { n: 'no', l: 'ITEM NO. (DELETE)', len: 2, num: true }
  ], (p, v) => {
    if (v.action === 'D') {
      const n = +v.no;
      if (!(n >= 1 && n <= p.marks.length)) return { err: 'E: ENTER A VALID ITEM NO. TO DELETE', field: 'no' };
      p.marks.splice(n - 1, 1);
      return 'MARK ' + n + ' DELETED';
    }
    if (!v.text) return { err: 'E: MANDATORY FIELD MISSING - DESCRIPTION', field: 'text' };
    p.marks.push(v.text);
    return 'MARK ADDED';
  }, ['E.G. "TATTOO L/FOREARM - ROSE", "SCAR R/CHEEK 3CM", "PIERCING L/EYEBROW"']);

  personUpdate('#NP', 'PHOTOGRAPH LOCATION UPDATE', 'PR230M03', [
    { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['A', 'U', 'D'], hint: '(A LINK, U UPLOAD FILE, D DELETE)' },
    { n: 'url1', l: 'PHOTO LINK', len: 50, mixed: true },
    { n: 'url2', l: '', len: 50, mixed: true }
  ], (p, v) => {
    if (v.action === 'D') {
      if (!p.photo) return { err: 'E: NO PHOTOGRAPH HELD ON RECORD', field: 'action' };
      p.photo = null;
      return 'PHOTOGRAPH DELETED';
    }
    if (v.action === 'U') {
      P.pickPhoto(img => {
        if (!img) return P.show(P.blank('E: THAT FILE COULD NOT BE READ AS AN IMAGE', true));
        p.photo = img;
        stamp(p, '#NP', 'PHOTOGRAPH UPLOADED');
        P.save();
        log('#NP', p.pncId, 'UPDATE: PHOTOGRAPH UPLOADED');
        P.show(showPerson(p, 'I: UPDATE COMPLETE - PHOTOGRAPH UPLOADED'));
      });
      return { err: 'I: CHOOSE AN IMAGE FILE IN THE WINDOW THAT OPENS', field: 'action' };
    }
    const url = (v.url1 + v.url2).trim();
    if (!url) return { err: 'E: MANDATORY FIELD MISSING - PHOTO LINK', field: 'url1' };
    p.photo = url;
    return 'PHOTOGRAPH LINK ADDED';
  }, ['A LINK CAN BE A WEB ADDRESS OR A FILE IN THE PNC FOLDER, E.G. photos/hughes.jpg', 'U OPENS A FILE PICKER; THE IMAGE IS SHRUNK AND SAVED INSIDE THE RECORD.', 'F6 SHOWS OR HIDES THE PHOTOGRAPH ON A PERSON RECORD.']);

  P.TX['#NP'].instant = true;  /* the upload file picker must open straight from the key press */

  personUpdate('#FA', 'FIREARMS LICENSING UPDATE', 'PR240M01', [
    { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['A', 'D'], hint: '(A ADD/AMEND, D DELETE)' },
    { n: 'type', l: 'CERTIFICATE TYPE', len: 4, opts: Object.keys(P.FIREARM_CERTS), hint: Object.keys(P.FIREARM_CERTS).join(' ') },
    { n: 'certNo', l: 'CERTIFICATE NO.', len: 15 },
    { n: 'status', l: 'STATUS', len: 11, opts: P.FIREARM_STATUS, hint: '' },
    { n: 'issued', l: 'ISSUED', len: 8, date: true }, { n: 'expires', l: 'EXPIRES', len: 8, date: true, hint: '(BLANK = 5 YEARS)' },
    { n: 'holdings', l: 'HOLDINGS', len: 50 },
    { n: 'notes', l: 'NOTES', len: 50 }
  ], (p, v) => {
    if (v.action === 'D') {
      if (!p.firearms) return { err: 'E: NO FIREARMS LICENSING RECORD HELD', field: 'action' };
      p.firearms = null;
      return 'FIREARMS RECORD DELETED';
    }
    const fa = p.firearms || {};
    if (!v.type && !fa.type) return { err: 'E: MANDATORY FIELD MISSING - CERTIFICATE TYPE', field: 'type' };
    const issued = v.issued || fa.issued || P.today();
    p.firearms = { type: v.type || fa.type, certNo: v.certNo || fa.certNo || '', status: v.status || fa.status || 'VALID', issued,
      expires: v.expires || fa.expires || P.addDays(issued, 365 * 5), holdings: v.holdings || fa.holdings || '', notes: v.notes || fa.notes || '' };
    return `${p.firearms.type} ${p.firearms.status}`;
  }, ['STATUS: ' + P.FIREARM_STATUS.join(' '), 'WHEN AMENDING, BLANK FIELDS KEEP THEIR CURRENT VALUE.']);

  personUpdate('#NB', 'PERSON DELETION', 'PR290M01', [
    { n: 'confirm', l: 'CONFIRM DELETION', len: 1, req: true, opts: ['Y'], hint: '(Y)' }
  ], p => {
    const d = D();
    d.persons.splice(d.persons.indexOf(p), 1);
    P.save();
    log('#NB', p.pncId, 'DELETE PERSON');
    if (T.ctx.pncId === p.pncId) T.ctx.pncId = null;
    return 'DELETED';
  }, ['** WARNING ** THIS PERMANENTLY REMOVES THE WHOLE PERSON RECORD.'], 'ADMIN');

  /* ---------------------------------------------------------------- wanted / missing */

  personUpdate('#WI', 'ADD A WANTED/MISSING REPORT', 'PR310M01', [
    { n: 'cls', l: 'CLASS', len: 8, req: true, opts: Object.keys(P.WM_CLASSES) },
    { n: 'offence', l: 'OFFENCE/QUALIFIER', len: 30, req: true },
    { n: 'inc', l: 'INCIDENT DATE', len: 8, req: true, date: true, hint: '(DDMMYYYY)' },
    fsField('owner', 'OWNER FCE/STN'),
    { n: 'ref', l: 'CRIME/INCIDENT REF', len: 20 },
    { n: 'text1', l: 'CIRCUMSTANCES', len: 50, req: true },
    { n: 'text2', l: '', len: 50 },
    { n: 'action', l: 'ACTION', len: 50, req: true },
    { n: 'weed', l: 'WEED DATE', len: 8, date: true, unl: true, hint: '(BLANK=AUTO)' }
  ], (p, v) => {
    const days = P.WM_CLASSES[v.cls];
    const weed = v.weed || (days ? P.addDays(v.inc, days) : 'UNLIMITED');
    const no = p.wm.reduce((m, w) => Math.max(m, w.no), 0) + 1;
    p.wm.push({ no, cls: v.cls, offence: v.offence, inc: v.inc, owner: v.owner, ref: v.ref, text: [v.text1, v.text2].filter(Boolean).join(' '),
      action: v.action, weed, created: P.today(), creator: T.user.fs });
    return `${v.cls} REPORT ${no} ADDED`;
  }, [`CLASSES: ${Object.keys(P.WM_CLASSES).join(' ')}`], 'UPD', 'WANTED/MISSING');

  personUpdate('#WA', 'AMEND A WANTED/MISSING REPORT', 'PR310M02', [
    { n: 'no', l: 'REPORT NO.', len: 2, req: true, num: true },
    { n: 'text', l: 'ADDITIONAL TEXT', len: 50 },
    { n: 'action', l: 'NEW ACTION', len: 50 },
    { n: 'owner', l: 'NEW OWNER FCE/STN', len: 4, re: FS_RE }
  ], (p, v) => {
    const w = p.wm.find(x => x.no === +v.no);
    if (!w) return { err: 'E: REPORT NO. ' + v.no + ' NOT FOUND', field: 'no' };
    if (!v.text && !v.action && !v.owner) return { err: 'E: NO CHANGES ENTERED', field: 'text' };
    if (v.text) w.text += ` [${P.dt(P.today())} ${T.user.fs}] ${v.text}`;
    if (v.action) w.action = v.action;
    if (v.owner) w.owner = v.owner;
    return 'W/M REPORT ' + w.no + ' AMENDED';
  }, null, 'UPD', 'WANTED/MISSING');

  personUpdate('#WR', 'RETAIN A WANTED/MISSING REPORT', 'PR310M03', [
    { n: 'no', l: 'REPORT NO.', len: 2, req: true, num: true },
    { n: 'weed', l: 'NEW WEED DATE', len: 8, req: true, date: true, unl: true, hint: '(99999999 UNLIMITED)' }
  ], (p, v) => {
    const w = p.wm.find(x => x.no === +v.no);
    if (!w) return { err: 'E: REPORT NO. ' + v.no + ' NOT FOUND', field: 'no' };
    w.weed = v.weed;
    return `REPORT ${w.no} RETAINED TO ${P.dt(v.weed)}`;
  }, null, 'UPD', 'WANTED/MISSING');

  personUpdate('#WD', 'DELETE A WANTED/MISSING REPORT', 'PR310M04', [
    { n: 'no', l: 'REPORT NO.', len: 2, req: true, num: true },
    { n: 'reason', l: 'DELETION REASON', len: 30, req: true, hint: '(E.G. ARRESTED, FOUND)' }
  ], (p, v) => {
    const i = p.wm.findIndex(x => x.no === +v.no);
    if (i < 0) return { err: 'E: REPORT NO. ' + v.no + ' NOT FOUND', field: 'no' };
    const w = p.wm.splice(i, 1)[0];
    return `${w.cls} REPORT ${w.no} DELETED - ${v.reason}`;
  }, null, 'UPD', 'WANTED/MISSING');

  personUpdate('#OI', 'UPDATE OPERATIONAL INFORMATION', 'PR320M01', [
    { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['A', 'D'], hint: '(A ADD, D DELETE)' },
    { n: 'cat', l: 'ORDER OR POLICE', len: 6, opts: ['ORDER', 'POLICE'], def: 'ORDER' },
    { n: 'type', l: 'REPORT TYPE', len: 9, opts: Object.keys(P.OI_TYPES) },
    { n: 'start', l: 'START DATE', len: 8, date: true },
    { n: 'weed', l: 'WEED DATE', len: 8, date: true, unl: true, hint: '(BLANK = 3 YEARS)' },
    fsField('owner', 'OWNER FCE/STN'),
    { n: 'text1', l: 'DETAILS', len: 50 },
    { n: 'text2', l: '', len: 50 },
    { n: 'no', l: 'ITEM NO. (DELETE)', len: 2, num: true }
  ], (p, v) => {
    if (v.action === 'D') {
      const n = +v.no;
      if (!(n >= 1 && n <= p.oi.length)) return { err: 'E: ENTER A VALID ITEM NO. TO DELETE', field: 'no' };
      p.oi.splice(n - 1, 1);
      return 'OI ITEM ' + n + ' DELETED';
    }
    if (!v.type) return { err: 'E: MANDATORY FIELD MISSING - REPORT TYPE', field: 'type' };
    if (!v.text1) return { err: 'E: MANDATORY FIELD MISSING - DETAILS', field: 'text1' };
    const start = v.start || P.today();
    p.oi.push({ type: v.type, cat: v.cat, start, weed: v.weed || P.addDays(start, 365 * 3), owner: v.owner, text: [v.text1, v.text2].filter(Boolean).join(' ') });
    return v.type + ' ADDED';
  }, ['TYPES: ' + Object.keys(P.OI_TYPES).slice(0, 8).join(' '), '       ' + Object.keys(P.OI_TYPES).slice(8).join(' ')], 'UPD', 'WANTED/MISSING');

  /* ---------------------------------------------------------------- arrest / court */

  personUpdate('#AU', 'ARREST SUMMONS UPDATE', 'PR410M01', [
    { n: 'type', l: 'ARREST OR SUMMONS', len: 7, opts: ['ARREST', 'SUMMONS'], def: 'ARREST' },
    { n: 'date', l: 'DATE', len: 8, req: true, date: true, init: () => P.dt4(P.today()).replace(/\//g, '') },
    fsField(),
    { n: 'off1', l: 'OFFENCE 1', len: 50, req: true },
    { n: 'off2', l: 'OFFENCE 2', len: 50 },
    { n: 'off3', l: 'OFFENCE 3', len: 50 },
    { n: 'off4', l: 'OFFENCE 4', len: 50 }
  ], (p, v) => {
    const asRef = newAsRef(v.fs);
    p.arrests.push({ asRef, type: v.type, date: v.date, fs: v.fs, status: 'IMPENDING PROSECUTION', offences: [v.off1, v.off2, v.off3, v.off4].filter(Boolean) });
    return 'A/S ' + asRef + ' CREATED';
  }, null, 'UPD', 'ARREST/COURT');

  personUpdate('#CU', 'COURT CASE UPDATE (RESULT A/S)', 'PR420M01', [
    { n: 'as', l: 'A/S REF OR ITEM NO.', len: 20, req: true },
    { n: 'court', l: 'COURT', len: 40, req: true },
    { n: 'date', l: 'DATE OF HEARING', len: 8, req: true, date: true },
    { n: 'plea', l: 'PLEA', len: 10, opts: ['GUILTY', 'NOT GUILTY', 'NO PLEA'], def: 'NO PLEA' },
    { n: 'adj', l: 'ADJUDICATION', len: 10, req: true, opts: ['GUILTY', 'NOT GUILTY', 'DISMISSED', 'WITHDRAWN', 'NFA'] },
    { n: 'sentence', l: 'SENTENCE/DISPOSAL', len: 50 }
  ], (p, v) => {
    const imp = p.arrests.filter(a => a.status === 'IMPENDING PROSECUTION');
    const a = /^\d{1,2}$/.test(v.as) ? imp[+v.as - 1] : imp.find(x => x.asRef === v.as);
    if (!a) return { err: 'E: NO IMPENDING PROSECUTION MATCHING ' + v.as, field: 'as' };
    if (v.adj === 'GUILTY') {
      if (!v.sentence) return { err: 'E: MANDATORY FIELD MISSING - SENTENCE/DISPOSAL', field: 'sentence' };
      p.convictions.push({ date: v.date, court: v.court, asRef: a.asRef,
        offences: a.offences.map(o => ({ title: o, offDate: a.date, plea: v.plea, result: v.sentence })) });
      p.arrests.splice(p.arrests.indexOf(a), 1);
      return `A/S ${a.asRef} RESULTED - CONVICTED`;
    }
    a.status = `${v.adj} - ${v.court} ${P.dt(v.date)}`;
    return `A/S ${a.asRef} RESULTED - ${v.adj}`;
  }, ['FOR A CAUTION, PND OR COMMUNITY RESOLUTION INSTEAD OF COURT, USE #CD.'], 'UPD', 'ARREST/COURT');

  personUpdate('#CD', 'CAUTION / PND / CR UPDATE', 'PR430M01', [
    { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['A', 'D'], hint: '(A ADD, D DELETE)' },
    { n: 'type', l: 'DISPOSAL TYPE', len: 3, opts: Object.keys(P.DISPOSALS), hint: '(SEE LIST ABOVE)' },
    { n: 'date', l: 'DATE GIVEN', len: 8, date: true, init: () => P.dt4(P.today()).replace(/\//g, '') },
    fsField(),
    { n: 'as', l: 'FROM A/S REF OR NO.', len: 20, hint: '(OPTIONAL - CLOSES THE ARREST)' },
    { n: 'offence', l: 'OFFENCE', len: 50, hint: '' },
    { n: 'detail', l: 'DETAIL / CONDITIONS', len: 50, hint: '' },
    { n: 'no', l: 'ITEM NO. (DELETE)', len: 2, num: true }
  ], (p, v) => {
    p.disposals = p.disposals || [];
    if (v.action === 'D') {
      const n = +v.no;
      if (!(n >= 1 && n <= p.disposals.length)) return { err: 'E: ENTER A VALID ITEM NO. TO DELETE', field: 'no' };
      return p.disposals.splice(n - 1, 1)[0].type + ' DELETED';
    }
    if (!v.type) return { err: 'E: MANDATORY FIELD MISSING - DISPOSAL TYPE', field: 'type' };
    let offence = v.offence, note = '';
    if (v.as) {
      const imp = p.arrests.filter(a => a.status === 'IMPENDING PROSECUTION');
      const a = /^\d{1,2}$/.test(v.as) ? imp[+v.as - 1] : imp.find(x => x.asRef === v.as);
      if (!a) return { err: 'E: NO IMPENDING PROSECUTION MATCHING ' + v.as, field: 'as' };
      offence = offence || a.offences.join('; ');
      p.arrests.splice(p.arrests.indexOf(a), 1);
      note = ' - A/S CLOSED';
    }
    if (!offence) return { err: 'E: MANDATORY FIELD MISSING - OFFENCE', field: 'offence' };
    p.disposals.push({ type: v.type, date: v.date || P.today(), fs: v.fs, offence, detail: v.detail });
    return v.type + ' ADDED' + note;
  }, ['TYPES:', ...twoCol(P.DISPOSALS, 38)], 'UPD', 'ARREST/COURT');

  personUpdate('#CI', 'COURT CASE CREATION', 'PR420M02', [
    { n: 'court', l: 'COURT', len: 40, req: true },
    { n: 'date', l: 'CONVICTION DATE', len: 8, req: true, date: true },
    { n: 'offdate', l: 'OFFENCE DATE', len: 8, date: true },
    { n: 'off1', l: 'OFFENCE 1', len: 50, req: true },
    { n: 'off2', l: 'OFFENCE 2', len: 50 },
    { n: 'off3', l: 'OFFENCE 3', len: 50 },
    { n: 'plea', l: 'PLEA', len: 10, opts: ['GUILTY', 'NOT GUILTY', 'NO PLEA'], def: 'GUILTY' },
    { n: 'sentence', l: 'SENTENCE/DISPOSAL', len: 50, req: true }
  ], (p, v) => {
    p.convictions.push({ date: v.date, court: v.court,
      offences: [v.off1, v.off2, v.off3].filter(Boolean).map(o => ({ title: o, offDate: v.offdate, plea: v.plea, result: v.sentence })) });
    return 'CONVICTION ADDED - ' + v.court;
  }, null, 'UPD', 'ARREST/COURT');

  /* ================================================================ VEHICLES */

  const normVrm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const fmtVrm = v => /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(v) ? v.slice(0, 4) + ' ' + v.slice(4) : v;
  const findVeh = vrm => D().vehicles.find(v => v.vrm === normVrm(vrm)) || null;

  function losActive(v) {
    let active = false;
    for (const r of [...v.reports].sort((a, b) => a.inc.localeCompare(b.inc))) {
      if (r.type === 'LOS') active = true;
      if (r.type === 'FOU') active = false;
    }
    return active;
  }
  const anprActive = v => !!(v.anpr && (!v.anpr.expires || v.anpr.expires >= P.today()));

  function vehicleLines(v, full) {
    const L = [];
    const today = P.today();
    if (anprActive(v)) {
      const a = v.anpr;
      L.push(banner(`** ANPR MARKER: ${P.ANPR[a.action] || a.action} **`, a.action === 'STOP' || a.action === 'INFORM' ? 'warn' : 'rev'));
      L.push(...P.wrap(a.reason, '   '));
      L.push(`   OWNER: ${a.owner}   REF: ${a.ref || '-'}   SET: ${P.dt(a.set)}   EXPIRES: ${P.dt(a.expires) || '-'}`);
    } else L.push([{ t: 'ANPR: NO ACTIVE MARKERS', c: 'dim' }]);
    if (losActive(v)) L.push(banner('*** REPORTED LOST/STOLEN ***'));
    if (v.reports.some(r => r.type === 'ACT')) L.push(banner('ACTION REPORT HELD - SEE BELOW', 'rev'));
    const kp = full ? keeperPerson(v) : null;
    if (kp) L.push(...personBanners(kp, 'KEEPER: '));
    L.push('');
    L.push([{ t: `VRM: ${fmtVrm(v.vrm)}`, c: 'bright' }, `       MAKE: ${v.make}   MODEL: ${v.model}`]);
    L.push(`COLOUR: ${v.colour}   TYPE: ${v.type}   BODY: ${v.body || '-'}`);
    L.push(`ENGINE CAP: ${v.cc || '-'}CC   FUEL: ${v.fuel || '-'}   DATE FIRST REG: ${P.dt(v.firstReg)}`);
    if (full) L.push(`VIN/CHASSIS: ${v.vin || '-'}   ENGINE NO: ${v.engine || '-'}`);
    L.push(!v.tax ? ['VED: ', { t: 'UNLICENSED - NO CURRENT TAX', c: 'warn' }] : v.tax < today ? ['VED: ', { t: `UNLICENSED - EXPIRED ${P.dt(v.tax)}`, c: 'warn' }] : `VED: LICENSED - EXPIRES ${P.dt(v.tax)}`);
    L.push(!v.mot ? ['MOT: ', { t: 'NO MOT RECORD', c: 'warn' }] : v.mot < today ? ['MOT: ', { t: `EXPIRED ${P.dt(v.mot)}`, c: 'warn' }] : `MOT: VALID UNTIL ${P.dt(v.mot)}`);
    L.push(v.insured === 'Y' ? 'MID: INSURANCE RECORD HELD' : ['MID: ', { t: 'NO INSURANCE RECORD HELD ON MID', c: 'warn' }]);
    if (full && v.keeper) {
      L.push('', sectionHead('REGISTERED KEEPER'));
      L.push(`  ${v.keeper.name}`);
      L.push(...P.wrap(`${v.keeper.address} ${v.keeper.postcode || ''}`, '  '));
      L.push(`  ACQUIRED: ${P.dt(v.keeper.acquired)}`);
      L.push(kp ? `  PNC RECORD: ${kp.pncId} (#NE)  ${flags(kp)}` : '  PNC RECORD: NONE LINKED');
    }
    L.push('');
    if (!v.reports.length) L.push('NO POLICE REPORTS HELD');
    v.reports.forEach((r, i) => {
      L.push(P.center(`**  REPORT ${i + 1} OF ${v.reports.length}  **`));
      const label = P.VEH_REPORTS[r.type] || r.type;
      const hot = (r.type === 'LOS' && losActive(v)) || r.type === 'ACT';
      L.push([{ t: P.pad(label, 13), c: hot ? 'warn' : 'rev' }, `  INC.DATE: ${P.dt(r.inc)}   OWNER: ${r.owner}   REF: ${r.ref || '-'}`]);
      if (r.type === 'RES') L.push('    ** RESTRICTED - DO NOT DISCLOSE OVER INSECURE CHANNELS **');
      L.push(...P.wrap('TEXT: ' + r.text, '    '));
      L.push(`    CREATED: ${P.dt(r.created)} BY ${r.creator}`);
    });
    if (full) L.push('', ...historyLines(v));
    return L;
  }

  function showVeh(v, full = true, msg = '') {
    T.ctx.vrm = v.vrm;
    return P.report({ title: full ? 'VRM FULL ENQUIRY' : 'VRM BASIC ENQUIRY', id: full ? 'PR101M04' : 'PR101M02', lines: vehicleLines(v, full), msg });
  }

  function vehList(list, title) {
    const lines = [' NO  VRM        MAKE / MODEL                   COLOUR     REPORTS', ' --  ' + '-'.repeat(64)];
    list.forEach((v, i) => lines.push(` ${String(i + 1).padStart(2)}  ${P.pad(fmtVrm(v.vrm), 10)} ${P.pad(v.make + ' ' + v.model, 30)} ${P.pad(v.colour, 10)} ${v.reports.map(r => r.type).join(' ')}${anprActive(v) ? ' ANPR' : ''}`));
    return P.report({ title: `${title} - ${list.length} MATCH(ES)`, id: 'PR101M06', lines, select: { max: list.length, pick: n => showVeh(list[n - 1]) } });
  }

  const vrmForm = (title, full) => P.form({
    title, id: 'PR101M01', fields: [{ n: 'vrm', l: 'VRM', len: 8, req: true }],
    submit: v => { const x = findVeh(v.vrm); return x ? showVeh(x, full) : { err: 'I: NO TRACE OF VRM ' + v.vrm, field: 'vrm' }; }
  });
  const vrmEnq = (data, full) => {
    if (!data) return vrmForm(full ? 'VRM FULL ENQUIRY' : 'VRM BASIC ENQUIRY', full);
    const v = findVeh(data);
    return v ? showVeh(v, full) : P.blank('I: NO TRACE OF VRM ' + normVrm(data));
  };
  reg('#VE', 'VRM FULL ENQUIRY', 'ENQ', 'VEHICLES', data => vrmEnq(data, true));
  reg('#VK', 'VRM BASIC ENQUIRY', 'ENQ', 'VEHICLES', data => vrmEnq(data, false));

  reg('#VP', 'PARTIAL VRM ENQUIRY', 'ENQ', 'VEHICLES', data => {
    const run = pat => {
      const re = new RegExp('^' + pat.replace(/[^A-Z0-9?*]/g, '').replace(/\?/g, '.').replace(/\*/g, '.*') + '$');
      const list = D().vehicles.filter(v => re.test(v.vrm));
      return list.length ? vehList(list, 'PARTIAL VRM ENQUIRY') : null;
    };
    if (data) return run(data) || P.blank('I: NO MATCHES FOR ' + data);
    return P.form({
      title: 'PARTIAL VRM ENQUIRY', id: 'PR101M05', intro: ['USE ? FOR ONE UNKNOWN CHARACTER AND * FOR ANY NUMBER, E.G. LK19?XC OR MA68*'],
      fields: [{ n: 'pat', l: 'PARTIAL VRM', len: 8, req: true }],
      submit: v => run(v.pat) || { err: 'I: NO MATCHES FOR ' + v.pat, field: 'pat' }
    });
  });

  reg('#VC', 'CHASSIS NUMBER ENQUIRY', 'ENQ', 'VEHICLES', data => {
    const run = vin => { const list = D().vehicles.filter(v => v.vin && (v.vin === vin || (vin.length >= 5 && v.vin.endsWith(vin)))); return list.length === 1 ? showVeh(list[0]) : list.length ? vehList(list, 'CHASSIS ENQUIRY') : null; };
    if (data) return run(data) || P.blank('I: NO TRACE OF VIN/CHASSIS ' + data);
    return P.form({ title: 'CHASSIS NUMBER ENQUIRY', id: 'PR101M07', intro: ['ENTER FULL VIN OR AT LEAST THE LAST 5 CHARACTERS.'],
      fields: [{ n: 'vin', l: 'VIN/CHASSIS NO.', len: 17, req: true }],
      submit: v => run(v.vin) || { err: 'I: NO TRACE OF ' + v.vin, field: 'vin' } });
  });

  reg('#VO', 'DESCRIPTION AND OWNER VRM ENQUIRY', 'ENQ', 'VEHICLES', () => P.form({
    title: 'DESCRIPTION AND OWNER ENQUIRY', id: 'PR101M08', intro: ['COMPLETE ONE OR MORE FIELDS. PARTIAL VALUES ARE ACCEPTED.'],
    fields: [
      { n: 'make', l: 'MAKE', len: 15 }, { n: 'model', l: 'MODEL', len: 15 }, { n: 'colour', l: 'COLOUR', len: 10 },
      { n: 'keeper', l: 'KEEPER NAME', len: 30 }, { n: 'postcode', l: 'KEEPER POSTCODE', len: 8 }
    ],
    submit: q => {
      if (!Object.values(q).some(Boolean)) return { err: 'E: ENTER AT LEAST ONE SEARCH FIELD', field: 'make' };
      const has = (a, b) => !b || String(a || '').includes(b);
      const list = D().vehicles.filter(v => has(v.make, q.make) && has(v.model, q.model) && has(v.colour, q.colour) &&
        has(v.keeper && v.keeper.name, q.keeper) && has(v.keeper && v.keeper.postcode, q.postcode));
      return list.length ? vehList(list, 'DESCRIPTION AND OWNER ENQUIRY') : { err: 'I: NO MATCHING VEHICLES', field: 'make' };
    }
  }));

  reg('#VU', 'VEHICLE UPDATE (REPORTS)', 'UPD', 'VEHICLES', data => {
    const fields = [
      { n: 'vrm', l: 'VRM', len: 8, req: true },
      { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['A', 'D'], hint: '(A ADD REPORT, D DELETE REPORT)', gap: true },
      { n: 'type', l: 'REPORT TYPE', len: 3, opts: Object.keys(P.VEH_REPORTS) },
      { n: 'inc', l: 'INCIDENT DATE', len: 8, date: true, init: () => P.dt4(P.today()).replace(/\//g, '') },
      fsField('owner', 'OWNER FCE/STN'),
      { n: 'ref', l: 'REFERENCE', len: 20 },
      { n: 'text1', l: 'TEXT', len: 50 },
      { n: 'text2', l: '', len: 50 },
      { n: 'text3', l: '', len: 50, gap: true },
      { n: 'no', l: 'REPORT NO. (DELETE)', len: 2, num: true }
    ];
    return P.form({
      title: 'VEHICLE UPDATE', id: 'PR110M01', fields, vals: initVals(fields, { vrm: data || T.ctx.vrm || '' }),
      intro: ['REPORT TYPES:', ...twoCol(P.VEH_REPORTS, 18, 4)],
      submit: v => {
        const veh = findVeh(v.vrm);
        if (!veh) return { err: 'E: NO TRACE OF VRM ' + v.vrm + ' - USE #VY TO CREATE', field: 'vrm' };
        let note;
        if (v.action === 'D') {
          const n = +v.no;
          if (!(n >= 1 && n <= veh.reports.length)) return { err: 'E: ENTER A VALID REPORT NO. TO DELETE', field: 'no' };
          const r = veh.reports.splice(n - 1, 1)[0];
          note = `${r.type} REPORT DELETED`;
        } else {
          if (!v.type) return { err: 'E: MANDATORY FIELD MISSING - REPORT TYPE', field: 'type' };
          const text = [v.text1, v.text2, v.text3].filter(Boolean).join(' ');
          if (!text) return { err: 'E: MANDATORY FIELD MISSING - TEXT', field: 'text1' };
          veh.reports.push({ type: v.type, inc: v.inc || P.today(), owner: v.owner, ref: v.ref, text, created: P.today(), creator: T.user.fs });
          note = `${v.type} REPORT ADDED` + (v.type === 'FOU' && veh.reports.some(r => r.type === 'LOS') ? ' - PAIRED WITH LOS' : '');
        }
        stamp(veh, '#VU', note);
        P.save();
        log('#VU', veh.vrm, note);
        return showVeh(veh, true, 'I: UPDATE COMPLETE - ' + note);
      }
    });
  });

  reg('#VY', 'CREATE VEHICLE DESCRIPTION AND OWNER', 'UPD', 'VEHICLES', data => {
    const fields = [
      { n: 'vrm', l: 'VRM', len: 8, req: true },
      { n: 'make', l: 'MAKE', len: 15, req: true }, { n: 'model', l: 'MODEL', len: 20, req: true },
      { n: 'colour', l: 'COLOUR', len: 12, req: true },
      { n: 'type', l: 'TYPE', len: 10, opts: ['CAR', 'LGV', 'HGV', 'MOTORCYCLE', 'BUS', 'OTHER'], def: 'CAR' },
      { n: 'body', l: 'BODY', len: 20 }, { n: 'cc', l: 'ENGINE CAP (CC)', len: 5, num: true },
      { n: 'fuel', l: 'FUEL', len: 8 }, { n: 'vin', l: 'VIN/CHASSIS', len: 17 }, { n: 'engine', l: 'ENGINE NO.', len: 12 },
      { n: 'firstReg', l: 'DATE FIRST REG', len: 8, date: true },
      { n: 'tax', l: 'VED EXPIRY', len: 8, date: true }, { n: 'mot', l: 'MOT EXPIRY', len: 8, date: true },
      { n: 'insured', l: 'INSURED (MID)', len: 1, opts: ['Y', 'N'], def: 'Y' },
      { n: 'kpncid', l: 'KEEPER PNCID', len: 10, re: PNCID_RE, fmt: 'YY/NNNNNNA', hint: '(COPIES NAME + ADDRESS)' },
      { n: 'kname', l: 'KEEPER NAME', len: 30 }, { n: 'kaddr', l: 'KEEPER ADDRESS', len: 50 },
      { n: 'kpc', l: 'KEEPER POSTCODE', len: 8 }
    ];
    return P.form({
      title: 'CREATE VEHICLE DESCRIPTION AND OWNER', id: 'PR110M02', fields, vals: { vrm: data || '' },
      submit: v => {
        const vrm = normVrm(v.vrm);
        if (findVeh(vrm)) return { err: 'E: VRM ' + vrm + ' ALREADY HELD', field: 'vrm' };
        let keeper = v.kname ? { name: v.kname, address: v.kaddr, postcode: v.kpc, acquired: P.today() } : null;
        if (v.kpncid) {
          const kp = findPerson(v.kpncid);
          if (!kp) return { err: 'E: NO TRACE OF PNCID ' + v.kpncid, field: 'kpncid' };
          const home = kp.addresses.find(a => a.type === 'HOME' || a.type === 'NFA') || {};
          keeper = { pncId: kp.pncId, name: v.kname || fullName(kp), address: v.kaddr || home.text || '', postcode: v.kpc || home.postcode || '', acquired: P.today() };
        }
        const veh = { vrm, make: v.make, model: v.model, colour: v.colour, type: v.type, body: v.body, cc: v.cc ? +v.cc : null, fuel: v.fuel,
          vin: v.vin, engine: v.engine, firstReg: v.firstReg, tax: v.tax, mot: v.mot, insured: v.insured, keeper, reports: [], anpr: null, history: [] };
        stamp(veh, '#VY', 'RECORD CREATED');
        D().vehicles.push(veh);
        P.save();
        log('#VY', vrm, 'CREATE VEHICLE');
        return showVeh(veh, true, 'I: VEHICLE RECORD CREATED - ' + fmtVrm(vrm));
      }
    });
  });

  reg('#VZ', 'DELETE VEHICLE DESCRIPTION AND OWNER', 'ADMIN', 'VEHICLES', data => P.form({
    title: 'DELETE VEHICLE RECORD', id: 'PR110M03', vals: { vrm: data || T.ctx.vrm || '' },
    fields: [{ n: 'vrm', l: 'VRM', len: 8, req: true }, { n: 'confirm', l: 'CONFIRM DELETION', len: 1, req: true, opts: ['Y'], hint: '(Y)' }],
    submit: v => {
      const d = D(), veh = findVeh(v.vrm);
      if (!veh) return { err: 'E: NO TRACE OF VRM ' + v.vrm, field: 'vrm' };
      d.vehicles.splice(d.vehicles.indexOf(veh), 1);
      P.save();
      log('#VZ', veh.vrm, 'DELETE VEHICLE');
      return P.blank('I: VEHICLE ' + fmtVrm(veh.vrm) + ' DELETED');
    }
  }));

  reg('#VT', 'CHANGE OF REGISTERED KEEPER', 'UPD', 'VEHICLES', data => P.form({
    title: 'CHANGE OF REGISTERED KEEPER', id: 'PR110M04', vals: { vrm: data || T.ctx.vrm || '' },
    intro: ['ENTER A PNCID TO LINK THE KEEPER TO A PERSON RECORD (NAME AND HOME ADDRESS', 'ARE COPIED), OR TYPE THE DETAILS. NAME BLANK + NO PNCID = NO KEEPER.'],
    fields: [
      { n: 'vrm', l: 'VRM', len: 8, req: true, gap: true },
      { n: 'pncid', l: 'KEEPER PNCID', len: 10, re: PNCID_RE, fmt: 'YY/NNNNNNA' },
      { n: 'name', l: 'KEEPER NAME', len: 30 }, { n: 'address', l: 'ADDRESS', len: 50 }, { n: 'postcode', l: 'POSTCODE', len: 8 },
      { n: 'acquired', l: 'DATE ACQUIRED', len: 8, date: true, hint: '(BLANK = TODAY)' }
    ],
    submit: v => {
      const veh = findVeh(v.vrm);
      if (!veh) return { err: 'E: NO TRACE OF VRM ' + v.vrm, field: 'vrm' };
      let keeper = v.name ? { name: v.name, address: v.address, postcode: v.postcode } : null;
      if (v.pncid) {
        const kp = findPerson(v.pncid);
        if (!kp) return { err: 'E: NO TRACE OF PNCID ' + v.pncid, field: 'pncid' };
        const home = kp.addresses.find(a => a.type === 'HOME' || a.type === 'NFA') || {};
        keeper = { pncId: kp.pncId, name: v.name || fullName(kp), address: v.address || home.text || '', postcode: v.postcode || home.postcode || '' };
      }
      if (keeper) keeper.acquired = v.acquired || P.today();
      veh.keeper = keeper;
      const note = keeper ? 'KEEPER ' + keeper.name.slice(0, 25) : 'KEEPER REMOVED';
      stamp(veh, '#VT', note);
      P.save();
      log('#VT', veh.vrm, note);
      return showVeh(veh, true, 'I: UPDATE COMPLETE - ' + note);
    }
  }));

  /* ---------------------------------------------------------------- ANPR hotlist markers */

  reg('#RE', 'ANPR MARKER ENQUIRY', 'ENQ', 'VEHICLES', data => {
    if (data) {
      const v = findVeh(data);
      if (!v) return P.blank('I: NO TRACE OF VRM ' + normVrm(data));
      return anprActive(v) ? showVeh(v, false) : P.blank('I: NO ACTIVE ANPR MARKER ON ' + fmtVrm(v.vrm));
    }
    const list = D().vehicles.filter(anprActive).sort((a, b) => Object.keys(P.ANPR).indexOf(a.anpr.action) - Object.keys(P.ANPR).indexOf(b.anpr.action));
    if (!list.length) return P.blank('I: NO ACTIVE ANPR MARKERS');
    const lines = [' NO  VRM        ACTION  OWNER  EXPIRES   REASON', ' --  ' + '-'.repeat(72)];
    list.forEach((v, i) => lines.push(` ${String(i + 1).padStart(2)}  ${P.pad(fmtVrm(v.vrm), 10)} ${P.pad(v.anpr.action, 7)} ${P.pad(v.anpr.owner, 6)} ${P.pad(P.dt(v.anpr.expires), 9)} ${P.pad(v.anpr.reason, 28)}`));
    return P.report({ title: `ANPR HOTLIST - ${list.length} ACTIVE MARKER(S)`, id: 'PR150M01', lines, select: { max: list.length, pick: n => showVeh(list[n - 1]) } });
  });

  reg('#RU', 'ANPR MARKER UPDATE', 'UPD', 'VEHICLES', data => {
    const fields = [
      { n: 'vrm', l: 'VRM', len: 8, req: true },
      { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['A', 'D'], hint: '(A ADD/REPLACE, D DELETE)', gap: true },
      { n: 'marker', l: 'MARKER', len: 6, opts: Object.keys(P.ANPR), hint: '(STOP INFORM INTEL NOACT)' },
      { n: 'r1', l: 'REASON', len: 50 }, { n: 'r2', l: '', len: 50 },
      fsField('owner', 'OWNER FCE/STN'), { n: 'ref', l: 'REFERENCE', len: 20 },
      { n: 'expires', l: 'EXPIRES', len: 8, date: true, hint: '(BLANK = 28 DAYS)' }
    ];
    return P.form({
      title: 'ANPR MARKER UPDATE', id: 'PR150M02', fields, vals: initVals(fields, { vrm: data || T.ctx.vrm || '' }),
      intro: ['MARKERS:', ...Object.entries(P.ANPR).map(([k, x]) => `  ${P.pad(k, 7)} ${x}`)],
      submit: v => {
        const veh = findVeh(v.vrm);
        if (!veh) return { err: 'E: NO TRACE OF VRM ' + v.vrm + ' - USE #VY TO CREATE', field: 'vrm' };
        let note;
        if (v.action === 'D') {
          if (!veh.anpr) return { err: 'E: NO ANPR MARKER HELD ON ' + fmtVrm(veh.vrm), field: 'vrm' };
          note = 'ANPR ' + veh.anpr.action + ' MARKER DELETED';
          veh.anpr = null;
        } else {
          if (!v.marker) return { err: 'E: MANDATORY FIELD MISSING - MARKER', field: 'marker' };
          const reason = [v.r1, v.r2].filter(Boolean).join(' ');
          if (!reason) return { err: 'E: MANDATORY FIELD MISSING - REASON', field: 'r1' };
          veh.anpr = { action: v.marker, reason, owner: v.owner, ref: v.ref, set: P.today(), expires: v.expires || P.addDays(P.today(), 28) };
          note = 'ANPR ' + v.marker + ' MARKER SET';
        }
        stamp(veh, '#RU', note);
        P.save();
        log('#RU', veh.vrm, note);
        return showVeh(veh, true, 'I: UPDATE COMPLETE - ' + note);
      }
    });
  });

  /* ================================================================ DRIVERS */

  function driverStatus(dr) {
    const today = P.today();
    if (dr.disq && dr.disq.from <= today && (!dr.disq.to || dr.disq.to >= today)) return 'DISQUALIFIED';
    const pts = currentPoints(dr);
    return pts >= 12 ? `VALID - ${pts} PENALTY POINTS (LIABLE TO TOTTING UP)` : 'VALID';
  }
  const currentPoints = dr => dr.endorsements.filter(e => e.date >= P.addDays(P.today(), -365 * 3)).reduce((n, e) => n + (+e.pts || 0), 0);

  function showDriver(dr, msg) {
    T.ctx.driverNo = dr.driverNo;
    const st = driverStatus(dr);
    const L = [
      [{ t: `DRIVER NUMBER: ${dr.driverNo}`, c: 'bright' }],
      `NAME: ${dr.surname}, ${dr.forenames}`,
      `DOB: ${P.dt4(dr.dob)}   SEX: ${dr.sex}`,
      ...P.wrap(`ADDRESS: ${dr.address} ${dr.postcode || ''}`, ''),
      '',
      ['LICENCE STATUS: ', { t: st, c: st === 'DISQUALIFIED' ? 'warn' : 'rev' }],
      `ENTITLEMENT: ${dr.categories}`,
      `ISSUED: ${P.dt(dr.issue)}   EXPIRES: ${P.dt(dr.expiry)}`,
      '',
      sectionHead(`ENDORSEMENTS - ${currentPoints(dr)} CURRENT POINTS`)
    ];
    if (!dr.endorsements.length) L.push('  NONE');
    dr.endorsements.forEach((e, i) => L.push(`  ${i + 1}. ${P.pad(e.code, 5)} OFFENCE DATE ${P.dt(e.date)}   POINTS ${e.pts}`));
    if (dr.disq) {
      L.push('', sectionHead('DISQUALIFICATION', st === 'DISQUALIFIED' ? 'warn' : 'rev'));
      L.push(`  FROM ${P.dt(dr.disq.from)} TO ${P.dt(dr.disq.to) || 'UNTIL TEST PASSED'}`);
      L.push(`  COURT: ${dr.disq.court}`);
      L.push(...P.wrap('OFFENCE: ' + dr.disq.offence, '  '));
    }
    const pp = driverPerson(dr);
    L.push('', sectionHead('LINKED RECORDS'), pp ? `  PNC RECORD: ${pp.pncId} (#NE)  ${flags(pp)}` : '  PNC RECORD: NO MATCHING PERSON RECORD');
    const vehs = pp ? linkedVehicles(pp) : [];
    if (vehs.length) L.push('  KEEPER OF: ' + vehs.map(v => fmtVrm(v.vrm)).join(', '));
    L.push('', ...historyLines(dr));
    return P.report({ title: 'DRIVERS ENQUIRY', id: 'PR501M02', lines: L, msg });
  }
  const findDriver = no => D().drivers.find(d => d.driverNo === String(no || '').toUpperCase().replace(/\s/g, ''));

  function driverSearch(q) {
    const list = D().drivers.filter(d => (!q.surname || d.surname === q.surname) && (!q.forename || d.forenames.startsWith(q.forename)) && (!q.dob || d.dob === q.dob));
    if (!list.length) return null;
    if (list.length === 1) return showDriver(list[0]);
    const lines = [' NO  DRIVER NUMBER     NAME                            DOB', ' --  ' + '-'.repeat(60)];
    list.forEach((d, i) => lines.push(` ${String(i + 1).padStart(2)}  ${P.pad(d.driverNo, 16)}  ${P.pad(d.surname + ', ' + d.forenames, 30)}  ${P.dt4(d.dob)}`));
    return P.report({ title: 'DRIVERS ENQUIRY - ' + list.length + ' MATCHES', id: 'PR501M03', lines, select: { max: list.length, pick: n => showDriver(list[n - 1]) } });
  }

  reg('#DL', 'DRIVERS ENQUIRY', 'ENQ', 'DRIVERS', data => {
    if (data) {
      const dr = findDriver(data);
      if (dr) return showDriver(dr);
      const r = driverSearch(parseNameData(data));
      return r || P.blank('I: NO TRACE OF DRIVER ' + data);
    }
    return P.form({
      title: 'DRIVERS ENQUIRY', id: 'PR501M01', fields: [
        { n: 'no', l: 'DRIVER NUMBER', len: 16 }, { h: 'OR' },
        { n: 'surname', l: 'SURNAME', len: 20 }, { n: 'forename', l: 'FORENAME', len: 20 }, { n: 'dob', l: 'DATE OF BIRTH', len: 8, date: true }
      ],
      submit: v => {
        if (v.no) { const dr = findDriver(v.no); return dr ? showDriver(dr) : { err: 'I: NO TRACE OF DRIVER NUMBER ' + v.no, field: 'no' }; }
        if (!v.surname) return { err: 'E: ENTER DRIVER NUMBER OR SURNAME', field: 'no' };
        return driverSearch(v) || { err: 'I: NO TRACE OF DRIVER', field: 'surname' };
      }
    });
  });

  reg('#D0', 'DRIVERS MAINTENANCE - CREATE LICENCE', 'UPD', 'DRIVERS', () => P.form({
    title: 'CREATE DRIVER RECORD', id: 'PR510M01', fields: [
      { n: 'surname', l: 'SURNAME', len: 20, req: true }, { n: 'forenames', l: 'FORENAME(S)', len: 30, req: true },
      { n: 'dob', l: 'DATE OF BIRTH', len: 8, req: true, date: true }, { n: 'sex', l: 'SEX', len: 1, req: true, opts: ['M', 'F'] },
      { n: 'address', l: 'ADDRESS', len: 50, req: true }, { n: 'postcode', l: 'POSTCODE', len: 8 },
      { n: 'cats', l: 'ENTITLEMENT', len: 30, def: 'AM/B/F/K/P/Q', hint: '' }
    ],
    submit: v => {
      const no = P.driverNo(v.surname, v.forenames, v.dob, v.sex);
      if (findDriver(no)) return { err: 'E: DRIVER RECORD ALREADY HELD - ' + no, field: 'surname' };
      const dr = { driverNo: no, surname: v.surname, forenames: v.forenames, dob: v.dob, sex: v.sex, address: v.address, postcode: v.postcode,
        categories: v.cats, issue: P.today(), expiry: P.addDays(P.today(), 3652), endorsements: [], disq: null };
      stamp(dr, '#D0', 'RECORD CREATED');
      D().drivers.push(dr);
      P.save();
      log('#D0', no, 'CREATE DRIVER');
      return showDriver(dr, 'I: DRIVER RECORD CREATED');
    }
  }));

  reg('#DA', 'AMEND DRIVER - ENDORSEMENT', 'UPD', 'DRIVERS', data => P.form({
    title: 'ADD/DELETE ENDORSEMENT', id: 'PR510M02', vals: { no: data || T.ctx.driverNo || '' },
    intro: ['E.G. SP30 SPEEDING, IN10 NO INSURANCE, CU80 MOBILE PHONE, DR10 DRINK DRIVING'],
    fields: [
      { n: 'no', l: 'DRIVER NUMBER', len: 16, req: true },
      { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['A', 'D'], hint: '(A ADD, D DELETE)' },
      { n: 'code', l: 'ENDORSEMENT CODE', len: 4, re: /^[A-Z]{2}\d{2}$/ },
      { n: 'date', l: 'OFFENCE DATE', len: 8, date: true }, { n: 'pts', l: 'PENALTY POINTS', len: 2, num: true },
      { n: 'item', l: 'ITEM NO. (DELETE)', len: 2, num: true }
    ],
    submit: v => {
      const dr = findDriver(v.no);
      if (!dr) return { err: 'E: NO TRACE OF DRIVER NUMBER ' + v.no, field: 'no' };
      if (v.action === 'D') {
        const n = +v.item;
        if (!(n >= 1 && n <= dr.endorsements.length)) return { err: 'E: ENTER A VALID ITEM NO.', field: 'item' };
        dr.endorsements.splice(n - 1, 1);
      } else {
        if (!v.code) return { err: 'E: MANDATORY FIELD MISSING - ENDORSEMENT CODE', field: 'code' };
        dr.endorsements.push({ code: v.code, date: v.date || P.today(), pts: +v.pts || 0 });
      }
      stamp(dr, '#DA', v.action === 'D' ? 'ENDORSEMENT DELETED' : 'ENDORSEMENT ' + v.code + ' ADDED');
      P.save();
      log('#DA', dr.driverNo, 'ENDORSEMENT ' + v.action);
      return showDriver(dr, 'I: UPDATE COMPLETE');
    }
  }));

  reg('#DI', 'ADD A DISQUALIFIED DRIVER REPORT', 'UPD', 'DRIVERS', data => P.form({
    title: 'ADD A DISQUALIFIED DRIVER REPORT', id: 'PR520M01', vals: { no: data || T.ctx.driverNo || '' },
    fields: [
      { n: 'no', l: 'DRIVER NUMBER', len: 16, req: true },
      { n: 'from', l: 'DISQUALIFIED FROM', len: 8, req: true, date: true },
      { n: 'to', l: 'DISQUALIFIED TO', len: 8, date: true, hint: '(BLANK = UNTIL TEST PASSED)' },
      { n: 'court', l: 'COURT', len: 40, req: true },
      { n: 'offence', l: 'OFFENCE', len: 50, req: true }
    ],
    submit: v => {
      const dr = findDriver(v.no);
      if (!dr) return { err: 'E: NO TRACE OF DRIVER NUMBER ' + v.no, field: 'no' };
      dr.disq = { from: v.from, to: v.to, court: v.court, offence: v.offence };
      stamp(dr, '#DI', 'DISQUALIFICATION ADDED');
      P.save();
      log('#DI', dr.driverNo, 'DISQUALIFICATION ADDED');
      return showDriver(dr, 'I: DISQUALIFIED DRIVER REPORT ADDED');
    }
  }));

  reg('#DD', 'DELETE A DISQUALIFIED DRIVER REPORT', 'UPD', 'DRIVERS', data => P.form({
    title: 'DELETE A DISQUALIFIED DRIVER REPORT', id: 'PR520M02', vals: { no: data || T.ctx.driverNo || '' },
    fields: [{ n: 'no', l: 'DRIVER NUMBER', len: 16, req: true }, { n: 'confirm', l: 'CONFIRM', len: 1, req: true, opts: ['Y'] }],
    submit: v => {
      const dr = findDriver(v.no);
      if (!dr) return { err: 'E: NO TRACE OF DRIVER NUMBER ' + v.no, field: 'no' };
      if (!dr.disq) return { err: 'E: NO DISQUALIFICATION HELD', field: 'no' };
      dr.disq = null;
      stamp(dr, '#DD', 'DISQUALIFICATION DELETED');
      P.save();
      log('#DD', dr.driverNo, 'DISQUALIFICATION DELETED');
      return showDriver(dr, 'I: DISQUALIFICATION DELETED');
    }
  }));

  /* ================================================================ PROPERTY */

  const PROP_CATS = ['PLANT', 'TRAILER', 'ENGINE', 'FIREARM', 'BICYCLE', 'PHONE', 'OTHER'];
  const PROP_REPORTS = { LOS: 'LOST/STOLEN', FOU: 'FOUND', INF: 'INFORMATION', REM: 'REMOVED' };
  const findProp = id => {
    id = String(id || '').toUpperCase().trim();
    return D().property.find(p => p.propId === id || p.serial === id || p.cesar === id || (p.engine && p.engine === id)) || null;
  };

  function propLines(p) {
    const kv = (k, v) => P.pad(k, 13) + ': ' + (v || '');
    const L = [
      P.cols(kv('PROPID', p.propId), `CREATED: ${P.dt(p.created)}`),
      P.cols(kv('MANUFACT NO', p.serial), `OWNER: ${p.owner}  CREATOR: ${p.creator}`),
      kv('FLEET NO', p.fleet), kv('ENGINE NO', p.engine), kv('CESAR NO', p.cesar),
      kv('ITEM TYPE', p.category), kv(p.category + ' TYPE', p.itemType), kv('ITEM MAKE', p.make),
      kv('ITEM MODEL', p.model), kv('ITEM COLOUR', p.colour), ''
    ];
    let active = false;
    for (const r of p.reports) { if (r.type === 'LOS') active = true; if (r.type === 'FOU') active = false; }
    p.reports.forEach((r, i) => {
      L.push(P.center(`**  REPORT ${i + 1} OF ${p.reports.length}  **`));
      L.push([{ t: P.pad(PROP_REPORTS[r.type] || r.type, 13), c: r.type === 'LOS' && active ? 'warn' : 'rev' }, `  INC.DATE: ${P.dt(r.inc)}   OWNER: ${r.owner}   REF: ${r.ref || '-'}`]);
      L.push(...P.wrap('TEXT: ' + r.text, '    '));
    });
    if (!p.reports.length) L.push('NO REPORTS HELD');
    L.push('', ...historyLines(p));
    return L;
  }

  function showProp(p, msg) {
    T.ctx.propId = p.propId;
    return P.report({ title: 'PROPERTY ENQUIRY', id: 'PR601M04', lines: propLines(p), msg });
  }

  function propEnq(data) {
    if (data) { const p = findProp(data); return p ? showProp(p) : P.blank('I: NO TRACE OF PROPERTY ' + data); }
    return P.form({
      title: 'PROPERTY ENQUIRY', id: 'PR601M01', intro: ['ENTER A PROPID, OR A MANUFACTURER / SERIAL / CESAR / ENGINE NUMBER.'],
      fields: [{ n: 'id', l: 'PROPID OR NUMBER', len: 20, req: true }],
      submit: v => { const p = findProp(v.id); return p ? showProp(p) : { err: 'I: NO TRACE OF ' + v.id, field: 'id' }; }
    });
  }
  reg('#PE', 'PROPERTY ENQUIRY', 'ENQ', 'PROPERTY', propEnq);
  reg('#PI', 'PROP-ID SEARCH', 'ENQ', 'PROPERTY', propEnq);

  reg('#PS', 'PROPERTY DESCRIPTIVE SEARCH', 'ENQ', 'PROPERTY', () => P.form({
    title: 'PROPERTY DESCRIPTIVE SEARCH', id: 'PR601M05', intro: ['CATEGORIES: ' + PROP_CATS.join(' ')],
    fields: [{ n: 'cat', l: 'CATEGORY', len: 8, opts: PROP_CATS }, { n: 'type', l: 'ITEM TYPE', len: 20 }, { n: 'make', l: 'MAKE', len: 15 }, { n: 'colour', l: 'COLOUR', len: 12 }],
    submit: q => {
      const has = (a, b) => !b || String(a || '').includes(b);
      const list = D().property.filter(p => (!q.cat || p.category === q.cat) && has(p.itemType, q.type) && has(p.make, q.make) && has(p.colour, q.colour));
      if (!list.length) return { err: 'I: NO MATCHING PROPERTY', field: 'cat' };
      const lines = [' NO  PROPID        CATEGORY  TYPE / MAKE / MODEL                 REPORTS', ' --  ' + '-'.repeat(68)];
      list.forEach((p, i) => lines.push(` ${String(i + 1).padStart(2)}  ${P.pad(p.propId, 12)}  ${P.pad(p.category, 8)}  ${P.pad(`${p.itemType} ${p.make} ${p.model}`, 34)}  ${p.reports.map(r => r.type).join(' ')}`));
      return P.report({ title: 'PROPERTY SEARCH - ' + list.length + ' MATCH(ES)', id: 'PR601M06', lines, select: { max: list.length, pick: n => showProp(list[n - 1]) } });
    }
  }));

  reg('#PU', 'PROPERTY UPDATE', 'UPD', 'PROPERTY', data => {
    const fields = [
      { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['C', 'A', 'D'], hint: '(C CREATE ITEM, A ADD REPORT, D DEL REPORT)' },
      { n: 'propid', l: 'PROPID (A/D)', len: 12 },
      { h: 'ITEM DETAILS (CREATE)' },
      { n: 'cat', l: 'CATEGORY', len: 8, opts: PROP_CATS, hint: '(SEE #VQ)' },
      { n: 'type', l: 'ITEM TYPE', len: 20 }, { n: 'make', l: 'MAKE', len: 15 }, { n: 'model', l: 'MODEL', len: 15 },
      { n: 'colour', l: 'COLOUR', len: 12 }, { n: 'serial', l: 'MANUFACT/SERIAL NO', len: 20 }, { n: 'engine', l: 'ENGINE NO', len: 15 },
      { h: 'REPORT' },
      { n: 'rtype', l: 'REPORT TYPE', len: 3, opts: Object.keys(PROP_REPORTS), hint: Object.keys(PROP_REPORTS).join(' ') },
      { n: 'inc', l: 'INCIDENT DATE', len: 8, date: true }, fsField('owner', 'OWNER FCE/STN'), { n: 'ref', l: 'REFERENCE', len: 20 },
      { n: 'text', l: 'TEXT', len: 50 }, { n: 'no', l: 'REPORT NO. (DELETE)', len: 2, num: true }
    ];
    return P.form({
      title: 'PROPERTY UPDATE', id: 'PR610M01', fields, vals: initVals(fields, { propid: data || T.ctx.propId || '' }),
      submit: v => {
        const report = () => ({ type: v.rtype, inc: v.inc || P.today(), owner: v.owner, ref: v.ref, text: v.text });
        if (v.action === 'C') {
          if (!v.cat || !v.type) return { err: 'E: CATEGORY AND ITEM TYPE REQUIRED TO CREATE', field: v.cat ? 'type' : 'cat' };
          const p = { propId: newPropId(), category: v.cat, itemType: v.type, make: v.make, model: v.model, colour: v.colour, serial: v.serial,
            fleet: '', engine: v.engine, cesar: '', created: P.today(), creator: T.user.fs, owner: v.owner, reports: [] };
          if (v.rtype && v.text) p.reports.push(report());
          stamp(p, '#PU', 'RECORD CREATED');
          D().property.push(p);
          P.save();
          log('#PU', p.propId, 'CREATE PROPERTY');
          return showProp(p, 'I: PROPERTY CREATED - PROPID ' + p.propId);
        }
        const p = findProp(v.propid);
        if (!p) return { err: 'E: NO TRACE OF PROPID ' + v.propid, field: 'propid' };
        if (v.action === 'A') {
          if (!v.rtype || !v.text) return { err: 'E: REPORT TYPE AND TEXT REQUIRED', field: v.rtype ? 'text' : 'rtype' };
          p.reports.push(report());
        } else {
          const n = +v.no;
          if (!(n >= 1 && n <= p.reports.length)) return { err: 'E: ENTER A VALID REPORT NO.', field: 'no' };
          p.reports.splice(n - 1, 1);
        }
        stamp(p, '#PU', v.action === 'A' ? v.rtype + ' REPORT ADDED' : 'REPORT DELETED');
        P.save();
        log('#PU', p.propId, 'REPORT ' + v.action);
        return showProp(p, 'I: UPDATE COMPLETE');
      }
    });
  });

  /* ================================================================ BULLETIN BOARD */

  reg('#BB', 'BULLETIN BOARD ENQUIRY', 'ENQ', 'GENERAL', () => {
    const msgs = [...D().bulletin].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    const L = [];
    if (!msgs.length) L.push('NO BULLETIN BOARD MESSAGES');
    for (const m of msgs) { L.push([{ t: ` ${m.id}. ${P.dt(m.date)}  FROM: ${m.from} `, c: 'rev' }]); L.push(...P.wrap(m.text, '   ')); L.push(''); }
    return P.report({ title: 'BULLETIN BOARD', id: 'PR901M01', lines: L });
  }, { free: true });

  reg('#BU', 'BULLETIN BOARD UPDATE', 'ADMIN', 'GENERAL', () => P.form({
    title: 'BULLETIN BOARD UPDATE', id: 'PR901M02', fields: [
      { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['A', 'D'], hint: '(A ADD, D DELETE)' },
      { n: 'from', l: 'FROM', len: 20 },
      { n: 't1', l: 'MESSAGE', len: 55 }, { n: 't2', l: '', len: 55 }, { n: 't3', l: '', len: 55 },
      { n: 'no', l: 'MESSAGE NO. (DELETE)', len: 3, num: true }
    ], vals: { from: T.user.name.slice(0, 20) },
    submit: v => {
      const d = D();
      if (v.action === 'D') {
        const i = d.bulletin.findIndex(m => m.id === +v.no);
        if (i < 0) return { err: 'E: MESSAGE NO. NOT FOUND', field: 'no' };
        d.bulletin.splice(i, 1);
      } else {
        const text = [v.t1, v.t2, v.t3].filter(Boolean).join(' ');
        if (!text) return { err: 'E: MANDATORY FIELD MISSING - MESSAGE', field: 't1' };
        d.bulletin.push({ id: d.bulletin.reduce((m, x) => Math.max(m, x.id), 0) + 1, date: P.today(), from: v.from || T.user.id, text });
      }
      P.save();
      log('#BU', '', 'BULLETIN ' + v.action);
      return P.TX['#BB'].run();
    }
  }));

  /* ================================================================ REFERENCE TABLES */

  reg('#QF', 'FORCE DETAIL ENQUIRY', 'ENQ', 'GENERAL', data => {
    const code = (data || '').slice(0, 2);
    if (code && P.FORCES[code]) return P.page({ title: 'FORCE DETAIL ENQUIRY', id: 'PR701M01', rows: [`  FORCE CODE : ${code}`, `  FORCE NAME : ${P.FORCES[code]}`] });
    if (code) return P.blank('I: NO TRACE OF FORCE CODE ' + code);
    return P.report({ title: 'FORCE CODES', id: 'PR701M02', lines: twoCol(P.FORCES) });
  }, { free: true });

  reg('#QN', 'NAMES REFERENCE TABLES ENQUIRY', 'ENQ', 'GENERAL', () => P.report({
    title: 'NAMES REFERENCE TABLES', id: 'PR702M01', lines: [
      sectionHead('WARNING SIGNALS'), ...twoCol(P.WARNINGS), '',
      sectionHead('INFORMATION MARKERS'), ...twoCol(P.MARKERS), '',
      sectionHead('ETHNIC APPEARANCE (IC) CODES'), ...twoCol(P.ETHNIC), '',
      sectionHead('WANTED/MISSING CLASSES'), ' ' + Object.keys(P.WM_CLASSES).join('  '), '',
      sectionHead('OPERATIONAL INFORMATION REPORT TYPES'), ...Object.entries(P.OI_TYPES).map(([k, v]) => ` ${P.pad(k, 10)} ${v}`), '',
      sectionHead('CAUTIONS / PNDS / COMMUNITY RESOLUTIONS'), ...twoCol(P.DISPOSALS), '',
      sectionHead('FIREARMS CERTIFICATES'), ...twoCol(P.FIREARM_CERTS), ' STATUS: ' + P.FIREARM_STATUS.join(' '), '',
      sectionHead('DNA / FINGERPRINTS'), ' Y TAKEN   N NOT TAKEN   R REQUIRED (TAKE ON ARREST)'
    ]
  }), { free: true });

  reg('#VQ', 'DISPLAY VEHICLES TABLES', 'ENQ', 'GENERAL', () => P.report({
    title: 'VEHICLES REFERENCE TABLES', id: 'PR703M01',
    lines: [sectionHead('VEHICLE REPORT TYPES'), ...Object.entries(P.VEH_REPORTS).map(([k, v]) => ` ${k}  ${v}`), '',
      sectionHead('ANPR MARKERS'), ...Object.entries(P.ANPR).map(([k, v]) => ` ${P.pad(k, 6)} ${v}`), '',
      sectionHead('PROPERTY CATEGORIES'), ' ' + PROP_CATS.join('  '), '',
      sectionHead('NATIONAL REASON CODES'), ...Object.entries(P.REASONS).map(([k, v]) => ` ${k}  ${v}`)]
  }), { free: true });

  /* ================================================================ ACCESS CONTROL (ADMIN) */

  const findUser = id => P.db.users.find(u => u.id === String(id || '').toUpperCase().trim());

  function userLines(u) {
    return [
      `  USER-ID      : ${u.id}`, `  NAME         : ${u.name}`, `  FCE/STN      : ${u.fs}  (${P.forceName(u.fs)})`,
      `  TRANSACTIONS : ${u.role} - ${P.ROLES[u.role]}`, `  MODES        : ${u.modes.join(' ')}`,
      ['  STATUS       : ', u.barred ? { t: 'BARRED', c: 'warn' } : 'ACTIVE', `   INVALID ATTEMPTS: ${u.fails || 0}`],
      `  CREATED      : ${P.stamp(u.created)}`,
      `  LAST LOGON   : ${u.lastOn ? P.stamp(u.lastOn) : 'NEVER'}`,
      `  LAST LOGOFF  : ${u.lastOff ? P.stamp(u.lastOff) : '-'}`
    ];
  }

  reg('#SC', 'CREATE / AMEND / DELETE USER-ID', 'ADMIN', 'ACCESS CONTROL', data => {
    const ex = findUser(data);
    return P.form({
      title: 'USER-ID MAINTENANCE', id: 'PR801M01',
      vals: ex ? { action: 'A', uid: ex.id, name: ex.name, fs: ex.fs, role: ex.role, modes: ex.modes.join(' ') } : { action: 'C', fs: T.user.fs, role: 'ENQ', modes: 'LIVE TRNG' },
      intro: ['ROLES: ENQ (ENQUIRY ONLY), UPD (ENQUIRY + UPDATE), ADMIN (ALL TRANSACTIONS)'],
      fields: [
        { n: 'action', l: 'ACTION', len: 1, req: true, opts: ['C', 'A', 'D'], hint: '(C CREATE, A AMEND, D DELETE)' },
        { n: 'uid', l: 'USER-ID', len: 8, req: true, re: /^[A-Z0-9]{3,8}$/, fmt: '3-8 LETTERS/NUMBERS' },
        { n: 'name', l: 'NAME / RANK', len: 30 },
        { n: 'fs', l: 'FORCE/STATION', len: 4, re: FS_RE, fmt: 'NNAA' },
        { n: 'role', l: 'TRANSACTION SET', len: 5, opts: Object.keys(P.ROLES) },
        { n: 'modes', l: 'MODES', len: 14, re: /^((LIVE|TRNG|DEMO) ?)+$/, fmt: 'LIVE TRNG DEMO' },
        { n: 'pw', l: 'INITIAL PASSWORD', len: 8, hint: '(CREATE ONLY)' }
      ],
      submit: v => {
        const u = findUser(v.uid);
        if (v.action === 'C') {
          if (u) return { err: 'E: USER-ID ALREADY EXISTS', field: 'uid' };
          if (!v.name || !v.fs || !v.role || !v.modes || !v.pw) return { err: 'E: ALL FIELDS REQUIRED TO CREATE A USER-ID', field: !v.name ? 'name' : !v.pw ? 'pw' : 'fs' };
          const nu = { id: v.uid, pw: v.pw, name: v.name, fs: v.fs, role: v.role, modes: v.modes.trim().split(/\s+/), created: new Date().toISOString(), lastOn: null, lastOff: null, fails: 0, barred: false };
          P.db.users.push(nu);
          P.save();
          log('#SC', nu.id, 'CREATE USER');
          return P.page({ title: 'USER-ID CREATED', id: 'PR801M02', rows: userLines(nu), msg: 'I: USER-ID ' + nu.id + ' CREATED' });
        }
        if (!u) return { err: 'E: NO TRACE OF USER-ID ' + v.uid, field: 'uid' };
        if (v.action === 'D') {
          if (u === T.user) return { err: 'E: CANNOT DELETE THE USER-ID CURRENTLY LOGGED ON', field: 'uid' };
          P.db.users.splice(P.db.users.indexOf(u), 1);
          P.save();
          log('#SC', u.id, 'DELETE USER');
          return P.blank('I: USER-ID ' + u.id + ' DELETED');
        }
        if (v.name) u.name = v.name;
        if (v.fs) u.fs = v.fs;
        if (v.role) { if (u === T.user && v.role !== 'ADMIN') return { err: 'E: CANNOT REMOVE ADMIN FROM YOUR OWN USER-ID', field: 'role' }; u.role = v.role; }
        if (v.modes) u.modes = v.modes.trim().split(/\s+/);
        P.save();
        log('#SC', u.id, 'AMEND USER');
        return P.page({ title: 'USER-ID AMENDED', id: 'PR801M02', rows: userLines(u), msg: 'I: USER-ID ' + u.id + ' AMENDED' });
      }
    });
  });

  reg('#SD', 'SHOW USERIDS/USER-GROUPS', 'ADMIN', 'ACCESS CONTROL', () => {
    const lines = [' NO  USER-ID   NAME                           FCE   SET    STATUS   LAST LOGON', ' --  ' + '-'.repeat(72)];
    P.db.users.forEach((u, i) => lines.push(` ${String(i + 1).padStart(2)}  ${P.pad(u.id, 9)} ${P.pad(u.name, 30)} ${P.pad(u.fs, 5)} ${P.pad(u.role, 6)} ${P.pad(u.barred ? 'BARRED' : 'ACTIVE', 8)} ${u.lastOn ? P.dt(u.lastOn) : 'NEVER'}`));
    return P.report({ title: 'USER-IDS', id: 'PR801M03', lines, select: { max: P.db.users.length, pick: n => P.page({ title: 'USER-ID INFORMATION', id: 'PR801M04', rows: userLines(P.db.users[n - 1]) }) } });
  });

  reg('#SE', 'SHOW USERID INFORMATION', 'ADMIN', 'ACCESS CONTROL', data => {
    const show = u => P.page({ title: 'USER-ID INFORMATION', id: 'PR801M04', rows: userLines(u) });
    if (data) { const u = findUser(data); return u ? show(u) : P.blank('I: NO TRACE OF USER-ID ' + data); }
    return P.form({ title: 'SHOW USER-ID INFORMATION', id: 'PR801M05', fields: [{ n: 'uid', l: 'USER-ID', len: 8, req: true }],
      submit: v => { const u = findUser(v.uid); return u ? show(u) : { err: 'I: NO TRACE OF USER-ID ' + v.uid, field: 'uid' }; } });
  });

  reg('#SP', 'RESET PASSWORD / UNBAR USER-ID', 'ADMIN', 'ACCESS CONTROL', data => P.form({
    title: 'RESET PASSWORD', id: 'PR801M06', vals: { uid: data || '' },
    fields: [
      { n: 'uid', l: 'USER-ID', len: 8, req: true },
      { n: 'pw', l: 'NEW PASSWORD', len: 8, hint: '(BLANK = UNCHANGED)' },
      { n: 'unbar', l: 'UNBAR USER-ID', len: 1, opts: ['Y', 'N'], def: 'Y' }
    ],
    submit: v => {
      const u = findUser(v.uid);
      if (!u) return { err: 'E: NO TRACE OF USER-ID ' + v.uid, field: 'uid' };
      if (v.pw) u.pw = v.pw;
      if (v.unbar === 'Y') { u.barred = false; u.fails = 0; }
      P.save();
      log('#SP', u.id, 'PASSWORD RESET/UNBAR');
      return P.page({ title: 'USER-ID INFORMATION', id: 'PR801M04', rows: userLines(u), msg: 'I: USER-ID ' + u.id + ' UPDATED' });
    }
  }));

  reg('#SU', 'LIST UNUSED USERIDS', 'ADMIN', 'ACCESS CONTROL', () => {
    const cutoff = new Date(Date.now() - 90 * 864e5).toISOString();
    const list = P.db.users.filter(u => !u.lastOn || u.lastOn < cutoff);
    const lines = list.length ? list.map(u => `  ${P.pad(u.id, 9)} ${P.pad(u.name, 30)} LAST LOGON: ${u.lastOn ? P.dt(u.lastOn) : 'NEVER'}`) : ['  NO USER-IDS UNUSED FOR 90 DAYS OR MORE'];
    return P.report({ title: 'USER-IDS UNUSED FOR 90+ DAYS', id: 'PR801M07', lines });
  });

  /* ================================================================ TRANSACTION LOG (AUDIT) */

  function logReport(q) {
    const list = P.db.log.filter(e =>
      (!q.uid || e.user === q.uid) && (!q.tcode || e.tcode === q.tcode) && (!q.mode || q.mode === 'ALL' || e.mode === q.mode) &&
      (!q.text || (e.data + ' ' + e.orig + ' ' + e.note).includes(q.text)) &&
      (!q.from || e.ts.slice(0, 10) >= q.from) && (!q.to || e.ts.slice(0, 10) <= q.to)
    ).reverse();
    const lines = ['DATE/TIME      USER-ID  TC  MODE ORIGINATOR             RC DATA / NOTE', '-'.repeat(W)];
    for (const e of list.slice(0, 500)) {
      lines.push(`${P.stamp(e.ts)} ${P.pad(e.user, 8)} ${e.tcode} ${P.pad(e.mode, 4)} ${P.pad(e.orig, 22)} ${P.pad(e.reason, 2)} ${P.pad(e.note || e.data, 19)}`);
    }
    if (!list.length) lines.push('NO MATCHING TRANSACTIONS');
    return P.report({ title: `TRANSACTION LOG SEARCH - ${list.length} ENTRIES`, id: 'PR850M02', lines });
  }

  reg('#TE', 'TRANSACTION LOG SEARCH', 'ADMIN', 'ACCESS CONTROL', () => P.form({
    title: 'TRANSACTION LOG SEARCH', id: 'PR850M01', vals: { mode: 'ALL' },
    intro: ['LEAVE ALL FIELDS BLANK FOR THE COMPLETE LOG (NEWEST FIRST, MAX 500).'],
    fields: [
      { n: 'uid', l: 'USER-ID', len: 8 }, { n: 'tcode', l: 'TCODE', len: 3, re: /^#[A-Z0-9]{2}$/ },
      { n: 'text', l: 'DATA/ORIG CONTAINS', len: 30 }, { n: 'mode', l: 'MODE', len: 4, opts: ['LIVE', 'TRNG', 'DEMO', 'ALL'] },
      { n: 'from', l: 'FROM DATE', len: 8, date: true }, { n: 'to', l: 'TO DATE', len: 8, date: true }
    ],
    submit: logReport
  }));

  /* ================================================================ GENERAL */

  reg('#MM', 'DISPLAY TRANSACTION MENU', 'ENQ', 'GENERAL', () => {
    const cats = {};
    for (const [code, tx] of Object.entries(P.TX)) {
      if (!P.allowed(T.user, code)) continue;
      (cats[tx.cat] = cats[tx.cat] || []).push(`${code} ${tx.d}`);
    }
    const custom = (T.user.allow || []).length || (T.user.deny || []).length;
    const L = [`TRANSACTIONS AVAILABLE TO USER-ID ${T.user.id} (${P.ROLES[T.user.role]}${custom ? ', CUSTOMISED' : ''})`, ''];
    const order = ['NAMES', 'WANTED/MISSING', 'ARREST/COURT', 'VEHICLES', 'DRIVERS', 'PROPERTY', 'GENERAL', 'ACCESS CONTROL', 'SIMULATOR'];
    for (const c of order) {
      if (!cats[c]) continue;
      L.push(sectionHead(c));
      const items = cats[c].sort().map(s => P.pad(s, 38).slice(0, 38));
      for (let i = 0; i < items.length; i += 2) L.push(' ' + items[i] + (items[i + 1] ? ' ' + items[i + 1] : ''));
      L.push('');
    }
    L.push(sectionHead('NATIONAL REASON CODES'), ...Object.entries(P.REASONS).map(([k, v]) => ` ${k}  ${v}`));
    return P.report({ title: 'TRANSACTION MENU', id: 'PR000M01', lines: L });
  }, { free: true, nolog: true });

  reg('#CL', 'CLEAR DATA FROM SCREEN', 'ENQ', 'GENERAL', () => { document.querySelector('#c-data').value = ''; return P.blank(''); }, { free: true, nolog: true });
  reg('#XX', 'LOGOFF', 'ENQ', 'GENERAL', () => { P.logoff(); return null; }, { free: true, nolog: true });

  /* ================================================================ SIMULATOR UTILITIES (non-PNC) */

  reg('#ZR', 'RESET CURRENT MODE TO SEED DATA', 'ADMIN', 'SIMULATOR', () => P.form({
    title: 'RESET ' + T.mode + ' FILES TO SEED DATA', id: 'ZZ001M01', intro: ['ALL PERSONS, VEHICLES, PROPERTY, DRIVERS AND BULLETINS IN MODE ' + T.mode, 'WILL BE REPLACED WITH THE ORIGINAL DEMO DATA. USERS AND LOG ARE KEPT.'],
    fields: [{ n: 'confirm', l: 'CONFIRM RESET', len: 1, req: true, opts: ['Y'], hint: '(Y)' }],
    submit: () => { P.resetMode(T.mode); T.ctx = {}; log('#ZR', T.mode, 'MODE RESET'); return P.blank('I: ' + T.mode + ' FILES RESET TO SEED DATA'); }
  }));
  reg('#ZX', 'EXPORT DATABASE TO FILE', 'ADMIN', 'SIMULATOR', () => { P.exportDb(); return P.blank('I: DATABASE EXPORTED TO DOWNLOAD FILE'); }, { instant: true });
  reg('#ZI', 'IMPORT DATABASE FROM FILE', 'ADMIN', 'SIMULATOR', () => { P.importDb(); return P.blank('I: SELECT A PNC DATABASE .JSON FILE'); }, { instant: true });

  /* shared with js/builder.js */
  P.lib = {
    personLines, showPerson, findPerson, vehicleLines, showVeh, findVeh, normVrm, fmtVrm, propLines, showProp, findProp,
    findDriver, showDriver, newPncId, newPropId, newAsRef, twoCol, sectionHead, FS_RE, PNCID_RE, PROP_CATS, PROP_REPORTS, stamp, fullName
  };
})(window.PNC);
