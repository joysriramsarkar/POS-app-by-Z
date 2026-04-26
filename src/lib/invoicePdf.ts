import type { PrintFormat } from '@/types/pos';

export async function generateInvoicePdf(
  invoiceHtml: string,
  format: PrintFormat
): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf');

  const isThermal = format.startsWith('thermal');
  const pdfWidthMm = format === 'thermal-58' ? 58 : format === 'thermal-80' ? 80 : format === 'a5' ? 148 : 210;
  const pdfHeightMm = isThermal ? 400 : (format === 'a5' ? 210 : 297);

  // Render inside a hidden iframe so all styles load correctly
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

  await new Promise(r => setTimeout(r, 600));

  try {
    const iframeDoc = iframe.contentDocument!;
    const invoiceEl = iframeDoc.querySelector<HTMLElement>('.print-invoice-container') || iframeDoc.body;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isThermal ? [pdfWidthMm, pdfHeightMm] : (format === 'a5' ? 'a5' : 'a4'),
    });

    await new Promise<void>((resolve, reject) => {
      pdf.html(invoiceEl, {
        callback: (doc) => { resolve(); },
        x: 0,
        y: 0,
        width: pdfWidthMm,
        windowWidth: invoiceEl.scrollWidth || 600,
        autoPaging: 'text',
        margin: [0, 0, 0, 0],
      });
    });

    return pdf.output('blob');
  } finally {
    document.body.removeChild(iframe);
  }
}



export async function shareInvoiceAsPdf(
  invoiceHtml: string,
  format: PrintFormat,
  invoiceNumber: string,
  storeName: string,
  fallbackText: string
): Promise<void> {
  const blob = await generateInvoicePdf(invoiceHtml, format);
  const fileName = `Invoice-${invoiceNumber}.pdf`;

  let isNativePlatform = false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    isNativePlatform = Capacitor.isNativePlatform();
  } catch { /* not a native platform */ }

  if (isNativePlatform) {
    try {
      const [{ Share }, { Directory, Filesystem }] = await Promise.all([
        import('@capacitor/share'),
        import('@capacitor/filesystem'),
      ]);
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      await new Promise<void>((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const base64data = reader.result as string;
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
