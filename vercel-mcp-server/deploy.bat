@echo off
REM Vercel MCP Server Deployment Script for Windows
setlocal enabledelayedexpansion

echo 🚀 Starting Vercel MCP Server deployment...

REM Check if Vercel CLI is installed
vercel --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Vercel CLI is not installed. Please install it first:
    echo    npm i -g vercel
    exit /b 1
)

REM Check if Composer is installed
composer --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Composer is not installed. Please install it first:
    echo    https://getcomposer.org/download/
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install it first:
    echo    https://nodejs.org/
    exit /b 1
)

echo 📦 Installing PHP dependencies...
composer install --no-dev --optimize-autoloader

echo 📦 Installing frontend dependencies...
cd frontend
call npm install
cd ..

echo 🔧 Building frontend...
cd frontend
call npm run build
cd ..

echo 🚀 Deploying to Vercel...
if "%1"=="--prod" (
    echo Deploying to production...
    vercel --prod
) else (
    echo Deploying to preview...
    vercel
)

echo ✅ Deployment completed!
echo.
echo 📋 Next steps:
echo 1. Set environment variables in Vercel dashboard:
echo    - MCP_ENV=production
echo    - MCP_LOG_LEVEL=info
echo.
echo 2. Configure your MCP clients with the deployment URL
echo.
echo 3. Test the deployment using the provided curl commands in README.md

pause 