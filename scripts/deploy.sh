#!/bin/bash

# TokenForge Deployment Script
# This script automates the deployment process with safety checks

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_ENV=${1:-staging}
SKIP_TESTS=${2:-false}

echo -e "${GREEN}🚀 TokenForge Deployment Script${NC}"
echo -e "Environment: ${YELLOW}$DEPLOYMENT_ENV${NC}"
echo "================================"

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Pre-deployment checks
echo -e "\n${YELLOW}📋 Running pre-deployment checks...${NC}"

# Check required tools
for tool in node npm git vercel convex; do
    if ! command_exists $tool; then
        echo -e "${RED}❌ $tool is not installed${NC}"
        exit 1
    fi
done

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "18" ]; then
    echo -e "${RED}❌ Node.js 18+ required (current: $(node -v))${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All tools installed${NC}"

# Check git status
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  Uncommitted changes detected${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Load environment
if [ "$DEPLOYMENT_ENV" = "production" ]; then
    if [ -f .env.mainnet ]; then
        export $(cat .env.mainnet | grep -v '^#' | xargs)
        echo -e "${GREEN}✅ Loaded production environment${NC}"
    else
        echo -e "${RED}❌ .env.mainnet not found${NC}"
        exit 1
    fi
else
    if [ -f .env.local ]; then
        export $(cat .env.local | grep -v '^#' | xargs)
        echo -e "${GREEN}✅ Loaded staging environment${NC}"
    fi
fi

# Run tests unless skipped
if [ "$SKIP_TESTS" != "true" ]; then
    echo -e "\n${YELLOW}🧪 Running tests...${NC}"
    
    # Unit tests
    if ! npm run test:run; then
        echo -e "${RED}❌ Unit tests failed${NC}"
        exit 1
    fi
    
    # Contract tests
    if ! npm run test:contracts; then
        echo -e "${RED}❌ Contract tests failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All tests passed${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping tests (not recommended for production)${NC}"
fi

# Build check
echo -e "\n${YELLOW}🔨 Building application...${NC}"
if ! npm run build; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build successful${NC}"

# Deploy Convex backend
echo -e "\n${YELLOW}📦 Deploying Convex backend...${NC}"

if [ "$DEPLOYMENT_ENV" = "production" ]; then
    # Production deployment with confirmation
    echo -e "${RED}⚠️  PRODUCTION DEPLOYMENT WARNING${NC}"
    echo "You are about to deploy to PRODUCTION"
    read -p "Type 'DEPLOY PRODUCTION' to confirm: " confirmation
    
    if [ "$confirmation" != "DEPLOY PRODUCTION" ]; then
        echo -e "${RED}❌ Deployment cancelled${NC}"
        exit 1
    fi
    
    npx convex deploy --prod
else
    # Staging deployment
    npx convex deploy
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Convex deployed successfully${NC}"
else
    echo -e "${RED}❌ Convex deployment failed${NC}"
    exit 1
fi

# Deploy frontend
echo -e "\n${YELLOW}🌐 Deploying frontend...${NC}"

if command_exists vercel; then
    if [ "$DEPLOYMENT_ENV" = "production" ]; then
        vercel --prod --yes
    else
        vercel --yes
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend deployed successfully${NC}"
    else
        echo -e "${RED}❌ Frontend deployment failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Vercel CLI not found, skipping frontend deployment${NC}"
    echo "Run 'npm i -g vercel' to install"
fi

# Post-deployment verification
echo -e "\n${YELLOW}🔍 Running post-deployment checks...${NC}"

# Get deployed URL
if [ "$DEPLOYMENT_ENV" = "production" ]; then
    DEPLOYED_URL="https://tokenforge.com"
else
    DEPLOYED_URL=$(vercel ls --token $VERCEL_TOKEN | grep "tokenforge" | head -1 | awk '{print $2}')
fi

# Health check
echo -n "Checking health endpoint... "
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYED_URL/api/health" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed (HTTP $HTTP_STATUS)${NC}"
    echo -e "${YELLOW}Please check the deployment manually${NC}"
fi

# Create deployment record
DEPLOYMENT_ID=$(date +%Y%m%d%H%M%S)
DEPLOYMENT_INFO="{
  \"id\": \"$DEPLOYMENT_ID\",
  \"environment\": \"$DEPLOYMENT_ENV\",
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"git_commit\": \"$(git rev-parse HEAD)\",
  \"git_branch\": \"$(git rev-parse --abbrev-ref HEAD)\",
  \"deployed_by\": \"$(whoami)\",
  \"url\": \"$DEPLOYED_URL\"
}"

echo "$DEPLOYMENT_INFO" > "deployments/deploy-$DEPLOYMENT_ID.json"

# Summary
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "Environment: ${YELLOW}$DEPLOYMENT_ENV${NC}"
echo -e "URL: ${YELLOW}$DEPLOYED_URL${NC}"
echo -e "Deployment ID: ${YELLOW}$DEPLOYMENT_ID${NC}"

# Notifications
if [ "$DEPLOYMENT_ENV" = "production" ]; then
    # Send notification to Discord/Slack
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        curl -X POST "$DISCORD_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"content\": \"🚀 **Production Deployment Complete**\",
                \"embeds\": [{
                    \"title\": \"TokenForge Deployed\",
                    \"color\": 65280,
                    \"fields\": [
                        {\"name\": \"Environment\", \"value\": \"$DEPLOYMENT_ENV\", \"inline\": true},
                        {\"name\": \"Version\", \"value\": \"$(git describe --tags --always)\", \"inline\": true},
                        {\"name\": \"Deployed By\", \"value\": \"$(whoami)\", \"inline\": true}
                    ],
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                }]
            }" 2>/dev/null
    fi
fi

echo -e "\n${YELLOW}📝 Next steps:${NC}"
echo "1. Verify all features are working"
echo "2. Monitor error logs for 30 minutes"
echo "3. Update status page if needed"

exit 0