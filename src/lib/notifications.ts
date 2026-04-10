import * as Y from 'yjs';

export type NotificationType =
  | 'poker_started'
  | 'poll_created'
  | 'timer_started'
  | 'media_started'
  | 'chat_message';

export interface NotificationEvent {
  id: string;
  type: NotificationType;
  fromPeerId: string;
  fromPeerName: string;
  message: string;
  targetTab?: string;
  timestamp: number;
}

export const NOTIFICATION_DISPLAY_MS = 8000;
const NOTIFICATION_PRUNE_MS = 15000;

let chatThrottleTs = 0;
const CHAT_THROTTLE_MS = 5000;

export function getNotifications(doc: Y.Doc): Y.Array<NotificationEvent> {
  return doc.getArray<NotificationEvent>('notifications');
}

export function dispatchNotification(
  doc: Y.Doc,
  type: NotificationType,
  fromPeerId: string,
  fromPeerName: string,
  message: string,
  targetTab?: string,
): void {
  if (type === 'chat_message') {
    const now = Date.now();
    if (now - chatThrottleTs < CHAT_THROTTLE_MS) return;
    chatThrottleTs = now;
  }
  const arr = getNotifications(doc);
  arr.push([{
    id: `${fromPeerId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    fromPeerId,
    fromPeerName,
    message,
    targetTab,
    timestamp: Date.now(),
  }]);
}

export function getActiveNotifications(
  doc: Y.Doc,
  localPeerId: string,
): NotificationEvent[] {
  const arr = getNotifications(doc);
  const now = Date.now();
  const result: NotificationEvent[] = [];
  for (let i = 0; i < arr.length; i++) {
    const evt = arr.get(i);
    if (evt.fromPeerId !== localPeerId && now - evt.timestamp < NOTIFICATION_DISPLAY_MS) {
      result.push(evt);
    }
  }
  return result;
}

export function pruneNotifications(doc: Y.Doc): void {
  const arr = getNotifications(doc);
  const now = Date.now();
  doc.transact(() => {
    let i = 0;
    while (i < arr.length) {
      const evt = arr.get(i);
      if (now - evt.timestamp > NOTIFICATION_PRUNE_MS) {
        arr.delete(i, 1);
      } else {
        i++;
      }
    }
  });
}

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  poker_started: '\uD83C\uDCCF',
  poll_created: '\uD83D\uDCCA',
  timer_started: '\u23F1\uFE0F',
  media_started: '\uD83C\uDFA4',
  chat_message: '\uD83D\uDCAC',
};

export const NOTIFICATION_ACTIONS: Record<NotificationType, string> = {
  poker_started: 'Go to Poker',
  poll_created: 'Go to Polls',
  timer_started: 'Go to Timer',
  media_started: 'Join Call',
  chat_message: 'Go to Chat',
};
