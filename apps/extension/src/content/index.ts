import type { ExtensionPreferences, ExtensionResponse } from '../shared/messages.js';
import { ComposeManager } from './composeManager.js';
import { ComposeStateManager } from './composeState.js';

async function loadInitialDefault(): Promise<boolean> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'GET_PREFERENCES',
    })) as ExtensionResponse<ExtensionPreferences> | undefined;

    if (response?.ok) {
      return response.data.defaultTrackingEnabled;
    }
  } catch {
    // Fallback to explicit opt-in default if service worker is waking up
  }
  return false;
}

async function bootstrap(): Promise<void> {
  if (typeof document === 'undefined' || !document.body) return;

  const initialDefault = await loadInitialDefault();
  const stateManager = new ComposeStateManager(initialDefault);
  const manager = new ComposeManager(stateManager, document.body);
  manager.start();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.defaultTrackingEnabled) return;
    const nextValue = changes.defaultTrackingEnabled.newValue;
    if (typeof nextValue === 'boolean') {
      // Applies only to newly opened drafts; existing open drafts stay unchanged
      manager.updateGlobalDefault(nextValue);
    }
  });
}

void bootstrap();
