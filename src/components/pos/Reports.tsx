'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  AlertTriangle,
  Download
} from 'lucide-react';

const Reports: React.FC = () => {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [stockData, setStockData] = useState<any[]>([]);
  const [dueData, setDueData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [salesResult, stockResult, duesResult, productsResult] = await Promise.allSettled([
        fetch('/api/reports/sales?days=30'),
        fetch('/api/reports/stock'),
        fetch('/api/reports/dues'),
        fetch('/api/reports/products?days=30')
      ]);

      if (salesResult.status === 'fulfilled' && salesResult.value.ok) {
        const salesJson = await salesResult.value.json();
        setSummaryData(salesJson.summary);
        setSalesData(salesJson.chartData);
      } else {
        console.warn('Sales API failed:', salesResult.status === 'fulfilled' ? salesResult.value.status : salesResult.reason);
      }

      if (stockResult.status === 'fulfilled' && stockResult.value.ok) {
        const stockJson = await stockResult.value.json();
        setStockData(stockJson.lowStockItems);
      } else {
        console.warn('Stock API failed:', stockResult.status === 'fulfilled' ? stockResult.value.status : stockResult.reason);
      }

      if (duesResult.status === 'fulfilled' && duesResult.value.ok) {
        const duesJson = await duesResult.value.json();
        setDueData(duesJson.customersWithDues);
      } else {
        console.warn('Dues API failed:', duesResult.status === 'fulfilled' ? duesResult.value.status : duesResult.reason);
      }

      if (productsResult.status === 'fulfilled' && productsResult.value.ok) {
        const productsJson = await productsResult.value.json();
        setTopProducts(productsJson.topProducts);
      } else {
        console.warn('Products API failed:', productsResult.status === 'fulfilled' ? productsResult.value.status : productsResult.reason);
      }

      const allFailed = [salesResult, stockResult, duesResult, productsResult].every(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
      );
      if (allFailed) {
        setErrorMessage('Failed to load report data. Please refresh the page and try again.');
      }
    } catch (error) {
      console.error("Unexpected error fetching report data", error);
      setErrorMessage('An unexpected error occurred while loading reports.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownloadReport = useCallback(() => {
    window.print();
  }, []);

  const outstandingDues = useMemo(() => {
    return dueData?.reduce((acc, curr) => acc + curr.totalDue, 0).toFixed(2) || '0.00';
  }, [dueData]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-muted/20">
      <div className="shrink-0 border-b bg-background p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground">Comprehensive overview of your business</p>
        </div>
        <Button variant="outline" onClick={handleDownloadReport} className="gap-2 border-primary/20 hover:bg-primary/5">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Download PDF</span>
        </Button>
      </div>

      {errorMessage && (
        <div className="shrink-0 bg-destructive/10 border-b border-destructive/30 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">{errorMessage}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchData}
            className="text-destructive hover:text-destructive"
          >
            Retry
          </Button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{`₹${summaryData?.totalRevenue?.toFixed(2) || '0.00'}`}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {summaryData?.revenueGrowth >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                <span className={`font-medium ${summaryData?.revenueGrowth >= 0 ? "text-emerald-500" : "text-red-500"}`}>{summaryData?.revenueGrowth || "0"}%</span> from last period
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{`₹${summaryData?.totalProfit?.toFixed(2) || '0.00'}`}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span className="text-emerald-500 font-medium">{summaryData?.profitMargin || "0"}%</span> margin
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
              <Package className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData?.totalSalesCount || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Invoices generated
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Dues</CardTitle>
              <Users className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{`₹${outstandingDues}`}</div>
              <p className="text-xs text-muted-foreground mt-1">
                To be collected
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sales" className="w-full">
          <TabsList className="w-full mb-4 md:grid md:grid-cols-4 md:max-w-2xl flex gap-2 overflow-x-auto md:overflow-visible">
            <TabsTrigger className="whitespace-nowrap text-sm px-3 py-2 md:text-base md:px-0 md:py-0" value="sales">Sales & Profit</TabsTrigger>
            <TabsTrigger className="whitespace-nowrap text-sm px-3 py-2 md:text-base md:px-0 md:py-0" value="stock">Stock Movement</TabsTrigger>
            <TabsTrigger className="whitespace-nowrap text-sm px-3 py-2 md:text-base md:px-0 md:py-0" value="dues">Customer Dues</TabsTrigger>
            <TabsTrigger className="whitespace-nowrap text-sm px-3 py-2 md:text-base md:px-0 md:py-0" value="products">Top Products</TabsTrigger>
          </TabsList>
          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <CardTitle>Sales Trend</CardTitle>
                <CardDescription>Daily sales and profit for the last 30 days</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <div className="w-full h-full min-h-[350px]">
                  {isLoading ? (
                    <div className="w-full h-full flex items-center justify-center border border-dashed rounded-lg">
                      <p className="text-muted-foreground">Loading chart data...</p>
                    </div>
                  ) : salesData && salesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(val) => {
                            const date = new Date(val);
                            return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`;
                          }}
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickFormatter={(val) => `₹${val}`}
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [`₹${value.toFixed(2)}`, name.charAt(0).toUpperCase() + name.slice(1)]}
                          labelFormatter={(label) => new Date(label).toLocaleDateString()}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                        <Legend />
                        <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center border border-dashed rounded-lg">
                      <p className="text-muted-foreground">No sales data available for this period.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="stock">
            <Card>
              <CardHeader>
                <CardTitle>Low Stock Alerts</CardTitle>
                <CardDescription>Items running low on inventory</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                      <TableHead className="text-right">Min Level</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockData && stockData.length > 0 ? (
                      stockData.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <div>
                              <p>{item.name}</p>
                              {item.nameBn && <p className="text-xs text-muted-foreground">{item.nameBn}</p>}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                          <TableCell className="text-right text-red-500 font-bold">{item.currentStock} {item.unit}</TableCell>
                          <TableCell className="text-right">{item.minStockLevel} {item.unit}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive" className="ml-auto">Low Stock</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          {isLoading ? "Loading stock data..." : "No stock alerts found."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="dues">
            <Card>
              <CardHeader>
                <CardTitle>Outstanding Customer Dues</CardTitle>
                <CardDescription>Customers with pending payments</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Total Due</TableHead>
                      <TableHead className="text-right">Last Purchase</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueData && dueData.length > 0 ? (
                      dueData.map((customer: any) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell>{customer.phone || 'N/A'}</TableCell>
                          <TableCell className="text-right text-amber-600 font-bold">₹{customer.totalDue.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{new Date(customer.updatedAt).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{customer._count?.sales || 0} Orders</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          {isLoading ? "Loading customer dues..." : "No pending dues found."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
                <CardDescription>Best performing items by quantity and revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Quantity Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts && topProducts.length > 0 ? (
                      topProducts.map((product: any) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">
                            <div>
                              <p>{product.name}</p>
                              {product.nameBn && <p className="text-xs text-muted-foreground">{product.nameBn}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{product.quantity} {product.unit}</TableCell>
                          <TableCell className="text-right font-medium">₹{product.revenue.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-medium">₹{product.profit.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          {isLoading ? "Loading products data..." : "No product data found."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default React.memo(Reports);
