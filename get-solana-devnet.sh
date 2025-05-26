#!/bin/bash

echo "🟣 Getting Solana Devnet Tokens"
echo "================================"
echo "Wallet: CXoZHm8gH3XYRquSdkhFKF67QxfpNsyao66GhuGyqGb3"
echo ""

# Check if Solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Installing..."
    echo ""
    echo "Run this command to install:"
    echo "sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
    echo ""
    echo "Then add to PATH:"
    echo "export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\""
    exit 1
fi

echo "✅ Solana CLI found"
echo ""

# Set to devnet
solana config set --url devnet

# Check current balance
echo "Current balance:"
solana balance CXoZHm8gH3XYRquSdkhFKF67QxfpNsyao66GhuGyqGb3 --url devnet

# Request airdrop
echo ""
echo "Requesting 2 SOL airdrop..."
solana airdrop 2 CXoZHm8gH3XYRquSdkhFKF67QxfpNsyao66GhuGyqGb3 --url devnet

# Check new balance
echo ""
echo "New balance:"
solana balance CXoZHm8gH3XYRquSdkhFKF67QxfpNsyao66GhuGyqGb3 --url devnet