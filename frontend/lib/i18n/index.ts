import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import en, { Translations } from './locales/en';
import fr from './locales/fr';
import zh from './locales/zh';

type Locale = 'en' | 'fr' | 'zh';

const locales: Record<Locale, Translations> = { en, fr, zh };

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'smartdepanneur-locale',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ locale: state.locale }),
    },
  ),
);

export function useT(): Translations {
  const locale = useI18nStore((s) => s.locale);
  return locales[locale];
}

export type { Locale, Translations };
