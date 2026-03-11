// ============================================================================
// useCameraBarcodeScanner - Camera Barcode Scanning Hook
// Lakhan Bhandar POS System
// 
// This hook enables camera-based barcode/QR code scanning
// ============================================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';

interface CameraBarcodeScannerConfig {
  /** Callback when barcode/QR is successfully scanned */
  onBarcodeDetected: (barcode: string) => void;
  /** Callback for error handling */
  onError?: (error: string) => void;
  /** Enable or disable scanner */
  enabled?: boolean;
  /** Facings: environment (back), user (front) */
  facingMode?: 'environment' | 'user';
}

const SCANNER_ID = 'html5-qr-code-full-region';

export function useCameraBarcodeScanner(config: CameraBarcodeScannerConfig) {
  const {
    onBarcodeDetected,
    onError,
    enabled = false,
    facingMode = 'environment',
  } = config;

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastScannedRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  const initializeScanner = useCallback(async () => {
    if (scannerRef.current || !enabled) return;

    try {
      // Check if camera permission is available
      const constraints = { video: { facingMode } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(track => track.stop());

      // Initialize scanner
      const scanner = new Html5QrcodeScanner(
        SCANNER_ID,
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          facingMode,
        },
        false
      );

      scanner.render(
        (decodedText: string) => {
          // Prevent duplicate scans within 1 second
          const now = Date.now();
          if (decodedText === lastScannedRef.current && now - lastScannedTimeRef.current < 1000) {
            return;
          }

          lastScannedRef.current = decodedText;
          lastScannedTimeRef.current = now;

          onBarcodeDetected(decodedText);
        },
        (error: any) => {
          // Ignore continuous scanning errors (they're normal)
          // Only report critical errors
        }
      );

      scannerRef.current = scanner;
      setIsInitialized(true);
    } catch (error: any) {
      const errorMessage = error?.message || 'Camera access denied or not supported';
      setIsSupported(false);
      onError?.(errorMessage);
    }
  }, [enabled, facingMode, onBarcodeDetected, onError]);

  const cleanupScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch (error) {
        console.error('Error clearing scanner:', error);
      }
      scannerRef.current = null;
      setIsInitialized(false);
    }
  }, []);

  // Initialize/cleanup scanner based on enabled state
  useEffect(() => {
    if (enabled) {
      initializeScanner();
    } else {
      cleanupScanner();
    }

    return () => {
      cleanupScanner();
    };
  }, [enabled, initializeScanner, cleanupScanner]);

  return {
    isSupported,
    isInitialized,
    scannerId: SCANNER_ID,
  };
}

export default useCameraBarcodeScanner;
