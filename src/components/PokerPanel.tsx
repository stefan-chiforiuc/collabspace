import { createSignal, For, Show } from 'solid-js';
import { CARD_SETS } from '../lib/types';
import type { CardSet, PokerRound } from '../lib/types';
import { calculatePokerResults } from '../lib/poker';
import type { Participant } from '../lib/types';
import Button from './ui/Button';
import Card from './ui/Card';

interface PokerPanelProps {
  state: PokerRound & { active: boolean };
  participants: Participant[];
  localPeerId: string;
  hasVoted: boolean;
  myVote: string | null;
  onStartRound: (topic: string, cardSet: CardSet) => void;
  onVote: (card: string) => void;
  onReveal: () => void;
  onReset: () => void;
}

export default function PokerPanel(props: PokerPanelProps) {
  const [topic, setTopic] = createSignal('');
  const [cardSet, setCardSet] = createSignal<CardSet>('fibonacci');

  const cards = () => CARD_SETS[props.state.cardSet] || CARD_SETS.fibonacci;
  const results = () => calculatePokerResults(props.state.votes);
  const voteCount = () => Object.keys(props.state.votes).length;
  const participantCount = () => props.participants.length;

  const handleStart = () => {
    const t = topic().trim() || 'Untitled';
    props.onStartRound(t, cardSet());
    setTopic('');
  };

  return (
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between p-4 border-b border-surface-700">
        <h2 class="text-sm font-semibold text-surface-200">Planning Poker</h2>
        <Show when={props.state.active}>
          <span class="text-xs text-surface-500">Round #{props.state.round}</span>
        </Show>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {/* No active round — start form */}
        <Show when={!props.state.active}>
          <Card class="p-4 space-y-3">
            <p class="text-sm text-surface-400">Start a new estimation round</p>
            <input
              type="text"
              placeholder="Topic (optional)"
              value={topic()}
              onInput={(e) => setTopic(e.currentTarget.value)}
              class="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <select
              value={cardSet()}
              onChange={(e) => setCardSet(e.currentTarget.value as CardSet)}
              class="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="fibonacci">Fibonacci (0, 1, 2, 3, 5, 8, 13, 21)</option>
              <option value="tshirt">T-Shirt (XS, S, M, L, XL, XXL)</option>
              <option value="powers">Powers of 2 (0, 1, 2, 4, 8, 16, 32, 64)</option>
            </select>
            <Button onClick={handleStart}>Start Round</Button>
          </Card>
        </Show>

        {/* Active round */}
        <Show when={props.state.active}>
          {/* Topic */}
          <Card class="p-4">
            <p class="text-xs text-surface-500 uppercase tracking-wide">Topic</p>
            <p class="text-sm text-surface-100 font-medium mt-1">{props.state.topic}</p>
          </Card>

          {/* Voting status */}
          <Card class="p-4 space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-xs text-surface-500">
                {voteCount()}/{participantCount()} voted
              </p>
              <Show when={!props.state.revealed}>
                <Button size="sm" variant="secondary" onClick={props.onReveal}>
                  Reveal
                </Button>
              </Show>
              <Show when={props.state.revealed}>
                <Button size="sm" variant="secondary" onClick={props.onReset}>
                  New Round
                </Button>
              </Show>
            </div>

            {/* Participant vote status */}
            <div class="space-y-1.5">
              <For each={props.participants}>
                {(p) => {
                  const voted = () => p.peerId in props.state.votes;
                  const voteValue = () => props.state.votes[p.peerId];

                  return (
                    <div class="flex items-center justify-between text-sm">
                      <div class="flex items-center gap-2">
                        <span
                          class="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: p.color }}
                        />
                        <span class="text-surface-300">{p.name}</span>
                      </div>
                      <Show when={props.state.revealed && voted()}>
                        <span class="font-mono text-primary-400 text-sm font-semibold">
                          {voteValue()}
                        </span>
                      </Show>
                      <Show when={!props.state.revealed}>
                        <span class={`text-xs ${voted() ? 'text-success' : 'text-surface-600'}`}>
                          {voted() ? 'Voted' : 'Waiting...'}
                        </span>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </Card>

          {/* Card selection (when not revealed) */}
          <Show when={!props.state.revealed}>
            <Card class="p-4 space-y-2">
              <p class="text-xs text-surface-500">
                {props.hasVoted ? `Your vote: ${props.myVote}` : 'Pick a card'}
              </p>
              <div class="flex flex-wrap gap-2">
                <For each={cards()}>
                  {(card) => (
                    <button
                      onClick={() => props.onVote(card)}
                      class={`w-12 h-16 rounded-lg border-2 text-sm font-semibold transition-all cursor-pointer
                        flex items-center justify-center
                        ${
                          props.myVote === card
                            ? 'border-primary-500 bg-primary-500/20 text-primary-300'
                            : 'border-surface-600 bg-surface-800 text-surface-300 hover:border-surface-500 hover:bg-surface-700'
                        }`}
                    >
                      {card}
                    </button>
                  )}
                </For>
              </div>
            </Card>
          </Show>

          {/* Results (when revealed) */}
          <Show when={props.state.revealed}>
            <Card class="p-4 space-y-3">
              <p class="text-xs text-surface-500 uppercase tracking-wide">Results</p>
              <Show when={results().average !== null}>
                <p class="text-2xl font-bold text-primary-400">{results().average}</p>
                <p class="text-xs text-surface-500">Average (numeric votes only)</p>
              </Show>
              <Show when={results().consensus}>
                <p class="text-sm text-success font-medium">Consensus reached!</p>
              </Show>
              <Show when={!results().consensus && Object.keys(props.state.votes).length > 1}>
                <p class="text-sm text-warning font-medium">No consensus</p>
              </Show>

              {/* Distribution */}
              <div class="space-y-1">
                <For each={Object.entries(results().distribution)}>
                  {([card, count]) => (
                    <div class="flex items-center justify-between text-sm">
                      <span class="font-mono text-surface-300">{card}</span>
                      <span class="text-surface-500">
                        {count} vote{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Card>
          </Show>
        </Show>
      </div>
    </div>
  );
}
