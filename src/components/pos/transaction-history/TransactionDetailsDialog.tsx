import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { formatPrice, getPaymentStatusColor } from './utils';
import { Transaction, TransactionItem } from './types';

interface TransactionDetailsDialogProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (status: 'Cancelled' | 'Refunded') => void;
}

export function TransactionDetailsDialog({
  transaction,
  isOpen,
  onOpenChange,
  onUpdateStatus,
}: TransactionDetailsDialogProps) {
  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transaction Details - {transaction.invoiceNumber}</DialogTitle>
          <DialogDescription>
            {format(transaction.createdAt, 'dd MMMM yyyy HH:mm:ss')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Customer</div>
                <div className="font-semibold text-lg mt-1">
                  {transaction.customer?.name || 'Walk-in'}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Created By</div>
                <div className="font-semibold text-lg mt-1">
                  {transaction.user?.name || 'Unknown'}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Items</h3>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transaction.items.map((item: TransactionItem, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatPrice(item.unitPrice)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatPrice(item.totalPrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{formatPrice(transaction.totalAmount + transaction.discount - transaction.tax)}</span>
            </div>
            {transaction.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span>-{formatPrice(transaction.discount)}</span>
              </div>
            )}
            {transaction.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax:</span>
                <span>{formatPrice(transaction.tax)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg border-t pt-2 mt-2">
              <span>Total Amount:</span>
              <span>{formatPrice(transaction.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount Paid:</span>
              <span className="font-semibold">{formatPrice(transaction.amountPaid)}</span>
            </div>
            {transaction.totalAmount - transaction.amountPaid > 0 && (
              <div className="flex justify-between text-red-600 font-semibold">
                <span>Due:</span>
                <span>{formatPrice(transaction.totalAmount - transaction.amountPaid)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Payment Method</div>
                <Badge variant="outline" className="mt-2">
                  {transaction.paymentMethod}
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Payment Status</div>
                <Badge className={`mt-2 ${getPaymentStatusColor(transaction.paymentStatus)}`}>
                  {transaction.paymentStatus}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {transaction.status === 'Completed' && (
            <div className="flex flex-col gap-3 mt-4">
              <div className="text-sm font-medium">Manage Order</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  onClick={() => onUpdateStatus('Cancelled')}
                  className="h-10"
                >
                  Cancel Order
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onUpdateStatus('Refunded')}
                  className="h-10"
                >
                  Refund Order
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
