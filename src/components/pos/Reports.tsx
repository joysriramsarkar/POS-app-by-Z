'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TrendingUp, TrendingDown, DollarSign, Package, Users,
  AlertTriangle, Download, BarChart2, Lightbulb
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { format, subDays } from 'date-fns';

type ChartType = 'bar' | 'line';
type DatePreset = '1' | '7' | '30' | '90' | 'custom';

const PAYMENT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const Reports: React.FC = () => {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [stockData, setStockData] = useState<any[]>([]);
  const [dueData, setDueData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);

  // Date filter state
  const [preset, setPreset] = useState<DatePreset>('30');
  const [customFrom, setCustomFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const isToday = preset === '1';

  const dateParams = useMemo(() => {
    if (preset !== 'custom') {
      const days = parseInt(preset);
      const from = days === 1 ? format(new Date(), 'yyyy-MM-dd') : format(subDays(new Date(), days - 1), 'yyyy-MM-dd');
      const base = `from=${from}&to=${format(new Date(), 'yyyy-MM-dd')}`;
      return days === 1 ? base + '&hourly=true' : base;
    }
    return `from=${customFrom}&to=${customTo}`;
  }, [preset, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [salesResult, stockResult, duesResult, productsResult] = await Promise.allSettled([
        fetch(`/api/reports/sales?${dateParams}`),
        fetch('/api/reports/stock'),
        fetch('/api/reports/dues'),
        fetch(`/api/reports/products?${dateParams}`)
      ]);

      if (salesResult.status === 'fulfilled' && salesResult.value.ok) {
        const j = await salesResult.value.json();
        setSummaryData(j.summary);
        setSalesData(j.chartData);
      }
      if (stockResult.status === 'fulfilled' && stockResult.value.ok) {
        const j = await stockResult.value.json();
        setStockData(j.lowStockItems);
      }
      if (duesResult.status === 'fulfilled' && duesResult.value.ok) {
        const j = await duesResult.value.json();
        setDueData(j.customersWithDues);
      }
      if (productsResult.status === 'fulfilled' && productsResult.value.ok) {
        const j = await productsResult.value.json();
        setTopProducts(j.topProducts);
      }

      const allFailed = [salesResult, stockResult, duesResult, productsResult].every(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
      );
      if (allFailed) setErrorMessage('Failed to load report data. Please refresh and try again.');
    } catch (error) {
      setErrorMessage('An unexpected error occurred while loading reports.');
    } finally {
      setIsLoading(false);
    }
  }, [dateParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const outstandingDues = useMemo(
    () => dueData?.reduce((acc, c) => acc + c.totalDue, 0).toFixed(2) || '0.00',
    [dueData]
  );

  const paymentBreakdown = useMemo(() => {
    if (!summaryData?.paymentBreakdown) return [];
    return Object.entries(summaryData.paymentBreakdown).map(([name, value]) => ({ name, value }));
  }, [summaryData]);

  // CSV export
  const handleExportCSV = useCallback(() => {
    if (!salesData.length) return;
    const header = isToday ? ['Hour', 'Revenue', 'Profit', 'Orders'] : ['Date', 'Revenue', 'Profit', 'Orders'];
    const rows = [
      header,
      ...salesData.map(d => [d.date, d.revenue.toFixed(2), d.profit.toFixed(2), d.count])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [salesData, isToday]);

  const DateFilter = (
    <div className="flex flex-wrap items-end gap-2 shrink-0">
      {(['1', '7', '30', '90'] as DatePreset[]).map(p => (
        <Button
          key={p}
          size="sm"
          variant={preset === p ? 'default' : 'outline'}
          className="min-h-9 text-xs"
          onClick={() => setPreset(p)}
        >
          {p === '1' ? 'Today' : `${p}d`}
        </Button>
      ))}
      <Button
        size="sm"
        variant={preset === 'custom' ? 'default' : 'outline'}
        className="min-h-9 text-xs"
        onClick={() => setPreset('custom')}
      >
        Custom
      </Button>
      {preset === 'custom' && (
        <>
          <div className="flex items-center gap-1">
            <Label className="text-xs shrink-0">From</Label>
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-9 text-xs w-36" />
          </div>
          <div className="flex items-center gap-1">
            <Label className="text-xs shrink-0">To</Label>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-9 text-xs w-36" />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-muted/20">
      <div className="shrink-0 border-b bg-background p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground">Comprehensive business overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            onClick={async () => {
              if (!summaryData) return;
              setIsAiDialogOpen(true);
              setIsAiLoading(true);
              try {
                const res = await fetch('/api/ai', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ summary: summaryData }),
                });
                const data = await res.json();
                if (data.success) {
                  setAiAdvice(data.advice);
                } else {
                  setAiAdvice('Sorry, could not fetch AI advice right now.');
                }
              } catch (e) {
                setAiAdvice('Sorry, could not fetch AI advice right now.');
              } finally {
                setIsAiLoading(false);
              }
            }}
          >
            <Lightbulb className="w-4 h-4" />
            <span className="hidden sm:inline">Ask AI</span>
          </Button>
          {DateFilter}
          <Button variant="outline" onClick={handleExportCSV} className="gap-2 border-primary/20 hover:bg-primary/5 min-h-9 touch-manipulation">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-600">
              <Lightbulb className="w-5 h-5" />
              AI Business Advisor
            </DialogTitle>
            <DialogDescription>
              Personalized business advice based on your current reports.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-muted/30 rounded-xl min-h-[100px] text-sm whitespace-pre-wrap">
            {isAiLoading ? 'Analyzing your data and generating advice...' : aiAdvice}
          </div>
        </DialogContent>
      </Dialog>

      {errorMessage && (
        <div className="shrink-0 bg-destructive/10 border-b border-destructive/30 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <p className="text-sm font-medium text-destructive flex-1">{errorMessage}</p>
          <Button variant="ghost" size="sm" onClick={fetchData} className="text-destructive hover:text-destructive min-h-9">Retry</Button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-6 pb-24">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-lg md:text-2xl font-bold">₹{summaryData?.totalRevenue?.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {(summaryData?.revenueGrowth ?? 0) >= 0
                  ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                  : <TrendingDown className="w-3 h-3 text-red-500" />}
                <span className={`font-medium ${(summaryData?.revenueGrowth ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {summaryData?.revenueGrowth || '0'}%
                </span>
                <span className="hidden sm:inline"> vs prev period</span>
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg md:text-2xl font-bold text-emerald-600">₹{summaryData?.totalProfit?.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-emerald-500 font-medium">{summaryData?.profitMargin || '0'}%</span> margin
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
              <Package className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg md:text-2xl font-bold">{summaryData?.totalSalesCount || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Invoices</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Dues</CardTitle>
              <Users className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg md:text-2xl font-bold text-amber-600">₹{outstandingDues}</div>
              <p className="text-xs text-muted-foreground mt-1">To be collected</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sales" className="w-full">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList className="h-auto flex flex-wrap gap-1 bg-muted p-1 rounded-lg w-full sm:w-auto">
              <TabsTrigger className="flex-1 sm:flex-none" value="sales">Sales</TabsTrigger>
              <TabsTrigger className="flex-1 sm:flex-none" value="payment">Payment</TabsTrigger>
              <TabsTrigger className="flex-1 sm:flex-none" value="stock">Auto Restock</TabsTrigger>
              <TabsTrigger className="flex-1 sm:flex-none" value="dues">Dues</TabsTrigger>
              <TabsTrigger className="flex-1 sm:flex-none" value="products">Top Items</TabsTrigger>
            </TabsList>
          </div>

          {/* Sales Tab */}
          <TabsContent value="sales">
            <Card className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Sales Trend</CardTitle>
                  <CardDescription>{isToday ? 'Hourly sales for today' : 'Daily sales and profit for selected period'}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 min-h-9"
                  onClick={() => setChartType(t => t === 'bar' ? 'line' : 'bar')}
                >
                  <BarChart2 className="w-4 h-4" />
                  {chartType === 'bar' ? 'Line' : 'Bar'}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="w-full h-64 md:h-80">
                  {isLoading ? (
                    <div className="w-full h-full flex items-center justify-center border border-dashed rounded-lg">
                      <p className="text-muted-foreground">Loading chart data...</p>
                    </div>
                  ) : salesData?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === 'bar' ? (
                        <BarChart data={salesData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                          <XAxis dataKey="date" tickFormatter={v => isToday ? v : (() => { const d = new Date(v); return `${d.getDate()}/${d.getMonth()+1}`; })()} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                          <YAxis tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `₹${v}`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                          <RechartsTooltip formatter={(v: number, n: string) => [`₹${v.toFixed(2)}`, n.charAt(0).toUpperCase()+n.slice(1)]} labelFormatter={l => isToday ? `${l} hrs` : new Date(l).toLocaleDateString()} contentStyle={{ borderRadius: '8px' }} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4,4,0,0]} maxBarSize={30} />
                          <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4,4,0,0]} maxBarSize={30} />
                        </BarChart>
                      ) : (
                        <LineChart data={salesData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                          <XAxis dataKey="date" tickFormatter={v => isToday ? v : (() => { const d = new Date(v); return `${d.getDate()}/${d.getMonth()+1}`; })()} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                          <YAxis tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `₹${v}`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                          <RechartsTooltip formatter={(v: number, n: string) => [`₹${v.toFixed(2)}`, n.charAt(0).toUpperCase()+n.slice(1)]} labelFormatter={l => isToday ? `${l} hrs` : new Date(l).toLocaleDateString()} contentStyle={{ borderRadius: '8px' }} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} dot={false} />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center border border-dashed rounded-lg">
                      <p className="text-muted-foreground">No sales data for this period.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Breakdown Tab */}
          <TabsContent value="payment">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle>Payment Method Breakdown</CardTitle>
                  <CardDescription>Revenue by payment method</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-64">
                    {paymentBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={paymentBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                            {paymentBreakdown.map((_, i) => (
                              <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(v: number) => `₹${v.toFixed(2)}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center border border-dashed rounded-lg">
                        <p className="text-muted-foreground">{isLoading ? 'Loading...' : 'No data.'}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle>Payment Summary</CardTitle>
                  <CardDescription>Totals per method</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentBreakdown.length > 0 ? paymentBreakdown.map((p, i) => {
                        const total = paymentBreakdown.reduce((s, x) => s + (x.value as number), 0);
                        return (
                          <TableRow key={p.name}>
                            <TableCell className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full inline-block" style={{ background: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                              {p.name}
                            </TableCell>
                            <TableCell className="text-right font-medium">₹{(p.value as number).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{total > 0 ? ((p.value as number / total) * 100).toFixed(1) : 0}%</TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                            {isLoading ? 'Loading...' : 'No payment data.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Stock Alerts / Auto Restock Tab */}
          <TabsContent value="stock">
            <Card className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Auto Restock List</CardTitle>
                  <CardDescription>Items at or below minimum stock level</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  const itemsText = stockData.map((i: any) => `${i.name} - Stock: ${i.currentStock}`).join('\n');
                  const blob = new Blob([itemsText], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `restock-list-${format(new Date(), 'yyyy-MM-dd')}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="w-4 h-4 mr-2" />
                  Download List
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">Min Level</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockData?.length > 0 ? stockData.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <p className="text-sm">{item.name}</p>
                            {item.nameBn && <p className="text-xs text-muted-foreground">{item.nameBn}</p>}
                          </TableCell>
                          <TableCell className="text-right text-red-500 font-bold">{item.currentStock} {item.unit}</TableCell>
                          <TableCell className="hidden sm:table-cell text-right">{item.minStockLevel} {item.unit}</TableCell>
                          <TableCell className="text-right">
                            {item.currentStock === 0
                              ? <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                              : <Badge variant="destructive" className="text-xs bg-orange-500 hover:bg-orange-600">Low</Badge>
                            }
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                            {isLoading ? 'Loading stock data...' : '✅ All items are well stocked.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dues Tab */}
          <TabsContent value="dues">
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>Outstanding Customer Dues</CardTitle>
                <CardDescription>Customers with pending payments — Total: ₹{outstandingDues}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Total Due</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">Last Purchase</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dueData?.length > 0 ? dueData.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                            <p className="text-sm">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.phone || 'N/A'}</p>
                          </TableCell>
                          <TableCell className="text-right text-amber-600 font-bold">₹{c.totalDue.toFixed(2)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-right text-muted-foreground text-xs">{new Date(c.updatedAt).toLocaleDateString()}</TableCell>
                          <TableCell className="hidden sm:table-cell text-right">
                            <Badge variant="outline">{c._count?.sales || 0}</Badge>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                            {isLoading ? 'Loading customer dues...' : '✅ No pending dues.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Products Tab */}
          <TabsContent value="products">
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
                <CardDescription>Best performing items for selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty Sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts?.length > 0 ? topProducts.map((p: any, i: number) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                          <TableCell className="font-medium">
                            <p className="text-sm">{p.name}</p>
                            {p.nameBn && <p className="text-xs text-muted-foreground">{p.nameBn}</p>}
                          </TableCell>
                          <TableCell className="text-right">{p.quantity} <span className="text-muted-foreground text-xs">{p.unit}</span></TableCell>
                          <TableCell className="text-right font-medium">₹{p.revenue.toFixed(2)}</TableCell>
                          <TableCell className={`text-right font-medium ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            ₹{p.profit.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                            {isLoading ? 'Loading products data...' : 'No product data.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default React.memo(Reports);
