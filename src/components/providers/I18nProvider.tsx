'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useSettingsStore } from '@/stores/settings-store';
import { useEffect, useState } from 'react';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettingsStore();
  const [messages, setMessages] = useState<any>(null);

  useEffect(() => {
    // Dynamic import based on language
    import(`../../../messages/${settings.app_language}.json`)
      .then((mod) => {
        setMessages(mod.default);
      })
      .catch((err) => {
        console.error('Failed to load translations', err);
        // Fallback to English if fails
        import('../../../messages/en.json').then((mod) => setMessages(mod.default));
      });
  }, [settings.app_language]);

  // Optionally show a loading state while translations are loading
  if (!messages) {
    return null;
  }

  return (
    <NextIntlClientProvider locale={settings.app_language} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
