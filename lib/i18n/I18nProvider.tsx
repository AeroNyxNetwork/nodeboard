/**
 * ============================================
 * AeroNyx Nodeboard i18n Provider
 * ============================================
 * File Path: lib/i18n/I18nProvider.tsx
 *
 * Main Functionality:
 *   - Client-side language provider for nodeboard
 *   - localStorage persistence
 *   - Browser-language fallback
 *   - Number, date/time, and relative-time formatting helpers
 *
 * Integration:
 *   - app/providers.tsx wraps the app with I18nProvider
 *   - Client components call useI18n()
 *
 * Last Modified: v1.0.0 - Initial provider
 * ============================================
 */

'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  LANGUAGE_OPTIONS,
  LOCALE_STORAGE_KEY,
  Locale,
  normalizeLocale,
  translate,
} from './index';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  languages: typeof LANGUAGE_OPTIONS;
  t: (key: string, values?: Record<string, string | number>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDateTime: (value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (value: string | number | Date | null | undefined) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function initialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) return normalizeLocale(stored);
  return normalizeLocale(window.navigator.language);
}

function toDate(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const nextLocale = initialLocale();
    setLocaleState(nextLocale);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale, ready]);

  const value = useMemo<I18nContextValue>(() => {
    const setLocale = (nextLocale: Locale) => setLocaleState(nextLocale);
    const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
    const formatNumber = (input: number, options?: Intl.NumberFormatOptions) => (
      new Intl.NumberFormat(locale, options).format(input)
    );
    const formatDateTime = (
      input: string | number | Date | null | undefined,
      options?: Intl.DateTimeFormatOptions
    ) => {
      const date = toDate(input);
      if (!date) return t('common.status.pending');
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        ...options,
      }).format(date);
    };
    const formatRelativeTime = (input: string | number | Date | null | undefined) => {
      const date = toDate(input);
      if (!date) return t('common.status.pending');
      const seconds = Math.round((date.getTime() - Date.now()) / 1000);
      const abs = Math.abs(seconds);
      const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      if (abs < 60) return formatter.format(seconds, 'second');
      const minutes = Math.round(seconds / 60);
      if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
      const hours = Math.round(minutes / 60);
      if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
      const days = Math.round(hours / 24);
      if (Math.abs(days) < 30) return formatter.format(days, 'day');
      const months = Math.round(days / 30);
      if (Math.abs(months) < 12) return formatter.format(months, 'month');
      return formatter.format(Math.round(months / 12), 'year');
    };

    return {
      locale,
      setLocale,
      languages: LANGUAGE_OPTIONS,
      t,
      formatNumber,
      formatDateTime,
      formatRelativeTime,
    };
  }, [locale]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}
