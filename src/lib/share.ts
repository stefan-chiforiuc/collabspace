import qrcode from 'qrcode-generator';
import type { TurnServerConfig } from './turn-config';

export function getShareUrl(roomCode: string, turnServers?: TurnServerConfig[]): string {
  let hash = `#/room/${roomCode}`;
  if (turnServers && turnServers.length > 0) {
    // Serialize TURN credentials into the URL (base64 in hash fragment — never sent to server)
    const serialized = turnServers.map(s => ({
      urls: Array.isArray(s.urls) ? s.urls : [s.urls],
      username: s.username,
      credential: s.credential,
    }));
    const turnParam = btoa(JSON.stringify(serialized));
    hash += `?turn=${turnParam}`;
  }
  return `${window.location.origin}${window.location.pathname}${hash}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function canUseWebShareAPI(): boolean {
  return typeof navigator.share === 'function';
}

export async function shareViaWebAPI(roomCode: string, turnServers?: TurnServerConfig[]): Promise<boolean> {
  try {
    await navigator.share({
      title: 'Join my CollabSpace room',
      text: `Join my collaboration room: ${roomCode}`,
      url: getShareUrl(roomCode, turnServers),
    });
    return true;
  } catch {
    return false;
  }
}

export function getWhatsAppShareUrl(roomCode: string, turnServers?: TurnServerConfig[]): string {
  const url = getShareUrl(roomCode, turnServers);
  return `https://wa.me/?text=${encodeURIComponent(`Join my CollabSpace room: ${url}`)}`;
}

export function generateQRCodeSVG(text: string, cellSize: number = 4): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize, margin: 2 });
}
