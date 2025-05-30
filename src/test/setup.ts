import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import React from 'react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock convex/react - need to use hoisted mock
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => null),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvex: vi.fn(() => ({})),
  ConvexProvider: ({ children }: { children: React.ReactNode }) => children,
  Authenticated: ({ children }: { children: React.ReactNode }) => children,
  Unauthenticated: ({ children }: { children: React.ReactNode }) => children,
  AuthLoading: ({ children }: { children: React.ReactNode }) => children,
  useConvexAuth: vi.fn(() => ({
    isAuthenticated: false,
    isLoading: false,
  })),
}));

// Mock convex generated API
vi.mock('../../convex/_generated/api', () => ({
  api: {
    memeCoins: {
      createMemeCoin: 'memeCoins.createMemeCoin',
      checkRateLimit: 'memeCoins.checkRateLimit',
    },
    analytics: {
      getCoinAnalytics: 'analytics.getCoinAnalytics',
    },
    bondingCurve: {
      deployBondingCurveForToken: 'bondingCurve.deployBondingCurveForToken',
    },
    monitoringApi: {
      getSystemHealth: 'monitoringApi.getSystemHealth',
      getRecentAlerts: 'monitoringApi.getRecentAlerts',
      getMetricsSummary: 'monitoringApi.getMetricsSummary',
    },
    users: {
      viewer: {
        loggedInUser: 'users.viewer.loggedInUser',
      },
    },
    auth: {
      loggedInUser: 'auth.loggedInUser',
    },
  },
}));

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => children,
    Link: ({ children, ...props }: any) => React.createElement('a', props, children),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
    useParams: () => ({}),
  }
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))