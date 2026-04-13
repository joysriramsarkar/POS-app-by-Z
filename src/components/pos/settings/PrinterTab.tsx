import { AppSettings } from "@/stores/settings-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Save } from "lucide-react";

interface PrinterTabProps {
  localSettings: AppSettings;
  handleChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  handleSave: (sectionKeys: (keyof AppSettings)[]) => void;
  isSaving: boolean;
  hasChanges: () => boolean;
}

export default function PrinterTab({ localSettings, handleChange, handleSave, isSaving, hasChanges }: PrinterTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>প্রিন্টার সেটিংস (Printer Settings)</CardTitle>
        <CardDescription>Configure receipt printing preferences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-base">ডিফল্ট পেপার সাইজ (Default Paper Size)</Label>
          <RadioGroup
            value={localSettings.print_paper_size}
            onValueChange={(val) => handleChange("print_paper_size", val as "58mm" | "80mm" | "A4" | "A5")}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="58mm" id="58mm" />
              <Label htmlFor="58mm">58mm (Thermal)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="80mm" id="80mm" />
              <Label htmlFor="80mm">80mm (Thermal)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="A4" id="A4" />
              <Label htmlFor="A4">A4</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="A5" id="A5" />
              <Label htmlFor="A5">A5</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>ফন্ট সাইজ (Font Size)</Label>
          <Select value={localSettings.print_font_size} onValueChange={(val) => handleChange("print_font_size", val as "small" | "medium" | "large")}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">ছোট (Small)</SelectItem>
              <SelectItem value="medium">মাঝারি (Medium)</SelectItem>
              <SelectItem value="large">বড় (Large)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>রিসিপ্ট হেডার (Receipt Header) - Max 100 chars</Label>
          <Textarea
            maxLength={100}
            placeholder="Custom header text for receipts"
            value={localSettings.print_header}
            onChange={(e) => handleChange("print_header", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>রিসিপ্ট ফুটার (Receipt Footer) - Max 100 chars</Label>
          <Textarea
            maxLength={100}
            placeholder="Thank you message, terms, etc."
            value={localSettings.print_footer}
            onChange={(e) => handleChange("print_footer", e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">অটো-প্রিন্ট (Auto-Print)</Label>
            <p className="text-sm text-muted-foreground">বিক্রয়ের পর অটোমেটিক প্রিন্ট করুন</p>
          </div>
          <Switch
            checked={localSettings.auto_print}
            onCheckedChange={(val) => handleChange("auto_print", val)}
          />
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={() => handleSave(["print_paper_size", "print_font_size", "print_header", "print_footer", "auto_print"])} disabled={isSaving || !hasChanges()} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            সংরক্ষণ করুন (Save)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
