/** Distinct colors assigned to participants (max 6). WCAG AA on dark bg. */
export const PARTICIPANT_COLORS = [
  '#818cf8', // indigo
  '#34d399', // emerald
  '#f472b6', // pink
  '#fbbf24', // amber
  '#38bdf8', // sky
  '#fb923c', // orange
] as const;

export function getParticipantColor(index: number): string {
  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
}
