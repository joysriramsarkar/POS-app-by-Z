// ============================================================================
// useBarcodeScanner - Global Barcode Scanner Hook
// Lakhan Bhandar POS System
// 
// This hook listens to global keyboard events and detects barcode scanner input
// by measuring typing speed. Barcode scanners typically input characters much
// faster than a human typist.
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { convertBengaliToEnglishNumerals } from '@/lib/utils';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface BarcodeScannerConfig {
  /** Minimum time between keystrokes to consider it a barcode scan (ms) */
  minInterKeyTime?: number;
  /** Maximum time between keystrokes before buffer is cleared (ms) */
  maxInterKeyTime?: number;
  /** Minimum length of barcode to trigger callback */
  minBarcodeLength?: number;
  /** Maximum length of barcode */
  maxBarcodeLength?: number;
  /** End characters that signify barcode completion (default: Enter) */
  endChars?: string[];
  /** Callback when barcode is detected */
  onBarcodeDetected: (barcode: string) => void;
  /** Callback for debugging/logging */
  onDebug?: (message: string) => void;
}

interface BarcodeScannerState {
  buffer: string;
  lastKeyTime: number;
  isScanning: boolean;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useBarcodeScanner(config: BarcodeScannerConfig) {
  const {
    minInterKeyTime = 0, // Minimum time between keys (scanners are fast)
    maxInterKeyTime = 50, // Maximum time between keys for barcode detection
    minBarcodeLength = 4,
    maxBarcodeLength = 50,
    endChars = ['Enter', 'NumpadEnter'],
    onBarcodeDetected,
    onDebug,
  } = config;

  // Use ref to store state to avoid re-renders
  const stateRef = useRef<BarcodeScannerState>({
    buffer: '',
    lastKeyTime: 0,
    isScanning: false,
  });

  // Track if we're currently typing in an input field
  const isInputFocused = useRef(false);

  // Debug logger
  const debug = useCallback(
    (message: string) => {
      if (onDebug) {
        onDebug(message);
      }
    },
    [onDebug]
  );

  // Handle barcode detection
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip if we're typing in an input field (unless it's Enter)
      const activeElement = document.activeElement;
      const isEditableElement =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true';

      if (isEditableElement && !endChars.includes(event.key)) {
        isInputFocused.current = true;
        return;
      }

      isInputFocused.current = false;
      const currentTime = Date.now();
      const state = stateRef.current;
      const timeSinceLastKey = currentTime - state.lastKeyTime;

      debug(
        `Key: ${event.key}, Time since last: ${timeSinceLastKey}ms, Buffer: ${state.buffer}`
      );

      // Check if this is an end character
      if (endChars.includes(event.key)) {
        // If we have a buffer and it's long enough, process it
        if (state.buffer.length >= minBarcodeLength && state.buffer.length <= maxBarcodeLength) {
          const barcode = state.buffer;
          debug(`Barcode detected: ${barcode}`);
          onBarcodeDetected(barcode);
        }
        // Reset state
        state.buffer = '';
        state.isScanning = false;
        state.lastKeyTime = 0;
        event.preventDefault(); // Prevent form submission
        return;
      }

      // Check for valid barcode characters (alphanumeric, Bengali numerals, and some special chars)
      const isValidBarcodeChar = /^[a-zA-Z0-9\-_.০-৯]$/.test(event.key);

      if (!isValidBarcodeChar) {
        // Reset if invalid character
        state.buffer = '';
        state.isScanning = false;
        state.lastKeyTime = 0;
        return;
      }

      // Determine if this could be a barcode scan based on timing
      if (state.buffer.length === 0) {
        // First character of potential barcode
        state.buffer = event.key;
        state.isScanning = true;
        state.lastKeyTime = currentTime;
      } else {
        // Check timing to determine if this is a scanner or human typing
        const isScannerSpeed = timeSinceLastKey <= maxInterKeyTime;

        if (isScannerSpeed || state.isScanning) {
          // This looks like a scanner or we're already scanning
          state.buffer += event.key;
          state.isScanning = isScannerSpeed;
          state.lastKeyTime = currentTime;

          // Safety check: if buffer is too long, reset
          if (state.buffer.length > maxBarcodeLength) {
            debug(`Buffer too long, resetting`);
            state.buffer = '';
            state.isScanning = false;
            state.lastKeyTime = 0;
          }
        } else {
          // Human typing speed, start new potential barcode
          state.buffer = event.key;
          state.isScanning = false;
          state.lastKeyTime = currentTime;
        }
      }
    },
    [endChars, minBarcodeLength, maxBarcodeLength, maxInterKeyTime, onBarcodeDetected, debug]
  );

  // Clear buffer after timeout (for partial scans)
  const clearBuffer = useCallback(() => {
    const state = stateRef.current;
    if (state.buffer.length > 0 && state.buffer.length < minBarcodeLength) {
      debug(`Clearing partial buffer: ${state.buffer}`);
      state.buffer = '';
      state.isScanning = false;
    }
  }, [minBarcodeLength, debug]);

  // Set up event listeners
  useEffect(() => {
    // Add keydown listener
    window.addEventListener('keydown', handleKeyDown);

    // Set up timeout to clear partial barcodes
    const timeoutId = setInterval(clearBuffer, 1000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(timeoutId);
    };
  }, [handleKeyDown, clearBuffer]);

  // Return current state for debugging
  return {
    getCurrentBuffer: () => stateRef.current.buffer,
    isScanning: () => stateRef.current.isScanning,
  };
}

// ============================================================================
// SIMPLIFIED HOOK FOR POS
// ============================================================================

interface SimpleBarcodeScannerConfig {
  onBarcodeDetected: (barcode: string) => void;
  enabled?: boolean;
}

export function useSimpleBarcodeScanner({
  onBarcodeDetected,
  enabled = true,
}: SimpleBarcodeScannerConfig) {
  const bufferRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if typing in an input field
      const activeElement = document.activeElement;
      const isEditable =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true';

      if (isEditable) return;

      // Check for Enter key (barcode end marker)
      if (event.key === 'Enter' || event.key === 'NumpadEnter') {
        if (bufferRef.current.length >= 3) { // Reduced to 3 to support shorter barcodes
          const rawBarcode = bufferRef.current;
          const barcode = convertBengaliToEnglishNumerals(rawBarcode);
          bufferRef.current = '';
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          onBarcodeDetected(barcode);
          event.preventDefault();
        }
        return;
      }

      // Only accept alphanumeric, Bengali numerals and common barcode characters
      if (/^[a-zA-Z0-9\-_.০-৯]$/.test(event.key)) {
        bufferRef.current += event.key;

        // Clear existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Set timeout to clear buffer if typing stops (human typing)
        // Some wireless barcode scanners have a 100-200ms delay between keys
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, 250);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onBarcodeDetected, enabled]);
}

export default useBarcodeScanner;
