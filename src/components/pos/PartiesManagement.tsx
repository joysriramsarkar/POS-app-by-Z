'use client';

import { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCustomersStore } from '@/stores/pos-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  MapPin,
  IndianRupee,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  X,
  Edit,
} from 'lucide-react';
import type { Customer, Supplier, LedgerEntry } from '@/types/pos';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';



type PartyType = 'customer' | 'supplier';

export function PartiesManagement() {
  const [activeTab, setActiveTab] = useState<PartyType>('customer');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingParty, setEditingParty] = useState<Customer | null>(null);
  const [newParty, setNewParty] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });

  const customers = useCustomersStore((state) => state.customers);
  const addCustomer = useCustomersStore((state) => state.addCustomer);
  const updateCustomer = useCustomersStore((state) => state.updateCustomer);
  const setCustomers = useCustomersStore((state) => state.setCustomers);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const { toast } = useToast();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Fetch customers and suppliers on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [customersRes, suppliersRes] = await Promise.all([
          fetch('/api/customers'),
          fetch('/api/suppliers'),
        ]);

        if (customersRes.ok) {
          const { data } = await customersRes.json();
          setCustomers(data);
        } else {
          console.error('Failed to fetch customers');
        }

        if (suppliersRes.ok) {
          const { data } = await suppliersRes.json();
          setSuppliers(data);
        } else {
          console.error('Failed to fetch suppliers');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [setCustomers]);



  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers.filter(c => c.isActive);
    const query = searchQuery.toLowerCase();
    return customers.filter(c =>
      c.isActive && (
        c.name.toLowerCase().includes(query) ||
        c.phone?.includes(query)
      )
    );
  }, [customers, searchQuery]);

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) return suppliers.filter(s => s.isActive);
    const query = searchQuery.toLowerCase();
    return suppliers.filter(s =>
      s.isActive && (
        s.name.toLowerCase().includes(query) ||
        s.phone?.includes(query)
      )
    );
  }, [suppliers, searchQuery]);

  const totalDue = customers.reduce((sum, c) => sum + c.totalDue, 0);
  const customersWithDue = customers.filter(c => c.totalDue > 0).length;

  const handleViewLedger = async (customer: Customer) => {
    setSelectedCustomer(customer);
    try {
      const res = await fetch(`/api/customers?id=${customer.id}`);
      if (res.ok) {
        const { data } = await res.json();
        // server returns the customer including ledgerEntries when id supplied
        setLedgerEntries(data.ledgerEntries || []);
      } else {
        console.error('Failed to load ledger entries');
        setLedgerEntries([]);
      }
    } catch (err) {
      console.error('Error fetching ledger entries', err);
      setLedgerEntries([]);
    }
    setShowLedger(true);
  };

  const handleRecordPayment = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentAmount('');
    setShowPaymentDialog(true);
  };

  const handleEditParty = (party: Customer) => {
    setEditingParty(party);
    setNewParty({
      name: party.name,
      phone: party.phone || '',
      address: party.address || '',
      notes: party.notes || '',
    });
    setShowEditDialog(true);
  };

  const handleUpdateParty = async () => {
    if (!editingParty || !newParty.name) return;

    // ensure phone is 10 digits when provided
    if (newParty.phone && !/^[0-9]{10}$/.test(newParty.phone)) {
      toast({ title: 'Invalid phone', description: 'Phone number must be exactly 10 digits.', variant: 'destructive' });
      return;
    }

    try {
      const response = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingParty.id,
          ...newParty,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update customer');
      }

      const { data: updatedCustomer } = await response.json();
      updateCustomer(editingParty.id, updatedCustomer);
      setShowEditDialog(false);
      setEditingParty(null);
      setNewParty({ name: '', phone: '', address: '', notes: '' });
    } catch (error) {
      console.error('Failed to update customer:', error);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedCustomer || !paymentAmount) return;

    const paidAmount = parseFloat(paymentAmount);
    const updatedCustomerData = {
      id: selectedCustomer.id,
      totalDue: Math.max(0, selectedCustomer.totalDue - paidAmount),
      totalPaid: selectedCustomer.totalPaid + paidAmount,
    };

    try {
      const response = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCustomerData),
      });

      if (!response.ok) {
        throw new Error('Failed to update payment.');
      }

      const { data: updatedFromServer } = await response.json();
      updateCustomer(selectedCustomer.id, updatedFromServer);
      setShowPaymentDialog(false);

    } catch (error) {
      console.error("Failed to record payment:", error);
    }
  };

  const handleAddParty = async () => {
    if (!newParty.name) return;

    // ensure phone is 10 digits when provided
    if (newParty.phone && !/^[0-9]{10}$/.test(newParty.phone)) {
      toast({ title: 'Invalid phone', description: 'Phone number must be exactly 10 digits.', variant: 'destructive' });
      return;
    }

    if (activeTab === 'customer') {
      try {
        const response = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newParty),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create customer');
        }

        const { data: newCustomer } = await response.json();
        addCustomer(newCustomer);

      } catch (error) {
        console.error("Failed to add customer:", error);
        // Optionally: show a toast to the user
        return; // prevent clearing form on error
      }

    } else {
      // Add new supplier
      try {
        const response = await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newParty),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create supplier');
        }

        const { data: newSupplier } = await response.json();
        setSuppliers(prev => [...prev, newSupplier]);

      } catch (error) {
        console.error("Failed to add supplier:", error);
        return; // prevent clearing form on error
      }
    }

    setNewParty({ name: '', phone: '', address: '', notes: '' });
    setShowAddDialog(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6" />
              Parties
            </h1>
            <p className="text-sm text-muted-foreground">
              Customers & Suppliers
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Party
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total Due</p>
              <p className="text-lg font-bold text-red-600">{formatPrice(totalDue)}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Customers with Due</p>
              <p className="text-lg font-bold">{customersWithDue}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total Customers</p>
              <p className="text-lg font-bold">{customers.filter(c => c.isActive).length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <label htmlFor="parties-search" className="sr-only">Search by name or phone</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="parties-search"
            name="parties-search"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PartyType)}>
          <TabsList className="w-full rounded-none bg-transparent h-12">
            <TabsTrigger value="customer" className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Customers ({filteredCustomers.length})
            </TabsTrigger>
            <TabsTrigger value="supplier" className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Suppliers ({filteredSuppliers.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'customer' ? (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No customers found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="group">
                    <TableCell>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        {customer.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {customer.address}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.phone && (
                        <p className="text-sm flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer.phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(customer.totalPaid)}</TableCell>
                    <TableCell className="text-right">
                      {customer.totalDue > 0 ? (
                        <Badge variant="destructive">{formatPrice(customer.totalDue)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => handleEditParty(customer)}
                        >
                          <Edit className="w-4 h-4 md:mr-1" />
                          <span className="hidden md:inline">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => handleViewLedger(customer)}
                        >
                          <FileText className="w-4 h-4 md:mr-1" />
                          <span className="hidden md:inline">Ledger</span>
                        </Button>
                        {customer.totalDue > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-green-600 hover:text-green-700"
                            onClick={() => handleRecordPayment(customer)}
                          >
                            <IndianRupee className="w-4 h-4 md:mr-1" />
                            <span className="hidden md:inline">Payment</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No suppliers found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>
                      {supplier.phone && (
                        <p className="text-sm flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {supplier.phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {supplier.address && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {supplier.address}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Ledger Dialog */}
      <Dialog open={showLedger} onOpenChange={setShowLedger}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Ledger - {selectedCustomer?.name}
            </DialogTitle>
            <DialogDescription>
              Transaction history and due balance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Balance */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Current Due</span>
                  <span className="text-2xl font-bold text-red-600">
                    {formatPrice(selectedCustomer?.totalDue || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Ledger Entries */}
            <ScrollArea className="h-75">
              <div className="space-y-2 pr-2">
                {ledgerEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      entry.entryType === 'credit' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        entry.entryType === 'credit' ? 'bg-red-100' : 'bg-green-100'
                      )}>
                        {entry.entryType === 'credit' ? (
                          <ArrowUpRight className="w-4 h-4 text-red-600" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(entry.createdAt)} • {entry.referenceId}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-semibold",
                        entry.entryType === 'credit' ? 'text-red-600' : 'text-green-600'
                      )}>
                        {entry.entryType === 'credit' ? '+' : '-'}{formatPrice(entry.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bal: {formatPrice(entry.balanceAfter)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record payment from {selectedCustomer?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Current Due</span>
                <span className="font-bold text-red-600">
                  {formatPrice(selectedCustomer?.totalDue || 0)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-dialog-amount">Payment Amount</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="payment-dialog-amount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0"
                  className="pl-9"
                  max={selectedCustomer?.totalDue}
                />
              </div>
            </div>

            {/* Quick Amounts */}
            <div className="flex flex-wrap gap-2">
              {[100, 200, 500, 1000].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentAmount(amount.toString())}
                >
                  ₹{amount}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaymentAmount((selectedCustomer?.totalDue || 0).toString())}
              >
                Full Amount
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePaymentSubmit}
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
            >
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Party Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Edit {activeTab === 'customer' ? 'Customer' : 'Supplier'}
            </DialogTitle>
            <DialogDescription>
              Update {activeTab === 'customer' ? 'customer' : 'supplier'} details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-party-name">Name *</Label>
              <Input
                id="edit-party-name"
                value={newParty.name}
                onChange={(e) => setNewParty(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-party-phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="edit-party-phone"
                  value={newParty.phone}
                  onChange={(e) => setNewParty(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter phone number"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-party-address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="edit-party-address"
                  value={newParty.address}
                  onChange={(e) => setNewParty(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter address"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-party-notes">Notes</Label>
              <Textarea
                id="edit-party-notes"
                value={newParty.notes}
                onChange={(e) => setNewParty(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Enter notes"
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingParty(null); setNewParty({ name: '', phone: '', address: '', notes: '' }); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateParty} disabled={!newParty.name}>
              Update {activeTab === 'customer' ? 'Customer' : 'Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Party Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Add New {activeTab === 'customer' ? 'Customer' : 'Supplier'}
            </DialogTitle>
            <DialogDescription>
              Enter {activeTab === 'customer' ? 'customer' : 'supplier'} details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="party-form-name">Name *</Label>
              <Input
                id="party-form-name"
                value={newParty.name}
                onChange={(e) => setNewParty(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="party-form-phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="party-form-phone"
                  value={newParty.phone}
                  onChange={(e) => setNewParty(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter phone number"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="party-form-address">Address</Label>
              <Input
                id="party-form-address"
                value={newParty.address}
                onChange={(e) => setNewParty(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="party-form-notes">Notes</Label>
              <Textarea
                id="party-form-notes"
                value={newParty.notes}
                onChange={(e) => setNewParty(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddParty} disabled={!newParty.name}>
              Add {activeTab === 'customer' ? 'Customer' : 'Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PartiesManagement;
