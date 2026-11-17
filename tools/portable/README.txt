HOI4 IC GRAPHS (portable)
No git, Python or install needed. Unzip anywhere and use.

WHAT IS IN HERE
  bar_charts.html          The charts. Opens in any browser, works offline, nothing is uploaded.
  HOI4_Analyzer\           The IC collector (HOI4 IC Analyzer v3.1.0 by zVSciy, third party).
  DataCollection\          Collector DLLs for game versions the analyzer does not ship (1.19.4 fixed, 1.19.5).
  convert_saves.bat        Turns a folder of saves (for example monthly autosaves) into an IC log. Needs Node.js.
  converter\               The scripts convert_saves.bat uses.
  logs\                    Example log. Converted logs land here too.

COLLECT IC FROM A GAME
  1. Start HOI4_Analyzer\HOI4_Analyzer.exe and leave it open.
  2. Start the game (vanilla or any mod). Collection starts once the game has loaded.
  3. The log is written as output_<date>.txt in the HOI4 game folder,
     for example C:\Program Files (x86)\Steam\steamapps\common\Hearts of Iron IV

  Game version not supported yet? In the analyzer open Settings > DataCollection DLLs > Add DLL
  and pick the matching file from the DataCollection folder (for example DataCollection_1.19.5.dll).
  The file name must stay DataCollection_<version>.dll.

VIEW THE CHARTS
  Open bar_charts.html and load a log (.txt) from the game folder or the logs folder.

LOGS FROM SAVES (no collector needed)
  Install Node.js (https://nodejs.org), then drag a folder of .hoi4 saves onto convert_saves.bat.
  Only saves dated the 1st of a month are used, so monthly autosaves work best.
  The result goes to logs\<folder name>_daily.txt. Zipped ironman saves are not supported.

NOTES
  The analyzer is proprietary software (source is private), included unmodified from
  https://github.com/zVSciy/Hoi4GraphToolReleases/releases/tag/v3.1.0
  It injects a DLL into hoi4.exe to read IC, so some antivirus tools may flag it.
  Source and full history: https://github.com/otti086-Org/HOI4-IC-Graphs
