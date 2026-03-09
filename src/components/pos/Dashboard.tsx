'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useProductsStore, useCartStore } from '@/stores/pos-store';
import { STORE_CONFIG } from '@/types/pos';
import { cn } from '@/lib/utils';

interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  lowStockCount: number;
  duePayments: number;
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
    lowStockCount: 0,
    duePayments: 0,
  });
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  
  const products = useProductsStore((state) => state.products);
  const lowStockProducts = products.filter(p => p.currentStock <= p.minStockLevel && p.isActive);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [salesRes, statsRes] = await Promise.all([
          fetch('/api/sales?limit=5'),
          fetch('/api/stats'),
        ]);

        if (salesRes.ok) {
          const { data: sales } = await salesRes.json();
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
        }

        if (statsRes.ok) {
          const { data: apiStats } = await statsRes.json();
          setStats(prevStats => ({
            ...prevStats,
            ...apiStats,
          }));
        }

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };
    fetchDashboardData();
  }, []);

  useEffect(() => {
    setStats(prevStats => ({
      ...prevStats,
      lowStockCount: lowStockProducts.length
    }));
  }, [lowStockProducts.length]);

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
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Today's Sales */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-700">Today's Sales</CardTitle>
                <IndianRupee className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">{formatPrice(stats.todaySales)}</div>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +12% from yesterday
                </p>
              </CardContent>
            </Card>

            {/* Today's Orders */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-700">Today's Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">{stats.todayOrders}</div>
                <p className="text-xs text-blue-600 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +5 from yesterday
                </p>
              </CardContent>
            </Card>

            {/* Low Stock Items */}
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-amber-700">Low Stock</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-700">{lowStockProducts.length}</div>
                <p className="text-xs text-amber-600 mt-1">Items need restock</p>
              </CardContent>
            </Card>

            {/* Due Payments */}
            <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-700">Due Payments</CardTitle>
                <Clock className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">{formatPrice(stats.duePayments)}</div>
                <p className="text-xs text-red-600 mt-1">Total pending dues</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <Button 
                  variant="outline" 
                  className="h-auto flex-col gap-2 py-4"
                  onClick={() => handleQuickAction('billing')}
                >
                  <ShoppingCart className="w-6 h-6 text-primary" />
                  <span className="text-sm">New Sale</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto flex-col gap-2 py-4"
                  onClick={() => handleQuickAction('stock')}
                >
                  <Package className="w-6 h-6 text-primary" />
                  <span className="text-sm">Add Stock</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto flex-col gap-2 py-4"
                  onClick={() => handleQuickAction('parties')}
                >
                  <Users className="w-6 h-6 text-primary" />
                  <span className="text-sm">Add Party</span>
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
                <ScrollArea className="h-[240px]">
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
                <ScrollArea className="h-[240px]">
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
