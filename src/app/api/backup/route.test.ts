import { describe, expect, it, mock, beforeEach } from 'bun:test';

mock.module('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => {
      return new Response(JSON.stringify(body), { status: init?.status || 200 });
    }
  }
}));

let mockSession: any = { user: { id: '1', role: 'ADMIN' } };
mock.module('next-auth', () => ({
  getServerSession: mock(() => Promise.resolve(mockSession)),
}));

mock.module('../auth/[...nextauth]/route', () => ({
  authOptions: {}
}));

mock.module('bcryptjs', () => ({
  default: {
    hash: mock(() => Promise.resolve('hashed_password')),
  }
}));

mock.module('crypto', () => ({
  default: {
    randomBytes: mock(() => ({ toString: () => 'random_string' })),
  }
}));

const mockFindMany = mock(() => Promise.resolve([]));
const mockDeleteMany = mock(() => Promise.resolve());
const mockCreateMany = mock(() => Promise.resolve());
const mockTransaction = mock(async (cb: any) => {
  return cb({
    saleItem: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
    purchaseItem: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
    stockHistory: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
    ledgerEntry: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
    sale: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
    purchase: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
    product: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
    category: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
    customer: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
    supplier: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
    setting: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
    user: { deleteMany: mockDeleteMany, createMany: mockCreateMany },
  });
});

mock.module('@/lib/db', () => ({
  db: {
    product: { findMany: mockFindMany },
    category: { findMany: mockFindMany },
    stockHistory: { findMany: mockFindMany },
    customer: { findMany: mockFindMany },
    ledgerEntry: { findMany: mockFindMany },
    sale: { findMany: mockFindMany },
    saleItem: { findMany: mockFindMany },
    supplier: { findMany: mockFindMany },
    purchase: { findMany: mockFindMany },
    purchaseItem: { findMany: mockFindMany },
    setting: { findMany: mockFindMany },
    user: { findMany: mockFindMany },
    $transaction: mockTransaction,
  },
}));

describe('GET /api/backup', () => {
  beforeEach(() => {
    mockSession = { user: { id: '1', role: 'ADMIN' } };
    mockFindMany.mockClear();
  });

  it('should return 401 if unauthorized', async () => {
    mockSession = null;
    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/api/backup');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('should return backup data on success', async () => {
    mockFindMany.mockResolvedValueOnce([{ id: '1', name: 'Product 1' }] as never); // product
    // Mock the rest to return empty arrays
    for (let i = 0; i < 11; i++) {
        mockFindMany.mockResolvedValueOnce([] as never);
    }
    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/api/backup');
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.products).toEqual([{ id: '1', name: 'Product 1' }]);
    expect(json.data.categories).toEqual([]);
  });
});
