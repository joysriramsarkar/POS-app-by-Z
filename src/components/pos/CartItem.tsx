import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, Trash2, GripVertical } from 'lucide-react';
import type { CartItem as CartItemType } from '@/types/pos';
import { useCartStore } from '@/stores/pos-store';
import { cn } from '@/lib/utils';

interface CartItemProps {
  item: CartItemType;
  isHighlighted?: boolean;
}

export function CartItem({ item, isHighlighted = false }: CartItemProps) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const itemRef = useRef<HTMLDivElement>(null);

  // Local state for the input to allow for smoother editing
  const [inputValue, setInputValue] = useState(item.quantity.toString());

  // Scroll into view and highlight when newly added
  useEffect(() => {
    if (isHighlighted && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isHighlighted]);

  // Sync local state when the item quantity changes from the store (e.g., via +/- buttons)
  useEffect(() => {
    setInputValue(item.quantity.toString());
  }, [item.quantity]);


  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const handleQuantityChange = useCallback(
    (newQuantity: number) => {
      // Ensure we don't go below 0 or above stock
      const validatedQuantity = Math.max(0, Math.min(newQuantity, item.availableStock));
      if (validatedQuantity === 0) {
        // If quantity becomes 0, remove the item
        removeItem(item.id);
      } else {
        updateQuantity(item.id, validatedQuantity);
      }
    },
    [item.id, item.availableStock, updateQuantity, removeItem]
  );

  const handleIncrement = useCallback(() => {
    const newQty = item.quantity + 1;
    if (newQty <= item.availableStock) {
      updateQuantity(item.id, newQty);
    }
  }, [item.quantity, item.availableStock, updateQuantity]);

  const handleDecrement = useCallback(() => {
    const newQty = item.quantity - 1;
    if (newQty > 0) {
      updateQuantity(item.id, newQty);
    }
  }, [item.quantity, updateQuantity]);

  const handleRemove = useCallback(() => {
    removeItem(item.id);
  }, [item.id, removeItem]);

  // Update local state as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  // Update global store on blur or Enter
  const handleInputBlur = () => {
    const value = parseFloat(inputValue);
    if (!isNaN(value) && value > 0) {
      handleQuantityChange(value);
    } else {
      // If input is empty or invalid, revert to original quantity
      setInputValue(item.quantity.toString());
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleIncrement();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handleDecrement();
      }
    },
    [handleIncrement, handleDecrement]
  );
  
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
      (e.target as HTMLInputElement).blur(); // Lose focus
    }
  };

  const isOverStock = item.quantity > item.availableStock;
  const isAtStockLimit = item.quantity >= item.availableStock;

  return (
    <div
      ref={itemRef}
      className={cn(
        'group flex items-center gap-2 p-3 rounded-lg border bg-card transition-all',
        'hover:shadow-sm',
        isHighlighted && 'ring-2 ring-primary ring-offset-2',
        isOverStock && 'border-destructive bg-destructive/5'
      )}
      role="listitem"
      aria-label={`${item.productName}, quantity ${item.quantity}, ${formatPrice(item.totalPrice)}`}
    >
      {/* Drag Handle (for future reordering) */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab touch-none">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-medium text-sm truncate">{item.productName}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-muted-foreground">
                {formatPrice(item.unitPrice)}/{item.unit}
              </span>
              {item.barcode && (
                <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                  {item.barcode}
                </Badge>
              )}
            </div>
          </div>
          {/* Total Price */}
          <div className="text-right shrink-0">
            <p className="font-semibold">{formatPrice(item.totalPrice)}</p>
          </div>
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center justify-between mt-2">
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label="Quantity controls"
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            {/* Decrement Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 touch-manipulation"
              onClick={handleDecrement}
              disabled={item.quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </Button>

            {/* Quantity Input */}
            <Input
              type="text" // Use text to allow empty state
              inputMode="decimal" // Hint for mobile keyboards
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="w-16 h-8 text-center px-1 touch-manipulation"
              aria-label="Quantity"
            />

            {/* Increment Button */}
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 w-8 p-0 touch-manipulation',
                isAtStockLimit && 'opacity-50 cursor-not-allowed'
              )}
              onClick={handleIncrement}
              disabled={isAtStockLimit}
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Stock Warning */}
          {isOverStock && (
            <Badge variant="destructive" className="text-xs">
              Only {item.availableStock} in stock
            </Badge>
          )}

          {/* Remove Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive touch-manipulation opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemove}
            aria-label="Remove item"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CartItem;
