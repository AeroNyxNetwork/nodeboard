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

// Official AeroNyx double-chevron mark. Embedded as an SVG data URI because Satori's
// inline-<svg> transform support is partial; <img> rasterizes it reliably.
const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
  '<g transform="translate(0,512) scale(0.1,-0.1)" fill="#7762F3" stroke="none">' +
  '<path d="M1277 3833 l-1277 -1278 0 -1275 0 -1275 1280 1280 1280 1280 -2 1273 -3 1272 -1278 -1277z"/>' +
  '<path d="M3838 3833 l-1278 -1278 0 -1275 0 -1275 1280 1280 1280 1280 -2 1273 -3 1272 -1277 -1277z"/>' +
  '</g></svg>';
const LOGO_DATA_URI =
  'data:image/svg+xml;base64,' + Buffer.from(LOGO_SVG).toString('base64');

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_DATA_URI} width={96} height={96} alt="" style={{ display: 'block' }} />
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
