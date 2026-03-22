with open("src/components/pos/CameraScannerDialog.tsx", "r") as f:
    content = f.read()

# Import cart store
import_old = """import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, AlertCircle } from 'lucide-react';"""

import_new = """import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, AlertCircle } from 'lucide-react';
import { useCartStore } from '@/stores/pos-store';"""

content = content.replace(import_old, import_new)

# Add useCartStore to component
comp_old = """export function CameraScannerDialog({
  open,
  onOpenChange,
  onBarcodeScanned,
  title = 'Scan Barcode',
  description = 'Position barcode within the frame',
}: CameraScannerDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);"""

comp_new = """export function CameraScannerDialog({
  open,
  onOpenChange,
  onBarcodeScanned,
  title = 'Scan Barcode',
  description = 'Position barcode within the frame',
}: CameraScannerDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const cartItems = useCartStore((state) => state.items);"""

content = content.replace(comp_old, comp_new)

# Add live preview UI
ui_old = """        {!isAndroidApp ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">Barcode scanning is available only in the Android app.</p>
          </div>
        ) : (
          <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden border-2 border-gray-700">
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-white/80">Tap Scan to open the camera scanner.</p>
            </div>
          </div>
        )}"""

ui_new = """        {!isAndroidApp ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">Barcode scanning is available only in the Android app.</p>
          </div>
        ) : (
          <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden border-2 border-gray-700">
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-white/80">Tap Scan to open the camera scanner.</p>
            </div>

            {/* Live Cart Preview */}
            {cartItems.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-3 text-white">
                <p className="text-xs font-semibold mb-2 opacity-80">Cart Preview (Last {Math.min(3, cartItems.length)} items)</p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {cartItems.slice(-3).reverse().map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="truncate flex-1 pr-2">{item.productName}</span>
                      <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}"""

content = content.replace(ui_old, ui_new)

with open("src/components/pos/CameraScannerDialog.tsx", "w") as f:
    f.write(content)
