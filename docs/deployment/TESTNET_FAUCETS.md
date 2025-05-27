# Testnet Token Faucets Guide

Your wallet addresses:
- **EVM (Ethereum/BSC)**: `0x7e1360dd62b8f5CD70e77d1BaB5b38ef89656Af9`
- **Solana**: `CXoZHm8gH3XYRquSdkhFKF67QxfpNsyao66GhuGyqGb3`

## 🟢 Ethereum Sepolia Testnet

### Alchemy Faucet (Recommended)
1. Go to: https://sepoliafaucet.com/
2. Sign in with Alchemy account
3. Enter your wallet address: `0x7e1360dd62b8f5CD70e77d1BaB5b38ef89656Af9`
4. Get 0.5 ETH daily

### Alternative Faucets:
- **Infura**: https://www.infura.io/faucet/sepolia
- **QuickNode**: https://faucet.quicknode.com/ethereum/sepolia

## 🟡 BSC Testnet

### Official BNB Faucet
1. Go to: https://testnet.bnbchain.org/faucet-smart
2. Enter your wallet address: `0x7e1360dd62b8f5CD70e77d1BaB5b38ef89656Af9`
3. Get 0.1 BNB every 24 hours

### Alternative:
- **ChainLink Faucet**: https://faucets.chain.link/bsc-testnet

## 🟣 Solana Devnet

### Official Solana Faucet
```bash
# Install Solana CLI if you haven't already
curl -sSfL https://release.solana.com/stable/install | sh

# Request airdrop (2 SOL max per request)
solana airdrop 2 CXoZHm8gH3XYRquSdkhFKF67QxfpNsyao66GhuGyqGb3 --url devnet
```

### Web Faucet
1. Go to: https://faucet.solana.com/
2. Enter your wallet address: `CXoZHm8gH3XYRquSdkhFKF67QxfpNsyao66GhuGyqGb3`
3. Select Devnet
4. Request SOL

## 📝 Important Notes

1. **Update RPC URLs for Testnet**: You'll need to update your `.env` file with testnet RPC URLs:
   ```env
   # Ethereum Sepolia
   ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/pjK9WZhcVNItnK-IcgX9L
   
   # BSC Testnet
   BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
   
   # Solana Devnet
   SOLANA_RPC_URL=https://api.devnet.solana.com
   ```

2. **Faucet Limits**: Most faucets have daily limits and cooldown periods

3. **Not Real Money**: Testnet tokens have NO real value - they're only for testing

4. **Network Selection**: Make sure your app is configured to use testnet networks when testing

## 🚀 Quick Test Script

Save this as `check-balances.js` to verify your testnet tokens:

```javascript
import { ethers } from 'ethers';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

const evmAddress = '0x7e1360dd62b8f5CD70e77d1BaB5b38ef89656Af9';
const solanaAddress = 'CXoZHm8gH3XYRquSdkhFKF67QxfpNsyao66GhuGyqGb3';

// Check Ethereum Sepolia
const ethProvider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/pjK9WZhcVNItnK-IcgX9L');
const ethBalance = await ethProvider.getBalance(evmAddress);
console.log('Ethereum Sepolia:', ethers.formatEther(ethBalance), 'ETH');

// Check BSC Testnet
const bscProvider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545/');
const bscBalance = await bscProvider.getBalance(evmAddress);
console.log('BSC Testnet:', ethers.formatEther(bscBalance), 'BNB');

// Check Solana Devnet
const solConnection = new Connection('https://api.devnet.solana.com', 'confirmed');
const solBalance = await solConnection.getBalance(new PublicKey(solanaAddress));
console.log('Solana Devnet:', solBalance / LAMPORTS_PER_SOL, 'SOL');
```