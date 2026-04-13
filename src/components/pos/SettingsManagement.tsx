"use client";

import { useEffect, useState } from "react";
import { useSettingsStore, AppSettings } from "@/stores/settings-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Store, Printer, Database, Palette, Users, Globe, Receipt } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/providers/ThemeProvider";

import ProfileTab from "./settings/ProfileTab";
import PrinterTab from "./settings/PrinterTab";
import BackupTab from "./settings/BackupTab";
import ThemeTab from "./settings/ThemeTab";
import UsersTab from "./settings/UsersTab";
import LanguageTab from "./settings/LanguageTab";
import BillingTab from "./settings/BillingTab";

export default function SettingsManagement() {
  const { settings, fetchSettings, saveSettings } = useSettingsStore();
  const { toast } = useToast();
  const { data: session } = useSession();
  const { setTheme } = useTheme();

  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);

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
              <TabsContent value="profile" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <ProfileTab localSettings={localSettings} handleChange={handleChange} handleSave={handleSave} isSaving={isSaving} hasChanges={hasProfileChanges} />
              </TabsContent>
              <TabsContent value="printer" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <PrinterTab localSettings={localSettings} handleChange={handleChange} handleSave={handleSave} isSaving={isSaving} hasChanges={hasPrinterChanges} />
              </TabsContent>
              <TabsContent value="backup" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <BackupTab />
              </TabsContent>
              <TabsContent value="theme" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <ThemeTab localSettings={localSettings} handleChange={handleChange} handleSave={handleSave} isSaving={isSaving} hasChanges={hasThemeChanges} />
              </TabsContent>
              <TabsContent value="users" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <UsersTab session={session} />
              </TabsContent>
              <TabsContent value="language" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <LanguageTab localSettings={localSettings} handleChange={handleChange} handleSave={handleSave} isSaving={isSaving} hasChanges={hasLanguageChanges} />
              </TabsContent>
              <TabsContent value="billing" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <BillingTab localSettings={localSettings} handleChange={handleChange} handleSave={handleSave} isSaving={isSaving} hasChanges={hasBillingChanges} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
