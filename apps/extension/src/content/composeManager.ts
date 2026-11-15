import type { ExtensionResponse, RegisterTrackingResult } from '../shared/messages.js';
import type { ComposeStateManager } from './composeState.js';
import {
  detectComposeMode,
  findBodyEditor,
  findComposeContainers,
  findRecipientReference,
  findSendButton,
  findSubjectValue,
  findToolbarAnchor,
  hasInjectedToggle,
} from './gmailSelectors.js';
import { insertTrackingPixel, removeTrackingPixel } from './pixelInjector.js';
import { ToggleView } from './toggleView.js';

export type RegisterTrackingFn = (params: {
  recipientReference: string;
  subject?: string;
}) => Promise<ExtensionResponse<RegisterTrackingResult>>;

export type UpdateTrackingStatusFn = (params: {
  trackingId: string;
  status: 'DISPATCHED' | 'SENT' | 'FAILED';
}) => Promise<ExtensionResponse<unknown>>;

interface MountedCompose {
  draftId: string;
  view: ToggleView;
  sendButton: HTMLElement;
  isPreparing: boolean;
  bypassNextSend: boolean;
  registeredTracking: RegisterTrackingResult | null;
  cleanupSendListeners: () => void;
}

const defaultRegisterTracking: RegisterTrackingFn = (params) =>
  chrome.runtime.sendMessage({
    type: 'REGISTER_TRACKING',
    recipientReference: params.recipientReference,
    subject: params.subject,
  });

const defaultUpdateStatus: UpdateTrackingStatusFn = (params) =>
  chrome.runtime.sendMessage({
    type: 'UPDATE_TRACKING_STATUS',
    trackingId: params.trackingId,
    status: params.status,
  });

/**
 * Coordinates Gmail compose-window detection, per-window state isolation,
 * Shadow DOM toggle mounting, send-time pixel injection, and cleanup.
 */
export class ComposeManager {
  private readonly instances = new Map<HTMLElement, MountedCompose>();
  private observer: MutationObserver | null = null;
  private rafId: number | null = null;
  private draftCounter = 0;
  private started = false;

  private readonly navigationHandler = () => {
    this.scheduleReconcile();
  };

  constructor(
    private readonly stateManager: ComposeStateManager,
    private readonly root: HTMLElement = document.body,
    private readonly registerTracking: RegisterTrackingFn = defaultRegisterTracking,
    private readonly updateTrackingStatus: UpdateTrackingStatusFn = defaultUpdateStatus,
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;

    this.reconcile();

    this.observer = new MutationObserver(() => {
      this.scheduleReconcile();
    });
    this.observer.observe(this.root, {
      childList: true,
      subtree: true,
    });

    window.addEventListener('hashchange', this.navigationHandler);
    window.addEventListener('popstate', this.navigationHandler);
  }

  updateGlobalDefault(enabled: boolean): void {
    this.stateManager.updateGlobalDefault(enabled);
  }

  /**
   * Synchronizes mounted toggles with currently connected Gmail compose containers.
   */
  reconcile(): void {
    for (const [container, mounted] of this.instances.entries()) {
      if (!container.isConnected) {
        this.teardownContainer(container, mounted);
      }
    }

    const containers = findComposeContainers(this.root);
    for (const container of containers) {
      if (this.instances.has(container) || hasInjectedToggle(container)) {
        continue;
      }

      const sendButton = findSendButton(container);
      const toolbar = findToolbarAnchor(container);
      if (!sendButton || !toolbar) {
        continue;
      }

      const draftId = `mt-draft-${++this.draftCounter}`;
      const mode = detectComposeMode(container);
      const draftState = this.stateManager.createDraft(draftId, mode);

      const view = new ToggleView({
        draftId,
        initialEnabled: draftState.trackingEnabled,
        onToggle: () => {
          const updated = this.stateManager.toggleDraft(draftId);
          if (updated) {
            view.setEnabled(updated.trackingEnabled);
          }
        },
      });

      const mounted: MountedCompose = {
        draftId,
        view,
        sendButton,
        isPreparing: false,
        bypassNextSend: false,
        registeredTracking: null,
        cleanupSendListeners: () => {},
      };

      mounted.cleanupSendListeners = this.attachSendInterceptors(container, mounted);
      view.mount(toolbar.anchor, toolbar.position);
      this.instances.set(container, mounted);
    }
  }

  getActiveCount(): number {
    return this.instances.size;
  }

  destroy(): void {
    if (!this.started) return;
    this.started = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.observer?.disconnect();
    this.observer = null;

    window.removeEventListener('hashchange', this.navigationHandler);
    window.removeEventListener('popstate', this.navigationHandler);

    for (const [container, mounted] of this.instances.entries()) {
      this.teardownContainer(container, mounted);
    }
  }

  private attachSendInterceptors(container: HTMLElement, mounted: MountedCompose): () => void {
    const onSendClick = (event: MouseEvent) => {
      const draft = this.stateManager.getDraft(mounted.draftId);
      if (!draft?.trackingEnabled) {
        // Tracking OFF: never interfere with native Gmail send
        return;
      }

      if (mounted.bypassNextSend) {
        mounted.bypassNextSend = false;
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (mounted.isPreparing) {
        // Prevent duplicate registration and duplicate send while in flight
        return;
      }

      void this.prepareAndSend(container, mounted);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') {
        return;
      }

      const draft = this.stateManager.getDraft(mounted.draftId);
      if (!draft?.trackingEnabled) {
        return;
      }

      if (mounted.bypassNextSend) {
        mounted.bypassNextSend = false;
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (mounted.isPreparing) {
        return;
      }

      void this.prepareAndSend(container, mounted);
    };

    mounted.sendButton.addEventListener('click', onSendClick, { capture: true });
    container.addEventListener('keydown', onKeyDown, { capture: true });

    return () => {
      mounted.sendButton.removeEventListener('click', onSendClick, { capture: true });
      container.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }

  private async prepareAndSend(container: HTMLElement, mounted: MountedCompose): Promise<void> {
    const bodyEditor = findBodyEditor(container);
    if (!bodyEditor) {
      mounted.view.setTransientStatus('Track: Editor missing', true);
      return;
    }

    mounted.isPreparing = true;
    mounted.view.setTransientStatus('Preparing...');

    try {
      let tracking = mounted.registeredTracking;

      if (!tracking) {
        const recipientReference = findRecipientReference(container);
        const subject = findSubjectValue(container);
        const response = await this.registerTracking({ recipientReference, subject });

        if (!response.ok) {
          throw new Error(response.error);
        }
        tracking = response.data;
        mounted.registeredTracking = tracking;
      }

      if (!tracking.pixelUrl) {
        throw new Error('Missing tracking pixel URL');
      }

      insertTrackingPixel(bodyEditor, tracking.pixelUrl);

      mounted.bypassNextSend = true;
      mounted.sendButton.click();

      // Gmail DOM click only initiates async submission; record uncertain DISPATCHED state rather than SENT
      void this.updateTrackingStatus({
        trackingId: tracking.trackingId,
        status: 'DISPATCHED',
      }).catch(() => {
        // Non-blocking: send already dispatched
      });
    } catch (err) {
      // Restore original message and never silently send a tracked email without its pixel
      removeTrackingPixel(bodyEditor);
      if (mounted.registeredTracking) {
        void this.updateTrackingStatus({
          trackingId: mounted.registeredTracking.trackingId,
          status: 'FAILED',
        }).catch(() => {});
        mounted.registeredTracking = null;
      }
      const message = err instanceof Error ? err.message : 'Tracking preparation failed';
      mounted.view.setTransientStatus(
        'Track: Error (retry)',
        true,
        `${message}. Email was not sent so tracking is not silently skipped.`,
      );
    } finally {
      mounted.isPreparing = false;
    }
  }

  private teardownContainer(container: HTMLElement, mounted: MountedCompose): void {
    mounted.cleanupSendListeners();
    mounted.view.destroy();
    this.stateManager.removeDraft(mounted.draftId);
    this.instances.delete(container);
  }

  private scheduleReconcile(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.reconcile();
    });
  }
}
