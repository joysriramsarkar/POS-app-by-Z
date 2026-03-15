# Bug Fix Plan

1. **Fix Issue 9: Floating-Point Math Precision Issues (`src/components/pos/CartItem.tsx`)**
   - Add `decimal.js` logic to `handleIncrement` and `handleDecrement` in `CartItem.tsx` to safely handle decimal steps instead of using `.toFixed()`.

2. **Fix Issue 10: Missing Null Checks in Customer Object Creation (`src/components/pos/CheckoutDialog.tsx`)**
   - Add explicit null-checking for `customerName` in `src/components/pos/CheckoutDialog.tsx` to avoid potential type errors or undefined values when passing the customer object around.

3. **Fix Issue 11: Unhandled Promise Rejection in Parallel Fetches (`src/app/page.tsx`)**
   - Change `Promise.all` in `src/app/page.tsx` during initial data load and sync to `Promise.allSettled`. This gracefully handles single endpoint failures.

4. **Fix Issue 12: No Validation of Quantity Before Stock Deduction (`src/components/pos/CartItem.tsx`)**
   - In `src/components/pos/CartItem.tsx`, ensure the quantity does not exceed `item.availableStock` when using the input or +/- buttons.

5. **Fix Issue 13: Missing Error Handling in Stock Entry Route (`src/app/api/stock-entry/route.ts`)**
   - Wrap the `await request.json()` inside `try { ... } catch (e) { ... }` in `src/app/api/stock-entry/route.ts` to capture JSON parse errors and return a bad request error correctly.

6. **Fix Issue 14: Barcode Scanner Can Create Duplicate Cart Items (`src/app/page.tsx`)**
   - Implement a simple debounce/throttle mechanism inside `handleBarcodeDetected` in `src/app/page.tsx`. This will prevent multiple scans of the same barcode within a very short timeframe (e.g. 500ms) from creating rapid duplicate items.

7. **Run tests to verify the fixes and ensure no regressions were introduced**
   - Ensure the application builds and tests run without errors using `bun test`.

8. **Complete pre commit steps**
   - Complete pre commit steps to ensure proper testing, verification, review, and reflection are done.
