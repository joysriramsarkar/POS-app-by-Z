import re

with open("src/lib/printUtility.ts", "r") as f:
    content = f.read()

# Replace printToIframe implementation to handle Capacitor properly
# We need to detect Capacitor.isNativePlatform() but Capacitor isn't imported in printUtility.ts.
# We can check window.Capacitor.

old_print = """  // Create a hidden iframe with minimal footprint
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";"""

new_print = """  // Create a hidden iframe with minimal footprint
  const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform();

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";"""

content = content.replace(old_print, new_print)

old_handle_print = """  /**
   * Trigger the print dialog after content is fully loaded
   */
  const handlePrint = (): void => {
    if (iframe.contentWindow) {
      try {
        onBeforePrint?.();

        // Focus the iframe window (required for some browsers)
        iframe.contentWindow.focus();

        // Trigger native print dialog
        iframe.contentWindow.print();

        // Notify caller after print completes
        onAfterPrint?.();
      } catch (error) {
        console.error("[PrintUtil] Print failed:", error);
      } finally {
        // Clean up iframe after a short delay
        // (allows print dialog to fully render before removal)
        setTimeout(() => {
          try {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          } catch (e) {
            console.warn("[PrintUtil] Iframe cleanup failed:", e);
          }
        }, 1000);
      }
    }
  };"""

new_handle_print = """  /**
   * Trigger the print dialog after content is fully loaded
   */
  const handlePrint = (): void => {
    if (isCapacitor) {
      // Capacitor Android WebView iframe print fallback
      try {
        onBeforePrint?.();

        // Temporarily append the print content to the main document body
        const printContainer = document.createElement('div');
        printContainer.innerHTML = printHtml;
        printContainer.style.position = 'absolute';
        printContainer.style.top = '0';
        printContainer.style.left = '0';
        printContainer.style.width = '100%';
        printContainer.style.zIndex = '999999';
        printContainer.style.background = 'white';

        // Hide rest of the body
        const originalChildren = Array.from(document.body.children) as HTMLElement[];
        originalChildren.forEach(child => {
          if (child.id !== iframe.id) {
            child.setAttribute('data-original-display', child.style.display || '');
            child.style.display = 'none';
          }
        });

        document.body.appendChild(printContainer);

        setTimeout(() => {
          window.print();

          // Cleanup
          document.body.removeChild(printContainer);
          originalChildren.forEach(child => {
            if (child.id !== iframe.id) {
              child.style.display = child.getAttribute('data-original-display') || '';
              child.removeAttribute('data-original-display');
            }
          });
          onAfterPrint?.();

          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 300);

      } catch (error) {
        console.error("[PrintUtil] Capacitor print failed:", error);
      }
      return;
    }

    if (iframe.contentWindow) {
      try {
        onBeforePrint?.();

        // Focus the iframe window (required for some browsers)
        iframe.contentWindow.focus();

        // Trigger native print dialog
        iframe.contentWindow.print();

        // Notify caller after print completes
        onAfterPrint?.();
      } catch (error) {
        console.error("[PrintUtil] Print failed:", error);
      } finally {
        // Clean up iframe after a short delay
        // (allows print dialog to fully render before removal)
        setTimeout(() => {
          try {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          } catch (e) {
            console.warn("[PrintUtil] Iframe cleanup failed:", e);
          }
        }, 1000);
      }
    }
  };"""

content = content.replace(old_handle_print, new_handle_print)

with open("src/lib/printUtility.ts", "w") as f:
    f.write(content)
