#!/bin/bash

# Q Search (formerly Scrpexity) Setup Script
# This script sets up the environment for Q Search development and deployment

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print banner
echo -e "${BLUE}"
echo "  ___    _____                     _     "
echo " / _ \  / ____|                   | |    "
echo "| | | || (___   ___  __ _ _ __ ___| |__  "
echo "| | | | \___ \ / _ \/ _\` | '__/ __| '_ \ "
echo "| |_| | ____) |  __/ (_| | | | (__| | | |"
echo " \__\_\|_____/ \___|\__,_|_|  \___|_| |_|"
echo "                                         "
echo -e "${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js version 18 or higher.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install npm.${NC}"
    exit 1
fi

# Detect package manager
PACKAGE_MANAGER="npm"
if command -v bun &> /dev/null; then
    echo -e "${YELLOW}Bun detected. Using bun for faster installation...${NC}"
    PACKAGE_MANAGER="bun"
elif command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}pnpm detected. Using pnpm for installation...${NC}"
    PACKAGE_MANAGER="pnpm"
fi

# Remove any existing lock files
echo -e "${GREEN}Cleaning up lock files...${NC}"
rm -f package-lock.json yarn.lock bun.lockb pnpm-lock.yaml

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
if [ "$PACKAGE_MANAGER" = "bun" ]; then
    bun install
elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
    pnpm install
else
    npm install
fi

# Check for .env.local file
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}Creating .env.local file from example.env...${NC}"
    cp example.env .env.local
    echo -e "${YELLOW}Please update the .env.local file with your API keys!${NC}"
else
    echo -e "${GREEN}.env.local file already exists. Skipping creation.${NC}"
fi

# Validate environment files for common issues
echo -e "${GREEN}Validating environment files...${NC}"
./scripts/validate_env.sh .env.local .env.local.example example.env

# Setup database conditionally
if [ -f migrations/setup_database.js ]; then
    echo -e "${GREEN}Setting up database...${NC}"
    node migrations/setup_database.js
else
    echo -e "${YELLOW}No database setup script found, skipping database setup${NC}"
    echo -e "${YELLOW}Please follow the README instructions to set up your Supabase database manually.${NC}"
fi

# Start development server
echo -e "${GREEN}Ready to start the development server!${NC}"
echo -e "${YELLOW}Run the following command to start the development server:${NC}"
echo -e "${BLUE}$PACKAGE_MANAGER run dev${NC}"

# Ask if the user wants to start the development server
read -p "Would you like to start the development server now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Starting development server...${NC}"
    if [ "$PACKAGE_MANAGER" = "bun" ]; then
        bun run dev
    elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then
        pnpm run dev
    else
        npm run dev
    fi
else
    echo -e "${GREEN}Setup complete! Run '$PACKAGE_MANAGER run dev' to start the development server.${NC}"
fi