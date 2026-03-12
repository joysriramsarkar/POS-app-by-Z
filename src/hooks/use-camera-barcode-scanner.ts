// ============================================================================
// useCameraBarcodeScanner - Camera Barcode Scanning Hook
// Lakhan Bhandar POS System
// 
// This hook enables camera-based barcode/QR code scanning
// ============================================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { convertBengaliToEnglishNumerals } from '@/lib/utils';

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

// Helper function to get user-friendly error messages
function getErrorMessage(error: any): string {
  if (error.name === 'NotAllowedError' || error.code === 'PERMISSION_DENIED') {
    return 'Camera permission denied. Please allow camera access in your browser settings and try again.';
  }
  if (error.name === 'NotFoundError' || error.code === 'DEVICE_NOT_FOUND') {
    return 'No camera device found. Please check your device has a camera connected.';
  }
  if (error.name === 'NotReadableError' || error.code === 'DEVICE_IN_USE') {
    return 'Camera is in use by another application. Please close other camera apps and try again.';
  }
  if (error.name === 'SecurityError') {
    return 'Camera access requires HTTPS connection (or localhost for development).';
  }
  if (error.message?.includes('getUserMedia')) {
    return 'Camera access is not available. Please check your browser permissions.';
  }
  return error?.message || 'Camera access failed. Please try again.';
}

export function useCameraBarcodeScanner(config: CameraBarcodeScannerConfig) {
  const {
    onBarcodeDetected,
    onError,
    enabled = false,
    facingMode = 'environment',
  } = config;

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack[]>([]);
  const [isSupported, setIsSupported] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastScannedRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  // Verify secure context at mount
  useEffect(() => {
    if (!navigator.mediaDevices) {
      setIsSupported(false);
      onError?.('Camera API is not supported on this browser');
      return;
    }
    
    if (!window.isSecureContext) {
      setIsSupported(false);
      onError?.('Camera access requires HTTPS connection (or localhost for development). Current URL is not secure.');
      return;
    }
  }, [onError]);

  const cleanupScanner = useCallback(async () => {
    console.log('[Scanner] Cleaning up scanner and tracks...');
    
    // Stop all video tracks
    videoTrackRef.current.forEach(track => {
      try {
        track.stop();
      } catch (e) {
        console.error('[Scanner] Error stopping track:', e);
      }
    });
    videoTrackRef.current = [];

    // Clear scanner
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
        console.log('[Scanner] Scanner cleared successfully');
      } catch (error) {
        console.error('[Scanner] Error clearing scanner:', error);
      }
      scannerRef.current = null;
    }
    
    setIsInitialized(false);
  }, []);

  const initializeScanner = useCallback(async () => {
    if (!enabled || !isSupported) {
      console.log('[Scanner] Initialization skipped. Enabled:', enabled, 'Supported:', isSupported);
      return;
    }

    console.log('[Scanner] Starting initialization with facingMode:', facingMode);
    
    try {
      // Clean up any previous scanner
      await cleanupScanner();

      // Step 1: Verify container exists
      console.log('[Scanner] Checking for container element...');
      const container = document.getElementById(SCANNER_ID);
      if (!container) {
        throw new Error(`Scanner container (#${SCANNER_ID}) not found in DOM. Ensure the dialog is properly rendered.`);
      }
      console.log('[Scanner] Container found');

      // Step 2: Clear container
      container.innerHTML = '';
      container.style.backgroundColor = '#000';

      // Step 3: Wait for DOM to fully render
      console.log('[Scanner] Waiting for DOM to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 150));

      // Step 4: Test camera access before initializing scanner
      console.log('[Scanner] Testing camera access with constraints:', { facingMode });
      let testStream: MediaStream | null = null;
      try {
        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };
        
        testStream = await navigator.mediaDevices.getUserMedia(constraints);
        const videoTrack = testStream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings();
        console.log('[Scanner] Camera access successful. Settings:', {
          width: settings?.width,
          height: settings?.height,
          facingMode: settings?.facingMode
        });
        
        // Store the test stream's track for cleanup
        testStream.getTracks().forEach(track => {
          videoTrackRef.current.push(track);
        });
      } catch (error: any) {
        const errorMsg = getErrorMessage(error);
        console.error('[Scanner] Camera access test failed:', errorMsg, error);
        throw new Error(`Camera test failed: ${errorMsg}`);
      }

      // Step 5: Initialize Html5QrcodeScanner
      console.log('[Scanner] Initializing Html5QrcodeScanner...');
      const scanner = new Html5QrcodeScanner(
        SCANNER_ID,
        {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.75;
            return {
              width: Math.floor(size),
              height: Math.floor(size),
            };
          },
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          disableFlip: false,
          videoConstraints: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        false // verbose logging disabled
      );

      console.log('[Scanner] Scanner instance created, rendering...');

      // Step 6: Render scanner with proper error handling
      await new Promise<void>((resolve, reject) => {
        try {
          scanner.render(
            (decodedText: string) => {
              console.log('[Scanner] Barcode detected:', decodedText);
              // Normalize Bengali numerals to English numerals
              const normalizedText = convertBengaliToEnglishNumerals(decodedText);
              
              // Prevent duplicate scans within 1 second
              const now = Date.now();
              if (normalizedText === lastScannedRef.current && now - lastScannedTimeRef.current < 1000) {
                console.log('[Scanner] Duplicate scan detected within 1s, ignoring');
                return;
              }

              lastScannedRef.current = normalizedText;
              lastScannedTimeRef.current = now;

              onBarcodeDetected(normalizedText);
            },
            (error: any) => {
              // Ignore continuous scanning errors - they're normal
              // Only log warnings for critical issues
              if (error?.message?.includes('No QR')) {
                // Normal scanning - no QR code detected
                return;
              }
              console.warn('[Scanner] Scanning warning:', error?.message);
            }
          );

          // Check if video element is actually rendering
          const videoElement = container.querySelector('video');
          if (videoElement) {
            console.log('[Scanner] Video element found, attaching event listeners');
            videoElement.onloadedmetadata = () => {
              console.log('[Scanner] Video metadata loaded, dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
              resolve();
            };
            
            // Fallback timeout after 2 seconds
            const timeout = setTimeout(() => {
              console.warn('[Scanner] Video metadata not received within 2s, continuing anyway');
              resolve();
            }, 2000);
            
            videoElement.onloadstart = () => {
              clearTimeout(timeout);
            };
          } else {
            console.warn('[Scanner] Video element not found yet, waiting...');
            setTimeout(() => resolve(), 1000);
          }
        } catch (renderError: any) {
          const errorMsg = getErrorMessage(renderError);
          console.error('[Scanner] Render error:', errorMsg, renderError);
          reject(new Error(`Scanner render failed: ${errorMsg}`));
        }
      });

      scannerRef.current = scanner;
      setIsInitialized(true);
      console.log('[Scanner] ✅ Scanner initialized successfully');

    } catch (error: any) {
      const errorMsg = getErrorMessage(error);
      console.error('[Scanner] ❌ Initialization failed:', errorMsg, error);
      await cleanupScanner();
      setIsSupported(false);
      onError?.(errorMsg);
    }
  }, [enabled, facingMode, isSupported, cleanupScanner, onBarcodeDetected, onError]);

  // Initialize/cleanup scanner based on enabled state
  useEffect(() => {
    let isMounted = true;

    if (enabled && isSupported) {
      // Delay to ensure container is in DOM
      const timer = setTimeout(() => {
        if (isMounted) {
          initializeScanner();
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        isMounted = false;
      };
    } else {
      cleanupScanner();
    }

    return () => {
      isMounted = false;
    };
  }, [enabled, isSupported, initializeScanner, cleanupScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, [cleanupScanner]);

  return {
    isSupported,
    isInitialized,
    scannerId: SCANNER_ID,
  };
}

export default useCameraBarcodeScanner;
