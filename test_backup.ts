import { mock } from "bun:test";

const nextServerMock = {
  NextResponse: {
    json: (body: any, init?: any) => {
      return new Response(JSON.stringify(body), {
        status: init?.status || 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
mock.module("next/server", () => nextServerMock);

mock.module("next-auth", () => ({
  getServerSession: async () => {
    return {
      user: {
        id: "123",
        role: "ADMIN"
      }
    };
  }
}));

mock.module("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {}
}));

mock.module("@/lib/api-middleware", () => ({
  requireRole: async (req: any, roles: string[]) => {
    if (!roles.includes("ADMIN")) {
      return nextServerMock.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  }
}));

mock.module("@/lib/db", () => ({
  db: {
    product: { findMany: async () => [] },
    category: { findMany: async () => [] },
    stockHistory: { findMany: async () => [] },
    customer: { findMany: async () => [] },
    ledgerEntry: { findMany: async () => [] },
    sale: { findMany: async () => [] },
    saleItem: { findMany: async () => [] },
    supplier: { findMany: async () => [] },
    purchase: { findMany: async () => [] },
    purchaseItem: { findMany: async () => [] },
    setting: { findMany: async () => [] },
    user: { findMany: async () => [] },
    $transaction: async (cb: any) => {
      const tx = {
        saleItem: { deleteMany: async () => {}, createMany: async () => {} },
        purchaseItem: { deleteMany: async () => {}, createMany: async () => {} },
        stockHistory: { deleteMany: async () => {}, createMany: async () => {} },
        ledgerEntry: { deleteMany: async () => {}, createMany: async () => {} },
        sale: { deleteMany: async () => {}, createMany: async () => {} },
        purchase: { deleteMany: async () => {}, createMany: async () => {} },
        product: { deleteMany: async () => {}, createMany: async () => {} },
        category: { deleteMany: async () => {}, createMany: async () => {} },
        customer: { deleteMany: async () => {}, createMany: async () => {} },
        supplier: { deleteMany: async () => {}, createMany: async () => {} },
        setting: { deleteMany: async () => {}, createMany: async () => {} },
        user: { deleteMany: async () => {}, createMany: async () => {} },
      };
      return cb(tx);
    }
  }
}));

const mockBcrypt = {
  hash: async (pass: string, rounds: number) => "hashed_pass"
};
mock.module("bcryptjs", () => mockBcrypt);

const mockCrypto = {
  randomBytes: (size: number) => ({
    toString: (format: string) => "random_string"
  })
};
mock.module("crypto", () => mockCrypto);

import { GET, POST } from "./src/app/api/backup/route.ts";

async function runTests() {
  console.log("Running GET test...");
  const mockReqGet = { headers: new Headers() } as any;
  const resGet = await GET(mockReqGet);
  console.log("GET Response:", resGet.status, await resGet.json());

  console.log("Running POST test...");
  const mockReqPost = {
    headers: new Headers(),
    json: async () => ({
      data: {
        users: [{ id: "u1", username: "testuser" }]
      }
    })
  } as any;
  const resPost = await POST(mockReqPost);
  console.log("POST Response:", resPost.status, await resPost.json());
}

runTests().catch(console.error);
