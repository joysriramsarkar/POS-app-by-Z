'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calculator,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Smartphone,
  Clock,
  Printer,
  Receipt,
} from 'lucide-react';
import type { PaymentMethod } from '@/types/pos';
import { useCartStore, useUIStore } from '@/stores/pos-store';
import { cn } from '@/lib/utils';

interface CheckoutDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onComplete: (paymentData: PaymentData) => void;
  isProcessing?: boolean;
}

export interface PaymentData {
  amountReceived: number;
  change: number;
  paymentMethod: PaymentMethod;
  customerId?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

export function CheckoutDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onComplete,
  isProcessing = false,
}: CheckoutDialogProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  // Track previous open state to detect when dialog opens
  const prevOpenRef = useRef(false);

  // Store state
  const items = useCartStore((state) => state.items);
  const discount = useCartStore((state) => state.discount);
  const tax = useCartStore((state) => state.tax);
  const customerId = useCartStore((state) => state.customerId);
  const customerName = useCartStore((state) => state.customerName);
  const paymentMethod = useCartStore((state) => state.paymentMethod);
  const getSubtotal = useCartStore((state) => state.getSubtotal);
  const getTotal = useCartStore((state) => state.getTotal);
  const clearCart = useCartStore((state) => state.clearCart);

  // UI store
  const isCheckoutOpen = useUIStore((state) => state.isCheckoutOpen);
  const setCheckoutOpen = useUIStore((state) => state.setCheckoutOpen);

  // Use controlled or internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : isCheckoutOpen;
  const setOpen = controlledOnOpenChange || setCheckoutOpen;

  // Calculations
  const subtotal = getSubtotal();
  const total = getTotal();

  // Calculate initial amount when dialog opens
  const getInitialAmount = useCallback(() => {
    if (paymentMethod === 'Cash') {
      return Math.ceil(total / 100) * 100;
    }
    return 0;
  }, [paymentMethod, total]);

  // State for amount - initialize with empty, will be set when dialog opens
  const [amountReceived, setAmountReceived] = useState<string>('');

  const parsedAmount = useMemo(() => {
    const parsed = parseFloat(amountReceived);
    return isNaN(parsed) ? 0 : parsed;
  }, [amountReceived]);

  const change = useMemo(() => {
    return parsedAmount - total;
  }, [parsedAmount, total]);

  const isValidPayment = useMemo(() => {
    if (paymentMethod === 'Due') {
      // Due payments don't require immediate payment
      return true;
    }
    return parsedAmount >= total;
  }, [paymentMethod, parsedAmount, total]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  // Handle dialog open state change - initialize values when opening
  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Dialog is opening
      if (open && !prevOpenRef.current) {
        // Reset and initialize values
        setInputError(null);
        setShowSuccess(false);
        setAmountReceived(getInitialAmount().toString());
      }
      prevOpenRef.current = open;
      setOpen(open);
    },
    [getInitialAmount, setOpen]
  );

  // Close handler that also clears cart on success
  const handleClose = useCallback(() => {
    handleOpenChange(false);
    if (showSuccess) {
      clearCart();
    }
    setShowSuccess(false);
  }, [handleOpenChange, showSuccess, clearCart]);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string, numbers, and one decimal point
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmountReceived(value);
      setInputError(null);
    }
  }, []);

  const handleQuickAmount = useCallback((amount: number) => {
    setAmountReceived(amount.toString());
    setInputError(null);
  }, []);

  const handleExactAmount = useCallback(() => {
    setAmountReceived(Math.ceil(total).toString());
    setInputError(null);
  }, [total]);

  const handleComplete = useCallback(() => {
    // Validate payment for Cash/UPI
    if (paymentMethod !== 'Due' && parsedAmount < total) {
      setInputError(`Insufficient amount. Need ${formatPrice(total - parsedAmount)} more.`);
      return;
    }

    setShowSuccess(true);

    const paymentData: PaymentData = {
      amountReceived: paymentMethod === 'Due' ? 0 : parsedAmount,
      change: paymentMethod === 'Due' ? 0 : Math.max(0, change),
      paymentMethod,
      customerId,
      subtotal,
      discount,
      tax,
      total,
    };

    onComplete(paymentData);
  }, [
    paymentMethod,
    parsedAmount,
    total,
    change,
    customerId,
    subtotal,
    discount,
    tax,
    onComplete,
  ]);

  const handlePrint = useCallback(() => {
    // TODO: Implement print functionality
    window.print();
  }, []);

  const paymentMethodIcon = useMemo(() => {
    switch (paymentMethod) {
      case 'Cash':
        return <Banknote className="w-4 h-4" />;
      case 'UPI':
        return <Smartphone className="w-4 h-4" />;
      case 'Due':
        return <Clock className="w-4 h-4" />;
    }
  }, [paymentMethod]);

  if (showSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground text-center">
              Sale completed for {formatPrice(total)}
            </p>

            {paymentMethod === 'Cash' && change > 0 && (
              <div className="mt-4 p-4 bg-muted rounded-lg w-full text-center">
                <p className="text-sm text-muted-foreground">Change to return</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(change)}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6 w-full">
              <Button variant="outline" className="flex-1" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button className="flex-1" onClick={handleClose}>
                <Receipt className="w-4 h-4 mr-2" />
                New Sale
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Checkout
          </DialogTitle>
          <DialogDescription>
            Review order and complete payment
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Customer Info */}
          {customerName && (
            <div className="flex items-center gap-2 text-sm bg-muted p-2 rounded-lg">
              <Badge variant="secondary">{customerName}</Badge>
              {paymentMethod === 'Due' && (
                <Badge variant="outline" className="text-amber-600">
                  Due Payment
                </Badge>
              )}
            </div>
          )}

          {/* Order Summary */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-2">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="truncate flex-1">
                    {item.productName}
                    <span className="text-muted-foreground ml-1">
                      ×{item.quantity}
                    </span>
                  </span>
                  <span className="font-medium ml-2">
                    {formatPrice(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Totals */}
          <div className="space-y-1.5 border-t pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-{formatPrice(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatPrice(tax)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatPrice(total)}</span>
            </div>
          </div>

          {/* Payment Method Display */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Payment Method</span>
            <Badge variant="secondary" className="gap-1">
              {paymentMethodIcon}
              {paymentMethod}
            </Badge>
          </div>

          {/* Amount Input (for Cash/UPI) */}
          {paymentMethod !== 'Due' && (
            <div className="space-y-3">
              <Label htmlFor="amount-received">Amount Received</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="amount-received"
                  type="text"
                  value={amountReceived}
                  onChange={handleAmountChange}
                  placeholder="0"
                  className="pl-8 text-xl h-12 font-semibold text-right"
                  disabled={isProcessing}
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAmount(amount)}
                    disabled={isProcessing}
                    className="h-9"
                  >
                    ₹{amount}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExactAmount}
                  disabled={isProcessing}
                  className="h-9"
                >
                  Exact
                </Button>
              </div>

              {/* Change Calculation */}
              {parsedAmount > 0 && (
                <div
                  className={cn(
                    'p-3 rounded-lg text-center',
                    change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  )}
                >
                  {change >= 0 ? (
                    <>
                      <p className="text-sm">Change</p>
                      <p className="text-xl font-bold">{formatPrice(change)}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm flex items-center justify-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        Balance Due
                      </p>
                      <p className="text-xl font-bold">{formatPrice(Math.abs(change))}</p>
                    </>
                  )}
                </div>
              )}

              {/* Error Message */}
              {inputError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {inputError}
                </p>
              )}
            </div>
          )}

          {/* Due Payment Warning */}
          {paymentMethod === 'Due' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Amount will be added to customer's due balance
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={!isValidPayment || isProcessing}
            className="min-w-[120px]"
          >
            {isProcessing ? (
              'Processing...'
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Complete Sale
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CheckoutDialog;
