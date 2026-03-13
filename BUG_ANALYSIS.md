# POS Application - Comprehensive Bug Analysis

**Analysis Date:** March 13, 2026  
**Scope:** API routes, database operations, state management, components, and business logic

---

## 🔴 CRITICAL ISSUES

### 1. **Race Condition in Customer Due Amount Tracking**
**Severity:** CRITICAL  
**Location:** [src/app/api/sales/route.ts](src/app/api/sales/route.ts#L216-L260)  
**Issue:**
- When a sale is created with customer due amount, the code increments `totalDue` on line 232
- Then it reads the customer data again on line 237 to get its current balance
- **However:** The read happens AFTER the increment, so `customer.totalDue` is stale
- The ledger entry balance calculations use this stale data, creating incorrect balances

**Code Example:**
```typescript
// Line 232 - Update totalDue
await tx.customer.update({
  where: { id: customerId },
  data: {
    totalDue: { increment: dueAmount },  // ← Updates in transaction
  },
});

// Line 237 - Read customer AFTER update
const customer = await tx.customer.findUnique({  // ← But this reads old value!
  where: { id: customerId },
});

// Line 243 - Balance calculation uses potentially stale value
balanceAfter: customer.totalDue + totalAmount,  // ⚠️ Wrong!
```

**Impact:** Customer ledger balances become inaccurate, causing billing discrepancies and payment collection issues.

**Fix:** Fetch customer BEFORE updating, then calculate balances based on expected new values:
```typescript
const customer = await tx.customer.findUnique({ where: { id: customerId } });
const newTotalDue = customer.totalDue + dueAmount;

await tx.customer.update({
  where: { id: customerId },
  data: { totalDue: { increment: dueAmount } },
});

await tx.ledgerEntry.create({
  data: {
    customerId,
    entryType: 'credit',
    amount: totalAmount,
    balanceAfter: newTotalDue,  // ← Use calculated value
    description: `Credit purchase: ${newSale.invoiceNumber}`,
    referenceId: newSale.id,
  },
});
```

---

### 2. **Concurrent Stock Depletion - Race Condition**
**Severity:** CRITICAL  
**Location:** [src/app/api/sales/route.ts](src/app/api/sales/route.ts#L160-L180)  
**Issue:**
- Stock is checked BEFORE creating the sale transaction
- Multiple concurrent requests can read the same stock level simultaneously
- All can pass validation and then oversell inventory

**Example Scenario:**
1. Product has 5 units in stock
2. Request A checks: 5 >= 3 ✓ (passes)
3. Request B checks: 5 >= 4 ✓ (passes)
4. Request A decrements: 5 - 3 = 2
5. Request B decrements: 2 - 4 = -2 ❌ **NEGATIVE STOCK!**

**Impact:** Inventory can go negative, corrupting stock levels and potentially selling products you don't have.

**Fix:** Use database-level locking or conditional updates:
```typescript
// Option 1: Use Prisma's conditional update with check
const updatedProduct = await tx.product.update({
  where: { 
    id: item.productId,
    currentStock: { gte: item.quantity }  // ← Conditional on sufficient stock
  },
  data: { currentStock: { decrement: item.quantity } },
});

// If no rows updated, stock wasn't sufficient
if (!updatedProduct) {
  throw new Error(`Insufficient stock for product ${product.name}`);
}
```

---

### 3. **Invoice Number Generation - Not Truly Unique**
**Severity:** CRITICAL (in high-concurrency scenarios)  
**Location:** [src/lib/invoice.ts](src/lib/invoice.ts)  
**Issue:**
```typescript
export function generateInvoiceNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${dateStr}-${random}`;  // ← Random could collide!
}
```

**Problem:**
- Uses random 4-digit number (0000-9999) = only 10,000 combinations per day
- With high concurrent load, collision probability is significant (Birthday Paradox)
- Database unique constraint prevents duplicates but only after insertion attempt fails

**Impact:** Transaction failures, invoice creation errors in high-load scenarios, audit trail corruption.

**Fix:** Use database sequence or timestamp + sequential counter:
```typescript
export async function generateInvoiceNumber(db: PrismaClient): Promise<string> {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Get today's count from database
  const todayStart = new Date(date);
  todayStart.setHours(0, 0, 0, 0);
  const count = await db.sale.count({
    where: {
      createdAt: { gte: todayStart }
    }
  });
  
  return `INV-${dateStr}-${String(count + 1).padStart(6, '0')}`;
}
```

---

### 4. **Inventory Not Atomic - Stock Update After Item Processing**
**Severity:** CRITICAL  
**Location:** [src/app/api/sales/route.ts](src/app/api/sales/route.ts#L165-L205)  
**Issue:**
- Code creates sale items FIRST (line ~170)
- Then validates and decrements stock AFTER (line ~175+)
- **If stock check fails or crashes:** Sale record exists with no corresponding stock deduction

**Impact:** 
- Orphaned sale records
- Inconsistent inventory tracking
- Audit trail shows sales of products with no stock deduction

**Fix:** Reverse the order - validate and lock stock BEFORE creating sale:
```typescript
// 1. Check and lock all inventory first
const productsToCheck = await Promise.all(
  validatedItems.map(item =>
    tx.product.findUnique({ where: { id: item.productId } })
  )
);

// 2. Validate all before creating anything
for (const [item, product] of zip(validatedItems, productsToCheck)) {
  if (!product || product.currentStock < item.quantity) {
    throw new Error(`Insufficient stock for ${item.productName}`);
  }
}

// 3. NOW create sale with items
const newSale = await tx.sale.create({ ... });

// 4. Update stock last
for (const item of validatedItems) {
  await tx.product.update({
    where: { id: item.productId },
    data: { currentStock: { decrement: item.quantity } },
  });
  await tx.stockHistory.create({ ... });
}
```

---

## 🟠 HIGH-PRIORITY ISSUES

### 5. **Payment Status Logic Error - Walk-in Customers with Zero Payment**
**Severity:** HIGH  
**Location:** [src/app/api/sales/route.ts](src/app/api/sales/route.ts#L137-L145)  
**Issue:**
```typescript
let paymentStatus = 'Paid';
if (amountPaidValue === 0) {
  paymentStatus = 'Due';  // ← Wrong for walk-in customers!
} else if (amountPaidValue > 0 && amountPaidValue < totalAmount) {
  paymentStatus = 'Partial';
}
```

**Problem:** Walk-in customers (no `customerId`) with cash payment of 0 is impossible, but if it happens, marked as 'Due' when it should be invalid.

**Impact:** Confusing payment records, incorrect due amount tracking for customers.

**Fix:**
```typescript
let paymentStatus = 'Paid';
if (customerId) {
  if (amountPaidValue === 0) {
    paymentStatus = 'Due';
  } else if (amountPaidValue > 0 && amountPaidValue < totalAmount) {
    paymentStatus = 'Partial';
  }
} else {
  // Walk-in customers must pay full amount
  if (amountPaidValue < totalAmount) {
    throw new Error('Walk-in customers must pay full amount');
  }
  paymentStatus = 'Paid';
}
```

---

### 6. **Stale Data Bug in Sale Cancellation/Refund**
**Severity:** HIGH  
**Location:** [src/app/api/sales/route.ts](src/app/api/sales/route.ts#L350-L415)  
**Issue:**
- When canceling a sale, customer data is fetched BEFORE it's used
- Between fetch and update, another transaction could change the balance
- Ledger calculations use stale customer data

```typescript
const customer = await tx.customer.findUnique({
  where: { id: existingSale.customerId },
});

if (customer) {
  // Between here and next line, balance could change
  await tx.ledgerEntry.create({
    data: {
      balanceAfter: customer.totalDue - existingSale.totalAmount,  // ⚠️ Stale!
    },
  });
}
```

**Impact:** Incorrect ledger balances during refunds, especially under concurrent operations.

---

### 7. **Offline Sync Missing Complete Validation**
**Severity:** HIGH  
**Location:** [src/app/api/sync/route.ts](src/app/api/sync/route.ts)  
**Issue:**
- Syncs data from offline queue with minimal validation
- If offline sale was created with validation errors (corrupted data), sync doesn't catch them
- No stock availability re-validation during sync

**Impact:** Corrupted data from offline mode gets persisted to production database.

---

### 8. **Missing Transaction Isolation - Stock History Reference Issue**
**Severity:** HIGH  
**Location:** [src/app/api/stock-entry/route.ts](src/app/api/stock-entry/route.ts#L95-L100)  
**Issue:**
```typescript
// Create stock history
await tx.stockHistory.create({
  data: {
    productId,
    changeType: 'purchase',
    quantity,
    reason: notes || `Stock purchase: ${quantity} units @ ₹${purchasePrice}`,
    referenceId: undefined,  // ← Not linked yet!
  },
});

// Then try to find and update it by time
await tx.stockHistory.updateMany({
  where: {
    productId,
    changeType: 'purchase',
    createdAt: {
      gte: new Date(Date.now() - 1000),  // ← Fragile! What if transaction spans >1s?
    },
  },
  data: {
    referenceId: purchase.id,
  },
});
```

**Problem:**
- Time-based matching is fragile and unreliable
- If transaction takes > 1 second, history record won't be updated
- Orphaned stock history records without purchase references

**Fix:** Create purchase FIRST, then reference it:
```typescript
const purchase = await tx.purchase.create({
  data: { /* ... */ },
  include: { items: true },
});

await tx.stockHistory.create({
  data: {
    productId,
    changeType: 'purchase',
    quantity,
    reason: notes || `Stock purchase: ${quantity} units @ ₹${purchasePrice}`,
    referenceId: purchase.id,  // ← Direct reference
  },
});
```

---

## 🟡 MEDIUM-PRIORITY ISSUES

### 9. **Floating-Point Math Precision Issues**
**Severity:** MEDIUM  
**Location:** [src/components/pos/CartItem.tsx](src/components/pos/CartItem.tsx#L52-L63)  
**Issue:**
```typescript
const handleIncrement = useCallback(() => {
  const step = getStep(item.unit);
  const newQty = Number((item.quantity + step).toFixed(3));
  updateQuantity(item.id, newQty);
}, [item.id, item.quantity, item.unit, updateQuantity]);
```

**Problem:**
- Uses `toFixed(3)` for precision, but cart `totalPrice` calculations don't
- Could lead to rounding discrepancies: 0.1 + 0.2 = 0.30000000000000004

**Impact:** Pricing discrepancies, incorrect billing totals in edge cases.

**Fix:** Use consistent decimal arithmetic library or backend calculation:
```typescript
import Decimal from 'decimal.js';

const newQty = new Decimal(item.quantity)
  .plus(new Decimal(step))
  .toNumber();
```

---

### 10. **Missing Null Checks in Customer Object Creation**
**Severity:** MEDIUM  
**Location:** [src/components/pos/CheckoutDialog.tsx](src/components/pos/CheckoutDialog.tsx#L255-L270)  
**Issue:**
```typescript
const customer: Customer | undefined = customerId ? {
  id: customerId,
  name: customerName || 'Walk-in',  // ← Could be undefined!
  totalDue: 0,
  totalPaid: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} : undefined;
```

**Problem:**
- `customerName` could be undefined from store
- Type system doesn't catch this (string vs undefined)
- Might pass validation but fail at backend

**Impact:** Type safety issues, potential runtime errors.

---

### 11. **Unhandled Promise Rejection in Parallel Fetches**
**Severity:** MEDIUM  
**Location:** [src/app/page.tsx](src/app/page.tsx#L205-L225)  
**Issue:**
```typescript
const [prods, custs] = await Promise.all([
  fetch('/api/products?limit=50'),
  fetch('/api/customers'),
]);
```

**Problem:**
- If one fetch fails, entire Promise.all throws
- Doesn't gracefully degrade if one API is down
- No retry logic or fallback

**Impact:** Sync completely fails if one endpoint has issues, even temporary ones.

**Fix:** Use Promise.allSettled:
```typescript
const [prodsResult, custsResult] = await Promise.allSettled([
  fetch('/api/products?limit=50'),
  fetch('/api/customers'),
]);

if (prodsResult.status === 'fulfilled' && prodsResult.value.ok) {
  // handle products
} else {
  // graceful fallback
}
```

---

### 12. **No Validation of Quantity Before Stock Deduction**
**Severity:** MEDIUM  
**Location:** [src/components/pos/CartItem.tsx](src/components/pos/CartItem.tsx)  
**Issue:**
- `updateQuantity` doesn't validate against available stock
- Allows setting quantity higher than `availableStock` in store
- Only validated at checkout, could lead to poor UX

**Impact:** User can add more items than available, then gets error at checkout.

---

### 13. **Missing Error Handling in Stock Entry Route**
**Severity:** MEDIUM  
**Location:** [src/app/api/stock-entry/route.ts](src/app/api/stock-entry/route.ts#L50-L70)  
**Issue:**
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();  // ← No try-catch here!
    // ...
  } catch (error) {
    // Single catch block for all errors
  }
}
```

**Problem:**
- If JSON parsing fails, error message is generic
- No differentiation between validation errors and system errors
- Difficult to debug

---

### 14. **Barcode Scanner Can Create Duplicate Cart Items**
**Severity:** MEDIUM  
**Location:** [src/app/page.tsx](src/app/page.tsx#L145-L160)  
**Issue:**
```typescript
const handleBarcodeDetected = useCallback(
  (barcode: string) => {
    const product = getProductByBarcode(barcode);
    if (product) {
      addItem(product, 1);  // ← Always adds _new_ item
      // addItem in store already handles duplicates, but timing issues could occur
    }
  },
  [getProductByBarcode, addItem, setLastScannedBarcode, currentPage]
);
```

**Problem:**
- Fast double-scans could create two separate entries before deduplication
- Timing dependent behavior

---

## 🔵 LOW-PRIORITY ISSUES / CODE QUALITY

### 15. **Ledger Entry Direction Confusion in Cancellation**
**Severity:** LOW  
**Location:** [src/app/api/sales/route.ts](src/app/api/sales/route.ts#L400-L415)  
**Issue:**
```typescript
// When reversing a credit (sale), should debit, but entry type might be confusing
await tx.ledgerEntry.create({
  data: {
    customerId: existingSale.customerId,
    entryType: 'debit',  // ← Reducing customer's due
    amount: existingSale.totalAmount,
    balanceAfter: customer.totalDue - existingSale.totalAmount,
    description: `${status}: reverse credit for ${existingSale.invoiceNumber}`,
    referenceId: existingSale.id,
  },
});
```

**Note:** This works correctly but the semantics could be clearer (debit = we're removing the credit they owed).

---

### 16. **Insufficient Input Validation in APIs**
**Severity:** LOW  
**Location:** Multiple route files  
**Issue:**
- Phone number validation is weak (only in UI, not API)
- No length limits on text fields
- No SQL injection protection (using Prisma is good, but explicit validation better)

---

### 17. **Missing Indexes on Hot Queries**
**Severity:** LOW  
**Location:** [prisma/schema.prisma](prisma/schema.prisma)  
**Issue:**
- No index on `Sale.invoiceNumber` (used for lookups)
- No index on `Customer.phone` (used for duplicates check)
- These are already marked with `@unique`, so indexes exist implicitly, but:
  - For `LedgerEntry`, index on `customerId` exists but no index on `(customerId, createdAt)` for range queries

---

### 18. **No Soft Delete for Historical Data**
**Severity:** LOW  
**Location:** Various entities  
**Issue:**
- Products have `isActive` for soft delete
- But `Sale` records can be "Cancelled" but still visible
- Should have `deletedAt` timestamp pattern for audit trail

---

## 📋 SUMMARY TABLE

| # | Issue | Severity | Impact | Status |
|---|-------|----------|--------|--------|
| 1 | Ledger Balance Race Condition | 🔴 CRITICAL | Billing discrepancies | Not Fixed |
| 2 | Stock Race Condition | 🔴 CRITICAL | Negative inventory | Not Fixed |
| 3 | Invoice Number Collision | 🔴 CRITICAL | Transaction failures | Not Fixed |
| 4 | Non-Atomic Stock Updates | 🔴 CRITICAL | Orphaned records | Not Fixed |
| 5 | Payment Status Logic | 🟠 HIGH | Data inconsistency | Not Fixed |
| 6 | Stale Data in Cancellations | 🟠 HIGH | Incorrect balances | Not Fixed |
| 7 | Offline Sync Validation | 🟠 HIGH | Data corruption | Not Fixed |
| 8 | Stock History References | 🟠 HIGH | Missing references | Not Fixed |
| 9 | Floating Point Math | 🟡 MEDIUM | Rounding errors | Not Fixed |
| 10 | Null Check Issues | 🟡 MEDIUM | Type errors | Not Fixed |
| 11 | Promise.all Error Handling | 🟡 MEDIUM | Sync failures | Not Fixed |
| 12 | No Stock Validation in UI | 🟡 MEDIUM | Poor UX | Not Fixed |
| 13 | Missing Error Handling | 🟡 MEDIUM | Debug difficulty | Not Fixed |
| 14 | Barcode Duplicate Items | 🟡 MEDIUM | Duplicate entries | Not Fixed |
| 15+ | Minor issues | 🔵 LOW | Code quality | Documented |

---

## 🛠️ RECOMMENDED FIX PRIORITY

**Phase 1 (IMMEDIATE):**
1. Fix invoice number generation (use database sequence)
2. Fix stock race condition (use conditional updates)
3. Fix ledger balance calculations (fetch before update)
4. Make stock updates atomic with sale creation

**Phase 2 (URGENT):**
5. Add validation to offline sync
6. Fix payment status logic for walk-in customers
7. Improve transaction ordering in cancellations
8. Fix stock history references

**Phase 3 (IMPORTANT):**
9. Add proper error handling to Promise chains
10. Fix floating-point math precision
11. Add stock level validation in UI
12. Improve null safety throughout

---

