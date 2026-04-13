import { AppSettings } from "@/stores/settings-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Save } from "lucide-react";

interface ThemeTabProps {
  localSettings: AppSettings;
  handleChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  handleSave: (sectionKeys: (keyof AppSettings)[]) => void;
  isSaving: boolean;
  hasChanges: () => boolean;
}

export default function ThemeTab({ localSettings, handleChange, handleSave, isSaving, hasChanges }: ThemeTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>থিম সেটিংস (Theme Settings)</CardTitle>
        <CardDescription>Customize the appearance of the application.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-base">মোড (Mode)</Label>
          <RadioGroup
            value={localSettings.theme_mode}
            onValueChange={(val) => handleChange("theme_mode", val as "light" | "dark" | "system")}
            className="flex flex-wrap gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="light" id="light" />
              <Label htmlFor="light">হালকা (Light)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dark" id="dark" />
              <Label htmlFor="dark">গাঢ় (Dark)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="system" id="system" />
              <Label htmlFor="system">সিস্টেম (System)</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>প্রাইমারি কালার (Primary Color)</Label>
          <div className="flex items-center gap-4">
            <Input
              type="color"
              value={localSettings.primary_color}
              onChange={(e) => handleChange("primary_color", e.target.value)}
              className="w-16 h-10 p-1 cursor-pointer"
            />
            <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{localSettings.primary_color}</span>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={() => handleSave(["theme_mode", "primary_color"])} disabled={isSaving || !hasChanges()} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            সংরক্ষণ করুন (Save)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
