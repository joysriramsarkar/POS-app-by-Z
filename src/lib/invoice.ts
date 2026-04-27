import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a temporary, local invoice number for client-side use
 * Used for offline mode and temporary records before sync
 * WARNING: Not guaranteed unique across concurrent operations
 * Should be replaced by server-generated number when synced
 */
export function generateInvoiceNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  // Use timestamp-based random for temporary client-side numbers
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `INV-${dateStr}-TEMP-${timestamp}${random}`;
}

/**
 * Generates a unique invoice number for server-side use
 * Uses a UUID fragment to guarantee uniqueness
 * Should be called only from server-side routes/actions
 */
export async function generateServerInvoiceNumber(): Promise<string> {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Generate a UUID and take an 8-character fragment to ensure uniqueness
  const uuidFragment = uuidv4().split('-')[0].toUpperCase();
  
  // Use date and UUID fragment: INV-YYYYMMDD-[UUID_FRAGMENT]
  return `INV-${dateStr}-${uuidFragment}`;
}
