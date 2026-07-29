/**
 * ============================================================================
 * AeroNyx Channel share fallback client view
 * ============================================================================
 *
 * [CHANNEL-WEB-FALLBACK 2026-07-29 by Codex]
 * Keeps browser-only language and custom-scheme behavior outside the server
 * data boundary. Opening AeroNyx is always user initiated so browsers without
 * the app do not show a scheme error during page load.
 * ============================================================================
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Logo from '@/components/common/Logo';

const APP_STORE_URL = 'https://apps.apple.com/app/id6736854944';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.amaterasu.aeronyx';
const PRODUCT_URL = 'https://aeronyx.network';

export type ChannelSharePostState =
  | 'available'
  | 'missing'
  | 'unavailable';

export type ChannelShareChannel = {
  slug: string;
  title: string;
  description: string;
  subscriberCount: number;
  avatarUrl?: string;
};

type Props = {
  slug: string;
  postId?: string;
  channelState: 'available' | 'missing' | 'unavailable';
  channel?: ChannelShareChannel;
  postState?: ChannelSharePostState;
};

const copy = {
  en: {
    channel: 'Public channel',
    sharedPost: 'Shared post',
    followers: 'followers',
    open: 'Open in AeroNyx',
    download: 'Get AeroNyx',
    availablePost: 'Open AeroNyx to verify and read this signed post.',
    missingTitle: 'Channel unavailable',
    missingBody:
      'This channel may have been removed, renamed, or made private.',
    missingPost: 'This shared post is no longer available.',
    offlineTitle: 'Unable to load channel',
    offlineBody:
      'The channel service is temporarily unavailable. You can still try opening the link in AeroNyx.',
    trust:
      'AeroNyx verifies the channel signed history inside the app before showing posts.',
  },
  zh: {
    channel: '公開頻道',
    sharedPost: '分享的貼文',
    followers: '位訂閱者',
    open: '在 AeroNyx 中打開',
    download: '取得 AeroNyx',
    availablePost: '在 AeroNyx 中驗證簽名歷史並閱讀這則貼文。',
    missingTitle: '頻道目前無法使用',
    missingBody: '這個頻道可能已刪除、更名或改為私人頻道。',
    missingPost: '這則分享的貼文已不存在。',
    offlineTitle: '暫時無法載入頻道',
    offlineBody:
      '頻道服務目前不可用，你仍可嘗試直接在 AeroNyx 中打開。',
    trust: 'AeroNyx 會在 App 內驗證頻道簽名歷史後再顯示貼文。',
  },
} as const;

function compactCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function ChannelShareView({
  slug,
  postId,
  channelState,
  channel,
  postState,
}: Props) {
  const [language, setLanguage] = useState<'en' | 'zh'>('en');

  useEffect(() => {
    const locale = navigator.language.toLowerCase();
    setLanguage(locale.startsWith('zh') ? 'zh' : 'en');
  }, []);

  const text = copy[language];
  const appLink = `aeronyx://channel/${slug}${
    postId ? `/post/${postId}` : ''
  }`;
  const downloadUrl = useMemo(() => {
    if (typeof navigator === 'undefined') return PRODUCT_URL;
    if (/android/i.test(navigator.userAgent)) return PLAY_STORE_URL;
    if (/iphone|ipad|ipod|macintosh/i.test(navigator.userAgent)) {
      return APP_STORE_URL;
    }
    return PRODUCT_URL;
  }, []);

  const unavailable = channelState !== 'available' || !channel;
  const title = unavailable
    ? channelState === 'missing'
      ? text.missingTitle
      : text.offlineTitle
    : channel.title;
  const body = unavailable
    ? channelState === 'missing'
      ? text.missingBody
      : text.offlineBody
    : channel.description;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center justify-between border-b border-white/10 pb-5">
        <Logo className="h-8 w-8" color="#7762F3" showText />
        <span className="text-xs font-semibold uppercase text-white/45">
          {text.channel}
        </span>
      </header>

      <section className="flex flex-1 flex-col justify-center py-10">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#14141D]">
          <div className="flex items-center gap-4 border-b border-white/10 p-5 sm:p-6">
            {channel?.avatarUrl ? (
              <img
                src={channel.avatarUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#28243D]"
              >
                <Logo className="h-7 w-7" color="#8C7BFF" />
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#9B8CFF]">
                @{slug}
              </p>
              <h1 className="mt-1 break-words text-xl font-semibold leading-7 text-white">
                {title}
              </h1>
              {channel ? (
                <p className="mt-1 text-sm text-white/50">
                  {compactCount(
                    channel.subscriberCount,
                    language === 'zh' ? 'zh-Hant' : 'en'
                  )}{' '}
                  {text.followers}
                </p>
              ) : null}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {body ? (
              <p className="whitespace-pre-line break-words text-[15px] leading-6 text-white/70">
                {body}
              </p>
            ) : null}

            {postId ? (
              <div className="mt-5 border-l-2 border-[#7762F3] pl-4">
                <p className="text-xs font-semibold uppercase text-[#9B8CFF]">
                  {text.sharedPost}
                </p>
                <p className="mt-1 text-sm leading-5 text-white/60">
                  {postState === 'missing' || channelState === 'missing'
                    ? text.missingPost
                    : text.availablePost}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <a
            href={appLink}
            className="flex h-12 items-center justify-center rounded-lg bg-[#7762F3] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#8877FF] focus:outline-none focus:ring-2 focus:ring-[#9B8CFF] focus:ring-offset-2 focus:ring-offset-[#0A0A0F]"
          >
            {text.open}
          </a>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-semibold text-white/85 transition-colors hover:border-white/30 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#0A0A0F]"
          >
            {text.download}
          </a>
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-white/40">
          {text.trust}
        </p>
      </section>
    </main>
  );
}
