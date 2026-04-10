import { createSignal, onCleanup } from 'solid-js';
import * as Y from 'yjs';
import { getPolls } from '../lib/yjs-doc';
import { createPoll, votePoll, closePoll, getPollList, getPollResults } from '../lib/polls';
import { dispatchNotification } from '../lib/notifications';
import type { Poll, PollType } from '../lib/types';

export function usePolls(doc: Y.Doc, localPeerId: string, localName: string) {
  const [polls, setPolls] = createSignal<Poll[]>([]);

  const pollsMap = getPolls(doc);

  const update = () => {
    setPolls(getPollList(doc));
  };

  pollsMap.observe(update);
  update();

  onCleanup(() => pollsMap.unobserve(update));

  return {
    polls,
    createPoll: (question: string, options: string[], type: PollType) => {
      const pollId = createPoll(doc, question, options, type, localPeerId, localName);
      dispatchNotification(doc, 'poll_created', localPeerId, localName, `${localName} created a poll`, 'polls');
      return pollId;
    },
    vote: (pollId: string, choice: number | number[]) => {
      votePoll(doc, pollId, localPeerId, choice);
    },
    close: (pollId: string) => {
      closePoll(doc, pollId, localPeerId);
    },
    getResults: getPollResults,
  };
}
