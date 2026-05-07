param(
    [string]$Version = "0.2.0",
    [string]$RepoOwner = "srackalica",
    [string]$RepoName = "GSecurity-Ad-Shield",
    [string]$ExtensionId = "",
    [string]$KeyPath = ".\keys\gsecurity-ad-shield.pem",
    [switch]$SkipCrx
)

$ErrorActionPreference = "Stop"

function Get-BrowserPacker {
    $candidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
        "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $projectRoot "manifest.json"
$distDir = Join-Path $projectRoot "dist"
$keysDir = Split-Path -Parent (Join-Path $projectRoot $KeyPath)
$resolvedKeyPath = Join-Path $projectRoot $KeyPath

if (-not (Test-Path $manifestPath)) {
    throw "manifest.json not found in $projectRoot"
}

$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
$manifest.version = $Version
($manifest | ConvertTo-Json -Depth 50) | Set-Content -Encoding utf8 $manifestPath

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}

if (-not (Test-Path $keysDir)) {
    New-Item -ItemType Directory -Path $keysDir | Out-Null
}

$crxName = "gsecurity-ad-shield-$Version.crx"
$zipName = "gsecurity-ad-shield-$Version.zip"
$crxPath = Join-Path $distDir $crxName
$zipPath = Join-Path $distDir $zipName

$tmpPackageDir = Join-Path $distDir "package-$Version"
if (Test-Path $tmpPackageDir) {
    Remove-Item -Recurse -Force $tmpPackageDir
}
New-Item -ItemType Directory -Path $tmpPackageDir | Out-Null

$include = @("manifest.json", "background.js", "content.js", "content-sites.js", "content-generic.js", "main-world.js", "rules.json", "icons")
foreach ($entry in $include) {
    $source = Join-Path $projectRoot $entry
    if (Test-Path $source) {
        Copy-Item -Path $source -Destination $tmpPackageDir -Recurse -Force
    }
}

if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $tmpPackageDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

if (-not $SkipCrx) {
    $packer = Get-BrowserPacker
    if (-not $packer) {
        Write-Warning "No Chromium browser found for --pack-extension. CRX not built."
    }
    else {
        $packArgs = @("--pack-extension=$tmpPackageDir")
        if (Test-Path $resolvedKeyPath) {
            $packArgs += "--pack-extension-key=$resolvedKeyPath"
        }

        & $packer @packArgs

        $generatedCrx = "$tmpPackageDir.crx"
        $generatedPem = "$tmpPackageDir.pem"

        if (Test-Path $generatedCrx) {
            Move-Item -Force $generatedCrx $crxPath
        }
        else {
            Write-Warning "Browser pack command finished but no CRX was produced."
        }

        if ((-not (Test-Path $resolvedKeyPath)) -and (Test-Path $generatedPem)) {
            Move-Item -Force $generatedPem $resolvedKeyPath
        }
        elseif (Test-Path $generatedPem) {
            Remove-Item -Force $generatedPem
        }
    }
}

$releaseCrxUrl = "https://github.com/$RepoOwner/$RepoName/releases/download/v$Version/$crxName"
$updateXmlUrl = "https://raw.githubusercontent.com/$RepoOwner/$RepoName/main/update.xml"

if (-not [string]::IsNullOrWhiteSpace($ExtensionId)) {
    $updateXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="$ExtensionId">
    <updatecheck codebase="$releaseCrxUrl" version="$Version" />
  </app>
</gupdate>
"@
    Set-Content -Path (Join-Path $projectRoot "update.xml") -Value $updateXml -Encoding utf8

    $regContent = @"
Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\Software\Policies\Google\Chrome\ExtensionInstallForcelist]
"1"="$ExtensionId;$updateXmlUrl"

[HKEY_LOCAL_MACHINE\Software\Policies\BraveSoftware\Brave\ExtensionInstallForcelist]
"1"="$ExtensionId;$updateXmlUrl"

[HKEY_LOCAL_MACHINE\Software\Policies\Microsoft\Edge\ExtensionInstallForcelist]
"1"="$ExtensionId;$updateXmlUrl"
"@
    Set-Content -Path (Join-Path $projectRoot "Install.reg") -Value $regContent -Encoding ascii
}
else {
    Write-Warning "ExtensionId is empty. Keeping existing update.xml and Install.reg unchanged."
}

Write-Host ""
Write-Host "Release artifacts:"
Write-Host " - ZIP: $zipPath"
if (Test-Path $crxPath) { Write-Host " - CRX: $crxPath" }
if (Test-Path $resolvedKeyPath) { Write-Host " - PEM: $resolvedKeyPath" }
Write-Host " - update.xml: $(Join-Path $projectRoot "update.xml")"
Write-Host " - Install.reg: $(Join-Path $projectRoot "Install.reg")"

