/**
 * ============================================================================
 * AeroNyx Channel Universal Link fallback
 * ============================================================================
 * Route:
 *   /i/channel/{slug}
 *   /i/channel/{slug}/post/{uuidv7}
 *
 * [CHANNEL-WEB-FALLBACK 2026-07-29 by Codex]
 * Installed apps claim these Universal/App Links before this route renders.
 * Browsers use this server component as a bounded public preview and an
 * explicit open/install handoff. The page never treats backend projections as
 * client-side signature verification; AeroNyx verifies signed history after
 * the app opens.
 * ============================================================================
 */

import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ChannelShareView, {
  type ChannelShareChannel,
  type ChannelSharePostState,
} from './ChannelShareView';

const DEFAULT_API_ORIGIN = 'https://api.aeronyx.network';
const API_TIMEOUT_MS = 4_000;

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_]{1,30}[a-z0-9])?$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type RouteParams = {
  slug: string;
  rest?: string[];
};

type ChannelRoute = {
  slug: string;
  postId?: string;
};

type ChannelState = 'available' | 'missing' | 'unavailable';

type ChannelLookup = {
  state: ChannelState;
  channel?: ChannelShareChannel & { channelId: string };
};

type ShareData = {
  channelState: ChannelState;
  channel?: ChannelShareChannel;
  postState?: ChannelSharePostState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function apiOrigin(): string {
  const configured = process.env.AERONYX_API_ORIGIN?.trim();
  if (!configured) return DEFAULT_API_ORIGIN;
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
      return DEFAULT_API_ORIGIN;
    }
    return parsed.origin;
  } catch {
    return DEFAULT_API_ORIGIN;
  }
}

function parseRoute(params: RouteParams): ChannelRoute | null {
  const slug = params.slug.trim();
  if (!SLUG_PATTERN.test(slug)) return null;

  const rest = params.rest ?? [];
  if (rest.length === 0) return { slug };
  if (
    rest.length === 2 &&
    rest[0] === 'post' &&
    UUID_V7_PATTERN.test(rest[1])
  ) {
    return { slug, postId: rest[1] };
  }
  return null;
}

function parseChannel(value: unknown, expectedSlug: string) {
  if (!isRecord(value)) return null;
  const channelId = value.channel_id;
  const slug = value.slug;
  const title = value.title;
  const description = value.description;
  const avatarBlobId = value.avatar_blob_id;
  const subscriberCount = value.subscriber_count;

  if (
    typeof channelId !== 'string' ||
    !UUID_V7_PATTERN.test(channelId) ||
    slug !== expectedSlug ||
    typeof title !== 'string' ||
    title.trim() !== title ||
    title.length < 1 ||
    title.length > 120 ||
    typeof description !== 'string' ||
    description.trim() !== description ||
    description.length > 2_000 ||
    value.visibility !== 'public' ||
    value.state !== 'active' ||
    !Number.isSafeInteger(subscriberCount) ||
    (subscriberCount as number) < 0 ||
    (avatarBlobId !== null &&
      avatarBlobId !== undefined &&
      (typeof avatarBlobId !== 'string' ||
        !UUID_PATTERN.test(avatarBlobId)))
  ) {
    return null;
  }

  return {
    channelId,
    slug,
    title,
    description,
    subscriberCount: subscriberCount as number,
    avatarUrl:
      typeof avatarBlobId === 'string'
        ? `${apiOrigin()}/api/channels/avatar/${avatarBlobId}/`
        : undefined,
  };
}

async function fetchChannel(slug: string): Promise<ChannelLookup> {
  try {
    const response = await fetch(
      `${apiOrigin()}/api/channels/by-slug/${encodeURIComponent(slug)}/`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
        next: { revalidate: 60 },
      }
    );
    if (response.status === 404) return { state: 'missing' };
    if (!response.ok) return { state: 'unavailable' };

    const body: unknown = await response.json();
    const channel = isRecord(body)
      ? parseChannel(body.channel, slug)
      : null;
    return channel
      ? { state: 'available', channel }
      : { state: 'unavailable' };
  } catch {
    return { state: 'unavailable' };
  }
}

async function fetchPostState(
  channelId: string,
  postId: string
): Promise<ChannelSharePostState> {
  try {
    const response = await fetch(
      `${apiOrigin()}/api/channels/${channelId}/posts/${postId}/`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
        next: { revalidate: 30 },
      }
    );
    if (response.status === 404) return 'missing';
    if (!response.ok) return 'unavailable';

    const body: unknown = await response.json();
    const post = isRecord(body) && isRecord(body.post) ? body.post : null;
    if (
      post === null ||
      post.channel_id !== channelId ||
      post.post_id !== postId ||
      post.signature_state !== 'verified' ||
      typeof post.deleted !== 'boolean'
    ) {
      return 'unavailable';
    }
    return post.deleted ? 'missing' : 'available';
  } catch {
    return 'unavailable';
  }
}

const loadShareData = cache(
  async (slug: string, postId?: string): Promise<ShareData> => {
    const lookup = await fetchChannel(slug);
    if (lookup.state !== 'available' || !lookup.channel) {
      return { channelState: lookup.state };
    }

    const { channelId, ...channel } = lookup.channel;
    return {
      channelState: 'available',
      channel,
      postState: postId
        ? await fetchPostState(channelId, postId)
        : undefined,
    };
  }
);

function canonicalUrl(route: ChannelRoute): string {
  const postPath = route.postId ? `/post/${route.postId}` : '';
  return `https://app.aeronyx.network/i/channel/${route.slug}${postPath}`;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const route = parseRoute(await params);
  if (!route) {
    return {
      title: 'AeroNyx Channel',
      robots: { index: false, follow: false },
    };
  }

  const data = await loadShareData(route.slug, route.postId);
  const channelTitle = data.channel?.title;
  const title = channelTitle
    ? route.postId
      ? `Post from ${channelTitle}`
      : channelTitle
    : 'AeroNyx Channel';
  const description =
    data.channel?.description ||
    'Open this public channel in AeroNyx to verify its signed history and read the latest posts.';
  const url = canonicalUrl(route);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: {
      index: data.channelState === 'available',
      follow: data.channelState === 'available',
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'AeroNyx',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function ChannelSharePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const route = parseRoute(await params);
  if (!route) notFound();

  const data = await loadShareData(route.slug, route.postId);
  return (
    <ChannelShareView
      slug={route.slug}
      postId={route.postId}
      channelState={data.channelState}
      channel={data.channel}
      postState={data.postState}
    />
  );
}
