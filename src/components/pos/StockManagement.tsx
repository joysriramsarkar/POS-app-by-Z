'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BulkStockUpdateDialog } from './BulkStockUpdateDialog';
import {
  Package,
  Plus,
  Search,
  Edit,
  AlertTriangle,
  Filter,
  ArrowUpDown,
  History,
  X,
  Upload,
} from 'lucide-react';
import type { Product } from '@/types/pos';
import { useProductsStore } from '@/stores/pos-store';
import { cn } from '@/lib/utils';

interface StockManagementProps {
  onAddProduct?: () => void;
  onEditProduct?: (product: Product) => void;
  onAddStock?: (product: Product) => void;
}

type SortField = 'name' | 'stock' | 'price' | 'category';
type SortOrder = 'asc' | 'desc';

export function StockManagement({ onAddProduct, onEditProduct, onAddStock }: StockManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);

  const products = useProductsStore((state) => state.products);
  const categories = useProductsStore((state) => state.categories);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => p.isActive);

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.nameBn?.includes(query) ||
        p.barcode?.includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category === categoryFilter);
    }

    // Stock filter
    if (stockFilter === 'low') {
      result = result.filter(p => p.currentStock <= p.minStockLevel && p.currentStock > 0);
    } else if (stockFilter === 'out') {
      result = result.filter(p => p.currentStock === 0);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'stock':
          comparison = a.currentStock - b.currentStock;
          break;
        case 'price':
          comparison = a.sellingPrice - b.sellingPrice;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [products, searchQuery, categoryFilter, stockFilter, sortField, sortOrder]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getStockStatus = (product: Product) => {
    if (product.currentStock === 0) {
      return { label: 'Out of Stock', variant: 'destructive' as const };
    }
    if (product.currentStock <= product.minStockLevel) {
      return { label: 'Low Stock', variant: 'secondary' as const };
    }
    return { label: 'In Stock', variant: 'default' as const };
  };

  const lowStockCount = products.filter(p => p.currentStock <= p.minStockLevel && p.currentStock > 0).length;
  const outOfStockCount = products.filter(p => p.currentStock === 0).length;

  return (
    <>
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6" />
              Stock / Items
            </h1>
            <p className="text-sm text-muted-foreground">
              {products.length} items • {lowStockCount} low stock • {outOfStockCount} out of stock
            </p>
          </div>
          <div className='flex gap-2'>
            <Button variant="outline" onClick={() => setIsBulkUpdateOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Update
            </Button>
            <Button onClick={onAddProduct}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
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

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Stock Filter */}
          <Select value={stockFilter} onValueChange={(v: 'all' | 'low' | 'out') => setStockFilter(v)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Product List */}
      <div className="flex-1 min-h-0 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[40%]">
                <Button variant="ghost" size="sm" className="h-8 -ml-3" onClick={() => handleSort('name')}>
                  Item Name
                  <ArrowUpDown className={cn("w-4 h-4 ml-2", sortField === 'name' && "text-primary")} />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="h-8 -ml-3" onClick={() => handleSort('category')}>
                  Category
                  <ArrowUpDown className={cn("w-4 h-4 ml-2", sortField === 'category' && "text-primary")} />
                </Button>
              </TableHead>
              <TableHead className="text-right">Buy Price</TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" className="h-8 -ml-3" onClick={() => handleSort('price')}>
                  Sell Price
                  <ArrowUpDown className={cn("w-4 h-4 ml-2", sortField === 'price' && "text-primary")} />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" className="h-8 -ml-3" onClick={() => handleSort('stock')}>
                  Stock
                  <ArrowUpDown className={cn("w-4 h-4 ml-2", sortField === 'stock' && "text-primary")} />
                </Button>
              </TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No items found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const status = getStockStatus(product);
                return (
                  <TableRow key={product.id} className="group">
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.nameBn && (
                          <p className="text-xs text-muted-foreground">{product.nameBn}</p>
                        )}
                        {product.barcode && (
                          <p className="text-xs text-muted-foreground font-mono">{product.barcode}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{product.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(product.buyingPrice)}</TableCell>
                    <TableCell className="text-right font-medium">{formatPrice(product.sellingPrice)}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "font-medium",
                        product.currentStock <= product.minStockLevel && "text-amber-600",
                        product.currentStock === 0 && "text-red-600"
                      )}>
                        {product.currentStock} {product.unit}
                      </span>
                      <p className="text-xs text-muted-foreground">Min: {product.minStockLevel}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={status.variant} className="text-xs">
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => onAddStock?.(product)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Stock
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => onEditProduct?.(product)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Footer */}
      <div className="shrink-0 border-t bg-muted/30 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {filteredProducts.length} of {products.length} items
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              In Stock: {products.filter(p => p.currentStock > p.minStockLevel).length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Low: {lowStockCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Out: {outOfStockCount}
            </span>
          </div>
        </div>
      </div>
    </div>
    <BulkStockUpdateDialog open={isBulkUpdateOpen} onOpenChange={setIsBulkUpdateOpen} />
    </>
  );
}

export default StockManagement;
