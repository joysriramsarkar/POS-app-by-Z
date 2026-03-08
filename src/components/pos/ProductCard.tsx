'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Package, AlertTriangle, Plus } from 'lucide-react';
import type { Product } from '@/types/pos';
import { useCartStore } from '@/stores/pos-store';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const isLowStock = product.currentStock <= product.minStockLevel;
  const isOutOfStock = product.currentStock <= 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const handleAddToCart = () => {
    if (!isOutOfStock) {
      addItem(product, 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAddToCart();
    }
  };

  return (
    <TooltipProvider>
      <Card
        className={cn(
          'group relative overflow-hidden transition-all duration-200 cursor-pointer',
          'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isOutOfStock && 'opacity-60 grayscale'
        )}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={handleAddToCart}
        role="button"
        aria-label={`Add ${product.name} to cart, ${formatPrice(product.sellingPrice)} per ${product.unit}`}
        aria-disabled={isOutOfStock}
      >
        {/* Low Stock Warning Banner */}
        {isLowStock && !isOutOfStock && (
          <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-xs font-medium py-0.5 px-2 text-center z-10">
            <AlertTriangle className="inline-block w-3 h-3 mr-1" />
            Low Stock
          </div>
        )}

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
            <Badge variant="destructive" className="text-sm">
              Out of Stock
            </Badge>
          </div>
        )}

        <CardContent className={cn('p-3', isLowStock && !isOutOfStock && 'pt-6')}>
          <div className="flex flex-col gap-2">
            {/* Product Image or Placeholder */}
            <div className="aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="w-10 h-10 text-muted-foreground" />
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="font-medium text-sm line-clamp-2 leading-tight">
                    {product.name}
                  </h3>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p>{product.name}</p>
                  {product.nameBn && <p className="text-muted-foreground">{product.nameBn}</p>}
                </TooltipContent>
              </Tooltip>

              {/* Category Badge */}
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                {product.category}
              </Badge>

              {/* Price */}
              <p className="text-lg font-bold text-primary">
                {formatPrice(product.sellingPrice)}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  /{product.unit}
                </span>
              </p>

              {/* Stock Info */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Stock: {product.currentStock} {product.unit}
                </span>
              </div>
            </div>

            {/* Quick Add Button */}
            <Button
              size="sm"
              className="w-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity touch-manipulation"
              disabled={isOutOfStock}
              onClick={(e) => {
                e.stopPropagation();
                handleAddToCart();
              }}
              aria-label="Add to cart"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export default ProductCard;
