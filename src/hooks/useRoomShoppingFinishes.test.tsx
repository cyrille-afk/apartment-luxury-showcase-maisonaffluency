import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { useRoomShoppingFinishes } from './useRoomShoppingFinishes';

const query = vi.hoisted(() => ({ from: vi.fn(), in: vi.fn(), range: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: query.from } }));
const pickId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  const chain = { select: vi.fn(), in: query.in, eq: vi.fn(), order: vi.fn(), range: query.range };
  chain.select.mockReturnValue(chain);
  query.in.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  query.range.mockResolvedValue({ data: [{ pick_id: pickId, name: 'Tobacco Oak' }], error: null });
  query.from.mockReturnValue(chain);
});

describe('room shopping published finishes', () => {
  it('loads named finishes when Trade also contains legacy static cards', async () => {
    const { result } = renderHook(() => useRoomShoppingFinishes(['tp-103', pickId, pickId, 'tp-112']), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(query.in).toHaveBeenCalledWith('pick_id', [pickId]);
    expect(result.current.data).toEqual({ [pickId]: ['Tobacco Oak'] });
  });
  it('does not send synthetic-only identifiers to the public UUID column', () => {
    renderHook(() => useRoomShoppingFinishes(['tp-103', 'tp-112']), { wrapper });
    expect(query.from).not.toHaveBeenCalled();
  });
});