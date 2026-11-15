import { describe, expect, it } from 'vitest';
import { ComposeStateManager } from '../src/content/composeState.js';

describe('ComposeStateManager', () => {
  it('defaults to explicit opt-in (false) when no initial default is provided', () => {
    const manager = new ComposeStateManager();
    expect(manager.getDefaultTrackingEnabled()).toBe(false);

    const draft = manager.createDraft('draft-1', 'new');
    expect(draft.trackingEnabled).toBe(false);
    expect(draft.mode).toBe('new');
  });

  it('maintains independent tracking state across multiple simultaneous drafts', () => {
    const manager = new ComposeStateManager(false);
    const d1 = manager.createDraft('draft-1', 'new');
    const d2 = manager.createDraft('draft-2', 'reply');
    const d3 = manager.createDraft('draft-3', 'forward');

    expect(d1.trackingEnabled).toBe(false);
    expect(d2.trackingEnabled).toBe(false);
    expect(d3.trackingEnabled).toBe(false);

    manager.toggleDraft('draft-2');

    expect(manager.getDraft('draft-1')?.trackingEnabled).toBe(false);
    expect(manager.getDraft('draft-2')?.trackingEnabled).toBe(true);
    expect(manager.getDraft('draft-3')?.trackingEnabled).toBe(false);
  });

  it('does not silently alter existing open drafts when global default changes', () => {
    const manager = new ComposeStateManager(false);
    manager.createDraft('open-draft', 'new');
    manager.setDraftTracking('open-draft', true);

    // User changes global default to false in popup
    manager.updateGlobalDefault(false);
    expect(manager.getDraft('open-draft')?.trackingEnabled).toBe(true);

    // Newly opened draft receives the new global default
    const newDraft = manager.createDraft('new-draft', 'reply');
    expect(newDraft.trackingEnabled).toBe(false);

    // Re-enabling global default only affects subsequent drafts
    manager.updateGlobalDefault(true);
    expect(manager.getDraft('new-draft')?.trackingEnabled).toBe(false);
    expect(manager.createDraft('third-draft', 'forward').trackingEnabled).toBe(true);
  });

  it('prevents duplicate draft creation for the same id', () => {
    const manager = new ComposeStateManager(false);
    manager.createDraft('draft-1', 'new');
    manager.setDraftTracking('draft-1', true);

    const secondCall = manager.createDraft('draft-1', 'new');
    expect(secondCall.trackingEnabled).toBe(true);
    expect(manager.listDraftIds()).toEqual(['draft-1']);
  });

  it('removes draft state cleanly when closed', () => {
    const manager = new ComposeStateManager(true);
    manager.createDraft('draft-1', 'new');
    manager.createDraft('draft-2', 'reply');

    expect(manager.removeDraft('draft-1')).toBe(true);
    expect(manager.getDraft('draft-1')).toBeUndefined();
    expect(manager.listDraftIds()).toEqual(['draft-2']);
  });
});
