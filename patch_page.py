import re

with open("src/app/page.tsx", "r") as f:
    content = f.read()

# 1. Update mobileBottomNavItems
nav_items_old = """const mobileBottomNavItems: { id: PageType | 'scan'; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'billing', label: 'Bill', icon: <ShoppingCart className="w-5 h-5" /> },
  { id: 'scan', label: 'Scan', icon: <ScanLine className="w-5 h-5" /> },  // ← প্রমিনেন্ট স্ক্যান বাটন
  { id: 'stock', label: 'Stock', icon: <Package className="w-5 h-5" /> },
  { id: 'parties', label: 'Parties', icon: <Users className="w-5 h-5" /> },
];"""

nav_items_new = """const mobileBottomNavItems: { id: PageType | 'menu'; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="w-6 h-6 md:w-5 md:h-5" /> },
  { id: 'billing', label: 'Bill', icon: <ShoppingCart className="w-6 h-6 md:w-5 md:h-5" /> },
  { id: 'stock', label: 'Stock', icon: <Package className="w-6 h-6 md:w-5 md:h-5" /> },
  { id: 'menu', label: 'Menu', icon: <Menu className="w-6 h-6 md:w-5 md:h-5" /> },
];"""

content = content.replace(nav_items_old, nav_items_new)

# 2. Hide Mobile Header
header_old = """<header className="lg:hidden shrink-0 border-b border-border/50 bg-card/80 backdrop-blur-md px-4 py-3 no-print sticky top-0 z-20">"""
header_new = """<header className="hidden lg:hidden shrink-0 border-b border-border/50 bg-card/80 backdrop-blur-md px-4 py-3 no-print sticky top-0 z-20">"""

content = content.replace(header_old, header_new)

# 3. Add Custom Menu Drawer for Secondary Links
# We will intercept the Sheet component.
sheet_old = """<Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary transition-colors">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 border-r-0 shadow-2xl">
                {renderSidebar()}
              </SheetContent>
            </Sheet>"""

sheet_new = """<Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetContent side="bottom" className="w-full p-4 border-t-0 shadow-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto">
                <div className="flex flex-col gap-4">
                  <h2 className="text-lg font-bold border-b pb-2">Menu</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {navItems.filter(item => ['reports', 'settings', 'parties', 'users'].includes(item.id)).map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleNavigate(item.id)}
                        className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-primary/10 transition-colors gap-2"
                      >
                        {item.icon}
                        <span className="text-sm font-medium">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>"""

content = content.replace(sheet_old, sheet_new)

# 4. Handle Menu Click in Bottom Nav
bottom_nav_old = """              onClick={() => {
                if (item.id === 'scan') {
                  handleOpenMobileScanner();
                } else {
                  setCurrentPage(item.id as PageType);
                }
              }}"""

bottom_nav_new = """              onClick={() => {
                if (item.id === 'menu') {
                  setIsMobileMenuOpen(true);
                } else {
                  setCurrentPage(item.id as PageType);
                }
              }}"""

content = content.replace(bottom_nav_old, bottom_nav_new)

# 5. Handle Barcode Not Found Toast
barcode_old = """      const product = getProductByBarcode(barcode);
      if (product) {
        addItem(product, 1);
        setLastScannedBarcode(barcode);
        // Switch to billing page if not already there
        if (currentPage !== 'billing') {
          setCurrentPage('billing');
        }
      } else {
        console.log('Product not found for barcode:', barcode);
      }"""

barcode_new = """      const product = getProductByBarcode(barcode);
      if (product) {
        addItem(product, 1);
        setLastScannedBarcode(barcode);
        // Switch to billing page if not already there
        if (currentPage !== 'billing') {
          setCurrentPage('billing');
        }
      } else {
        toast({
          title: 'Product Not Found',
          description: `Barcode ${barcode} not found in database.`,
          variant: 'destructive',
        });
        console.log('Product not found for barcode:', barcode);
      }"""

content = content.replace(barcode_old, barcode_new)

with open("src/app/page.tsx", "w") as f:
    f.write(content)
