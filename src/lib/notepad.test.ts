import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createYDoc } from './yjs-doc';
import { getNotepadFragment } from './notepad';

function makeDoc() {
  return createYDoc({
    roomCode: 'test-room-0000',
    roomName: 'Test Room',
    createdAt: Date.now(),
    settings: { maxParticipants: 6 },
  });
}

describe('Notepad', () => {
  it('returns an XmlFragment', () => {
    const doc = makeDoc();
    const fragment = getNotepadFragment(doc);
    expect(fragment).toBeDefined();
    expect(fragment).toBeInstanceOf(Y.XmlFragment);
  });

  it('returns the same fragment on subsequent calls', () => {
    const doc = makeDoc();
    const f1 = getNotepadFragment(doc);
    const f2 = getNotepadFragment(doc);
    expect(f1).toBe(f2);
  });

  it('syncs content between docs via Y.Doc updates', () => {
    const doc1 = makeDoc();
    const doc2 = new Y.Doc();

    // Simulate sync: apply doc1's state to doc2
    const state1 = Y.encodeStateAsUpdate(doc1);
    Y.applyUpdate(doc2, state1);

    const f1 = doc1.getXmlFragment('notepad');
    const f2 = doc2.getXmlFragment('notepad');

    // Insert text in doc1
    const text = new Y.XmlText('Hello collaborative world');
    f1.insert(0, [text]);

    // Sync update to doc2
    const update = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
    Y.applyUpdate(doc2, update);

    expect(f2.toDOM().textContent).toBe('Hello collaborative world');
  });
});
