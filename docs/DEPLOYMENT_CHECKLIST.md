# TokenForge Production Deployment Checklist

## Pre-Deployment Requirements

### 1. Environment Configuration ✓
- [ ] Copy `.env.example` to `.env.local`
- [ ] Copy `.env.mainnet.example` to `.env.mainnet` (for mainnet)
- [ ] All RPC URLs configured and tested
- [ ] Private keys securely stored
- [ ] API keys obtained and verified

### 2. Smart Contracts ✓
- [ ] All contracts compiled successfully
- [ ] Contract tests passing (100% coverage)
- [ ] Gas optimization completed
- [ ] Security audit performed (recommended)

### 3. Dependencies & Security ✓
- [ ] Run `npm audit` - no high/critical vulnerabilities
- [ ] Dependencies up to date
- [ ] Lock files committed (`package-lock.json`)

### 4. Testing ✓
- [ ] Unit tests passing (`npm run test:run`)
- [ ] Integration tests passing (`npm run test:integration`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] Smart contract tests passing (`npm run test:contracts`)
- [ ] Manual QA completed

## Deployment Steps

### Phase 1: Backend Deployment (Convex)

#### 1. Prepare Convex Production
```bash
# Login to Convex
npx convex login

# Deploy to production
npx convex deploy --prod
```

#### 2. Set Convex Environment Variables
Navigate to Convex Dashboard → Settings → Environment Variables

**Required Variables:**
```
# Blockchain RPCs
ETHEREUM_RPC_URL=
BSC_RPC_URL=
SOLANA_RPC_URL=

# Deployer Keys (CRITICAL - Handle with care!)
ETHEREUM_DEPLOYER_PRIVATE_KEY=
BSC_DEPLOYER_PRIVATE_KEY=
SOLANA_DEPLOYER_PRIVATE_KEY=

# API Keys
COINGECKO_API_KEY=
GECKOTERMINAL_API_KEY=
ETHERSCAN_API_KEY=
BSCSCAN_API_KEY=

# Social Media
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_TOKEN_SECRET=
DISCORD_WEBHOOK_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=

# Fee Collectors (After contract deployment)
FEE_COLLECTOR_SEPOLIA=
FEE_COLLECTOR_BSC_TESTNET=
FEE_COLLECTOR_ETHEREUM=
FEE_COLLECTOR_BSC=

# Monitoring
SENTRY_DSN_MAINNET=
DISCORD_WEBHOOK_MAINNET=
TELEGRAM_BOT_TOKEN_MAINNET=
```

### Phase 2: Smart Contract Deployment

#### 1. Deploy Core Contracts
```bash
# For testnet (default)
npm run deploy:testnet

# For mainnet (requires .env.mainnet)
npm run deploy:mainnet -- --network ethereum
npm run deploy:mainnet -- --network bsc
```

#### 2. Verify Contracts
```bash
# Verify on Etherscan/BSCScan
npm run verify:contracts -- --network ethereum --manifest deployments/mainnet-ethereum-xxx.json
```

#### 3. Update Contract Addresses
Update Convex environment variables with deployed contract addresses:
- `FEE_COLLECTOR_[NETWORK]`
- `BONDING_CURVE_FACTORY_[NETWORK]`
- `MULTISIG_FACTORY_[NETWORK]`

### Phase 3: Frontend Deployment

#### Option A: Vercel Deployment (Recommended)

1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Configure Environment Variables**
Create `.env.production` with:
```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_USE_TESTNET=false
VITE_SENTRY_DSN=your-sentry-dsn
```

3. **Deploy**
```bash
vercel --prod
```

4. **Set Environment Variables in Vercel Dashboard**
- All `VITE_` prefixed variables
- `CONVEX_DEPLOYMENT` from Convex dashboard

#### Option B: Docker Deployment

1. **Build Production Image**
```bash
docker build -f Dockerfile.prod -t tokenforge:latest .
```

2. **Run with Docker Compose**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Phase 4: Post-Deployment Configuration

#### 1. Configure Monitoring
- [ ] Set up Sentry error tracking
- [ ] Configure Discord/Telegram alerts
- [ ] Enable Grafana dashboards
- [ ] Set up uptime monitoring

#### 2. Security Hardening
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Set up WAF rules
- [ ] Enable DDoS protection

#### 3. Performance Optimization
- [ ] Enable CDN for static assets
- [ ] Configure caching headers
- [ ] Enable Gzip compression
- [ ] Optimize images

## Verification Steps

### 1. Functional Testing
- [ ] User can sign in
- [ ] Token creation works
- [ ] Bonding curve trading functional
- [ ] Social media sharing works
- [ ] Fee collection operational

### 2. Security Verification
- [ ] HTTPS enabled
- [ ] CSP headers configured
- [ ] Secrets not exposed in frontend
- [ ] Rate limiting active

### 3. Performance Verification
- [ ] Page load time < 3s
- [ ] API response time < 500ms
- [ ] No console errors
- [ ] Lighthouse score > 80

### 4. Monitoring Verification
- [ ] Errors reported to Sentry
- [ ] Alerts firing correctly
- [ ] Metrics being collected
- [ ] Logs accessible

## Rollback Plan

### Frontend Rollback
```bash
# Vercel
vercel rollback

# Docker
docker-compose down
docker-compose up -d --build
```

### Backend Rollback
1. Go to Convex Dashboard
2. Navigate to Deployments
3. Select previous deployment
4. Click "Redeploy"

### Database Rollback
- Convex automatically handles backups
- Contact Convex support for restore

## Emergency Contacts

### On-Call Rotation
1. Primary: [Name] - [Phone]
2. Secondary: [Name] - [Phone]
3. Escalation: [Name] - [Phone]

### External Support
- Convex Support: support@convex.dev
- Vercel Support: support@vercel.com
- Infrastructure: [Provider contact]

## Post-Deployment Tasks

### Day 1
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify all features working
- [ ] Review security alerts

### Week 1
- [ ] Analyze user feedback
- [ ] Performance optimization
- [ ] Fix any critical bugs
- [ ] Update documentation

### Month 1
- [ ] Security audit
- [ ] Performance review
- [ ] Cost optimization
- [ ] Feature roadmap update

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| QA Lead | | | |
| Security | | | |
| Product Owner | | | |

---

**Deployment Date**: _______________
**Version**: _______________
**Deployed By**: _______________