'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CartItem } from './CartItem';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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
  UserPlus,
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
  const [showAddPartyDialog, setShowAddPartyDialog] = useState(false);
  const [newParty, setNewParty] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });

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
      // If selecting walk-in customer and current payment is Due, switch to Cash
      if (!customer && paymentMethod === 'Due') {
        setPaymentMethod('Cash');
      }
    },
    [setCustomer, paymentMethod, setPaymentMethod]
  );

  const handleAddPartyFromCart = async () => {
    if (!newParty.name) return;

    // Validate phone if provided
    if (newParty.phone && !/^[0-9]{10}$/.test(newParty.phone)) {
      alert('Phone number must be exactly 10 digits.');
      return;
    }

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newParty),
      });

      if (!response.ok) {
        throw new Error('Failed to create customer');
      }

      const { data: newCustomer } = await response.json();
      // Select the newly created customer
      handleCustomerSelect(newCustomer);
      setShowAddPartyDialog(false);
      setNewParty({ name: '', phone: '', address: '', notes: '' });
    } catch (error) {
      console.error('Failed to add customer:', error);
      alert('Failed to create customer');
    }
  };

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
                <label htmlFor="customer-search" className="sr-only">Search customer</label>
                <Input
                  id="customer-search"
                  name="customer-search"
                  placeholder="Search customer..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                <div className="p-2">
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
                <div className="p-2 border-t space-y-2">
                  {onAddCustomer && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setCustomerDialogOpen(true);
                        onAddCustomer();
                      }}
                    >
                      Add from Party List
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setShowAddPartyDialog(true);
                      setCustomerSearchOpen(false);
                    }}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    New Customer
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
            {paymentMethods
              .filter(({ method }) => method !== 'Due' || customerName) // Hide Due for walk-in customers
              .map(({ method, icon, label, color }) => (
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

      {/* Add New Party Dialog */}
      <Dialog open={showAddPartyDialog} onOpenChange={setShowAddPartyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Add New Customer
            </DialogTitle>
            <DialogDescription>
              Create a new customer and add to this order
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cart-party-name">Name *</Label>
              <Input
                id="cart-party-name"
                value={newParty.name}
                onChange={(e) => setNewParty(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter customer name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cart-party-phone">Phone</Label>
              <Input
                id="cart-party-phone"
                value={newParty.phone}
                onChange={(e) => setNewParty(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="10-digit phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cart-party-address">Address</Label>
              <Input
                id="cart-party-address"
                value={newParty.address}
                onChange={(e) => setNewParty(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cart-party-notes">Notes</Label>
              <Textarea
                id="cart-party-notes"
                value={newParty.notes}
                onChange={(e) => setNewParty(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Enter notes"
                className="resize-none h-20"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddPartyDialog(false);
                setNewParty({ name: '', phone: '', address: '', notes: '' });
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddPartyFromCart} 
              disabled={!newParty.name}
            >
              Create Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CartPanel;
