'use client';

import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, AlertCircle } from 'lucide-react';
import { useCartStore } from '@/stores/pos-store';

interface CameraScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBarcodeScanned: (barcode: string) => void;
  title?: string;
  description?: string;
}

export function CameraScannerDialog({
  open,
  onOpenChange,
  onBarcodeScanned,
  title = 'Scan Barcode',
  description = 'Position barcode within the frame',
}: CameraScannerDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const cartItems = useCartStore((state) => state.items);

  const isAndroidApp = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();


  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const startScan = useCallback(async () => {
    if (!isAndroidApp) {
      setError('Barcode scanning is available only in the Android app.');
      return;
    }

    setIsScanning(true);
    const { camera } = await BarcodeScanner.requestPermissions();
    if (camera !== 'granted') {
      setError('ক্যামেরার পারমিশন ছাড়া স্ক্যান সম্ভব নয়!');
      setIsScanning(false);
      return;
    }
    document.querySelector('body')?.classList.add('barcode-scanner-active');
    try {
      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0 && barcodes[0].rawValue) {
        const scannedCode = barcodes[0].rawValue;
        console.log("স্ক্যান করা কোড: ", scannedCode);
        onBarcodeScanned(scannedCode);
      }
    } catch (err) {
      setError('Scan failed: ' + (err as Error).message);
    } finally {
      document.querySelector('body')?.classList.remove('barcode-scanner-active');
      setIsScanning(false);
    }
  }, [onBarcodeScanned]);

  const handleCloseIntent = useCallback(() => {
    onOpenChange(false);
    setError(null);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleCloseIntent}>
      <DialogContent className="sm:max-w-[425px] w-[95vw] p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
          </Alert>
        )}
        {/* If not running inside Android app, inform the user and hide scanner UI */}
        {!isAndroidApp ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">Barcode scanning is available only in the Android app.</p>
          </div>
        ) : (
          <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden border-2 border-gray-700">
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-white/80">Tap Scan to open the camera scanner.</p>
            </div>

            {/* Live Cart Preview */}
            {cartItems.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-3 text-white">
                <p className="text-xs font-semibold mb-2 opacity-80">Cart Preview (Last {Math.min(3, cartItems.length)} items)</p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {cartItems.slice(-3).reverse().map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="truncate flex-1 pr-2">{item.productName}</span>
                      <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {isAndroidApp && (
            <Button
              onClick={startScan}
              className="w-full"
              disabled={isScanning}
            >
              {isScanning ? 'Scanning...' : 'Scan'}
            </Button>
          )}
          <Button
            onClick={handleCloseIntent}
            className="w-full"
            disabled={isScanning}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CameraScannerDialog;
