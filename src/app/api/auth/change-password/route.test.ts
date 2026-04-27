import { describe, expect, it, mock, beforeEach, spyOn } from 'bun:test';
import { POST } from './route';

// Need to mock next/server
mock.module('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => {
      return new Response(JSON.stringify(body), {
        status: init?.status || 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  },
}));

// Mock next-auth
const mockGetServerSession = mock(() => Promise.resolve({ user: { id: '1', role: 'ADMIN' } }));
mock.module('next-auth', () => ({
  getServerSession: mockGetServerSession,
}));

// Mock bcryptjs
const mockCompare = mock(() => Promise.resolve(true));
const mockHash = mock(() => Promise.resolve('hashed-password'));
mock.module('bcryptjs', () => ({
  default: {
    compare: mockCompare,
    hash: mockHash,
  },
  compare: mockCompare,
  hash: mockHash,
}));

// Mock db
const mockFindUnique = mock(() => Promise.resolve({ id: '1', password: 'old-hashed-password' }));
const mockUpdate = mock(() => Promise.resolve({}));
mock.module('@/lib/db', () => ({
  db: {
    user: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

// Mock authOptions
mock.module('../[...nextauth]/route', () => ({
  authOptions: {},
}));

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    mockGetServerSession.mockClear();
    mockCompare.mockClear();
    mockHash.mockClear();
    mockFindUnique.mockClear();
    mockUpdate.mockClear();

    // Default success mocks
    mockGetServerSession.mockResolvedValue({ user: { id: '1' } });
    mockFindUnique.mockResolvedValue({ id: '1', password: 'old-hashed-password' });
    mockCompare.mockResolvedValue(true);
  });

  it('should return 200 on successful password change', async () => {
    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password' }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('should return 401 if not authorized', async () => {
    mockGetServerSession.mockResolvedValueOnce(null as any);

    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password' }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 400 on invalid JSON body', async () => {
    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: 'invalid json',
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid JSON body');
  });

  it('should return 400 on missing required fields', async () => {
    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'old-password' }), // missing newPassword
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Missing required fields');
  });

  it('should return 404 if user not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password' }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('User not found');
  });

  it('should return 400 on incorrect current password', async () => {
    mockCompare.mockResolvedValueOnce(false);

    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'wrong-password', newPassword: 'new-password' }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Incorrect current password');
  });

  it('should return 500 on database error during user fetch', async () => {
    // Hide console.error for this expected error test
    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
    mockFindUnique.mockRejectedValueOnce(new Error('DB Error'));

    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password' }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to change password');
    consoleSpy.mockRestore();
  });

  it('should return 500 on database error during password update', async () => {
    // Hide console.error for this expected error test
    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
    mockUpdate.mockRejectedValueOnce(new Error('Update DB Error'));

    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password' }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to change password');
    consoleSpy.mockRestore();
  });
});
