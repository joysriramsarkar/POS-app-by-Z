<div align="center">
  <img src="https://img.icons8.com/color/96/000000/shop.png" alt="POS Logo" width="80" height="80">
  <h1 align="center">Next.js Point of Sale (POS) System</h1>
  <p align="center">
    A robust, modern, offline-first Point of Sale PWA designed for seamless retail operations.
  </p>
  
  <p align="center">
    <a href="#-features"><strong>Features</strong></a> ·
    <a href="#%EF%B8%8F-technology-stack"><strong>Tech Stack</strong></a> ·
    <a href="#-quick-start"><strong>Quick Start</strong></a> ·
    <a href="#-latest-updates"><strong>Latest Updates</strong></a>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
  </p>
</div>

---

## ✨ Features

- 📶 **Offline-First Architecture**: Keep your business running without internet! Uses an IndexedDB local cache and action queue that intelligently syncs to the primary database when back online.
- 🌍 **Bilingual & Smart Transliteration (New!)**: Full support for English and Bengali. Features an integrated **Google Input Tools** engine that intelligently transliterates English product names (e.g., `Lays Yellow Rs. 20` ➔ `লেস হলুদ ২০ টাকা`) on the fly while typing.
- 🛡️ **Comprehensive Audit Logging (New!)**: Track all critical inventory changes, modifications, and system events with an easy-to-use Admin Audit interface.
- 📱 **Barcode Scanning**: Built-in global barcode scanning across desktop (webcam) and mobile (device camera native integration via Capacitor ML Kit).
- 🛒 **Cart & Checkout**: Robust cart management with accurate floating-point arithmetic for precise billing.
- 🧾 **Invoice Generation**: Automated, unique invoice generation and printing capabilities formatted beautifully for thermal printers.
- 📦 **Inventory & Product Management**: Efficient product lookups, weighted average cost (WAC) calculations for stock, and comprehensive stock entry handling.
- 📊 **Dashboard & Analytics**: Real-time sales data visualization using Recharts to track daily performance.
- 🔐 **Secure Authentication**: Built-in role-based access control with NextAuth.js.

---

## 🚀 Latest Updates (v2.0 Highlights)

- **i18n Implementation**: Introduced `next-intl` for seamless switching between English and Bengali interfaces.
- **Smart English-to-Bengali Transliteration Engine**: Added custom transliteration hooks for product creation. It accurately converts English digits to Bengali digits and translates standard pricing terms natively.
- **System Audit Logs**: Added detailed database-level logging to track user activity, product modifications, and stock adjustments.
- **UX Polishes**: Protected data-entry dialogs against accidental closures when clicking outside, ensuring zero data loss during fast-paced operations.
- **Database Hardening**: Strengthened seed scripts and RBAC access checks, fixing middleware routing issues.

---

## 🛠️ Technology Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router), React 19 |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 4, shadcn/ui |
| **State Management**| Zustand |
| **Database & ORM**| Prisma (PostgreSQL / SQLite) |
| **Offline Storage** | IndexedDB |
| **Authentication** | NextAuth.js |
| **Native Integration**| Capacitor, `@capacitor-mlkit/barcode-scanning` |
| **Localization** | `next-intl`, Google Input Tools API |

---

## 🏁 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your system.

### Installation

**1. Clone & Install Dependencies**
```bash
npm install
```

**2. Environment Variables**  
Create a `.env` file in the root directory:
```env
DATABASE_URL="file:./prisma/data.db"
DIRECT_URL="file:./prisma/data.db"
NEXTAUTH_SECRET="your_secure_random_string_here"
NEXTAUTH_URL="http://localhost:3000"
```

**3. Database Initialization**  
Push the schema, generate the client, and seed initial permissions/users:
```bash
npm run db:push
npm run db:generate
npm run db:seed
```

**4. Start Development Server**
```bash
npm run dev
```
Navigate to `http://localhost:3000` to start using the POS!

---

## 🏗️ Architecture Highlights

- **Offline Syncing**: The app uses an advanced offline-first syncing architecture (`src/app/api/sync/route.ts`). Financial data uses ledger-based incremental updates to prevent distributed race conditions during synchronization.
- **Prisma Transactions**: Critical operations like stock verification and checkout validation are heavily protected using Prisma atomic transactions.
- **High-Density Mobile UI**: The interface is aggressively optimized for mobile POS usage, minimizing padding, reducing text sizes, and strictly avoiding desktop-style regressions on small screens.

---

## 📜 License

This project is dedicated to the public domain under the [CC0 1.0 Universal (CC0 1.0) Public Domain Dedication](LICENSE).
