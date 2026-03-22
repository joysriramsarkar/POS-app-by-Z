Let's analyze the plan more carefully.

1. **Navigation Redesign (Mobile View Only)**
   - Remove Sidebar on mobile: Currently, `page.tsx` has:
     ```tsx
     {/* Mobile Header */}
     <header className="lg:hidden shrink-0 border-b ...">
       ...
       <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
         <SheetTrigger asChild>
           <Button variant="ghost" size="sm" className="h-9 w-9 ...">
             <Menu className="w-5 h-5" />
           </Button>
         </SheetTrigger>
         <SheetContent side="left" className="w-72 p-0 border-r-0 shadow-2xl">
           {renderSidebar()}
         </SheetContent>
       </Sheet>
       ...
     ```
     I need to completely hide the `Sidebar` component on mobile screens. The prompt says "Remove Sidebar: Completely hide the Sidebar component on mobile screens. Implement Bottom Navigation: Home/Dashboard, Billing, Stock, Menu". I will replace the mobile header's Sheet trigger, or hide the header, and implement the "Menu" option in the bottom nav to open a new drawer with *only* secondary links (Reports, Settings, Parties, Users Management).
     Wait, if I hide the mobile header, where does the user see the store name and online/offline status on mobile? Maybe just hide the hamburger menu in the mobile header, and add the "Menu" tab to the bottom nav. Let's see. The prompt says "Remove Sidebar: Completely hide the Sidebar component on mobile screens." This means the `renderSidebar()` shouldn't be used for mobile at all.

   - Bottom Navigation component: Update `mobileBottomNavItems` in `page.tsx`.
     ```tsx
     const mobileBottomNavItems: { id: PageType | 'menu'; label: string; icon: React.ReactNode }[] = [
       { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="w-6 h-6 md:w-5 md:h-5" /> },
       { id: 'billing', label: 'Billing', icon: <ShoppingCart className="w-6 h-6 md:w-5 md:h-5" /> },
       { id: 'stock', label: 'Stock', icon: <Package className="w-6 h-6 md:w-5 md:h-5" /> },
       { id: 'menu', label: 'Menu', icon: <Menu className="w-6 h-6 md:w-5 md:h-5" /> },
     ];
     ```
     When `item.id === 'menu'`, toggle `isMobileMenuOpen` which will show a drawer/overlay with Reports, Settings, Parties, Users Management.

2. **UI Density & Touch Optimization**
   - In `TransactionHistory.tsx`, `ProductGrid.tsx`, `CartPanel.tsx`, `StockManagement.tsx`: Increase text sizes (e.g. `text-base`, `text-lg` for mobile, while keeping `md:text-sm` for desktop). Also increase button padding/height for touch targets (e.g., `h-10 md:h-8`).
   - Reduce padding and margins in components. E.g. `p-2 md:p-4`, `gap-2 md:gap-4`.
   - Ensure the data table in `TransactionHistory.tsx` supports smooth horizontal scrolling (`overflow-x-auto` on the table container). Collapse filter inputs.

3. **Mobile Printing (Capacitor)**
   - In `printUtility.ts`: The current implementation creates a hidden iframe, writes HTML to it, and calls `iframe.contentWindow.print()`. Capacitor webviews on Android sometimes do not support `window.print()` properly unless a plugin is used, or there's a specific issue. Wait, `@capacitor/core` might have an issue with `window.print()` in an iframe.
   - I need to check how Capacitor handles printing. Sometimes using a Capacitor print plugin is required, but maybe just using the main window's `window.print()` works better than an iframe on Android? Let's check `printUtility.ts` and see if there's a workaround or if we need to call a different API. Or use `document.write`?

4. **Internationalization (i18n)**
   - The user says "Fix the broken language switching (Bengali/English) in the Settings menu. Ensure changes in settings-store.ts correctly trigger next-intl to update the UI across all components."
   - Wait, `settings-store.ts` handles `app_language: 'bn' | 'en'`. If I look at the app, maybe it's using next-intl, and setting the locale needs a cookie or URL path update. Wait, Next.js App Router with next-intl usually relies on a cookie like `NEXT_LOCALE` or a route parameter `/[locale]/...`. Let's check `layout.tsx` to see how next-intl is configured.

5. **Enhanced Barcode Scanner**
   - "Product Not Found" toast: Easy. In `page.tsx`'s `handleBarcodeDetected`, if `!product`, call `toast({ title: 'Product Not Found', description: \`Barcode \${barcode} not found.\`, variant: 'destructive' })`.
   - "Live Preview": In `CameraScannerDialog.tsx`, import `useCartStore` and render a small, overlaid list of recent cart items.
