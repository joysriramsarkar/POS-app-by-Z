import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    username: string;
    email?: string;
    role?: "ADMIN" | "MANAGER" | "CASHIER" | "VIEWER";
    requiresPasswordChange?: boolean;
  }

  interface Session {
    user: User & {
      id: string;
      username?: string;
      role?: "ADMIN" | "MANAGER" | "CASHIER" | "VIEWER";
      requiresPasswordChange?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    role?: "ADMIN" | "MANAGER" | "CASHIER" | "VIEWER";
    requiresPasswordChange?: boolean;
  }
}
