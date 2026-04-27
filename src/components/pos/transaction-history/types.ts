export interface TransactionItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Transaction {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  amountPaid: number;
  discount: number;
  tax: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt: Date;
  customer?: {
    id: string;
    name: string;
    phone?: string;
  };
  user?: {
    id: string;
    name: string;
    username: string;
  };
  items: TransactionItem[];
}

export interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
