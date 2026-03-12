'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generateInvoiceNumber } from '@/lib/invoice';
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
import type { PaymentMethod, Sale, SaleItem, Customer } from '@/types/pos';
import { useCartStore, useUIStore, useProductsStore } from '@/stores/pos-store';
import { cn } from '@/lib/utils';

interface CheckoutDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onComplete: (paymentData: PaymentData) => void;
  onPrint?: (paymentData: PaymentData) => void;
  isProcessing?: boolean;
  onCheckoutSuccess?: (sale: Sale) => void;
  onCheckoutError?: (error: string) => void;
  completedSale?: Sale | null;
}

export interface PaymentData {
  amountReceived: number;
  amountPaid: number;
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
  onPrint,
  isProcessing = false,
  onCheckoutSuccess,
  onCheckoutError,
  completedSale,
}: CheckoutDialogProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  // Track previous open state to detect when dialog opens
  const prevOpenRef = useRef(false);

  // When parent confirms checkout succeeded, show success modal
  useEffect(() => {
    if (completedSale) {
      setIsCheckingOut(false);
      setShowSuccess(true);
      setLastSale(completedSale);
    }
  }, [completedSale]);

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

  // Products store - for stock validation
  const products = useProductsStore((state) => state.products);

  // UI store
  const isCheckoutOpen = useUIStore((state) => state.isCheckoutOpen);
  const setCheckoutOpen = useUIStore((state) => state.setCheckoutOpen);
  const setPrintDialogOpen = useUIStore((state) => state.setPrintDialogOpen);
  const setCurrentSale = useUIStore((state) => state.setCurrentSale);

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
    if (customerId && parsedAmount < total) {
      // Partial payments are allowed if a customer is selected
      return true;
    }
    return parsedAmount >= total;
  }, [paymentMethod, parsedAmount, total, customerId]);

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

      // Sync back to store if closing
      if (!open) {
         setCheckoutOpen(false);
      }
    },
    [getInitialAmount, setOpen, setCheckoutOpen]
  );

  // Close handler that also clears cart on success
  const handleClose = useCallback(() => {
    handleOpenChange(false);
    setShowSuccess(false);
  }, [handleOpenChange]);

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
    if (paymentMethod !== 'Due' && parsedAmount < total && !customerId) {
      setInputError(`Insufficient amount. Need ${formatPrice(total - parsedAmount)} more or select a customer for partial payment.`);
      return;
    }

    // ========================================================================
    // CRITICAL: VALIDATE STOCK BEFORE CHECKOUT
    // Prevent checkout if any cart item exceeds available stock
    // ========================================================================
    const insufficientStockItems: Array<{ name: string; qty: number; available: number }> = [];
    
    for (const cartItem of items) {
      const product = products.find((p) => p.id === cartItem.productId);
      if (!product) {
        setInputError(`Product "${cartItem.productName}" no longer exists in inventory.`);
        return;
      }
      
      if (cartItem.quantity > product.currentStock) {
        insufficientStockItems.push({
          name: cartItem.productName,
          qty: cartItem.quantity,
          available: product.currentStock,
        });
      }
    }

    // If any items lack sufficient stock, show error and prevent checkout
    if (insufficientStockItems.length > 0) {
      const itemsText = insufficientStockItems
        .map((item) => `${item.name} (Need: ${item.qty}, Available: ${item.available})`)
        .join('\n');
      
      setInputError(
        `Insufficient stock for:\n${itemsText}\n\nPlease adjust quantities and try again.`
      );
      return;
    }

    const saleItems: SaleItem[] = items.map((item) => ({
      id: uuidv4(),
      saleId: '', // To be filled by backend/process
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      createdAt: new Date(),
    }));

    const customer: Customer | undefined = customerId ? {
      id: customerId,
      name: customerName || 'Walk-in',
      totalDue: 0,
      totalPaid: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } : undefined;

    const sale: Sale = {
      id: uuidv4(),
      invoiceNumber: generateInvoiceNumber(),
      customerId,
      customer,
      items: saleItems,
      subtotal,
      discount,
      tax,
      totalAmount: total,
      amountPaid: paymentMethod === 'Due' ? 0 : (customerId && parsedAmount < total ? parsedAmount : total),
      paymentMethod,
      paymentStatus: paymentMethod === 'Due' ? 'Due' : (customerId && parsedAmount < total ? 'Partial' : 'Paid'),
      status: 'Completed',
      offlineSynced: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setLastSale(sale);
    setIsCheckingOut(true);

    let amountPaidForSale = 0;
    if (paymentMethod === 'Due') {
      amountPaidForSale = 0; // Pure due
    } else if (customerId && parsedAmount < total) {
      amountPaidForSale = parsedAmount; // Partial payment
    } else {
      amountPaidForSale = total; // Full payment
    }

    const paymentData: PaymentData = {
      amountReceived: paymentMethod === 'Due' ? 0 : parsedAmount,
      amountPaid: amountPaidForSale,
      change: paymentMethod === 'Due' ? 0 : Math.max(0, change),
      paymentMethod,
      customerId,
      subtotal,
      discount,
      tax,
      total,
    };

    // Call parent to handle API request
    // Parent will call onCheckoutSuccess/onCheckoutError when done
    onComplete(paymentData);
  }, [
    paymentMethod,
    parsedAmount,
    total,
    items,
    products,
    customerId,
    customerName,
    subtotal,
    discount,
    tax,
    onComplete,
    change,
  ]);

  const handlePrint = useCallback(() => {
    if (lastSale) {
      setCurrentSale(lastSale);
      setPrintDialogOpen(true);
    }
  }, [lastSale, setCurrentSale, setPrintDialogOpen]);

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
        <DialogContent className="sm:max-w-md no-print">
          <DialogHeader>
            <DialogTitle className="sr-only">Payment Success</DialogTitle>
            <DialogDescription className="sr-only">Payment has been successfully processed</DialogDescription>
          </DialogHeader>
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
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isProcessing || isCheckingOut}>
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={!isValidPayment || isProcessing || isCheckingOut}
            className="min-w-30"
          >
            {isCheckingOut ? (
              'Processing Payment...'
            ) : isProcessing ? (
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
