$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$Mvn = if (Get-Command mvn -ErrorAction SilentlyContinue) { "mvn" }
       elseif (Test-Path "$Root\..\.tools\apache-maven-3.9.9\bin\mvn.cmd") { "$Root\..\.tools\apache-maven-3.9.9\bin\mvn.cmd" }
       else { throw "Maven not found. Install Maven 3.9+ or run from a repo with .tools/apache-maven." }

Write-Host "Building insurance service modules..."
& $Mvn -q clean package -DskipTests

$AppsDir = Join-Path (Split-Path -Parent $Root) "apps"
New-Item -ItemType Directory -Force -Path $AppsDir | Out-Null

Copy-Item "$Root\app-legacy\target\insurance-legacy.jar" "$AppsDir\insurance-legacy.jar" -Force
Copy-Item "$Root\app-modern\target\insurance-modern.jar" "$AppsDir\insurance-modern.jar" -Force
Copy-Item "$AppsDir\insurance-legacy.jar" "$AppsDir\insurance-j8.jar" -Force
Copy-Item "$AppsDir\insurance-legacy.jar" "$AppsDir\insurance-j11.jar" -Force
Copy-Item "$AppsDir\insurance-modern.jar" "$AppsDir\insurance-j17.jar" -Force
Copy-Item "$AppsDir\insurance-modern.jar" "$AppsDir\insurance-j21.jar" -Force

Write-Host "Artifacts written to $AppsDir"
Get-ChildItem "$AppsDir\*.jar"
