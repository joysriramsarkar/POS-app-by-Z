import { z } from 'zod';

export const ProductInputSchema = z.object({
  id: z.string().optional(),
  barcode: z.string().nullable().optional(),
  name: z.string().min(1, 'Product name is required'),
  nameBn: z.string().nullable().optional(),
  category: z.string().min(1, 'Category is required'),
  buyingPrice: z.coerce.number().min(0, 'Valid buying price is required'),
  sellingPrice: z.coerce.number().min(0, 'Valid selling price is required'),
  unit: z.string().default('piece'),
  currentStock: z.coerce.number().default(0),
  minStockLevel: z.coerce.number().default(5),
  isActive: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof ProductInputSchema>;

export const SaleItemInputSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  totalPrice: z.coerce.number().nonnegative(),
});

export const SaleInputSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().optional(),
  items: z.array(SaleItemInputSchema).min(1, 'Items must be a non-empty array'),
  customerId: z.string().nullable().optional(),
  paymentMethod: z.string().optional().default('Cash'),
  amountPaid: z.coerce.number().nonnegative().optional().default(0),
  discount: z.coerce.number().nonnegative().optional().default(0),
  tax: z.coerce.number().nonnegative().optional().default(0),
  notes: z.string().nullable().optional(),
  subtotal: z.coerce.number().nonnegative().optional(),
  totalAmount: z.coerce.number().nonnegative().optional(),
  paymentStatus: z.string().optional(),
  status: z.string().optional(),
  usePrepaid: z.boolean().optional().default(false),
  prepaidAmountUsed: z.coerce.number().nonnegative().optional().default(0),
});

export type SaleInput = z.infer<typeof SaleInputSchema>;

export const CustomerInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  totalDue: z.coerce.number().optional(),
  totalPaid: z.coerce.number().optional(),
});

export type CustomerInput = z.infer<typeof CustomerInputSchema>;

export const StockEntryInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  purchasePrice: z.coerce.number().nonnegative('Purchase price must be non-negative'),
  date: z.string().optional(),
  supplierId: z.string().optional(),
  notes: z.string().optional(),
});

export type StockEntryInput = z.infer<typeof StockEntryInputSchema>;
