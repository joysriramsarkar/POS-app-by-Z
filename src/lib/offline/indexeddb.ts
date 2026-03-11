// ============================================================================
// IndexedDB Manager for Offline-First POS System
// Lakhan Bhandar - Local Data Persistence
// ============================================================================

import type { Product, Cart, Sale, SyncQueueItem, Customer } from '@/types/pos';

const DB_NAME = 'lakhan-bhandar-pos';
const DB_VERSION = 1;

// Database store names
const STORES = {
  PRODUCTS: 'products',
  CARTS: 'carts',
  SALES: 'sales',
  SYNC_QUEUE: 'sync_queue',
  CUSTOMERS: 'customers',
  PENDING_SALES: 'pending_sales',
} as const;

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let dbInstance: IDBDatabase | null = null;

export async function initDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Products store - for offline product lookup
      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        const productStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
        productStore.createIndex('barcode', 'barcode', { unique: false });
        productStore.createIndex('category', 'category', { unique: false });
        productStore.createIndex('name', 'name', { unique: false });
      }

      // Customers store
      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        const customerStore = db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
        customerStore.createIndex('phone', 'phone', { unique: false });
        customerStore.createIndex('name', 'name', { unique: false });
      }

      // Carts store - for pending carts (multiple carts possible)
      if (!db.objectStoreNames.contains(STORES.CARTS)) {
        db.createObjectStore(STORES.CARTS, { keyPath: 'id' });
      }

      // Sales store - for offline sales
      if (!db.objectStoreNames.contains(STORES.SALES)) {
        const saleStore = db.createObjectStore(STORES.SALES, { keyPath: 'id' });
        saleStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: true });
        saleStore.createIndex('createdAt', 'createdAt', { unique: false });
        saleStore.createIndex('synced', 'offlineSynced', { unique: false });
      }

      // Sync queue - for tracking pending syncs
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        syncStore.createIndex('synced', 'synced', { unique: false });
        syncStore.createIndex('entityType', 'entityType', { unique: false });
      }

      // Pending sales - sales that need to be synced
      if (!db.objectStoreNames.contains(STORES.PENDING_SALES)) {
        db.createObjectStore(STORES.PENDING_SALES, { keyPath: 'id' });
      }
    };
  });
}

// ============================================================================
// GENERIC CRUD OPERATIONS
// ============================================================================

async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  const db = await initDatabase();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromStore<T>(storeName: string, key: string): Promise<T | undefined> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putToStore<T>(storeName: string, data: T): Promise<string> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result as string);
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromStore(storeName: string, key: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// PRODUCTS OPERATIONS
// ============================================================================

export const ProductsDB = {
  async getAll(): Promise<Product[]> {
    return getAllFromStore<Product>(STORES.PRODUCTS);
  },

  async getById(id: string): Promise<Product | undefined> {
    return getFromStore<Product>(STORES.PRODUCTS, id);
  },

  async getByBarcode(barcode: string): Promise<Product | undefined> {
    const db = await initDatabase();
    const transaction = db.transaction(STORES.PRODUCTS, 'readonly');
    const store = transaction.objectStore(STORES.PRODUCTS);
    const index = store.index('barcode');

    return new Promise((resolve, reject) => {
      const request = index.get(barcode);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async searchByName(query: string): Promise<Product[]> {
    const products = await this.getAll();
    const lowerQuery = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.nameBn?.includes(query) ||
        p.barcode?.includes(query)
    );
  },

  async upsert(product: Product): Promise<void> {
    await putToStore(STORES.PRODUCTS, product);
  },

  async upsertMany(products: Product[]): Promise<void> {
    const db = await initDatabase();
    const transaction = db.transaction(STORES.PRODUCTS, 'readwrite');
    const store = transaction.objectStore(STORES.PRODUCTS);

    for (const product of products) {
      store.put(product);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async clear(): Promise<void> {
    return clearStore(STORES.PRODUCTS);
  },

  async updateStock(productId: string, quantityChange: number): Promise<void> {
    const product = await this.getById(productId);
    if (product) {
      product.currentStock += quantityChange;
      await putToStore(STORES.PRODUCTS, product);
    }
  },
};

// ============================================================================
// CUSTOMERS OPERATIONS
// ============================================================================

export const CustomersDB = {
  async getAll(): Promise<Customer[]> {
    return getAllFromStore<Customer>(STORES.CUSTOMERS);
  },

  async getById(id: string): Promise<Customer | undefined> {
    return getFromStore<Customer>(STORES.CUSTOMERS, id);
  },

  async getByPhone(phone: string): Promise<Customer | undefined> {
    const db = await initDatabase();
    const transaction = db.transaction(STORES.CUSTOMERS, 'readonly');
    const store = transaction.objectStore(STORES.CUSTOMERS);
    const index = store.index('phone');

    return new Promise((resolve, reject) => {
      const request = index.get(phone);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async upsert(customer: Customer): Promise<void> {
    await putToStore(STORES.CUSTOMERS, customer);
  },

  async upsertMany(customers: Customer[]): Promise<void> {
    const db = await initDatabase();
    const transaction = db.transaction(STORES.CUSTOMERS, 'readwrite');
    const store = transaction.objectStore(STORES.CUSTOMERS);

    for (const customer of customers) {
      store.put(customer);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async updateDue(customerId: string, amountChange: number): Promise<void> {
    const customer = await this.getById(customerId);
    if (customer) {
      customer.totalDue += amountChange;
      await putToStore(STORES.CUSTOMERS, customer);
    }
  },

  async clear(): Promise<void> {
    return clearStore(STORES.CUSTOMERS);
  },
};

// ============================================================================
// CART OPERATIONS
// ============================================================================

export const CartDB = {
  async getCurrent(): Promise<Cart | undefined> {
    return getFromStore<Cart>(STORES.CARTS, 'current');
  },

  async save(cart: Cart): Promise<void> {
    await putToStore(STORES.CARTS, { ...cart, id: 'current' });
  },

  async clear(): Promise<void> {
    await deleteFromStore(STORES.CARTS, 'current');
  },
};

// ============================================================================
// SALES OPERATIONS (Offline Sales)
// ============================================================================

export const SalesDB = {
  async getAll(): Promise<Sale[]> {
    return getAllFromStore<Sale>(STORES.SALES);
  },

  async getById(id: string): Promise<Sale | undefined> {
    return getFromStore<Sale>(STORES.SALES, id);
  },

  async getUnsynced(): Promise<Sale[]> {
    const db = await initDatabase();
    const transaction = db.transaction(STORES.SALES, 'readonly');
    const store = transaction.objectStore(STORES.SALES);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.filter((s: Sale) => !s.offlineSynced));
      request.onerror = () => reject(request.error);
    });
  },

  async save(sale: Sale): Promise<void> {
    await putToStore(STORES.SALES, sale);
  },

  async markSynced(id: string): Promise<void> {
    const sale = await this.getById(id);
    if (sale) {
      sale.offlineSynced = true;
      await putToStore(STORES.SALES, sale);
    }
  },

  async clear(): Promise<void> {
    return clearStore(STORES.SALES);
  },
};

// ============================================================================
// SYNC QUEUE OPERATIONS
// ============================================================================

export const SyncQueueDB = {
  async getAll(): Promise<SyncQueueItem[]> {
    return getAllFromStore<SyncQueueItem>(STORES.SYNC_QUEUE);
  },

  async getUnsynced(): Promise<SyncQueueItem[]> {
    const db = await initDatabase();
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.filter((i: SyncQueueItem) => !i.synced));
      request.onerror = () => reject(request.error);
    });
  },

  async add(item: SyncQueueItem): Promise<void> {
    await putToStore(STORES.SYNC_QUEUE, item);
  },

  async markSynced(id: string): Promise<void> {
    const item = await getFromStore<SyncQueueItem>(STORES.SYNC_QUEUE, id);
    if (item) {
      item.synced = true;
      item.syncedAt = new Date();
      await putToStore(STORES.SYNC_QUEUE, item);
    }
  },

  async incrementRetry(id: string, error?: string): Promise<void> {
    const item = await getFromStore<SyncQueueItem>(STORES.SYNC_QUEUE, id);
    if (item) {
      item.retryCount += 1;
      if (error) item.error = error;
      await putToStore(STORES.SYNC_QUEUE, item);
    }
  },

  async delete(id: string): Promise<void> {
    await deleteFromStore(STORES.SYNC_QUEUE, id);
  },

  async clear(): Promise<void> {
    return clearStore(STORES.SYNC_QUEUE);
  },
};

// ============================================================================
// NETWORK STATUS & AUTO-SYNC
// ============================================================================

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

// Initialize database on module load
if (typeof window !== 'undefined') {
  initDatabase().catch(console.error);
}
