# Builds dist\HOI4-IC-Graphs-portable.zip: a lean copy that works without git, LFS or Python.
#   pwsh tools\build_portable.ps1 [-OutDir dist] [-NoExample]
param(
    [string]$OutDir = "dist",
    [switch]$NoExample
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not [IO.Path]::IsPathRooted($OutDir)) { $OutDir = Join-Path $root $OutDir }
$name = "HOI4-IC-Graphs-portable"
$stage = Join-Path $OutDir $name
$zip = Join-Path $OutDir "$name.zip"

# source -> destination inside the package
$files = [ordered]@{
    "bar_charts.html"                                  = "bar_charts.html"
    "LICENSE.txt"                                      = "LICENSE.txt"
    "HOI4_Analyzer.exe"                                = "HOI4_Analyzer.exe"
    "docs\HOI4_Analyzer.md"                            = "docs\HOI4_Analyzer.md"
    "DataCollection\DataCollection_1.19.4.dll"         = "DataCollection\DataCollection_1.19.4.dll"
    "DataCollection\DataCollection_1.19.5.dll"         = "DataCollection\DataCollection_1.19.5.dll"
    "converter\saves_to_log.js"                        = "converter\saves_to_log.js"
    "converter\hoi4_bin2txt.js"                        = "converter\hoi4_bin2txt.js"
    "converter\hoi4_tokens.json"                       = "converter\hoi4_tokens.json"
    "tools\portable\README.txt"                        = "README.txt"
    "tools\portable\convert_saves.bat"                 = "convert_saves.bat"
}
$example = "logging\monthly_saves_1936-01_to_1942-10_daily.txt"
if (-not $NoExample) {
    if (Test-Path (Join-Path $root $example)) { $files[$example] = "logs\example_monthly_saves_1936-1942_daily.txt" }
    else { Write-Warning "no example log ($example), building without one" }
}

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }

foreach ($src in $files.Keys) {
    $from = Join-Path $root $src
    if (-not (Test-Path $from)) { throw "missing: $src" }
    # A file that was never pulled from Git LFS is a small text pointer, not the real file.
    $fs = [IO.File]::OpenRead($from); $head = New-Object byte[] 40; $n = $fs.Read($head, 0, 40); $fs.Close()
    if ([Text.Encoding]::ASCII.GetString($head, 0, $n).StartsWith("version https://git-lfs")) {
        throw "$src is a Git LFS pointer. Run 'git lfs pull' first."
    }
    $to = Join-Path $stage $files[$src]
    New-Item -ItemType Directory -Force (Split-Path -Parent $to) | Out-Null
    Copy-Item $from $to
}
# the bat needs CRLF to run reliably in cmd
$bat = Join-Path $stage "convert_saves.bat"
$txt = [IO.File]::ReadAllText($bat) -replace "`r?`n", "`r`n"
[IO.File]::WriteAllText($bat, $txt)
$rd = Join-Path $stage "README.txt"
[IO.File]::WriteAllText($rd, ([IO.File]::ReadAllText($rd) -replace "`r?`n", "`r`n"))
New-Item -ItemType Directory -Force (Join-Path $stage "logs") | Out-Null

Compress-Archive -Path $stage -DestinationPath $zip -CompressionLevel Optimal
$staged = (Get-ChildItem $stage -Recurse -File | Measure-Object Length -Sum).Sum
$z = Get-Item $zip
"{0}`n  unpacked {1:N1} MB, zip {2:N1} MB`n  SHA256 {3}" -f $z.FullName, ($staged / 1MB), ($z.Length / 1MB), (Get-FileHash $zip -Algorithm SHA256).Hash
