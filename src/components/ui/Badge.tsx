interface BadgeProps {
  label: string;
  color?: string;
  class?: string;
}

export default function Badge(props: BadgeProps) {
  return (
    <span
      class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium
        ${props.class ?? ''}`}
      style={{
        "background-color": props.color ? `${props.color}20` : undefined,
        color: props.color ?? undefined,
      }}
    >
      {props.label}
    </span>
  );
}
