'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X, Grid3X3, LayoutGrid, Package, Camera } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { CameraScannerDialog } from './CameraScannerDialog';
import type { Product } from '@/types/pos';
import { useProductsStore, useUIStore, useCartStore } from '@/stores/pos-store';
import { cn, convertBengaliToEnglishNumerals } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';

type ViewMode = 'grid' | 'compact';

interface ProductGridProps {
  products?: Product[];
  onProductSelect?: (product: Product) => void;
  showSearch?: boolean;
  showCategories?: boolean;
  showViewToggle?: boolean;
}

export function ProductGrid({
  products: externalProducts,
  onProductSelect,
  showSearch = true,
  showCategories = true,
  showViewToggle = true,
}: ProductGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const storeProducts = useProductsStore((state) => state.products);
  const storeCategories = useProductsStore((state) => state.categories);
  const hasMore = useProductsStore((state) => state.hasMore);
  const nextCursor = useProductsStore((state) => state.nextCursor);
  const appendProducts = useProductsStore((state) => state.appendProducts);
  const storeSearchQuery = useUIStore((state) => state.searchQuery);
  const selectedCategoryId = useUIStore((state) => state.selectedCategoryId);
  const setSearchQuery = useUIStore((state) => state.setSearchQuery);
  const setSelectedCategoryId = useUIStore((state) => state.setSelectedCategoryId);

  const isMobile = useIsMobile();
  const { toast } = useToast();
  const cartItems = useCartStore((state) => state.items);
  const getTotal = useCartStore((state) => state.getTotal);
  const getItemCount = useCartStore((state) => state.getItemCount);
  const addItem = useCartStore((state) => state.addItem);

  const total = getTotal();
  const itemCount = getItemCount();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  // Use external products if provided, otherwise use store products
  const products = externalProducts || storeProducts;
  const searchQuery = externalProducts ? localSearchQuery : storeSearchQuery;

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Skip inactive products
      if (!product.isActive) return false;

      // Category filter
      if (selectedCategoryId && product.category !== selectedCategoryId) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        const normalizedQuery = convertBengaliToEnglishNumerals(searchQuery);
        const matchesName = product.name.toLowerCase().includes(lowerQuery);
        const matchesBengaliName = product.nameBn?.includes(searchQuery);
        const matchesBarcode = product.barcode?.includes(searchQuery);
        const matchesBarcodeNormalized = convertBengaliToEnglishNumerals(product.barcode || '').includes(normalizedQuery);
        return matchesName || matchesBengaliName || matchesBarcode || matchesBarcodeNormalized;
      }

      return true;
    });
  }, [products, searchQuery, selectedCategoryId]);

  // Group products by category for display
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    filteredProducts.forEach((product) => {
      if (!grouped[product.category]) {
        grouped[product.category] = [];
      }
      grouped[product.category].push(product);
    });
    return grouped;
  }, [filteredProducts]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      if (externalProducts) {
        setLocalSearchQuery(query);
      } else {
        setSearchQuery(query);
      }
    },
    [externalProducts, setSearchQuery]
  );

  const clearSearch = useCallback(() => {
    if (externalProducts) {
      setLocalSearchQuery('');
    } else {
      setSearchQuery('');
    }
  }, [externalProducts, setSearchQuery]);

  const handleCameraBarcode = useCallback(
    (barcode: string) => {
      const normalizedBarcode = convertBengaliToEnglishNumerals(barcode);
      const matchedProduct = products.find(
        (p) => convertBengaliToEnglishNumerals(p.barcode || '') === normalizedBarcode
      );

      if (matchedProduct) {
        if (externalProducts) {
          onProductSelect?.(matchedProduct);
        } else {
          addItem(matchedProduct, 1);
        }

        // Give the user quick feedback without closing the scanner.
        toast({
          title: 'Scanned',
          description: matchedProduct.name,
        });
        if (navigator?.vibrate) navigator.vibrate(50);
      } else {
        // Product not found - show in search to let user know
        if (externalProducts) {
          setLocalSearchQuery(barcode);
        } else {
          setSearchQuery(barcode);
        }
        toast({
          title: 'Unknown barcode',
          description: 'No product found for this barcode.',
        });
      }
    },
    [products, externalProducts, onProductSelect, addItem, setSearchQuery, toast]
  );

  const handleCategorySelect = useCallback(
    (category: string | null) => {
      setSelectedCategoryId(category === selectedCategoryId ? null : category);
    },
    [selectedCategoryId, setSelectedCategoryId]
  );

  const clearFilters = useCallback(() => {
    clearSearch();
    setSelectedCategoryId(null);
  }, [clearSearch, setSelectedCategoryId]);

  const loadMoreProducts = useCallback(async () => {
    if (isLoadingMore || !hasMore || !nextCursor || externalProducts) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/products?limit=50&cursor=${nextCursor}`);
      if (res.ok) {
        const { data, nextCursor: newNextCursor } = await res.json();
        const hasMoreData = !!newNextCursor;
        appendProducts(data, hasMoreData, newNextCursor);
      }
    } catch (error) {
      console.error('Error loading more products', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, nextCursor, externalProducts, appendProducts]);

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filter Controls */}
      {showSearch && (
        <div className="flex flex-col gap-3 p-4 border-b bg-background sticky top-0 z-10">
          {/* Search Input with Camera Button */}
          <label htmlFor="product-search" className="sr-only">Search products</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="product-search"
                name="product-search"
                ref={searchInputRef}
                type="text"
                placeholder="Search products by name, barcode..."
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const scannedValue = e.currentTarget.value.trim();
                    const normalizedScanValue = convertBengaliToEnglishNumerals(scannedValue);
                    const matchedProduct = products.find(p => convertBengaliToEnglishNumerals(p.barcode || '') === normalizedScanValue);
                    
                    if (matchedProduct) {
                      if (externalProducts) {
                        onProductSelect?.(matchedProduct);
                      } else {
                        addItem(matchedProduct, 1);
                      }
                      e.currentTarget.value = '';
                      if (externalProducts) {
                        setLocalSearchQuery('');
                      } else {
                        setSearchQuery('');
                      }
                      e.currentTarget.focus();
                  }
                }
              }}
              className="pl-9 pr-9 h-10 touch-manipulation"
              aria-label="Search products"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 md:right-1 top-1/2 -translate-y-1/2 h-8 w-8 md:h-7 md:w-7 p-0"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            </div>
            {/* Camera Scanner Button - Mobile only */}
            {isMobile && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCameraScannerOpen(true)}
                className="w-full md:w-auto md:hidden"
                title="Scan barcode with camera"
              >
                <Camera className="w-4 h-4 mr-2" />
                Scan
              </Button>
            )}
          </div>

          {/* Category Chips */}
          {showCategories && storeCategories.length > 0 && (
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 pb-1">
                <Badge
                  variant={selectedCategoryId === null ? 'default' : 'outline'}
                  className="cursor-pointer touch-manipulation"
                  onClick={() => handleCategorySelect(null)}
                >
                  All
                </Badge>
                {storeCategories.map((category) => (
                  <Badge
                    key={category}
                    variant={selectedCategoryId === category ? 'default' : 'outline'}
                    className="cursor-pointer touch-manipulation"
                    onClick={() => handleCategorySelect(category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Active Filters & View Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(searchQuery || selectedCategoryId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7 text-xs text-muted-foreground"
                >
                  Clear filters
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
              </span>
            </div>

            {showViewToggle && (
              <div className="flex items-center gap-1 border rounded-md p-0.5">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setViewMode('compact')}
                  aria-label="Compact view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Grid - Fixed height for proper scrolling */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No products found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your search or filters
              </p>
              {(searchQuery || selectedCategoryId) && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                  Clear all filters
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            // Standard Grid View
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            // Compact View - Grouped by Category
            <div className="space-y-6">
              {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
                <div key={category}>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3 sticky top-0 bg-background py-1">
                    {category} ({categoryProducts.length})
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {categoryProducts.map((product) => (
                      <CompactProductCard
                        key={product.id}
                        product={product}
                        onSelect={onProductSelect}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!externalProducts && hasMore && (
            <div className="flex justify-center mt-6 mb-4">
              <Button
                variant="outline"
                onClick={loadMoreProducts}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading...' : 'Load More Products'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Camera Scanner Dialog */}
      <CameraScannerDialog
        open={isCameraScannerOpen}
        onOpenChange={setIsCameraScannerOpen}
        onBarcodeScanned={handleCameraBarcode}
        title="Scan Barcode"
        description="Position barcode/QR code in the center of the frame"
      />
    </div>
  );
}

// Compact Product Card for dense view
interface CompactProductCardProps {
  product: Product;
  onSelect?: (product: Product) => void;
}

function CompactProductCard({ product, onSelect }: CompactProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const isOutOfStock = product.currentStock <= 0;

  const handleClick = () => {
    if (!isOutOfStock) {
      if (onSelect) {
        onSelect(product);
      } else {
        addItem(product, 1);
      }
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isOutOfStock}
      className={cn(
        'flex flex-col items-center justify-center p-2 rounded-lg border bg-card text-center',
        'hover:bg-accent hover:border-accent-foreground/20 transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'touch-manipulation min-h-[80px]',
        isOutOfStock && 'opacity-50 cursor-not-allowed'
      )}
      aria-label={`${product.name}, ${formatPrice(product.sellingPrice)}`}
    >
      <span className="text-xs font-medium line-clamp-2 mb-1">{product.name}</span>
      <span className="text-sm font-bold text-primary">{formatPrice(product.sellingPrice)}</span>
    </button>
  );
}

export default ProductGrid;
