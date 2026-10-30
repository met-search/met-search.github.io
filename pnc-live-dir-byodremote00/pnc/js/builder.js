/* PNC mock - #ZZ RECORD BUILDER (admin only).
   Step-by-step wizards that ask for every detail of a new person, vehicle or property item,
   show the finished record for review, then save it. */
'use strict';
(function (P) {
  const T = P.T;
  const L = P.lib;
  const D = () => P.data(T.mode);

  const toIn = iso => (iso && iso !== 'UNLIMITED') ? iso.split('-').reverse().join('') : (iso === 'UNLIMITED' ? '99999999' : '');
  const fsOpt = (n, l) => ({ n, l, len: 4, re: L.FS_RE, fmt: 'NNAA' });
  const codesIn = (str, table) => String(str || '').split(/[\s,\/]+/).filter(Boolean);
  const blankDraftPerson = () => ({
    pncId: '', cro: '', surname: '', forenames: '', dob: '', sex: '', eth: '', height: null, build: '', hair: '', eyes: '',
    pob: '', nat: '', aliases: [], addresses: [], warnings: [], markers: [], marks: [], wm: [], oi: [], arrests: [],
    convictions: [], disposals: [], firearms: null, bio: { dna: 'N', fp: 'N' }, photo: null, history: [],
    created: P.today(), creator: T.user.fs, licence: null
  });

  /* ================================================================ wizard engine
     step: { title, intro, fields, init(draft) -> vals, apply(v, draft) -> note | {err, field},
             list: true for repeatable steps, key: [field names] - all blank = skip step } */
  function wizard({ kind, id, steps, draft, review }) {
    let i = 0;
    const nav = { n: 'nav', l: 'NEXT/BACK/QUIT', len: 1, opts: ['N', 'B', 'Q'], def: 'N', hint: '(N NEXT, B BACK, Q QUIT)' };

    function step(vals, msg) {
      if (i >= steps.length) return review(draft, api);
      const st = steps[i];
      const counts = st.list ? [`ITEMS ADDED SO FAR: ${st.count(draft)}   (LEAVE BLANK AND SEND TO SKIP)`] : [];
      const intro = [].concat(typeof st.intro === 'function' ? st.intro(draft) : (st.intro || []), counts);
      const fields = [...st.fields];
      if (st.list) fields.push({ n: 'more', l: 'ADD ANOTHER?', len: 1, opts: ['Y', 'N'], def: 'N', hint: '(Y = SAVE THIS ONE AND ADD MORE)' });
      fields.push({ txt: '' }, nav);
      return P.form({
        title: `${kind} BUILDER - STEP ${i + 1} OF ${steps.length}: ${st.title}`, id, fields, msg,
        intro: intro.length ? intro : null,
        vals: Object.assign({ nav: 'N' }, vals || (st.init ? st.init(draft) : {})),
        pre: raw => {
          const n = String(raw.nav || '').trim().toUpperCase();
          if (n === 'Q') return P.blank('I: BUILDER ABANDONED - NOTHING SAVED');
          if (n === 'B') { i = Math.max(0, i - 1); return step(); }
          return null;
        },
        submit: v => {
          if (st.list && st.key.every(k => !v[k])) { i++; return step(); }
          const r = st.apply(v, draft);
          if (r && r.err) return r;
          if (st.list && v.more === 'Y') return step(null, `I: ${r || 'ITEM ADDED'} - ENTER THE NEXT ONE`);
          i++;
          return step(null, r ? 'I: ' + r : '');
        }
      });
    }

    const api = { start: () => { i = 0; return step(); }, last: () => { i = steps.length - 1; return step(); } };
    return api.start();
  }

  /* final review screen: the record as it will appear, then save / go back / discard */
  function reviewScreen(kind, lines, save, api) {
    return P.report({
      title: `${kind} BUILDER - REVIEW BEFORE SAVING`, id: 'ZZ900M01',
      lines: [...lines, '', [{ t: ' 1 = SAVE RECORD    2 = GO BACK TO LAST STEP    3 = START AGAIN    4 = DISCARD ', c: 'rev' }]],
      msg: 'I: CHECK THE RECORD (PAGE DOWN FOR MORE), THEN ENTER 1 TO SAVE',
      select: {
        label: 'ENTER 1 SAVE, 2 BACK, 3 START AGAIN, 4 DISCARD', max: 4,
        pick: n => n === 1 ? save() : n === 2 ? api.last() : n === 3 ? api.start() : P.blank('I: BUILDER DISCARDED - NOTHING SAVED')
      }
    });
  }

  /* ================================================================ PERSON */

  const personSteps = [
    {
      title: 'IDENTITY',
      intro: ['ETHNIC APPEARANCE (IC) CODES:', ...L.twoCol(P.ETHNIC)],
      fields: [
        { n: 'surname', l: 'SURNAME', len: 20, req: true, re: /^[A-Z][A-Z' -]*$/, fmt: 'LETTERS ONLY' },
        { n: 'forenames', l: 'FORENAME(S)', len: 30, req: true },
        { n: 'dob', l: 'DATE OF BIRTH', len: 8, req: true, date: true, hint: '(DDMMYYYY)' },
        { n: 'sex', l: 'SEX', len: 1, req: true, opts: ['M', 'F', 'U'], hint: '(M/F/U)' },
        { n: 'eth', l: 'ETHNIC APP (IC)', len: 1, req: true, opts: ['0', '1', '2', '3', '4', '5', '6'], hint: '(SEE LIST ABOVE)' },
        { n: 'pob', l: 'PLACE OF BIRTH', len: 20 },
        { n: 'nat', l: 'NATIONALITY', len: 15 },
        { n: 'cro', l: 'CRO NUMBER', len: 10, hint: '(OPTIONAL, E.G. 12345/26A)' },
        { n: 'pncid', l: 'PNCID', len: 10, re: L.PNCID_RE, fmt: 'YY/NNNNNNA', hint: '(BLANK = ALLOCATE ONE)' },
        fsOpt('owner', 'OWNER FCE/STN')
      ],
      init: d => ({ surname: d.surname, forenames: d.forenames, dob: toIn(d.dob), sex: d.sex, eth: d.eth, pob: d.pob, nat: d.nat, cro: d.cro, pncid: d.pncId, owner: d.creator }),
      apply: (v, d) => {
        if (v.pncid && L.findPerson(v.pncid)) return { err: 'E: PNCID ' + v.pncid + ' ALREADY IN USE', field: 'pncid' };
        if (v.cro && L.findPerson(v.cro)) return { err: 'E: CRO ' + v.cro + ' ALREADY IN USE', field: 'cro' };
        Object.assign(d, { surname: v.surname, forenames: v.forenames, dob: v.dob, sex: v.sex, eth: v.eth, pob: v.pob, nat: v.nat, cro: v.cro, pncId: v.pncid, creator: v.owner || T.user.fs });
        const dup = D().persons.find(p => p.surname === v.surname && p.dob === v.dob);
        return dup ? `NOTE - ${dup.pncId} HAS THE SAME SURNAME AND DOB` : '';
      }
    },
    {
      title: 'DESCRIPTION',
      fields: [
        { n: 'height', l: 'HEIGHT (CM)', len: 3, num: true, hint: "(E.G. 180 = 5'11\")" },
        { n: 'build', l: 'BUILD', len: 10, hint: '(SLIM/MEDIUM/STOCKY/LARGE...)' },
        { n: 'hair', l: 'HAIR', len: 15, hint: '(COLOUR AND STYLE)' },
        { n: 'eyes', l: 'EYES', len: 10 },
        { h: 'ALIASES / NICKNAMES  (SURNAME, FORENAME)' },
        { n: 'a1', l: 'ALIAS 1', len: 40 }, { n: 'a2', l: 'ALIAS 2', len: 40 }, { n: 'a3', l: 'ALIAS 3', len: 40 },
        { h: 'MARKS / SCARS / TATTOOS  (E.G. TATTOO L/FOREARM - ROSE)' },
        { n: 'm1', l: 'MARK 1', len: 50 }, { n: 'm2', l: 'MARK 2', len: 50 }, { n: 'm3', l: 'MARK 3', len: 50 }, { n: 'm4', l: 'MARK 4', len: 50 }
      ],
      init: d => ({ height: d.height || '', build: d.build, hair: d.hair, eyes: d.eyes, a1: d.aliases[0], a2: d.aliases[1], a3: d.aliases[2], m1: d.marks[0], m2: d.marks[1], m3: d.marks[2], m4: d.marks[3] }),
      apply: (v, d) => {
        Object.assign(d, { height: v.height ? +v.height : null, build: v.build, hair: v.hair, eyes: v.eyes });
        d.aliases = [v.a1, v.a2, v.a3].filter(Boolean);
        d.marks = [v.m1, v.m2, v.m3, v.m4].filter(Boolean);
      }
    },
    {
      title: 'ADDRESSES',
      fields: [
        { n: 'htype', l: 'CURRENT ADDRESS TYPE', len: 4, opts: ['HOME', 'NFA'], def: 'HOME', hint: '(HOME OR NFA = NO FIXED ABODE)' },
        { n: 'home', l: 'CURRENT ADDRESS', len: 50 }, { n: 'hpc', l: 'POSTCODE', len: 8 }, { n: 'hfrom', l: 'LIVED THERE SINCE', len: 8, date: true, gap: true },
        { n: 'prev', l: 'PREVIOUS ADDRESS', len: 50 }, { n: 'ppc', l: 'POSTCODE', len: 8 }, { n: 'pfrom', l: 'LIVED THERE SINCE', len: 8, date: true, gap: true },
        { n: 'work', l: 'WORK ADDRESS', len: 50 }, { n: 'wpc', l: 'POSTCODE', len: 8 }
      ],
      init: d => {
        const by = t => d.addresses.find(a => a.type === t) || {};
        const h = d.addresses.find(a => a.type === 'HOME' || a.type === 'NFA') || {};
        return { htype: h.type || 'HOME', home: h.text, hpc: h.postcode, hfrom: toIn(h.from), prev: by('PREV').text, ppc: by('PREV').postcode, pfrom: toIn(by('PREV').from), work: by('WORK').text, wpc: by('WORK').postcode };
      },
      apply: (v, d) => {
        d.addresses = [];
        if (v.home || v.htype === 'NFA') d.addresses.push({ type: v.htype, text: v.home || 'NO FIXED ABODE', postcode: v.hpc, from: v.hfrom || P.today() });
        if (v.prev) d.addresses.push({ type: 'PREV', text: v.prev, postcode: v.ppc, from: v.pfrom });
        if (v.work) d.addresses.push({ type: 'WORK', text: v.work, postcode: v.wpc, from: P.today() });
      }
    },
    codeStep('WARNING SIGNALS', 'warnings', P.WARNINGS, '(E.G. VI WE DR)'),
    codeStep('INFORMATION MARKERS', 'markers', P.MARKERS, '(E.G. PP MO)'),
    {
      title: 'WANTED / MISSING', list: true, key: ['cls', 'offence'], count: d => d.wm.length,
      intro: ['CLASSES: ' + Object.keys(P.WM_CLASSES).join(' ')],
      fields: [
        { n: 'cls', l: 'CLASS', len: 8, opts: Object.keys(P.WM_CLASSES) },
        { n: 'offence', l: 'OFFENCE/QUALIFIER', len: 30, hint: '(E.G. BURGLARY, HIGH RISK)' },
        { n: 'inc', l: 'INCIDENT DATE', len: 8, date: true },
        fsOpt('owner', 'OWNER FCE/STN'), { n: 'ref', l: 'CRIME/INCIDENT REF', len: 20 },
        { n: 't1', l: 'CIRCUMSTANCES', len: 50 }, { n: 't2', l: '', len: 50 },
        { n: 'action', l: 'ACTION FOR OFFICERS', len: 50 },
        { n: 'weed', l: 'WEED DATE', len: 8, date: true, unl: true, hint: '(BLANK = AUTO)' }
      ],
      init: () => ({ owner: T.user.fs }),
      apply: (v, d) => {
        for (const [k, l] of [['cls', 'CLASS'], ['offence', 'OFFENCE/QUALIFIER'], ['inc', 'INCIDENT DATE'], ['t1', 'CIRCUMSTANCES'], ['action', 'ACTION']]) if (!v[k]) return { err: 'E: MANDATORY FIELD MISSING - ' + l, field: k };
        const days = P.WM_CLASSES[v.cls];
        d.wm.push({ no: d.wm.length + 1, cls: v.cls, offence: v.offence, inc: v.inc, owner: v.owner || T.user.fs, ref: v.ref,
          text: [v.t1, v.t2].filter(Boolean).join(' '), action: v.action, weed: v.weed || (days ? P.addDays(v.inc, days) : 'UNLIMITED'),
          created: P.today(), creator: T.user.fs });
        return v.cls + ' REPORT ADDED';
      }
    },
    {
      title: 'OPERATIONAL INFORMATION', list: true, key: ['type'], count: d => d.oi.length,
      intro: ['ORDERS, BAIL CONDITIONS, INTELLIGENCE. TYPES:', ...L.twoCol(P.OI_TYPES, 38).slice(0, 8)],
      fields: [
        { n: 'type', l: 'REPORT TYPE', len: 9, opts: Object.keys(P.OI_TYPES) },
        { n: 'cat', l: 'ORDER OR POLICE', len: 6, opts: ['ORDER', 'POLICE'], def: 'ORDER' },
        { n: 'start', l: 'START DATE', len: 8, date: true }, { n: 'weed', l: 'END/WEED DATE', len: 8, date: true, unl: true, hint: '(BLANK = 3 YEARS)' },
        fsOpt('owner', 'OWNER FCE/STN'), { n: 't1', l: 'DETAILS', len: 50 }, { n: 't2', l: '', len: 50 }
      ],
      init: () => ({ owner: T.user.fs, cat: 'ORDER' }),
      apply: (v, d) => {
        if (!v.t1) return { err: 'E: MANDATORY FIELD MISSING - DETAILS', field: 't1' };
        const start = v.start || P.today();
        d.oi.push({ type: v.type, cat: v.cat, start, weed: v.weed || P.addDays(start, 365 * 3), owner: v.owner || T.user.fs, text: [v.t1, v.t2].filter(Boolean).join(' ') });
        return v.type + ' ADDED';
      }
    },
    {
      title: 'ARRESTS AWAITING COURT', list: true, key: ['off1'], count: d => d.arrests.length,
      intro: ['AN ARREST OR SUMMONS NOT YET DEALT WITH BY A COURT (IMPENDING PROSECUTION).', 'PAST CONVICTIONS GO IN THE NEXT STEP.'],
      fields: [
        { n: 'type', l: 'ARREST OR SUMMONS', len: 7, opts: ['ARREST', 'SUMMONS'], def: 'ARREST' },
        { n: 'date', l: 'DATE', len: 8, date: true }, fsOpt('fs', 'ARRESTING FCE/STN'),
        { n: 'off1', l: 'OFFENCE 1', len: 50 }, { n: 'off2', l: 'OFFENCE 2', len: 50 }, { n: 'off3', l: 'OFFENCE 3', len: 50 }, { n: 'off4', l: 'OFFENCE 4', len: 50 }
      ],
      init: () => ({ type: 'ARREST', fs: T.user.fs }),
      apply: (v, d) => {
        if (!v.date) return { err: 'E: MANDATORY FIELD MISSING - DATE', field: 'date' };
        const fs = v.fs || T.user.fs;
        d.arrests.push({ asRef: L.newAsRef(fs), type: v.type, date: v.date, fs, status: 'IMPENDING PROSECUTION', offences: [v.off1, v.off2, v.off3, v.off4].filter(Boolean) });
        return 'ARREST ADDED';
      }
    },
    {
      title: 'CONVICTIONS', list: true, key: ['court', 'off1'], count: d => d.convictions.length,
      intro: ['ONE COURT APPEARANCE PER ENTRY (UP TO 3 OFFENCES). OLDEST OR NEWEST, ANY ORDER.'],
      fields: [
        { n: 'court', l: 'COURT', len: 40, hint: '' }, { n: 'date', l: 'CONVICTION DATE', len: 8, date: true },
        { n: 'sent', l: 'SENTENCE DATE', len: 8, date: true, hint: '(IF DIFFERENT)' }, { n: 'offdate', l: 'OFFENCE DATE', len: 8, date: true },
        { n: 'off1', l: 'OFFENCE 1', len: 50 }, { n: 'off2', l: 'OFFENCE 2', len: 50 }, { n: 'off3', l: 'OFFENCE 3', len: 50 },
        { n: 'plea', l: 'PLEA', len: 10, opts: ['GUILTY', 'NOT GUILTY', 'NO PLEA'], def: 'GUILTY' },
        { n: 'sentence', l: 'SENTENCE', len: 50, hint: '' }
      ],
      init: () => ({ plea: 'GUILTY' }),
      apply: (v, d) => {
        for (const [k, l] of [['court', 'COURT'], ['date', 'CONVICTION DATE'], ['off1', 'OFFENCE 1'], ['sentence', 'SENTENCE']]) if (!v[k]) return { err: 'E: MANDATORY FIELD MISSING - ' + l, field: k };
        const c = { date: v.date, court: v.court, offences: [v.off1, v.off2, v.off3].filter(Boolean).map(o => ({ title: o, offDate: v.offdate, plea: v.plea, result: v.sentence })) };
        if (v.sent && v.sent !== v.date) c.sentenced = v.sent;
        d.convictions.push(c);
        return 'CONVICTION ADDED';
      }
    },
    {
      title: 'CAUTIONS / PNDS / COMMUNITY RESOLUTIONS', list: true, key: ['type', 'offence'], count: d => d.disposals.length,
      intro: ['OUT-OF-COURT DISPOSALS. TYPES:', ...L.twoCol(P.DISPOSALS)],
      fields: [
        { n: 'type', l: 'DISPOSAL TYPE', len: 3, opts: Object.keys(P.DISPOSALS) },
        { n: 'date', l: 'DATE GIVEN', len: 8, date: true }, fsOpt('fs', 'GIVEN BY FCE/STN'),
        { n: 'offence', l: 'OFFENCE', len: 50 }, { n: 'detail', l: 'DETAIL / CONDITIONS', len: 50 }
      ],
      init: () => ({ fs: T.user.fs }),
      apply: (v, d) => {
        for (const [k, l] of [['type', 'DISPOSAL TYPE'], ['date', 'DATE GIVEN'], ['offence', 'OFFENCE']]) if (!v[k]) return { err: 'E: MANDATORY FIELD MISSING - ' + l, field: k };
        d.disposals.push({ type: v.type, date: v.date, fs: v.fs || T.user.fs, offence: v.offence, detail: v.detail });
        return P.DISPOSALS[v.type] + ' ADDED';
      }
    },
    {
      title: 'DNA, FINGERPRINTS, PHOTO, FIREARMS',
      fields: [
        { n: 'dna', l: 'DNA', len: 1, opts: ['Y', 'N', 'R'], def: 'N', hint: '(Y TAKEN, N NOT TAKEN, R REQUIRED)' },
        { n: 'fp', l: 'FINGERPRINTS', len: 1, opts: ['Y', 'N', 'R'], def: 'N', hint: '(Y TAKEN, N NOT TAKEN, R REQUIRED)' },
        { n: 'photo1', l: 'PHOTO LINK', len: 50, mixed: true }, { n: 'photo2', l: '', len: 50, mixed: true },
        { txt: '  (WEB ADDRESS OR FILE IN THE PNC FOLDER. TO UPLOAD A FILE, USE #NP AFTER SAVING)' },
        { h: 'FIREARMS LICENSING  (LEAVE TYPE BLANK IF NONE)' },
        { n: 'ftype', l: 'CERTIFICATE TYPE', len: 4, opts: Object.keys(P.FIREARM_CERTS), hint: Object.keys(P.FIREARM_CERTS).join(' ') },
        { n: 'fno', l: 'CERTIFICATE NO.', len: 15 },
        { n: 'fstatus', l: 'STATUS', len: 11, opts: P.FIREARM_STATUS, def: 'VALID' },
        { txt: '  (' + P.FIREARM_STATUS.join(' ') + ')' },
        { n: 'fissued', l: 'ISSUED', len: 8, date: true }, { n: 'fexp', l: 'EXPIRES', len: 8, date: true, hint: '(BLANK = 5 YEARS)' },
        { n: 'fhold', l: 'HOLDINGS', len: 50 }, { n: 'fnotes', l: 'NOTES', len: 50 }
      ],
      init: d => {
        const fa = d.firearms || {}, ph = d.photo && !d.photo.startsWith('data:') ? d.photo : '';
        return { dna: d.bio.dna, fp: d.bio.fp, photo1: ph.slice(0, 50), photo2: ph.slice(50), ftype: fa.type, fno: fa.certNo, fstatus: fa.status || 'VALID',
          fissued: toIn(fa.issued), fexp: toIn(fa.expires), fhold: fa.holdings, fnotes: fa.notes };
      },
      apply: (v, d) => {
        d.bio = { dna: v.dna, fp: v.fp };
        d.photo = (v.photo1 + v.photo2).trim() || null;
        const issued = v.fissued || P.today();
        d.firearms = v.ftype ? { type: v.ftype, certNo: v.fno, status: v.fstatus, issued, expires: v.fexp || P.addDays(issued, 365 * 5), holdings: v.fhold, notes: v.fnotes } : null;
      }
    },
    {
      title: 'DRIVING LICENCE',
      intro: ['CREATE A MATCHING DRIVING LICENCE (#DL) FROM THE NAME, DOB AND ADDRESS?'],
      fields: [
        { n: 'create', l: 'CREATE LICENCE', len: 1, opts: ['Y', 'N'], def: 'N', hint: '(Y/N)' },
        { n: 'cats', l: 'ENTITLEMENT', len: 30, hint: '(BLANK = AM/B/F/K/P/Q)' },
        { h: 'ENDORSEMENTS  (E.G. SP30 SPEEDING, IN10 NO INSURANCE, CU80 PHONE)' },
        { n: 'e1', l: 'CODE 1', len: 4, re: /^[A-Z]{2}\d{2}$/ }, { n: 'e1d', l: 'OFFENCE DATE 1', len: 8, date: true }, { n: 'e1p', l: 'POINTS 1', len: 2, num: true },
        { n: 'e2', l: 'CODE 2', len: 4, re: /^[A-Z]{2}\d{2}$/ }, { n: 'e2d', l: 'OFFENCE DATE 2', len: 8, date: true }, { n: 'e2p', l: 'POINTS 2', len: 2, num: true },
        { h: 'DISQUALIFICATION  (LEAVE BLANK IF NONE)' },
        { n: 'dfrom', l: 'DISQUALIFIED FROM', len: 8, date: true }, { n: 'dto', l: 'DISQUALIFIED TO', len: 8, date: true },
        { n: 'dcourt', l: 'COURT', len: 40 }, { n: 'doff', l: 'OFFENCE', len: 50 }
      ],
      init: d => {
        const l = d.licence;
        if (!l) return { create: 'N' };
        const e = l.endorsements;
        return { create: 'Y', cats: l.categories, e1: e[0] && e[0].code, e1d: e[0] && toIn(e[0].date), e1p: e[0] && e[0].pts,
          e2: e[1] && e[1].code, e2d: e[1] && toIn(e[1].date), e2p: e[1] && e[1].pts,
          dfrom: l.disq && toIn(l.disq.from), dto: l.disq && toIn(l.disq.to), dcourt: l.disq && l.disq.court, doff: l.disq && l.disq.offence };
      },
      apply: (v, d) => {
        if (v.create !== 'Y') { d.licence = null; return ''; }
        if (v.dfrom && (!v.dcourt || !v.doff)) return { err: 'E: DISQUALIFICATION NEEDS A COURT AND OFFENCE', field: v.dcourt ? 'doff' : 'dcourt' };
        const ends = [[v.e1, v.e1d, v.e1p], [v.e2, v.e2d, v.e2p]].filter(e => e[0]).map(([code, date, pts]) => ({ code, date: date || P.today(), pts: +pts || 0 }));
        d.licence = { categories: v.cats || 'AM/B/F/K/P/Q', endorsements: ends, disq: v.dfrom ? { from: v.dfrom, to: v.dto, court: v.dcourt, offence: v.doff } : null };
        return 'LICENCE DETAILS RECORDED';
      }
    }
  ];

  function codeStep(title, key, table, hint) {
    return {
      title,
      intro: ['VALID CODES (ENTER SEVERAL WITH A SPACE BETWEEN, OR LEAVE BLANK):', ...L.twoCol(table)],
      fields: [
        { n: 'codes', l: 'CODES', len: 30, hint },
        fsOpt('fs', 'ADDED BY FCE/STN'), { n: 'date', l: 'DATE ADDED', len: 8, date: true, hint: '(BLANK = TODAY)' }
      ],
      init: d => ({ codes: d[key].map(x => x.code).join(' '), fs: (d[key][0] && d[key][0].fs) || d.creator || T.user.fs }),
      apply: (v, d) => {
        const codes = [...new Set(codesIn(v.codes))];
        const bad = codes.find(c => !table[c]);
        if (bad) return { err: `E: ${bad} IS NOT A VALID CODE - SEE LIST ABOVE`, field: 'codes' };
        d[key] = codes.map(code => ({ code, fs: v.fs || T.user.fs, date: v.date || P.today() }));
        return codes.length ? codes.length + ' CODE(S) RECORDED' : '';
      }
    };
  }

  function personReview(d, api) {
    const preview = Object.assign({}, d, { pncId: d.pncId || '(ALLOCATED ON SAVE)' });
    const lines = L.personLines(preview);
    if (d.licence) {
      lines.push('', L.sectionHead('DRIVING LICENCE TO BE CREATED'),
        `  ENTITLEMENT: ${d.licence.categories}`,
        `  ENDORSEMENTS: ${d.licence.endorsements.map(e => `${e.code} (${e.pts} PTS)`).join(', ') || 'NONE'}`,
        `  DISQUALIFIED: ${d.licence.disq ? P.dt(d.licence.disq.from) + ' TO ' + (P.dt(d.licence.disq.to) || 'TEST PASSED') : 'NO'}`);
    }
    return reviewScreen('PERSON', lines, () => savePerson(d), api);
  }

  function savePerson(d) {
    if (d.pncId && L.findPerson(d.pncId)) return P.blank('E: PNCID ' + d.pncId + ' WAS TAKEN IN THE MEANTIME - NOT SAVED', true);
    const { licence, ...p } = d;
    p.pncId = d.pncId || L.newPncId();
    p.created = P.today();
    L.stamp(p, '#ZZ', 'RECORD BUILT');
    D().persons.push(p);
    let note = '';
    if (licence) {
      const home = p.addresses.find(a => a.type === 'HOME' || a.type === 'NFA') || {};
      const driverNo = P.driverNo(p.surname, p.forenames, p.dob, p.sex === 'F' ? 'F' : 'M');
      if (L.findDriver(driverNo)) note = ' (LICENCE ALREADY EXISTED)';
      else {
        D().drivers.push({ driverNo, surname: p.surname, forenames: p.forenames, dob: p.dob, sex: p.sex === 'F' ? 'F' : 'M',
          address: home.text || 'NOT KNOWN', postcode: home.postcode || '', categories: licence.categories,
          issue: P.today(), expiry: P.addDays(P.today(), 3652), endorsements: licence.endorsements, disq: licence.disq });
        note = ' + LICENCE ' + driverNo;
      }
    }
    P.save();
    P.logTx('#ZZ', p.pncId, 'BUILD PERSON ' + p.surname);
    return L.showPerson(p, ('I: PERSON SAVED - PNCID ' + p.pncId + note).slice(0, 78));
  }

  /* ================================================================ VEHICLE */

  const vehicleSteps = [
    {
      title: 'VEHICLE DETAILS',
      fields: [
        { n: 'vrm', l: 'VRM (NUMBER PLATE)', len: 8, req: true },
        { n: 'make', l: 'MAKE', len: 15, req: true, hint: '(E.G. FORD)' }, { n: 'model', l: 'MODEL', len: 20, req: true, hint: '(E.G. FIESTA ZETEC)' },
        { n: 'colour', l: 'COLOUR', len: 12, req: true },
        { n: 'type', l: 'TYPE', len: 10, opts: ['CAR', 'LGV', 'HGV', 'MOTORCYCLE', 'BUS', 'OTHER'], def: 'CAR', hint: '(CAR LGV HGV MOTORCYCLE BUS OTHER)' },
        { n: 'body', l: 'BODY', len: 20, hint: '(E.G. 5 DOOR HATCHBACK)' },
        { n: 'cc', l: 'ENGINE SIZE (CC)', len: 5, num: true }, { n: 'fuel', l: 'FUEL', len: 8, hint: '(PETROL/DIESEL/ELECTRIC/HYBRID)' },
        { n: 'vin', l: 'VIN/CHASSIS NO.', len: 17 }, { n: 'engine', l: 'ENGINE NO.', len: 12 },
        { n: 'firstReg', l: 'DATE FIRST REG', len: 8, date: true }
      ],
      init: d => ({ vrm: d.vrm, make: d.make, model: d.model, colour: d.colour, type: d.type || 'CAR', body: d.body, cc: d.cc || '', fuel: d.fuel, vin: d.vin, engine: d.engine, firstReg: toIn(d.firstReg) }),
      apply: (v, d) => {
        const vrm = L.normVrm(v.vrm);
        if (L.findVeh(vrm)) return { err: 'E: VRM ' + vrm + ' ALREADY HELD', field: 'vrm' };
        Object.assign(d, { vrm, make: v.make, model: v.model, colour: v.colour, type: v.type, body: v.body, cc: v.cc ? +v.cc : null, fuel: v.fuel, vin: v.vin, engine: v.engine, firstReg: v.firstReg });
      }
    },
    {
      title: 'TAX / MOT / INSURANCE',
      intro: ['A DATE IN THE PAST SHOWS AS EXPIRED. BLANK = NONE.'],
      fields: [
        { n: 'tax', l: 'TAX (VED) EXPIRES', len: 8, date: true }, { n: 'mot', l: 'MOT EXPIRES', len: 8, date: true },
        { n: 'insured', l: 'INSURED (MID)', len: 1, opts: ['Y', 'N'], def: 'Y', hint: '(Y/N)' }
      ],
      init: d => ({ tax: toIn(d.tax), mot: toIn(d.mot), insured: d.insured || 'Y' }),
      apply: (v, d) => { Object.assign(d, { tax: v.tax, mot: v.mot, insured: v.insured }); }
    },
    {
      title: 'REGISTERED KEEPER',
      intro: ['ENTER A PNCID TO COPY NAME AND HOME ADDRESS FROM A PERSON RECORD,', 'OR TYPE THE DETAILS. LEAVE ALL BLANK FOR NO KEEPER.'],
      fields: [
        { n: 'pncid', l: 'KEEPER PNCID', len: 10, re: L.PNCID_RE, fmt: 'YY/NNNNNNA' },
        { n: 'name', l: 'KEEPER NAME', len: 30, hint: '(PERSON OR COMPANY)' },
        { n: 'address', l: 'ADDRESS', len: 50 }, { n: 'postcode', l: 'POSTCODE', len: 8 },
        { n: 'acquired', l: 'DATE ACQUIRED', len: 8, date: true }
      ],
      init: d => d.keeper ? { pncid: d.keeper.pncId, name: d.keeper.name, address: d.keeper.address, postcode: d.keeper.postcode, acquired: toIn(d.keeper.acquired) } : {},
      apply: (v, d) => {
        let { name, address, postcode } = v;
        if (v.pncid) {
          const p = L.findPerson(v.pncid);
          if (!p) return { err: 'E: NO TRACE OF PNCID ' + v.pncid, field: 'pncid' };
          const home = p.addresses.find(a => a.type === 'HOME' || a.type === 'NFA') || {};
          name = name || L.fullName(p);
          address = address || home.text || '';
          postcode = postcode || home.postcode || '';
        }
        d.keeper = name ? { name, address, postcode, acquired: v.acquired || P.today() } : null;
        if (d.keeper && v.pncid) d.keeper.pncId = v.pncid;
        return d.keeper ? 'KEEPER ' + name : '';
      }
    },
    {
      title: 'POLICE REPORTS', list: true, key: ['type'], count: d => d.reports.length,
      intro: ['REPORT TYPES:', ...L.twoCol(P.VEH_REPORTS, 18, 4)],
      fields: [
        { n: 'type', l: 'REPORT TYPE', len: 3, opts: Object.keys(P.VEH_REPORTS) },
        { n: 'inc', l: 'INCIDENT DATE', len: 8, date: true }, fsOpt('owner', 'OWNER FCE/STN'), { n: 'ref', l: 'REFERENCE', len: 20 },
        { n: 't1', l: 'TEXT', len: 50 }, { n: 't2', l: '', len: 50 }, { n: 't3', l: '', len: 50 }
      ],
      init: () => ({ owner: T.user.fs }),
      apply: (v, d) => {
        const text = [v.t1, v.t2, v.t3].filter(Boolean).join(' ');
        if (!text) return { err: 'E: MANDATORY FIELD MISSING - TEXT', field: 't1' };
        d.reports.push({ type: v.type, inc: v.inc || P.today(), owner: v.owner || T.user.fs, ref: v.ref, text, created: P.today(), creator: T.user.fs });
        return P.VEH_REPORTS[v.type] + ' REPORT ADDED';
      }
    },
    {
      title: 'ANPR MARKER',
      intro: ['FLAGS THE PLATE ON EVERY CHECK. LEAVE MARKER BLANK FOR NONE.', ...Object.entries(P.ANPR).map(([k, x]) => `  ${P.pad(k, 7)} ${x}`)],
      fields: [
        { n: 'marker', l: 'MARKER', len: 6, opts: Object.keys(P.ANPR), hint: '(STOP INFORM INTEL NOACT)' },
        { n: 'r1', l: 'REASON', len: 50 }, { n: 'r2', l: '', len: 50 },
        fsOpt('owner', 'OWNER FCE/STN'), { n: 'ref', l: 'REFERENCE', len: 20 },
        { n: 'expires', l: 'EXPIRES', len: 8, date: true, hint: '(BLANK = 28 DAYS)' }
      ],
      init: d => d.anpr ? { marker: d.anpr.action, r1: d.anpr.reason.slice(0, 50), r2: d.anpr.reason.slice(50), owner: d.anpr.owner, ref: d.anpr.ref, expires: toIn(d.anpr.expires) } : { owner: T.user.fs },
      apply: (v, d) => {
        if (!v.marker) { d.anpr = null; return ''; }
        const reason = [v.r1, v.r2].filter(Boolean).join(' ');
        if (!reason) return { err: 'E: MANDATORY FIELD MISSING - REASON', field: 'r1' };
        d.anpr = { action: v.marker, reason, owner: v.owner || T.user.fs, ref: v.ref, set: P.today(), expires: v.expires || P.addDays(P.today(), 28) };
        return 'ANPR ' + v.marker + ' MARKER RECORDED';
      }
    }
  ];

  function saveVehicle(d) {
    if (L.findVeh(d.vrm)) return P.blank('E: VRM ' + d.vrm + ' WAS TAKEN IN THE MEANTIME - NOT SAVED', true);
    L.stamp(d, '#ZZ', 'RECORD BUILT');
    D().vehicles.push(d);
    P.save();
    P.logTx('#ZZ', d.vrm, 'BUILD VEHICLE');
    return L.showVeh(d, true, 'I: VEHICLE SAVED - ' + L.fmtVrm(d.vrm));
  }

  /* ================================================================ PROPERTY */

  const propertySteps = [
    {
      title: 'ITEM DETAILS',
      intro: ['CATEGORIES: ' + L.PROP_CATS.join(' ')],
      fields: [
        { n: 'cat', l: 'CATEGORY', len: 8, req: true, opts: L.PROP_CATS },
        { n: 'type', l: 'ITEM TYPE', len: 20, req: true, hint: '(E.G. MINI EXCAVATOR, LAPTOP)' },
        { n: 'make', l: 'MAKE', len: 15 }, { n: 'model', l: 'MODEL', len: 15 }, { n: 'colour', l: 'COLOUR', len: 12 },
        { n: 'serial', l: 'MANUFACT/SERIAL NO', len: 20 }, { n: 'fleet', l: 'FLEET NO', len: 12 },
        { n: 'engine', l: 'ENGINE NO', len: 15 }, { n: 'cesar', l: 'CESAR / MARKING NO', len: 12 },
        fsOpt('owner', 'OWNER FCE/STN')
      ],
      init: d => ({ cat: d.category, type: d.itemType, make: d.make, model: d.model, colour: d.colour, serial: d.serial, fleet: d.fleet, engine: d.engine, cesar: d.cesar, owner: d.owner }),
      apply: (v, d) => {
        Object.assign(d, { category: v.cat, itemType: v.type, make: v.make, model: v.model, colour: v.colour, serial: v.serial, fleet: v.fleet, engine: v.engine, cesar: v.cesar, owner: v.owner || T.user.fs });
      }
    },
    {
      title: 'REPORTS', list: true, key: ['type'], count: d => d.reports.length,
      intro: ['TYPES: ' + Object.entries(L.PROP_REPORTS).map(([k, v]) => k + ' ' + v).join('  ')],
      fields: [
        { n: 'type', l: 'REPORT TYPE', len: 3, opts: Object.keys(L.PROP_REPORTS) },
        { n: 'inc', l: 'INCIDENT DATE', len: 8, date: true }, fsOpt('rowner', 'OWNER FCE/STN'), { n: 'ref', l: 'REFERENCE', len: 20 },
        { n: 't1', l: 'TEXT', len: 50 }, { n: 't2', l: '', len: 50 }
      ],
      init: () => ({ rowner: T.user.fs }),
      apply: (v, d) => {
        const text = [v.t1, v.t2].filter(Boolean).join(' ');
        if (!text) return { err: 'E: MANDATORY FIELD MISSING - TEXT', field: 't1' };
        d.reports.push({ type: v.type, inc: v.inc || P.today(), owner: v.rowner || T.user.fs, ref: v.ref, text });
        return L.PROP_REPORTS[v.type] + ' REPORT ADDED';
      }
    }
  ];

  function saveProperty(d) {
    d.propId = L.newPropId();
    d.created = P.today();
    L.stamp(d, '#ZZ', 'RECORD BUILT');
    D().property.push(d);
    P.save();
    P.logTx('#ZZ', d.propId, 'BUILD PROPERTY');
    return L.showProp(d, 'I: PROPERTY SAVED - PROPID ' + d.propId);
  }

  /* ================================================================ entry point */

  const builders = {
    1: () => wizard({ kind: 'PERSON', id: 'ZZ100M01', steps: personSteps, draft: blankDraftPerson(), review: personReview }),
    2: () => wizard({
      kind: 'VEHICLE', id: 'ZZ200M01', steps: vehicleSteps,
      draft: { vrm: '', make: '', model: '', colour: '', type: 'CAR', body: '', cc: null, fuel: '', vin: '', engine: '', firstReg: '', tax: '', mot: '', insured: 'Y', keeper: null, reports: [], anpr: null, history: [] },
      review: (d, api) => reviewScreen('VEHICLE', L.vehicleLines(d, true), () => saveVehicle(d), api)
    }),
    3: () => wizard({
      kind: 'PROPERTY', id: 'ZZ300M01', steps: propertySteps,
      draft: { propId: '', category: '', itemType: '', make: '', model: '', colour: '', serial: '', fleet: '', engine: '', cesar: '', created: P.today(), creator: T.user.fs, owner: T.user.fs, reports: [], history: [] },
      review: (d, api) => reviewScreen('PROPERTY', L.propLines(Object.assign({}, d, { propId: '(ALLOCATED ON SAVE)' })), () => saveProperty(d), api)
    })
  };
  const SHORT = { PERSON: 1, P: 1, '1': 1, VEHICLE: 2, V: 2, '2': 2, PROPERTY: 3, PR: 3, '3': 3 };

  P.TX['#ZZ'] = {
    d: 'RECORD BUILDER (PERSON/VEHICLE/PROPERTY)', role: 'ADMIN', cat: 'SIMULATOR',
    run: data => {
      if (SHORT[data]) return builders[SHORT[data]]();
      return P.report({
        title: 'RECORD BUILDER', id: 'ZZ000M01',
        lines: [
          'BUILD A COMPLETE NEW RECORD STEP BY STEP. EACH SCREEN ASKS FOR ONE PART;',
          'YOU SEE THE FINISHED RECORD BEFORE ANYTHING IS SAVED.',
          '',
          '   1  PERSON    - IDENTITY, IC CODE, DESCRIPTION, ADDRESSES, WARNINGS,',
          '                  MARKERS, WANTED/MISSING, ORDERS, ARRESTS, CONVICTIONS,',
          '                  CAUTIONS/PNDS, DNA/PRINTS, PHOTO, FIREARMS, LICENCE',
          '   2  VEHICLE   - DETAILS, TAX/MOT/INSURANCE, KEEPER, REPORTS, ANPR',
          '   3  PROPERTY  - ITEM DETAILS, REPORTS',
          '',
          'ON EVERY STEP:  N = NEXT   B = BACK   Q = QUIT WITHOUT SAVING',
          'ON REPEATING STEPS (ARRESTS, CONVICTIONS, REPORTS...) PUT Y IN',
          'ADD ANOTHER TO ENTER MORE, OR LEAVE THE SCREEN BLANK TO SKIP IT.',
          '',
          'SHORTCUT: DATA = PERSON, VEHICLE OR PROPERTY GOES STRAIGHT IN.'
        ],
        select: { label: 'ENTER 1, 2 OR 3', max: 3, pick: n => builders[n]() }
      });
    }
  };

})(window.PNC);
