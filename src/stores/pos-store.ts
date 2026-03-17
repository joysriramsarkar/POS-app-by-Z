// ============================================================================
// POS Store - Zustand State Management for Lakhan Bhandar
// ============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem, PaymentMethod, Product, Customer, Sale } from '@/types/pos';
import { v4 as uuidv4 } from 'uuid';
import { convertBengaliToEnglishNumerals } from '@/lib/utils';

// ============================================================================
// CART STORE
// ============================================================================

interface CartState {
  items: CartItem[];
  discount: number;
  tax: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  notes: string;
  lastScannedBarcode: string;
  isOfflineMode: boolean;
  pendingSyncCount: number;
}

interface CartActions {
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  setDiscount: (discount: number) => void;
  setTax: (tax: number) => void;
  setCustomer: (customer: Customer | null) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setAmountPaid: (amount: number) => void;
  setNotes: (notes: string) => void;
  setLastScannedBarcode: (barcode: string) => void;
  setOfflineMode: (isOffline: boolean) => void;
  setPendingSyncCount: (count: number) => void;
  getSubtotal: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

const initialCartState: CartState = {
  items: [],
  discount: 0,
  tax: 0,
  customerId: undefined,
  customerName: undefined,
  customerPhone: undefined,
  paymentMethod: 'Cash',
  amountPaid: 0,
  notes: '',
  lastScannedBarcode: '',
  isOfflineMode: false,
  pendingSyncCount: 0,
};

export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      ...initialCartState,

      addItem: (product: Product, quantity: number = 1) => {
        const currentItems = get().items;
        const existingItemIndex = currentItems.findIndex(
          (item) => item.productId === product.id
        );

        if (existingItemIndex >= 0) {
          const updatedItems = [...currentItems];
          const existingItem = updatedItems[existingItemIndex];
          const newQuantity = existingItem.quantity + quantity;

          updatedItems[existingItemIndex] = {
            ...existingItem,
            quantity: newQuantity,
            totalPrice: newQuantity * existingItem.unitPrice,
          };
          set({ items: updatedItems });
        } else {
          const newItem: CartItem = {
            id: uuidv4(),
            productId: product.id,
            productName: product.name,
            barcode: product.barcode || undefined,
            quantity: quantity,
            unitPrice: product.sellingPrice,
            totalPrice: quantity * product.sellingPrice,
            unit: product.unit,
            availableStock: product.currentStock,
          };
          set({ items: [...currentItems, newItem] });
        }
      },

      removeItem: (itemId: string) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
        }));
      },

      updateQuantity: (itemId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(itemId);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId
              ? { ...item, quantity, totalPrice: quantity * item.unitPrice }
              : item
          ),
        }));
      },

      clearCart: () => {
        set({
          items: [],
          discount: 0,
          tax: 0,
          customerId: undefined,
          customerName: undefined,
          customerPhone: undefined,
          paymentMethod: 'Cash',
          amountPaid: 0,
          notes: '',
        });
      },

      setDiscount: (discount: number) => set({ discount }),
      setTax: (tax: number) => set({ tax }),

      setCustomer: (customer: Customer | null) => {
        if (customer) {
          set({
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
          });
        } else {
          set({
            customerId: undefined,
            customerName: undefined,
            customerPhone: undefined,
          });
        }
      },

      setPaymentMethod: (method: PaymentMethod) => set({ paymentMethod: method }),
      setAmountPaid: (amount: number) => set({ amountPaid: amount }),
      setNotes: (notes: string) => set({ notes }),
      setLastScannedBarcode: (barcode: string) => set({ lastScannedBarcode: barcode }),
      setOfflineMode: (isOffline: boolean) => set({ isOfflineMode: isOffline }),
      setPendingSyncCount: (count: number) => set({ pendingSyncCount: count }),

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.totalPrice, 0);
      },

      getTotal: () => {
        const subtotal = get().getSubtotal();
        const { discount, tax } = get();
        return subtotal - discount + tax;
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: 'lakhan-bhandar-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        discount: state.discount,
        tax: state.tax,
        customerId: state.customerId,
        customerName: state.customerName,
        customerPhone: state.customerPhone,
        paymentMethod: state.paymentMethod,
        amountPaid: state.amountPaid,
        notes: state.notes,
      }),
    }
  )
);

// ============================================================================
// UI STORE
// ============================================================================

interface UIState {
  isSearchOpen: boolean;
  isCheckoutOpen: boolean;
  isPrintDialogOpen: boolean;
  isCustomerDialogOpen: boolean;
  searchQuery: string;
  selectedCategoryId: string | null;
  printFormat: 'thermal-58' | 'thermal-80' | 'a4' | 'a5';
  currentSale: Sale | null;
}

interface UIActions {
  setSearchOpen: (open: boolean) => void;
  setCheckoutOpen: (open: boolean) => void;
  setPrintDialogOpen: (open: boolean) => void;
  setCustomerDialogOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (id: string | null) => void;
  setPrintFormat: (format: 'thermal-58' | 'thermal-80' | 'a4' | 'a5') => void;
  setCurrentSale: (sale: Sale | null) => void;
  reset: () => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  isSearchOpen: false,
  isCheckoutOpen: false,
  isPrintDialogOpen: false,
  isCustomerDialogOpen: false,
  searchQuery: '',
  selectedCategoryId: null,
  printFormat: 'thermal-80',
  currentSale: null,

  setSearchOpen: (open) => set({ isSearchOpen: open }),
  setCheckoutOpen: (open) => set({ isCheckoutOpen: open }),
  setPrintDialogOpen: (open) => set({ isPrintDialogOpen: open }),
  setCustomerDialogOpen: (open) => set({ isCustomerDialogOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
  setPrintFormat: (format) => set({ printFormat: format }),
  setCurrentSale: (sale) => set({ currentSale: sale }),
  reset: () => set({
    isSearchOpen: false,
    isCheckoutOpen: false,
    isPrintDialogOpen: false,
    isCustomerDialogOpen: false,
    searchQuery: '',
    selectedCategoryId: null,
    printFormat: 'thermal-80',
    currentSale: null,
  }),
}));

// ============================================================================
// PRODUCTS STORE (for local caching)
// ============================================================================

interface ProductsState {
  products: Product[];
  categories: string[];
  isLoading: boolean;
  lastUpdated: number | null;
  hasMore: boolean;
  nextCursor: string | null;
}

interface ProductsActions {
  setProducts: (products: Product[], hasMore?: boolean, nextCursor?: string | null) => void;
  appendProducts: (products: Product[], hasMore: boolean, nextCursor: string | null) => void;
  setCategories: (categories: string[]) => void;
  setLoading: (loading: boolean) => void;
  updateProductStock: (productId: string, quantityChange: number) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  addProduct: (product: Product) => void;
  removeProduct: (id: string) => void;
  getProductByBarcode: (barcode: string) => Product | undefined;
  searchProducts: (query: string) => Product[];
  reset: () => void;
}

export const useProductsStore = create<ProductsState & ProductsActions>((set, get) => ({
  products: [],
  categories: [],
  isLoading: true,
  lastUpdated: null,
  hasMore: false,
  nextCursor: null,

  setProducts: (products, hasMore = false, nextCursor = null) => {
    const categories = [...new Set(products.map((p) => p.category))].sort();
    set({ products, categories, lastUpdated: Date.now(), isLoading: false, hasMore, nextCursor });
  },

  appendProducts: (newProducts, hasMore, nextCursor) => {
    set((state) => {
      // Filter out products that might already exist to avoid duplicates
      const existingIds = new Set(state.products.map(p => p.id));
      const filteredNew = newProducts.filter(p => !existingIds.has(p.id));
      const combinedProducts = [...state.products, ...filteredNew];
      const categories = [...new Set(combinedProducts.map((p) => p.category))].sort();
      return {
        products: combinedProducts,
        categories,
        lastUpdated: Date.now(),
        hasMore,
        nextCursor
      };
    });
  },

  setCategories: (categories) => set({ categories }),
  setLoading: (loading) => set({ isLoading: loading }),

  updateProductStock: (productId, quantityChange) => {
    set((state) => ({
      products: state.products.map((p) =>
        p.id === productId ? { ...p, currentStock: p.currentStock + quantityChange } : p
      ),
    }));
  },

  updateProduct: (id, data) => {
    set((state) => ({
      products: state.products.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
      categories: data.category
        ? [...new Set([...state.categories, data.category])].sort()
        : state.categories,
    }));
  },

  addProduct: (product) => {
    set((state) => ({
      products: [...state.products, product],
      categories: [...new Set([...state.categories, product.category])].sort(),
    }));
  },

  removeProduct: (id) => {
    set((state) => ({
      products: state.products.filter((p) => p.id !== id),
    }));
  },

  getProductByBarcode: (barcode) => {
    // Convert Bengali numerals to English for comparison
    const normalizedBarcode = convertBengaliToEnglishNumerals(barcode);
    return get().products.find((p) => {
      const normalizedProductBarcode = convertBengaliToEnglishNumerals(p.barcode || '');
      return normalizedProductBarcode === normalizedBarcode;
    });
  },

  searchProducts: (query) => {
    const lowerQuery = query.toLowerCase();
    const normalizedQuery = convertBengaliToEnglishNumerals(query);
    return get().products.filter(
      (p) =>
        p.isActive &&
        (p.name.toLowerCase().includes(lowerQuery) ||
          p.nameBn?.includes(query) ||
          p.barcode?.includes(query) ||
          convertBengaliToEnglishNumerals(p.barcode || '').includes(normalizedQuery))
    );
  },
  reset: () => set({
    products: [],
    categories: [],
    isLoading: true,
    lastUpdated: null,
    hasMore: false,
    nextCursor: null,
  }),
}));

// ============================================================================
// CUSTOMERS STORE
// ============================================================================

interface CustomersState {
  customers: Customer[];
  isLoading: boolean;
}

interface CustomersActions {
  setCustomers: (customers: Customer[]) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  updateCustomerDue: (id: string, amount: number) => void;
  getCustomerByPhone: (phone: string) => Customer | undefined;
  searchCustomers: (query: string) => Customer[];
  reset: () => void;
}

export const useCustomersStore = create<CustomersState & CustomersActions>((set, get) => ({
  customers: [],
  isLoading: false,

  setCustomers: (customers) => {
    set({ customers, isLoading: false });
  },

  addCustomer: (customer) => {
    set((state) => ({
      customers: [...state.customers, customer],
    }));
  },

  updateCustomer: (id, data) => {
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    }));
  },

  updateCustomerDue: (id, amount) => {
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === id
          ? { ...c, totalDue: c.totalDue + amount }
          : c
      ),
    }));
  },

  getCustomerByPhone: (phone) => {
    return get().customers.find((c) => c.phone === phone);
  },

  searchCustomers: (query) => {
    const lowerQuery = query.toLowerCase();
    return get().customers.filter(
      (c) =>
        c.isActive &&
        (c.name.toLowerCase().includes(lowerQuery) || c.phone?.includes(query))
    );
  },
  reset: () => set({
    customers: [],
    isLoading: false,
  }),
}));

// ============================================================================
// SYNC STORE (for tracking offline sync status)
// ============================================================================

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingCount: number;
  syncErrors: string[];
}

interface SyncActions {
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number) => void;
  setPendingCount: (count: number) => void;
  addSyncError: (error: string) => void;
  clearSyncErrors: () => void;
  reset: () => void;
}

export const useSyncStore = create<SyncState & SyncActions>((set) => ({
  isOnline: true,
  isSyncing: false,
  lastSyncTime: null,
  pendingCount: 0,
  syncErrors: [],

  setOnline: (online) => set({ isOnline: online }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
  setPendingCount: (count) => set({ pendingCount: count }),
  addSyncError: (error) => set((state) => ({ syncErrors: [...state.syncErrors, error] })),
  clearSyncErrors: () => set({ syncErrors: [] }),
  reset: () => set({
    isOnline: true,
    isSyncing: false,
    lastSyncTime: null,
    pendingCount: 0,
    syncErrors: [],
  }),
}));

// ============================================================================
// SALES STORE
// ============================================================================

interface SalesState {
  sales: Sale[];
  isLoading: boolean;
}

interface SalesActions {
  setSales: (sales: Sale[]) => void;
  addSale: (sale: Sale) => void;
  updateSaleStatus: (id: string, status: Sale['status']) => void;
  getSaleById: (id: string) => Sale | undefined;
  getSalesByCustomerId: (customerId: string) => Sale[];
}

export const useSalesStore = create<SalesState & SalesActions>()(
  persist(
    (set, get) => ({
      sales: [],
      isLoading: false,

      setSales: (sales) => {
        set({ sales, isLoading: false });
      },

      addSale: (sale) => {
        set((state) => ({
          sales: [sale, ...state.sales],
        }));
      },

      updateSaleStatus: (id, status) => {
        set((state) => ({
          sales: state.sales.map((s) =>
            s.id === id ? { ...s, status } : s
          ),
        }));
      },

      getSaleById: (id) => {
        return get().sales.find((s) => s.id === id);
      },

      getSalesByCustomerId: (customerId) => {
        return get().sales.filter((s) => s.customerId === customerId);
      },
    }),
    {
      name: 'lakhan-bhandar-sales',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sales: state.sales,
      }),
    }
  )
);
