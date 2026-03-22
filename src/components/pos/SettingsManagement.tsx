"use client";

import { useEffect, useRef, useState } from "react";
import { useSettingsStore, AppSettings } from "@/stores/settings-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Store, Printer, Database, Palette, Users, Globe, Receipt, Download, Upload, Loader2, Save, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SettingsManagement() {
  const { settings, fetchSettings, saveSettings } = useSettingsStore();
  const { toast } = useToast();
  const { data: session } = useSession();
  const { setTheme, theme } = useTheme();

  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackuping, setIsBackuping] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Password state
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (sectionKeys: (keyof AppSettings)[]) => {
    setIsSaving(true);
    try {
      const payload: any = {};
      sectionKeys.forEach(key => {
        payload[key] = localSettings[key];
      });

      const success = await saveSettings(payload as Partial<AppSettings>);
      if (success) {
        toast({ title: "Success", description: "Settings saved successfully." });

        // Special logic for theme saving
        if (sectionKeys.includes("theme_mode")) {
          setTheme(localSettings.theme_mode);
        }

        // Special logic for language saving
        if (sectionKeys.includes("app_language")) {
          setTimeout(() => window.location.reload(), 500);
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: "Failed to save settings." });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Change detection helpers for each section
  const hasProfileChanges = (): boolean => {
    return localSettings.store_name !== settings.store_name ||
           localSettings.store_name_bn !== settings.store_name_bn ||
           localSettings.store_address !== settings.store_address ||
           localSettings.store_phone !== settings.store_phone ||
           localSettings.store_gst !== settings.store_gst;
  };

  const hasPrinterChanges = (): boolean => {
    return localSettings.print_paper_size !== settings.print_paper_size ||
           localSettings.print_font_size !== settings.print_font_size ||
           localSettings.print_header !== settings.print_header ||
           localSettings.print_footer !== settings.print_footer ||
           localSettings.auto_print !== settings.auto_print;
  };

  const hasThemeChanges = (): boolean => {
    return localSettings.theme_mode !== settings.theme_mode ||
           localSettings.primary_color !== settings.primary_color;
  };

  const hasLanguageChanges = (): boolean => {
    return localSettings.app_language !== settings.app_language ||
           localSettings.receipt_language !== settings.receipt_language;
  };

  const hasBillingChanges = (): boolean => {
    return localSettings.default_discount !== settings.default_discount ||
           localSettings.tax_rate !== settings.tax_rate ||
           localSettings.currency_symbol !== settings.currency_symbol ||
           localSettings.round_off !== settings.round_off;
  };

  // ---------------------------------------------------------------------------
  // Backup & Restore Logic
  // ---------------------------------------------------------------------------
  const handleBackup = async () => {
    setIsBackuping(true);
    try {
      const response = await fetch('/api/backup');
      const data = await response.json();

      if (data.error) throw new Error(data.error);

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lakhan-bhandar-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({ title: "Backup Successful", description: "Your data has been downloaded." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Backup Failed", description: error.message });
    } finally {
      setIsBackuping(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRestoreClick = () => {
    if (confirm("সতর্কতা: রিস্টোর করলে বর্তমান ডাটা মুছে যাবে! আপনি কি নিশ্চিত? (Warning: Restoring will overwrite existing data! Are you sure?)")) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast({ variant: "destructive", title: "Invalid File", description: "Please upload a valid JSON backup file." });
      return;
    }

    setIsRestoring(true);
    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupData),
      });

      const data = await response.json();
      if (data.success) {
        toast({ title: "Restore Successful", description: "Database restored successfully. Please reload the app." });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        throw new Error(data.error || "Failed to restore");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Restore Failed", description: error.message });
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---------------------------------------------------------------------------
  // Password Change Logic
  // ---------------------------------------------------------------------------
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast({ variant: "destructive", title: "Error", description: "New passwords do not match." });
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({ title: "Success", description: "Password updated successfully." });
        setPasswords({ current: "", new: "", confirm: "" });
      } else {
        throw new Error(data.error || "Failed to update password");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="shrink-0 border-b bg-background p-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Store className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Settings / সেটিংস</h1>
          <p className="text-sm text-muted-foreground">Configure your store preferences</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-6">
            <TabsList className="flex flex-row md:flex-col h-auto w-full md:w-64 bg-transparent p-0 justify-start md:items-start overflow-x-auto no-scrollbar border-b md:border-b-0 md:border-r border-border pb-2 md:pb-0 md:pr-4 shrink-0 md:sticky md:top-0 md:h-fit md:max-h-screen md:overflow-y-auto">
              <TabsTrigger value="profile" className="md:w-full justify-start text-left gap-2 px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:bg-blue-100 dark:hover:bg-gray-700 dark:data-[state=active]:bg-blue-500 whitespace-nowrap">
                <Store className="w-4 h-4" /> স্টোর প্রোফাইল (Profile)
              </TabsTrigger>
              <TabsTrigger value="printer" className="md:w-full justify-start text-left gap-2 px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:bg-blue-100 dark:hover:bg-gray-700 dark:data-[state=active]:bg-blue-500 whitespace-nowrap">
                <Printer className="w-4 h-4" /> প্রিন্টার সেটিংস (Printer)
              </TabsTrigger>
              <TabsTrigger value="backup" className="md:w-full justify-start text-left gap-2 px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:bg-blue-100 dark:hover:bg-gray-700 dark:data-[state=active]:bg-blue-500 whitespace-nowrap">
                <Database className="w-4 h-4" /> ডাটা ব্যাকআপ (Backup)
              </TabsTrigger>
              <TabsTrigger value="theme" className="md:w-full justify-start text-left gap-2 px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:bg-blue-100 dark:hover:bg-gray-700 dark:data-[state=active]:bg-blue-500 whitespace-nowrap">
                <Palette className="w-4 h-4" /> থিম সেটিংস (Theme)
              </TabsTrigger>
              <TabsTrigger value="users" className="md:w-full justify-start text-left gap-2 px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:bg-blue-100 dark:hover:bg-gray-700 dark:data-[state=active]:bg-blue-500 whitespace-nowrap">
                <Users className="w-4 h-4" /> ইউজার (Users)
              </TabsTrigger>
              <TabsTrigger value="language" className="md:w-full justify-start text-left gap-2 px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:bg-blue-100 dark:hover:bg-gray-700 dark:data-[state=active]:bg-blue-500 whitespace-nowrap">
                <Globe className="w-4 h-4" /> ভাষা (Language)
              </TabsTrigger>
              <TabsTrigger value="billing" className="md:w-full justify-start text-left gap-2 px-3 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:bg-blue-100 dark:hover:bg-gray-700 dark:data-[state=active]:bg-blue-500 whitespace-nowrap">
                <Receipt className="w-4 h-4" /> বিলিং (Billing)
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 min-w-0">
              {/* Section 1: Store Profile */}
              <TabsContent value="profile" className="m-0 focus-visible:outline-none focus-visible:ring-0">
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
                      <Button onClick={() => handleSave(["store_name", "store_name_bn", "store_address", "store_phone", "store_gst"])} disabled={isSaving || !hasProfileChanges()} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        সংরক্ষণ করুন (Save)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 2: Printer Settings */}
              <TabsContent value="printer" className="m-0 focus-visible:outline-none focus-visible:ring-0">
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
                      <Button onClick={() => handleSave(["print_paper_size", "print_font_size", "print_header", "print_footer", "auto_print"])} disabled={isSaving || !hasPrinterChanges()} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        সংরক্ষণ করুন (Save)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 3: Backup & Restore */}
              <TabsContent value="backup" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <Card>
                  <CardHeader>
                    <CardTitle>ডাটা ব্যাকআপ ও রিস্টোর (Backup & Restore)</CardTitle>
                    <CardDescription>Securely backup or restore all your database records.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Backup Card */}
                      <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
                        <div>
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Download className="w-5 h-5 text-primary" /> ব্যাকআপ (Backup)
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">আপনার সমস্ত ডাটা JSON ফাইলে এক্সপোর্ট করুন</p>
                        </div>
                        <Button className="w-full" onClick={handleBackup} disabled={isBackuping}>
                          {isBackuping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                          ব্যাকআপ ডাউনলোড করুন
                        </Button>
                      </div>

                      {/* Restore Card */}
                      <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
                        <div>
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Upload className="w-5 h-5 text-destructive" /> রিস্টোর (Restore)
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">পূর্ববর্তী ব্যাকআপ থেকে ডাটা রিস্টোর করুন</p>
                        </div>

                        <Alert variant="destructive" className="py-2">
                          <AlertDescription className="text-xs">
                            সতর্কতা: রিস্টোর করলে বর্তমান ডাটা মুছে যাবে!
                          </AlertDescription>
                        </Alert>

                        <input
                          type="file"
                          accept=".json"
                          className="hidden"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                        />
                        <Button variant="destructive" className="w-full" onClick={handleRestoreClick} disabled={isRestoring}>
                          {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          রিস্টোর করুন
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 4: Theme Settings */}
              <TabsContent value="theme" className="m-0 focus-visible:outline-none focus-visible:ring-0">
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
                      <Button onClick={() => handleSave(["theme_mode", "primary_color"])} disabled={isSaving || !hasThemeChanges()} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        সংরক্ষণ করুন (Save)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 5: User Management */}
              <TabsContent value="users" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <Card>
                  <CardHeader>
                    <CardTitle>ইউজার ম্যানেজমেন্ট (User Management)</CardTitle>
                    <CardDescription>Manage user credentials and authentication.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-muted/20">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Current User</p>
                          <h3 className="font-semibold text-lg">{session?.user?.name || (session?.user as { id?: string; role?: string; username?: string })?.username || "Admin"}</h3>
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => signOut()} className="gap-2">
                        <LogOut className="w-4 h-4" />
                        লগ আউট (Logout)
                      </Button>
                    </div>

                    <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md border rounded-lg p-4">
                      <h4 className="font-medium">পাসওয়ার্ড পরিবর্তন করুন (Change Password)</h4>

                      <div className="space-y-2">
                        <Label>বর্তমান পাসওয়ার্ড (Current Password)</Label>
                        <Input
                          type="password"
                          required
                          value={passwords.current}
                          onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>নতুন পাসওয়ার্ড (New Password)</Label>
                        <Input
                          type="password"
                          required
                          value={passwords.new}
                          onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>নতুন পাসওয়ার্ড নিশ্চিত করুন (Confirm New Password)</Label>
                        <Input
                          type="password"
                          required
                          value={passwords.confirm}
                          onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                        />
                      </div>

                      <Button type="submit" disabled={isChangingPassword || !passwords.current || !passwords.new || !passwords.confirm} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                        {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        পাসওয়ার্ড পরিবর্তন করুন
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 6: Language Settings */}
              <TabsContent value="language" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <Card>
                  <CardHeader>
                    <CardTitle>ভাষা সেটিংস (Language Settings)</CardTitle>
                    <CardDescription>Set app and receipt languages.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>অ্যাপের ভাষা (App Language)</Label>
                      <Select value={localSettings.app_language} onValueChange={(val) => handleChange("app_language", val as "en" | "bn")}>
                        <SelectTrigger className="w-full md:w-[300px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bn">বাংলা (Bengali)</SelectItem>
                          <SelectItem value="en">English (ইংরেজি)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>রিসিপ্টের ভাষা (Receipt Language)</Label>
                      <Select value={localSettings.receipt_language} onValueChange={(val) => handleChange("receipt_language", val as "en" | "bn")}>
                        <SelectTrigger className="w-full md:w-[300px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bn">বাংলা (Bengali)</SelectItem>
                          <SelectItem value="en">English (ইংরেজি)</SelectItem>
                          <SelectItem value="both">দুটোই (Both)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button onClick={() => handleSave(["app_language", "receipt_language"])} disabled={isSaving || !hasLanguageChanges()} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        সংরক্ষণ করুন (Save)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 7: Billing Settings */}
              <TabsContent value="billing" className="m-0 focus-visible:outline-none focus-visible:ring-0">
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
                      <Button onClick={() => handleSave(["default_discount", "tax_rate", "currency_symbol", "round_off"])} disabled={isSaving || !hasBillingChanges()} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        সংরক্ষণ করুন (Save)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
