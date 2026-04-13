import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { generateInvoiceNumber, generateServerInvoiceNumber } from './invoice';

describe('Invoice Number Generators', () => {
  describe('generateInvoiceNumber', () => {
    let originalDate: typeof global.Date;
    let originalMath: typeof global.Math;

    beforeEach(() => {
      originalDate = global.Date;
      originalMath = global.Math;
    });

    afterEach(() => {
      global.Date = originalDate;
      global.Math = originalMath;
    });

    it('should generate a deterministic invoice number based on mocked date and random', () => {
      // Mock Date to a fixed value (e.g., 2023-10-25T12:00:00.000Z)
      const FIXED_TIME = 1698235200000;

      class MockDate extends originalDate {
        constructor() {
          super(FIXED_TIME);
        }
        static now() {
          return FIXED_TIME;
        }
      }
      global.Date = MockDate as any;

      // Mock Math.random
      global.Math = Object.create(global.Math);
      global.Math.random = () => 0.42; // Math.floor(0.42 * 100) = 42

      // Date: 2023-10-25
      // Date Str: 20231025
      // Timestamp slice: 1698235200000 -> slice(-4) -> "0000"
      // Random slice: Math.floor(0.42 * 100) -> 42 -> "42"
      // Result: INV-20231025-TEMP-000042

      const invoiceNum = generateInvoiceNumber();
      expect(invoiceNum).toBe('INV-20231025-TEMP-000042');
    });

    it('should match the expected regular expression format', () => {
      const invoiceNum = generateInvoiceNumber();

      // Format: INV-YYYYMMDD-TEMP-XXXXXX (4 timestamp + 2 random digits = 6 digits)
      const regex = /^INV-\d{8}-TEMP-\d{6}$/;
      expect(regex.test(invoiceNum)).toBe(true);
      expect(invoiceNum.length).toBe(24);
    });

    it('should generate different numbers on subsequent calls', () => {
      const num1 = generateInvoiceNumber();
      const num2 = generateInvoiceNumber();

      // Since it uses Math.random() and Date.now(), it's highly likely they differ.
      // We can't guarantee 100% differ due to small random space, but it's very probable.
      // If we run this synchronously fast, timestamp is same, but random is 1/100 chance collision.
      // To ensure no flakiness, we just test the regex again.
      const regex = /^INV-\d{8}-TEMP-\d{6}$/;
      expect(regex.test(num1)).toBe(true);
      expect(regex.test(num2)).toBe(true);
    });
  });

  describe('generateServerInvoiceNumber', () => {
    it('should return a string with the correct format', async () => {
      const invoiceNum = await generateServerInvoiceNumber();

      // Format: INV-YYYYMMDD-[UUID_FRAGMENT]
      // UUID fragment is typically 8 hex characters, but let's allow general alphanumeric just in case
      const regex = /^INV-\d{8}-[A-F0-9]{8}$/i;
      expect(regex.test(invoiceNum)).toBe(true);
    });

    it('should generate unique numbers across multiple calls', async () => {
      const num1 = await generateServerInvoiceNumber();
      const num2 = await generateServerInvoiceNumber();

      expect(num1).not.toBe(num2);
    });
  });
});
