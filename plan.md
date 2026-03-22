1. **Navigation Redesign (Mobile View Only)**
   - Remove Sidebar from mobile: In `src/app/page.tsx`, completely hide the header triggering the sidebar sheet or update the bottom nav so that "Menu" opens the sheet instead. The requirements say: *Remove Sidebar: Completely hide the Sidebar component on mobile screens. Implement Bottom Navigation: Home/Dashboard, Billing, Stock, Menu.*
   - Currently, there's a mobile header with a `Menu` button opening the sidebar, and a bottom nav with `Home`, `Bill`, `Scan`, `Stock`, `Parties`. We need to change the bottom nav to exactly: `Home`, `Billing`, `Stock`, `Menu` (which opens the sidebar/drawer).
   - In `src/app/page.tsx`, I will modify `mobileBottomNavItems` to have these 4 items. The `Menu` tab click will toggle `isMobileMenuOpen` which will open a modified drawer (containing secondary links: Reports, Settings, Parties, Users). Wait, the prompt says "Menu: A 'More' toggle that opens a mobile-optimized drawer/overlay containing secondary links: Reports, Settings, Parties, and Users Management." I will update the Sheet in `page.tsx` to serve as this mobile-optimized drawer.
   - Also need to hide the top mobile header since the menu is moving to the bottom nav.
2. **UI Density & Touch Optimization**
   - *Typography & Icons:* Increase font sizes and icon sizes for mobile elements using `md:text-sm text-base` or similar responsive utilities where applicable.
   - *Whitespace Management:* Reduce padding/margins in `Card`, `Button`, `List` components on mobile. I'll need to check the main files like `ProductGrid.tsx`, `CartPanel.tsx`, `TransactionHistory.tsx`.
   - *Transaction History:* In `TransactionHistory.tsx`, make the data table horizontally scrollable (`overflow-x-auto` wrapper), and condense filter inputs/icons to remove vertical/horizontal empty space on mobile.
3. **Functional Fixes & Logic Enhancements**
   - *Mobile Printing:* Update `printUtility.ts` and `PrintInvoice.tsx`. Capacitor printing failing on Android needs to be addressed. Perhaps web-view printing or an alternative native call.
   - *Internationalization (i18n):* Fix the language switching in Settings menu. I'll inspect `SettingsManagement.tsx` and check how `settings-store.ts` handles `app_language` and how `next-intl` is updated. (Maybe missing page refresh or provider update).
   - *Enhanced Barcode Scanner:*
     - "Product Not Found" toast: in `page.tsx`'s `handleBarcodeDetected`, if product is not found, trigger a toast notification.
     - Live Preview: Add a "Live Cart View" overlay in `CameraScannerDialog.tsx` showing items in the cart real-time. (We can pass `cartItems` to `CameraScannerDialog` or connect to store).
4. **Pre-commit step**
   - Run tests and pre-commit checks.
