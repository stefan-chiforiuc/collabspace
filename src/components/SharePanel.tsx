import { createSignal, Show } from 'solid-js';
import {
  getShareUrl,
  copyToClipboard,
  canUseWebShareAPI,
  shareViaWebAPI,
  getWhatsAppShareUrl,
  generateQRCodeSVG,
} from '../lib/share';
import type { TurnServerConfig } from '../lib/turn-config';

interface SharePanelProps {
  roomCode: string;
  turnServers?: TurnServerConfig[];
  onClose: () => void;
}

export default function SharePanel(props: SharePanelProps) {
  const [copied, setCopied] = createSignal(false);
  const hasTurn = () => (props.turnServers?.length ?? 0) > 0;
  // Include TURN credentials in the URL for best mobile experience
  const url = () => getShareUrl(props.roomCode, props.turnServers);
  const qrSvg = () => generateQRCodeSVG(url(), 4);

  const handleCopy = async () => {
    const ok = await copyToClipboard(url());
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    window.open(getWhatsAppShareUrl(props.roomCode, props.turnServers), '_blank');
  };

  const handleNativeShare = () => {
    shareViaWebAPI(props.roomCode, props.turnServers);
  };

  return (
    <div class="absolute top-12 right-2 z-30 w-72 sm:w-80 bg-surface-800/95 backdrop-blur-sm border border-surface-700 rounded-xl shadow-2xl animate-fade-in overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2.5 border-b border-surface-700">
        <span class="text-sm font-semibold text-surface-200">Share Room</span>
        <button
          onClick={props.onClose}
          class="w-7 h-7 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 cursor-pointer transition-colors"
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      {/* QR Code */}
      <div class="flex flex-col items-center px-4 py-4">
        <div
          class="bg-white rounded-lg p-2"
          innerHTML={qrSvg()}
        />
        <span class="font-mono text-xs text-surface-400 mt-2">{props.roomCode}</span>
        <Show when={hasTurn()}>
          <span class="text-[10px] text-purple-400 mt-1">Link includes TURN relay credentials</span>
        </Show>
      </div>

      {/* Actions */}
      <div class="px-3 pb-3 space-y-1.5">
        <button
          onClick={handleCopy}
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-surface-200 hover:bg-surface-700/50 transition-colors cursor-pointer"
        >
          <Show when={!copied()} fallback={
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" class="text-success shrink-0">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          }>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" class="text-surface-400 shrink-0">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
            </svg>
          </Show>
          {copied() ? 'Copied!' : 'Copy Link'}
        </button>

        <button
          onClick={handleWhatsApp}
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-surface-200 hover:bg-surface-700/50 transition-colors cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="text-green-500 shrink-0">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Share via WhatsApp
        </button>

        <Show when={canUseWebShareAPI()}>
          <button
            onClick={handleNativeShare}
            class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-surface-200 hover:bg-surface-700/50 transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" class="text-primary-400 shrink-0">
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
            </svg>
            Share...
          </button>
        </Show>
      </div>
    </div>
  );
}
