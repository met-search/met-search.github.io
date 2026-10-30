# ViSOR (roleplay mock)

A barebones imitation of the old ViSOR (Violent and Sex Offender Register) web interface: an early-2000s intranet with
Verdana text, a blue gradient top bar and table-based forms. Plain HTML/CSS/JS, no build step.
**All records are fictional, and this is not a real police system.**

## Running

Open `index.html` in a browser, or serve the folder (for example `python -m http.server 8412`).
Data is saved in the browser's localStorage. Use **Generate → Export / Import Database** to move it between machines.

## Accounts

| USERNAME   | PASSWORD     | ACCESS                              |
|------------|--------------|-------------------------------------|
| `ADMIN`    | `ADMIN`      | ADMIN (everything, delete, import)  |
| `HARPER.D` | `VISOR123`   | UPDATE (Police, Thames Valley)      |
| `QUINN.S`  | `PROBATION1` | UPDATE (Probation, Greater Manchester) |
| `VIEWER`   | `VIEWER`     | READ (read-only)                    |

Accounts are defined in `js/data.js` (`ACCOUNTS`). The session times out after 30 minutes without a click or key press.

## Screens

- **Find Nominal**: surname / forename / DOB / ViSOR ref / PNC ID. Names match from the start. `*` and `?` are wildcards, there's an optional Soundex match, and aliases are searched too.
- **Advanced Search**
  - *UK Map*: hover a region to highlight it and its forces, with a tooltip. Click to select or deselect the whole region, or tick single forces. Pick agencies, then **Search For Nominals In Area**.
  - *Scotland Map*: the same, using Police Scotland divisions (matched against the record's *Division / LPA* field).
  - *Find*: detailed criteria (age range, type, risk, MAPPA, markers, VRM, address...). These are combined with the UK Map selection.
  - *Search Grid*: sortable results with CSV export.
- **Nominal record**: header with photo, warning markers and actions (Edit, Add Log Entry, Take Ownership, Generate Report, Archive, Delete for admins only). Tabs cover personal details, addresses, offences and orders, vehicles, associates, risk/MAPPA, and an activity log. Every save is logged automatically.
- **Create / Edit**: validated form with repeatable rows for addresses, offences, vehicles and associates. *Photograph URL* takes any `http(s)` image URL, which suits FiveM mugshot links.
- **My ViSOR**: Diary, To Do list, My Nominals, Generate (printable report, export, import, reset), Statistics, MAPPA Meetings, Find Orphaned (records with no Offender Manager).
- **User Details**: Contact Details, White Pages directory, and the Password Reset and Move User request forms, which are cosmetic.

## Files

- `index.html`: the logon screen and the app frame (top bar, sidebar)
- `css/visor.css`: the whole look
- `js/data.js`: reference tables (regions/forces, agencies, types, markers), accounts, fictional seed records, and the `VisorStore` storage layer
- `js/map.js`: the hand-drawn SVG maps (stylised, not survey-accurate)
- `js/app.js`: logon, session timer, the hash router and every screen

## FiveM notes

Everything reads and writes through `VisorStore` in `js/data.js`. To share one database across players, replace the
`read` / `write` functions there with NUI callbacks (`fetch('https://<resource>/visor:save', …)`) to a server-side store
(oxmysql etc.). Nothing else in the app touches localStorage directly. The store is synchronous, so the simplest approach is
to fetch the full list once at logon into the cache and send each `save` / `remove` to the server in the background.
