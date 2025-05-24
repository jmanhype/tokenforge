# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MemeCoinGen is a meme coin creation platform with a React/TypeScript frontend and Convex backend. Users can create custom meme coins with simulated blockchain deployments across Ethereum, Solana, and BSC.

## Development Commands

```bash
# Start both frontend and backend
npm run dev

# Frontend only (Vite dev server)
npm run dev:frontend

# Backend only (Convex functions)
npm run dev:backend

# Type checking and build validation
npm run lint
```

## Architecture

### Frontend (React + Vite)
- **Entry**: `src/main.tsx` → `src/App.tsx`
- **Core Components**:
  - `CoinGenerator.tsx` - Main coin creation form with blockchain selection
  - `Dashboard.tsx` - Market overview with real-time updates
  - `UserCoins.tsx` - User portfolio view
  - `CoinCard.tsx` - Reusable coin display component
- **Authentication**: Anonymous auth via Convex Auth hooks

### Backend (Convex)
- **Schema** (`convex/schema.ts`): Defines tables for coins, deployments, analytics, socialShares
- **API Endpoints**:
  - `memeCoins.ts` - Coin CRUD operations, rate limiting (3/day per user)
  - `blockchain.ts` - Simulated deployment logic for each chain
  - `analytics.ts` - Mock price/volume generation
  - `social.ts` - Twitter-style launch announcements
- **Authentication**: `auth.ts` + `auth.config.ts` for anonymous user sessions

### Key Patterns
1. **Real-time Updates**: Convex queries auto-update UI when backend data changes
2. **Rate Limiting**: Enforced server-side in `createCoin` mutation
3. **Deployment Simulation**: Each blockchain has unique parameters (gas fees, confirmation times)
4. **Analytics**: Scheduled actions update mock market data every minute

## Convex Deployment

Current deployment: `standing-oyster-615`

To deploy backend changes:
```bash
npx convex deploy
```