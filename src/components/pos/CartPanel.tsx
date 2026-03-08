'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CartItem } from './CartItem';
import {
  ShoppingCart,
  Trash2,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  Clock,
  ChevronDown,
  Check,
} from 'lucide-react';
import type { PaymentMethod, Customer } from '@/types/pos';
import { useCartStore, useUIStore } from '@/stores/pos-store';
import { cn } from '@/lib/utils';

interface CartPanelProps {
  onCheckout: () => void;
  customers?: Customer[];
  onAddCustomer?: () => void;
}

const paymentMethods: { method: PaymentMethod; icon: React.ReactNode; label: string; color: string }[] = [
  { method: 'Cash', icon: <Banknote className="w-5 h-5" />, label: 'Cash', color: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
  { method: 'UPI', icon: <Smartphone className="w-5 h-5" />, label: 'UPI', color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { method: 'Due', icon: <Clock className="w-5 h-5" />, label: 'Due', color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
];

export function CartPanel({ onCheckout, customers = [], onAddCustomer }: CartPanelProps) {
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const items = useCartStore((state) => state.items);
  const discount = useCartStore((state) => state.discount);
  const tax = useCartStore((state) => state.tax);
  const customerName = useCartStore((state) => state.customerName);
  const paymentMethod = useCartStore((state) => state.paymentMethod);
  const getSubtotal = useCartStore((state) => state.getSubtotal);
  const getTotal = useCartStore((state) => state.getTotal);
  const getItemCount = useCartStore((state) => state.getItemCount);
  const clearCart = useCartStore((state) => state.clearCart);
  const setDiscount = useCartStore((state) => state.setDiscount);
  const setCustomer = useCartStore((state) => state.setCustomer);
  const setPaymentMethod = useCartStore((state) => state.setPaymentMethod);

  const setCheckoutOpen = useUIStore((state) => state.setCheckoutOpen);
  const setCustomerDialogOpen = useUIStore((state) => state.setCustomerDialogOpen);

  const subtotal = getSubtotal();
  const total = getTotal();
  const itemCount = getItemCount();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const handleClearCart = useCallback(() => {
    if (items.length > 0) {
      clearCart();
    }
  }, [items.length, clearCart]);

  const handleCheckout = useCallback(() => {
    if (items.length > 0 && total > 0) {
      setCheckoutOpen(true);
      onCheckout();
    }
  }, [items.length, total, setCheckoutOpen, onCheckout]);

  const handleDiscountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      setDiscount(isNaN(value) ? 0 : Math.max(0, value));
    },
    [setDiscount]
  );

  const handleCustomerSelect = useCallback(
    (customer: Customer | null) => {
      setCustomer(customer);
      setCustomerSearchOpen(false);
      setCustomerSearchQuery('');
    },
    [setCustomer]
  );

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      c.phone?.includes(customerSearchQuery)
  );

  const isCartEmpty = items.length === 0;
  const itemCountDisplay = itemCount === 0 ? 'Empty' : `${itemCount} item${itemCount !== 1 ? 's' : ''}`;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg">Cart</h2>
          <Badge variant="secondary" className="ml-1">
            {itemCountDisplay}
          </Badge>
        </div>
        {!isCartEmpty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearCart}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Customer Selector */}
      <div className="p-3 border-b shrink-0">
        <Label className="text-xs text-muted-foreground mb-1.5 block">Customer</Label>
        <div className="relative">
          <Button
            variant="outline"
            className="w-full justify-between h-9"
            onClick={() => setCustomerSearchOpen(!customerSearchOpen)}
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {customerName || 'Walk-in Customer'}
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </Button>

          {customerSearchOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50">
              <div className="p-2 border-b">
                <Input
                  placeholder="Search customer..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                <div className="p-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-9 text-sm"
                    onClick={() => handleCustomerSelect(null)}
                  >
                    Walk-in Customer
                  </Button>
                  {filteredCustomers.map((customer) => (
                    <Button
                      key={customer.id}
                      variant="ghost"
                      className="w-full justify-start h-9 text-sm"
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      <div className="flex flex-col items-start">
                        <span>{customer.name}</span>
                        {customer.phone && (
                          <span className="text-xs text-muted-foreground">{customer.phone}</span>
                        )}
                      </div>
                      {customer.totalDue > 0 && (
                        <Badge variant="destructive" className="ml-auto text-xs">
                          Due: {formatPrice(customer.totalDue)}
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
              {onAddCustomer && (
                <div className="p-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setCustomerDialogOpen(true);
                      onAddCustomer();
                    }}
                  >
                    Add New Customer
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 space-y-2">
          {isCartEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Cart is empty</p>
              <p className="text-xs text-muted-foreground mt-1">
                Scan or tap products to add them
              </p>
            </div>
          ) : (
            items.map((item) => <CartItem key={item.id} item={item} />)
          )}
        </div>
      </div>

      {/* Payment Method & Totals */}
      <div className="border-t shrink-0">
        {/* Payment Method Selector - Visible Cards */}
        <div className="p-3 border-b">
          <Label className="text-xs text-muted-foreground mb-2 block">Payment Method</Label>
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map(({ method, icon, label, color }) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={cn(
                  'relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all touch-manipulation',
                  paymentMethod === method
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-background hover:bg-muted/50'
                )}
              >
                {paymentMethod === method && (
                  <div className="absolute top-1 right-1">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div className={cn(
                  'mb-1',
                  paymentMethod === method ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {icon}
                </div>
                <span className={cn(
                  'text-xs font-medium',
                  paymentMethod === method ? 'text-primary' : 'text-foreground'
                )}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="p-3 space-y-1.5">
          {/* Subtotal */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          {/* Discount */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Discount</span>
            <div className="flex items-center gap-1">
              {showDiscountInput ? (
                <Input
                  type="number"
                  value={discount || ''}
                  onChange={handleDiscountChange}
                  className="w-20 h-7 text-right text-sm px-1"
                  placeholder="0"
                  min={0}
                  max={subtotal}
                  autoFocus
                  onBlur={() => discount === 0 && setShowDiscountInput(false)}
                />
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-sm"
                  onClick={() => setShowDiscountInput(true)}
                >
                  {discount > 0 ? formatPrice(discount) : 'Add'}
                </Button>
              )}
            </div>
          </div>

          {/* Tax */}
          {tax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatPrice(tax)}</span>
            </div>
          )}

          <Separator className="my-2" />

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-primary">{formatPrice(total)}</span>
          </div>
        </div>

        {/* Checkout Button */}
        <div className="p-3 pt-0">
          <Button
            size="lg"
            className="w-full h-12 text-lg font-semibold touch-manipulation"
            disabled={isCartEmpty || total <= 0}
            onClick={handleCheckout}
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Checkout {total > 0 ? `• ${formatPrice(total)}` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CartPanel;
