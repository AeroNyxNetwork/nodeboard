/**
 * ============================================
 * AeroNyx P2P Invite — OpenGraph preview image
 * ============================================
 * File Path: app/p2p/add/opengraph-image.tsx
 *
 * Creation Reason:
 *   Dynamically-rendered 1200x630 share card for /p2p/add links, so an invite shared
 *   into iMessage / WhatsApp / Telegram / WeChat shows a branded preview instead of a
 *   blank box. No static asset needed — rendered on demand via next/og ImageResponse.
 *   (Inviter name lives in the OG title from generateMetadata; the image is brand-generic
 *   because opengraph-image does not receive query params.)
 *
 * Last Modified: v1.0.0 — initial (Universal Links share preview)
 * ============================================
 */
import { ImageResponse } from 'next/og';

export const alt = 'AeroNyx — private invite';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0A0A0F',
          padding: '80px',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              background: 'linear-gradient(135deg, #7462F7, #9b8cff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 52,
              fontWeight: 800,
            }}
          >
            A
          </div>
          <div style={{ marginLeft: 28, fontSize: 40, fontWeight: 700 }}>AeroNyx</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.1 }}>
            You&rsquo;re invited to chat privately
          </div>
          <div style={{ fontSize: 34, color: 'rgba(255,255,255,0.65)', marginTop: 26 }}>
            End-to-end encrypted · No phone number, no email
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, color: '#14F195' }}>
          app.aeronyx.network
        </div>
      </div>
    ),
    { ...size },
  );
}
