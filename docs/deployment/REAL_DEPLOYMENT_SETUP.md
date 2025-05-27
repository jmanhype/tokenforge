# Real Blockchain Deployment Setup

This guide will help you set up REAL blockchain deployment (no mocks, no simulations).

## Prerequisites

1. **Node.js 18+** installed
2. **Git** installed
3. **Convex CLI** installed (`npm install -g convex`)

## Step 1: Get Blockchain RPC URLs

Sign up for free accounts at:
- [Alchemy](https://www.alchemy.com/) - Recommended
- [Infura](https://infura.io/) - Alternative

Create apps for:
- Ethereum Sepolia testnet
- BSC testnet
- Solana devnet

## Step 2: Create Deployer Wallets

### For Ethereum/BSC:
```bash
# Install ethers CLI globally
npm install -g ethers

# Generate new wallets
ethers wallet create

# Save the private keys (64 hex characters after 0x)
```

### For Solana:
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Generate new wallet
solana-keygen new --outfile deployer-wallet.json

# Get the private key in base58 format
cat deployer-wallet.json | python3 -c "import json, base58; print(base58.b58encode(bytes(json.load(open('/dev/stdin')))).decode())"
```

## Step 3: Fund Your Wallets

### Ethereum Sepolia:
1. Go to [Sepolia Faucet](https://sepoliafaucet.com/)
2. Enter your wallet address
3. Get 0.5 ETH

### BSC Testnet:
1. Go to [BSC Testnet Faucet](https://testnet.binance.org/faucet-smart)
2. Enter your wallet address
3. Get 0.2 BNB

### Solana Devnet:
```bash
# Use the provided script
./get-solana-devnet.sh YOUR_WALLET_ADDRESS
# Or use Solana CLI
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```

## Step 4: Configure Environment

Create `.env.local` file:
```bash
# Copy the example
cp .env.real.example .env.local

# Edit with your favorite editor
nano .env.local
```

Add your values:
```env
# RPC URLs from Alchemy/Infura
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-KEY
BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
SOLANA_RPC_URL=https://api.devnet.solana.com

# Private Keys (NEVER share these!)
ETHEREUM_DEPLOYER_PRIVATE_KEY=0x...your-64-hex-chars...
BSC_DEPLOYER_PRIVATE_KEY=0x...your-64-hex-chars...
SOLANA_DEPLOYER_PRIVATE_KEY=...your-base58-key...

# Same key for bonding curve operator (or create separate)
BONDING_CURVE_OPERATOR_KEY=0x...your-64-hex-chars...

# Convex (already set)
CONVEX_DEPLOYMENT=standing-oyster-615

# Auth secret (generate new one)
AUTH_SECRET=your-random-32-char-string
```

## Step 5: Test Deployment

1. Start the app:
```bash
npm run dev
```

2. Create a token:
- Go to http://localhost:5173
- Sign in (anonymous auth)
- Create a token with any name/symbol
- Select blockchain (Ethereum Sepolia recommended)
- Click "Create"

3. Monitor deployment:
- Check browser console for logs
- Check Convex dashboard for function logs
- Token status will change from "pending" to "deployed"
- Contract address will appear

## Step 6: Verify Deployment

### For Ethereum/BSC:
Visit the block explorer:
- Sepolia: https://sepolia.etherscan.io/address/YOUR_CONTRACT
- BSC Testnet: https://testnet.bscscan.com/address/YOUR_CONTRACT

### For Solana:
Visit Solana Explorer:
- https://explorer.solana.com/address/YOUR_MINT?cluster=devnet

## Troubleshooting

### "Insufficient balance for deployment"
- Your wallet doesn't have enough testnet tokens
- Use faucets to get more

### "Missing configuration for blockchain"
- Environment variables not set correctly
- Check `.env.local` file

### "Transaction failed"
- Network congestion or RPC issues
- Try again or switch RPC provider

### "Cannot read properties of undefined"
- Missing private key or malformed
- Ensure keys are in correct format

## Security Notes

1. **NEVER commit `.env.local` to Git**
2. **NEVER share private keys**
3. **Use separate wallets for testing**
4. **Monitor wallet balances**
5. **Rotate keys regularly**

## Next Steps

Once deployment works:
1. Implement bonding curve smart contract
2. Add DEX integration (Uniswap/PancakeSwap)
3. Implement proper wallet connection (WalletConnect, MetaMask)
4. Add transaction monitoring
5. Implement security features

## Support

- Convex Discord: https://convex.dev/community
- Ethereum Discord: https://discord.gg/ethereum
- Solana Discord: https://discord.gg/solana