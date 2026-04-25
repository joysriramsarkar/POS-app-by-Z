import type { PrintFormat } from '@/types/pos';

export async function generateInvoicePdf(
  invoiceHtml: string,
  format: PrintFormat
): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const { default: jsPDF } = await import('jspdf');

  const isThermal = format.startsWith('thermal');
  const pdfWidthMm = format === 'thermal-58' ? 58 : format === 'thermal-80' ? 80 : format === 'a5' ? 148 : 210;

  // Render inside a hidden iframe so all styles (Tailwind, fonts) load correctly
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;height:1200px;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(invoiceHtml);
    doc.close();
  });

  // Extra wait for fonts/images inside iframe
  await new Promise(r => setTimeout(r, 600));

  try {
    const iframeBody = iframe.contentDocument!.body;

    const canvas = await html2canvas(iframeBody, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: iframe.contentDocument!.documentElement.scrollWidth,
      windowHeight: iframe.contentDocument!.documentElement.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/png');
    // px → mm at 96dpi, accounting for scale:2
    const pxToMm = (px: number) => (px / 2 / 96) * 25.4;
    const imgHeightMm = pxToMm(canvas.height);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isThermal ? [pdfWidthMm, imgHeightMm] : (format === 'a5' ? 'a5' : 'a4'),
    });

    const docHeightMm = isThermal ? imgHeightMm : (format === 'a5' ? 210 : 297);
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, isThermal ? imgHeightMm : docHeightMm);

    return pdf.output('blob');
  } finally {
    document.body.removeChild(iframe);
  }
}

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';

export async function shareInvoiceAsPdf(
  invoiceHtml: string,
  format: PrintFormat,
  invoiceNumber: string,
  storeName: string,
  fallbackText: string
): Promise<void> {
  const blob = await generateInvoicePdf(invoiceHtml, format);
  const fileName = `Invoice-${invoiceNumber}.pdf`;

  const isNativePlatform = Capacitor.isNativePlatform();

  if (isNativePlatform) {
    try {
      // Capacitor Native Share
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      await new Promise<void>((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const base64data = reader.result as string;

            // Save to filesystem to share
            const savedFile = await Filesystem.writeFile({
              path: fileName,
              data: base64data,
              directory: Directory.Cache
            });

            await Share.share({
              title: `Invoice ${invoiceNumber}`,
              text: `Invoice from ${storeName}`,
              url: savedFile.uri,
              dialogTitle: 'Share Invoice'
            });
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = reject;
      });
      return;
    } catch (error) {
      console.error('Capacitor share error:', error);
    }
  }

  // Web fallback: Web Share API with PDF file (WhatsApp, Telegram, etc.)
  if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    const file = new File([blob], fileName, { type: 'application/pdf' });
    const shareData = { title: `Invoice ${invoiceNumber}`, text: `Invoice from ${storeName}`, files: [file] };
    if ((navigator as any).canShare(shareData)) {
      await navigator.share(shareData);
      return;
    }
  }

  // Desktop fallback: download the PDF
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
