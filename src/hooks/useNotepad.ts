import { onCleanup, onMount, createSignal } from 'solid-js';
import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import Placeholder from '@tiptap/extension-placeholder';
import { getNotepadFragment, exportAsMarkdown, exportAsText, downloadFile } from '../lib/notepad';

export function useNotepad(
  doc: Y.Doc,
  awareness: Awareness,
  localName: string,
  localColor: string,
) {
  const [editor, setEditor] = createSignal<Editor | null>(null);

  const fragment = getNotepadFragment(doc);

  const createEditor = (element: HTMLElement) => {
    const ed = new Editor({
      element,
      extensions: [
        StarterKit.configure({
          undoRedo: false, // Yjs handles undo/redo
        }),
        Collaboration.configure({
          fragment,
        }),
        Placeholder.configure({
          placeholder: 'Start typing collaboratively...',
        }),
      ],
      editorProps: {
        attributes: {
          class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-full p-4',
        },
      },
    });

    setEditor(ed);

    // Set cursor info in awareness for other peers
    awareness.setLocalStateField('cursor', {
      name: localName,
      color: localColor,
    });
  };

  const destroy = () => {
    editor()?.destroy();
  };

  onCleanup(destroy);

  const exportMarkdown = () => {
    const ed = editor();
    if (!ed) return;
    const el = ed.options.element as HTMLElement;
    const editorContent = el.querySelector('.ProseMirror') as HTMLElement;
    if (!editorContent) return;
    const md = exportAsMarkdown(editorContent);
    downloadFile(md, 'notepad.md', 'text/markdown');
  };

  const exportText = () => {
    const ed = editor();
    if (!ed) return;
    const text = ed.getText();
    downloadFile(text, 'notepad.txt', 'text/plain');
  };

  const exportJSON = () => {
    const ed = editor();
    if (!ed) return;
    const json = JSON.stringify(ed.getJSON(), null, 2);
    downloadFile(json, 'notepad.json', 'application/json');
  };

  return {
    editor,
    createEditor,
    destroy,
    exportMarkdown,
    exportText,
    exportJSON,
  };
}
