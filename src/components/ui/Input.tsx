import type { JSX } from 'solid-js';

interface InputProps {
  value?: string;
  onInput?: JSX.EventHandlerUnion<HTMLInputElement, InputEvent>;
  onKeyDown?: JSX.EventHandlerUnion<HTMLInputElement, KeyboardEvent>;
  placeholder?: string;
  label?: string;
  class?: string;
  id?: string;
  maxLength?: number;
  autofocus?: boolean;
}

export default function Input(props: InputProps) {
  return (
    <div class={`flex flex-col gap-1.5 ${props.class ?? ''}`}>
      {props.label && (
        <label for={props.id} class="text-sm text-surface-400 font-medium">
          {props.label}
        </label>
      )}
      <input
        id={props.id}
        type="text"
        value={props.value ?? ''}
        onInput={props.onInput}
        onKeyDown={props.onKeyDown}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        autofocus={props.autofocus}
        class="bg-surface-800 border border-surface-600 rounded-lg px-4 py-2 text-surface-100
          placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500
          focus:border-transparent transition-colors"
      />
    </div>
  );
}
