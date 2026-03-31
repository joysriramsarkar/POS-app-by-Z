'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
import { Switch } from '@/components/ui/switch';
import {
  Calculator,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Smartphone,
  Clock,
  Printer,
  Receipt,
  Wallet,
} from 'lucide-react';
import type { PaymentMethod, Sale, SaleItem, Customer } from '@/types/pos';
import { useCartStore, useUIStore, useProductsStore, useCustomersStore } from '@/stores/pos-store';
import { cn } from '@/lib/utils';
import { generateInvoiceNumber } from '@/lib/invoice';

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
  usePrepaid: boolean;
  prepaidAmountUsed: number;
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
  const [inputError, setInputError] = useState<string | null>(null);
  const [usePrepaid, setUsePrepaid] = useState(false);

  const prevOpenRef = useRef(false);

  const showSuccess = !!completedSale && !isProcessing;
  const lastSale = completedSale;

  useEffect(() => {
    if (showSuccess && onCheckoutSuccess && lastSale) {
      onCheckoutSuccess(lastSale);
    }
  }, [showSuccess, lastSale, onCheckoutSuccess]);

  const items = useCartStore((state) => state.items);
  const discount = useCartStore((state) => state.discount);
  const tax = useCartStore((state) => state.tax);
  const customerId = useCartStore((state) => state.customerId);
  const paymentMethod = useCartStore((state) => state.paymentMethod);
  const getSubtotal = useCartStore((state) => state.getSubtotal);
  const getTotal = useCartStore((state) => state.getTotal);
  const clearCart = useCartStore((state) => state.clearCart);
  
  const customer = useCustomersStore((state) => state.customers.find(c => c.id === customerId));

  const products = useProductsStore((state) => state.products);
  const isCheckoutOpen = useUIStore((state) => state.isCheckoutOpen);
  const setCheckoutOpen = useUIStore((state) => state.setCheckoutOpen);
  const setPrintDialogOpen = useUIStore((state) => state.setPrintDialogOpen);
  const setCurrentSale = useUIStore((state) => state.setCurrentSale);

  const isOpen = controlledOpen !== undefined ? controlledOpen : isCheckoutOpen;
  const setOpen = controlledOnOpenChange || setCheckoutOpen;

  const subtotal = getSubtotal();
  const total = getTotal();

  const prepaidAmountToUse = useMemo(() => {
    if (usePrepaid && customer && customer.prepaidBalance > 0) {
      return Math.min(total, customer.prepaidBalance);
    }
    return 0;
  }, [usePrepaid, customer, total]);

  const remainingTotal = useMemo(() => total - prepaidAmountToUse, [total, prepaidAmountToUse]);

  const getInitialAmount = useCallback(() => {
    if (paymentMethod === 'Cash') {
      return Math.ceil(remainingTotal / 100) * 100;
    }
    return 0;
  }, [paymentMethod, remainingTotal]);

  const [amountReceived, setAmountReceived] = useState<string>('');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [upiReceived, setUpiReceived] = useState<string>('');

  const parsedAmount = useMemo(() => {
    if (paymentMethod === 'Mixed') {
      const c = parseFloat(cashReceived);
      const u = parseFloat(upiReceived);
      const cv = isNaN(c) ? 0 : c;
      const uv = isNaN(u) ? 0 : u;
      return cv + uv;
    }
    const parsed = parseFloat(amountReceived);
    return isNaN(parsed) ? 0 : parsed;
  }, [amountReceived, cashReceived, upiReceived, paymentMethod]);

  const change = useMemo(() => {
    return parsedAmount - remainingTotal;
  }, [parsedAmount, remainingTotal]);

  const isValidPayment = useMemo(() => {
    if (remainingTotal === 0) return true; // Fully paid by prepaid balance
    if (paymentMethod === 'Due') return true;
    if (customerId && parsedAmount < remainingTotal) return true; // Partial payments
    return parsedAmount >= remainingTotal;
  }, [paymentMethod, parsedAmount, remainingTotal, customerId]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && !prevOpenRef.current) {
        setInputError(null);
        setUsePrepaid(false);
        if (paymentMethod === 'Mixed') {
          setCashReceived(getInitialAmount().toString());
          setUpiReceived('');
          setAmountReceived('');
        } else {
          setAmountReceived(getInitialAmount().toString());
          setCashReceived('');
          setUpiReceived('');
        }
      }
      prevOpenRef.current = open;
      setOpen(open);
      if (!open) setCheckoutOpen(false);
    },
    [getInitialAmount, setOpen, setCheckoutOpen, paymentMethod]
  );

  const handleClose = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmountReceived(value);
      setInputError(null);
    }
  }, []);

  const handleCashChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setCashReceived(value);
      setInputError(null);
    }
  }, []);

  const handleUpiChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setUpiReceived(value);
      setInputError(null);
    }
  }, []);

  const handleQuickAmount = useCallback((amount: number) => {
    if (paymentMethod === 'Mixed') {
      setCashReceived(amount.toString());
      setUpiReceived('');
    } else {
      setAmountReceived(amount.toString());
    }
    setInputError(null);
  }, [paymentMethod]);

  const handleExactAmount = useCallback(() => {
    if (paymentMethod === 'Mixed') {
      setCashReceived(Math.ceil(remainingTotal).toString());
      setUpiReceived('');
    } else {
      setAmountReceived(Math.ceil(remainingTotal).toString());
    }
    setInputError(null);
  }, [remainingTotal, paymentMethod]);

  const handleComplete = useCallback(() => {
    if (paymentMethod !== 'Due' && parsedAmount < remainingTotal && !customerId) {
      setInputError(`Insufficient amount. Need ${formatPrice(remainingTotal - parsedAmount)} more or select a customer for partial payment.`);
      return;
    }

    const insufficientStockItems: Array<{ name: string; qty: number; available: number }> = [];
    for (const cartItem of items) {
      const product = products.find((p) => p.id === cartItem.productId);
      if (!product) {
        setInputError(`Product "${cartItem.productName}" no longer exists.`);
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

    if (insufficientStockItems.length > 0) {
      const itemsText = insufficientStockItems
        .map((item) => `${item.name} (Need: ${item.qty}, Available: ${item.available})`)
        .join('\n');
      setInputError(`Insufficient stock for:\n${itemsText}`);
      return;
    }

    const saleItems: SaleItem[] = items.map((item) => ({
      id: uuidv4(),
      saleId: '',
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      createdAt: new Date(),
    }));

    const finalPaymentMethod = remainingTotal === 0 ? 'Prepaid' : paymentMethod;

    let amountPaidForSale = prepaidAmountToUse;
    if (finalPaymentMethod !== 'Due') {
        if (customerId && parsedAmount < remainingTotal) {
            amountPaidForSale += parsedAmount; // Partial payment
        } else {
            amountPaidForSale += remainingTotal;
        }
    }

    const paymentData: PaymentData = {
      amountReceived: parsedAmount,
      amountPaid: amountPaidForSale,
      change: finalPaymentMethod === 'Due' ? 0 : Math.max(0, change),
      paymentMethod: finalPaymentMethod as any,
      customerId,
      subtotal,
      discount,
      tax,
      total,
      usePrepaid,
      prepaidAmountUsed: prepaidAmountToUse,
    };
    
    onComplete(paymentData);
  }, [
    paymentMethod,
    parsedAmount,
    total,
    remainingTotal,
    items,
    products,
    customerId,
    subtotal,
    discount,
    tax,
    onComplete,
    change,
    usePrepaid,
    prepaidAmountToUse,
  ]);

  const handlePrint = useCallback(() => {
    if (lastSale) {
      setCurrentSale(lastSale);
      setPrintDialogOpen(true);
    }
  }, [lastSale, setCurrentSale, setPrintDialogOpen]);

  const paymentMethodIcon = useMemo(() => {
    const finalPaymentMethod = remainingTotal === 0 ? 'Prepaid' : paymentMethod;
    switch (finalPaymentMethod) {
      case 'Cash': return <Banknote className="w-2 h-2" />;
      case 'UPI': return <Smartphone className="w-2 h-2" />;
      case 'Mixed': return (<div className="flex items-center gap-1"><Banknote className="w-2 h-2" /><Smartphone className="w-2 h-2" /></div>);
      case 'Due': return <Clock className="w-4 h-4" />;
      case 'Prepaid': return <Wallet className="w-4 h-4 text-green-600" />;
      default: return null;
    }
  }, [paymentMethod, remainingTotal]);

  if (showSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md w-[95vw] max-h-[90dvh] overflow-y-auto no-print">
          <DialogHeader>
            <DialogTitle className="sr-only">Payment Success</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
            {
              (() => {
                const displayedTotal = lastSale ? (lastSale.totalAmount ?? total) : total;
                const displayedPaymentMethod = lastSale ? (lastSale.paymentMethod as string) : paymentMethod;
                const displayedChange = lastSale
                  ? Math.max(0, (Number(lastSale.amountPaid || 0) - Number(lastSale.totalAmount || 0)))
                  : change;

                return (
                  <>
                    <p className="text-muted-foreground text-center">Sale completed for {formatPrice(displayedTotal)}</p>

                    {(displayedPaymentMethod === 'Cash' || displayedPaymentMethod === 'Mixed') && displayedChange > 0 && (
                      <div className="mt-4 p-4 bg-muted rounded-lg w-full text-center">
                        <p className="text-sm text-muted-foreground">Change to return</p>
                        <p className="text-2xl font-bold text-primary">{formatPrice(displayedChange)}</p>
                      </div>
                    )}
                  </>
                );
              })()
            }

            <div className="flex gap-3 mt-6 w-full">
              <Button variant="outline" className="flex-1" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button className="flex-1 bg-blue-600 text-white hover:bg-blue-700" onClick={handleClose}>
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
      <DialogContent className="sm:max-w-[425px] flex flex-col max-h-[90dvh] md:max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 flex-none border-b">
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Checkout
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-4">
          {customer && (
            <div className="flex items-center gap-2 text-sm bg-muted p-2 rounded-lg">
              <Badge variant="secondary">{customer.name}</Badge>
              {paymentMethod === 'Due' && <Badge variant="outline" className="text-amber-600">Due Payment</Badge>}
            </div>
          )}

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="truncate flex-1">{item.productName}<span className="text-muted-foreground ml-1">×{item.quantity}</span></span>
                <span className="font-medium ml-2">{formatPrice(item.totalPrice)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 border-t pt-4">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-{formatPrice(discount)}</span></div>}
            {tax > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span>{formatPrice(tax)}</span></div>}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold text-lg"><span>Total</span><span className="text-primary">{formatPrice(total)}</span></div>
          </div>

          {customer && customer.prepaidBalance > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="use-prepaid" className="font-medium flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-green-600" />
                    Use Prepaid Balance
                  </Label>
                  <p className="text-xs text-muted-foreground">Available: {formatPrice(customer.prepaidBalance)}</p>
                </div>
                <Switch id="use-prepaid" checked={usePrepaid} onCheckedChange={setUsePrepaid} />
              </div>
              {usePrepaid && (
                <p className="text-sm text-green-700 font-medium text-center pt-1">
                  Applying {formatPrice(prepaidAmountToUse)} from balance.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Payment Method</span>
            <Badge variant="secondary" className="gap-1 px-2 py-1">
              {paymentMethodIcon}
              {remainingTotal === 0 ? 'Prepaid' : paymentMethod}
            </Badge>
          </div>

          {remainingTotal > 0 && paymentMethod !== 'Due' && (
            <div className="space-y-3">
              <Label htmlFor="amount-received">Amount to Pay</Label>

              {paymentMethod === 'Mixed' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Cash</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                      <Input
                        id="cash-received"
                        type="text"
                        value={cashReceived}
                        onChange={handleCashChange}
                        placeholder="0"
                        className="pl-8 text-xl h-12 font-semibold text-right"
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">UPI</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                      <Input
                        id="upi-received"
                        type="text"
                        value={upiReceived}
                        onChange={handleUpiChange}
                        placeholder="0"
                        className="pl-8 text-xl h-12 font-semibold text-right"
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
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
              )}

              <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <Button key={amount} variant="outline" size="sm" onClick={() => handleQuickAmount(amount)} disabled={isProcessing} className="h-9">₹{amount}</Button>
                ))}
                <Button variant="outline" size="sm" onClick={handleExactAmount} disabled={isProcessing} className="h-9">Exact</Button>
              </div>

              {parsedAmount > 0 && (
                <div className={cn('p-3 rounded-lg text-center', change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                  {change >= 0 ? (
                    <><p className="text-sm">Change</p><p className="text-xl font-bold">{formatPrice(change)}</p></>
                  ) : (
                    <><p className="text-sm flex items-center justify-center gap-1"><AlertCircle className="w-4 h-4" />Balance Due</p><p className="text-xl font-bold">{formatPrice(Math.abs(change))}</p></>
                  )}
                </div>
              )}
            </div>
          )}

          {inputError && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{inputError}</p>}

          {paymentMethod === 'Due' && remainingTotal > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {formatPrice(remainingTotal)} will be added to customer's due balance.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 flex-none border-t bg-background gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isProcessing}>Cancel</Button>
          <Button
            onClick={handleComplete}
            disabled={!isValidPayment || isProcessing}
            className="min-w-30 bg-blue-600 text-white hover:bg-blue-700"
          >
            {isProcessing ? 'Processing...' : (
              <><CheckCircle2 className="w-4 h-4 mr-2" />Complete Sale</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CheckoutDialog;
