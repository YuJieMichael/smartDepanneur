import { create } from 'zustand';
import en, { Translations } from './locales/en';
import fr from './locales/fr';
import zh from './locales/zh';

type Locale = 'en' | 'fr' | 'zh';

const locales: Record<Locale, Translations> = { en, fr, zh };

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: 'en',
  setLocale: (locale) => set({ locale }),
}));

export function useT(): Translations {
  const locale = useI18nStore((s) => s.locale);
  return locales[locale];
}

export type { Locale, Translations };
