$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
node "$Root/openapi-diff.mjs" @args
exit $LASTEXITCODE
