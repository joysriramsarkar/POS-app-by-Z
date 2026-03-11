import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';

const mockFindMany = mock(() => []);

// Mock the module before importing the file that uses it
mock.module('@/lib/db', () => ({
  db: {
    product: {
      findMany: mockFindMany,
    },
  },
}));

// Import GET after setting up the mock
import { GET } from './route';

describe('GET /api/products', () => {
  beforeEach(() => {
    mockFindMany.mockClear();
  });

  it('should return products on success', async () => {
    const products = [{ id: '1', name: 'Test Product', isActive: true }];
    mockFindMany.mockResolvedValueOnce(products);

    const req = new NextRequest('http://localhost/api/products');
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual(products);
    expect(mockFindMany).toHaveBeenCalled();
  });

  it('should return 500 if database query fails', async () => {
    mockFindMany.mockRejectedValueOnce(new Error('Database error'));

    const req = new NextRequest('http://localhost/api/products');

    // Hide console.error during the test to avoid polluting the output
    const consoleSpy = mock(() => {});
    const originalConsoleError = console.error;
    console.error = consoleSpy;

    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ success: false, error: 'Failed to fetch products' });
    expect(mockFindMany).toHaveBeenCalled();

    console.error = originalConsoleError;
  });
});
