/* PNC mock - reference tables, seed data and persistence.
   All people, vehicles and property below are fictional. */
'use strict';
window.PNC = window.PNC || {};
(function (P) {

  /* ------------------------------------------------------------------ tables */

  P.WARNINGS = {
    AG: 'MAY MAKE FALSE ALLEGATIONS', AT: 'MAY HAVE MEDICAL CONDITION', CO: 'CONTAGIOUS',
    DR: 'MAY POSSESS DRUGS', ES: 'ESCAPER', FI: 'MAY POSSESS FIREARMS', IF: 'FEMALE IMPERSONATOR',
    IM: 'MALE IMPERSONATOR', MN: 'MAY SUFFER FROM MENTAL DISORDER', SH: 'MAY SELF-HARM',
    SU: 'SUICIDAL', VI: 'VIOLENT', WE: 'MAY POSSESS WEAPONS', XP: 'MAY POSSESS EXPLOSIVES'
  };

  P.MARKERS = {
    AS: 'ASSET INFORMATION SOUGHT', BB: 'BREACHES BAIL CONDITIONS', CD: 'CONFIRMED DEAD',
    DP: 'DEPORTEE OR ERS', DR: 'DNA REQUIRED', FA: 'FAILS TO APPEAR', FL: 'FOREIGN LICENCE',
    GR: 'GENDER RE-ASSIGNED', HD: 'HOME DETENTION CURFEW', LL: 'LIFE LICENSEE',
    MO: 'MODUS OPERANDI RECORDED', OB: 'OFFENDS ON BAIL', OV: 'OFFENDS AGAINST VULNERABLE PERSON',
    PP: 'PROLIFIC & PRIORITY OFFENDER', RE: 'MANUAL WEED REQUIRED', RF: 'REFER TO FILE',
    SO: 'SEX OFFENDER', UD: 'UNCONFIRMED DEAD', UN: 'USES NOMINAL DETAILS OF ANOTHER PERSON',
    VS: 'VISOR SUBJECT'
  };

  P.REASONS = {
    1: 'VEHICLE AND/OR PERSON STOPPED (STREET CHECK)',
    2: 'MOVING VEHICLE - SEEN, NOT STOPPED',
    3: 'ABANDONED / PARKED UNATTENDED VEHICLE OR FOUND PROPERTY',
    4: 'VEHICLE INVOLVED IN ROAD TRAFFIC COLLISION',
    5: 'SUBJECT OF PROCESS OR INVESTIGATION (E.G. IN CUSTODY)',
    6: 'ADMINISTRATION / VETTING / INTELLIGENCE',
    7: 'FAMILY PROTECTION ISSUES',
    8: 'ON BEHALF OF OTHER AUTHORISED AGENCY',
    9: 'UPDATE / CONFIRM / BROADCAST',
    0: 'TRANSACTION LOG AND OTHER AUDIT CHECKS'
  };

  P.ETHNIC = {
    1: 'WHITE - NORTH EUROPEAN', 2: 'WHITE - SOUTH EUROPEAN', 3: 'BLACK',
    4: 'ASIAN', 5: 'CHINESE / JAPANESE / SE ASIAN', 6: 'ARAB / NORTH AFRICAN', 0: 'UNKNOWN'
  };

  P.VEH_REPORTS = {
    LOS: 'LOST/STOLEN', FOU: 'FOUND', ACT: 'ACTION', REA: 'REACTION', INF: 'INFORMATION',
    COR: 'CORRECTION', REM: 'REMOVED', RES: 'RESTRICTED', SEE: 'SEEN/CHECKED', DES: 'DESTROYED'
  };

  /* initial retention per W/M class, in days (0 = unlimited) */
  P.WM_CLASSES = {
    WANTED: 365 * 3, MISSING: 70, ABSCOND: 365 * 3, RECALL: 0, LOCATE: 365, DESERT: 365 * 3, DETAINED: 7
  };

  P.OI_TYPES = {
    ASBCI: 'CIVIL INJUNCTION (ASBCP ACT)', CBO: 'CRIMINAL BEHAVIOUR ORDER', CTN: 'COUNTER TERRORISM NOTIFICATION',
    DOGCON: 'DOG CONTROL ORDER', DRINKBAN: 'DRINKING BANNING ORDER', DVPNO: 'DOMESTIC VIOLENCE PROTECTION NOTICE/ORDER',
    EXCLUSION: 'EXCLUSION ORDER OR REQUIREMENT', FMPO: 'FORCED MARRIAGE PROTECTION ORDER', HARASS: 'HARASSMENT INJUNCTION',
    NONMOL: 'NON-MOLESTATION ORDER', RESTRAIN: 'RESTRAINING ORDER', SHPO: 'SEXUAL HARM PREVENTION ORDER',
    STALKPO: 'STALKING PROTECTION ORDER', BAIL: 'POLICE BAIL CONDITIONS', INTEL: 'INTELLIGENCE - REFER TO OWNER'
  };

  /* out-of-court disposals recorded instead of a court result */
  P.DISPOSALS = {
    CAU: 'SIMPLE CAUTION', CC: 'CONDITIONAL CAUTION', YC: 'YOUTH CAUTION', YCC: 'YOUTH CONDITIONAL CAUTION',
    PND: 'PENALTY NOTICE FOR DISORDER', CR: 'COMMUNITY RESOLUTION', CW: 'CANNABIS / KHAT WARNING'
  };

  /* ANPR hotlist marker actions */
  P.ANPR = {
    STOP: 'STOP VEHICLE', INFORM: 'DO NOT STOP - INFORM OWNER', INTEL: 'INTELLIGENCE - RECORD SIGHTING', NOACT: 'NO ACTION REQUIRED'
  };

  P.FIREARM_CERTS = { FAC: 'FIREARM CERTIFICATE', SGC: 'SHOTGUN CERTIFICATE', BOTH: 'FIREARM AND SHOTGUN CERTIFICATES', RFD: 'REGISTERED FIREARMS DEALER' };
  P.FIREARM_STATUS = ['VALID', 'REVIEW', 'REVOKED', 'REFUSED', 'EXPIRED', 'SURRENDERED'];

  /* DNA / fingerprint status codes */
  P.BIO = { Y: 'TAKEN', N: 'NOT TAKEN', R: 'REQUIRED' };

  P.FORCES = {
    '01': 'METROPOLITAN POLICE', '03': 'CUMBRIA', '04': 'LANCASHIRE', '05': 'MERSEYSIDE',
    '06': 'GREATER MANCHESTER', '07': 'CHESHIRE', '10': 'NORTHUMBRIA', '11': 'DURHAM',
    '12': 'NORTH YORKSHIRE', '13': 'WEST YORKSHIRE', '14': 'SOUTH YORKSHIRE', '16': 'HUMBERSIDE',
    '17': 'CLEVELAND', '20': 'WEST MIDLANDS', '21': 'STAFFORDSHIRE', '22': 'WEST MERCIA',
    '23': 'WARWICKSHIRE', '30': 'DERBYSHIRE', '31': 'NOTTINGHAMSHIRE', '32': 'LINCOLNSHIRE',
    '33': 'LEICESTERSHIRE', '34': 'NORTHAMPTONSHIRE', '35': 'CAMBRIDGESHIRE', '36': 'NORFOLK',
    '37': 'SUFFOLK', '40': 'BEDFORDSHIRE', '41': 'HERTFORDSHIRE', '42': 'ESSEX',
    '43': 'THAMES VALLEY', '44': 'HAMPSHIRE', '45': 'SURREY', '46': 'KENT', '47': 'SUSSEX',
    '48': 'CITY OF LONDON', '50': 'DEVON & CORNWALL', '52': 'AVON & SOMERSET',
    '53': 'GLOUCESTERSHIRE', '54': 'WILTSHIRE', '55': 'DORSET', '60': 'NORTH WALES',
    '61': 'GWENT', '62': 'SOUTH WALES', '63': 'DYFED-POWYS'
  };

  /* transaction sets that a user-id can be given */
  P.ROLES = {
    ENQ: 'ENQUIRY ONLY',
    UPD: 'ENQUIRY AND UPDATE',
    ADMIN: 'SYSTEM ADMINISTRATOR'
  };

  /* ------------------------------------------------------------------ seed */

  function seedData() {
    const persons = [
      {
        pncId: '06/218734K', cro: '112233/06L', surname: 'HUGHES', forenames: 'DANIEL MARK',
        dob: '1988-03-14', sex: 'M', eth: '1', height: 180, build: 'MEDIUM', hair: 'BROWN SHORT',
        eyes: 'BLUE', pob: 'SALFORD', nat: 'BRITISH', aliases: ['HUGHES, DANNY', 'HEWES, DANIEL'],
        addresses: [
          { type: 'HOME', text: '14 ACACIA AVENUE, ECCLES, SALFORD', postcode: 'M30 9XX', from: '2024-01-10' },
          { type: 'PREV', text: 'FLAT 3, 220 LIVERPOOL ROAD, PATRICROFT', postcode: 'M30 8XX', from: '2019-06-01' }
        ],
        warnings: [
          { code: 'VI', fs: '06AA', date: '2016-05-12' },
          { code: 'WE', fs: '06AA', date: '2020-09-28' }
        ],
        markers: [{ code: 'PP', fs: '06AA', date: '2021-02-01' }, { code: 'MO', fs: '06CA', date: '2021-02-01' }],
        marks: ['TATTOO L/FOREARM - ROSE AND DAGGER', 'SCAR ABOVE R/EYEBROW 2CM'],
        wm: [{
          no: 1, cls: 'WANTED', offence: 'BURGLARY - DWELLING', inc: '2026-10-02', owner: '06CA',
          ref: '06CA/4471/26', text: 'SUSPECTED OF BURGLARY AT ADDRESS IN WORSLEY. ENTRY VIA REAR WINDOW. MAY USE BLACK BMW MA68 KTR.',
          action: 'ARREST. INFORM 06CA CID ON 0161 XXX XXXX', weed: '2029-10-02', created: '2026-10-03', creator: '06CA'
        }],
        oi: [],
        arrests: [],
        convictions: [
          { date: '2020-09-28', court: 'GREATER MANCHESTER MAGISTRATES', sentenced: '2020-10-20',
            offences: [{ title: 'POSSESS KNIFE BLADE/SHARP POINTED ARTICLE IN A PUBLIC PLACE', offDate: '2020-08-14', plea: 'GUILTY', result: 'IMPRISONMENT 6 MTHS' }] },
          { date: '2018-04-11', court: 'SALFORD MAGISTRATES',
            offences: [
              { title: 'THEFT FROM A SHOP', offDate: '2018-03-02', plea: 'GUILTY', result: 'COMMUNITY ORDER 12 MTHS' },
              { title: 'FAIL TO SURRENDER TO BAIL', offDate: '2018-03-30', plea: 'GUILTY', result: 'FINE 80.00' }
            ] },
          { date: '2016-06-02', court: 'MANCHESTER AND SALFORD MAGISTRATES',
            offences: [{ title: 'ASSAULT BY BEATING', offDate: '2016-05-12', plea: 'NOT GUILTY', result: 'CONVICTED - CONDITIONAL DISCHARGE 12 MTHS' }] }
        ],
        created: '2016-05-12', creator: '06AA'
      },
      {
        pncId: '13/440912C', cro: '', surname: 'HUGHES', forenames: 'SARAH JANE',
        dob: '1992-11-02', sex: 'F', eth: '1', height: 165, build: 'SLIM', hair: 'BLONDE LONG',
        eyes: 'GREEN', pob: 'LEEDS', nat: 'BRITISH', aliases: [],
        addresses: [{ type: 'HOME', text: '7 MILL COURT, HEADINGLEY, LEEDS', postcode: 'LS6 9XX', from: '2021-03-15' }],
        warnings: [], markers: [], marks: [], wm: [], oi: [], arrests: [],
        convictions: [
          { date: '2022-07-19', court: 'LEEDS MAGISTRATES',
            offences: [{ title: 'DRIVE MOTOR VEHICLE WITH EXCESS ALCOHOL', offDate: '2022-06-25', plea: 'GUILTY', result: 'FINE 400.00, DISQUALIFIED 18 MTHS' }] }
        ],
        created: '2022-06-25', creator: '13LD'
      },
      {
        pncId: '01/773105T', cro: '', surname: 'OKAFOR', forenames: 'CHINEDU EMEKA',
        dob: '1995-07-21', sex: 'M', eth: '3', height: 188, build: 'ATHLETIC', hair: 'BLACK SHAVED',
        eyes: 'BROWN', pob: 'LAMBETH', nat: 'BRITISH', aliases: ['OKAFOR, CHIN'],
        addresses: [{ type: 'HOME', text: '41 FAIRFIELD HOUSE, STOCKWELL PARK, LONDON', postcode: 'SW9 0XX', from: '2023-09-01' }],
        warnings: [], markers: [{ code: 'BB', fs: '01LX', date: '2026-08-10' }], marks: ['TATTOO R/HAND - INITIALS C.O.'],
        wm: [], oi: [{ type: 'BAIL', cat: 'POLICE', start: '2026-08-10', weed: '2026-11-10', owner: '01LX',
          text: 'CONDITIONS: RESIDE AT HOME ADDRESS. CURFEW 2100-0600. NOT TO ENTER BRIXTON TOWN CENTRE.' }],
        arrests: [{
          asRef: '26/01LX/01/88213R', date: '2026-08-09', fs: '01LX', status: 'IMPENDING PROSECUTION',
          offences: ['ROBBERY', 'POSSESS CONTROLLED DRUG OF CLASS B - CANNABIS']
        }],
        convictions: [],
        created: '2026-08-09', creator: '01LX'
      },
      {
        pncId: '05/102288F', cro: '45117/97J', surname: 'WALSH', forenames: 'KIERAN PATRICK',
        dob: '1979-01-30', sex: 'M', eth: '1', height: 175, build: 'STOCKY', hair: 'GREY RECEDING',
        eyes: 'BROWN', pob: 'LIVERPOOL', nat: 'IRISH', aliases: ['WALSH, KEV', 'MURPHY, PATRICK'],
        addresses: [{ type: 'HOME', text: 'NFA - KNOWN TO FREQUENT BOOTLE AREA', postcode: '', from: '2025-11-01' }],
        warnings: [{ code: 'ES', fs: '05BT', date: '2009-03-01' }, { code: 'DR', fs: '05BT', date: '2014-07-17' }],
        markers: [{ code: 'LL', fs: '05BT', date: '2012-01-01' }, { code: 'DR', fs: '05BT', date: '2014-07-17' }],
        marks: ['SCAR L/CHEEK 4CM', 'TATTOO KNUCKLES - LOVE HATE'],
        wm: [{
          no: 1, cls: 'RECALL', offence: 'PRISON', inc: '2026-09-14', owner: '05BT', ref: '05BT/9002/26',
          text: 'RECALLED TO PRISON FOLLOWING BREACH OF LICENCE CONDITIONS. LIFE LICENSEE.',
          action: 'ARREST AND RETURN TO CUSTODY. INFORM 05BT', weed: '', created: '2026-09-14', creator: '05BT'
        }],
        oi: [], arrests: [],
        convictions: [
          { date: '2011-02-14', court: 'LIVERPOOL CROWN', offences: [{ title: 'MANSLAUGHTER', offDate: '2010-06-02', plea: 'GUILTY', result: 'LIFE IMPRISONMENT (MIN TERM 8 YRS)' }] },
          { date: '2008-11-03', court: 'SEFTON MAGISTRATES', offences: [{ title: 'ESCAPE FROM LAWFUL CUSTODY', offDate: '2008-10-20', plea: 'GUILTY', result: 'IMPRISONMENT 4 MTHS' }] },
          { date: '2004-05-21', court: 'LIVERPOOL CROWN', offences: [{ title: 'POSSESS WITH INTENT TO SUPPLY CONTROLLED DRUG OF CLASS A - HEROIN', offDate: '2003-12-01', plea: 'GUILTY', result: 'IMPRISONMENT 3 YRS' }] }
        ],
        created: '1997-04-02', creator: '05BT'
      },
      {
        pncId: '20/551870M', cro: '', surname: 'PATEL', forenames: 'ANITA',
        dob: '2002-05-09', sex: 'F', eth: '4', height: 158, build: 'SLIM', hair: 'BLACK LONG',
        eyes: 'BROWN', pob: 'COVENTRY', nat: 'BRITISH', aliases: [],
        addresses: [{ type: 'HOME', text: '22 HOLLYBUSH LANE, EARLSDON, COVENTRY', postcode: 'CV5 6XX', from: '2015-01-01' }],
        warnings: [{ code: 'AT', fs: '20CV', date: '2026-10-12' }], markers: [], marks: [],
        wm: [{
          no: 1, cls: 'MISSING', offence: 'HIGH RISK', inc: '2026-10-11', owner: '20CV', ref: '20CV/1188/26',
          text: 'LAST SEEN COVENTRY RAILWAY STATION 2230 HRS. WEARING GREEN PARKA, BLUE JEANS. REQUIRES DAILY MEDICATION.',
          action: 'IF FOUND ENSURE WELFARE, DETAIN IF NECESSARY, INFORM 20CV MISPER UNIT', weed: '2026-12-20',
          created: '2026-10-12', creator: '20CV'
        }],
        oi: [], arrests: [], convictions: [],
        created: '2026-10-12', creator: '20CV'
      },
      {
        pncId: '43/298114W', cro: '30092/15H', surname: 'NOWAK', forenames: 'TOMASZ',
        dob: '1985-12-01', sex: 'M', eth: '1', height: 183, build: 'LARGE', hair: 'FAIR CROPPED',
        eyes: 'BLUE', pob: 'POLAND', nat: 'POLISH', aliases: [],
        addresses: [{ type: 'HOME', text: '3 OSPREY CLOSE, BANBURY, OXFORDSHIRE', postcode: 'OX16 1XX', from: '2022-05-20' }],
        warnings: [{ code: 'VI', fs: '43BA', date: '2015-02-11' }], markers: [{ code: 'OV', fs: '43BA', date: '2026-07-01' }], marks: [],
        wm: [],
        oi: [{ type: 'DVPNO', cat: 'ORDER', start: '2026-07-01', weed: '2026-07-29', owner: '43BA',
          text: 'DVPO GRANTED BANBURY MAGS. NOT TO CONTACT OR ATTEND 9 KESTREL WAY, BANBURY. POWER OF ARREST ATTACHED.' }],
        arrests: [],
        convictions: [
          { date: '2015-03-05', court: 'OXFORD MAGISTRATES', offences: [{ title: 'ASSAULT OCCASIONING ACTUAL BODILY HARM', offDate: '2015-02-11', plea: 'GUILTY', result: 'SUSPENDED SENTENCE 16 WKS, 24 MTHS' }] }
        ],
        created: '2015-02-11', creator: '43BA'
      },
      {
        pncId: '46/660423B', cro: '', surname: 'CARTER', forenames: 'LEE ANTHONY',
        dob: '1990-08-17', sex: 'M', eth: '1', height: 172, build: 'THIN', hair: 'GINGER',
        eyes: 'GREY', pob: 'MAIDSTONE', nat: 'BRITISH', aliases: [],
        addresses: [{ type: 'HOME', text: '88 TONBRIDGE ROAD, MAIDSTONE, KENT', postcode: 'ME16 8XX', from: '2020-02-02' }],
        warnings: [{ code: 'SH', fs: '46MD', date: '2023-01-09' }, { code: 'SU', fs: '46MD', date: '2023-01-09' }],
        markers: [], marks: [], wm: [], oi: [], arrests: [],
        convictions: [
          { date: '2025-11-12', court: 'MEDWAY MAGISTRATES', offences: [
            { title: 'DRIVE WHILST DISQUALIFIED', offDate: '2025-10-01', plea: 'GUILTY', result: 'DISQUALIFIED 24 MTHS, FINE 250.00' },
            { title: 'USE A VEHICLE WITHOUT INSURANCE', offDate: '2025-10-01', plea: 'GUILTY', result: 'NO SEPARATE PENALTY' }] }
        ],
        created: '2019-04-04', creator: '46MD'
      },
      {
        pncId: '50/129007N', cro: '', surname: 'BRENNAN', forenames: 'MAUREEN',
        dob: '1968-02-24', sex: 'F', eth: '1', height: 160, build: 'MEDIUM', hair: 'GREY BOB',
        eyes: 'BLUE', pob: 'PLYMOUTH', nat: 'BRITISH', aliases: ['BRENNAN-SHAW, MAUREEN'],
        addresses: [{ type: 'HOME', text: '5 HARBOUR VIEW, STONEHOUSE, PLYMOUTH', postcode: 'PL1 3XX', from: '2010-08-08' }],
        warnings: [{ code: 'AG', fs: '50PL', date: '2019-06-30' }], markers: [], marks: [], wm: [], oi: [], arrests: [],
        convictions: [
          { date: '2019-09-09', court: 'PLYMOUTH CROWN', offences: [{ title: 'FRAUD BY FALSE REPRESENTATION', offDate: '2018-01-01', plea: 'NOT GUILTY', result: 'CONVICTED - IMPRISONMENT 18 MTHS SUSPENDED 2 YRS' }] }
        ],
        created: '2019-06-30', creator: '50PL'
      }
    ];

    /* forensic status, firearms licensing and out-of-court disposals, by PNCID */
    const extra = {
      '06/218734K': { bio: { dna: 'Y', fp: 'Y' } },
      '13/440912C': { bio: { dna: 'Y', fp: 'Y' },
        disposals: [{ type: 'PND', date: '2024-12-26', fs: '13LD', offence: 'DRUNK AND DISORDERLY IN A PUBLIC PLACE', detail: 'PND ISSUED 90.00 - PAID' }] },
      '01/773105T': { bio: { dna: 'Y', fp: 'Y' },
        disposals: [{ type: 'CR', date: '2019-05-18', fs: '01LX', offence: 'CRIMINAL DAMAGE - BUS SHELTER', detail: 'APOLOGY AND REPAIR COSTS PAID TO OPERATOR' }] },
      '05/102288F': { bio: { dna: 'R', fp: 'Y' } },
      '20/551870M': { bio: { dna: 'N', fp: 'N' } },
      '43/298114W': { bio: { dna: 'Y', fp: 'Y' },
        firearms: { type: 'SGC', certNo: '43/SG/018842', status: 'REVIEW', issued: '2022-03-01', expires: '2027-02-28',
          holdings: '2 X 12 BORE SHOTGUNS HELD IN CABINET AT HOME ADDRESS', notes: 'FIREARMS LICENSING INFORMED OF DVPO 01/07/26 - REVIEW PENDING' } },
      '46/660423B': { bio: { dna: 'Y', fp: 'Y' },
        disposals: [{ type: 'CAU', date: '2021-03-04', fs: '46MD', offence: 'POSSESS CONTROLLED DRUG OF CLASS B - CANNABIS', detail: 'SIMPLE CAUTION ADMINISTERED AT MAIDSTONE PS' }] },
      '50/129007N': { bio: { dna: 'N', fp: 'Y' } }
    };
    for (const p of persons) Object.assign(p, { disposals: [], firearms: null, bio: { dna: 'N', fp: 'N' }, photo: null, history: [] }, extra[p.pncId]);

    const vehicles = [
      { vrm: 'LK19ZXC', make: 'FORD', model: 'FIESTA ZETEC', colour: 'RED', type: 'CAR', body: '5 DOOR HATCHBACK', cc: 998, fuel: 'PETROL',
        vin: 'WF0JXXGAHJKA12345', engine: 'KA12345', firstReg: '2019-03-01', tax: '2027-03-31', mot: '2027-02-27', insured: 'Y',
        keeper: { name: 'GREENE, OLIVIA RUTH', address: '19 PARKSIDE ROAD, CROYDON', postcode: 'CR0 1XX', acquired: '2023-05-14' },
        reports: [{ type: 'LOS', inc: '2026-10-03', owner: '01ZD', ref: '01ZD/7701/26', created: '2026-10-03', creator: '01ZD',
          text: 'STOLEN FROM OUTSIDE OWNERS ADDRESS OVERNIGHT. KEYS TAKEN IN BURGLARY. MAY BE ON FALSE PLATES.' }] },
      { vrm: 'MA68KTR', make: 'BMW', model: '320D M SPORT', colour: 'BLACK', type: 'CAR', body: '4 DOOR SALOON', cc: 1995, fuel: 'DIESEL',
        vin: 'WBA8E9C55JA778812', engine: 'B47D20A', firstReg: '2018-09-01', tax: '2026-11-30', mot: '2026-08-31', insured: 'Y',
        keeper: { name: 'HUGHES, DANIEL MARK', address: '14 ACACIA AVENUE, ECCLES, SALFORD', postcode: 'M30 9XX', acquired: '2025-12-02' },
        reports: [{ type: 'INF', inc: '2026-10-02', owner: '06CA', ref: '06CA/4471/26', created: '2026-10-03', creator: '06CA',
          text: 'VEHICLE BELIEVED USED BY HUGHES DANIEL (PNCID 06/218734K) WANTED FOR BURGLARY. IF STOPPED CHECK OCCUPANTS.' }] },
      { vrm: 'YG21PWN', make: 'VAUXHALL', model: 'CORSA SE', colour: 'WHITE', type: 'CAR', body: '5 DOOR HATCHBACK', cc: 1199, fuel: 'PETROL',
        vin: 'W0VPF6EB1MV001234', engine: 'F12XHL', firstReg: '2021-03-12', tax: '2027-01-31', mot: '2026-03-11', insured: 'Y',
        keeper: { name: 'HUGHES, SARAH JANE', address: '7 MILL COURT, HEADINGLEY, LEEDS', postcode: 'LS6 9XX', acquired: '2021-03-12' },
        reports: [] },
      { vrm: 'BD15OXR', make: 'VOLKSWAGEN', model: 'GOLF MATCH TDI', colour: 'GREY', type: 'CAR', body: '5 DOOR HATCHBACK', cc: 1598, fuel: 'DIESEL',
        vin: 'WVWZZZAUZFW112233', engine: 'CXX', firstReg: '2015-04-30', tax: '2027-04-30', mot: '2027-04-29', insured: 'Y',
        keeper: { name: 'AHMED, YUSUF', address: '2 CANAL STREET, BIRMINGHAM', postcode: 'B1 1XX', acquired: '2020-07-07' },
        reports: [
          { type: 'LOS', inc: '2026-08-21', owner: '20BW', ref: '20BW/3301/26', created: '2026-08-21', creator: '20BW', text: 'TAKEN FROM SUPERMARKET CAR PARK. NO KEYS ISSUED.' },
          { type: 'FOU', inc: '2026-08-23', owner: '20BE', ref: '20BE/3390/26', created: '2026-08-23', creator: '20BE', text: 'FOUND ABANDONED, BURNT OUT INTERIOR. OWNER INFORMED. VEHICLE REMOVED TO POUND.' }
        ] },
      { vrm: 'SN70HJK', make: 'MERCEDES-BENZ', model: 'SPRINTER 314 CDI', colour: 'WHITE', type: 'LGV', body: 'PANEL VAN', cc: 2143, fuel: 'DIESEL',
        vin: 'WDB9076331P445566', engine: 'OM651', firstReg: '2020-09-15', tax: '2026-12-31', mot: '2026-09-14', insured: 'N',
        keeper: { name: 'QUICKSHIFT LOGISTICS LTD', address: 'UNIT 4, HOLBECK TRADING ESTATE, LEEDS', postcode: 'LS11 5XX', acquired: '2024-02-01' },
        reports: [{ type: 'ACT', inc: '2026-09-30', owner: '13CI', ref: '13CI/0210/26', created: '2026-09-30', creator: '13CI',
          text: 'VEHICLE OF INTEREST - SUSPECTED DRUG SUPPLY. DO NOT ALERT OCCUPANTS. RECORD DETAILS AND INFORM 13CI INTEL DESK IMMEDIATELY.' }] },
      { vrm: 'WR12ABC', make: 'TOYOTA', model: 'PRIUS T3', colour: 'SILVER', type: 'CAR', body: '5 DOOR HATCHBACK', cc: 1798, fuel: 'HYBRID',
        vin: 'JTDKN36U101234567', engine: '2ZR', firstReg: '2012-06-01', tax: '2026-06-30', mot: '2026-12-01', insured: 'N',
        keeper: { name: 'KHAN, IMRAN', address: '61 VICTORIA STREET, BRISTOL', postcode: 'BS1 6XX', acquired: '2019-01-19' },
        reports: [] },
      { vrm: 'PO66DEF', make: 'HONDA', model: 'CBR600RR', colour: 'BLUE/WHITE', type: 'MOTORCYCLE', body: 'SOLO', cc: 599, fuel: 'PETROL',
        vin: 'JH2PC40A0GK200345', engine: 'PC40E', firstReg: '2016-09-20', tax: '', mot: '', insured: 'N',
        keeper: { name: 'CARTER, LEE ANTHONY', address: '88 TONBRIDGE ROAD, MAIDSTONE, KENT', postcode: 'ME16 8XX', acquired: '2022-04-09' },
        reports: [{ type: 'DES', inc: '2025-10-01', owner: '46MD', ref: '46MD/5512/25', created: '2025-10-02', creator: '46MD',
          text: 'VEHICLE DESTROYED BY FIRE FOLLOWING POLICE PURSUIT. CERTIFICATE OF DESTRUCTION ISSUED.' }] },
      { vrm: 'KX09LMN', make: 'LAND ROVER', model: 'DISCOVERY 3 TDV6', colour: 'GREEN', type: 'CAR', body: 'ESTATE', cc: 2720, fuel: 'DIESEL',
        vin: 'SALLAAA149A512345', engine: '276DT', firstReg: '2009-05-05', tax: '2027-05-31', mot: '2027-05-01', insured: 'Y',
        keeper: { name: 'FARROW, GEOFFREY', address: 'LOWER BARN, CHIPPING LANE, WITNEY', postcode: 'OX29 4XX', acquired: '2016-11-11' },
        reports: [{ type: 'COR', inc: '2026-06-02', owner: '43WT', ref: '43WT/0661/26', created: '2026-06-02', creator: '43WT',
          text: 'GENUINE VEHICLE. CLONED PLATES IN USE ON SIMILAR GREEN DISCOVERY IN WEST MIDLANDS. CHECK VIN BEFORE ACTION.' }] }
    ];

    /* keeper.pncId links a keeper to a person record; anpr is the ANPR hotlist marker */
    const keeperIds = { MA68KTR: '06/218734K', YG21PWN: '13/440912C', PO66DEF: '46/660423B' };
    const anpr = {
      LK19ZXC: { action: 'STOP', reason: 'STOLEN IN DWELLING BURGLARY 03/10/26. MAY BE ON FALSE PLATES.', owner: '01ZD', ref: '01ZD/7701/26', set: '2026-10-03', expires: '2027-01-03' },
      MA68KTR: { action: 'STOP', reason: 'KEEPER HUGHES DANIEL WANTED FOR BURGLARY. VI WE - CONSIDER ARMED SUPPORT.', owner: '06CA', ref: '06CA/4471/26', set: '2026-10-03', expires: '2026-12-31' },
      SN70HJK: { action: 'INFORM', reason: 'SUSPECTED DRUG SUPPLY. DO NOT STOP. TIME, PLACE, DIRECTION TO 13CI INTEL DESK.', owner: '13CI', ref: '13CI/0210/26', set: '2026-09-30', expires: '2026-12-30' },
      KX09LMN: { action: 'INTEL', reason: 'CLONED PLATES IN USE. CHECK VIN - GENUINE VEHICLE IS OXFORDSHIRE BASED.', owner: '43WT', ref: '43WT/0661/26', set: '2026-06-02', expires: '2027-06-02' }
    };
    for (const v of vehicles) {
      if (v.keeper && keeperIds[v.vrm]) v.keeper.pncId = keeperIds[v.vrm];
      Object.assign(v, { anpr: anpr[v.vrm] || null, history: [] });
    }

    const property = [
      { propId: '26/4043552Z', category: 'PLANT', itemType: 'DUMPER', make: 'THWAITES', model: '6 TON', colour: 'YELLOW',
        serial: '88922', fleet: 'HF-221', engine: '', cesar: 'CSR8890123', created: '2026-06-24', creator: '43SK', owner: '43BA',
        reports: [{ type: 'LOS', inc: '2026-06-05', owner: '43BA', ref: '43BA/0901/26', text: 'STOLEN FROM BUILDING SITE COMPOUND, LOCK CUT. SITE CCTV SHOWS FLATBED LORRY.' }] },
      { propId: '26/0012345A', category: 'TRAILER', itemType: 'PLANT TRAILER', make: 'IFOR WILLIAMS', model: 'GH126', colour: 'GALVANISED',
        serial: 'SCK60000012345678', fleet: '', engine: '', cesar: '', created: '2026-09-01', creator: '22HR', owner: '22HR',
        reports: [{ type: 'LOS', inc: '2026-08-31', owner: '22HR', ref: '22HR/1120/26', text: 'TAKEN FROM FARMYARD OVERNIGHT. HITCH LOCK FITTED AT TIME.' }] },
      { propId: '25/7711002Q', category: 'ENGINE', itemType: 'OUTBOARD MOTOR', make: 'YAMAHA', model: 'F40', colour: 'GREY',
        serial: '6BG-1023456', fleet: '', engine: '6BG-1023456', cesar: '', created: '2025-07-19', creator: '50FA', owner: '50FA',
        reports: [{ type: 'FOU', inc: '2025-08-02', owner: '50PL', ref: '50PL/7781/25', text: 'RECOVERED FROM LOCK-UP IN PLYMOUTH DURING DRUGS WARRANT.' }] },
      { propId: '26/3300198D', category: 'PLANT', itemType: 'MINI EXCAVATOR', make: 'KUBOTA', model: 'KX016-4', colour: 'ORANGE',
        serial: '50789', fleet: '', engine: 'D782-1234', cesar: 'CSR1234567', created: '2026-10-10', creator: '41WE', owner: '41WE',
        reports: [{ type: 'LOS', inc: '2026-10-09', owner: '41WE', ref: '41WE/2207/26', text: 'STOLEN FROM HIRE DEPOT. TRACKER DISABLED.' }] }
    ];

    const drivers = [
      mkDriver('HUGHES', 'DANIEL MARK', '1988-03-14', 'M', '14 ACACIA AVENUE, ECCLES, SALFORD', 'M30 9XX', 'AM/B/F/K/P/Q', [{ code: 'SP30', date: '2024-02-10', pts: 3 }], null),
      mkDriver('HUGHES', 'SARAH JANE', '1992-11-02', 'F', '7 MILL COURT, HEADINGLEY, LEEDS', 'LS6 9XX', 'AM/B/F/K/P/Q', [{ code: 'DR10', date: '2022-06-25', pts: 0 }], null),
      mkDriver('CARTER', 'LEE ANTHONY', '1990-08-17', 'M', '88 TONBRIDGE ROAD, MAIDSTONE, KENT', 'ME16 8XX', 'AM/A/B/F/K/P/Q',
        [{ code: 'BA10', date: '2025-10-01', pts: 6 }, { code: 'IN10', date: '2025-10-01', pts: 6 }],
        { from: '2025-11-12', to: '2027-11-11', court: 'MEDWAY MAGISTRATES', offence: 'DRIVE WHILST DISQUALIFIED' }),
      mkDriver('GREENE', 'OLIVIA RUTH', '1975-04-03', 'F', '19 PARKSIDE ROAD, CROYDON', 'CR0 1XX', 'AM/B/BE/C1/F/K/P/Q', [], null),
      mkDriver('KHAN', 'IMRAN', '1981-10-27', 'M', '61 VICTORIA STREET, BRISTOL', 'BS1 6XX', 'AM/B/BE/F/K/P/Q', [{ code: 'SP30', date: '2025-05-01', pts: 3 }, { code: 'CU80', date: '2026-01-14', pts: 3 }], null),
      mkDriver('NOWAK', 'TOMASZ', '1985-12-01', 'M', '3 OSPREY CLOSE, BANBURY, OXFORDSHIRE', 'OX16 1XX', 'AM/B/C/CE/F/K/P/Q', [], null)
    ];

    const bulletin = [
      { id: 1, date: '2026-10-15', from: 'PNC BUREAU', text: 'PLANNED MAINTENANCE: PNC SERVICES WILL BE UNAVAILABLE SUNDAY 0200-0400 HRS. USE LOCAL PROCEDURES FOR URGENT CHECKS.' },
      { id: 2, date: '2026-10-01', from: 'PNC BUREAU', text: 'REMINDER: ALL ENQUIRIES MUST STATE THE ORIGINATOR (WHO, WHY, WHERE) AND A VALID NATIONAL REASON CODE. TRANSACTIONS ARE AUDITED.' },
      { id: 3, date: '2026-09-20', from: 'TRAINING', text: 'NEW USERS: USE #MM FOR THE LIST OF TRANSACTIONS AVAILABLE TO YOUR USER-ID. DATA LEFT BLANK DISPLAYS THE FORMATTED SCREEN.' }
    ];

    return { seq: 1000, persons, vehicles, property, drivers, bulletin };
  }

  /* DVLA-style driver number: SURNA + decade + month(+5 F) + day + year + initials + 9 + check */
  function mkDriver(surname, forenames, dob, sex, address, postcode, cats, endorsements, disq) {
    return {
      driverNo: P.driverNo(surname, forenames, dob, sex), surname, forenames, dob, sex, address, postcode,
      categories: cats, issue: '2019-01-01', expiry: '2029-01-01', endorsements, disq
    };
  }
  P.driverNo = function (surname, forenames, dob, sex) {
    const s = (surname.replace(/[^A-Z]/g, '') + '99999').slice(0, 5);
    const [y, m, d] = dob.split('-');
    const mm = String(+m + (sex === 'F' ? 50 : 0)).padStart(2, '0');
    const ini = (forenames.split(' ').map(x => x[0]).join('') + '99').slice(0, 2);
    let h = 0; for (const c of surname + forenames + dob) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const chk = String.fromCharCode(65 + h % 26) + String.fromCharCode(65 + (h >>> 5) % 26);
    return s + y[2] + mm + d + y[3] + ini + '9' + chk;
  };

  function seedUsers() {
    const now = new Date().toISOString();
    return [
      { id: 'ADMIN', pw: 'ADMIN', name: 'SYSTEM ADMINISTRATOR', fs: '99ZZ', role: 'ADMIN', modes: ['LIVE', 'TRNG', 'DEMO'], created: now, lastOn: null, lastOff: null, fails: 0, barred: false },
      { id: 'SECAMB08', pw: 'TW2004', name: 'SEC AMBULANCE', fs: '46KA', role: 'UPD', modes: ['LIVE'], created: now, lastOn: null, lastOff: null, fails: 0, barred: false },
      { id: '99PS5678', pw: 'UPDATE01', name: 'PS 5678 CUSTODY', fs: '99AA', role: 'UPD', modes: ['LIVE', 'TRNG'], created: now, lastOn: null, lastOff: null, fails: 0, barred: false }
    ];
  }

  /* ------------------------------------------------------------------ persistence */

  const KEY = 'pnc.mock.v1';
  let db;

  function fresh() {
    return { version: 1, users: seedUsers(), log: [], term: 'PNCT' + String(1000 + Math.floor(Math.random() * 9000)), modes: {} };
  }

  P.load = function () {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !db.users) db = fresh();
    P.db = db;
    return db;
  };
  P.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage unavailable: session-only */ }
  };
  /* dataset for a mode (LIVE / TRNG / DEMO), seeded on first use */
  P.data = function (mode) {
    if (!db.modes[mode]) { db.modes[mode] = seedData(); P.save(); }
    return db.modes[mode];
  };
  P.resetAll = function () { db = fresh(); P.db = db; P.save(); };
  P.resetMode = function (mode) { db.modes[mode] = seedData(); P.save(); };
  P.replaceDb = function (obj) { db = obj; P.db = db; P.save(); };

})(window.PNC);
