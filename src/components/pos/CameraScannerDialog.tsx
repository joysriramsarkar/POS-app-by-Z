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
import { Camera, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
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
  description = 'Position barcode within the frame',
}: CameraScannerDialogProps) {
  const [cameraMode, setCameraMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const {
    isSupported,
    isInitialized,
    isShuttingDown,
    startShutdown,
    scannerId,
  } = useCameraBarcodeScanner({
    enabled: open,
    onBarcodeDetected: (barcode: string) => {
      onBarcodeScanned(barcode);
      startShutdown();
    },
    onClose: handleClose,
    onError: setError,
    facingMode: cameraMode,
  });

  const handleCloseIntent = useCallback(() => {
    if (!isShuttingDown) {
      startShutdown();
    }
  }, [isShuttingDown, startShutdown]);

  const handleDialogInteraction = useCallback((newOpen: boolean) => {
    if (newOpen) {
      onOpenChange(true);
      setError(null);
    } else {
      // User initiated close - trigger shutdown
      handleCloseIntent();
    }
  }, [onOpenChange, handleCloseIntent]);
  
  const toggleCamera = useCallback(() => {
    setCameraMode(prev => (prev === 'environment' ? 'user' : 'environment'));
    setError(null); // Clear errors when toggling
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleDialogInteraction}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error && !isShuttingDown && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {/* Blackboxed container for the scanner */}
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-gray-700">
          {/* This div is surrendered to the html5-qrcode library. React will not touch its children. */}
          <div id={scannerId} />

          {/* Loading / Shutdown Overlay */}
          {(!isInitialized || isShuttingDown) && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center text-white pointer-events-none">
              <Loader2 className="w-10 h-10 animate-spin mb-3" />
              <p className="text-sm font-medium">
                {isShuttingDown ? 'Closing Camera...' : 'Initializing Camera...'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={toggleCamera}
            className="flex-1"
            disabled={!isInitialized || isShuttingDown}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            <span>{cameraMode === 'environment' ? 'Front Cam' : 'Back Cam'}</span>
          </Button>
          <Button
            onClick={handleCloseIntent}
            className="flex-1"
            disabled={isShuttingDown}
          >
            {isShuttingDown ? 'Closing...' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CameraScannerDialog;
