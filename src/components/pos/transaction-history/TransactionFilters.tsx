import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, Search } from 'lucide-react';

interface TransactionFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterPaymentMethod: string;
  setFilterPaymentMethod: (method: string) => void;
  onReset: () => void;
}

export function TransactionFilters({
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  filterPaymentMethod,
  setFilterPaymentMethod,
  onReset,
}: TransactionFiltersProps) {
  return (
    <Card className="bg-muted/30 shrink-0">
      <CardContent className="p-2 md:pt-4 md:p-6 pb-2 md:pb-4">
        <div className="grid grid-cols-2 md:flex md:flex-row flex-nowrap items-end gap-2 md:overflow-x-auto w-full">
          <div className="col-span-2 md:col-span-1 w-full md:min-w-42.5 shrink-0 space-y-1">
            <label className="text-xs md:text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
              <Input
                placeholder="Invoice, Customer, Product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 md:pl-8 h-8 md:h-9 text-xs md:text-sm"
              />
            </div>
          </div>
          <div className="col-span-1 w-full md:min-w-37.5 shrink-0 space-y-1">
            <label className="text-xs md:text-sm font-medium">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 md:h-9 text-xs md:text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
                <SelectItem value="Refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-1 w-full md:min-w-37.5 shrink-0 space-y-1">
            <label className="text-xs md:text-sm font-medium">Payment</label>
            <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
              <SelectTrigger className="h-8 md:h-9 text-xs md:text-sm">
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
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

          <div className="col-span-2 md:col-span-1 w-full md:min-w-30 shrink-0 mt-1 md:mt-0">
            <Button
              variant="outline"
              onClick={onReset}
              className="h-8 md:h-9 w-full gap-2 text-xs md:text-sm"
            >
              <Filter className="w-3 h-3 md:w-4 md:h-4" />
              Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
