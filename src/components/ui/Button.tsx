import type { JSX, ParentProps } from 'solid-js';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ParentProps {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
  class?: string;
  type?: 'button' | 'submit';
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary-600 hover:bg-primary-500 text-white',
  secondary: 'bg-surface-700 hover:bg-surface-600 text-surface-100',
  ghost: 'bg-transparent hover:bg-surface-700/50 text-surface-300',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button(props: ButtonProps) {
  return (
    <button
      type={props.type ?? 'button'}
      disabled={props.disabled}
      onClick={props.onClick}
      class={`inline-flex items-center justify-center rounded-lg font-medium transition-colors
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
        disabled:opacity-50 disabled:pointer-events-none cursor-pointer
        ${variantClasses[props.variant ?? 'primary']}
        ${sizeClasses[props.size ?? 'md']}
        ${props.class ?? ''}`}
    >
      {props.children}
    </button>
  );
}
