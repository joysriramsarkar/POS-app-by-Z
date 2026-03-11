'use client';

import { useState, useCallback } from 'react';
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
import { Camera, AlertCircle, RefreshCw } from 'lucide-react';
import useCameraBarcodeScanner from '@/hooks/use-camera-barcode-scanner';

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
  description = 'Position barcode in the center of the frame',
}: CameraScannerDialogProps) {
  const [cameraMode, setCameraMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);

  const handleBarcodeDetected = useCallback(
    (barcode: string) => {
      onBarcodeScanned(barcode);
      onOpenChange(false);
    },
    [onBarcodeScanned, onOpenChange]
  );

  const { isSupported, isInitialized, scannerId } = useCameraBarcodeScanner({
    enabled: open,
    onBarcodeDetected: handleBarcodeDetected,
    onError: setError,
    facingMode: cameraMode,
  });

  const toggleCamera = useCallback(() => {
    setCameraMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  if (!isSupported) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Camera is not supported on this device or access was denied. Please check your device settings and camera permissions.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Scanner container - will be populated by html5-qrcode */}
        <div
          id={scannerId}
          className="w-full bg-black rounded-lg overflow-hidden"
          style={{ minHeight: '300px' }}
        />

        {isInitialized && (
          <div className="text-center text-sm text-muted-foreground">
            <p>Point camera at barcode and hold still</p>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={toggleCamera} className="flex-1">
            <RefreshCw className="w-4 h-4 mr-2" />
            {cameraMode === 'environment' ? 'Front Camera' : 'Back Camera'}
          </Button>
          <Button onClick={() => onOpenChange(false)} className="flex-1">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CameraScannerDialog;
