import { createSignal, onCleanup } from 'solid-js';
import * as Y from 'yjs';
import {
  getNotifications,
  getActiveNotifications,
  pruneNotifications,
  type NotificationEvent,
} from '../lib/notifications';

export function useNotifications(doc: Y.Doc, localPeerId: string) {
  const [notifications, setNotifications] = createSignal<NotificationEvent[]>([]);
  const dismissedIds = new Set<string>();

  const notifArray = getNotifications(doc);

  const update = () => {
    const active = getActiveNotifications(doc, localPeerId)
      .filter(n => !dismissedIds.has(n.id))
      .slice(-3); // max 3 visible
    setNotifications(active);
  };

  notifArray.observe(update);
  update();

  // Prune old entries and refresh active list periodically
  const pruneInterval = setInterval(() => {
    pruneNotifications(doc);
    update();
  }, 2000);

  onCleanup(() => {
    notifArray.unobserve(update);
    clearInterval(pruneInterval);
  });

  return {
    notifications,
    dismiss: (id: string) => {
      dismissedIds.add(id);
      update();
    },
    dismissAll: () => {
      notifications().forEach(n => dismissedIds.add(n.id));
      update();
    },
  };
}
