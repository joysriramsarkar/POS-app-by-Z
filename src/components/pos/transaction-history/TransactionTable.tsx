import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Download, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { formatPrice, getStatusColor, getPaymentStatusColor } from './utils';
import { Transaction } from './types';

interface TransactionTableProps {
  transactions: Transaction[];
  onViewDetails: (transaction: Transaction) => void;
  onExport: (transaction: Transaction) => void;
}

export function TransactionTable({
  transactions,
  onViewDetails,
  onExport,
}: TransactionTableProps) {
  return (
    <ScrollArea className="flex-1 w-full h-full">
      <div className="min-w-max">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow className="hover:bg-transparent border-b min-h-10 md:min-h-12">
                <TableHead className="w-32 text-xs md:text-sm py-1 md:py-2">Invoice</TableHead>
                <TableHead className="w-32 text-xs md:text-sm py-1 md:py-2">Date & Time</TableHead>
                <TableHead className="w-40 text-xs md:text-sm py-1 md:py-2">Customer</TableHead>
                <TableHead className="w-32 text-xs md:text-sm py-1 md:py-2">User</TableHead>
                <TableHead className="w-24 text-right text-xs md:text-sm py-1 md:py-2">Amount</TableHead>
                <TableHead className="w-24 text-right text-xs md:text-sm py-1 md:py-2">Paid</TableHead>
                <TableHead className="w-28 text-xs md:text-sm py-1 md:py-2">Payment</TableHead>
                <TableHead className="w-24 text-xs md:text-sm py-1 md:py-2">Status</TableHead>
                <TableHead className="w-16 text-center text-xs md:text-sm py-1 md:py-2">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction: Transaction) => (
                <TableRow key={transaction.id} className="hover:bg-muted/50 min-h-10 md:min-h-12">
                  <TableCell className="font-mono font-semibold text-xs md:text-sm py-1 md:py-2">
                    {transaction.invoiceNumber}
                  </TableCell>
                  <TableCell className="text-xs md:text-sm py-1 md:py-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      {format(transaction.createdAt, 'dd MMM yyyy HH:mm')}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs md:text-sm py-1 md:py-2">
                    {transaction.customer ? (
                      <div className="space-y-0.5">
                        <p className="font-medium text-xs md:text-sm">{transaction.customer.name}</p>
                        {transaction.customer.phone && (
                          <p className="text-xs text-muted-foreground">{transaction.customer.phone}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs md:text-sm text-muted-foreground">Walk-in Customer</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs md:text-sm py-1 md:py-2">
                    {transaction.user ? (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{transaction.user.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-xs md:text-sm py-1 md:py-2">
                    {formatPrice(transaction.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">
                    {formatPrice(transaction.amountPaid)}
                  </TableCell>
                  <TableCell className="text-xs md:text-sm py-1 md:py-2">
                    <Badge variant="outline" className="text-xs md:text-sm">
                      {transaction.paymentMethod}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1 md:py-2">
                    <div className="space-y-1 md:space-y-2">
                      <Badge className={getStatusColor(transaction.status)}>
                        {transaction.status}
                      </Badge>
                      <Badge className={getPaymentStatusColor(transaction.paymentStatus)}>
                        {transaction.paymentStatus}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(transaction)}
                        className="h-8 w-8 p-0"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onExport(transaction)}
                        className="h-8 w-8 p-0"
                        title="Export"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
