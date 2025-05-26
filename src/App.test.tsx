import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => children,
  Routes: ({ children }: { children: React.ReactNode }) => children,
  Route: ({ element }: { element: React.ReactNode }) => element,
  Navigate: () => null,
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
  useParams: () => ({}),
}))

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