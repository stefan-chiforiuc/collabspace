import * as Y from 'yjs';

/**
 * Get or create the shared XmlFragment for TipTap collaboration.
 * TipTap's Collaboration extension expects a Y.XmlFragment.
 */
export function getNotepadFragment(doc: Y.Doc): Y.XmlFragment {
  return doc.getXmlFragment('notepad');
}

/**
 * Export the notepad content as plain text.
 */
export function exportAsText(fragment: Y.XmlFragment): string {
  return fragment.toDOM().textContent || '';
}

/**
 * Export the notepad content as a simple Markdown approximation.
 * Walks the Y.XmlFragment tree and converts block elements.
 */
export function exportAsMarkdown(element: HTMLElement): string {
  const lines: string[] = [];

  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      lines.push(node.textContent || '');
      continue;
    }

    const el = node as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    const text = el.textContent || '';

    switch (tag) {
      case 'h1':
        lines.push(`# ${text}`);
        break;
      case 'h2':
        lines.push(`## ${text}`);
        break;
      case 'h3':
        lines.push(`### ${text}`);
        break;
      case 'ul':
        for (const li of el.querySelectorAll('li')) {
          lines.push(`- ${li.textContent || ''}`);
        }
        break;
      case 'ol': {
        let i = 1;
        for (const li of el.querySelectorAll('li')) {
          lines.push(`${i}. ${li.textContent || ''}`);
          i++;
        }
        break;
      }
      case 'pre':
        lines.push('```');
        lines.push(text);
        lines.push('```');
        break;
      case 'blockquote':
        lines.push(`> ${text}`);
        break;
      default:
        lines.push(text);
    }
  }

  return lines.join('\n');
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
