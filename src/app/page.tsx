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
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useCartStore, useProductsStore, useSyncStore, useUIStore, useCustomersStore } from '@/stores/pos-store';
import { useSimpleBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { ProductsDB, SalesDB, SyncQueueDB, CustomersDB } from '@/lib/offline/indexeddb';
import { STORE_CONFIG } from '@/types/pos';
import type { Product, Sale } from '@/types/pos';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { generateInvoiceNumber } from '@/lib/invoice';

// Removing SAMPLE_PRODUCTS as we load them dynamically from the database now.

type PageType = 'dashboard' | 'billing' | 'stock' | 'parties' | 'reports' | 'settings';

const navItems: { id: PageType; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'billing', label: 'Billing', icon: <ShoppingCart className="w-5 h-5" /> },
  { id: 'stock', label: 'Stock / Items', icon: <Package className="w-5 h-5" /> },
  { id: 'parties', label: 'Parties', icon: <Users className="w-5 h-5" /> },
  { id: 'reports', label: 'Reports', icon: <FileText className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

function POSDashboard() {
  const [currentPage, setCurrentPage] = useState<PageType>('billing');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [completedCheckoutSale, setCompletedCheckoutSale] = useState<Sale | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

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
  const setCustomers = useCustomersStore((state) => state.setCustomers);

  const { toast } = useToast();

  const addItem = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const setLastScannedBarcode = useCartStore((state) => state.setLastScannedBarcode);
  const getItemCount = useCartStore((state) => state.getItemCount);
  const cartItems = useCartStore((state) => state.items);

  const isOnline = useSyncStore((state) => state.isOnline);
  const setOnline = useSyncStore((state) => state.setOnline);
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const setSyncing = useSyncStore((state) => state.setSyncing);
  const setPendingCount = useSyncStore((state) => state.setPendingCount);

  const isCheckoutOpen = useUIStore((state) => state.isCheckoutOpen);
  const setCheckoutOpen = useUIStore((state) => state.setCheckoutOpen);
  const isPrintDialogOpen = useUIStore((state) => state.isPrintDialogOpen);
  const setPrintDialogOpen = useUIStore((state) => state.setPrintDialogOpen);
  const currentSale = useUIStore((state) => state.currentSale);
  const setCurrentSale = useUIStore((state) => state.setCurrentSale);

  const itemCount = getItemCount();

  // Hydration tracking to prevent mismatches with store-dependent renders
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Load products on mount
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        // Fetch from API to get actual DB data
        const res = await fetch('/api/products');
        if (res.ok) {
          const { data: products } = await res.json();
          setProducts(products);
          // Update cache
          await ProductsDB.upsertMany(products);
        } else {
          // If API fails, try IndexedDB
          const cachedProducts = await ProductsDB.getAll();
          setProducts(cachedProducts);
        }
      } catch (error) {
        console.error('Failed to load products from API:', error);
        try {
          // Fallback to IndexedDB
          const cachedProducts = await ProductsDB.getAll();
          setProducts(cachedProducts);
        } catch (dbError) {
          console.error('Failed to load products from cache:', dbError);
        }
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

  // Sync pending offline operations when we regain connection
  useEffect(() => {
    if (!isOnline) return;

    const syncPending = async () => {
      setSyncing(true);
      try {
        const unsynced = await SyncQueueDB.getUnsynced();
        setPendingCount(unsynced.length);

        for (const item of unsynced) {
          try {
            const res = await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
            });

            if (res.ok) {
              await SyncQueueDB.markSynced(item.id);
              if (item.entityType === 'Sale') {
                await SalesDB.markSynced(item.entityId);
              }
            } else {
              const err = await res.json();
              console.error('Failed to sync item', item, err);
              break; // abandon further sync until next attempt
            }
          } catch (err) {
            console.error('Sync request failed', err);
            break;
          }
        }

        const remaining = await SyncQueueDB.getUnsynced();
        setPendingCount(remaining.length);

        // refresh caches after sync
        const [prods, custs] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/customers'),
        ]);
        if (prods.ok) {
          const { data } = await prods.json();
          setProducts(data);
        }
        if (custs.ok) {
          const { data } = await custs.json();
          setCustomers(data);
        }
      } finally {
        setSyncing(false);
      }
    };

    syncPending().catch(console.error);
  }, [isOnline, setSyncing, setPendingCount, setProducts, setCustomers]);

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
  // It should be disabled when any major dialog is open that might interfere or consume input
  const isAnyDialogOpen = isCheckoutOpen || isAddStockOpen || isProductDialogOpen || isPrintDialogOpen;

  useSimpleBarcodeScanner({
    onBarcodeDetected: handleBarcodeDetected,
    enabled: !isAnyDialogOpen,
  });

  // Handle checkout completion

  const handleCheckoutComplete = useCallback(async (paymentData: PaymentData) => {
    setIsProcessingPayment(true);
    try {
      const salePayload = {
        items: cartItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        customerId: paymentData.customerId,
        paymentMethod: paymentData.paymentMethod,
        amountPaid: paymentData.amountPaid,
        discount: paymentData.discount,
        tax: paymentData.tax,
      };

      if (isOnline) {
        try {
          const response = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(salePayload),
          });

          if (!response.ok) {
            let errorMessage = 'Failed to create sale';
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorMessage;
            } catch (parseError) {
              // If response is not JSON, use status text
              errorMessage = `Server error: ${response.statusText}`;
            }
            throw new Error(errorMessage);
          }

          const responseData = await response.json();
          const completedSale = responseData.data;

          // Set the completed sale to trigger success modal in CheckoutDialog
          setCompletedCheckoutSale(completedSale);
          setCurrentSale(completedSale);
          clearCart();

          // refresh products and customers from server
          const [productsRes, customersRes] = await Promise.all([
            fetch('/api/products'),
            fetch('/api/customers'),
          ]);

          if (productsRes.ok) {
            const { data: updatedProducts } = await productsRes.json();
            setProducts(updatedProducts);
          }

          if (customersRes.ok && paymentData.customerId) {
            // we know how much due to add
            const dueAmount = paymentData.total - paymentData.amountPaid;
            if (dueAmount > 0) {
              updateCustomerDue(paymentData.customerId, dueAmount);
            }
          }
        } catch (fetchError) {
          if (fetchError instanceof Error) {
            console.error('Fetch error:', fetchError.message);
            throw fetchError;
          } else {
            throw new Error('Network error while creating sale');
          }
        }
      } else {
        // --- OFFLINE FALLBACK ------------------------------------------------
        // create a local sale object and queue for sync
        let paymentStatus = 'Paid';
        if (paymentData.amountPaid === 0) paymentStatus = 'Due';
        else if (paymentData.amountPaid > 0 && paymentData.amountPaid < paymentData.total) paymentStatus = 'Partial';

        const sale: Sale = {
          id: uuidv4(),
          invoiceNumber: generateInvoiceNumber(),
          customerId: paymentData.customerId,
          subtotal: cartItems.reduce((s, it) => s + it.totalPrice, 0),
          discount: paymentData.discount,
          tax: paymentData.tax,
          totalAmount: paymentData.total,
          amountPaid: paymentData.amountPaid,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: paymentStatus as 'Paid' | 'Partial' | 'Due',
          status: 'Completed',
          notes: undefined,
          offlineSynced: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: cartItems.map(item => ({
            id: uuidv4(),
            saleId: '',
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            createdAt: new Date(),
          })),
        } as Sale;

        await SalesDB.save(sale);
        await SyncQueueDB.add({
          id: uuidv4(),
          entityType: 'Sale',
          entityId: sale.id,
          action: 'create',
          payload: JSON.stringify(sale),
          synced: false,
          retryCount: 0,
          createdAt: new Date(),
        });

        // adjust local stock and customer due
        cartItems.forEach((item) => {
          updateProductStock(item.productId, -item.quantity);
          ProductsDB.updateStock(item.productId, -item.quantity).catch(console.error);
        });

        if (paymentData.customerId) {
          const dueAmount = paymentData.total - paymentData.amountPaid;
          if (dueAmount > 0) {
            updateCustomerDue(paymentData.customerId, dueAmount);
            CustomersDB.updateDue(paymentData.customerId, dueAmount).catch(console.error);
          }
        }

        setCurrentSale(sale);
        setCompletedCheckoutSale(sale);
        clearCart();
        toast({ title: 'Offline sale saved', description: 'Will sync when connection is restored.' });
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Unable to complete sale';
      console.error('Checkout failed:', {
        error: error,
        message: errorMessage,
        stack: error?.stack,
      });
      
      // Reset checkout state on error
      setCompletedCheckoutSale(null);
      setCheckoutOpen(false);
      
      toast({
        title: 'Checkout error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsProcessingPayment(false);
    }
  }, [
    cartItems,
    isOnline,
    setCurrentSale,
    setPrintDialogOpen,
    clearCart,
    setProducts,
    updateCustomerDue,
    setCheckoutOpen,
    toast,
  ]);

  const handleOpenCheckout = useCallback(() => {
    setCheckoutOpen(true);
  }, [setCheckoutOpen]);

  // Handle opening parties page to add/select customer
  const handleOpenPartiesPage = useCallback(() => {
    setCurrentPage('parties');
  }, [setCurrentPage]);

  // Handle stock entry
  const handleStockEntry = useCallback(async (data: StockEntryData) => {
    try {
      if (isOnline) {
        // Send stock entry to backend API
        const response = await fetch('/api/stock-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: data.productId,
            quantity: data.quantity,
            purchasePrice: data.purchasePrice,
            date: data.date,
            supplierId: data.supplierId,
            notes: data.notes,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Stock entry failed:', errorData.error);
          toast({ title: 'Stock entry failed', description: errorData.error, variant: 'destructive' });
          return;
        }

        const { data: updatedProduct } = await response.json();

        // Update local store with new stock
        updateProductStock(data.productId, data.quantity);

        // Refetch all products to sync database changes
        const productsRes = await fetch('/api/products');
        if (productsRes.ok) {
          const { data: refreshedProducts } = await productsRes.json();
          setProducts(refreshedProducts);
        }

        console.log('Stock entry successful:', updatedProduct);
      } else {
        // offline: update local store and queue sync
        updateProductStock(data.productId, data.quantity);
        ProductsDB.updateStock(data.productId, data.quantity).catch(console.error);
        await SyncQueueDB.add({
          id: uuidv4(),
          entityType: 'Product',
          entityId: data.productId,
          action: 'update',
          payload: JSON.stringify({ productId: data.productId, quantityChange: data.quantity }),
          synced: false,
          retryCount: 0,
          createdAt: new Date(),
        });
        setPendingCount(pendingCount + 1);
        toast({ title: 'Offline entry saved', description: 'Stock will sync when back online.' });
      }
    } catch (error) {
      console.error('Stock entry error:', error);
      toast({ title: 'Stock entry error', description: (error as any)?.message || 'Unknown error', variant: 'destructive' });
    }
  }, [isOnline, updateProductStock, setProducts, pendingCount, toast]);

  // Handle product save
  const handleProductSave = useCallback(async (data: ProductFormData) => {
    try {
      if (!isOnline) {
        // offline: store locally and queue a sync entry
        if (data.id) {
          updateProduct(data.id, { ...data, updatedAt: new Date() } as any);
          ProductsDB.upsert({ ...(data as any), updatedAt: new Date(), createdAt: new Date(), currentStock: (data as any).currentStock || 0 });
          await SyncQueueDB.add({
            id: uuidv4(),
            entityType: 'Product',
            entityId: data.id,
            action: 'update',
            payload: JSON.stringify(data),
            synced: false,
            retryCount: 0,
            createdAt: new Date(),
          });
        } else {
          const newProduct = {
            ...data,
            id: uuidv4(),
            currentStock: 0,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any;
          addProduct(newProduct);
          ProductsDB.upsert(newProduct);
          await SyncQueueDB.add({
            id: uuidv4(),
            entityType: 'Product',
            entityId: newProduct.id,
            action: 'create',
            payload: JSON.stringify(newProduct),
            synced: false,
            retryCount: 0,
            createdAt: new Date(),
          });
        }

        toast({ title: 'Offline product saved', description: 'Changes will sync when online.' });
        return;
      }

      if (data.id) {
        // Update existing product
        const response = await fetch('/api/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update product');
        }
        
        const { data: updatedProduct } = await response.json();
        updateProduct(updatedProduct.id, updatedProduct);

      } else {
        // Add new product
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create product');
        }

        const { data: newProduct } = await response.json();
        addProduct(newProduct);
      }
    } catch (error) {
      console.error("Failed to save product:", error);
      toast({ title: 'Product save error', description: (error as any)?.message || 'Unexpected error', variant: 'destructive' });
    }
  }, [updateProduct, addProduct, isOnline, toast]);

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
              <CartPanel onCheckout={handleOpenCheckout} customers={customers} onAddCustomer={handleOpenPartiesPage} />
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
      <aside className="hidden lg:block w-64 border-r bg-card shrink-0 no-print">
        {renderSidebar()}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden shrink-0 border-b bg-card px-4 py-3 no-print">
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
                    {isHydrated && itemCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {itemCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-96 p-0">
                  <CartPanel onCheckout={handleOpenCheckout} customers={customers} onAddCustomer={handleOpenPartiesPage} />
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
        isProcessing={isProcessingPayment}
        completedSale={completedCheckoutSale}
        onOpenChange={(open) => {
          setCheckoutOpen(open);
          // Reset completed sale when dialog closes
          if (!open) {
            setCompletedCheckoutSale(null);
          }
        }}
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

export default function Home() {
  return (
    <ErrorBoundary>
      <POSDashboard />
    </ErrorBoundary>
  );
}
