'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { convertBengaliToEnglishNumerals, isValidEanUpcBarcode } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CheckCircle2, X, AlertCircle } from 'lucide-react';

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
}: CameraScannerDialogProps) {
  const [scanCount, setScanCount] = useState(0);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listenerRef = useRef<{ remove: () => Promise<void> } | null>(null);
  const lastScannedRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  const isAndroidApp = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();

  const stopScanner = useCallback(async () => {
    document.querySelector('body')?.classList.remove('barcode-scanner-active');
    try {
      await listenerRef.current?.remove();
      listenerRef.current = null;
      await BarcodeScanner.removeAllListeners();
      await BarcodeScanner.stopScan();
    } catch {
      // ignore cleanup errors
    }
  }, []);

  const handleClose = useCallback(async () => {
    await stopScanner();
    setScanCount(0);
    setLastScanned(null);
    setError(null);
    onOpenChange(false);
  }, [stopScanner, onOpenChange]);

  useEffect(() => {
    if (!open || !isAndroidApp) return;

    const startScanner = async () => {
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted') {
        setError('ক্যামেরার পারমিশন ছাড়া স্ক্যান সম্ভব নয়!');
        return;
      }

      setScanCount(0);
      setLastScanned(null);
      setError(null);

      listenerRef.current = await BarcodeScanner.addListener(
        'barcodesScanned',
        (event) => {
          const barcode = event.barcodes?.[0];
          if (!barcode?.rawValue) return;

          const normalized = convertBengaliToEnglishNumerals(barcode.rawValue.trim());

          const now = Date.now();
          if (normalized === lastScannedRef.current && now - lastScannedTimeRef.current < 1500) return;
          lastScannedRef.current = normalized;
          lastScannedTimeRef.current = now;

          if (isValidEanUpcBarcode(normalized)) {
            onBarcodeScanned(normalized);
            setLastScanned(normalized);
            setScanCount((c) => c + 1);
            if (navigator?.vibrate) navigator.vibrate(50);
          } else {
            setError('অবৈধ বারকোড: ' + normalized);
          }
        }
      );

      document.querySelector('body')?.classList.add('barcode-scanner-active');

      await BarcodeScanner.startScan({
        formats: [
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
        ],
      });
    };

    startScanner().catch((err) => setError('Scanner error: ' + err?.message));

    return () => { stopScanner(); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !isAndroidApp) return null;

  return (
    <div className="barcode-scanner-overlay fixed inset-0 z-50 flex flex-col">
      {/* Scanning frame */}
      <div className="flex-1 flex items-center justify-center">
        <div className="border-2 border-white/80 rounded-lg w-72 h-40 relative">
          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
        </div>
      </div>

      {/* Bottom panel */}
      <div className="bg-black/70 p-5 flex flex-col gap-3">
        {error ? (
          <div className="flex items-center justify-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : (
          <p className="text-white/70 text-sm text-center">বারকোড ফ্রেমের মধ্যে ধরুন</p>
        )}

        {scanCount > 0 && (
          <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {scanCount}টি আইটেম যোগ হয়েছে
            {lastScanned && <span className="text-white/50 text-xs">({lastScanned})</span>}
          </div>
        )}

        <Button
          onClick={handleClose}
          variant="outline"
          className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20"
        >
          <X className="w-4 h-4 mr-2" />
          Done ({scanCount} scanned)
        </Button>
      </div>
    </div>
  );
}

export default CameraScannerDialog;
