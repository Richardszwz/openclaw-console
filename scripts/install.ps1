<#
.SYNOPSIS
Installation script for OpenClaw Console on Windows

.DESCRIPTION
Installs all dependencies and sets up the OpenClaw Console project
#>

Write-Host "🚀 Starting OpenClaw Console installation..." -ForegroundColor Cyan

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js $nodeVersion found" -ForegroundColor Green
}
catch {
    Write-Host "❌ Node.js not found. Please install Node.js from https://nodejs.org/ first." -ForegroundColor Red
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "✅ npm $npmVersion found" -ForegroundColor Green
}
catch {
    Write-Host "❌ npm not found. Please check your Node.js installation." -ForegroundColor Red
    exit 1
}

# Create data directory if it doesn't exist
if (-not (Test-Path "data")) {
    Write-Host "📁 Creating data directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path data | Out-Null
}

# Install root dependencies
Write-Host "📦 Installing root dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install root dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Root dependencies installed" -ForegroundColor Green

# Install frontend dependencies
Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location src/frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
Set-Location ../..

# Copy environment example if .env doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "⚙️ Creating .env file from example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✅ .env file created. Please edit it with your configuration." -ForegroundColor Green
}

# Build the project
Write-Host "🏗️ Building the project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build completed successfully" -ForegroundColor Green

Write-Host "`n🎉 OpenClaw Console installation completed!" -ForegroundColor Cyan
Write-Host "`nTo start the server:" -ForegroundColor White
Write-Host "  npm start" -ForegroundColor Yellow
Write-Host "`nTo run in development mode:" -ForegroundColor White
Write-Host "  npm run dev:server    # Starts backend in development mode" -ForegroundColor Yellow
Write-Host "  npm run dev:frontend  # Starts frontend dev server in another terminal" -ForegroundColor Yellow
Write-Host "`nOpen http://localhost:3000 in your browser to get started!" -ForegroundColor Cyan
