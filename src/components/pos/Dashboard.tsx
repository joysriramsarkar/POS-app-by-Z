'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  IndianRupee,
  ShoppingCart,
  AlertTriangle,
  Clock,
  Plus,
  Package,
  Users,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { useProductsStore, useCartStore } from '@/stores/pos-store';
import { STORE_CONFIG } from '@/types/pos';
import { cn } from '@/lib/utils';

interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  duePayments: number;
  salesComparison?: string;
  ordersComparison?: string;
}

interface RecentTransaction {
  id: string;
  invoiceNumber: string;
  customerName?: string;
  totalAmount: number;
  paymentMethod: string;
  createdAt: Date;
}



interface DashboardProps {
  onNavigate?: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayOrders: 0,
    duePayments: 0,
    salesComparison: 'N/A',
    ordersComparison: 'N/A',
  });
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  
  const products = useProductsStore((state) => state.products);
  const lowStockProducts = products.filter(p => p.currentStock <= p.minStockLevel && p.isActive);



  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [salesResult, statsResult] = await Promise.allSettled([
          fetch('/api/sales?limit=5'),
          fetch('/api/stats'),
        ]);

        if (salesResult.status === 'fulfilled' && salesResult.value.ok) {
          try {
            const { data: sales } = await salesResult.value.json();
            if (sales) {
              const recentTransactions = sales.map((sale: any) => ({
                id: sale.id,
                invoiceNumber: sale.invoiceNumber,
                customerName: sale.customer?.name,
                totalAmount: sale.totalAmount,
                paymentMethod: sale.paymentMethod,
                createdAt: new Date(sale.createdAt),
              }));
              setTransactions(recentTransactions);
            }
          } catch (parseErr) {
            console.error('Failed to parse sales response:', parseErr);
          }
        } else if (salesResult.status === 'fulfilled') {
          console.warn('Sales API returned non-OK status:', salesResult.value.status);
        } else {
          console.error('Sales API fetch failed:', salesResult.reason);
        }

        if (statsResult.status === 'fulfilled' && statsResult.value.ok) {
          try {
            const { data: apiStats } = await statsResult.value.json();
            setStats(prevStats => ({
              ...prevStats,
              ...apiStats,
            }));
          } catch (parseErr) {
            console.error('Failed to parse stats response:', parseErr);
          }
        } else if (statsResult.status === 'fulfilled') {
          console.warn('Stats API returned non-OK status:', statsResult.value.status);
        } else {
          console.error('Stats API fetch failed:', statsResult.reason);
        }

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };
    fetchDashboardData();
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const handleQuickAction = (action: string) => {
    if (onNavigate) {
      onNavigate(action);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{STORE_CONFIG.name}</h1>
            <p className="text-muted-foreground">{STORE_CONFIG.nameBn}</p>
          </div>
          

          <div className="text-right">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="font-semibold">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => signOut()} className="gap-2 bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/50">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">লগ আউট (Logout)</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Today's Sales */}
            <Card className="bg-linear-to-br from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20 border-green-200 dark:border-green-800/50 shadow-md hover:shadow-lg transition-shadow rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Today's Sales</CardTitle>
                <div className="w-8 h-8 rounded-full bg-green-200/50 dark:bg-green-800/50 flex items-center justify-center">
                  <IndianRupee className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-green-700 dark:text-green-400 tracking-tight">{formatPrice(stats.todaySales)}</div>
                <p className="text-xs text-green-600 dark:text-green-500 flex items-center mt-1 font-medium">
                  {stats.salesComparison === 'N/A' ? null : stats.salesComparison?.startsWith('-') ? (
                    <TrendingDown className="w-3 h-3 mr-1" />
                  ) : (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  )}
                  {stats.salesComparison || 'N/A'}
                </p>
              </CardContent>
            </Card>

            {/* Today's Orders */}
            <Card className="bg-linear-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 border-blue-200 dark:border-blue-800/50 shadow-md hover:shadow-lg transition-shadow rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Today's Orders</CardTitle>
                <div className="w-8 h-8 rounded-full bg-blue-200/50 dark:bg-blue-800/50 flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-blue-700 dark:text-blue-400 tracking-tight">{stats.todayOrders}</div>
                <p className="text-xs text-blue-600 dark:text-blue-500 flex items-center mt-1 font-medium">
                  {stats.ordersComparison === 'N/A' ? null : stats.ordersComparison?.startsWith('-') ? (
                    <TrendingDown className="w-3 h-3 mr-1" />
                  ) : (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  )}
                  {stats.ordersComparison || 'N/A'}
                </p>
              </CardContent>
            </Card>

            {/* Low Stock Items */}
            <Card className="bg-linear-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 border-amber-200 dark:border-amber-800/50 shadow-md hover:shadow-lg transition-shadow rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Low Stock</CardTitle>
                <div className="w-8 h-8 rounded-full bg-amber-200/50 dark:bg-amber-800/50 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-400 tracking-tight">{lowStockProducts.length}</div>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 font-medium">Items need restock</p>
              </CardContent>
            </Card>

            {/* Due Payments */}
            <Card className="bg-linear-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20 border-red-200 dark:border-red-800/50 shadow-md hover:shadow-lg transition-shadow rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Due Payments</CardTitle>
                <div className="w-8 h-8 rounded-full bg-red-200/50 dark:bg-red-800/50 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-red-700 dark:text-red-400 tracking-tight">{formatPrice(stats.duePayments)}</div>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1 font-medium">Total pending dues</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="rounded-2xl shadow-sm border-border/50 bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 md:gap-4">
                <Button 
                  variant="outline" 
                  className="h-auto flex-col gap-3 py-5 rounded-xl border-border/50 hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-all shadow-xs group"
                  onClick={() => handleQuickAction('billing')}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold">New Sale</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto flex-col gap-3 py-5 rounded-xl border-border/50 hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-all shadow-xs group"
                  onClick={() => handleQuickAction('stock')}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold">Add Stock</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto flex-col gap-3 py-5 rounded-xl border-border/50 hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-all shadow-xs group"
                  onClick={() => handleQuickAction('parties')}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold">Add Party</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Low Stock Items
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleQuickAction('stock')}>
                  View All <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-60">
                  <div className="px-6 pb-4 space-y-2">
                    {lowStockProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">All items are well stocked!</p>
                    ) : (
                      lowStockProducts.slice(0, 5).map((product) => (
                        <div
                          key={product.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.category}</p>
                          </div>
                          <div className="text-right ml-4">
                            <Badge
                              variant={product.currentStock === 0 ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {product.currentStock === 0 ? 'Out of Stock' : `${product.currentStock} left`}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">Min: {product.minStockLevel}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  Recent Transactions
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleQuickAction('reports')}>
                  View All <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-60">
                  <div className="px-6 pb-4 space-y-2">
                    {transactions.map((txn) => (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{txn.invoiceNumber}</p>
                            <Badge
                              variant={txn.paymentMethod === 'Due' ? 'destructive' : txn.paymentMethod === 'UPI' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {txn.paymentMethod}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {txn.customerName || 'Walk-in'} • {formatTime(txn.createdAt)}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold">{formatPrice(txn.totalAmount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
