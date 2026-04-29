import { AppSettings } from "@/stores/settings-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Save, Moon, Sun, Monitor } from "lucide-react";

interface ThemeTabProps {
  localSettings: AppSettings;
  handleChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  handleSave: (sectionKeys: (keyof AppSettings)[]) => void;
  isSaving: boolean;
  hasChanges: () => boolean;
}

const PRESET_COLORS = [
  { color: "#16a34a", label: "সবুজ" },
  { color: "#2563eb", label: "নীল" },
  { color: "#9333ea", label: "বেগুনি" },
  { color: "#dc2626", label: "লাল" },
  { color: "#ea580c", label: "কমলা" },
  { color: "#0891b2", label: "সায়ান" },
  { color: "#db2777", label: "গোলাপি" },
  { color: "#64748b", label: "ধূসর" },
];

const THEME_MODES = [
  { value: "light", label: "হালকা", icon: Sun },
  { value: "dark", label: "গাঢ়", icon: Moon },
  { value: "system", label: "সিস্টেম", icon: Monitor },
];

export default function ThemeTab({ localSettings, handleChange, handleSave, isSaving, hasChanges }: ThemeTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>থিম সেটিংস</CardTitle>
        <CardDescription>অ্যাপের চেহারা কাস্টমাইজ করুন।</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme Mode */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">মোড (Mode)</Label>
          <div className="grid grid-cols-3 gap-3">
            {THEME_MODES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handleChange("theme_mode", value as "light" | "dark" | "system")}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  localSettings.theme_mode === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <Icon className={`w-5 h-5 ${localSettings.theme_mode === value ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-xs font-medium ${localSettings.theme_mode === value ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Primary Color */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">প্রাইমারি কালার</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(({ color, label }) => (
              <button
                key={color}
                title={label}
                onClick={() => handleChange("primary_color", color)}
                className={`w-8 h-8 rounded-full transition-all ${
                  localSettings.primary_color === color ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="color"
              value={localSettings.primary_color}
              onChange={(e) => handleChange("primary_color", e.target.value)}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <span className="text-sm font-mono text-muted-foreground">{localSettings.primary_color}</span>
            <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: localSettings.primary_color }} />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button onClick={() => handleSave(["theme_mode", "primary_color"])} disabled={isSaving || !hasChanges()} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            সংরক্ষণ করুন
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
