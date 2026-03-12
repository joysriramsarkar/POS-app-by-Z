// ============================================================================
// useCameraBarcodeScanner - Camera Barcode Scanning Hook
// Lakhan Bhandar POS System
//
// This hook enables camera-based barcode/QR code scanning with a robust,
// race-condition-free cleanup mechanism.
// ============================================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { convertBengaliToEnglishNumerals } from '@/lib/utils';

interface CameraBarcodeScannerConfig {
  /** Callback when barcode/QR is successfully scanned */
  onBarcodeDetected: (barcode: string) => void;
  /** Callback to trigger component close/unmount *after* cleanup */
  onClose: () => void;
  /** Callback for error handling */
  onError?: (error: string) => void;
  /** Enable or disable scanner */
  enabled?: boolean;
  /** Facings: environment (back), user (front) */
  facingMode?: 'environment' | 'user';
}

const SCANNER_ID = 'html5-qr-code-full-region';

// Helper function to get user-friendly error messages
function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error.name === 'NotAllowedError' || error.code === 'PERMISSION_DENIED') {
    return 'Camera permission denied. Please allow camera access in your browser settings.';
  }
  if (error.name === 'NotFoundError' || error.code === 'DEVICE_NOT_FOUND') {
    return 'No camera device found. Please check if a camera is connected and enabled.';
  }
  if (error.name === 'NotReadableError' || error.code === 'DEVICE_IN_USE') {
    return 'Camera is already in use by another application. Please close other camera apps.';
  }
  return error?.message || 'An unknown camera error occurred. Please try again.';
}

export function useCameraBarcodeScanner(config: CameraBarcodeScannerConfig) {
  const {
    onBarcodeDetected,
    onClose,
    onError,
    enabled = false,
    facingMode = 'environment',
  } = config;

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(false);
  
  const [isSupported, setIsSupported] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  
  const lastScannedRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  // --- Strict, Blocking Shutdown ---
  const startShutdown = useCallback(async () => {
    // If already shutting down, or no scanner exists, just ensure close is called.
    if (isShuttingDown || !scannerRef.current) {
      if (!isShuttingDown) { // Prevent calling onClose multiple times
        onClose();
      }
      return;
    }

    setIsShuttingDown(true);
    console.log('[Scanner] Starting blocking shutdown...');

    try {
      // Await the scanner cleanup promise to complete fully.
      await scannerRef.current.clear();
      console.log('[Scanner] Scanner cleared successfully.');
    } catch (error) {
      console.error('[Scanner] Error during scanner.clear(), but proceeding with close:', error);
      // Even if cleanup fails, we must proceed to unmount to avoid getting stuck.
    } finally {
      if (isMountedRef.current) {
        scannerRef.current = null;
        setIsInitialized(false);
      }
      console.log('[Scanner] Shutdown complete. Calling onClose().');
      onClose(); // Triggers the parent component to unmount.
    }
  }, [isShuttingDown, onClose]);


  // --- Scanner Initialization ---
  const initializeScanner = useCallback(async () => {
    // Strict Mode Protection: Prevent double initialization.
    if (isInitializingRef.current || scannerRef.current) {
      console.log('[Scanner] Initialization skipped: already initializing or initialized.');
      return;
    }
    isInitializingRef.current = true;
    setIsInitialized(false);
    console.log('[Scanner] Starting initialization...');

    try {
      // Pre-flight check: Container must exist in the DOM.
      const container = document.getElementById(SCANNER_ID);
      if (!container) {
        throw new Error(`Scanner container #${SCANNER_ID} not found in DOM.`);
      }
      container.innerHTML = ''; // Clear previous content

      // Initialize the scanner library.
      const scanner = new Html5QrcodeScanner(
        SCANNER_ID,
        {
          fps: 10,
          qrbox: (w, h) => { const size = Math.min(w, h) * 0.75; return { width: size, height: size }; },
          rememberLastUsedCamera: true,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          videoConstraints: {
            facingMode: { ideal: facingMode },
          }
        },
        false // verbose
      );

      // Render the scanner. This is an async operation.
      await scanner.render(
        (decodedText: string) => {
          const normalizedText = convertBengaliToEnglishNumerals(decodedText);
          const now = Date.now();
          if (normalizedText === lastScannedRef.current && now - lastScannedTimeRef.current < 1500) {
            return; // Debounce duplicate scans
          }
          lastScannedRef.current = normalizedText;
          lastScannedTimeRef.current = now;
          onBarcodeDetected(normalizedText);
        },
        (error: any) => {
          // These errors happen continuously during scanning, ignore them.
          if (!error?.message?.includes('No QR code found')) {
            console.warn('[Scanner] Non-critical scan error:', error?.message);
          }
        }
      );

      // Check if component is still mounted before setting state.
      if (isMountedRef.current) {
        scannerRef.current = scanner;
        setIsInitialized(true);
        console.log('[Scanner] ✅ Scanner initialized successfully.');
      } else {
        console.log('[Scanner] Component unmounted during initialization, cleaning up.');
        await scanner.clear();
      }

    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      console.error('[Scanner] ❌ Initialization failed:', errorMessage, error);
      if (isMountedRef.current) {
        onError?.(errorMessage);
        setIsSupported(false); // Assume non-recoverable error
      }
    } finally {
      isInitializingRef.current = false;
    }
  }, [facingMode, onBarcodeDetected, onError]);


  // --- Lifecycle Effects ---

  // Handle mount and unmount status.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize scanner when the 'enabled' prop becomes true.
  useEffect(() => {
    if (enabled && isSupported) {
      // Use a short delay to ensure the DOM element is available after the dialog opens.
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          initializeScanner();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [enabled, isSupported, initializeScanner]);
  
  // Final safety-net cleanup on unmount.
  // This should ideally not be needed if startShutdown is always called.
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        console.warn('[Scanner] Unsafe unmount cleanup triggered. The scanner was not shut down correctly.');
        scannerRef.current.clear().catch(err => {
          console.error('[Scanner] Unsafe cleanup failed:', err);
        });
        scannerRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isInitialized,
    isShuttingDown,
    startShutdown,
    scannerId: SCANNER_ID,
  };
}

export default useCameraBarcodeScanner;
