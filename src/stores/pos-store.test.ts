import { describe, it, expect, beforeEach } from 'bun:test';
import { useCartStore } from './pos-store';

describe('useCartStore', () => {
  const initialCartState = {
    items: [],
    discount: 0,
    tax: 0,
    customerId: undefined,
    customerName: undefined,
    customerPhone: undefined,
    paymentMethod: 'Cash' as const,
    notes: '',
    lastScannedBarcode: '',
    isOfflineMode: false,
    pendingSyncCount: 0,
  };

  beforeEach(() => {
    useCartStore.setState(initialCartState);
  });

  describe('initial state', () => {
    it('should have the correct initial state', () => {
      const state = useCartStore.getState();
      expect(state.items).toEqual([]);
      expect(state.discount).toBe(0);
      expect(state.tax).toBe(0);
      expect(state.paymentMethod).toBe('Cash');
      expect(state.isOfflineMode).toBe(false);
      expect(state.pendingSyncCount).toBe(0);
    });
  });

  describe('addItem', () => {
    it('should add a new item to the cart', () => {
      const product = {
        id: 'p1',
        name: 'Test Product',
        barcode: '123456',
        sellingPrice: 100,
        unit: 'piece',
        currentStock: 10,
        category: 'Biscuits',
        isActive: true,
      };

      useCartStore.getState().addItem(product as any, 2);

      const state = useCartStore.getState();
      expect(state.items.length).toBe(1);

      const item = state.items[0];
      expect(item.productId).toBe('p1');
      expect(item.productName).toBe('Test Product');
      expect(item.quantity).toBe(2);
      expect(item.unitPrice).toBe(100);
      expect(item.totalPrice).toBe(200);
    });

    it('should increase quantity when adding an existing item', () => {
      const product = {
        id: 'p1',
        name: 'Test Product',
        barcode: '123456',
        sellingPrice: 100,
        unit: 'piece',
        currentStock: 10,
        category: 'Biscuits',
        isActive: true,
      };

      useCartStore.getState().addItem(product as any, 2);
      useCartStore.getState().addItem(product as any, 3);

      const state = useCartStore.getState();
      expect(state.items.length).toBe(1);

      const item = state.items[0];
      expect(item.productId).toBe('p1');
      expect(item.quantity).toBe(5);
      expect(item.totalPrice).toBe(500);
    });
  });

  describe('removeItem', () => {
    it('should remove an item from the cart', () => {
      const product = {
        id: 'p1',
        name: 'Test Product',
        sellingPrice: 100,
        unit: 'piece',
        currentStock: 10,
      };

      useCartStore.getState().addItem(product as any, 1);
      let state = useCartStore.getState();
      expect(state.items.length).toBe(1);

      const itemId = state.items[0].id;
      useCartStore.getState().removeItem(itemId);

      state = useCartStore.getState();
      expect(state.items.length).toBe(0);
    });
  });
});
