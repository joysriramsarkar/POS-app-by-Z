import { describe, expect, it } from 'bun:test';
import { getPaymentStatusColor, getStatusColor, formatPrice } from './utils';

describe('Transaction History Utils', () => {
  describe('getPaymentStatusColor', () => {
    it('returns correct color classes for Paid status', () => {
      expect(getPaymentStatusColor('Paid')).toBe('bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400');
    });

    it('returns correct color classes for Partial status', () => {
      expect(getPaymentStatusColor('Partial')).toBe('bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400');
    });

    it('returns correct color classes for Due status', () => {
      expect(getPaymentStatusColor('Due')).toBe('bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400');
    });

    it('returns correct color classes for unknown/default status', () => {
      expect(getPaymentStatusColor('Unknown')).toBe('bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400');
      expect(getPaymentStatusColor('')).toBe('bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400');
    });
  });

  describe('getStatusColor', () => {
    it('returns correct color classes for Completed status', () => {
      expect(getStatusColor('Completed')).toBe('bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400');
    });

    it('returns correct color classes for Cancelled status', () => {
      expect(getStatusColor('Cancelled')).toBe('bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400');
    });

    it('returns correct color classes for Refunded status', () => {
      expect(getStatusColor('Refunded')).toBe('bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400');
    });

    it('returns correct color classes for unknown/default status', () => {
      expect(getStatusColor('Unknown')).toBe('bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400');
      expect(getStatusColor('')).toBe('bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400');
    });
  });

  describe('formatPrice', () => {
    it('formats an integer price correctly', () => {
      // In certain node/bun versions, Intl.NumberFormat space output may vary slightly with narrow non-breaking space
      // So we test characters by string replacement if necessary, but checking string directly usually works.
      const result = formatPrice(1000);
      expect(result.replace(/\u00A0/g, ' ')).toMatch(/₹\s?1,000/);
    });

    it('formats a decimal price correctly', () => {
      const result = formatPrice(1000.5);
      expect(result.replace(/\u00A0/g, ' ')).toMatch(/₹\s?1,000\.5/);
    });

    it('formats zero correctly', () => {
      const result = formatPrice(0);
      expect(result.replace(/\u00A0/g, ' ')).toMatch(/₹\s?0/);
    });
  });
});
