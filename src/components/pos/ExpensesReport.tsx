'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BarChart3, Tag, Truck, TrendingDown, IndianRupee, Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, subMonths, getWeek, getYear } from 'date-fns';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Other'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Rent: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Utilities: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Salaries: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Supplies: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Maintenance: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const CHART_COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#3b82f6', '#10b981', '#ec4899', '#f97316', '#14b8a6'];

const fp = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

interface ExpensesReportProps {
  onBack: () => void;
}

export function ExpensesReport({ onBack }: ExpensesReportProps) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [filterCategory, setFilterCategory] = useState('All');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetch('/api/expenses')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setExpenses(d.data ?? []))
      .catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    return expenses.filter(e => {
      const d = new Date(e.date);
      return d >= from && d <= to && (filterCategory === 'All' || e.category === filterCategory);
    });
  }, [expenses, dateFrom, dateTo, filterCategory]);

  const total = useMemo(() => filtered.reduce((s, e) => s + (e.amount ?? 0), 0), [filtered]);

  // Daily groups
  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => {
      const k = format(new Date(e.date), 'dd MMM');
      map[k] = (map[k] ?? 0) + (e.amount ?? 0);
    });
    return Object.entries(map).map(([date, amount]) => ({ date, amount })).reverse();
  }, [filtered]);

  // Weekly groups
  const weeklyData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => {
      const d = new Date(e.date);
      const k = `W${getWeek(d)} '${String(getYear(d)).slice(2)}`;
      map[k] = (map[k] ?? 0) + (e.amount ?? 0);
    });
    return Object.entries(map).map(([week, amount]) => ({ week, amount }));
  }, [filtered]);

  // Monthly groups
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => {
      const k = format(new Date(e.date), 'MMM yyyy');
      map[k] = (map[k] ?? 0) + (e.amount ?? 0);
    });
    return Object.entries(map).map(([month, amount]) => ({ month, amount }));
  }, [filtered]);

  // Category totals
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => { map[e.category] = (map[e.category] ?? 0) + (e.amount ?? 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const pieData = categoryTotals.map(([name, value]) => ({ name, value }));

  // Supplier totals
  const supplierTotals = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    filtered.filter(e => e.supplierName).forEach(e => {
      const k = e.supplierId || e.supplierName;
      if (!map[k]) map[k] = { name: e.supplierName, total: 0 };
      map[k].total += e.amount ?? 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const setPreset = (days: number) => {
    setDateFrom(format(subDays(new Date(), days - 1), 'yyyy-MM-dd'));
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
  };

  const tooltipStyle = { borderRadius: '8px', fontSize: '12px' };

  return (
    <div className="flex flex-col h-full overflow-y-auto gap-4 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> খরচের বিস্তারিত রিপোর্ট
          </h1>
          <p className="text-muted-foreground text-xs">দৈনিক · সাপ্তাহিক · মাসিক বিশ্লেষণ</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          {[7, 30, 90].map(d => (
            <Button key={d} size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPreset(d)}>
              {d}d
            </Button>
          ))}
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
            setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
            setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
          }}>এই মাস</Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
            const last = subMonths(new Date(), 1);
            setDateFrom(format(startOfMonth(last), 'yyyy-MM-dd'));
            setDateTo(format(endOfMonth(last), 'yyyy-MM-dd'));
          }}>গত মাস</Button>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs w-36" />
          <span className="text-xs text-muted-foreground">–</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs w-36" />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">সব ক্যাটাগরি</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl shadow-sm bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 col-span-1">
          <CardContent className="p-3 flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="text-[10px] text-red-600 font-medium">মোট খরচ</p>
              <p className="text-lg font-black text-red-700">{fp(total)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm col-span-1">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">এন্ট্রি</p>
            <p className="text-lg font-bold">{filtered.length}টি</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm col-span-1">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">গড় দৈনিক</p>
            <p className="text-lg font-bold">{fp(dailyData.length ? total / dailyData.length : 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs: Daily / Weekly / Monthly */}
      <Tabs defaultValue="daily">
        <TabsList className="w-full">
          <TabsTrigger value="daily" className="flex-1 gap-1.5 text-xs">
            <CalendarDays className="w-3.5 h-3.5" /> দৈনিক
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1 gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5" /> সাপ্তাহিক
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex-1 gap-1.5 text-xs">
            <CalendarRange className="w-3.5 h-3.5" /> মাসিক
          </TabsTrigger>
        </TabsList>

        {/* Daily Tab */}
        <TabsContent value="daily" className="space-y-4 mt-3">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">দৈনিক খরচ (বার চার্ট)</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">কোনো ডেটা নেই</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
                    <Tooltip formatter={(v: number) => [fp(v), 'খরচ']} contentStyle={tooltipStyle} />
                    <Bar dataKey="amount" name="খরচ" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">দৈনিক খরচ (লাইন চার্ট)</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">কোনো ডেটা নেই</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
                    <Tooltip formatter={(v: number) => [fp(v), 'খরচ']} contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Daily Table */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" /> দৈনিক তালিকা</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>তারিখ</TableHead>
                    <TableHead className="text-right">মোট</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyData.length === 0 ? (
                    <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground text-sm">কোনো ডেটা নেই</TableCell></TableRow>
                  ) : dailyData.map(g => (
                    <TableRow key={g.date}>
                      <TableCell className="text-sm">{g.date}</TableCell>
                      <TableCell className="text-right font-semibold text-sm text-red-600">{fp(g.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Tab */}
        <TabsContent value="weekly" className="space-y-4 mt-3">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">সাপ্তাহিক খরচ (বার চার্ট)</CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">কোনো ডেটা নেই</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
                    <Tooltip formatter={(v: number) => [fp(v), 'খরচ']} contentStyle={tooltipStyle} />
                    <Bar dataKey="amount" name="খরচ" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">সাপ্তাহিক তালিকা</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>সপ্তাহ</TableHead>
                    <TableHead className="text-right">মোট</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyData.length === 0 ? (
                    <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground text-sm">কোনো ডেটা নেই</TableCell></TableRow>
                  ) : weeklyData.map(g => (
                    <TableRow key={g.week}>
                      <TableCell className="text-sm">{g.week}</TableCell>
                      <TableCell className="text-right font-semibold text-sm text-amber-600">{fp(g.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Tab */}
        <TabsContent value="monthly" className="space-y-4 mt-3">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">মাসিক খরচ (বার চার্ট)</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">কোনো ডেটা নেই</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
                    <Tooltip formatter={(v: number) => [fp(v), 'খরচ']} contentStyle={tooltipStyle} />
                    <Bar dataKey="amount" name="খরচ" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">মাসিক তালিকা</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>মাস</TableHead>
                    <TableHead className="text-right">মোট</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.length === 0 ? (
                    <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground text-sm">কোনো ডেটা নেই</TableCell></TableRow>
                  ) : monthlyData.map(g => (
                    <TableRow key={g.month}>
                      <TableCell className="text-sm">{g.month}</TableCell>
                      <TableCell className="text-right font-semibold text-sm text-purple-600">{fp(g.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category Pie + Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Tag className="w-4 h-4" /> ক্যাটাগরি পাই চার্ট</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">কোনো ডেটা নেই</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fp(v)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Tag className="w-4 h-4" /> ক্যাটাগরি ব্রেকডাউন</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ক্যাটাগরি</TableHead>
                  <TableHead className="text-right">মোট</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryTotals.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">কোনো ডেটা নেই</TableCell></TableRow>
                ) : categoryTotals.map(([cat, amt]) => (
                  <TableRow key={cat}>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other}`}>{cat}</span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fp(amt)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Breakdown */}
      {supplierTotals.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Truck className="w-4 h-4" /> সাপ্লায়ার অনুযায়ী খরচ</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>সাপ্লায়ার</TableHead>
                  <TableHead className="text-right">মোট</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierTotals.map(s => (
                  <TableRow key={s.name}>
                    <TableCell className="text-sm flex items-center gap-1.5 font-medium">
                      <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />{s.name}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fp(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ExpensesReport;
