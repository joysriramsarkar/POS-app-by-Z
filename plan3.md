1. **Navigation Redesign (Mobile View Only)**
   - In `src/app/page.tsx`, completely hide the Sidebar and the mobile header triggering the sidebar. Update the `<header>` element with the `lg:hidden` class by adding `hidden` to it (so it's `hidden lg:hidden` or just remove it altogether for mobile) to fulfill the explicit request: "Remove Sidebar: Completely hide the Sidebar component on mobile screens."
   - Implement Bottom Navigation: Modify `mobileBottomNavItems` in `page.tsx`. Ensure the tabs are strictly: `id: 'dashboard'`, `id: 'billing'`, `id: 'stock'`, and `id: 'menu'`.
   - The 'menu' button in the bottom navigation will set `isMobileMenuOpen` to true. When true, a `<Sheet>` component will open displaying a custom drawer containing only secondary links (Reports, Settings, Parties, Users Management), hiding the full sidebar.
   - Run `cat src/app/page.tsx | grep -n "lg:hidden"` and `bun test` to verify changes.

2. **UI Density & Touch Optimization**
   - *Typography & Icons:* Apply responsive class names (like `text-lg md:text-sm`, `w-6 h-6 md:w-5 md:h-5`) in `src/app/page.tsx` and `src/components/pos/TransactionHistory.tsx` to enlarge touch targets and text on mobile without affecting desktop.
   - *Whitespace Management:* Reduce `p-4` to `p-2 md:p-4`, `gap-4` to `gap-2 md:gap-4` in components in `src/components/pos/CartPanel.tsx`, `TransactionHistory.tsx`, and `StockManagement.tsx`.
   - *Transaction History Optimization:* Wrap the table in `TransactionHistory.tsx` with a `<div className="overflow-x-auto w-full">` wrapper to allow horizontal scrolling on mobile. Update filter inputs in `TransactionHistory.tsx` with `flex-col md:flex-row w-full` and `h-8 md:h-10` to save vertical space.
   - Run a quick verify `bun run build` to ensure no syntax errors were introduced.

3. **Functional Fixes & Logic Enhancements**
   - *Mobile Printing:* Modify `src/lib/printUtility.ts` and `src/components/pos/PrintInvoice.tsx`. Capacitor on Android often fails when trying to print an iframe. The prompt explicitly says: "Resolve the issue where printing fails on Android. Verify and update `printUtility.ts` and `PrintInvoice.tsx` to ensure compatibility with Capacitor’s native printing or web-view print capabilities." I will update `printUtility.ts` so that if `Capacitor.isNativePlatform()` is true, it temporarily appends the print styles and content to the main document body, calls `window.print()`, and then restores the previous state, bypassing the iframe entirely for Android. Wait, `window.print()` in Android WebView sometimes needs to be just a straight call, but modifying the DOM and reverting is exactly how web-view printing is usually solved when iframes fail. Let's do that in `printUtility.ts`.
   - *Internationalization (i18n):* Modify `src/components/pos/SettingsManagement.tsx`. The current `handleSave` just sets the store settings. I will add a check: `if (sectionKeys.includes("app_language")) { window.location.reload(); }` to force a page reload so Next-intl or whatever translation store the app uses can re-initialize with the new language. Also, I will check if any cookie needs to be set, but simply reloading is explicitly what the restore mechanism does.
   - *Enhanced Barcode Scanner:*
     - In `src/app/page.tsx` `handleBarcodeDetected`, if `!product`, trigger: `toast({ title: 'Product Not Found', description: \`Barcode \${barcode} not found in database.\`, variant: 'destructive' })`.
     - In `src/components/pos/CameraScannerDialog.tsx`, import `useCartStore`, retrieve `items`, and render a small floating panel over the camera UI showing `items.slice(-3)` (last 3 items) as a live preview so users can see items added in real-time.
   - Run a verification step using `bun run build` or `bun test` to ensure changes are stable.

4. **Verify Tests**
   - Run `bun test` to ensure tests are passing and changes are solid.

5. **Pre Commit Steps**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
