import { describe, expect, it, mock, beforeEach } from 'bun:test';

const mockFindMany = mock(() => Promise.resolve([]));
const mockCount = mock(() => Promise.resolve(0));

mock.module('@/lib/env', () => ({ env: {} }));
mock.module('@/lib/db', () => ({
  db: {
    user: { findUnique: mock(() => Promise.resolve(null)) },
    rolePermission: { findFirst: mock(() => Promise.resolve(null)) },
    product: { findMany: mockFindMany, count: mockCount },
  },
}));

mock.module('@/lib/permissions', () => ({
  hasPermission: mock(() => Promise.resolve(true)),
  getUserRole: mock(() => null),
  roleHasPermission: mock(() => true),
  rolePermissions: {},
}));

mock.module('@/lib/permissions-helpers', () => ({
  getUserRole: mock(() => null),
  roleHasPermission: mock(() => true),
  rolePermissions: {},
}));

mock.module('@/lib/api-middleware', () => ({
  requireAuth: mock(() => Promise.resolve({ authorized: true, response: null, session: { user: { id: '1', role: 'ADMIN' } } })),
  requirePermission: mock(() => Promise.resolve(null)),
  requireRole: mock(() => Promise.resolve(null)),
  getAuthenticatedUser: mock(() => Promise.resolve({ id: '1', role: 'ADMIN' })),
}));

mock.module('next-auth', () => ({
  getServerSession: mock(() => Promise.resolve({ user: { id: '1', role: 'ADMIN' } })),
}));

mock.module('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

const { GET } = await import('./route');

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

  it('should use the last returned product as the next cursor', async () => {
    const products = [
      { id: '1', name: 'A', currentStock: 10 },
      { id: '2', name: 'B', currentStock: 10 },
      { id: '3', name: 'C', currentStock: 10 },
    ];
    mockFindMany.mockResolvedValueOnce(products as never);

    const req = new Request('http://localhost:3000/api/products?limit=2');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.map((p: { id: string }) => p.id)).toEqual(['1', '2']);
    expect(json.nextCursor).toBe('2');
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
