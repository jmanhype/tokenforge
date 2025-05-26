# Testing Guide

## Overview

TokenForge uses a comprehensive testing strategy to ensure reliability and security across all components.

## Test Categories

### 1. Unit Tests
- **Location**: `src/**/__tests__/`, `src/**/*.test.ts(x)`
- **Framework**: Vitest
- **Coverage**: Components, utilities, hooks

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm test -- --watch
```

### 2. Smart Contract Tests
- **Location**: `test/contracts/`
- **Framework**: Hardhat, Chai
- **Coverage**: All smart contracts

```bash
# Run contract tests
npm run test:contracts

# Run specific contract test
npx hardhat test test/contracts/MemeCoin.test.js
```

### 3. Integration Tests
- **Location**: `test/integration/`
- **Framework**: Vitest, Convex Testing
- **Coverage**: Backend API, database operations

```bash
# Run integration tests
npm run test:integration
```

### 4. E2E Tests
- **Location**: `test/e2e/`
- **Framework**: Playwright
- **Coverage**: Critical user flows

```bash
# Run E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run specific browser
npx playwright test --project=chromium
```

## Writing Tests

### Unit Test Example

```typescript
// src/components/__tests__/MyComponent.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyComponent } from '../MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
```

### Contract Test Example

```javascript
// test/contracts/MyContract.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyContract", function () {
  it("Should deploy correctly", async function () {
    const Contract = await ethers.getContractFactory("MyContract");
    const contract = await Contract.deploy();
    
    expect(await contract.owner()).to.equal(owner.address);
  });
});
```

### Integration Test Example

```typescript
// test/integration/api.test.ts
import { describe, it, expect } from 'vitest'
import { ConvexTestingHelper } from '@convex-dev/testing'
import { api } from '../../convex/_generated/api'

describe('API Integration', () => {
  let t: ConvexTestingHelper

  beforeAll(async () => {
    t = new ConvexTestingHelper()
    await t.init()
  })

  it('creates a record', async () => {
    const result = await t.mutation(api.myApi.create, { 
      name: 'Test' 
    })
    expect(result).toHaveProperty('id')
  })
})
```

### E2E Test Example

```typescript
// test/e2e/user-flow.test.ts
import { test, expect } from '@playwright/test'

test('user can create token', async ({ page }) => {
  await page.goto('/')
  
  await page.fill('[placeholder="Token Name"]', 'My Token')
  await page.fill('[placeholder="Symbol"]', 'MTK')
  
  await page.click('button:has-text("Create")')
  
  await expect(page.locator('text=Success')).toBeVisible()
})
```

## Testing Best Practices

### 1. Test Structure
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Group related tests with `describe`
- Use `beforeEach`/`afterEach` for setup/cleanup

### 2. Mocking
- Mock external dependencies
- Use `vi.mock()` for module mocking
- Create test fixtures for consistent data

### 3. Assertions
- Be specific with assertions
- Test both success and failure cases
- Check for proper error messages
- Verify state changes

### 4. Performance
- Keep tests fast and isolated
- Use `test.concurrent` for parallel tests
- Mock heavy operations
- Clean up after tests

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Scheduled daily builds

GitHub Actions workflow:
1. Unit tests → 2. Contract tests → 3. Integration tests → 4. E2E tests

## Coverage Requirements

Maintain minimum coverage:
- Overall: 80%
- Critical paths: 95%
- Smart contracts: 100%

View coverage report:
```bash
npm run test:coverage
open coverage/index.html
```

## Debugging Tests

### Vitest
```bash
# Debug mode
npm test -- --reporter=verbose

# Run single test
npm test -- MyComponent.test.tsx

# Update snapshots
npm test -- -u
```

### Playwright
```bash
# Debug mode
npx playwright test --debug

# Show browser
npx playwright test --headed

# Slow motion
npx playwright test --slow-mo=1000
```

### Contract Tests
```bash
# Show gas usage
REPORT_GAS=true npm run test:contracts

# Verbose output
npx hardhat test --verbose
```

## Test Data

### Fixtures
- Location: `test/fixtures/`
- Reusable test data
- Consistent across tests

### Environment
- Use `.env.test` for test configuration
- Never use production data
- Reset database between tests

## Troubleshooting

### Common Issues

1. **Convex connection errors**
   - Ensure Convex dev server is running
   - Check CONVEX_URL environment variable

2. **Contract test failures**
   - Run `npm run compile` first
   - Check network configuration

3. **E2E timeouts**
   - Increase timeout in playwright.config.ts
   - Check if dev server is running

4. **Coverage gaps**
   - Add tests for uncovered lines
   - Use `/* c8 ignore next */` sparingly

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Hardhat Testing](https://hardhat.org/tutorial/testing-contracts)
- [Testing Library](https://testing-library.com/)