'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Plus, Receipt, TrendingDown, IndianRupee, Tag } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Other'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Rent: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Utilities: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Salaries: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Supplies: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Maintenance: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const formatPrice = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

export function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Rent');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const { toast } = useToast();

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await fetch('/api/expenses');
      if (res.ok) {
        const { data } = await res.json();
        setExpenses(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleAddExpense = async () => {
    if (!amount || !category) return;
    setIsLoading(true);
    try {
      const { convertBengaliToEnglishNumerals } = await import('@/lib/utils');
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: convertBengaliToEnglishNumerals(amount), category, notes, date }),
      });
      if (res.ok) {
        toast({ title: 'Expense Added', description: 'Expense recorded successfully.' });
        setAmount('');
        setNotes('');
        fetchExpenses();
      } else {
        toast({ title: 'Error', description: 'Failed to add expense.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add expense.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/expenses?id=${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Expense Deleted' });
        fetchExpenses();
      } else {
        toast({ title: 'Error', description: 'Failed to delete expense.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete expense.', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const filtered = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    return expenses.filter((e) => {
      const d = new Date(e.date);
      const inRange = d >= from && d <= to;
      const inCat = filterCategory === 'All' || e.category === filterCategory;
      return inRange && inCat;
    });
  }, [expenses, dateFrom, dateTo, filterCategory]);

  const totalFiltered = useMemo(() => filtered.reduce((s, e) => s + (e.amount ?? 0), 0), [filtered]);

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => { map[e.category] = (map[e.category] ?? 0) + (e.amount ?? 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  return (
    <div className="flex flex-col h-full overflow-y-auto gap-4 p-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="w-6 h-6" /> Expenses
        </h1>
        <p className="text-muted-foreground text-sm">Track and manage your business expenses</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-linear-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20 border-red-200 dark:border-red-800/50 rounded-2xl shadow-sm col-span-2 sm:col-span-2">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-200/50 dark:bg-red-800/50 flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">Total (Filtered)</p>
              <p className="text-2xl font-black text-red-700 dark:text-red-400 tracking-tight">{formatPrice(totalFiltered)}</p>
            </div>
          </CardContent>
        </Card>
        {categoryTotals.slice(0, 2).map(([cat, total]) => (
          <Card key={cat} className="rounded-2xl shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Tag className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">{cat}</p>
                <p className="text-lg font-bold tracking-tight">{formatPrice(total)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Add Expense Form */}
        <Card className="col-span-1 h-fit rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> Add Expense</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount (₹)</label>
              <Input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                onKeyDown={(e) => e.key === 'Enter' && handleAddExpense()} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional description..." />
            </div>
            <Button className="w-full" onClick={handleAddExpense} disabled={isLoading || !amount}>
              <Plus className="w-4 h-4 mr-2" /> Add Expense
            </Button>
          </CardContent>
        </Card>

        {/* Expense List */}
        <Card className="col-span-1 md:col-span-2 rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" /> Expense History
              </CardTitle>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs w-36" />
                <span className="text-xs text-muted-foreground">–</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs w-36" />
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Categories</SelectItem>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length > 0 ? filtered.map((exp: any) => (
                    <TableRow key={exp.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(exp.date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[exp.category] ?? CATEGORY_COLORS.Other}`}>
                          {exp.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{exp.notes || '—'}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">{formatPrice(exp.amount ?? 0)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(exp.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No expenses found for this period.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {filtered.length > 0 && (
              <div className="flex justify-end px-4 py-3 border-t">
                <span className="text-sm font-semibold">Total: {formatPrice(totalFiltered)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Expenses;
