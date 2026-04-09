import * as Y from 'yjs';
import { getPolls } from './yjs-doc';
import type { Poll, PollType } from './types';

export function createPoll(
  doc: Y.Doc,
  question: string,
  options: string[],
  type: PollType,
  createdBy: string,
  createdByName: string,
): string {
  const polls = getPolls(doc);
  const id = crypto.randomUUID();

  const poll: Poll = {
    id,
    question,
    options,
    type,
    votes: {},
    createdBy,
    createdByName,
    createdAt: Date.now(),
    closed: false,
  };

  polls.set(id, poll);
  return id;
}

export function votePoll(
  doc: Y.Doc,
  pollId: string,
  peerId: string,
  choice: number | number[],
): void {
  const polls = getPolls(doc);
  const poll = polls.get(pollId) as Poll | undefined;
  if (!poll || poll.closed) return;

  const updatedVotes = { ...poll.votes, [peerId]: choice };
  polls.set(pollId, { ...poll, votes: updatedVotes });
}

export function closePoll(
  doc: Y.Doc,
  pollId: string,
  closedBy: string,
): void {
  const polls = getPolls(doc);
  const poll = polls.get(pollId) as Poll | undefined;
  if (!poll || poll.closed) return;

  polls.set(pollId, { ...poll, closed: true, closedBy });
}

export function getPollList(doc: Y.Doc): Poll[] {
  const polls = getPolls(doc);
  const list: Poll[] = [];

  polls.forEach((value) => {
    list.push(value as Poll);
  });

  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function getPollResults(poll: Poll): { option: string; count: number; percentage: number }[] {
  const counts = new Array(poll.options.length).fill(0);
  const totalVoters = Object.keys(poll.votes).length;

  Object.values(poll.votes).forEach((choice) => {
    if (Array.isArray(choice)) {
      choice.forEach((i) => { if (i >= 0 && i < counts.length) counts[i]++; });
    } else {
      if (choice >= 0 && choice < counts.length) counts[choice]++;
    }
  });

  return poll.options.map((option, i) => ({
    option,
    count: counts[i],
    percentage: totalVoters > 0 ? Math.round((counts[i] / totalVoters) * 100) : 0,
  }));
}
