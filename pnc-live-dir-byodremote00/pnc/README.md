# PNC Terminal (roleplay mock)

A barebones, green-screen imitation of the old Police National Computer, for roleplay.
Plain HTML/CSS/JS, no build step. **All records are fictional, and this is not a real police system.**

## Running

Open `index.html` in a browser, or serve the folder (for example `python -m http.server 8411`).
Data is saved in the browser's localStorage. Each mode (LIVE / TRNG / DEMO) has its own copy of the files.

## Accounts

| USER-ID    | PASSWORD   | TRANSACTION SET        | MODES          |
|------------|------------|------------------------|----------------|
| `ADMIN`    | `ADMIN`    | ADMIN (everything)     | LIVE TRNG DEMO |
| `99PC1234` | `TRAINING` | ENQ (enquiries only)   | TRNG LIVE      |
| `99PS5678` | `UPDATE01` | UPD (enquiry + update) | LIVE TRNG      |

Three wrong passwords bar a non-admin user-id. Admin can unbar it with `#SP`. To change your password, fill in NEW PASSWORD at logon (8 characters, letters and numbers).

## Using it

At the bottom of the screen, fill in **TCODE** (for example `#NE`), **ORIG** (who, why and where, at least 4 characters) and **REASON** (national reason code 0-9). Optionally fill in **DATA**, then press **Enter**.
If you leave DATA blank, you get the formatted input screen. `PTR` = `Y` prints the result.

Keys: Enter = SEND, Esc = CLEAR, PgDn/F8 and PgUp/F7 = page, F1 = menu, F6 = show/hide photograph, F9 = print, F12 = logoff, Up/Down = move between fields.

The host takes a moment to answer (TRANSACTION IN PROGRESS...). Turn this off in View > Response delay on/off.

Updates need the **PNCID + CHECKNAME (surname)**, as the real system did. The last record you viewed fills in the PNCID automatically.

## Transactions

`#MM` lists everything your user-id can run. The main ones are:

- **Names:** `#NE` enquiry (`SURNAME/FORENAME/DDMMYYYY/SEX`, a `*` prefix search, or a PNCID/CRO), `#NQ` cut-down, `#NO` wanted/missing list, `#QE` QUEST descriptive search (sex, age and height range, IC code, hair, tattoo words, area, warning signal), `#NU` create person, `#NN` descriptive details plus DNA/fingerprint status, `#NA` address, `#NM` marks/scars, `#NP` photograph (link or upload), `#FA` firearms certificate, `#NW` warning signals, `#NI` information markers, `#NB` delete (admin)
- **Wanted/Missing and OI:** `#WI` add, `#WA` amend, `#WR` retain, `#WD` delete, `#OI` operational information (orders, bail etc.)
- **Arrest/Court:** `#AU` arrest/summons (creates an impending prosecution), `#CU` result an A/S, `#CI` add a conviction directly, `#CD` caution / PND / community resolution (can close an A/S instead of court)
- **Vehicles:** `#VE` full, `#VK` basic, `#VP` partial VRM (`?` / `*`), `#VC` chassis, `#VO` description/owner search, `#VU` add/delete reports (LOS FOU ACT INF ...), `#VY` create, `#VT` change of keeper (link to a PNCID), `#VZ` delete (admin), `#RE` ANPR hotlist, `#RU` set/delete an ANPR marker (STOP / INFORM / INTEL / NOACT)
- **Drivers:** `#DL` enquiry, `#D0` create licence, `#DA` endorsements, `#DI` / `#DD` disqualification
- **Property:** `#PE` / `#PI` enquiry, `#PS` descriptive search, `#PU` create/update
- **General:** `#BB` bulletin board, `#QF` force codes, `#QN` names tables, `#VQ` vehicle tables and reason codes, `#CL` clear, `#XX` logoff
- **Admin:** `#SA` account manager (below), `#SC` quick create/amend/delete of user-ids, `#SD` list, `#SE` show, `#SP` reset password/unbar, `#SU` unused ids, `#TE` transaction log search, `#BU` bulletin update
- **Simulator extras:** `#ZR` reset current mode to seed data, `#ZX` export the database, `#ZI` import it (also under the Host menu)
- **Record builder (`#ZZ`, admin only):** a step-by-step wizard for building a whole new **person** (identity, IC code, description, aliases, marks, addresses, warning signals, markers, wanted/missing, operational info, arrests, convictions, cautions/PNDs, DNA/fingerprints, photo link, firearms certificate, optional driving licence), **vehicle** (details, tax/MOT/insurance, keeper linked by PNCID, reports, ANPR marker) or **property** item (details, reports). On every step, N = next, B = back and Q = quit. Repeating steps take `Y` in ADD ANOTHER, or can be left blank to skip. You review the finished record before saving. Use DATA `PERSON`, `VEHICLE` or `PROPERTY` to jump straight in.

Try these: `#NE` with `HUGHES`, `#VE` with `MA68KTR`, `#RE`, `#NO`, `#QE` with marks `TATTOO ROSE`, `#PE` with `26/4043552Z`, `#DL` with `CARTER/LEE`.

## Account manager (`#SA`, admin only)

`#SA` lists every user-id. Pick a number to manage one, or the last number to create a new account. DATA `NEW` goes straight to create, and DATA `<USER-ID>` opens that account. Each account has:

- **Details:** name/rank, force/station, base set (ENQ, UPD or ADMIN), modes (LIVE TRNG DEMO), an optional expiry date, and notes.
- **Password/login:** rename the user-id, set a new password (4-8 letters/numbers), force a change at next logon, and bar or unbar the account.
- **Permissions:** a colour grid of every code (from base set / added / removed / not available). ALLOW and BLOCK take codes (`#VU #RU`) or whole categories (`NAMES VEHICLES DRIVERS WANTED ARREST PROPERTY GENERAL ACCESS SIMULATOR`, or `ALL`). RESET goes back to the plain base set. `#MM`, `#CL` and `#XX` can never be blocked.
- **Activity:** that user's last 300 transactions.
- **Delete:** type the user-id to confirm.

When creating an account, COPY PERMS FROM copies another user's added and removed codes. You can't bar, expire, delete, or remove ADMIN or `#SA` from the account you're logged on with.

## Record features

- **Warning lines** at the very top of a person record: wanted/missing, warning signals, firearms certificate, sex offender, disqualified driver, operational information, impending prosecution, DNA required. Vehicles show the ANPR marker, lost/stolen, and the linked keeper's warnings.
- **Links between records:** person records list their driving licence and the vehicles they keep. Vehicles show the keeper's PNCID. Driver records show the matching PNCID. Keepers link by PNCID, or by an exact name match.
- **Update history:** every change records the date, time, user-id, station, code and what changed. The last 10 changes show at the end of each record.
- **Photographs:** `#NP` takes a web link, a file in this folder (for example `photos/hughes.jpg`), or an uploaded image. Uploaded images are shrunk and saved in the browser with the record. Browser storage holds about 5 MB, enough for roughly 150 uploaded photos.

New seed details only appear after `#ZR` (or Host > Reset database), because existing saved data is kept.

## Files

- `index.html`: the page frame (title bar, screen, command line, function keys)
- `css/pnc.css`: the phosphor look. View menu: green/amber/white, scanlines, text size
- `js/data.js`: code tables, fictional seed records and storage
- `js/terminal.js`: screen engine, forms, paged reports, logon, keyboard and audit log
- `js/builder.js`: the `#ZZ` record builder
- `js/accounts.js`: the `#SA` account manager
- `js/transactions.js`: every transaction code. To add one, call `reg('#XX', 'DESCRIPTION', 'ENQ'|'UPD'|'ADMIN', 'CATEGORY', data => screen)`
