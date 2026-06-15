/**
 * ============================================
 * AeroNyx Language Selector
 * ============================================
 * File Path: components/common/LanguageSelector.tsx
 *
 * Main Functionality:
 *   Shared dashboard language selector backed by lib/i18n/I18nProvider.tsx.
 *
 * Consumers:
 *   - components/dashboard/Sidebar.tsx
 *   - app/dashboard/settings/page.tsx
 *
 * Last Modified: v1.0.0 - Initial language selector
 * ============================================
 */

'use client';

import React from 'react';
import { Locale } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface LanguageSelectorProps {
  compact?: boolean;
  showHelper?: boolean;
  className?: string;
  onChange?: (locale: Locale) => void;
}

export default function LanguageSelector({
  compact = false,
  showHelper = false,
  className = '',
  onChange,
}: LanguageSelectorProps) {
  const { locale, setLocale, languages, t } = useI18n();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = event.target.value as Locale;
    setLocale(nextLocale);
    onChange?.(nextLocale);
  };

  return (
    <label className={`block ${className}`}>
      {!compact && (
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
          {t('language.label')}
        </span>
      )}
      <select
        value={locale}
        onChange={handleChange}
        aria-label={t('language.label')}
        className={`
          w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2
          text-sm text-white outline-none transition
          hover:border-white/20 focus:border-purple-400/50 focus:ring-2 focus:ring-purple-500/20
          ${compact ? 'py-1.5 text-xs' : ''}
        `}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code} className="bg-[#0D0D12] text-white">
            {language.nativeLabel}
          </option>
        ))}
      </select>
      {showHelper && (
        <span className="mt-2 block text-xs leading-5 text-gray-500">
          {t('language.helper')}
        </span>
      )}
    </label>
  );
}
