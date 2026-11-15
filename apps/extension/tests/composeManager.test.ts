// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComposeManager, type RegisterTrackingFn } from '../src/content/composeManager.js';
import { ComposeStateManager } from '../src/content/composeState.js';
import { TOGGLE_HOST_ATTR } from '../src/content/gmailSelectors.js';
import { insertTrackingPixel, PIXEL_ATTR } from '../src/content/pixelInjector.js';

function createMockComposeDialog(options: {
  role?: 'dialog' | 'inline';
  subject?: string;
  recipient?: string;
  bodyHtml?: string;
  includeSendButton?: boolean;
}): { container: HTMLElement; sendBtn: HTMLElement | null; bodyEditor: HTMLElement } {
  const container = document.createElement('div');
  if (options.role === 'inline') {
    container.className = 'M9';
  } else {
    container.setAttribute('role', 'dialog');
  }

  if (options.recipient) {
    const chip = document.createElement('span');
    chip.setAttribute('email', options.recipient);
    container.appendChild(chip);
  }

  if (options.subject) {
    const subjectInput = document.createElement('input');
    subjectInput.name = 'subjectbox';
    subjectInput.value = options.subject;
    container.appendChild(subjectInput);
  }

  const editor = document.createElement('div');
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('contenteditable', 'true');
  editor.innerHTML = options.bodyHtml ?? '<p>Hello <b>World</b></p>';
  container.appendChild(editor);

  let sendBtn: HTMLElement | null = null;
  if (options.includeSendButton !== false) {
    const toolbar = document.createElement('div');
    const sendGroup = document.createElement('div');
    sendGroup.className = 'dC';
    sendBtn = document.createElement('div');
    sendBtn.setAttribute('role', 'button');
    sendBtn.setAttribute('data-tooltip', 'Send ‪(Ctrl+Enter)‬');
    sendGroup.appendChild(sendBtn);
    toolbar.appendChild(sendGroup);
    container.appendChild(toolbar);
  }

  return { container, sendBtn, bodyEditor: editor };
}

describe('ComposeManager & Send-Time Tracking', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts Shadow DOM toggle for new compose, reply, and forward without duplicates', () => {
    const state = new ComposeStateManager(false);
    const manager = new ComposeManager(state, document.body);

    const newCompose = createMockComposeDialog({ role: 'dialog' });
    const replyCompose = createMockComposeDialog({ role: 'inline', subject: 'Re: Intro' });
    const fwdCompose = createMockComposeDialog({ role: 'inline', subject: 'Fwd: Deck' });

    document.body.append(newCompose.container, replyCompose.container, fwdCompose.container);
    manager.start();

    expect(manager.getActiveCount()).toBe(3);

    manager.reconcile();
    expect(document.querySelectorAll(`[${TOGGLE_HOST_ATTR}="1"]`).length).toBe(3);

    const firstBtn = newCompose.container
      .querySelector(`[${TOGGLE_HOST_ATTR}="1"]`)!
      .shadowRoot!.querySelector('button')!;
    const secondBtn = replyCompose.container
      .querySelector(`[${TOGGLE_HOST_ATTR}="1"]`)!
      .shadowRoot!.querySelector('button')!;

    firstBtn.click();
    expect(firstBtn.getAttribute('aria-pressed')).toBe('true');
    expect(secondBtn.getAttribute('aria-pressed')).toBe('false');

    manager.destroy();
  });

  it('cleans up injected Shadow DOM and draft state when compose window closes', () => {
    const state = new ComposeStateManager(false);
    const manager = new ComposeManager(state, document.body);

    const { container } = createMockComposeDialog({ role: 'dialog' });
    document.body.appendChild(container);
    manager.start();

    container.remove();
    manager.reconcile();

    expect(manager.getActiveCount()).toBe(0);
    expect(state.listDraftIds().length).toBe(0);

    manager.destroy();
  });

  it('handles missing Gmail send/toolbar elements gracefully without throwing', () => {
    const state = new ComposeStateManager(false);
    const manager = new ComposeManager(state, document.body);

    const { container } = createMockComposeDialog({
      role: 'dialog',
      includeSendButton: false,
    });
    document.body.appendChild(container);

    expect(() => manager.start()).not.toThrow();
    expect(manager.getActiveCount()).toBe(0);

    manager.destroy();
  });

  it('preserves native Gmail send when tracking is OFF and isolates multiple compose windows', async () => {
    const registerFn = vi.fn<RegisterTrackingFn>().mockResolvedValue({
      ok: true,
      data: { trackingId: 'trk-1', pixelUrl: 'http://localhost:4000/api/track/token123' },
    });
    const updateStatusFn = vi.fn().mockResolvedValue({ ok: true, data: null });

    const state = new ComposeStateManager(false);
    const manager = new ComposeManager(state, document.body, registerFn, updateStatusFn);

    const trackedDraft = createMockComposeDialog({
      role: 'dialog',
      recipient: 'tracked@example.com',
      subject: 'Tracked',
      bodyHtml: '<p>Original <em>formatted</em> body</p>',
    });
    const untrackedDraft = createMockComposeDialog({
      role: 'dialog',
      recipient: 'untracked@example.com',
      subject: 'Untracked',
    });

    document.body.append(trackedDraft.container, untrackedDraft.container);
    manager.start();

    // Native send listener on untracked draft
    const untrackedNativeSend = vi.fn();
    untrackedDraft.sendBtn!.addEventListener('click', untrackedNativeSend);
    untrackedDraft.sendBtn!.click();

    expect(untrackedNativeSend).toHaveBeenCalledTimes(1);
    expect(registerFn).not.toHaveBeenCalled();
    expect(untrackedDraft.bodyEditor.querySelector(`img[${PIXEL_ATTR}="1"]`)).toBeNull();

    // Enable tracking ONLY on trackedDraft
    trackedDraft.container
      .querySelector(`[${TOGGLE_HOST_ATTR}="1"]`)!
      .shadowRoot!.querySelector('button')!
      .click();

    const trackedNativeSend = vi.fn();
    trackedDraft.sendBtn!.addEventListener('click', trackedNativeSend);
    trackedDraft.sendBtn!.click();

    await new Promise((r) => setTimeout(r, 20));

    expect(registerFn).toHaveBeenCalledTimes(1);
    expect(trackedNativeSend).toHaveBeenCalledTimes(1);
    expect(updateStatusFn).toHaveBeenCalledWith({
      trackingId: 'trk-1',
      status: 'DISPATCHED',
    });
    const pixel = trackedDraft.bodyEditor.querySelector<HTMLImageElement>(`img[${PIXEL_ATTR}="1"]`);
    expect(pixel).not.toBeNull();
    expect(pixel!.src).toBe('http://localhost:4000/api/track/token123');
    // Original formatting preserved
    expect(trackedDraft.bodyEditor.innerHTML).toContain('<p>Original <em>formatted</em> body</p>');

    manager.destroy();
  });

  it('prevents duplicate pixel insertion in compose body', () => {
    const { bodyEditor } = createMockComposeDialog({ role: 'dialog' });
    expect(insertTrackingPixel(bodyEditor, 'http://localhost:4000/api/track/abc')).toBe(true);
    expect(insertTrackingPixel(bodyEditor, 'http://localhost:4000/api/track/abc')).toBe(false);
    expect(bodyEditor.querySelectorAll(`img[${PIXEL_ATTR}="1"]`).length).toBe(1);
  });

  it('aborts send and restores original message when registration fails', async () => {
    const registerFn = vi.fn<RegisterTrackingFn>().mockResolvedValue({
      ok: false,
      error: 'Network timeout',
    });

    const state = new ComposeStateManager(true);
    const updateStatusFn = vi.fn().mockResolvedValue({ ok: true, data: null });
    const manager = new ComposeManager(state, document.body, registerFn, updateStatusFn);

    const { container, sendBtn, bodyEditor } = createMockComposeDialog({
      role: 'dialog',
      recipient: 'lead@example.com',
      bodyHtml: '<p>Keep me intact</p>',
    });
    document.body.appendChild(container);
    manager.start();

    const nativeSend = vi.fn();
    sendBtn!.addEventListener('click', nativeSend);
    sendBtn!.click();

    await new Promise((r) => setTimeout(r, 20));

    // Must NOT silently send without tracking pixel
    expect(nativeSend).not.toHaveBeenCalled();
    expect(bodyEditor.querySelector(`img[${PIXEL_ATTR}="1"]`)).toBeNull();
    expect(bodyEditor.innerHTML).toBe('<p>Keep me intact</p>');

    const toggleBtn = container
      .querySelector(`[${TOGGLE_HOST_ATTR}="1"]`)!
      .shadowRoot!.querySelector('button')!;
    expect(toggleBtn.textContent).toContain('Error');

    manager.destroy();
  });
});
