"use client";

import * as React from "react";
import { Separator } from "@/components/ui/separator";
import type { Sale, SaleItem, PrintFormat } from "@/types/pos";
import { STORE_CONFIG } from "@/types/pos";

// ============================================================================
// TYPES
// ============================================================================

interface PrintInvoiceProps {
  sale: Sale;
  format: PrintFormat;
  showLogo?: boolean;
  showGst?: boolean;
  footerMessage?: string;
  className?: string;
  storeConfig?: {
    name: string;
    nameBn: string;
    address: string;
    phone: string;
    gstNumber?: string;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatCurrency = (amount: number): string => {
  return `₹${amount.toFixed(2)}`;
};

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTime = (date: Date): string => {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// ============================================================================
// THERMAL INVOICE (58mm and 80mm)
// ============================================================================

interface ThermalInvoiceProps {
  sale: Sale;
  width: "58mm" | "80mm";
  showLogo?: boolean;
  footerMessage?: string;
  storeConfig?: {
    name: string;
    nameBn: string;
    address: string;
    phone: string;
    gstNumber?: string;
  };
}

function ThermalInvoice({
  sale,
  width,
  showLogo = true,
  footerMessage,
  storeConfig,
}: ThermalInvoiceProps) {
  // Use passed config or fallback to hardcoded defaults
  const config = storeConfig || STORE_CONFIG;
  const is58mm = width === "58mm";
  const fontSize = is58mm ? "text-[10px]" : "text-xs";
  const sectionPadding = is58mm ? "p-2" : "p-3";
  
  // ========================================================================
  // CRITICAL: Strict width constraints to prevent thermal printer breaks
  // ========================================================================
  const therminalWidth = is58mm ? "w-[58mm] max-w-[58mm]" : "w-[80mm] max-w-[80mm]";
  const containerStyle: React.CSSProperties = {
    width: is58mm ? "58mm" : "80mm",
    maxWidth: is58mm ? "58mm" : "80mm",
    margin: "0 auto",
    overflow: "hidden",
    wordBreak: "break-word",
    boxSizing: "border-box",
  };

  return (
    <div
      className={`thermal-invoice thermal-${width} ${therminalWidth} p-0 bg-white text-black font-mono overflow-hidden wrap-break-word`}
      style={containerStyle}
    >
      {/* Header */}
      <div className={`text-center space-y-1 truncate ${sectionPadding}`}>
        {showLogo && (
          <div className="flex justify-center mb-2">
            <img src="/favicon.ico" alt="Logo" className="w-10 h-10" />
          </div>
        )}
        <h1 className="font-bold text-sm truncate">{config.name}</h1>
        <p className={`${fontSize} font-semibold truncate`}>{config.nameBn}</p>
        <p className={`${fontSize} truncate`}>{config.address}</p>
        <p className={`${fontSize} truncate`}>Ph: {config.phone}</p>
      </div>

      <Separator className="my-2 bg-black" />

      {/* Invoice Info */}
      <div className={`${fontSize} space-y-0.5 ${sectionPadding}`}>
        <div className="flex justify-between min-w-0">
          <span className="shrink-0">Invoice:</span>
          <span className="font-semibold shrink-0 ml-2">{sale.invoiceNumber}</span>
        </div>
        <div className="flex justify-between min-w-0">
          <span className="shrink-0">Date:</span>
          <span className="shrink-0 ml-2">{formatDate(sale.createdAt)}</span>
        </div>
        <div className="flex justify-between min-w-0">
          <span className="shrink-0">Time:</span>
          <span className="shrink-0 ml-2">{formatTime(sale.createdAt)}</span>
        </div>
        {sale.customer && (
          <div className="mt-1 pt-1 border-t border-dashed border-gray-400">
            <div className="flex justify-between min-w-0 truncate">
              <span className="shrink-0">Customer:</span>
              <span className="truncate ml-2">{sale.customer.name}</span>
            </div>
            {sale.customer.phone && (
              <div className="flex justify-between min-w-0">
                <span className="shrink-0">Phone:</span>
                <span className="shrink-0 ml-2">{sale.customer.phone}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <Separator className="my-2 bg-black" />

      {/* Items Table - STRICTLY SIZED TO PREVENT OVERFLOW */}
      <div className={`${fontSize} overflow-hidden ${sectionPadding}`}>
        <table className="w-full product-table border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="text-left w-[55%] font-bold border-b border-black pb-0.5">Item</th>
              <th className="text-right w-[15%] font-bold border-b border-black pb-0.5">Qty</th>
              <th className="text-right w-[15%] font-bold border-b border-black pb-0.5">Price</th>
              <th className="text-right w-[15%] font-bold border-b border-black pb-0.5">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-b border-dotted border-gray-300 last:border-0">
                <td className="product-name-cell w-[55%] pr-1 align-top whitespace-normal wrap-break-word">{item.productName}</td>
                <td className="w-[15%] text-right align-top">{item.quantity}</td>
                <td className="w-[15%] text-right align-top">{item.unitPrice.toFixed(0)}</td>
                <td className="w-[15%] text-right align-top font-medium">{item.totalPrice.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-1 space-y-0.5 overflow-hidden">
          <div className="flex justify-between min-w-0">
            <span className="shrink-0">Subtotal:</span>
            <span className="shrink-0 ml-2 font-medium">{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between min-w-0 text-green-700">
              <span className="shrink-0">Discount:</span>
              <span className="shrink-0 ml-2 font-medium">-{formatCurrency(sale.discount)}</span>
            </div>
          )}
          {sale.tax > 0 && (
            <div className="flex justify-between min-w-0">
              <span className="shrink-0">Tax:</span>
              <span className="shrink-0 ml-2 font-medium">+{formatCurrency(sale.tax)}</span>
            </div>
          )}
        </div>
      </div>

      <Separator className="my-1 bg-black" />

      {/* Grand Total */}
      <div className={`${fontSize} font-bold flex justify-between text-sm min-w-0`}>
        <span className="shrink-0">GRAND TOTAL:</span>
        <span className="shrink-0 ml-2">{formatCurrency(sale.totalAmount)}</span>
      </div>

      <Separator className="my-2 bg-black" />

      {/* Payment Info */}
      <div className={`${fontSize} space-y-0.5 overflow-hidden`}>
        <div className="flex justify-between min-w-0">
          <span className="shrink-0">Payment:</span>
          <span className="font-semibold shrink-0 ml-2">{sale.paymentMethod}</span>
        </div>
        <div className="flex justify-between min-w-0">
          <span className="shrink-0">Status:</span>
          <span className="shrink-0 ml-2">{sale.paymentStatus}</span>
        </div>
      </div>

      {/* Footer */}
      <div className={`${fontSize} text-center mt-3 space-y-1 overflow-hidden`}>
        <Separator className="my-1 bg-black" />
        <p className="font-semibold">ধন্যবাদ!</p>
        <p>Thank you for shopping!</p>
        <p>Visit us again!</p>
        {footerMessage && (
          <p className="mt-1 text-[8px] truncate">{footerMessage}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// A4/A5 INVOICE
// ============================================================================

interface StandardInvoiceProps {
  sale: Sale;
  size: "A4" | "A5";
  showLogo?: boolean;
  showGst?: boolean;
  footerMessage?: string;
  storeConfig?: {
    name: string;
    nameBn: string;
    address: string;
    phone: string;
    gstNumber?: string;
  };
}

function StandardInvoice({
  sale,
  size,
  showLogo = true,
  showGst = false,
  footerMessage,
  storeConfig,
}: StandardInvoiceProps) {
  // Use passed config or fallback to hardcoded defaults
  const config = storeConfig || STORE_CONFIG;
  const isA4 = size === "A4";
  const paperWidth = isA4 ? "w-[210mm]" : "w-[148mm]";
  const paperHeight = isA4 ? "min-h-[297mm]" : "min-h-[210mm]";
  const padding = isA4 ? "p-8" : "p-6";

  return (
    <div
      className={`standard-invoice ${paperWidth} ${paperHeight} ${padding} bg-white text-black mx-auto`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-start gap-4">
          {showLogo && (
            <div 
              className="border-2 border-gray-800 rounded-lg flex items-center justify-center shrink-0"
              style={{ 
                width: '4rem',
                height: '4rem',
                minWidth: '4rem',
                minHeight: '4rem'
              }}
            >
              <span className="text-2xl font-bold">LB</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {config.name}
            </h1>
            <p className="text-lg font-semibold text-gray-700">
              {config.nameBn}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {config.address}
            </p>
            <p className="text-sm text-gray-600">
              Phone: {config.phone}
            </p>
            {showGst && config.gstNumber && (
              <p className="text-sm text-gray-600">
                GST: {config.gstNumber}
              </p>
            )}
          </div>
        </div>

        {/* Invoice Details */}
        <div className="text-right">
          <div className="inline-block border-2 border-gray-800 px-4 py-2">
            <h2 className="text-xl font-bold">TAX INVOICE</h2>
          </div>
          <div className="mt-3 text-sm space-y-1">
            <p>
              <span className="text-gray-600">Invoice No:</span>{" "}
              <span className="font-semibold">{sale.invoiceNumber}</span>
            </p>
            <p>
              <span className="text-gray-600">Date:</span>{" "}
              {formatDate(sale.createdAt)}
            </p>
            <p>
              <span className="text-gray-600">Time:</span>{" "}
              {formatTime(sale.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Customer Details */}
      {sale.customer && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Bill To:
          </h3>
          <p className="font-semibold">{sale.customer.name}</p>
          {sale.customer.phone && (
            <p className="text-sm text-gray-600">
              Phone: {sale.customer.phone}
            </p>
          )}
          {sale.customer.address && (
            <p className="text-sm text-gray-600">{sale.customer.address}</p>
          )}
        </div>
      )}

      {/* Items Table */}
      <table className="w-full mb-6 border-collapse">
        <thead>
          <tr className="bg-gray-100 border-y-2 border-gray-800">
            <th className="py-3 px-4 text-left text-sm font-semibold">#</th>
            <th className="py-3 px-4 text-left text-sm font-semibold">
              Item Description
            </th>
            <th className="py-3 px-4 text-center text-sm font-semibold">
              Qty
            </th>
            <th className="py-3 px-4 text-right text-sm font-semibold">
              Unit Price
            </th>
            <th className="py-3 px-4 text-right text-sm font-semibold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, index) => (
            <tr
              key={item.id}
              className="border-b border-gray-200 hover:bg-gray-50"
            >
              <td className="py-3 px-4 text-sm">{index + 1}</td>
              <td className="py-3 px-4 text-sm font-medium">
                {item.productName}
              </td>
              <td className="py-3 px-4 text-sm text-center">
                {item.quantity}
              </td>
              <td className="py-3 px-4 text-sm text-right">
                {formatCurrency(item.unitPrice)}
              </td>
              <td className="py-3 px-4 text-sm text-right font-medium">
                {formatCurrency(item.totalPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Section */}
      <div className="flex justify-end mb-6">
        <div className="w-64">
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600">Subtotal:</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between py-2 border-b border-gray-200 text-green-700">
              <span>Discount:</span>
              <span>-{formatCurrency(sale.discount)}</span>
            </div>
          )}
          {sale.tax > 0 && (
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Tax:</span>
              <span>+{formatCurrency(sale.tax)}</span>
            </div>
          )}
          <div className="flex justify-between py-3 text-lg font-bold border-t-2 border-gray-800 mt-1">
            <span>Grand Total:</span>
            <span>{formatCurrency(sale.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Payment Info */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="font-semibold text-sm text-gray-700">
            Payment Details:
          </h4>
          <p className="text-sm">
            Method: <span className="font-medium">{sale.paymentMethod}</span>
          </p>
          <p className="text-sm">
            Status:{" "}
            <span
              className={`font-medium ${
                sale.paymentStatus === "Paid"
                  ? "text-green-700"
                  : sale.paymentStatus === "Partial"
                  ? "text-orange-700"
                  : "text-red-700"
              }`}
            >
              {sale.paymentStatus}
            </span>
          </p>
        </div>
        {sale.notes && (
          <div className="text-right">
            <h4 className="font-semibold text-sm text-gray-700">Notes:</h4>
            <p className="text-sm text-gray-600">{sale.notes}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6 border-t-2 border-gray-200">
        <div className="flex justify-between items-end">
          <div className="text-sm text-gray-600">
            <p className="font-semibold">Terms & Conditions:</p>
            <p>• Goods once sold will not be taken back.</p>
            <p>• Subject to local jurisdiction.</p>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 w-40 pt-1">
              <p className="text-sm text-gray-600">Authorized Signatory</p>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 pt-4 border-t border-gray-200">
          <p className="font-semibold text-gray-800">ধন্যবাদ! Thank you for shopping with us!</p>
          <p className="text-sm text-gray-600">Visit us again</p>
          {footerMessage && (
            <p className="text-xs text-gray-500 mt-2">{footerMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PrintInvoice({
  sale,
  format,
  showLogo = true,
  showGst = false,
  footerMessage = "This is a computer generated invoice.",
  className = "",
  storeConfig,
}: PrintInvoiceProps) {
  const invoiceRef = React.useRef<HTMLDivElement>(null);

  const renderInvoice = () => {
    switch (format) {
      case "thermal-58":
        return (
          <ThermalInvoice
            sale={sale}
            width="58mm"
            showLogo={showLogo}
            footerMessage={footerMessage}
            storeConfig={storeConfig}
          />
        );
      case "thermal-80":
        return (
          <ThermalInvoice
            sale={sale}
            width="80mm"
            showLogo={showLogo}
            footerMessage={footerMessage}
            storeConfig={storeConfig}
          />
        );
      case "a4":
        return (
          <StandardInvoice
            sale={sale}
            size="A4"
            showLogo={showLogo}
            showGst={showGst}
            footerMessage={footerMessage}
            storeConfig={storeConfig}
          />
        );
      case "a5":
        return (
          <StandardInvoice
            sale={sale}
            size="A5"
            showLogo={showLogo}
            showGst={showGst}
            footerMessage={footerMessage}
            storeConfig={storeConfig}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={invoiceRef}
      className={`print-invoice-container ${className}`}
      data-format={format}
    >
      {renderInvoice()}
    </div>
  );
}

// ============================================================================
// PREVIEW WRAPPER
// ============================================================================

interface InvoicePreviewProps {
  sale: Sale;
  format: PrintFormat;
  showLogo?: boolean;
  showGst?: boolean;
  footerMessage?: string;
  storeConfig?: {
    name: string;
    nameBn: string;
    address: string;
    phone: string;
    gstNumber?: string;
  };
}

export function InvoicePreview({
  sale,
  format,
  showLogo = true,
  showGst = false,
  footerMessage,
  storeConfig,
}: InvoicePreviewProps) {
  const isThermal = format.startsWith("thermal");
  const previewScale = isThermal ? 1 : 0.5;

  return (
    <div className="invoice-preview w-full overflow-auto bg-gray-100 rounded-lg p-4 print:p-0 print:bg-white">
      <div
        className="origin-top-left transition-transform"
        style={{
          transform: isThermal ? "scale(1)" : `scale(${previewScale})`,
          transformOrigin: "top left",
        }}
      >
        <PrintInvoice
          sale={sale}
          format={format}
          showLogo={showLogo}
          showGst={showGst}
          footerMessage={footerMessage}
          storeConfig={storeConfig}
        />
      </div>
    </div>
  );
}

export default PrintInvoice;
