import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { GET } from './route';

// Need to mock next-auth
mock.module('next-auth/next', () => ({
  getServerSession: mock(() => Promise.resolve({ user: { id: '1', role: 'ADMIN' } })),
}));

const mockFindMany = mock(() => Promise.resolve([]));
const mockCount = mock(() => Promise.resolve(0));

mock.module('@/lib/db', () => ({
  db: {
    product: {
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}));

describe('GET /api/products', () => {
  beforeEach(() => {
    mockFindMany.mockClear();
    mockCount.mockClear();
  });

  it('should return products on success', async () => {
    const products = [{ id: '1', name: 'Test Product', currentStock: 10 }];
    mockFindMany.mockResolvedValueOnce(products as never);
    mockCount.mockResolvedValueOnce(1);

    const req = new Request('http://localhost:3000/api/products');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(products);
    expect(mockFindMany).toHaveBeenCalled();
  });

  it('should return 500 if database query fails', async () => {
    mockFindMany.mockRejectedValueOnce(new Error('Database error'));

    const req = new Request('http://localhost:3000/api/products');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
  });
});
