'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Eye,
  Download,
  Filter,
  Search,
  Calendar,
  User,
  CreditCard,
  Package,
  Clock,
  IndianRupee,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface TransactionItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Transaction {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  amountPaid: number;
  discount: number;
  tax: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt: Date;
  customer?: {
    id: string;
    name: string;
    phone?: string;
  };
  user?: {
    id: string;
    name: string;
    username: string;
  };
  items: TransactionItem[];
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('page', currentPage.toString());
        params.append('limit', '20');

        if (searchQuery) {
          params.append('invoiceNumber', searchQuery);
        }

        if (filterStatus !== 'all') {
          params.append('status', filterStatus);
        }

        const response = await fetch(`/api/sales?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();
        if (data.success) {
          setTransactions(
            data.data.map((sale: any) => ({
              ...sale,
              createdAt: new Date(sale.createdAt),
            }))
          );
          setPagination(data.pagination);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load transactions',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [currentPage, searchQuery, filterStatus, toast]);

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Partial':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'Due':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'Refunded':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailOpen(true);
  };

  const handleExportTransaction = (transaction: Transaction) => {
    const data = JSON.stringify(transaction, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction-${transaction.invoiceNumber}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleUpdateSaleStatus = async (status: 'Cancelled' | 'Refunded') => {
    if (!selectedTransaction) return;
    const confirmMessage =
      status === 'Cancelled'
        ? 'Are you sure you want to cancel this order?'
        : 'Are you sure you want to refund this order?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/sales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTransaction.id,
          status,
          reason: `${status} from transaction history`,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error || 'Unable to update sale status');
      }

      const updatedTransaction = {
        ...selectedTransaction,
        status,
      };

      setSelectedTransaction(updatedTransaction);
      setTransactions((prev) =>
        prev.map((transaction) =>
          transaction.id === updatedTransaction.id ? updatedTransaction : transaction
        )
      );

      toast({
        title: 'Success',
        description: `Sale ${status.toLowerCase()} successfully`,
      });
    } catch (error) {
      console.error('Failed to update sale status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update sale status',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-hidden">
      <div className="space-y-2 shrink-0">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <p className="text-muted-foreground">View and manage all sales transactions</p>
      </div>

      <Card className="bg-muted/30 shrink-0">
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row flex-nowrap items-end gap-2 md:overflow-x-auto pb-2 w-full">
            <div className="w-full md:min-w-42.5 shrink-0 space-y-1">
              <label className="text-xs md:text-sm font-medium">Search Invoice</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Invoice number..."
                  value={searchQuery}
                  onChange={(e: any) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 h-8 md:h-9 text-xs md:text-sm"
                />
              </div>
            </div>
            <div className="w-full md:min-w-37.5 shrink-0 space-y-1">
              <label className="text-xs md:text-sm font-medium">Transaction Status</label>
              <Select value={filterStatus} onValueChange={(value: string) => {
                setFilterStatus(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="h-8 md:h-9 text-xs md:text-sm" />
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                  <SelectItem value="Refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:min-w-37.5 shrink-0 space-y-1">
              <label className="text-xs md:text-sm font-medium">Payment Method</label>
              <Select value={filterPaymentMethod} onValueChange={(value: string) => {
                setFilterPaymentMethod(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="h-8 md:h-9 text-xs md:text-sm" />
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Due">Due</SelectItem>
                  <SelectItem value="Prepaid">Prepaid</SelectItem>
                  <SelectItem value="Mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:min-w-30 shrink-0">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                  setFilterPaymentMethod('all');
                  setCurrentPage(1);
                }}
                className="h-8 md:h-9 w-full gap-2 text-xs md:text-sm"
              >
                <Filter className="w-4 h-4" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col min-h-[65vh] md:min-h-0 overflow-hidden">
        <CardHeader className="border-b shrink-0">
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            {pagination && `Showing ${transactions.length} of ${pagination.total} transactions`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col h-full">
          {isLoading ? (
            <div className="flex items-center justify-center flex-1">
              <div className="text-muted-foreground">Loading transactions...</div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center flex-1">
              <div className="text-muted-foreground">No transactions found</div>
            </div>
          ) : (
            <ScrollArea className="flex-1 w-full h-full">
              <div className="w-full overflow-x-auto">
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
                              onClick={() => handleViewDetails(transaction)}
                              className="h-8 w-8 p-0"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExportTransaction(transaction)}
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
            </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between shrink-0">
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
              disabled={currentPage === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details - {selectedTransaction?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              {selectedTransaction && format(selectedTransaction.createdAt, 'dd MMMM yyyy HH:mm:ss')}
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Customer</div>
                    <div className="font-semibold text-lg mt-1">
                      {selectedTransaction.customer?.name || 'Walk-in'}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Created By</div>
                    <div className="font-semibold text-lg mt-1">
                      {selectedTransaction.user?.name || 'Unknown'}
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
                    {selectedTransaction.items.map((item: TransactionItem, idx: number) => (
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
                  <span>{formatPrice(selectedTransaction.totalAmount + selectedTransaction.discount - selectedTransaction.tax)}</span>
                </div>
                {selectedTransaction.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount:</span>
                    <span>-{formatPrice(selectedTransaction.discount)}</span>
                  </div>
                )}
                {selectedTransaction.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax:</span>
                    <span>{formatPrice(selectedTransaction.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg border-t pt-2 mt-2">
                  <span>Total Amount:</span>
                  <span>{formatPrice(selectedTransaction.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid:</span>
                  <span className="font-semibold">{formatPrice(selectedTransaction.amountPaid)}</span>
                </div>
                {selectedTransaction.totalAmount - selectedTransaction.amountPaid > 0 && (
                  <div className="flex justify-between text-red-600 font-semibold">
                    <span>Due:</span>
                    <span>{formatPrice(selectedTransaction.totalAmount - selectedTransaction.amountPaid)}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Payment Method</div>
                    <Badge variant="outline" className="mt-2">
                      {selectedTransaction.paymentMethod}
                    </Badge>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Payment Status</div>
                    <Badge className={`mt-2 ${getPaymentStatusColor(selectedTransaction.paymentStatus)}`}>
                      {selectedTransaction.paymentStatus}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {selectedTransaction.status === 'Completed' && (
                <div className="flex flex-col gap-3 mt-4">
                  <div className="text-sm font-medium">Manage Order</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => handleUpdateSaleStatus('Cancelled')}
                      className="h-10"
                    >
                      Cancel Order
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateSaleStatus('Refunded')}
                      className="h-10"
                    >
                      Refund Order
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
