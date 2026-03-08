"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InvoicePreview, PrintInvoice } from "./PrintInvoice";
import type { Sale, PrintFormat } from "@/types/pos";

// ============================================================================
// TYPES
// ============================================================================

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  onPrint?: (format: PrintFormat) => void;
}

// ============================================================================
// PRINT FORMAT OPTIONS
// ============================================================================

const PRINT_FORMATS: {
  value: PrintFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "thermal-58",
    label: "Thermal 58mm",
    description: "Small receipt printer",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    value: "thermal-80",
    label: "Thermal 80mm",
    description: "Standard receipt printer",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
        />
      </svg>
    ),
  },
  {
    value: "a4",
    label: "A4 Paper",
    description: "Full page invoice",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    value: "a5",
    label: "A5 Paper",
    description: "Half page invoice",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    ),
  },
];

// ============================================================================
// PRINT DIALOG COMPONENT
// ============================================================================

export function PrintDialog({
  open,
  onOpenChange,
  sale,
  onPrint,
}: PrintDialogProps) {
  const [selectedFormat, setSelectedFormat] = React.useState<PrintFormat>("thermal-80");
  const [showLogo, setShowLogo] = React.useState(true);
  const [showGst, setShowGst] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [footerMessage, setFooterMessage] = React.useState(
    "This is a computer generated invoice."
  );

  // Reset preview when dialog closes
  React.useEffect(() => {
    if (!open) {
      setShowPreview(false);
    }
  }, [open]);

  const handlePrint = () => {
    if (onPrint) {
      onPrint(selectedFormat);
    } else {
      // Default print behavior
      window.print();
    }
    onOpenChange(false);
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  if (!sale) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Print Invoice</DialogTitle>
          <DialogDescription>
            Select print format and options for invoice #{sale.invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-6">
          {/* Left Side - Options */}
          <div className="w-80 shrink-0 space-y-4">
            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Print Format</Label>
              <RadioGroup
                value={selectedFormat}
                onValueChange={(value) => setSelectedFormat(value as PrintFormat)}
                className="grid grid-cols-2 gap-2"
              >
                {PRINT_FORMATS.map((format) => (
                  <Label
                    key={format.value}
                    htmlFor={format.value}
                    className={`
                      flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer
                      transition-all hover:bg-gray-50
                      ${
                        selectedFormat === format.value
                          ? "border-primary bg-primary/5"
                          : "border-gray-200"
                      }
                    `}
                  >
                    <RadioGroupItem
                      value={format.value}
                      id={format.value}
                      className="sr-only"
                    />
                    {format.icon}
                    <div className="text-center">
                      <p className="font-medium text-sm">{format.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {format.description}
                      </p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            {/* Options */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Options</Label>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-logo" className="font-normal">
                  Show Logo
                </Label>
                <Switch
                  id="show-logo"
                  checked={showLogo}
                  onCheckedChange={setShowLogo}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-gst" className="font-normal">
                  Show GST Number
                </Label>
                <Switch
                  id="show-gst"
                  checked={showGst}
                  onCheckedChange={setShowGst}
                />
              </div>
            </div>

            <Separator />

            {/* Footer Message */}
            <div className="space-y-2">
              <Label htmlFor="footer-message" className="text-base font-semibold">
                Footer Message
              </Label>
              <textarea
                id="footer-message"
                value={footerMessage}
                onChange={(e) => setFooterMessage(e.target.value)}
                className="w-full p-2 text-sm border rounded-md resize-none h-16"
                placeholder="Custom footer message..."
              />
            </div>

            {/* Preview Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handlePreview}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              Preview Invoice
            </Button>
          </div>

          {/* Right Side - Preview */}
          <div className="flex-1 min-w-0">
            {showPreview ? (
              <ScrollArea className="h-[60vh]">
                <InvoicePreview
                  sale={sale}
                  format={selectedFormat}
                  showLogo={showLogo}
                  showGst={showGst}
                  footerMessage={footerMessage}
                />
              </ScrollArea>
            ) : (
              <div className="h-[60vh] flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <div className="text-center text-gray-500">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="font-medium">No Preview Available</p>
                  <p className="text-sm">Click &quot;Preview Invoice&quot; to see the preview</p>
                </div>
              </div>
            )}

            {/* Hidden printable invoice - always in DOM for browser print */}
            <div className="sr-only print:not-sr-only">
              <PrintInvoice
                sale={sale}
                format={selectedFormat}
                showLogo={showLogo}
                showGst={showGst}
                footerMessage={footerMessage}
              />
            </div>
          </div>
        </div>

        <Separator />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PrintDialog;
