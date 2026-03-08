'use client';

import { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProductsStore } from '@/stores/pos-store';
import { Upload, FileDown, Table as TableIcon, AlertCircle, CheckCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BulkStockUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StockUpdateData {
  barcode: string;
  name: string;
  quantity: number;
}

export function BulkStockUpdateDialog({ open, onOpenChange }: BulkStockUpdateDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<StockUpdateData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { products, updateProductStock } = useProductsStore();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setParsedData([]);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`Error parsing file: ${results.errors[0].message}`);
          return;
        }

        const requiredHeaders = ['barcode', 'quantity'];
        const headers = results.meta.fields;
        if (!headers || !requiredHeaders.every(h => headers.includes(h))) {
            setError(`Invalid CSV format. Required headers are: ${requiredHeaders.join(', ')}`);
            return;
        }

        const data = results.data as any[];
        const stockUpdateData: StockUpdateData[] = data.map(row => {
            const product = products.find(p => p.barcode === row.barcode);
            return {
                barcode: row.barcode,
                name: product?.name || 'Unknown Product',
                quantity: parseInt(row.quantity, 10) || 0
            }
        });

        setParsedData(stockUpdateData);
      },
      error: (err) => {
        setError(`Error parsing file: ${err.message}`);
      }
    });
  };

  const handleDownloadTemplate = () => {
    const templateData = [
        { barcode: '123456789', quantity: 10 },
        { barcode: '987654321', quantity: 5 },
      ];
      const csv = Papa.unparse(templateData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', 'stock_update_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleSave = () => {
    if (parsedData.length === 0) {
      setError("No data to save.");
      return;
    }

    parsedData.forEach(item => {
        const product = products.find(p => p.barcode === item.barcode);
        if (product) {
            updateProductStock(product.id, item.quantity);
        }
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Stock Update</DialogTitle>
          <DialogDescription>
            Update stock quantities in bulk using a CSV file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload CSV
                </Button>
                <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                />

                <Button variant="secondary" onClick={handleDownloadTemplate}>
                    <FileDown className="w-4 h-4 mr-2" />
                    Download Template
                </Button>
            </div>

            {file && (
                <div className="text-sm text-muted-foreground">
                    Selected file: {file.name}
                </div>
            )}

            {error && (
                <div className="text-sm text-red-500 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {parsedData.length > 0 && (
                <div>
                    <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                        <TableIcon className="w-5 h-5" />
                        Preview Data
                    </h3>
                    <ScrollArea className="h-64 border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Barcode</TableHead>
                                    <TableHead>Product Name</TableHead>
                                    <TableHead className="text-right">Quantity to Add</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {parsedData.map((row, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{row.barcode}</TableCell>
                                        <TableCell>{row.name}</TableCell>
                                        <TableCell className="text-right">{row.quantity}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            )}
        </div>


        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={parsedData.length === 0}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
