<#
.SYNOPSIS
Restart the OpenClaw Console server

.DESCRIPTION
Stops any process running on port 3000 and starts the server again
#>

# Set output encoding to UTF-8 to fix Chinese character garbling
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

cd $PSScriptRoot
$targetPort = 3000

# Find and kill process using port 3000
Write-Host "Looking for processes using port $targetPort..." -ForegroundColor Blue
$process = Get-Process -Id (Get-NetTCPConnection -LocalPort $targetPort -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue

if ($process) {
    Write-Host "Stopping PID $($process.Id) ($($process.Name))..." -ForegroundColor Yellow
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Waiting 2 seconds for port to release..." -ForegroundColor Blue
    Start-Sleep -Seconds 2
}
else {
    Write-Host "No process found using port $targetPort" -ForegroundColor Blue
}

# Start the server
Write-Host "Starting OpenClaw Console..." -ForegroundColor Yellow
$env:NODE_ENV = "production"
Start-Process -FilePath node -ArgumentList "dist/server/index.js" -WorkingDirectory $PSScriptRoot -NoNewWindow
Write-Host "Server started" -ForegroundColor Green
Write-Host "`nOpen http://localhost:$targetPort in your browser" -ForegroundColor Cyan
