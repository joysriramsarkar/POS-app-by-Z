import { describe, expect, it, mock, beforeEach, spyOn } from 'bun:test';
import { POST } from './route';

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

const mockGetServerSession = mock(() => Promise.resolve({ user: { id: '1', role: 'ADMIN' } }));
mock.module('next-auth', () => ({
  getServerSession: mockGetServerSession,
}));

// Test-only mock values — not real credentials
const TEST_USER_ID = '1';
const TEST_CURRENT = Buffer.from('test-current').toString('base64');
const TEST_NEW = Buffer.from('test-new').toString('base64');
const TEST_WRONG = Buffer.from('test-wrong').toString('base64');
const TEST_STORED_HASH = Buffer.from('test-stored').toString('base64');
const TEST_HASH_OUTPUT = Buffer.from('test-output').toString('base64');

const mockCompare = mock(() => Promise.resolve(true));
const mockHash = mock(() => Promise.resolve(TEST_HASH_OUTPUT));
mock.module('bcryptjs', () => ({
  default: { compare: mockCompare, hash: mockHash },
  compare: mockCompare,
  hash: mockHash,
}));

const mockFindUnique = mock(() => Promise.resolve({ id: TEST_USER_ID, password: TEST_STORED_HASH }));
const mockUpdate = mock(() => Promise.resolve({}));
mock.module('@/lib/db', () => ({
  db: {
    user: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

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

    mockGetServerSession.mockResolvedValue({ user: { id: TEST_USER_ID, role: 'ADMIN' } });
    mockFindUnique.mockResolvedValue({ id: TEST_USER_ID, password: TEST_STORED_HASH });
    mockCompare.mockResolvedValue(true);
  });

  it('should return 200 on successful password change', async () => {
    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: TEST_CURRENT, newPassword: TEST_NEW }),
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
      body: JSON.stringify({ currentPassword: TEST_CURRENT, newPassword: TEST_NEW }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 500 on invalid JSON body', async () => {
    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: 'invalid json',
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to change password');
  });

  it('should return 400 on missing required fields', async () => {
    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: TEST_CURRENT }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Missing required fields');
  });

  it('should return 404 if user not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null as any);

    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: TEST_CURRENT, newPassword: TEST_NEW }),
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
      body: JSON.stringify({ currentPassword: TEST_WRONG, newPassword: TEST_NEW }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid current password');
  });

  it('should return 500 on database error during user fetch', async () => {
    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
    mockFindUnique.mockRejectedValueOnce(new Error('DB Error'));

    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: TEST_CURRENT, newPassword: TEST_NEW }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to change password');
    consoleSpy.mockRestore();
  });

  it('should return 500 on database error during password update', async () => {
    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
    mockUpdate.mockRejectedValueOnce(new Error('Update DB Error'));

    const req = new Request('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: TEST_CURRENT, newPassword: TEST_NEW }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to change password');
    consoleSpy.mockRestore();
  });
});
