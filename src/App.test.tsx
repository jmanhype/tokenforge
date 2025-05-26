import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Mock Convex hooks
vi.mock('convex/react', () => ({
  ConvexReactClient: vi.fn(),
  ConvexProvider: ({ children }: { children: React.ReactNode }) => children,
  useQuery: () => null,
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
  useConvexAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
  }),
  Authenticated: ({ children }: { children: React.ReactNode }) => children,
  Unauthenticated: ({ children }: { children: React.ReactNode }) => children,
  AuthLoading: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock Convex Auth
vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByText('MemeCoinGen')).toBeInTheDocument()
  })

  it('shows the header tagline', () => {
    render(<App />)
    expect(screen.getByText('🚀 Create • Deploy • Moon')).toBeInTheDocument()
  })

  it('displays welcome message when unauthenticated', () => {
    render(<App />)
    expect(screen.getByText('Welcome to MemeCoinGen')).toBeInTheDocument()
  })
})