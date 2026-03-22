with open("src/components/pos/SettingsManagement.tsx", "r") as f:
    content = f.read()

old_save = """      const success = await saveSettings(payload as Partial<AppSettings>);
      if (success) {
        toast({ title: "Success", description: "Settings saved successfully." });

        // Special logic for theme saving
        if (sectionKeys.includes("theme_mode")) {
          setTheme(localSettings.theme_mode);
        }
      } else {"""

new_save = """      const success = await saveSettings(payload as Partial<AppSettings>);
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
      } else {"""

content = content.replace(old_save, new_save)

with open("src/components/pos/SettingsManagement.tsx", "w") as f:
    f.write(content)
