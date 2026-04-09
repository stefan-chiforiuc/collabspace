import { onMount, Show } from 'solid-js';
import type { Editor } from '@tiptap/core';
import Button from './ui/Button';

interface NotepadPanelProps {
  createEditor: (element: HTMLElement) => void;
  editor: Editor | null;
  onExportMarkdown: () => void;
  onExportText: () => void;
  onExportJSON: () => void;
}

export default function NotepadPanel(props: NotepadPanelProps) {
  let editorRef: HTMLDivElement | undefined;

  onMount(() => {
    if (editorRef) {
      props.createEditor(editorRef);
    }
  });

  const toggleBold = () => props.editor?.chain().focus().toggleBold().run();
  const toggleItalic = () => props.editor?.chain().focus().toggleItalic().run();
  const toggleCode = () => props.editor?.chain().focus().toggleCode().run();
  const toggleH1 = () => props.editor?.chain().focus().toggleHeading({ level: 1 }).run();
  const toggleH2 = () => props.editor?.chain().focus().toggleHeading({ level: 2 }).run();
  const toggleH3 = () => props.editor?.chain().focus().toggleHeading({ level: 3 }).run();
  const toggleBulletList = () => props.editor?.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => props.editor?.chain().focus().toggleOrderedList().run();
  const toggleCodeBlock = () => props.editor?.chain().focus().toggleCodeBlock().run();
  const toggleBlockquote = () => props.editor?.chain().focus().toggleBlockquote().run();

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    props.editor?.isActive(name, attrs) ?? false;

  return (
    <div class="flex flex-col h-full">
      {/* Toolbar */}
      <div class="flex items-center gap-0.5 p-2 border-b border-surface-700 bg-surface-800/50 flex-wrap">
        {/* Text formatting */}
        <ToolbarButton label="B" title="Bold" active={isActive('bold')} onClick={toggleBold} bold />
        <ToolbarButton label="I" title="Italic" active={isActive('italic')} onClick={toggleItalic} italic />
        <ToolbarButton label="<>" title="Inline code" active={isActive('code')} onClick={toggleCode} mono />

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton label="H1" title="Heading 1" active={isActive('heading', { level: 1 })} onClick={toggleH1} />
        <ToolbarButton label="H2" title="Heading 2" active={isActive('heading', { level: 2 })} onClick={toggleH2} />
        <ToolbarButton label="H3" title="Heading 3" active={isActive('heading', { level: 3 })} onClick={toggleH3} />

        <ToolbarDivider />

        {/* Lists & blocks */}
        <ToolbarButton label="UL" title="Bullet list" active={isActive('bulletList')} onClick={toggleBulletList} />
        <ToolbarButton label="OL" title="Ordered list" active={isActive('orderedList')} onClick={toggleOrderedList} />
        <ToolbarButton label="{}" title="Code block" active={isActive('codeBlock')} onClick={toggleCodeBlock} mono />
        <ToolbarButton label=">" title="Blockquote" active={isActive('blockquote')} onClick={toggleBlockquote} />

        {/* Spacer + Export */}
        <div class="flex-1" />
        <div class="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={props.onExportMarkdown}>
            .md
          </Button>
          <Button size="sm" variant="ghost" onClick={props.onExportText}>
            .txt
          </Button>
          <Button size="sm" variant="ghost" onClick={props.onExportJSON}>
            .json
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        class="flex-1 overflow-y-auto notepad-editor"
      />
    </div>
  );
}

function ToolbarButton(props: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
  bold?: boolean;
  italic?: boolean;
  mono?: boolean;
}) {
  return (
    <button
      onClick={props.onClick}
      title={props.title}
      class={`px-2 py-1 text-xs rounded transition-colors cursor-pointer
        ${props.bold ? 'font-bold' : ''}
        ${props.italic ? 'italic' : ''}
        ${props.mono ? 'font-mono' : ''}
        ${
          props.active
            ? 'bg-primary-500/20 text-primary-400'
            : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700'
        }`}
    >
      {props.label}
    </button>
  );
}

function ToolbarDivider() {
  return <div class="w-px h-5 bg-surface-700 mx-1" />;
}
