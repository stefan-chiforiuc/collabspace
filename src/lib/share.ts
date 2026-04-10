import qrcode from 'qrcode-generator';

export function getShareUrl(roomCode: string): string {
  return `${window.location.origin}${window.location.pathname}#/room/${roomCode}`;
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

export async function shareViaWebAPI(roomCode: string): Promise<boolean> {
  try {
    await navigator.share({
      title: 'Join my CollabSpace room',
      text: `Join my collaboration room: ${roomCode}`,
      url: getShareUrl(roomCode),
    });
    return true;
  } catch {
    return false;
  }
}

export function getWhatsAppShareUrl(roomCode: string): string {
  const url = getShareUrl(roomCode);
  return `https://wa.me/?text=${encodeURIComponent(`Join my CollabSpace room: ${url}`)}`;
}

export function generateQRCodeSVG(text: string, cellSize: number = 4): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize, margin: 2 });
}
