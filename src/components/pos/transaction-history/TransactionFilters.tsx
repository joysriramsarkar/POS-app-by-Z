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
      <CardContent className="pt-4">
        <div className="flex flex-col md:flex-row flex-nowrap items-end gap-2 md:overflow-x-auto pb-2 w-full">
          <div className="w-full md:min-w-42.5 shrink-0 space-y-1">
            <label className="text-xs md:text-sm font-medium">Search Invoice</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Invoice number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 md:h-9 text-xs md:text-sm"
              />
            </div>
          </div>
          <div className="w-full md:min-w-37.5 shrink-0 space-y-1">
            <label className="text-xs md:text-sm font-medium">Transaction Status</label>
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

          <div className="w-full md:min-w-37.5 shrink-0 space-y-1">
            <label className="text-xs md:text-sm font-medium">Payment Method</label>
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

          <div className="w-full md:min-w-30 shrink-0">
            <Button
              variant="outline"
              onClick={onReset}
              className="h-8 md:h-9 w-full gap-2 text-xs md:text-sm"
            >
              <Filter className="w-4 h-4" />
              Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
