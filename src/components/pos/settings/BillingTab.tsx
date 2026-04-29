import { AppSettings } from "@/stores/settings-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

interface BillingTabProps {
  localSettings: AppSettings;
  handleChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  handleSave: (sectionKeys: (keyof AppSettings)[]) => void;
  isSaving: boolean;
  hasChanges: () => boolean;
}

const CURRENCY_PRESETS = [
  { symbol: "৳", label: "BDT" },
  { symbol: "₹", label: "INR" },
  { symbol: "$", label: "USD" },
  { symbol: "€", label: "EUR" },
  { symbol: "£", label: "GBP" },
];

export default function BillingTab({ localSettings, handleChange, handleSave, isSaving, hasChanges }: BillingTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>বিলিং সেটিংস</CardTitle>
        <CardDescription>বিলিং ক্যালকুলেশনের পছন্দ কনফিগার করুন।</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>ডিফল্ট ডিসকাউন্ট %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={localSettings.default_discount}
              onChange={(e) => handleChange("default_discount", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>ট্যাক্স রেট %</Label>
            <Input
              type="number"
              min="0"
              value={localSettings.tax_rate}
              onChange={(e) => handleChange("tax_rate", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>কারেন্সি সিম্বল</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {CURRENCY_PRESETS.map(({ symbol, label }) => (
              <button
                key={symbol}
                onClick={() => handleChange("currency_symbol", symbol)}
                className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-all ${
                  localSettings.currency_symbol === symbol
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {symbol} {label}
              </button>
            ))}
          </div>
          <Input
            value={localSettings.currency_symbol}
            onChange={(e) => handleChange("currency_symbol", e.target.value)}
            className="max-w-[120px]"
            placeholder="কাস্টম"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">রাউন্ড অফ বিল</Label>
            <p className="text-xs text-muted-foreground">বিলের টাকা নিকটতম পূর্ণ সংখ্যায় রাউন্ড করুন</p>
          </div>
          <Switch checked={localSettings.round_off} onCheckedChange={(val) => handleChange("round_off", val)} />
        </div>

        <div className="pt-2 flex justify-end">
          <Button onClick={() => handleSave(["default_discount", "tax_rate", "currency_symbol", "round_off"])} disabled={isSaving || !hasChanges()} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            সংরক্ষণ করুন
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
