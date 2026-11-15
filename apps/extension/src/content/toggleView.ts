import { TOGGLE_HOST_ATTR } from './gmailSelectors.js';

export interface ToggleViewOptions {
  draftId: string;
  initialEnabled: boolean;
  onToggle: () => void;
}

/**
 * Isolated Shadow DOM toggle button styled to blend with Gmail's compose toolbar.
 */
export class ToggleView {
  private readonly host: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly label: HTMLSpanElement;
  private readonly clickHandler: (event: MouseEvent) => void;

  constructor(options: ToggleViewOptions) {
    this.host = document.createElement('div');
    this.host.setAttribute(TOGGLE_HOST_ATTR, '1');
    this.host.dataset.mailtrackDraftId = options.draftId;
    this.host.style.display = 'inline-flex';
    this.host.style.alignItems = 'center';
    this.host.style.marginLeft = '6px';
    this.host.style.verticalAlign = 'middle';

    const shadow = this.host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          display: inline-flex;
          align-items: center;
          font-family: 'Google Sans', Roboto, RobotoDraft, Helvetica, Arial, sans-serif;
        }
        .mt-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 32px;
          padding: 0 12px;
          border-radius: 16px;
          border: 1px solid #dadce0;
          background-color: #ffffff;
          color: #444746;
          font-size: 12px;
          font-weight: 500;
          line-height: 1;
          cursor: pointer;
          user-select: none;
          transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
        }
        .mt-toggle:hover {
          background-color: #f1f3f4;
        }
        .mt-toggle:focus-visible {
          outline: 2px solid #0b57d0;
          outline-offset: 2px;
        }
        .mt-toggle[aria-pressed="true"] {
          background-color: #e8f0fe;
          border-color: #a8c7fa;
          color: #0b57d0;
        }
        .mt-toggle[aria-pressed="true"]:hover {
          background-color: #d3e3fd;
        }
        .mt-toggle[data-error="true"] {
          background-color: #fce8e6;
          border-color: #f28b82;
          color: #c5221f;
        }
        .mt-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #80868b;
          flex-shrink: 0;
        }
        .mt-toggle[aria-pressed="true"] .mt-indicator {
          background-color: #0b57d0;
        }
        .mt-toggle[data-error="true"] .mt-indicator {
          background-color: #c5221f;
        }
      </style>
      <button type="button" class="mt-toggle">
        <span class="mt-indicator" aria-hidden="true"></span>
        <span class="mt-label"></span>
      </button>
    `;

    const btn = shadow.querySelector<HTMLButtonElement>('button.mt-toggle');
    const lbl = shadow.querySelector<HTMLSpanElement>('span.mt-label');
    if (!btn || !lbl) {
      throw new Error('Failed to initialize MailTrack ToggleView shadow DOM');
    }

    this.button = btn;
    this.label = lbl;

    this.clickHandler = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      options.onToggle();
    };
    this.button.addEventListener('click', this.clickHandler);
    this.setEnabled(options.initialEnabled);
  }

  mount(anchor: HTMLElement, position: InsertPosition = 'afterend'): void {
    anchor.insertAdjacentElement(position, this.host);
  }

  setEnabled(enabled: boolean): void {
    delete this.button.dataset.error;
    this.button.setAttribute('aria-pressed', String(enabled));
    this.button.setAttribute(
      'aria-label',
      enabled ? 'MailTrack email tracking enabled' : 'MailTrack email tracking disabled',
    );
    this.button.title = enabled
      ? 'Email tracking is ON for this draft (click to turn OFF)'
      : 'Email tracking is OFF for this draft (click to turn ON)';
    this.label.textContent = enabled ? 'Track: ON' : 'Track: OFF';
  }

  setTransientStatus(text: string, isError = false, tooltip?: string): void {
    if (isError) {
      this.button.dataset.error = 'true';
    } else {
      delete this.button.dataset.error;
    }
    if (tooltip) {
      this.button.title = tooltip;
    }
    this.label.textContent = text;
  }

  getHostElement(): HTMLElement {
    return this.host;
  }

  destroy(): void {
    this.button.removeEventListener('click', this.clickHandler);
    this.host.remove();
  }
}
