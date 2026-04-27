import { describe, expect, it, mock, beforeEach } from 'bun:test';

// Before importing our modules, mock ALL dependencies that cause trouble in the sandbox
mock.module('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => {
      return new Response(JSON.stringify(body), { status: init?.status || 200 });
    }
  }
}));

// Mock API middleware
const mockRequireRole = mock();
mock.module('@/lib/api-middleware', () => ({
  requireRole: mockRequireRole
}));

// Mock DB
const mockTransaction = mock();
mock.module('@/lib/db', () => ({
  db: {
    $transaction: mockTransaction
  }
}));

// Mock zod schema to bypass schema evaluation errors
mock.module('@/schemas', () => ({
  StockEntryInputSchema: {
    safeParse: () => ({ success: false, error: { flatten: () => ({ fieldErrors: {} }) } })
  }
}));

// Now dynamically import POST after mocks are set up
const { POST } = await import('./route');

describe('POST /api/stock-entry', () => {
  beforeEach(() => {
    mockRequireRole.mockReset();
    mockTransaction.mockReset();
  });

  it('should return 403 if requireRole fails', async () => {
    // Simulate requireRole returning a response (e.g. 403 Forbidden)
    mockRequireRole.mockResolvedValue(new Response(JSON.stringify({ error: "Insufficient permissions" }), { status: 403 }));

    const req = {
      json: async () => ({})
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Insufficient permissions");
    expect(mockRequireRole).toHaveBeenCalledWith(req, ['ADMIN', 'MANAGER']);
  });

  it('should proceed if requireRole succeeds', async () => {
    // Simulate requireRole returning null (authorized)
    mockRequireRole.mockResolvedValue(null);

    // Simulate invalid body to get a quick 400 response and prove we got past the role check
    const req = {
      json: async () => { throw new Error('Parse error') }
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('JSON parsing failed');
    expect(mockRequireRole).toHaveBeenCalledWith(req, ['ADMIN', 'MANAGER']);
  });
});
