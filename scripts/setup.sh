#!/bin/bash

# BioForge Development Setup Script
# This script helps set up the development environment

set -e

echo "🔗 BioForge - Development Setup"
echo "================================"
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed"
    echo "Installing pnpm globally..."
    npm install -g pnpm
    echo "✅ pnpm installed"
else
    echo "✅ pnpm is already installed"
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed"
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    echo ""
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created"
    echo "⚠️  Please update the .env file with your credentials"
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "==========="
echo ""
echo "Option 1: Docker (Recommended)"
echo "  docker compose up --build"
echo ""
echo "Option 2: Manual"
echo "  1. Set up Supabase (cloud or CLI)"
echo "  2. Run database migrations"
echo "  3. pnpm dev"
echo ""
echo "Access points:"
echo "  - App: http://localhost:4321"
echo "  - Supabase API: http://localhost:54321"
echo "  - Supabase Studio: http://localhost:54323"
echo ""
echo "Happy coding! 🚀"
