import { vi } from 'vitest';

export const useQuery = vi.fn(() => null);
export const useMutation = vi.fn(() => vi.fn());
export const useAction = vi.fn(() => vi.fn());
export const useConvex = vi.fn(() => ({}));
export const ConvexProvider = ({ children }: { children: React.ReactNode }) => children;