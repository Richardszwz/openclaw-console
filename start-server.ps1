
# Set output encoding to UTF-8 to fix Chinese character garbling
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

cd $PSScriptRoot
$env:NODE_ENV = "production"
node dist/server/index.js
