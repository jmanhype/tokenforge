# Deployment Guide

This guide covers deploying TokenForge to production.

## Prerequisites

- [ ] All environment variables configured (see [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md))
- [ ] Convex account created
- [ ] Deployment platform account (Vercel/Netlify)
- [ ] Domain name (optional)

## Step 1: Deploy Convex Backend

### 1.1 Login to Convex
```bash
npx convex login
```

### 1.2 Deploy to Production
```bash
npx convex deploy --prod
```

This will:
- Create a production deployment
- Update your `.env.local` with production URLs
- Deploy all Convex functions

### 1.3 Set Production Environment Variables

In the Convex dashboard:
1. Go to Settings > Environment Variables
2. Add all non-VITE prefixed variables:
   - `AUTH_SECRET`
   - `ETHEREUM_RPC_URL`
   - `BSC_RPC_URL`
   - `SOLANA_RPC_URL`
   - `DEPLOYER_PRIVATE_KEY`
   - `SOLANA_DEPLOYER_KEYPAIR`
   - Social media API keys

## Step 2: Deploy Frontend

### Option A: Vercel (Recommended)

#### 2.1 Install Vercel CLI
```bash
npm i -g vercel
```

#### 2.2 Deploy
```bash
vercel
```

Follow the prompts:
- Link to existing project or create new
- Set production environment variables
- Deploy

#### 2.3 Add Environment Variables

In Vercel Dashboard:
1. Go to Project Settings > Environment Variables
2. Add all VITE_ prefixed variables
3. Add `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` from Convex

#### 2.4 Configure Domain (Optional)
1. Go to Project Settings > Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### Option B: Netlify

#### 2.1 Install Netlify CLI
```bash
npm i -g netlify-cli
```

#### 2.2 Build and Deploy
```bash
npm run build
netlify deploy --prod --dir=dist
```

#### 2.3 Add Environment Variables

In Netlify Dashboard:
1. Go to Site settings > Environment
2. Add all VITE_ prefixed variables
3. Redeploy for changes to take effect

### Option C: Manual Deployment

#### 2.1 Build for Production
```bash
npm run build
```

#### 2.2 Upload to Your Host
Upload the `dist` folder to your web host:
- AWS S3 + CloudFront
- Google Cloud Storage + CDN
- Traditional web hosting

## Step 3: Post-Deployment Setup

### 3.1 Verify Deployment

1. **Check Frontend**: Visit your deployed URL
2. **Check Auth**: Try signing in
3. **Check Convex**: Monitor the Convex dashboard
4. **Test Features**: Create a test token

### 3.2 Set Up Monitoring

#### Application Monitoring
- Sentry: Add to `src/main.tsx`
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: "production",
});
```

#### API Monitoring
- Set up alerts for API rate limits
- Monitor wallet balances
- Track deployment success rates

### 3.3 Configure Security

1. **Enable CORS** in Convex HTTP routes if needed
2. **Set up rate limiting** for public endpoints
3. **Configure CSP headers** in your hosting platform
4. **Enable HTTPS** (automatic on Vercel/Netlify)

## Production Checklist

### Security
- [ ] All API keys are in environment variables
- [ ] Deployer wallets have limited funds
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Error messages don't leak sensitive info

### Performance
- [ ] Images optimized
- [ ] Code splitting enabled
- [ ] CDN configured
- [ ] Caching headers set

### Monitoring
- [ ] Error tracking configured (Sentry)
- [ ] Analytics installed
- [ ] Uptime monitoring active
- [ ] Log aggregation set up

### Backup & Recovery
- [ ] Database backups enabled (Convex handles this)
- [ ] Deployer wallet backups secure
- [ ] Recovery procedures documented

## Maintenance

### Regular Tasks

1. **Weekly**
   - Check API usage and limits
   - Monitor wallet balances
   - Review error logs

2. **Monthly**
   - Rotate API keys
   - Update dependencies
   - Review security alerts

3. **Quarterly**
   - Audit smart contracts
   - Performance optimization
   - Security assessment

### Updating the Application

1. **Test Locally**
```bash
npm run dev
npm run test:run
```

2. **Deploy to Staging** (if available)
```bash
vercel --prod=false
```

3. **Deploy to Production**
```bash
vercel --prod
```

### Rollback Procedure

#### Frontend Rollback (Vercel)
```bash
vercel rollback
```

#### Convex Rollback
1. Go to Convex Dashboard
2. Navigate to Deployments
3. Redeploy previous version

## Troubleshooting Production Issues

### "Function not found" Errors
- Ensure Convex is deployed: `npx convex deploy --prod`
- Check function visibility (public vs internal)
- Verify environment variables

### "Unauthorized" Errors
- Check AUTH_SECRET matches in all environments
- Verify CORS settings
- Clear cookies and retry

### "Rate limit exceeded"
- Implement caching
- Upgrade API tier
- Add request queuing

### "Transaction failed"
- Check wallet balance
- Verify gas prices
- Ensure correct network

## Scaling Considerations

### When to Scale

- API rate limits frequently hit
- Slow response times
- High error rates
- User growth exceeding capacity

### Scaling Options

1. **API Tier Upgrades**
   - CoinGecko Pro/Enterprise
   - Premium RPC endpoints
   - Higher social media API limits

2. **Infrastructure**
   - CDN for static assets
   - Edge functions for API routes
   - Load balancing for RPC calls

3. **Smart Contract Optimization**
   - Batch deployments
   - Gas optimization
   - Multi-sig deployment wallets

## Support

- **Convex**: https://convex.dev/community
- **Vercel**: https://vercel.com/support
- **Issues**: https://github.com/jmanhype/tokenforge/issues

For emergency support, contact the team via the Discord server.