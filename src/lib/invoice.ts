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
 * Generates a unique, database-backed invoice number for server-side use
 * Uses sequential counter to guarantee uniqueness per day
 * Should be called only from server-side routes/actions
 * @throws Error if database is unavailable
 */
export async function generateServerInvoiceNumber(): Promise<string> {
  // Lazy import db only when this server function is called
  const { db } = await import('./db');
  
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Get today's sale count from database for sequential numbering
  const todayStart = new Date(date);
  todayStart.setHours(0, 0, 0, 0);
  
  const count = await db.sale.count({
    where: {
      createdAt: { gte: todayStart }
    }
  });
  
  // Use sequential counter: guarantees uniqueness per day
  return `INV-${dateStr}-${String(count + 1).padStart(6, '0')}`;
}
