# DataCollection DLL offsets per game version

Each DataCollection DLL exports four 8-byte variables. They hold addresses (RVAs) inside `hoi4.exe`, and a new game build moves them. If they are stale the game crashes on the first day tick. To make a DLL for a new version, copy the previous DLL, change these four values and name the file `DataCollection_<version>.dll`.

| Export | What it points at | 1.19.4 / 1.19.5 | 1.20.0.0 |
|---|---|---|---|
| GetLongString_offset | function that formats the date ("%d:00, %d %s, %d") | 0x57a230 | 0x57b3f0 |
| CGStateDate_offset | global CGameState pointer | 0x33dd6b0 | 0x33e3b30 |
| CountryDataBase_offset | global pointer to the country tag vector (32-byte entries) | 0x33df288 | 0x33e5708 |
| CGameStateDailyUpdate_offset | function that logs "gamestate.daily" (the hook target) | 0x1eae60 | 0x1eafe0 |

The values sit in the DLL's .data section. File offsets in the current DLLs: 0xE1810, 0xE1818, 0xE1820, 0xE1828 (in the order of the table). Resolve them from the export table rather than trusting these numbers.

## How to find them in a new hoi4.exe

1. GetLongString: find the string ` %d:00, %d %s, %d`, take the function that references it.
2. CGStateDate: find the call sites of GetLongString. The caller loads a global, adds 0x460 and passes it as the first argument. That global is CGStateDate.
3. CountryDataBase: the game's id lookup (it returns `[CGameState + 0x358] + id * 32`) falls back to a global G when there is no game state. The fallback calls a small helper that returns `[vec] + id * 32` after a bounds check against `[vec + 0xc]`, with vec being the value stored at G. That G is the DLL's variable.
4. CGameStateDailyUpdate: find the string `gamestate.daily`, take the function that references it.

Struct offsets the DLL reads (state +0x310 countries, country +8 id and +0xf68 production container, line +0x88 -> +0x408 flags) were still in use unchanged in 1.20.0.0. The speed field at line +0x30 has not been confirmed statically.

## Status

1.20.0.0: addresses found and cross-checked statically, not yet run in game. Check the first rows of a new log against a monthly autosave converted with `converter/saves_to_log.js`.
