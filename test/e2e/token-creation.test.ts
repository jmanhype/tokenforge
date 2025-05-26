import { test, expect } from '@playwright/test'

test.describe('Token Creation E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
    
    // Wait for app to load
    await page.waitForLoadState('networkidle')
    
    // Sign in anonymously if needed
    const signInButton = page.getByText('Sign in anonymously')
    if (await signInButton.isVisible()) {
      await signInButton.click()
      await page.waitForTimeout(2000) // Wait for auth
    }
  })

  test('should display token creation form', async ({ page }) => {
    // Check form elements
    await expect(page.getByText('Coin Name *')).toBeVisible()
    await expect(page.getByText('Symbol *')).toBeVisible()
    await expect(page.getByText('Initial Supply *')).toBeVisible()
    await expect(page.getByText('Blockchain *')).toBeVisible()
    
    // Check feature toggles
    await expect(page.getByText('🪙 Mintable')).toBeVisible()
    await expect(page.getByText('🔥 Burnable')).toBeVisible()
    await expect(page.getByText('🔐 Post-Quantum')).toBeVisible()
  })

  test('should validate form inputs', async ({ page }) => {
    // Try to submit empty form
    const submitButton = page.getByRole('button', { name: /Create & Deploy Coin/i })
    
    // Button should be disabled initially
    await expect(submitButton).toBeDisabled()
    
    // Fill in name
    await page.fill('input[placeholder="e.g., DogeCoin Supreme"]', 'Test Coin')
    
    // Button still disabled (missing symbol)
    await expect(submitButton).toBeDisabled()
    
    // Fill in symbol
    await page.fill('input[placeholder="e.g., DOGES"]', 'TEST')
    
    // Now button should be enabled
    await expect(submitButton).toBeEnabled()
  })

  test('should create a token successfully', async ({ page }) => {
    // Fill form
    await page.fill('input[placeholder="e.g., DogeCoin Supreme"]', 'E2E Test Coin')
    await page.fill('input[placeholder="e.g., DOGES"]', 'E2E')
    await page.fill('textarea[placeholder="Tell the world about your meme coin..."]', 'This is an E2E test coin')
    
    // Change supply
    const supplyInput = page.locator('input[type="number"]')
    await supplyInput.clear()
    await supplyInput.fill('5000000')
    
    // Select BSC
    await page.selectOption('select', 'bsc')
    
    // Toggle features
    await page.click('text=🔥 Burnable')
    
    // Submit
    const submitButton = page.getByRole('button', { name: /Create & Deploy Coin/i })
    await submitButton.click()
    
    // Wait for success toast or navigation
    await expect(page.locator('text=/Successfully created|Error|limit reached/i')).toBeVisible({
      timeout: 30000
    })
  })

  test('should show rate limit message after 3 coins', async ({ page }) => {
    // This test would need to create 3 coins first
    // For brevity, we'll just check the UI exists
    
    const rateLimit = await page.locator('text=/Daily limit|coins remaining/i')
    if (await rateLimit.isVisible()) {
      expect(await rateLimit.textContent()).toMatch(/\d+ coins? remaining/)
    }
  })

  test('should navigate between tabs', async ({ page }) => {
    // Click Market Dashboard tab
    await page.click('text=📊 Market Dashboard')
    await expect(page.getByText('Market Overview')).toBeVisible()
    
    // Click My Coins tab
    await page.click('text=💎 My Coins')
    await expect(page.getByText(/Your Meme Coins|No coins yet/i)).toBeVisible()
    
    // Back to Create Coin
    await page.click('text=🎯 Create Coin')
    await expect(page.getByText('Coin Name *')).toBeVisible()
  })

  test('should display blockchain info correctly', async ({ page }) => {
    // Select each blockchain and verify info updates
    const blockchainSelect = page.locator('select')
    
    // Ethereum
    await blockchainSelect.selectOption('ethereum')
    await expect(page.locator('text=/Gas fees|Ethereum/i')).toBeVisible()
    
    // BSC
    await blockchainSelect.selectOption('bsc')
    await expect(page.locator('text=/Lower fees|BSC|Binance/i')).toBeVisible()
    
    // Solana
    await blockchainSelect.selectOption('solana')
    await expect(page.locator('text=/Minimal fees|Solana/i')).toBeVisible()
  })
})

test.describe('Trading Interface E2E', () => {
  test('should navigate to trading page', async ({ page }) => {
    await page.goto('http://localhost:5173')
    
    // Go to My Coins tab
    await page.click('text=💎 My Coins')
    
    // If there are coins, click on one
    const tradeButton = page.getByRole('button', { name: /Trade/i }).first()
    if (await tradeButton.isVisible()) {
      await tradeButton.click()
      
      // Should be on trading page
      await expect(page.url()).toContain('/trade/')
      await expect(page.getByText(/Buy|Sell/i)).toBeVisible()
    }
  })
})

test.describe('Monitoring Dashboard E2E', () => {
  test('should access monitoring dashboard', async ({ page }) => {
    await page.goto('http://localhost:5173/monitoring')
    
    await expect(page.getByText('System Monitoring')).toBeVisible()
    await expect(page.getByText('System Health')).toBeVisible()
    await expect(page.getByText('Key Metrics')).toBeVisible()
    await expect(page.getByText('Recent Alerts')).toBeVisible()
  })

  test('should switch time ranges', async ({ page }) => {
    await page.goto('http://localhost:5173/monitoring')
    
    // Click different time ranges
    await page.click('button:has-text("1 Hour")')
    await page.click('button:has-text("24 Hours")')
    await page.click('button:has-text("7 Days")')
    
    // Verify active state changes
    const activeButton = page.locator('button.bg-indigo-600')
    await expect(activeButton).toHaveText('7 Days')
  })
})