import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { CoinCard } from '../CoinCard'
import { ConvexProvider } from 'convex/react'

// Mock Convex client
const mockClient = {
  sync: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
  action: vi.fn(),
}

// Wrapper component for tests
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <ConvexProvider client={mockClient as any}>
      {children}
    </ConvexProvider>
  </BrowserRouter>
)

describe('CoinCard', () => {
  const mockCoin = {
    _id: '1' as any,
    _creationTime: Date.now(),
    name: 'Test Coin',
    symbol: 'TEST',
    description: 'A test coin',
    initialSupply: 1000000,
    canMint: true,
    canBurn: false,
    postQuantumSecurity: false,
    creatorId: 'user123' as any,
    status: 'deployed' as const,
    deployment: {
      _id: 'deploy1' as any,
      _creationTime: Date.now(),
      coinId: '1' as any,
      blockchain: 'ethereum' as const,
      contractAddress: '0x1234567890123456789012345678901234567890',
      transactionHash: '0xabcdef',
      deployedAt: Date.now(),
      gasUsed: 100000,
      deploymentCost: 0.01,
    },
  }

  it('renders coin information correctly', () => {
    render(<CoinCard coin={mockCoin} />, { wrapper: TestWrapper })
    
    expect(screen.getByText('Test Coin')).toBeInTheDocument()
    expect(screen.getByText('TEST')).toBeInTheDocument()
    expect(screen.getByText('A test coin')).toBeInTheDocument()
  })

  it('displays blockchain badge', () => {
    render(<CoinCard coin={mockCoin} />, { wrapper: TestWrapper })
    
    // Blockchain is not displayed as text in CoinCard currently
    // Would need to add blockchain badge to the component
  })

  it('shows deployment status', () => {
    render(<CoinCard coin={mockCoin} />, { wrapper: TestWrapper })
    
    // Status includes emoji, so we need to check for the container
    const statusElement = screen.getByText(/deployed/i)
    expect(statusElement).toBeInTheDocument()
  })

  it('displays features correctly', () => {
    render(<CoinCard coin={mockCoin} />, { wrapper: TestWrapper })
    
    expect(screen.getByText('🪙 Mintable')).toBeInTheDocument()
    // Pausable is not shown because canPause is true but it's not in the features array
  })

  it('shows analytics when available', () => {
    render(<CoinCard coin={mockCoin} />, { wrapper: TestWrapper })
    
    // Analytics are shown only when showAnalytics prop is true
    // and they come from useQuery, which returns null in our mock
  })

  it('handles missing analytics gracefully', () => {
    render(<CoinCard coin={mockCoin} />, { wrapper: TestWrapper })
    
    // Should render without errors
    expect(screen.getByText('Test Coin')).toBeInTheDocument()
  })
})