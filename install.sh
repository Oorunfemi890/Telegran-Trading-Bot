#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=========================================="
echo "  TELEGRAM TRADING BOT INSTALLER"
echo "=========================================="
echo -e "${NC}\n"

# Check Node.js version
echo -e "${YELLOW}Checking Node.js version...${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18 or higher required${NC}"
    echo -e "${YELLOW}Current version: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v) installed${NC}\n"

# Check npm
echo -e "${YELLOW}Checking npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm -v) installed${NC}\n"

# Check PostgreSQL
echo -e "${YELLOW}Checking PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${RED}⚠️  PostgreSQL not found - please install it${NC}"
    echo -e "${YELLOW}Install: https://www.postgresql.org/download/${NC}\n"
else
    echo -e "${GREEN}✅ PostgreSQL installed${NC}\n"
fi

# Check Redis
echo -e "${YELLOW}Checking Redis...${NC}"
if ! command -v redis-cli &> /dev/null; then
    echo -e "${RED}⚠️  Redis not found - please install it${NC}"
    echo -e "${YELLOW}Install: https://redis.io/download${NC}\n"
else
    echo -e "${GREEN}✅ Redis installed${NC}\n"
fi

# Install npm dependencies
echo -e "${YELLOW}Installing npm dependencies...${NC}"
npm install
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependencies installed${NC}\n"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created${NC}\n"
    echo -e "${RED}⚠️  IMPORTANT: Edit .env file with your credentials!${NC}\n"
else
    echo -e "${YELLOW}⚠️  .env file already exists, skipping...${NC}\n"
fi

# Create required directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p logs uploads
echo -e "${GREEN}✅ Directories created${NC}\n"

# Build TypeScript
echo -e "${YELLOW}Building TypeScript...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript compiled${NC}\n"
else
    echo -e "${RED}❌ Failed to compile TypeScript${NC}"
    exit 1
fi

# Summary
echo -e "${BLUE}"
echo "=========================================="
echo "  INSTALLATION COMPLETE!"
echo "=========================================="
echo -e "${NC}\n"

echo -e "${GREEN}✅ All steps completed successfully!${NC}\n"

echo -e "${YELLOW}📋 NEXT STEPS:${NC}\n"
echo "1. Configure your .env file:"
echo "   ${BLUE}nano .env${NC}"
echo ""
echo "2. Create PostgreSQL database:"
echo "   ${BLUE}createdb trading_bot${NC}"
echo ""
echo "3. Run database migrations:"
echo "   ${BLUE}npm run migration:run${NC}"
echo ""
echo "4. Create super admin account:"
echo "   ${BLUE}npm run seed:super-admin${NC}"
echo ""
echo "5. Generate your first invitation code:"
echo "   ${BLUE}npm run generate:invitation${NC}"
echo ""
echo "6. Start the server:"
echo "   ${BLUE}npm run dev${NC}"
echo ""
echo "7. Visit the health check:"
echo "   ${BLUE}http://localhost:3000/health${NC}"
echo ""

echo -e "${YELLOW}📚 Documentation:${NC}"
echo "   - Setup Guide: docs/SETUP.md"
echo "   - API Reference: docs/API.md"
echo "   - Architecture: docs/ARCHITECTURE.md"
echo ""

echo -e "${GREEN}Happy Trading! 🚀${NC}\n"