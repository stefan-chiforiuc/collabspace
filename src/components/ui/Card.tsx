import type { ParentProps } from 'solid-js';

interface CardProps extends ParentProps {
  class?: string;
}

export default function Card(props: CardProps) {
  return (
    <div
      class={`bg-surface-800/80 backdrop-blur-sm border border-surface-700 rounded-2xl p-6
        ${props.class ?? ''}`}
    >
      {props.children}
    </div>
  );
}
