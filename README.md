NOTE: This repository uses Git LFS. Downloading the .zip file from GitHub will not work, you need to clone the git.

NO GIT? Use HOI4-IC-Graphs-portable.zip (about 19 MB) instead. It has everything below and needs no git or install. Unzip it and read README.txt inside.
To build it from a clone: pwsh tools\build_portable.ps1 (the zip is written to dist\).

HOW TO USE:
1. Clone the Git with Github Desktop (downloading the .zip does not work)
2. Start HOI4_Analyzer.exe and leave it open
3. Start hoi4 (works with vanilla and all mods). The analyzer picks the DLL that matches the game version and starts collecting once the game has loaded.
4. While the game runs, a log file (output_<date>.txt) is written to the hoi4 game folder, e.g. C:\Program Files (x86)\Steam\steamapps\common\Hearts of Iron IV
5. Open bar_charts.html in a browser and load the log (from the game folder or the logging folder).

NEW GAME VERSION?
The analyzer only starts with a DLL made for the exact game version, and it ships DLLs up to 1.19.4.
Newer versions are in the DataCollection folder next to HOI4_Analyzer.exe (1.19.5 and 1.20.0.0). The analyzer lists every DLL in that folder, so there is nothing to add; with "auto select version" on it picks the one matching the game.
Each game build moves the addresses the DLL hooks, so a DLL only works for the exact version in its file name. DataCollection_1.19.4.dll is the fixed 1.19.4 build (the older one crashed on the first day tick on 1.19.4.2). DataCollection_1.20.0.0.dll is the 1.19.5 DLL with the four addresses (GetLongString, CGStateDate, CountryDataBase, CGameStateDailyUpdate) changed to the 1.20.0.0 ones; see docs/dll_offsets.md.

ABOUT THE ANALYZER
HOI4_Analyzer.exe is HOI4 IC Analyzer v3.1.0 by zVSciy, included unmodified. It is third-party, proprietary software (the source is private) from https://github.com/zVSciy/Hoi4GraphToolReleases/releases/tag/v3.1.0
   SHA256 of HOI4_Analyzer_Rust_v3.1.0.zip: FEA03276DB2BAE2AF3C1714C2E01FB6FBD7C3489DDE79915E56003B2CEDBC0EA
   SHA256 of HOI4_Analyzer.exe: 88E8675DD6C13BBDC97C0C55497F3722F5D24073CC8F00CA7254F1F5AC74FFF3
Its own manual is docs/HOI4_Analyzer.md. It replaces the old gui.exe collector (removed here; it is still in upstream and in this repo's history).

FOLDERS
  bar_charts.html     the charts (single offline file)
  HOI4_Analyzer.exe   the IC collector
  DataCollection      DLLs for game versions the analyzer does not ship
  converter           saves_to_log.js: turn a folder of saves into a log (node converter/saves_to_log.js <folder> --daily)
  ic_calculator       IC Calculator source; after editing, run node ic_calculator/inject_ic.js to rebuild bar_charts.html
  logging             saved logs
  docs                the analyzer manual
  tools               build_portable.ps1 and dev scripts

https://github.com/otti086-Org/HOI4-IC-Graphs
