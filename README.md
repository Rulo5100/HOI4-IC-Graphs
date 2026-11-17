NOTE: This repository uses Git LFS. Downloading the .zip file will not work, you always need to clone the git. 

HOW TO USE:
1. Clone the Git with Github Desktop (dowloading .zip does not work)
2. Start hoi4 (works with Vanilla and all mods)
3. Start gui.exe and select the hoi4 version you are using and press "Start Data Collection"
4. When the game is running a file with data will be created in the hoi4 base game folder e.g. C:\Program Files (x86)\Steam\steamapps\common\Hearts of Iron IV
5. Within the GUI select the .txt file to load and graph data.
     "Individual IC (File 1)" - graphs one line for each country selected, no matter the faction
     "Factions IC (File 1)" - graphs one line for each faction, adds up the countries
     "Compare Individual IC (Files 1 & 2)" - select two .txt files, compare countries from different games
     "Compare Faction IC (Files 1 & 2)" - select two .txt files, compare factions from different games


ALTERNATIVE COLLECTOR: HOI4 IC Analyzer (zVSciy), v3.1.0
The analyzer replaces gui.exe for collecting data. It injects the same DataCollection DLL into hoi4.exe and writes the same output.txt into the HOI4 game folder, so bar_charts.html reads its files unchanged.
1. The v3.1.0 exe is included in the HOI4_Analyzer folder, unmodified. It is third-party, proprietary software (the source is private) from https://github.com/zVSciy/Hoi4GraphToolReleases/releases/tag/v3.1.0
   SHA256 of HOI4_Analyzer_Rust_v3.1.0.zip: FEA03276DB2BAE2AF3C1714C2E01FB6FBD7C3489DDE79915E56003B2CEDBC0EA
   SHA256 of HOI4_Analyzer.exe: 88E8675DD6C13BBDC97C0C55497F3722F5D24073CC8F00CA7254F1F5AC74FFF3
2. Start HOI4_Analyzer.exe and leave it open, then start the game. It picks the DLL that matches the game version and starts collecting after the game has loaded.
3. Open bar_charts.html and load output.txt from the game folder (or a file from the logging folder).
It only starts with a DLL made for the exact game version. For a version it does not ship (it has DLLs up to 1.19.4), use Settings > DataCollection DLLs > Add DLL and pick a file named DataCollection_<version>.dll, for example _internal/DataCollection/DataCollection_1.19.5.dll from this repository.

https://github.com/otti086-Org/HOI4-IC-Graphs
