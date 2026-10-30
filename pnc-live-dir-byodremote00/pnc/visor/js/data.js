/* ViSOR mock: reference tables, fictional seed records and the storage layer.
   Every person, reference number and account in this file is FICTIONAL. */
(function (global) {
  'use strict';

  // ACPO regions in the order the old Advanced Search screen listed them (two columns).
  const REGIONS = [
    { id: 'ireland', label: 'Ireland', country: 'Ireland', col: 1, forces: ['Northern Ireland'] },
    { id: 'channel', label: 'Channel Islands', country: 'Channel Islands', col: 1, forces: ['Jersey'] },
    { id: 'scotland', label: 'Scotland', country: 'Scotland', col: 1, forces: ['Police Scotland'] },
    { id: 'wales', label: 'Wales', country: 'Wales', col: 1, forces: ['Dyfed-Powys', 'Gwent', 'North Wales', 'South Wales'] },
    { id: 'northeast', label: 'North East', country: 'England', col: 1,
      forces: ['Cleveland', 'Durham', 'Humberside', 'North Yorkshire', 'Northumbria', 'South Yorkshire', 'West Yorkshire'] },
    { id: 'northwest', label: 'North West', country: 'England', col: 1,
      forces: ['Cheshire', 'Cumbria', 'Greater Manchester', 'Lancashire', 'Merseyside'] },
    { id: 'eastmidlands', label: 'East Midlands', country: 'England', col: 1,
      forces: ['Derbyshire', 'Leicestershire', 'Lincolnshire', 'Northamptonshire', 'Nottinghamshire'] },
    { id: 'westmidlands', label: 'West Midlands', country: 'England', col: 2,
      forces: ['Staffordshire', 'Warwickshire', 'West Mercia', 'West Midlands'] },
    { id: 'eastern', label: 'Eastern', country: 'England', col: 2,
      forces: ['Bedfordshire', 'Cambridgeshire', 'Essex', 'Hertfordshire', 'Norfolk', 'Suffolk'] },
    { id: 'southeast', label: 'South East', country: 'England', col: 2,
      forces: ['Hampshire', 'Kent', 'Surrey', 'Sussex', 'Thames Valley'] },
    { id: 'southwest', label: 'South West', country: 'England', col: 2,
      forces: ['Avon and Somerset', 'Devon and Cornwall', 'Dorset', 'Gloucestershire', 'Wiltshire'] },
    { id: 'london', label: 'London', country: 'England', col: 2,
      forces: ['City of London', 'Metropolitan (Borough)', 'Metropolitan (Special Units)'] }
  ];

  const AGENCIES = ['CJSW', 'Police', 'Prisons', 'Probation', 'ROCU'];
  const NATIONAL_AGENCIES = ['ACRO', 'HM Forces', 'NCA', 'Scottish Health', 'Scottish Prisons'];

  const NOMINAL_TYPES = [
    { code: 'RSO', label: 'Registered Sex Offender', mappaCat: 1 },
    { code: 'VO', label: 'Violent Offender', mappaCat: 2 },
    { code: 'PDP', label: 'Potentially Dangerous Person', mappaCat: 3 },
    { code: 'TACT', label: 'Terrorism Notification', mappaCat: 3 }
  ];
  const RISK_LEVELS = ['Low', 'Medium', 'High', 'Very High'];
  const STATUSES = ['Active', 'In Custody', 'Wanted / Missing', 'Archived'];
  const NOTIFICATION = ['Annual', '3 Days (change of details)', 'Weekly (NFA)', 'Not applicable'];
  const BUILDS = ['Thin', 'Slim', 'Medium', 'Stocky', 'Heavy', 'Muscular'];
  const ETHNICITY = [
    ['IC1', 'IC1 - White, North European'], ['IC2', 'IC2 - White, South European'], ['IC3', 'IC3 - Black'],
    ['IC4', 'IC4 - Asian'], ['IC5', 'IC5 - Chinese, Japanese, SE Asian'], ['IC6', 'IC6 - Arab, North African'],
    ['IC0', 'IC0 - Unknown']
  ];
  const WARNING_MARKERS = [
    ['VI', 'Violent'], ['WE', 'Weapons'], ['FI', 'Firearms'], ['SH', 'Self Harm'], ['SU', 'Suicidal'],
    ['DR', 'Drugs'], ['ES', 'Escaper'], ['MH', 'Mental Health'], ['AG', 'Alleges'], ['CH', 'Risk to Children']
  ];
  const ADDRESS_TYPES = ['Home', 'Secondary', 'Previous', 'Approved Premises', 'Work', 'No Fixed Abode'];

  // Police Scotland divisions, positioned on the Scotland outline used in map.js.
  const SCOTLAND_DIVISIONS = [
    { name: 'Highlands & Islands', x: 172, y: 78 },
    { name: 'North East', x: 252, y: 98 },
    { name: 'Tayside', x: 232, y: 128 },
    { name: 'Argyll & West Dunbartonshire', x: 150, y: 148 },
    { name: 'Forth Valley', x: 204, y: 158 },
    { name: 'Fife', x: 246, y: 150 },
    { name: 'Edinburgh', x: 240, y: 172 },
    { name: 'Renfrewshire & Inverclyde', x: 170, y: 178 },
    { name: 'Greater Glasgow', x: 192, y: 176 },
    { name: 'Lanarkshire', x: 212, y: 190 },
    { name: 'Ayrshire', x: 176, y: 200 },
    { name: 'The Lothians & Scottish Borders', x: 252, y: 196 },
    { name: 'Dumfries & Galloway', x: 200, y: 220 }
  ];

  // Log-on accounts. A prop for roleplay, so the passwords are deliberately simple.
  const ACCOUNTS = [
    { username: 'ADMIN', password: 'ADMIN', name: 'ADMINISTRATOR, System', role: 'ADMIN', agency: 'Police', force: 'Metropolitan (Special Units)', unit: 'ViSOR Helpdesk' },
    { username: 'HARPER.D', password: 'VISOR123', name: 'HARPER, Dean', role: 'UPDATE', agency: 'Police', force: 'Thames Valley', unit: 'Public Protection Unit' },
    { username: 'QUINN.S', password: 'PROBATION1', name: 'QUINN, Sarah', role: 'UPDATE', agency: 'Probation', force: 'Greater Manchester', unit: 'Offender Management' },
    { username: 'VIEWER', password: 'VIEWER', name: 'READ ONLY, User', role: 'READ', agency: 'Police', force: 'Kent', unit: 'Intelligence Bureau' }
  ];

  const WHITE_PAGES = [
    { name: 'HARPER, Dean', agency: 'Police', force: 'Thames Valley', unit: 'Public Protection Unit', phone: '01865 000 4410' },
    { name: 'QUINN, Sarah', agency: 'Probation', force: 'Greater Manchester', unit: 'Offender Management', phone: '0161 000 2290' },
    { name: 'OKONJO, Ade', agency: 'Police', force: 'Metropolitan (Borough)', unit: 'Jigsaw Team', phone: '020 7000 1182' },
    { name: 'LLEWELLYN, Rhys', agency: 'Police', force: 'South Wales', unit: 'MOSOVO', phone: '029 2000 7781' },
    { name: 'FRASER, Morag', agency: 'Police', force: 'Police Scotland', unit: 'Offender Management Unit', phone: '0141 000 3321' },
    { name: 'BATES, Colin', agency: 'Prisons', force: 'West Midlands', unit: 'Offender Management Unit (HMP)', phone: '0121 000 6620' },
    { name: 'NAGRA, Priya', agency: 'Probation', force: 'West Yorkshire', unit: 'MAPPA Coordinator', phone: '0113 000 4471' },
    { name: 'ADMINISTRATOR, System', agency: 'Police', force: 'Metropolitan (Special Units)', unit: 'ViSOR Helpdesk', phone: '020 7000 0000' }
  ];

  const BULLETINS = [
    { date: '2019-05-20', text: 'Scheduled maintenance: ViSOR will be unavailable between 02:00 and 04:00 on Sunday.' },
    { date: '2019-05-14', text: 'Reminder: all MAPPA Level 2/3 nominals must have a risk review recorded within 16 weeks.' },
    { date: '2019-04-30', text: 'Release 10.4.2 is now live. See Release Notes for details.' }
  ];

  const SEED_NOMINALS = [
    {
      id: 'N100001', ref: 'VR/19/004512', pnc: '98/412345J', cro: '41234/98R',
      surname: 'HARGREAVES', forenames: 'Darren Paul', aliases: 'HARGREAVES, Daz', dob: '1979-03-14', pob: 'Reading',
      gender: 'Male', ethnicity: 'IC1', height: '178', build: 'Stocky', hair: 'Brown, short', eyes: 'Blue',
      marks: 'Tattoo "LFC" right forearm. Scar above left eyebrow.',
      type: 'VO', status: 'Active', risk: 'High', mappaLevel: '2',
      force: 'Thames Valley', area: 'Reading LPA', agency: 'Police', offenderManager: 'HARPER, Dean', omContact: '01865 000 4410',
      registered: '2017-08-02', expiry: '2027-08-02', notification: 'Not applicable',
      orders: 'Licence conditions: not to enter Oxford Road, Reading. Curfew 19:00-07:00 (expired).',
      riskNotes: 'Violence towards partners. Escalates under alcohol. Avoid single crewed visits.',
      markers: ['VI', 'DR'],
      addresses: [
        { type: 'Home', address: '14 Elmhurst Close, Reading, RG1 0XX', from: '2018-02-10', to: '' },
        { type: 'Previous', address: 'Flat 3, 77 Basingstoke Road, Reading, RG2 0XX', from: '2015-06-01', to: '2018-02-09' }
      ],
      offences: [
        { date: '2016-11-04', offence: 'Assault occasioning ABH (s.47 OAPA 1861)', court: 'Reading Crown Court', sentence: '3 years imprisonment' },
        { date: '2012-05-20', offence: 'Common assault', court: 'Reading Magistrates', sentence: 'Community order, 12 months' }
      ],
      vehicles: [{ vrm: 'RX09 KLM', make: 'Vauxhall', model: 'Astra', colour: 'Silver' }],
      associates: [{ name: 'PIKE, Shaun', relationship: 'Associate', notes: 'Co-accused 2012.' }]
    },
    {
      id: 'N100002', ref: 'VR/18/011873', pnc: '02/118733K', cro: '',
      surname: 'BRENNAN', forenames: 'Sean Patrick', aliases: '', dob: '1985-11-02', pob: 'Belfast',
      gender: 'Male', ethnicity: 'IC1', height: '183', build: 'Slim', hair: 'Ginger', eyes: 'Green',
      marks: 'Shamrock tattoo left hand.',
      type: 'RSO', status: 'Active', risk: 'Medium', mappaLevel: '1',
      force: 'Greater Manchester', area: 'Salford', agency: 'Probation', offenderManager: 'QUINN, Sarah', omContact: '0161 000 2290',
      registered: '2018-03-19', expiry: 'Indefinite', notification: 'Annual',
      orders: 'Sexual Harm Prevention Order (2018): no unsupervised internet access, must declare all devices.',
      riskNotes: 'Compliant with notification requirements. Last home visit satisfactory.',
      markers: [],
      addresses: [{ type: 'Home', address: '22 Cavendish Street, Salford, M6 0XX', from: '2018-04-01', to: '' }],
      offences: [{ date: '2017-09-12', offence: 'Sexual offence (SOA 2003)', court: 'Manchester Crown Court', sentence: '18 months, SHPO 10 years' }],
      vehicles: [], associates: []
    },
    {
      id: 'N100003', ref: 'VR/15/002291', pnc: '95/220191A', cro: '22019/95A',
      surname: 'McALLISTER', forenames: 'Robert James', aliases: 'ALLISTER, Rab', dob: '1972-06-30', pob: 'Glasgow',
      gender: 'Male', ethnicity: 'IC1', height: '175', build: 'Heavy', hair: 'Grey, receding', eyes: 'Brown',
      marks: 'Glasgow smile scar, left cheek.',
      type: 'VO', status: 'In Custody', risk: 'Very High', mappaLevel: '3',
      force: 'Police Scotland', area: 'Greater Glasgow', agency: 'Scottish Prisons', offenderManager: 'FRASER, Morag', omContact: '0141 000 3321',
      registered: '2015-01-11', expiry: 'Indefinite', notification: 'Not applicable',
      orders: 'Order for Lifelong Restriction under review.',
      riskNotes: 'History of serious weapon-enabled violence. Any release requires MAPPA L3 plan.',
      markers: ['VI', 'WE', 'ES'],
      addresses: [{ type: 'Home', address: 'HMP (Scotland) - see custody record', from: '2014-12-03', to: '' }],
      offences: [{ date: '2014-07-22', offence: 'Attempted murder', court: 'High Court, Glasgow', sentence: '12 years' }],
      vehicles: [], associates: [{ name: 'McALLISTER, John', relationship: 'Brother', notes: 'Visits weekly.' }]
    },
    {
      id: 'N100004', ref: 'VR/19/006620', pnc: '11/660204P', cro: '',
      surname: 'WHITLOCK', forenames: 'Gary', aliases: '', dob: '1990-01-21', pob: 'Cardiff',
      gender: 'Male', ethnicity: 'IC1', height: '170', build: 'Medium', hair: 'Black, shaved', eyes: 'Brown',
      marks: '',
      type: 'PDP', status: 'Wanted / Missing', risk: 'High', mappaLevel: '2',
      force: 'South Wales', area: 'Cardiff', agency: 'Police', offenderManager: 'LLEWELLYN, Rhys', omContact: '029 2000 7781',
      registered: '2019-02-01', expiry: '', notification: 'Not applicable',
      orders: '',
      riskNotes: 'Failed to attend appointment 15/05. Last seen Cardiff city centre. Circulated wanted on PNC.',
      markers: ['VI', 'MH'],
      addresses: [{ type: 'No Fixed Abode', address: 'NFA - Cardiff area', from: '2019-05-15', to: '' }],
      offences: [{ date: '2018-10-03', offence: 'Threats to kill', court: 'Cardiff Magistrates', sentence: 'Restraining order' }],
      vehicles: [{ vrm: 'CY61 DFE', make: 'Ford', model: 'Fiesta', colour: 'Blue' }], associates: []
    },
    {
      id: 'N100005', ref: 'VR/17/009001', pnc: '05/900112C', cro: '',
      surname: 'PRICE', forenames: 'Lee Anthony', aliases: 'PRYCE, Lee', dob: '1983-08-08', pob: 'Birmingham',
      gender: 'Male', ethnicity: 'IC3', height: '188', build: 'Muscular', hair: 'Black', eyes: 'Brown',
      marks: 'Tattoo of a lion, chest.',
      type: 'VO', status: 'Active', risk: 'Medium', mappaLevel: '2',
      force: 'West Midlands', area: 'Birmingham East', agency: 'Probation', offenderManager: 'NAGRA, Priya', omContact: '0113 000 4471',
      registered: '2017-04-15', expiry: '2022-04-15', notification: 'Not applicable',
      orders: 'Criminal Behaviour Order: not to associate with named gang members.',
      riskNotes: '',
      markers: ['WE'],
      addresses: [{ type: 'Approved Premises', address: 'Approved Premises, Birmingham B8 0XX', from: '2019-01-04', to: '' }],
      offences: [{ date: '2016-03-30', offence: 'Wounding with intent (s.18 OAPA 1861)', court: 'Birmingham Crown Court', sentence: '6 years' }],
      vehicles: [], associates: []
    },
    {
      id: 'N100006', ref: 'VR/12/000774', pnc: '89/077410D', cro: '07741/89D',
      surname: 'STOKES', forenames: 'Jason', aliases: '', dob: '1968-12-01', pob: 'Norwich',
      gender: 'Male', ethnicity: 'IC1', height: '172', build: 'Thin', hair: 'Fair', eyes: 'Grey',
      marks: '',
      type: 'RSO', status: 'Archived', risk: 'Low', mappaLevel: '1',
      force: 'Norfolk', area: 'Norwich', agency: 'Police', offenderManager: '', omContact: '',
      registered: '2008-06-10', expiry: '2018-06-10', notification: 'Annual',
      orders: 'Notification period expired.',
      riskNotes: 'Record archived on expiry of notification requirements.',
      markers: [],
      addresses: [{ type: 'Previous', address: '5 Mill Lane, Norwich, NR3 0XX', from: '2008-06-10', to: '2018-06-10' }],
      offences: [], vehicles: [], associates: []
    },
    {
      id: 'N100007', ref: 'VR/19/007314', pnc: '14/731400R', cro: '',
      surname: 'OKAFOR', forenames: 'Michael', aliases: '', dob: '1994-04-17', pob: 'London',
      gender: 'Male', ethnicity: 'IC3', height: '180', build: 'Slim', hair: 'Black, braids', eyes: 'Brown',
      marks: '',
      type: 'VO', status: 'Active', risk: 'Medium', mappaLevel: '1',
      force: 'Metropolitan (Borough)', area: 'Southwark', agency: 'Police', offenderManager: '', omContact: '',
      registered: '2019-03-28', expiry: '2024-03-28', notification: 'Not applicable',
      orders: '',
      riskNotes: 'Transferred in from Kent. Awaiting allocation to an Offender Manager.',
      markers: [],
      addresses: [{ type: 'Home', address: '41 Larkhall Road, London SE1 0XX', from: '2019-03-20', to: '' }],
      offences: [{ date: '2018-01-15', offence: 'Affray', court: 'Inner London Crown Court', sentence: '14 months' }],
      vehicles: [], associates: []
    },
    {
      id: 'N100008', ref: 'VR/16/003390', pnc: '07/339002M', cro: '',
      surname: 'DAVIES', forenames: 'Kerry Ann', aliases: 'JONES, Kerry', dob: '1988-09-25', pob: 'Leeds',
      gender: 'Female', ethnicity: 'IC1', height: '163', build: 'Slim', hair: 'Blonde, long', eyes: 'Blue',
      marks: 'Butterfly tattoo, lower back.',
      type: 'PDP', status: 'Active', risk: 'Medium', mappaLevel: '2',
      force: 'West Yorkshire', area: 'Leeds District', agency: 'Probation', offenderManager: 'NAGRA, Priya', omContact: '0113 000 4471',
      registered: '2016-07-07', expiry: '', notification: 'Not applicable',
      orders: '',
      riskNotes: 'Arson risk. Fire service notified of current address.',
      markers: ['SH', 'MH'],
      addresses: [{ type: 'Home', address: '9 Harehills Avenue, Leeds, LS8 0XX', from: '2017-01-12', to: '' }],
      offences: [{ date: '2015-12-19', offence: 'Arson, reckless as to whether life endangered', court: 'Leeds Crown Court', sentence: '4 years' }],
      vehicles: [], associates: []
    }
  ];

  // ---------------------------------------------------------------- lookups
  const FORCE_REGION = {};
  REGIONS.forEach(r => r.forces.forEach(f => { FORCE_REGION[f] = r; }));

  // ---------------------------------------------------------------- storage
  const NS = 'visor.';
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage blocked or corrupt: fall through to default */ }
    return fallback;
  }
  function write(key, value) {
    try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  function seeded() {
    const now = new Date().toISOString();
    return clone(SEED_NOMINALS).map(n => Object.assign(n, {
      photo: '', created: now, updated: now, createdBy: 'ADMINISTRATOR, System',
      log: [{ ts: now, user: 'ADMINISTRATOR, System', text: 'Record migrated from legacy system.' }]
    }));
  }

  let cache = null;
  const Store = {
    all() {
      if (!cache) {
        cache = read('nominals', null);
        if (!Array.isArray(cache)) { cache = seeded(); write('nominals', cache); }
      }
      return cache;
    },
    get(id) { return this.all().find(n => n.id === id) || null; },
    save(n) {
      const list = this.all();
      n.updated = new Date().toISOString();
      const i = list.findIndex(x => x.id === n.id);
      if (i >= 0) list[i] = n; else list.push(n);
      write('nominals', list);
      return n;
    },
    remove(id) {
      cache = this.all().filter(n => n.id !== id);
      write('nominals', cache);
    },
    newId() {
      const max = this.all().reduce((m, n) => Math.max(m, parseInt(String(n.id).slice(1), 10) || 0), 100000);
      return 'N' + (max + 1);
    },
    nextRef() {
      const yy = String(new Date().getFullYear()).slice(-2);
      const max = this.all().reduce((m, n) => Math.max(m, parseInt(String(n.ref).split('/')[2], 10) || 0), 0);
      return `VR/${yy}/${String(max + 1).padStart(6, '0')}`;
    },
    reset() { cache = seeded(); write('nominals', cache); },
    exportJSON() {
      return JSON.stringify({ system: 'ViSOR-mock', exported: new Date().toISOString(), nominals: this.all() }, null, 2);
    },
    importJSON(text) {
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : data.nominals;
      if (!Array.isArray(list) || list.some(n => !n || !n.id || !n.surname)) throw new Error('File does not contain ViSOR nominal records.');
      cache = list;
      write('nominals', cache);
      return list.length;
    },
    // Small per-user lists (diary, to-do, meetings, contact details).
    list(name) { return read(name, []); },
    setList(name, arr) { write(name, arr); },
    getItem(name, fallback) { return read(name, fallback); },
    setItem(name, value) { write(name, value); }
  };

  global.VISOR_DATA = {
    REGIONS, AGENCIES, NATIONAL_AGENCIES, NOMINAL_TYPES, RISK_LEVELS, STATUSES, NOTIFICATION, BUILDS,
    ETHNICITY, WARNING_MARKERS, ADDRESS_TYPES, SCOTLAND_DIVISIONS, ACCOUNTS, WHITE_PAGES, BULLETINS, FORCE_REGION
  };
  global.VisorStore = Store;
})(window);
