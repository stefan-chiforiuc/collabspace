import { createSignal, For, Show } from 'solid-js';
import type { Poll, PollType } from '../lib/types';
import { getPollResults } from '../lib/polls';
import Button from './ui/Button';
import Card from './ui/Card';

interface PollPanelProps {
  polls: Poll[];
  localPeerId: string;
  onCreatePoll: (question: string, options: string[], type: PollType) => void;
  onVote: (pollId: string, choice: number | number[]) => void;
  onClose: (pollId: string) => void;
}

export default function PollPanel(props: PollPanelProps) {
  const [creating, setCreating] = createSignal(false);
  const [question, setQuestion] = createSignal('');
  const [options, setOptions] = createSignal(['', '']);
  const [pollType, setPollType] = createSignal<PollType>('single');

  const addOption = () => {
    if (options().length < 10) setOptions([...options(), '']);
  };

  const removeOption = (index: number) => {
    if (options().length > 2) setOptions(options().filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    setOptions(options().map((o, i) => (i === index ? value : o)));
  };

  const handleCreate = () => {
    const q = question().trim();
    const opts = options().map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) return;

    props.onCreatePoll(q, opts, pollType());
    setCreating(false);
    setQuestion('');
    setOptions(['', '']);
    setPollType('single');
  };

  return (
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between p-4 border-b border-surface-700">
        <h2 class="text-sm font-semibold text-surface-200">Polls</h2>
        <Button size="sm" onClick={() => setCreating(!creating())}>
          {creating() ? 'Cancel' : '+ New Poll'}
        </Button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Create form */}
        <Show when={creating()}>
          <Card class="p-4 space-y-3">
            <input
              type="text"
              placeholder="Ask a question..."
              value={question()}
              onInput={(e) => setQuestion(e.currentTarget.value)}
              class="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            <div class="space-y-2">
              <For each={options()}>
                {(opt, i) => (
                  <div class="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Option ${i() + 1}`}
                      value={opt}
                      onInput={(e) => updateOption(i(), e.currentTarget.value)}
                      class="flex-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <Show when={options().length > 2}>
                      <button
                        onClick={() => removeOption(i())}
                        class="text-surface-500 hover:text-error text-sm px-1 cursor-pointer"
                      >
                        x
                      </button>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={options().length < 10}>
                <button
                  onClick={addOption}
                  class="text-sm text-primary-400 hover:text-primary-300 cursor-pointer"
                >
                  + Add option
                </button>
              </Show>
            </div>

            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
                <input
                  type="radio"
                  name="pollType"
                  checked={pollType() === 'single'}
                  onChange={() => setPollType('single')}
                  class="accent-primary-500"
                />
                Single choice
              </label>
              <label class="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
                <input
                  type="radio"
                  name="pollType"
                  checked={pollType() === 'multi'}
                  onChange={() => setPollType('multi')}
                  class="accent-primary-500"
                />
                Multi choice
              </label>
            </div>

            <Button size="sm" onClick={handleCreate} disabled={!question().trim() || options().filter((o) => o.trim()).length < 2}>
              Create Poll
            </Button>
          </Card>
        </Show>

        {/* Poll list */}
        <Show when={props.polls.length === 0 && !creating()}>
          <p class="text-center text-surface-500 text-sm mt-8">No polls yet. Create one!</p>
        </Show>

        <For each={props.polls}>
          {(poll) => (
            <PollCard
              poll={poll}
              localPeerId={props.localPeerId}
              onVote={props.onVote}
              onClose={props.onClose}
            />
          )}
        </For>
      </div>
    </div>
  );
}

function PollCard(props: {
  poll: Poll;
  localPeerId: string;
  onVote: (pollId: string, choice: number | number[]) => void;
  onClose: (pollId: string) => void;
}) {
  const [multiSelections, setMultiSelections] = createSignal<number[]>([]);

  const results = () => getPollResults(props.poll);
  const hasVoted = () => props.localPeerId in props.poll.votes;
  const totalVotes = () => Object.keys(props.poll.votes).length;

  const handleSingleVote = (index: number) => {
    if (hasVoted() || props.poll.closed) return;
    props.onVote(props.poll.id, index);
  };

  const toggleMulti = (index: number) => {
    if (hasVoted() || props.poll.closed) return;
    const sel = multiSelections();
    setMultiSelections(sel.includes(index) ? sel.filter((i) => i !== index) : [...sel, index]);
  };

  const submitMulti = () => {
    if (multiSelections().length === 0) return;
    props.onVote(props.poll.id, multiSelections());
    setMultiSelections([]);
  };

  return (
    <Card class="p-4 space-y-3">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-sm font-medium text-surface-100">{props.poll.question}</p>
          <p class="text-xs text-surface-500">
            by {props.poll.createdByName} · {props.poll.type} choice · {totalVotes()} vote{totalVotes() !== 1 ? 's' : ''}
            {props.poll.closed ? ' · Closed' : ''}
          </p>
        </div>
        <Show when={!props.poll.closed}>
          <button
            onClick={() => props.onClose(props.poll.id)}
            class="text-xs text-surface-500 hover:text-warning cursor-pointer shrink-0"
          >
            Close
          </button>
        </Show>
      </div>

      <div class="space-y-2">
        <For each={results()}>
          {(r, i) => (
            <div>
              <Show when={!hasVoted() && !props.poll.closed && props.poll.type === 'single'}>
                <button
                  onClick={() => handleSingleVote(i())}
                  class="w-full text-left px-3 py-2 rounded-lg bg-surface-700/50 hover:bg-surface-600/50 text-sm text-surface-200 transition-colors cursor-pointer"
                >
                  {r.option}
                </button>
              </Show>

              <Show when={!hasVoted() && !props.poll.closed && props.poll.type === 'multi'}>
                <label class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-700/50 hover:bg-surface-600/50 text-sm text-surface-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={multiSelections().includes(i())}
                    onChange={() => toggleMulti(i())}
                    class="accent-primary-500"
                  />
                  {r.option}
                </label>
              </Show>

              <Show when={hasVoted() || props.poll.closed}>
                <div class="space-y-1">
                  <div class="flex justify-between text-sm">
                    <span class="text-surface-300">{r.option}</span>
                    <span class="text-surface-500">{r.count} ({r.percentage}%)</span>
                  </div>
                  <div class="h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-primary-500 rounded-full transition-all duration-500"
                      style={{ width: `${r.percentage}%` }}
                    />
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      <Show when={!hasVoted() && !props.poll.closed && props.poll.type === 'multi'}>
        <Button size="sm" onClick={submitMulti} disabled={multiSelections().length === 0}>
          Submit Vote
        </Button>
      </Show>
    </Card>
  );
}
