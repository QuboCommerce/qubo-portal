# qd launcher (Windows PowerShell). Local mode only: services run in this terminal.
& node "$PSScriptRoot/qd.mjs" @args
exit $LASTEXITCODE
