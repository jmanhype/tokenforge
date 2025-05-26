# 🚀 TokenForge - Advanced Meme Coin Creation Platform

[![CI Status](https://github.com/jmanhype/tokenforge/actions/workflows/test.yml/badge.svg)](https://github.com/jmanhype/tokenforge/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://reactjs.org/)
[![Convex](https://img.shields.io/badge/Convex-Backend-ff6b6b.svg)](https://convex.dev/)

## 🌟 Overview

TokenForge is a comprehensive platform for creating, deploying, and trading meme coins with advanced features including bonding curves, automated market making, and cross-chain support. Built with production-grade infrastructure and real blockchain integrations.

### ✨ Key Features

- **🎯 Bonding Curve Trading**: Automated liquidity and price discovery
- **🔗 Multi-Chain Support**: Ethereum, BSC, and Solana deployments
- **📊 Advanced Analytics**: Real-time trading data and token metrics
- **🎨 Professional UI**: Modern React interface with responsive design
- **🔒 Enterprise Security**: Multi-sig wallets, fee collection, and audit logging
- **📈 DEX Integration**: Automatic graduation to Uniswap V3 and PancakeSwap
- **📱 Social Features**: Comments, reactions, and trending tokens
- **⚡ Real-time Updates**: Live data with Convex backend

## 🛠️ Tech Stack

### Frontend
- **React 19** with TypeScript for type-safe development
- **Vite** for fast development and building
- **Tailwind CSS** for utility-first styling
- **React Router** for client-side routing
- **Recharts** for data visualization

### Backend
- **Convex** for real-time serverless functions
- **Hardhat** for smart contract development
- **Ethers.js** for Ethereum/BSC interactions
- **Metaplex** for Solana SPL token creation

### Smart Contracts
- **ERC20** tokens with optional mint/burn/pause features
- **Bonding Curve** contracts for automated market making
- **Fee Collection** system with revenue sharing
- **Multi-Signature** wallets for secure treasury management

### Infrastructure
- **GitHub Actions** for CI/CD
- **Docker** for containerization
- **Vitest** and **Playwright** for comprehensive testing
- **ESLint** and **TypeScript** for code quality

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn
- Git
- Convex account (free)

### Development Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/jmanhype/tokenforge.git
   cd tokenforge
   npm install
   ```

2. **Set up Convex**
   ```bash
   npx convex dev
   # Follow the prompts to create a new project
   ```

3. **Start development**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:5173
   ```

## 📁 Project Structure

```
tokenforge/
├── src/                      # React frontend
│   ├── components/           # Reusable UI components
│   │   ├── social/          # Social features (comments, reactions)
│   │   ├── __tests__/       # Component tests
│   │   └── *.tsx            # Core components
│   ├── pages/               # Route components
│   ├── lib/                 # Utilities and validation
│   └── main.tsx            # App entry point
├── convex/                  # Backend functions
│   ├── blockchain/          # Blockchain integrations
│   ├── social/             # Social media features
│   ├── analytics/          # Market data APIs
│   ├── monitoring/         # System monitoring
│   └── schema.ts           # Database schema
├── contracts/              # Smart contracts
│   ├── MemeCoin.sol        # Main ERC20 implementation
│   ├── BondingCurve.sol    # Automated market maker
│   ├── FeeCollector.sol    # Revenue management
│   └── MultiSigWallet.sol  # Secure treasury
├── test/                   # Test suites
│   ├── contracts/         # Smart contract tests
│   ├── e2e/              # End-to-end tests
│   └── integration/      # Integration tests
├── docs/                  # Documentation
│   ├── analysis/         # Technical analysis
│   ├── deployment/       # Deployment guides
│   └── monitoring/       # Monitoring configs
├── kubernetes/           # K8s deployment
├── terraform/           # Infrastructure as code
└── migrations/          # Database migrations
```

## 🔧 Available Scripts

### Development
```bash
npm run dev              # Start development servers
npm run dev:frontend     # Frontend only (Vite)
npm run dev:backend      # Backend only (Convex)
npm run lint            # Type checking and linting
```

### Testing
```bash
npm test               # Run all tests
npm run test:run       # Run tests once
npm run test:contracts # Smart contract tests
npm run test:e2e       # End-to-end tests
npm run test:ci        # CI test suite
```

### Building & Deployment
```bash
npm run build          # Production build
npm run compile        # Compile smart contracts
npm run deploy:testnet # Deploy to testnets
```

## 🏗️ Architecture

### Bonding Curve System
- **Automated Market Making**: Liquidity provided by mathematical curves
- **Price Discovery**: Dynamic pricing based on supply and demand
- **DEX Graduation**: Automatic migration to DEXs at target market cap
- **Fair Launch**: No pre-sales or insider allocations

### Multi-Chain Support
- **Ethereum**: ERC20 tokens with Uniswap V3 integration
- **BSC**: BEP20 tokens with PancakeSwap integration
- **Solana**: SPL tokens with native DEX support

### Security Features
- **Rate Limiting**: Prevents spam token creation
- **Input Validation**: Comprehensive sanitization
- **Multi-Signature**: Secure treasury management
- **Audit Logging**: Complete activity tracking
- **Circuit Breakers**: Automatic safety mechanisms

## 📊 Features in Detail

### Token Creation
- **Custom Parameters**: Name, symbol, supply, features
- **Optional Features**: Mint, burn, pause capabilities
- **Post-Quantum Security**: Future-proof cryptography
- **Fair Launch**: Equal opportunity for all participants

### Trading Interface
- **Live Charts**: Real-time price and volume data
- **Order Books**: Advanced trading features
- **Portfolio Tracking**: User holdings and P&L
- **Transaction History**: Complete audit trail

### Social Integration
- **Comments System**: Community discussions
- **Reaction System**: Like/dislike functionality
- **Trending Tokens**: Algorithm-driven discovery
- **Creator Dashboards**: Revenue and analytics

### Analytics & Monitoring
- **Real-time Metrics**: Price, volume, holders
- **Market Analysis**: Technical indicators
- **Performance Monitoring**: System health
- **Revenue Tracking**: Creator earnings

## 🧪 Testing

Our comprehensive test suite ensures reliability:

- **Unit Tests**: Component and function testing with Vitest
- **Smart Contract Tests**: Hardhat-based contract testing
- **Integration Tests**: API and database integration
- **End-to-End Tests**: Full user workflow testing with Playwright
- **Security Tests**: Input validation and edge cases

```bash
# Run specific test suites
npm run test:unit        # Component tests
npm run test:contracts   # Smart contract tests  
npm run test:integration # API integration tests
npm run test:e2e         # End-to-end tests
```

## 🚀 Deployment

### Local Development
```bash
npm run dev  # Starts both frontend and backend
```

### Production Deployment
See our comprehensive guides:
- [Deployment Checklist](docs/deployment/DEPLOYMENT_CHECKLIST.md)
- [Infrastructure Setup](docs/INFRASTRUCTURE.md)
- [Environment Configuration](docs/ENVIRONMENT_SETUP.md)

## 📚 Documentation

### Quick Start Guides
- [Environment Setup](docs/ENVIRONMENT_SETUP.md) - Complete setup instructions
- [API Keys Guide](docs/GET_API_KEYS_GUIDE.md) - Required API configurations
- [Testing Guide](docs/TESTING.md) - Running and writing tests

### Advanced Topics
- [Bonding Curve Implementation](docs/BONDING_CURVE_IMPLEMENTATION.md)
- [Smart Contract Architecture](docs/analysis/)
- [Monitoring & Observability](docs/monitoring/)
- [Production Deployment](docs/deployment/)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Ensure all tests pass (`npm test`)
5. Commit with conventional commits
6. Push and create a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new features
- Use conventional commit messages
- Update documentation for API changes

## 📈 Roadmap

- [x] **Phase 1**: Core token creation and deployment
- [x] **Phase 2**: Bonding curve trading system
- [x] **Phase 3**: Social features and community
- [x] **Phase 4**: Advanced analytics and monitoring
- [ ] **Phase 5**: Cross-chain bridges and integrations
- [ ] **Phase 6**: Mobile application
- [ ] **Phase 7**: DAO governance and tokenomics
- [ ] **Phase 8**: Enterprise features and white-label

## 🛡️ Security

- **Audit**: Smart contracts audited by security experts
- **Bug Bounty**: Responsible disclosure program
- **Security Contact**: security@tokenforge.dev

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenZeppelin](https://openzeppelin.com/) for secure smart contract libraries
- [Convex](https://convex.dev/) for real-time backend infrastructure
- [Hardhat](https://hardhat.org/) for Ethereum development environment
- [Vite](https://vitejs.dev/) for fast frontend tooling

---

**Built with ❤️ for the Web3 community**

*TokenForge - Where Innovation Meets Accessibility*