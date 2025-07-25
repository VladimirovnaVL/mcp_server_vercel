#!/bin/bash

# Vercel MCP Server Deployment Script
set -e

echo "🚀 Starting Vercel MCP Server deployment..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed. Please install it first:"
    echo "   npm i -g vercel"
    exit 1
fi

# Check if Composer is installed
if ! command -v composer &> /dev/null; then
    echo "❌ Composer is not installed. Please install it first:"
    echo "   https://getcomposer.org/download/"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install it first:"
    echo "   https://nodejs.org/"
    exit 1
fi

echo "📦 Installing PHP dependencies..."
composer install --no-dev --optimize-autoloader

echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "🔧 Building frontend..."
cd frontend
npm run build
cd ..

echo "🚀 Deploying to Vercel..."
if [ "$1" = "--prod" ]; then
    echo "Deploying to production..."
    vercel --prod
else
    echo "Deploying to preview..."
    vercel
fi

echo "✅ Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Set environment variables in Vercel dashboard:"
echo "   - MCP_ENV=production"
echo "   - MCP_LOG_LEVEL=info"
echo ""
echo "2. Configure your MCP clients with the deployment URL"
echo ""
echo "3. Test the deployment using the provided curl commands in README.md" 