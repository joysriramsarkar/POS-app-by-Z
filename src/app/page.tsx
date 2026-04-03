'use client';

import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
const CartPanel = dynamic(() => import('@/components/pos/CartPanel'), { ssr: false });
import { CameraScannerDialog } from '@/components/pos/CameraScannerDialog';
import { CheckoutDialog, type PaymentData } from '@/components/pos/CheckoutDialog';
import { PrintDialog } from '@/components/pos/PrintDialog';
import { Dashboard } from '@/components/pos/Dashboard';
import { StockManagement } from '@/components/pos/StockManagement';
import { AddStockDialog, type StockEntryData } from '@/components/pos/AddStockDialog';
import { ProductDialog, type ProductFormData } from '@/components/pos/ProductDialog';
import { PartiesManagement } from '@/components/pos/PartiesManagement';
import { UsersManagement } from '@/components/pos/UsersManagement';
import { TransactionHistory } from '@/components/pos/TransactionHistory';
import { Reports } from '@/components/pos';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOfflineContext } from '@/lib/offline/offline-context';
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
  Search,
  X,
  ScanLine,
  UserCog,
  History,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useCartStore, useProductsStore, useSyncStore, useUIStore, useCustomersStore } from '@/stores/pos-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useSimpleBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { ProductsDB, SalesDB, SyncQueueDB, CustomersDB } from '@/lib/offline/indexeddb';
import { STORE_CONFIG } from '@/types/pos';
import SettingsManagement from '@/components/pos/SettingsManagement';
import type { Product, Sale } from '@/types/pos';
import { cn } from '@/lib/utils';
import { convertBengaliToEnglishNumerals } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { generateInvoiceNumber } from '@/lib/invoice';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

// Removing SAMPLE_PRODUCTS as we load them dynamically from the database now.

type PageType = 'dashboard' | 'billing' | 'stock' | 'parties' | 'reports' | 'transactions' | 'settings' | 'users' | 'menu';

const navItems: { id: Exclude<PageType, 'menu'>; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'billing', label: 'Billing', icon: <ShoppingCart className="w-5 h-5" /> },
  { id: 'stock', label: 'Inventory Management', icon: <Package className="w-5 h-5" /> },
  { id: 'parties', label: 'Parties', icon: <Users className="w-5 h-5" /> },
  { id: 'reports', label: 'Reports', icon: <FileText className="w-5 h-5" /> },
  { id: 'transactions', label: 'Transactions', icon: <History className="w-5 h-5" /> },
  { id: 'users', label: 'Users', icon: <UserCog className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

// নতুন মোবাইল বটম নেভিগেশন আইটেম যোগ
const mobileBottomNavItems: { id: PageType | 'menu'; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="w-6 h-6 md:w-5 md:h-5" /> },
  { id: 'billing', label: 'Bill', icon: <ShoppingCart className="w-6 h-6 md:w-5 md:h-5" /> },
  { id: 'stock', label: 'Stock', icon: <Package className="w-6 h-6 md:w-5 md:h-5" /> },
  { id: 'menu', label: 'Menu', icon: <Menu className="w-6 h-6 md:w-5 md:h-5" /> },
];

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
};

function POSDashboard() {
  const [currentPage, setCurrentPage] = useState<PageType>('billing');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Auth
  const { data: session } = useSession();
  const userRole = (session?.user as { id?: string; role?: string; username?: string })?.role;

  // Offline context - USE THIS INSTEAD OF SYNC STORE for isOnline
  const { isOnline: isOnlineContext, networkStatus } = useOfflineContext();
  const [isOnline, setIsOnline] = useState(isOnlineContext);

  useEffect(() => {
    setIsOnline(isOnlineContext);
  }, [isOnlineContext]);

  // Settings store
  const { settings } = useSettingsStore();
  const storeName = settings?.store_name || STORE_CONFIG.name;
  const storeNameBn = settings?.store_name_bn || STORE_CONFIG.nameBn;
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [completedCheckoutSale, setCompletedCheckoutSale] = useState<Sale | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMobileScannerOpen, setIsMobileScannerOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');

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
  const getTotal = useCartStore((state) => state.getTotal);
  const cartItems = useCartStore((state) => state.items);

  // Removed isOnline from useSyncStore - now using useOfflineContext above
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
  const total = getTotal();

  // Filter nav items based on user role
  const filteredNavItems = useMemo(() => {
    if (userRole === 'ADMIN') {
      return navItems; // Admin can see all items
    } else if (userRole === 'MANAGER') {
      return navItems.filter(item => item.id !== 'users' && item.id !== 'settings');
    } else {
      // Cashier and Viewer - limit access
      return navItems.filter(item => 
        item.id === 'dashboard' || 
        item.id === 'billing' || 
        item.id === 'parties' || 
        item.id === 'reports' || 
        item.id === 'transactions'
      );
    }
  }, [userRole]);

  // Mobile product search
  const filteredMobileProducts = useMemo(() => {
    if (!mobileSearchQuery) return [];
    return products.filter((product) => {
      if (!product.isActive) return false;
      const lowerQuery = mobileSearchQuery.toLowerCase();
      const normalizedQuery = convertBengaliToEnglishNumerals(mobileSearchQuery);
      const matchesName = product.name.toLowerCase().includes(lowerQuery);
      const matchesBengaliName = product.nameBn?.includes(mobileSearchQuery);
      const matchesBarcode = product.barcode?.includes(mobileSearchQuery);
      const matchesBarcodeNormalized = convertBengaliToEnglishNumerals(product.barcode || '').includes(normalizedQuery);
      return matchesName || matchesBengaliName || matchesBarcode || matchesBarcodeNormalized;
    });
  }, [products, mobileSearchQuery]);

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
        
        try {
          const res = await fetch('/api/products?limit=50', { signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (res.ok) {
            const { data: products, nextCursor } = await res.json();
            const hasMore = !!nextCursor;
            setProducts(products, hasMore, nextCursor);
            // Update cache
            await ProductsDB.upsertMany(products);
            setOnline(true);
            return;
          } else {
            console.warn('API returned error:', res.status);
            throw new Error(`API error: ${res.status}`);
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          throw fetchErr;
        }
      } catch (error) {
        console.error('Failed to load products from API:', error instanceof Error ? error.message : String(error));
        // Mark as offline since API failed
        setOnline(false);
        
        try {
          // Fallback to IndexedDB
          const cachedProducts = await ProductsDB.getAll();
          if (cachedProducts.length > 0) {
            console.log(`✅ Using ${cachedProducts.length} cached products from offline storage`);
            setProducts(cachedProducts);
          } else {
            console.warn('No cached products available');
          }
        } catch (dbError) {
          console.error('Failed to load products from cache:', dbError);
        }
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [setProducts, setLoading, setOnline]);

  // Monitor online status - check both navigator.onLine AND actual API connectivity
  useEffect(() => {
    const checkConnectivity = async () => {
      // First check navigator.onLine
      if (!navigator.onLine) {
        console.log('🔴 Offline: navigator.onLine = false');
        setOnline(false);
        return;
      }

      // Try to verify connection by testing a simple API call
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        try {
          const response = await fetch('/api/auth/session', {
            method: 'GET',
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            console.log('🟢 Online: Database connection verified');
            setOnline(true);
          } else {
            console.log('🔴 Offline: API returned error', response.status);
            setOnline(false);
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          throw fetchErr;
        }
      } catch (error) {
        console.log('🔴 Offline: API connectivity check failed', error instanceof Error ? error.message : String(error));
        setOnline(false);
      }
    };

    // Check on mount
    checkConnectivity();

    // Check periodically (every 10 seconds)
    const interval = setInterval(checkConnectivity, 10000);

    // Listen to navigator online/offline events
    const handleOnline = () => checkConnectivity();
    const handleOffline = () => {
      console.log('🔴 Offline event detected');
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  // Barcode scanner handler
  const lastScannedRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 });

  const handleBarcodeDetected = useCallback(
    (barcode: string) => {
      const now = Date.now();

      // Debounce logic: prevent the same barcode from being scanned multiple times within 1000ms
      if (lastScannedRef.current.barcode === barcode && now - lastScannedRef.current.time < 1000) {
        return;
      }

      lastScannedRef.current = { barcode, time: now };
      const product = getProductByBarcode(barcode);
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
      }
    },
    [getProductByBarcode, addItem, setLastScannedBarcode, currentPage]
  );

  const handleOpenMobileScanner = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { camera } = await BarcodeScanner.requestPermissions();
        if (camera === 'granted' || camera === 'limited') {
          const { barcodes } = await BarcodeScanner.scan();
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            handleBarcodeDetected(barcodes[0].rawValue);
          }
        } else {
          toast({
            title: 'Permission Denied',
            description: 'Camera permission is required to scan barcodes.',
            variant: 'destructive',
          });
          setIsMobileScannerOpen(true); // Fallback to dialog if they want to try again / see error there
        }
      } catch (error) {
        console.error('Native barcode scan failed:', error);
        setIsMobileScannerOpen(true); // Fallback to dialog
      }
    } else {
      setIsMobileScannerOpen(true);
    }
  }, [handleBarcodeDetected, toast]);

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
        usePrepaid: paymentData.usePrepaid,
        prepaidAmountUsed: paymentData.prepaidAmountUsed,
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
            
            // ⚠️ CRITICAL: Catch ALL database/server errors that should trigger offline fallback
            // Include 5xx server errors, connection issues, and transaction timeouts
            const shouldFallbackToOffline = 
              response.status >= 500 || // Any server error (500, 502, 503, etc.)
              errorMessage.includes('P1001') || // Prisma: Can't reach database
              errorMessage.includes('connection') || // Generic connection error
              errorMessage.includes('Can\'t reach') || // Prisma connection error
              errorMessage.includes('Transaction API error') || // Transaction timeout/pool exhaustion
              errorMessage.includes('Unable to start a transaction') || // Transaction start failure
              errorMessage.includes('timed out') || // Query timeout
              errorMessage.includes('pool') || // Connection pool issue
              errorMessage.includes('ECONNREFUSED') || // Connection refused
              errorMessage.includes('ECONNRESET'); // Connection reset
            
            if (shouldFallbackToOffline) {
              console.warn('⚠️ Database unreachable or overloaded, falling back to offline mode');
              console.warn('📋 Error details:', { status: response.status, message: errorMessage });
              throw new Error('DATABASE_UNAVAILABLE');
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
          const [productsResult, customersResult] = await Promise.allSettled([
            fetch('/api/products?limit=50'),
            fetch('/api/customers'),
          ]);

          if (productsResult.status === 'fulfilled' && productsResult.value.ok) {
            const { data: updatedProducts, nextCursor } = await productsResult.value.json();
            const hasMore = !!nextCursor;
            setProducts(updatedProducts, hasMore, nextCursor);
          }

          if (customersResult.status === 'fulfilled' && customersResult.value.ok && paymentData.customerId) {
            // we know how much due to add
            const dueAmount = paymentData.total - paymentData.amountPaid;
            if (dueAmount > 0) {
              updateCustomerDue(paymentData.customerId, dueAmount);
            }
          }
        } catch (fetchError) {
          if (fetchError instanceof Error) {
            // If database is unavailable, also fallback to offline
            if (fetchError.message === 'DATABASE_UNAVAILABLE') {
              console.warn('⚠️ Falling back to offline mode due to database unavailability');
              // Treat as offline, continue to offline block below
              throw new Error('FALL_BACK_TO_OFFLINE');
            }
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
          userId: (session?.user as { id?: string })?.id, // Track which user created this sale
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to complete sale';
      
      // If DATABASE_UNAVAILABLE or FALL_BACK_TO_OFFLINE, switch to offline mode
      if (errorMessage === 'DATABASE_UNAVAILABLE' || errorMessage === 'FALL_BACK_TO_OFFLINE') {
        // Re-run the offline flow
        try {
          setIsOnline(false);
          // Retry the offline logic
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
            usePrepaid: paymentData.usePrepaid,
            prepaidAmountUsed: paymentData.prepaidAmountUsed,
          };
          
          let paymentStatus = 'Paid';
          if (paymentData.amountPaid === 0) paymentStatus = 'Due';
          else if (paymentData.amountPaid > 0 && paymentData.amountPaid < paymentData.total) paymentStatus = 'Partial';

          const sale: Sale = {
            id: uuidv4(),
            invoiceNumber: generateInvoiceNumber(),
            customerId: paymentData.customerId,
            userId: (session?.user as { id?: string })?.id,
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
          toast({ title: 'Database offline', description: 'Sale saved locally. Will sync when connection restored.' });
          return;
        } catch (offlineError) {
          console.error('Offline fallback failed:', offlineError);
        }
      }
      
      console.error('Checkout failed:', {
        error: error,
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
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
        const productsRes = await fetch('/api/products?limit=50');
        if (productsRes.ok) {
          const { data: refreshedProducts, nextCursor } = await productsRes.json();
          const hasMore = !!nextCursor;
          setProducts(refreshedProducts, hasMore, nextCursor);
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
      toast({
        title: 'Stock entry error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  }, [isOnline, updateProductStock, setProducts, pendingCount, toast]);

  // Handle product save
  const handleProductSave = useCallback(async (data: ProductFormData) => {
    try {
      if (!isOnline) {
        // offline: store locally and queue a sync entry
        if (data.id) {
          const updatedProductData: Partial<Product> = {
            ...data,
            barcode: data.barcode || null,
            updatedAt: new Date(),
          };
          updateProduct(data.id, updatedProductData);

          // Get existing product to preserve createdAt if possible
          const existingProduct = products.find(p => p.id === data.id);
          const fullProduct: Product = {
            id: data.id,
            name: data.name,
            nameBn: data.nameBn,
            barcode: data.barcode || null,
            category: data.category,
            buyingPrice: data.buyingPrice,
            sellingPrice: data.sellingPrice,
            unit: data.unit,
            currentStock: data.currentStock,
            minStockLevel: data.minStockLevel,
            isActive: data.isActive,
            createdAt: existingProduct?.createdAt || new Date(),
            updatedAt: new Date(),
          };
          ProductsDB.upsert(fullProduct);

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
          const newProduct: Product = {
            ...data,
            id: uuidv4(),
            barcode: data.barcode || null,
            currentStock: 0,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
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
      toast({
        title: 'Product save error',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive'
      });
    }
  }, [updateProduct, addProduct, isOnline, toast, products]);

  // Handle navigation
  const handleNavigate = useCallback((page: string) => {
    if (page === 'scan') {
      handleOpenMobileScanner();
      return;
    }
    setCurrentPage(page as PageType);
  }, [handleOpenMobileScanner]);

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
    <nav className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50">
      <div className="p-4 border-b bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-sm bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">{storeName}</h1>
            <p className="text-xs text-muted-foreground">{storeNameBn}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {filteredNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 font-medium group',
              currentPage === item.id
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                : 'hover:bg-primary/10 text-foreground hover:text-primary hover:scale-[1.01]'
            )}
          >
            <div className={cn(
              "transition-transform duration-200",
              currentPage === item.id ? "scale-110" : "group-hover:scale-110"
            )}>
              {item.icon}
            </div>
            <span className="font-medium tracking-tight">{item.label}</span>
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
            {/* Product Grid (desktop only) */}
            <div className="flex-1 hidden sm:flex flex-col overflow-hidden">
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

            {/* Mobile billing: cart + scan button (no product list) */}
            <div className="flex-1 flex flex-col overflow-hidden w-full sm:hidden min-h-0">
              <div className="p-2 md:p-3 border-b bg-background">
                <div className="flex flex-row items-center gap-2 w-full mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search products by name or barcode..."
                      value={mobileSearchQuery}
                      onChange={(e) => setMobileSearchQuery(e.target.value)}
                      className="pl-9 h-9 md:h-10 text-sm"
                    />
                    {mobileSearchQuery && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 md:h-8 md:w-8 p-0"
                        onClick={() => setMobileSearchQuery('')}
                      >
                        <X className="w-3 h-3 md:w-4 md:h-4" />
                      </Button>
                    )}
                  </div>
                  <Button size="sm" className="shrink-0 h-9 w-9 p-0 md:h-10 md:w-auto md:px-4" onClick={handleOpenMobileScanner}>
                    <ScanLine className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Scan</span>
                  </Button>
                </div>
              </div>

              {/* Search Results */}
              {mobileSearchQuery && (
                <div className="border-b bg-background max-h-48 overflow-y-auto">
                  <div className="p-3">
                    <h3 className="text-sm font-medium mb-2">Search Results ({filteredMobileProducts.length})</h3>
                    {filteredMobileProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No products found</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredMobileProducts.slice(0, 10).map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                            onClick={() => {
                              addItem(product, 1);
                              setMobileSearchQuery('');
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{product.name}</p>
                              {product.barcode && (
                                <p className="text-xs text-muted-foreground">{product.barcode}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sm">{formatPrice(product.sellingPrice)}</p>
                              {product.currentStock <= 0 && (
                                <p className="text-xs text-destructive">Out of stock</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0">
                <CartPanel onCheckout={handleOpenCheckout} customers={customers} onAddCustomer={handleOpenPartiesPage} onScan={handleOpenMobileScanner} />
              </div>
            </div>

            {/* Desktop Cart Panel */}
            <aside className="hidden sm:block w-96 border-l bg-card shrink-0">
              <CartPanel onCheckout={handleOpenCheckout} customers={customers} onAddCustomer={handleOpenPartiesPage} onScan={handleOpenMobileScanner} />
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
        return <Reports />;
      case 'transactions':
        return <TransactionHistory />;
      case 'menu':
        return (
          <div className="p-4 overflow-y-auto h-full">
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold">Menu</h1>
              <Button size="sm" variant="outline" onClick={() => setCurrentPage('dashboard')}>
                Back
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {filteredNavItems
                .filter((item) => ['reports', 'settings', 'parties', 'users', 'transactions'].includes(item.id))
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-primary/10 transition-colors gap-2"
                  >
                    {item.icon}
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                ))}
            </div>
          </div>
        );
      case 'users':
        return <UsersManagement />;
      case 'settings':
        return <SettingsManagement />;
      default:
        return null;
    }
  };

  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col lg:flex-row bg-slate-100/50 dark:bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 border-r border-border/50 bg-card shrink-0 no-print shadow-xs z-10 transition-all duration-300">
        {renderSidebar()}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {/* Mobile Header */}
        <header className="lg:hidden shrink-0 border-b border-border/50 bg-card/80 backdrop-blur-md px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] no-print sticky top-0 z-20">
          <div className="flex items-center justify-between gap-4">
            {/* Store Name */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shadow-sm">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-sm bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">{storeName}</h1>
              </div>
            </div>

            {/* Page indicator for non-billing pages */}
            {currentPage !== 'billing' && (
              <Badge variant="secondary" className="text-xs shadow-sm">
                {currentPage === 'menu' ? 'Menu' : navItems.find(n => n.id === currentPage)?.label}
              </Badge>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background pb-16 lg:rounded-tl-2xl lg:shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)] lg:border-t lg:border-l lg:border-border/50">
          {renderPageContent()}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-card/95 backdrop-blur-sm py-1 px-2 bottom-nav">
        <div className="flex items-center justify-between gap-1">
          {mobileBottomNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'menu') {
                  setCurrentPage('menu');
                } else {
                  setCurrentPage(item.id as PageType);
                }
              }}
              className={cn(
                'flex flex-col items-center justify-center flex-1 py-1 rounded-lg text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition',
                currentPage === item.id ? 'bg-primary/10 text-primary font-semibold' : ''
              )}
              aria-label={item.label}
            >
              {item.icon}
              <span className="mt-0.5 text-[10px] leading-none">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Mobile Scanner Dialog */}
      <CameraScannerDialog
        open={isMobileScannerOpen}
        onOpenChange={setIsMobileScannerOpen}
        onBarcodeScanned={handleBarcodeDetected}
        title="Scan Barcode"
        description="Position barcode/QR code in the center of the frame"
      />

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={isCheckoutOpen}
        onOpenChange={(open) => {
          setCheckoutOpen(open);
          // Reset completed sale when dialog closes
          if (!open) {
            setCompletedCheckoutSale(null);
          }
        }}
        onComplete={handleCheckoutComplete}
        isProcessing={isProcessingPayment}
        completedSale={completedCheckoutSale}
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
