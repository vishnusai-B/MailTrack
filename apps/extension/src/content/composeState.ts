import type { ComposeMode } from './gmailSelectors.js';

export interface ComposeDraftState {
  id: string;
  mode: ComposeMode;
  trackingEnabled: boolean;
  createdAt: number;
}

/**
 * Pure state manager for per-compose-window tracking toggles.
 * Guarantees isolated state per draft and ensures changing the global default
 * preference never silently mutates already-open drafts.
 */
export class ComposeStateManager {
  private readonly drafts = new Map<string, ComposeDraftState>();
  private defaultTrackingEnabled: boolean;

  constructor(initialDefault = false) {
    this.defaultTrackingEnabled = initialDefault;
  }

  getDefaultTrackingEnabled(): boolean {
    return this.defaultTrackingEnabled;
  }

  /**
   * Updates the global default for future drafts only.
   * Existing open drafts retain their explicit per-draft state.
   */
  updateGlobalDefault(enabled: boolean): void {
    this.defaultTrackingEnabled = enabled;
  }

  createDraft(id: string, mode: ComposeMode): ComposeDraftState {
    const existing = this.drafts.get(id);
    if (existing) {
      return existing;
    }

    const draft: ComposeDraftState = {
      id,
      mode,
      trackingEnabled: this.defaultTrackingEnabled,
      createdAt: Date.now(),
    };
    this.drafts.set(id, draft);
    return draft;
  }

  getDraft(id: string): ComposeDraftState | undefined {
    return this.drafts.get(id);
  }

  toggleDraft(id: string): ComposeDraftState | undefined {
    const draft = this.drafts.get(id);
    if (!draft) return undefined;

    const updated: ComposeDraftState = {
      ...draft,
      trackingEnabled: !draft.trackingEnabled,
    };
    this.drafts.set(id, updated);
    return updated;
  }

  setDraftTracking(id: string, enabled: boolean): ComposeDraftState | undefined {
    const draft = this.drafts.get(id);
    if (!draft) return undefined;

    const updated: ComposeDraftState = {
      ...draft,
      trackingEnabled: enabled,
    };
    this.drafts.set(id, updated);
    return updated;
  }

  removeDraft(id: string): boolean {
    return this.drafts.delete(id);
  }

  listDraftIds(): string[] {
    return Array.from(this.drafts.keys());
  }

  clear(): void {
    this.drafts.clear();
  }
}
