import type { H3Event } from "h3";
import QRCode from "qrcode";

// QR codes only carry the team's opaque `qrToken` (stored on the Team row) and
// are rendered on demand, so nothing but the token needs to be persisted.
export function renderQrCodeSvg(token: string) {
  return QRCode.toString(token, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
  });
}

export function sendQrCodeSvg(event: H3Event, token: string) {
  setResponseHeaders(event, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "private, no-store",
  });

  return renderQrCodeSvg(token);
}
