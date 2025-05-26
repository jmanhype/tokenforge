# TokenForge Operations Runbook

## Table of Contents
1. [Daily Operations](#daily-operations)
2. [Incident Response](#incident-response)
3. [Maintenance Procedures](#maintenance-procedures)
4. [Emergency Procedures](#emergency-procedures)
5. [Recovery Procedures](#recovery-procedures)

## Daily Operations

### Morning Checklist (9:00 AM UTC)

1. **System Health Check**
   ```bash
   # Check monitoring dashboard
   open https://your-monitoring-url/dashboard
   
   # Verify all systems green
   - [ ] Frontend responsive
   - [ ] Convex backend healthy
   - [ ] Blockchain connections active
   - [ ] API endpoints responding
   ```

2. **Wallet Balance Check**
   ```javascript
   // Check deployer wallets
   Ethereum: Min 0.5 ETH
   BSC: Min 0.5 BNB
   Solana: Min 1 SOL
   ```

3. **API Usage Review**
   - CoinGecko: Check usage vs limits
   - Alchemy: Monitor compute units
   - Social APIs: Verify rate limits

4. **Error Log Review**
   ```bash
   # Check Sentry for new errors
   # Review Convex function logs
   npx convex logs --since 24h
   ```

### Evening Checklist (6:00 PM UTC)

1. **Metrics Review**
   - Daily active users
   - Tokens created
   - Transaction volume
   - Error rates

2. **Security Scan**
   - Check for suspicious activity
   - Review failed login attempts
   - Verify no unauthorized access

## Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P0 | Critical | < 15 min | Site down, data breach |
| P1 | High | < 1 hour | Payment failure, major bug |
| P2 | Medium | < 4 hours | Feature broken, slow performance |
| P3 | Low | < 24 hours | Minor bug, UI issue |

### P0 - Critical Incident Response

1. **Immediate Actions** (0-15 min)
   ```bash
   # 1. Acknowledge incident
   # 2. Notify on-call team
   # 3. Create incident channel
   # 4. Begin investigation
   ```

2. **Assessment** (15-30 min)
   - Identify scope of impact
   - Determine root cause
   - Plan mitigation strategy

3. **Mitigation** (30+ min)
   - Execute fix or rollback
   - Verify resolution
   - Monitor for stability

4. **Communication**
   - Status page update
   - User notification
   - Internal updates every 30 min

### P1 - High Priority Response

1. **Initial Response** (0-60 min)
   - Acknowledge issue
   - Assign owner
   - Begin investigation

2. **Resolution**
   - Implement fix
   - Test thoroughly
   - Deploy with care

### Common Incidents

#### 1. Frontend Down
```bash
# Check Vercel status
curl -I https://your-domain.com

# If down, check:
1. Vercel status page
2. DNS configuration
3. SSL certificates

# Quick fix:
vercel rollback
```

#### 2. Convex Backend Error
```bash
# Check Convex dashboard
open https://dashboard.convex.dev

# View recent errors
npx convex logs --error

# Rollback if needed
# In Convex dashboard → Deployments → Redeploy previous
```

#### 3. Blockchain Connection Lost
```javascript
// Switch to backup RPC
const BACKUP_RPCS = {
  ethereum: [
    'https://eth-mainnet.g.alchemy.com/v2/KEY',
    'https://mainnet.infura.io/v3/KEY',
    'https://eth.llamarpc.com'
  ],
  bsc: [
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc-dataseed3.binance.org'
  ]
};
```

#### 4. API Rate Limit Hit
```javascript
// Implement circuit breaker
if (rateLimitExceeded) {
  // 1. Enable cache-only mode
  // 2. Queue non-critical requests
  // 3. Notify users of degraded service
  // 4. Contact API provider for increase
}
```

## Maintenance Procedures

### Weekly Maintenance

1. **Dependency Updates**
   ```bash
   # Check for updates
   npm outdated
   
   # Update non-breaking
   npm update
   
   # Test thoroughly
   npm run test:all
   ```

2. **Security Patches**
   ```bash
   # Run security audit
   npm audit
   
   # Fix automatically
   npm audit fix
   
   # Manual review for breaking changes
   npm audit fix --force  # CAREFUL!
   ```

3. **Database Optimization**
   - Review slow queries
   - Update indexes if needed
   - Clean old data (30+ days)

### Monthly Maintenance

1. **Full System Backup**
   - Export Convex data
   - Backup environment configs
   - Archive deployment artifacts

2. **Performance Review**
   - Analyze metrics trends
   - Optimize slow endpoints
   - Review resource usage

3. **Security Audit**
   - Rotate API keys
   - Review access logs
   - Update passwords

### Contract Maintenance

1. **Gas Price Optimization**
   ```javascript
   // Update gas strategies monthly
   const gasConfig = {
     maxFeePerGas: ethers.parseUnits('50', 'gwei'),
     maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
   };
   ```

2. **Fee Adjustment**
   ```bash
   # Review and adjust fees based on:
   - Network congestion
   - Token price changes
   - Competition analysis
   ```

## Emergency Procedures

### 1. Security Breach

**Immediate Actions:**
1. Isolate affected systems
2. Revoke compromised credentials
3. Enable emergency mode
4. Notify security team

**Code:**
```javascript
// Emergency shutdown
async function emergencyShutdown() {
  // 1. Pause all contracts
  await feeCollector.pause();
  
  // 2. Disable API endpoints
  await convex.disablePublicAccess();
  
  // 3. Notify users
  await broadcastEmergencyMessage();
}
```

### 2. Data Loss

**Recovery Steps:**
1. Stop all writes
2. Assess damage scope
3. Restore from backup
4. Verify data integrity

### 3. Financial Emergency

**If funds at risk:**
1. Pause affected contracts
2. Move funds to secure wallet
3. Investigate thoroughly
4. File incident report

## Recovery Procedures

### 1. Frontend Recovery

```bash
# From complete failure
1. git clone https://github.com/your-repo/tokenforge
2. npm install
3. Copy .env.production
4. npm run build
5. vercel --prod

# Time: ~10 minutes
```

### 2. Backend Recovery

```bash
# Convex recovery
1. npx convex deploy --prod
2. Restore environment variables
3. Verify functions deployed
4. Test critical paths

# Time: ~5 minutes
```

### 3. Full System Recovery

**Order of Operations:**
1. Backend (Convex) - 5 min
2. Frontend (Vercel) - 10 min
3. Monitoring - 5 min
4. Verification - 10 min

**Total RTO: 30 minutes**

### 4. Database Recovery

```bash
# Convex automatic backups
1. Contact Convex support
2. Request point-in-time restore
3. Specify timestamp
4. Verify restored data

# RPO: 15 minutes max
```

## Monitoring Commands

### Real-time Monitoring
```bash
# Function logs
npx convex logs -f

# Error logs only
npx convex logs --error -f

# Specific function
npx convex logs -f functionName
```

### Performance Monitoring
```javascript
// Add to critical functions
console.time('operation');
// ... operation code ...
console.timeEnd('operation');

// Monitor in dashboard
```

### Custom Alerts
```javascript
// Threshold alerts
if (errorRate > 0.05) {
  await sendAlert({
    severity: 'high',
    message: 'Error rate exceeded 5%',
    value: errorRate
  });
}
```

## Contact Information

### Escalation Matrix

| Level | Contact | Method | Response Time |
|-------|---------|---------|---------------|
| L1 | On-call Dev | Slack/Phone | 15 min |
| L2 | Tech Lead | Phone | 30 min |
| L3 | CTO | Phone | 1 hour |

### External Contacts

- **Convex Support**: support@convex.dev
- **Vercel Support**: support@vercel.com
- **Security Team**: security@tokenforge.com

### Emergency Hotline
- Primary: +1-XXX-XXX-XXXX
- Backup: +1-XXX-XXX-XXXX

## Appendix

### A. Useful Scripts

```bash
# Health check
curl https://api.tokenforge.com/health

# Clear cache
npm run cache:clear

# Rebuild indices
npm run db:reindex

# Export metrics
npm run metrics:export
```

### B. Decision Trees

```
Is the site down?
├─ Yes → Check Vercel status
│   ├─ Vercel down → Wait/Contact support
│   └─ Vercel up → Check DNS/SSL
└─ No → Check specific feature
    ├─ Frontend issue → Check console
    ├─ Backend issue → Check Convex logs
    └─ Blockchain issue → Check RPC status
```

### C. Recovery Checklist

- [ ] System accessible
- [ ] All features working
- [ ] No data loss
- [ ] Performance normal
- [ ] Monitoring active
- [ ] Incident documented
- [ ] Post-mortem scheduled

---

**Last Updated**: [Date]
**Version**: 1.0
**Owner**: Operations Team