import { AppSettings } from "@/stores/settings-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

interface ProfileTabProps {
  localSettings: AppSettings;
  handleChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  handleSave: (sectionKeys: (keyof AppSettings)[]) => void;
  isSaving: boolean;
  hasChanges: () => boolean;
}

export default function ProfileTab({ localSettings, handleChange, handleSave, isSaving, hasChanges }: ProfileTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>স্টোর প্রোফাইল (Store Profile)</CardTitle>
        <CardDescription>Manage your store details used in invoices and the app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>দোকানের নাম (ইংরেজি) / Store Name (English)</Label>
            <Input
              value={localSettings.store_name}
              onChange={(e) => handleChange("store_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>দোকানের নাম (বাংলা) / Store Name (Bengali)</Label>
            <Input
              value={localSettings.store_name_bn}
              onChange={(e) => handleChange("store_name_bn", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>ঠিকানা / Address</Label>
          <Textarea
            value={localSettings.store_address}
            onChange={(e) => handleChange("store_address", e.target.value)}
            rows={2}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>ফোন নম্বর / Phone Number</Label>
            <Input
              value={localSettings.store_phone}
              onChange={(e) => handleChange("store_phone", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>GST নম্বর / GST Number (Optional)</Label>
            <Input
              value={localSettings.store_gst}
              onChange={(e) => handleChange("store_gst", e.target.value)}
              placeholder="GSTIN number"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={() => handleSave(["store_name", "store_name_bn", "store_address", "store_phone", "store_gst"])} disabled={isSaving || !hasChanges()} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            সংরক্ষণ করুন (Save)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
