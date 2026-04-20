import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { GET as getSales } from './sales/route';
import { GET as getDues } from './dues/route';
import { GET as getProducts } from './products/route';
import { GET as getStock } from './stock/route';
import { NextRequest } from 'next/server';

// Mock next-auth
const mockGetSession = mock(() => Promise.resolve(null));
mock.module('next-auth/next', () => ({
  getServerSession: mockGetSession,
}));

// Mock next-auth
mock.module('next-auth', () => ({
  getServerSession: mockGetSession,
}));

// Mock database
mock.module('@/lib/db', () => ({
  db: {
    sale: {
      findMany: mock(() => Promise.resolve([])),
      aggregate: mock(() => Promise.resolve({ _sum: { totalAmount: 0 } })),
    },
    product: {
      findMany: mock(() => Promise.resolve([])),
      fields: {
        minStockLevel: 'minStockLevel'
      }
    },
    customer: {
      findMany: mock(() => Promise.resolve([])),
      aggregate: mock(() => Promise.resolve({ _sum: { totalDue: 0 } })),
    },
    saleItem: {
      groupBy: mock(() => Promise.resolve([])),
    },
    permission: {
        findUnique: mock(() => Promise.resolve({ id: '1', code: 'reports.view' })),
    },
    rolePermission: {
        findFirst: mock(() => Promise.resolve({ id: '1' })),
    },
    user: {
        findUnique: mock(() => Promise.resolve({ id: '1', role: 'ADMIN', isActive: true })),
    }
  },
}));

const reportHandlers = {
  sales: getSales,
  dues: getDues,
  products: getProducts,
  stock: getStock,
};

describe('Reports API Security', () => {
  beforeEach(() => {
    mockGetSession.mockClear();
  });

  Object.entries(reportHandlers).forEach(([name, handler]) => {
    describe(`${name.toUpperCase()} report`, () => {
      it('should return 401 when unauthenticated', async () => {
        mockGetSession.mockResolvedValueOnce(null);

        const req = new NextRequest(`http://localhost:3000/api/reports/${name}`);
        const res = await handler(req as any);

        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error).toBe('Unauthorized');
      });

      it('should return 403 when user lacks permission', async () => {
        // We need to mock hasPermission to return false
        // Since requirePermission calls getServerSession then hasPermission
        mockGetSession.mockResolvedValueOnce({ user: { id: 'user-without-permission', role: 'CASHIER' } });

        // Mocking db.rolePermission.findFirst to return null for CASHIER
        const { db } = await import('@/lib/db');
        db.rolePermission.findFirst.mockResolvedValueOnce(null);

        const req = new NextRequest(`http://localhost:3000/api/reports/${name}`);
        const res = await handler(req as any);

        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error).toBe("You don't have permission to perform this action");
      });

      it('should return 200 when user has permission', async () => {
        mockGetSession.mockResolvedValueOnce({ user: { id: 'admin-id', role: 'ADMIN' } });

        const { db } = await import('@/lib/db');
        db.rolePermission.findFirst.mockResolvedValueOnce({ id: 'rp1' });
        db.user.findUnique.mockResolvedValueOnce({ id: 'admin-id', role: 'ADMIN', isActive: true });

        const req = new NextRequest(`http://localhost:3000/api/reports/${name}`);
        const res = await handler(req as any);

        expect(res.status).toBe(200);
      });
    });
  });
});
