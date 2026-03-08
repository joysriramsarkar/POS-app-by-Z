'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { CheckoutDialog, type PaymentData } from '@/components/pos/CheckoutDialog';
import { PrintDialog } from '@/components/pos/PrintDialog';
import { Dashboard } from '@/components/pos/Dashboard';
import { StockManagement } from '@/components/pos/StockManagement';
import { AddStockDialog, type StockEntryData } from '@/components/pos/AddStockDialog';
import { ProductDialog, type ProductFormData } from '@/components/pos/ProductDialog';
import { PartiesManagement } from '@/components/pos/PartiesManagement';
import { PrintDialog } from '@/components/pos/PrintDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Wifi,
  WifiOff,
  ShoppingCart,
  Menu,
  Store,
  RefreshCw,
  Package,
  LayoutDashboard,
  FileText,
  Users,
  Settings,
} from 'lucide-react';
import { useCartStore, useProductsStore, useSyncStore, useUIStore, useCustomersStore, useSalesStore } from '@/stores/pos-store';
import { useSimpleBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { ProductsDB } from '@/lib/offline/indexeddb';
import { STORE_CONFIG } from '@/types/pos';
import type { Product, Sale, PrintFormat } from '@/types/pos';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

// Sample products for demo
const SAMPLE_PRODUCTS: Product[] = [
  {
    id: '1',
    barcode: '8901234567890',
    name: 'Tata Salt',
    nameBn: 'টাটা লবণ',
    category: 'Groceries',
    buyingPrice: 20,
    sellingPrice: 25,
    unit: 'packet',
    currentStock: 50,
    minStockLevel: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    barcode: '8901234567891',
    name: 'Aashirvaad Atta 5kg',
    nameBn: 'আশির্বাদ আটা ৫ কেজি',
    category: 'Groceries',
    buyingPrice: 250,
    sellingPrice: 280,
    unit: 'packet',
    currentStock: 30,
    minStockLevel: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    barcode: '8901234567892',
    name: 'Fortune Rice Bran Oil 1L',
    category: 'Oils',
    buyingPrice: 150,
    sellingPrice: 175,
    unit: 'liter',
    currentStock: 20,
    minStockLevel: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '4',
    barcode: '8901234567893',
    name: 'Amul Butter 500g',
    category: 'Dairy',
    buyingPrice: 250,
    sellingPrice: 280,
    unit: 'packet',
    currentStock: 15,
    minStockLevel: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '5',
    barcode: '8901234567894',
    name: 'Sugar 1kg',
    nameBn: 'চিনি ১ কেজি',
    category: 'Groceries',
    buyingPrice: 40,
    sellingPrice: 48,
    unit: 'kg',
    currentStock: 100,
    minStockLevel: 20,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '6',
    barcode: '8901234567895',
    name: 'Toor Dal 1kg',
    nameBn: 'তুঁড় ডাল ১ কেজি',
    category: 'Pulses',
    buyingPrice: 120,
    sellingPrice: 140,
    unit: 'kg',
    currentStock: 25,
    minStockLevel: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '7',
    barcode: '8901234567896',
    name: 'Surf Excel 1kg',
    category: 'Household',
    buyingPrice: 140,
    sellingPrice: 160,
    unit: 'packet',
    currentStock: 18,
    minStockLevel: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '8',
    barcode: '8901234567897',
    name: 'Maggi 2-Min Noodles',
    nameBn: 'ম্যাগি নুডলস',
    category: 'Snacks',
    buyingPrice: 12,
    sellingPrice: 14,
    unit: 'packet',
    currentStock: 3,
    minStockLevel: 20,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '9',
    barcode: '8901234567898',
    name: 'Parle-G Biscuits',
    category: 'Snacks',
    buyingPrice: 10,
    sellingPrice: 12,
    unit: 'packet',
    currentStock: 0,
    minStockLevel: 15,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '10',
    barcode: '8901234567899',
    name: 'Tomato (Local)',
    nameBn: 'টমেটো',
    category: 'Vegetables',
    buyingPrice: 30,
    sellingPrice: 40,
    unit: 'kg',
    currentStock: 50,
    minStockLevel: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '11',
    barcode: '8901234567900',
    name: 'Onion (Local)',
    nameBn: 'পেঁয়াজ',
    category: 'Vegetables',
    buyingPrice: 25,
    sellingPrice: 35,
    unit: 'kg',
    currentStock: 80,
    minStockLevel: 20,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '12',
    barcode: '8901234567901',
    name: 'Potato (Local)',
    nameBn: 'আলু',
    category: 'Vegetables',
    buyingPrice: 20,
    sellingPrice: 28,
    unit: 'kg',
    currentStock: 100,
    minStockLevel: 30,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

type PageType = 'dashboard' | 'billing' | 'stock' | 'parties' | 'reports' | 'settings';

const navItems: { id: PageType; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'billing', label: 'Billing', icon: <ShoppingCart className="w-5 h-5" /> },
  { id: 'stock', label: 'Stock / Items', icon: <Package className="w-5 h-5" /> },
  { id: 'parties', label: 'Parties', icon: <Users className="w-5 h-5" /> },
  { id: 'reports', label: 'Reports', icon: <FileText className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

export default function Home() {
  const [currentPage, setCurrentPage] = useState<PageType>('billing');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);

  // Store hooks
  const products = useProductsStore((state) => state.products);
  const setProducts = useProductsStore((state) => state.setProducts);
  const isLoading = useProductsStore((state) => state.isLoading);
  const setLoading = useProductsStore((state) => state.setLoading);
  const getProductByBarcode = useProductsStore((state) => state.getProductByBarcode);
  const updateProductStock = useProductsStore((state) => state.updateProductStock);
  const updateProduct = useProductsStore((state) => state.updateProduct);
  const addProduct = useProductsStore((state) => state.addProduct);

  const customers = useCustomersStore((state) => state.customers);
  const updateCustomerDue = useCustomersStore((state) => state.updateCustomerDue);

  const addSale = useSalesStore((state) => state.addSale);

  const addItem = useCartStore((state) => state.addItem);
  const setLastScannedBarcode = useCartStore((state) => state.setLastScannedBarcode);
  const getItemCount = useCartStore((state) => state.getItemCount);
  const cartItems = useCartStore((state) => state.items);

  const isOnline = useSyncStore((state) => state.isOnline);
  const setOnline = useSyncStore((state) => state.setOnline);
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const pendingCount = useSyncStore((state) => state.pendingCount);

  const isCheckoutOpen = useUIStore((state) => state.isCheckoutOpen);
  const setCheckoutOpen = useUIStore((state) => state.setCheckoutOpen);
  const isPrintDialogOpen = useUIStore((state) => state.isPrintDialogOpen);
  const setPrintDialogOpen = useUIStore((state) => state.setPrintDialogOpen);
  const currentSale = useUIStore((state) => state.currentSale);

  const isPrintDialogOpen = useUIStore((state) => state.isPrintDialogOpen);
  const setPrintDialogOpen = useUIStore((state) => state.setPrintDialogOpen);

  const itemCount = getItemCount();

  // Load products on mount
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        // Try to load from IndexedDB first
        const cachedProducts = await ProductsDB.getAll();
        if (cachedProducts.length > 0) {
          setProducts(cachedProducts);
        } else {
          // Use sample products for demo
          setProducts(SAMPLE_PRODUCTS);
          // Cache them
          await ProductsDB.upsertMany(SAMPLE_PRODUCTS);
        }
      } catch (error) {
        console.error('Failed to load products:', error);
        // Fallback to sample products
        setProducts(SAMPLE_PRODUCTS);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [setProducts, setLoading]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  // Barcode scanner handler
  const handleBarcodeDetected = useCallback(
    (barcode: string) => {
      const product = getProductByBarcode(barcode);
      if (product) {
        addItem(product, 1);
        setLastScannedBarcode(barcode);
        // Switch to billing page if not already there
        if (currentPage !== 'billing') {
          setCurrentPage('billing');
        }
      } else {
        console.log('Product not found for barcode:', barcode);
      }
    },
    [getProductByBarcode, addItem, setLastScannedBarcode, currentPage]
  );

  // Initialize barcode scanner
  useSimpleBarcodeScanner({
    onBarcodeDetected: handleBarcodeDetected,
    enabled: !isCheckoutOpen,
  });

  // Handle checkout completion
  const handleCheckoutComplete = useCallback(async (paymentData: PaymentData) => {
    setIsProcessingPayment(true);
    try {
      console.log('Payment completed:', paymentData);

      // Construct Sale object
      const newSale: Sale = {
        id: uuidv4(),
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        customerId: paymentData.customerId,
        subtotal: paymentData.subtotal,
        discount: paymentData.discount,
        tax: paymentData.tax,
        totalAmount: paymentData.total,
        paymentMethod: paymentData.paymentMethod,
        paymentStatus: paymentData.paymentMethod === 'Due' ? 'Due' : 'Paid',
        status: 'Completed',
        offlineSynced: isOnline,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: cartItems.map(item => ({
          id: uuidv4(),
          saleId: '', // Set below
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          createdAt: new Date(),
        }))
      };

      // Update the items with the newly generated sale ID
      newSale.items = newSale.items.map(item => ({...item, saleId: newSale.id}));

      if (paymentData.customerId) {
        const customer = customers.find(c => c.id === paymentData.customerId);
        if (customer) {
          newSale.customer = customer;
        }
      }

      setCurrentSale(newSale);
      addSale(newSale);

      // Handle stock reduction
      cartItems.forEach(item => {
        updateProductStock(item.productId, -item.quantity);
      });

      // Handle Customer Due
      if (paymentData.paymentMethod === 'Due' && paymentData.customerId) {
         updateCustomerDue(paymentData.customerId, paymentData.total);
      }

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Clear the cart right after the transaction is generated and verified
      clearCart();

    } catch (error) {
      console.error('Payment failed:', error);
    } finally {
      setIsProcessingPayment(false);
    }
  }, [cartItems, updateProductStock, updateCustomerDue, customers, addSale, clearCart]);

  const handlePrint = useCallback((paymentData: PaymentData) => {
     if (!currentSale) return;
     setPrintDialogOpen(true);
  }, [currentSale, setPrintDialogOpen]);

  const handleOpenCheckout = useCallback(() => {
    setCheckoutOpen(true);
  }, [setCheckoutOpen]);

  // Handle stock entry
  const handleStockEntry = useCallback((data: StockEntryData) => {
    console.log('Stock entry:', data);
    updateProductStock(data.productId, data.quantity);
  }, [updateProductStock]);

  // Handle product save
  const handleProductSave = useCallback((data: ProductFormData) => {
    if (data.id) {
      // Update existing product
      updateProduct(data.id, {
        name: data.name,
        nameBn: data.nameBn,
        barcode: data.barcode,
        category: data.category,
        buyingPrice: data.buyingPrice,
        sellingPrice: data.sellingPrice,
        unit: data.unit,
        currentStock: data.currentStock,
        minStockLevel: data.minStockLevel,
        isActive: data.isActive,
      });
    } else {
      // Add new product
      const newProduct: Product = {
        id: uuidv4(),
        barcode: data.barcode || null,
        name: data.name,
        nameBn: data.nameBn,
        category: data.category,
        buyingPrice: data.buyingPrice,
        sellingPrice: data.sellingPrice,
        unit: data.unit,
        currentStock: data.currentStock,
        minStockLevel: data.minStockLevel,
        isActive: data.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addProduct(newProduct);
    }
  }, [updateProduct, addProduct]);

  // Handle navigation
  const handleNavigate = useCallback((page: string) => {
    setCurrentPage(page as PageType);
    setIsMobileMenuOpen(false);
  }, []);

  // Open add stock for specific product
  const handleAddStock = useCallback((product: Product) => {
    setSelectedProduct(product);
    setIsAddStockOpen(true);
  }, []);

  // Open edit product
  const handleEditProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setIsProductDialogOpen(true);
  }, []);

  // Open add product
  const handleAddProduct = useCallback(() => {
    setSelectedProduct(null);
    setIsProductDialogOpen(true);
  }, []);

  // Render sidebar navigation
  const renderSidebar = () => (
    <nav className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-sm">{STORE_CONFIG.name}</h1>
            <p className="text-xs text-muted-foreground">{STORE_CONFIG.nameBn}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
              currentPage === item.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-foreground'
            )}
          >
            {item.icon}
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="p-4 border-t">
        <div className="flex items-center gap-2">
          <Badge
            variant={isOnline ? 'default' : 'secondary'}
            className={cn(
              isOnline ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600'
            )}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 mr-1" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 mr-1" />
                Offline
              </>
            )}
          </Badge>
          {isSyncing && (
            <Badge variant="outline" className="gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Syncing
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="outline" className="text-amber-600">
              {pendingCount} pending
            </Badge>
          )}
        </div>
      </div>
    </nav>
  );

  // Render page content
  const renderPageContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'billing':
        return (
          <div className="flex h-full">
            {/* Product Grid */}
            <div className="flex-1 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                    <p className="text-muted-foreground">Loading products...</p>
                  </div>
                </div>
              ) : (
                <ProductGrid />
              )}
            </div>

            {/* Desktop Cart Panel */}
            <aside className="hidden sm:block w-96 border-l bg-card shrink-0">
              <CartPanel onCheckout={handleOpenCheckout} customers={customers} />
            </aside>
          </div>
        );
      case 'stock':
        return (
          <StockManagement
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onAddStock={handleAddStock}
          />
        );
      case 'parties':
        return <PartiesManagement />;
      case 'reports':
        return (
          <div className="flex flex-col h-full">
            <div className="shrink-0 border-b bg-background p-4">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Reports
              </h1>
              <p className="text-sm text-muted-foreground">View sales and business reports</p>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Reports Coming Soon</p>
                <p className="text-sm text-muted-foreground mt-1">Sales, profit, and inventory reports</p>
              </div>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="flex flex-col h-full">
            <div className="shrink-0 border-b bg-background p-4">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-6 h-6" />
                Settings
              </h1>
              <p className="text-sm text-muted-foreground">Configure your store settings</p>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Settings Coming Soon</p>
                <p className="text-sm text-muted-foreground mt-1">Store profile, printer, and more</p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 border-r bg-card shrink-0">
        {renderSidebar()}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden shrink-0 border-b bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Mobile Menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                {renderSidebar()}
              </SheetContent>
            </Sheet>

            {/* Store Name */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-sm">{STORE_CONFIG.name}</h1>
              </div>
            </div>

            {/* Mobile Cart Button (for billing page) */}
            {currentPage === 'billing' && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="relative">
                    <ShoppingCart className="w-5 h-5" />
                    {itemCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {itemCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-96 p-0">
                  <CartPanel onCheckout={handleOpenCheckout} customers={customers} />
                </SheetContent>
              </Sheet>
            )}

            {/* Page indicator for non-billing pages */}
            {currentPage !== 'billing' && (
              <Badge variant="secondary" className="text-xs">
                {navItems.find(n => n.id === currentPage)?.label}
              </Badge>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden">
          {renderPageContent()}
        </main>
      </div>

      {/* Checkout Dialog */}
      <CheckoutDialog
        onComplete={handleCheckoutComplete}
        onPrint={handlePrint}
        isProcessing={isProcessingPayment}
      />

      {/* Add Stock Dialog */}
      <AddStockDialog
        open={isAddStockOpen}
        onOpenChange={setIsAddStockOpen}
        product={selectedProduct}
        onSubmit={handleStockEntry}
      />

      {/* Product Dialog */}
      <ProductDialog
        open={isProductDialogOpen}
        onOpenChange={setIsProductDialogOpen}
        product={selectedProduct}
        onSubmit={handleProductSave}
      />

      {/* Print Dialog */}
      <PrintDialog
        open={isPrintDialogOpen}
        onOpenChange={setPrintDialogOpen}
        sale={currentSale}
      />
    </div>
  );
}
