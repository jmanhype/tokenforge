# Troubleshooting Guide

## Common Issues and Solutions

### 1. Deployment Issues

#### "Function not found" Error
**Symptoms**: Frontend can't connect to Convex functions

**Solutions**:
1. Ensure Convex is deployed:
   ```bash
   npx convex deploy
   ```
2. Check environment variables:
   ```bash
   echo $VITE_CONVEX_URL
   ```
3. Verify function names match between frontend and backend

#### "Module not found" During Build
**Symptoms**: Build fails with missing module errors

**Solutions**:
1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
2. Check for version conflicts:
   ```bash
   npm ls
   ```

#### Environment Variables Not Loading
**Symptoms**: App uses wrong URLs or missing keys

**Solutions**:
1. Check file names (`.env.local` not `.env`)
2. Restart dev server after changes
3. Verify VITE_ prefix for frontend vars
4. Use `console.log(import.meta.env)` to debug

### 2. Blockchain Connection Issues

#### "Invalid RPC URL" Error
**Symptoms**: Can't connect to blockchain

**Solutions**:
1. Verify RPC URL format:
   ```
   Ethereum: https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
   BSC: https://bsc-dataseed1.binance.org
   Solana: https://api.mainnet-beta.solana.com
   ```
2. Check network status
3. Try alternative RPC endpoints

#### "Insufficient Funds" for Deployment
**Symptoms**: Token deployment fails

**Solutions**:
1. Check deployer wallet balance:
   ```javascript
   const balance = await provider.getBalance(deployerAddress);
   console.log(ethers.formatEther(balance));
   ```
2. Ensure correct network (mainnet vs testnet)
3. Top up deployer wallet

#### Transaction Stuck/Pending
**Symptoms**: Deployment hangs

**Solutions**:
1. Check gas price:
   ```javascript
   const gasPrice = await provider.getFeeData();
   ```
2. Cancel and retry with higher gas
3. Use speed up transaction feature

### 3. API Rate Limiting

#### CoinGecko Rate Limit Exceeded
**Symptoms**: Price data not updating

**Solutions**:
1. Implement caching:
   ```javascript
   const CACHE_DURATION = 60000; // 1 minute
   ```
2. Upgrade API tier
3. Use batch endpoints
4. Add request queuing

#### Social Media API Errors
**Symptoms**: Sharing features fail

**Solutions**:
1. Verify API credentials
2. Check rate limits:
   - Twitter: 300 posts/3 hours
   - Discord: 5 messages/5 seconds
3. Implement exponential backoff

### 4. Authentication Issues

#### "Unauthorized" Errors
**Symptoms**: Can't access protected routes

**Solutions**:
1. Clear browser cookies
2. Check AUTH_SECRET matches
3. Verify Convex auth configuration
4. Test with incognito mode

#### Session Expired
**Symptoms**: Logged out unexpectedly

**Solutions**:
1. Increase session duration
2. Implement refresh tokens
3. Add "Remember me" option

### 5. Performance Issues

#### Slow Page Load
**Symptoms**: Long initial load time

**Solutions**:
1. Enable code splitting:
   ```javascript
   const Component = lazy(() => import('./Component'));
   ```
2. Optimize images
3. Use CDN for assets
4. Enable compression

#### High Memory Usage
**Symptoms**: Browser tab crashes

**Solutions**:
1. Implement pagination
2. Clean up event listeners
3. Use virtual scrolling
4. Optimize re-renders

### 6. Smart Contract Issues

#### Contract Deployment Fails
**Symptoms**: Error during contract creation

**Solutions**:
1. Check constructor parameters
2. Verify contract size (< 24KB)
3. Ensure unique salt for CREATE2
4. Test on testnet first

#### "Contract Not Verified"
**Symptoms**: Can't interact on Etherscan

**Solutions**:
1. Run verification script:
   ```bash
   npm run verify:contracts -- --network ethereum
   ```
2. Check constructor args match
3. Ensure correct compiler version

### 7. Database/Convex Issues

#### "Document Not Found"
**Symptoms**: Missing data errors

**Solutions**:
1. Check indexes are correct
2. Verify data migrations ran
3. Look for race conditions
4. Check query filters

#### Real-time Updates Not Working
**Symptoms**: UI doesn't update automatically

**Solutions**:
1. Verify WebSocket connection
2. Check subscription setup
3. Look for console errors
4. Test with simple query

### 8. Production-Specific Issues

#### CORS Errors
**Symptoms**: API calls blocked

**Solutions**:
1. Configure CORS in Convex:
   ```javascript
   cors({
     origin: ["https://yourdomain.com"],
     credentials: true
   })
   ```
2. Check preflight requests
3. Verify headers

#### SSL Certificate Issues
**Symptoms**: Security warnings

**Solutions**:
1. Use proper domain (not IP)
2. Wait for cert propagation
3. Check cert expiration
4. Use Let's Encrypt

## Debugging Tools

### 1. Browser DevTools
```javascript
// Network tab: Check API calls
// Console: Look for errors
// Application: Inspect storage
// Performance: Profile slow code
```

### 2. Convex Dashboard
- Function logs
- Database browser
- Metrics viewer
- Error tracking

### 3. Blockchain Explorers
- Etherscan: Ethereum transactions
- BSCScan: BSC transactions
- Solscan: Solana transactions

### 4. Monitoring Tools
```bash
# Check logs
convex logs -f

# Monitor functions
convex dashboard

# View metrics
open https://dashboard.convex.dev
```

## Emergency Procedures

### 1. Frontend Down
1. Check Vercel status page
2. Rollback deployment:
   ```bash
   vercel rollback
   ```
3. Use backup CDN

### 2. Backend Down
1. Check Convex status
2. Review recent deployments
3. Contact Convex support
4. Activate maintenance mode

### 3. Blockchain Issues
1. Switch RPC endpoints
2. Increase gas prices
3. Use alternative network
4. Pause deployments

### 4. Security Incident
1. Pause affected functions
2. Revoke compromised keys
3. Notify users
4. Conduct investigation

## Getting Help

### 1. Documentation
- [Convex Docs](https://docs.convex.dev)
- [Vite Docs](https://vitejs.dev)
- [Ethers.js Docs](https://docs.ethers.io)

### 2. Community Support
- Discord: [Join Server]
- GitHub Issues: [Create Issue]
- Stack Overflow: Tag `tokenforge`

### 3. Direct Support
- Email: support@tokenforge.com
- Emergency: [Phone Number]
- Business Hours: 9 AM - 6 PM UTC

## Diagnostic Commands

```bash
# Check Node version
node --version  # Should be >= 18

# Check Convex status
npx convex version
npx convex status

# Test environment
npm run test:integration

# Build locally
npm run build

# Check for vulnerabilities
npm audit

# Verify contracts compile
npm run compile
```

## Preventive Measures

1. **Regular Backups**
   - Database: Automatic (Convex)
   - Configs: Git repository
   - Secrets: Secure vault

2. **Monitoring Setup**
   - Uptime monitoring
   - Error tracking
   - Performance metrics
   - Security scanning

3. **Update Schedule**
   - Dependencies: Monthly
   - Security patches: Immediate
   - Major versions: Quarterly

4. **Testing Protocol**
   - Local testing first
   - Staging deployment
   - Gradual rollout
   - Quick rollback plan