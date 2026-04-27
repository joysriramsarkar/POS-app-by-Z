import { describe, expect, it, mock, beforeEach } from 'bun:test';

mock.module('next/server', () => ({
  NextResponse: {
    json: (body: any, init: any) => new Response(JSON.stringify(body), { status: init?.status || 200 })
  }
}));

const mockRequirePermission = mock(() => Promise.resolve(null));
mock.module('@/lib/api-middleware', () => ({
  requirePermission: mockRequirePermission,
}));

mock.module('date-fns', () => ({
  startOfDay: mock((d) => new Date('2024-01-01T00:00:00.000Z')),
  endOfDay: mock((d) => new Date('2024-01-31T23:59:59.999Z')),
  parseISO: mock((s) => new Date(s)),
  subDays: mock((d, n) => new Date(d.getTime() - n * 86400000)),
}));

const mockGroupBy = mock(() => Promise.resolve([]));
const mockFindMany = mock(() => Promise.resolve([]));

mock.module('@/lib/db', () => ({
  db: {
    saleItem: {
      groupBy: mockGroupBy,
    },
    product: {
      findMany: mockFindMany,
    },
  },
}));

// Use dynamic import for the route to ensure mocks are applied
let GET: any;

describe('GET /api/reports/products', () => {
  beforeEach(async () => {
    mockRequirePermission.mockClear();
    mockGroupBy.mockClear();
    mockFindMany.mockClear();
    if (!GET) {
      GET = (await import('./route')).GET;
    }
  });

  it('should return products on success', async () => {
    mockGroupBy.mockResolvedValueOnce([{
      productId: 'p1',
      _sum: { quantity: 10, totalPrice: 1000 },
    }] as never);

    mockFindMany.mockResolvedValueOnce([{
      id: 'p1',
      name: 'Product 1',
      buyingPrice: 50,
      unit: 'pcs',
    }] as never);

    const req = new Request('http://localhost:3000/api/reports/products');
    // We need nextUrl on request
    Object.defineProperty(req, 'nextUrl', {
      value: new URL('http://localhost:3000/api/reports/products?days=7'),
    });

    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.topProducts).toHaveLength(1);
    expect(json.topProducts[0].name).toBe('Product 1');
    expect(json.topProducts[0].revenue).toBe(1000);
    expect(json.topProducts[0].quantity).toBe(10);
    expect(json.topProducts[0].profit).toBe(500); // 1000 - (50 * 10)
  });

  it('should return 403 if unauthorized', async () => {
    mockRequirePermission.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 }) as never
    );

    const req = new Request('http://localhost:3000/api/reports/products');
    Object.defineProperty(req, 'nextUrl', {
      value: new URL('http://localhost:3000/api/reports/products'),
    });

    const res = await GET(req as any);
    expect(res.status).toBe(403);
  });

  it('should return 500 on db error', async () => {
    mockRequirePermission.mockResolvedValueOnce(null as never);
    mockGroupBy.mockRejectedValueOnce(new Error('DB Error'));

    const req = new Request('http://localhost:3000/api/reports/products');
    Object.defineProperty(req, 'nextUrl', {
      value: new URL('http://localhost:3000/api/reports/products'),
    });

    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });

  it('should handle date range queries properly', async () => {
    mockGroupBy.mockResolvedValueOnce([] as never);
    mockFindMany.mockResolvedValueOnce([] as never);

    const req = new Request('http://localhost:3000/api/reports/products');
    Object.defineProperty(req, 'nextUrl', {
      value: new URL('http://localhost:3000/api/reports/products?from=2024-01-01&to=2024-01-31'),
    });

    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });
});
