#!/bin/bash

# TokenForge Environment Setup Script
# This script helps you set up your .env file interactively

set -e

echo "🔨 TokenForge Environment Setup"
echo "=============================="
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to backup and create a new one? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        echo "✅ Backup created"
    else
        echo "❌ Setup cancelled"
        exit 1
    fi
fi

# Copy example file
cp .env.example .env
echo "✅ Created .env from .env.example"
echo ""

# Generate AUTH_SECRET
echo "🔐 Generating AUTH_SECRET..."
AUTH_SECRET=$(openssl rand -base64 32)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/AUTH_SECRET=.*/AUTH_SECRET=$AUTH_SECRET/" .env
else
    # Linux
    sed -i "s/AUTH_SECRET=.*/AUTH_SECRET=$AUTH_SECRET/" .env
fi
echo "✅ AUTH_SECRET generated"
echo ""

# Interactive setup
echo "📝 Let's set up your API keys"
echo "-----------------------------"
echo ""

# Function to update env variable
update_env() {
    local key=$1
    local value=$2
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|$key=.*|$key=$value|" .env
    else
        sed -i "s|$key=.*|$key=$value|" .env
    fi
}

# Convex check
echo "1️⃣  Convex Setup"
echo "Have you already run 'npx convex dev'? (y/n): "
read -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "📌 Run 'npx convex dev' first, then re-run this script"
    echo ""
fi

# RPC Setup
echo "2️⃣  Blockchain RPC Setup"
echo ""
echo "Choose your RPC provider:"
echo "1) Alchemy (recommended)"
echo "2) Infura"
echo "3) QuickNode"
echo "4) Public RPCs (free but unreliable)"
echo ""
read -p "Enter choice (1-4): " rpc_choice

case $rpc_choice in
    1)
        echo ""
        echo "🔗 Sign up at https://www.alchemy.com/"
        read -p "Enter your Alchemy Ethereum API key: " eth_key
        if [ ! -z "$eth_key" ]; then
            update_env "ETHEREUM_RPC_URL" "https://eth-mainnet.g.alchemy.com/v2/$eth_key"
            update_env "VITE_ETHEREUM_RPC_URL" "https://eth-mainnet.g.alchemy.com/v2/$eth_key"
        fi
        
        read -p "Enter your Alchemy BSC API key: " bsc_key
        if [ ! -z "$bsc_key" ]; then
            update_env "BSC_RPC_URL" "https://bnb-mainnet.g.alchemy.com/v2/$bsc_key"
            update_env "VITE_BSC_RPC_URL" "https://bnb-mainnet.g.alchemy.com/v2/$bsc_key"
        fi
        ;;
    4)
        echo "✅ Using public RPCs (already configured)"
        ;;
    *)
        echo "⏭️  Skipping RPC setup - configure manually"
        ;;
esac

# CoinGecko Setup
echo ""
echo "3️⃣  CoinGecko API Setup"
echo "🔗 Get your key at https://www.coingecko.com/en/api"
read -p "Enter your CoinGecko API key (or press enter to skip): " coingecko_key
if [ ! -z "$coingecko_key" ]; then
    update_env "COINGECKO_API_KEY" "$coingecko_key"
    update_env "VITE_COINGECKO_API_KEY" "$coingecko_key"
    echo "✅ CoinGecko configured"
fi

# Wallet Setup
echo ""
echo "4️⃣  Deployer Wallet Setup"
echo "⚠️  IMPORTANT: Create NEW wallets for deployment, never use personal wallets!"
echo ""
echo "Do you want to generate a new EVM wallet? (y/n): "
read -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Check if node is installed
    if command -v node &> /dev/null; then
        echo "🔐 Generating new EVM wallet..."
        WALLET_INFO=$(node -e "
            const { ethers } = require('ethers');
            const wallet = ethers.Wallet.createRandom();
            console.log(JSON.stringify({
                address: wallet.address,
                privateKey: wallet.privateKey
            }));
        " 2>/dev/null || echo "")
        
        if [ ! -z "$WALLET_INFO" ]; then
            PRIVATE_KEY=$(echo $WALLET_INFO | grep -o '"privateKey":"[^"]*' | cut -d'"' -f4)
            ADDRESS=$(echo $WALLET_INFO | grep -o '"address":"[^"]*' | cut -d'"' -f4)
            
            update_env "DEPLOYER_PRIVATE_KEY" "$PRIVATE_KEY"
            update_env "VITE_DEPLOYER_PRIVATE_KEY" "$PRIVATE_KEY"
            
            echo "✅ New wallet created!"
            echo "📋 Address: $ADDRESS"
            echo "💰 Remember to fund this wallet before deploying!"
            echo ""
        else
            echo "❌ Failed to generate wallet. Make sure ethers is installed: npm install ethers"
        fi
    else
        echo "❌ Node.js not found. Install Node.js to generate wallets automatically."
    fi
else
    echo "⏭️  Skipping wallet generation"
fi

# Summary
echo ""
echo "📊 Setup Summary"
echo "================"
echo ""
echo "✅ AUTH_SECRET generated"

# Check what was configured
if [ ! -z "$eth_key" ]; then
    echo "✅ Ethereum RPC configured"
fi
if [ ! -z "$bsc_key" ]; then
    echo "✅ BSC RPC configured"
fi
if [ ! -z "$coingecko_key" ]; then
    echo "✅ CoinGecko API configured"
fi
if [ ! -z "$PRIVATE_KEY" ]; then
    echo "✅ Deployer wallet generated"
fi

echo ""
echo "📋 Next Steps:"
echo "1. Review your .env file"
echo "2. Add any missing API keys manually"
echo "3. Fund your deployer wallets"
echo "4. Run 'npm run dev' to start development"
echo ""
echo "📚 For detailed setup instructions, see:"
echo "   docs/GET_API_KEYS_GUIDE.md"
echo ""
echo "✨ Happy building with TokenForge!"