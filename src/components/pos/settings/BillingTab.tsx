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

export default function BillingTab({ localSettings, handleChange, handleSave, isSaving, hasChanges }: BillingTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>বিলিং সেটিংস (Billing Settings)</CardTitle>
        <CardDescription>Configure billing calculation preferences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>ডিফল্ট ডিসকাউন্ট % (Default Discount)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={localSettings.default_discount}
              onChange={(e) => handleChange("default_discount", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>ট্যাক্স রেট % (Tax Rate)</Label>
            <Input
              type="number"
              min="0"
              value={localSettings.tax_rate}
              onChange={(e) => handleChange("tax_rate", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-2 max-w-xs">
          <Label>কারেন্সি সিম্বল (Currency Symbol)</Label>
          <Input
            value={localSettings.currency_symbol}
            onChange={(e) => handleChange("currency_symbol", e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">রাউন্ড অফ বিল (Round Off Bill)</Label>
            <p className="text-sm text-muted-foreground">বিলের টাকা রাউন্ড অফ করুন</p>
          </div>
          <Switch
            checked={localSettings.round_off}
            onCheckedChange={(val) => handleChange("round_off", val)}
          />
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={() => handleSave(["default_discount", "tax_rate", "currency_symbol", "round_off"])} disabled={isSaving || !hasChanges()} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            সংরক্ষণ করুন (Save)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
