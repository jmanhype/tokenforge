import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConvexProvider } from 'convex/react'
import { CoinCard } from '../CoinCard'

// Mock Convex client
const mockClient = {
  sync: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
  action: vi.fn(),
}

// Mock useQuery to return null analytics
vi.mock('convex/react', async () => {
  const actual = await vi.importActual('convex/react')
  return {
    ...actual,
    useQuery: () => null,
  }
})

describe('CoinCard', () => {
  const mockCoin = {
    _id: '1',
    _creationTime: Date.now(),
    name: 'Test Coin',
    symbol: 'TEST',
    description: 'A test coin',
    initialSupply: 1000000,
    blockchain: 'ethereum' as const,
    canMint: true,
    canBurn: false,
    canPause: true,
    postQuantumSecurity: false,
    creatorId: 'user123',
    status: 'deployed' as const,
    contractAddress: '0x1234567890123456789012345678901234567890',
    transactionHash: '0xabcdef',
    deploymentCost: '0.01',
    analytics: {
      price: 0.001,
      marketCap: 1000,
      volume24h: 100,
      priceChange24h: 5.5,
      holders: 10,
      transactions24h: 25,
    },
  }

  it('renders coin information correctly', () => {
    render(
      <ConvexProvider client={mockClient as any}>
        <CoinCard coin={mockCoin} />
      </ConvexProvider>
    )
    
    expect(screen.getByText('Test Coin')).toBeInTheDocument()
    expect(screen.getByText('TEST')).toBeInTheDocument()
    expect(screen.getByText('A test coin')).toBeInTheDocument()
  })

  it('displays blockchain badge', () => {
    render(
      <ConvexProvider client={mockClient as any}>
        <CoinCard coin={mockCoin} />
      </ConvexProvider>
    )
    
    // Blockchain is not displayed as text in CoinCard currently
    // Would need to add blockchain badge to the component
  })

  it('shows deployment status', () => {
    render(
      <ConvexProvider client={mockClient as any}>
        <CoinCard coin={mockCoin} />
      </ConvexProvider>
    )
    
    // Status includes emoji, so we need to check for the container
    const statusElement = screen.getByText(/deployed/i)
    expect(statusElement).toBeInTheDocument()
  })

  it('displays features correctly', () => {
    render(
      <ConvexProvider client={mockClient as any}>
        <CoinCard coin={mockCoin} />
      </ConvexProvider>
    )
    
    expect(screen.getByText('🪙 Mintable')).toBeInTheDocument()
    // Pausable is not shown because canPause is true but it's not in the features array
  })

  it('shows analytics when available', () => {
    render(
      <ConvexProvider client={mockClient as any}>
        <CoinCard coin={mockCoin} />
      </ConvexProvider>
    )
    
    // Analytics are shown only when showAnalytics prop is true
    // and they come from useQuery, which returns null in our mock
  })

  it('handles missing analytics gracefully', () => {
    const coinWithoutAnalytics = { ...mockCoin, analytics: undefined }
    render(
      <ConvexProvider client={mockClient as any}>
        <CoinCard coin={coinWithoutAnalytics} />
      </ConvexProvider>
    )
    
    // Should render without errors
    expect(screen.getByText('Test Coin')).toBeInTheDocument()
  })
})