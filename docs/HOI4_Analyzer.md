# HOI4 Analyzer GUI

## About the Project

The HOI4 Analyzer GUI is a desktop application developed to facilitate the analysis of save games or other data for the game Hearts of Iron IV.

## Purpose of This Repository

This repository serves **exclusively** as the official distribution point for the **publicly available builds (releases)** of the HOI4 Analyzer GUI application.

**It does NOT contain the source code of the application.** The source code is managed in a separate, private repository.

## Downloading the Software

You can download the latest version of the HOI4 Analyzer GUI from the **[Releases section](https://github.com/zVSciy/Hoi4GraphToolReleases/releases)** of this repository.

1.  Go to the [**Releases**](https://github.com/zVSciy/Hoi4GraphToolReleases/releases) tab (or click the link above).
2.  Find the latest release (usually the top entry).
3.  Expand the "Assets" section for the release.
4.  Download the executable file (e.g., `HOI4_Analyzer.exe` for Windows).

## How to Use the Application

### The Easy Way: Automatic Mode

1. **Launch** `HOI4_Analyzer.exe` and leave it open.
2. **Start Hearts of Iron IV** and play.

That's it. The analyzer notices the game, reads its version, picks the matching DataCollection DLL, starts data collection once the game has loaded (30 seconds by default), and opens the **Live Dashboard**. Your game is saved in the **Game Library** while you play, so nothing is lost when you close the game.

Every step can be switched off or adjusted in **Settings** (see below). The main window always shows whether HOI4 is running and whether a DLL exists for its version.

> **New HOI4 version?** If the analyzer says there is no DataCollection DLL for your game version, get the DLL for that version and add it in **Settings → DataCollection DLLs → Add DLL…**. No new app download is needed. For safety, data collection only ever starts with a DLL made for your exact game version.

### Starting Data Collection by Hand

1. Choose your Hearts of Iron IV version under **Version**.
2. Click **Start Data Collection** while the game is running.

### Loading Data

DataCollection writes `output.txt` into your **HOI4 game folder**.
- **Browse File 1… / File 2…** opens directly in that folder.
- You can also drag one or two files onto the window, or pass them on the command line (`HOI4_Analyzer.exe output.txt [second.txt]`).

### Viewing Graphs

1. **Choose countries:** tick the countries to chart, or use **Toggle All** per column. Countries are shown with the names from your HOI4 installation, and your choice is remembered for next time.
2. **Open a graph:** **Individual IC** draws one line per country; the **Factions** buttons add countries up per faction (or per your own groups, see Settings). The **Compare** buttons put Data File 1 and 2 side by side.

Every graph window has a tab per value the game logs:
- **Military IC** (military factory output)
- **Naval IC** (dockyard output)
- **Civilian IC** (civilian factory output; recorded by DataCollection 1.19.3 and newer, the tab is hidden for older files)

Each tab shows the daily value and the running total. In the toolbar:
- **Smoothing** (7 to 90-day average) hides day-to-day noise in the daily values.
- **Share %** shows each line as a percentage of all visible lines, for example the Axis vs Allies balance over time. Hide lines in the legend to compare fewer.

Click a country in the legend to show or hide it in every tab, drag to pan, scroll to zoom and double-click to reset. Each country keeps the same colour in every graph.

### Rankings

**Rankings** lists every country on any date, ordered by military, naval, civilian or combined output, with its share of the world total. Choose a date with the slider, show that day's value (optionally averaged over several days) or the total so far, and pick the data source: Data File 1 or 2, the live game, or games ticked in the library.

### Exporting Graphs

Every graph window has export buttons:
- **Export HTML…** saves one interactive page with all tabs. It opens in any browser and can be shared.
- **Export CSV…** saves the raw numbers (`date, series, metric, daily, cumulative`) for Excel, LibreOffice or pandas.
- **Save PNG…** saves an image of the current tab.
- **Open in Browser** shows the interactive page right away.

### Game Library: Compare Your Past Games

Your games are saved in the **Game Library** automatically, with nothing to do by hand:
- every file you load as Data File 1 or 2 is stored right away,
- while the **Live Dashboard** monitors a running game, it is saved every 30 seconds and once more when monitoring stops or the app closes.

Open it with **Game Library**.
- **Nothing is stored twice.** Saving `output.txt` again after playing further updates that game instead of creating a new entry. A new campaign becomes a new game.
- **At a glance:** every game shows its dates, countries, the top military producer and the total military output.
- **Name, version and notes** can be edited directly in the list. New games get the HOI4 version selected in the main window.
- **Search and version filter** narrow the list, for example to games played on 1.19.4.
- **Compare games:** tick two or more games, tick countries in the main window (the countries of the ticked games are added there), then press **Countries** or **Factions**. Each line is labelled with its game, e.g. `Germany (Game #3)`. Tick **Align by day since start** to compare games that began at different dates (e.g. 1936 and 1939).
- **Actions** on a game: load it as Data File 1 or 2, **Export…** it as a `.hoi4game` file to share with friends, or delete it. **Import…** adds games others exported.
- Games are stored already parsed and compressed, so opening an old game is instant and the original `output.txt` is not needed any more.

The library is a single file, `%LOCALAPPDATA%\HOI4_Analyzer\library.sqlite3` (**Open Folder** in the library window shows it). Back it up by copying that file.

### Live Dashboard

The **Live Dashboard** follows `output.txt` while you play; only newly written data is read on each check, so the graphs stay current even late in a long campaign. Automatic mode opens it for you; otherwise open it and click **Start Live Monitoring**. If no countries are ticked, it shows the ten biggest producers.

### Settings

**Settings** in the main window holds every option; changes apply immediately and are remembered.
- **HOI4 & Data Collection:** watch for the game, pick the matching DLL version, start collection automatically (and how long to wait after the game starts), open the live dashboard automatically, and where DataCollection writes its file.
- **DataCollection DLLs:** all available versions and where each comes from (built in, added by you, or in a `DataCollection` folder next to the app). **Add DLL…** adds the DLL for a new game version; the version is read from a file name like `DataCollection_1.19.5.dll`. Added DLLs can be removed again.
- **Game Library & Live Dashboard:** automatic saving, how often the live file is checked, and how often a running game is saved.
- **Graphs:** country names or tags, same colour per country, default smoothing.
- **Country Groups:** keep Axis and Allies, or define your own groups (e.g. multiplayer teams: "Team 1: GER ITA JAP"). Groups decide the columns of the main window and what the Factions buttons add up.
- **Updates:** check for a new release on start (only a notice; nothing is downloaded automatically).

### Advanced: Storage Locations

Everything is kept in `%LOCALAPPDATA%\HOI4_Analyzer\`: `library.sqlite3` (game library), `settings.json` (settings) and `DataCollection\` (DLLs you added). To keep the library or settings elsewhere, for example in a synced folder, set the environment variable `HOI4_ANALYZER_LIBRARY` or `HOI4_ANALYZER_SETTINGS` to the full path of the file to use.

## Verification

Each release includes a **SHA256 hash** in the release description for security verification. You can verify the integrity of the downloaded file by comparing its SHA256 hash with the one provided in the release notes.

