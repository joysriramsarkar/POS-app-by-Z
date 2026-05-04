<div align="center">
  <img src="https://img.icons8.com/color/96/000000/shop.png" alt="POS Logo" width="80" height="80">
  <h1>Next.js Point of Sale (POS) System</h1>
  <p>A modern, offline-first Point of Sale PWA for seamless retail operations.</p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  </p>
</div>

---

## ✨ Features

- 📶 **Offline-First**: IndexedDB local cache with intelligent sync queue. Sales, stock updates, and customer changes work without internet and sync automatically when back online.
- 🌍 **Bilingual (EN/BN)**: Full English and Bengali UI via `next-intl`. Integrated Google Input Tools engine for live English-to-Bengali transliteration while typing product names.
- 📱 **Barcode Scanning**: Global keyboard-wedge scanner support on desktop. Native camera scanning on Android via Capacitor ML Kit.
- 🛒 **Cart & Checkout**: Multi-tab cart, prepaid balance, partial/due payments, change-as-prepayment, split Cash+UPI payments.
- 🧾 **Invoice & Printing**: Auto-generated invoice numbers, thermal printer support (58mm / 80mm), A4/A5 PDF export.
- 📦 **Inventory Management**: Product CRUD, weighted average cost (WAC), bulk stock entry, stock history audit trail.
- 👥 **Parties**: Customer and supplier management with ledger-based due tracking and prepaid balance.
- 📊 **Dashboard & Reports**: Real-time sales stats, category/product/customer reports, expense tracking.
- 🛡️ **Audit Logs**: Database-level logging of all critical actions (sales, stock changes, user modifications).
- 🔐 **Role-Based Access**: Admin / Manager / Cashier / Viewer roles via NextAuth.js with per-permission checks on every API route.

---

## 🛠️ Technology Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router), React 19 |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 4, shadcn/ui |
| **State Management** | Zustand |
| **Database & ORM** | Prisma 7 (PostgreSQL via Supabase) |
| **Offline Storage** | IndexedDB |
| **Authentication** | NextAuth.js |
| **Native (Android)** | Capacitor, `@capacitor-mlkit/barcode-scanning` |
| **Localization** | `next-intl`, Google Input Tools API |
| **Arithmetic** | `decimal.js` (precise money calculations) |

---

## 🏁 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- A PostgreSQL database (e.g. [Supabase](https://supabase.com) free tier)

### Installation

**1. Clone & install dependencies**
```bash
npm install
```

**2. Environment variables**

Create a `.env` file in the root:
```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
DIRECT_URL="postgresql://user:password@host:5432/dbname?schema=public"
NEXTAUTH_SECRET="your_secure_random_string"
NEXTAUTH_URL="http://localhost:3000"
```

**3. Database setup**
```bash
npm run db:push
npm run db:generate
npm run db:seed
```

**4. Start dev server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Default credentials are created by the seed script.

---

## 🏗️ Architecture

- **Offline Sync** (`src/lib/offline/`): Action queue in IndexedDB with idempotency keys. The sync worker replays queued operations against `/api/sync` when connectivity is restored. Financial data uses ledger-based incremental updates to prevent race conditions.
- **Atomic Stock Updates**: Raw SQL `UNNEST` batch updates with conditional `WHERE current_stock >= quantity` prevent overselling under concurrent load.
- **Prisma Singleton** (`src/lib/db.ts`): Single `PrismaClient` instance cached in `globalThis` to prevent connection pool exhaustion during hot-reloads and serverless invocations.
- **Permission Middleware** (`src/lib/api-middleware.ts`): Every API route calls `requirePermission()` which validates session + RBAC in one pass — no duplicate session fetches.

---

## 📜 License

Public domain — [CC0 1.0 Universal](LICENSE).
