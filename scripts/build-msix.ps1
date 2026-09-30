$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $projectRoot "release-msix"
$mappingFile = Join-Path $outputDirectory "__appx-x64\mapping.txt"
$packageJson = Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw | ConvertFrom-Json
$packageFile = Join-Path $outputDirectory "Avatar-Forge-Windows-$($packageJson.version)-x64.msix"

Push-Location $projectRoot
try {
    & pnpm exec electron-builder --win appx --x64 --publish never

    if (-not (Test-Path -LiteralPath $mappingFile)) {
        throw "Electron Builder did not create the MSIX mapping file."
    }

    $makeAppx = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter makeappx.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "\\x64\\makeappx\.exe$" } |
        Sort-Object FullName -Descending |
        Select-Object -First 1

    if (-not $makeAppx) {
        throw "MakeAppx was not found. Install the Windows SDK before building the MSIX package."
    }

    & $makeAppx.FullName pack /o /f $mappingFile /p $packageFile
    if ($LASTEXITCODE -ne 0) {
        throw "MakeAppx failed with exit code $LASTEXITCODE."
    }

    Write-Host "MSIX package created: $packageFile"
}
finally {
    Pop-Location
}
