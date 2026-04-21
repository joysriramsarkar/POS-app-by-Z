# Next.js Point of Sale (POS) System

A modern, offline-first Point of Sale (POS) Progressive Web App (PWA) built with Next.js, tailored for seamless retail operations across devices. The application is structured to be multi-platform ready (Web, Capacitor for mobile, and Tauri for desktop) and designed to work reliably even without an active internet connection.

## ✨ Features

- **Offline-First Architecture**: Continuous operation without an internet connection. Uses IndexedDB as a local cache and action queue that intelligently syncs with the primary database when online.
- **Barcode Scanning**: Built-in global barcode scanning support across desktop (webcam) and mobile (device camera native integration via Capacitor ML Kit).
- **Cart & Checkout**: Robust cart management with accurate floating-point arithmetic.
- **Invoice Generation**: Automated, unique invoice generation and printing capabilities.
- **Inventory & Product Management**: Efficient product lookups, weighted average cost (WAC) calculations for stock, and comprehensive stock entry handling.
- **Dashboard & Analytics**: Real-time sales data visualization using Recharts.
- **Cross-Platform Ready**: Fully responsive mobile-first UI using Tailwind CSS and shadcn/ui, ready to be packaged as a PWA, Native Mobile App (Capacitor), or Desktop App (Tauri).
- **Secure Authentication**: Built-in role-based access control with NextAuth.js.

## 🛠️ Technology Stack

- **Core Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui
- **State Management**: Zustand
- **Database & ORM**: Prisma (PostgreSQL / SQLite for local development)
- **Local Storage / Offline**: IndexedDB (offline action queue architecture)
- **Authentication**: NextAuth.js (Credentials Provider)
- **Charts & Data Visualization**: Recharts
- **Mobile Integration**: Capacitor, `@capacitor-mlkit/barcode-scanning`
- **Other Tools**: `decimal.js` for precise financial arithmetic, `html5-qrcode` for web-based scanning.

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) installed on your system.

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Set up your environment variables by creating a `.env` file (copy from `.env.example` if available) and configuring the required variables:
   ```env
   DATABASE_URL="file:./prisma/data.db"
   DIRECT_URL="file:./prisma/data.db"
   NEXTAUTH_SECRET="your_secret_here"
   NEXTAUTH_URL="http://localhost:3000"
   ```

3. Initialize the database:
   ```bash
   npm run db:push
   npm run db:generate
   npm run db:seed
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to view the application in your browser.

## 🏗️ Architecture Highlights

- **Offline Syncing**: The app uses an advanced offline-first syncing architecture (`src/app/api/sync/route.ts`). Financial data uses ledger-based incremental updates to prevent distributed race conditions during synchronization.
- **Prisma Transactions**: Critical operations like stock verification and checkout validation are heavily protected using Prisma atomic transactions.
- **High-Density Mobile UI**: The interface is aggressively optimized for mobile POS usage, minimizing padding, reducing text sizes, and strictly avoiding desktop-style regressions on small screens.

## 📦 Build & Deployment

To build the application for production:

```bash
npm run build
npm start
```

## 📜 License

This project is licensed under the MIT License.
