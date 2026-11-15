export type ComposeMode = 'new' | 'reply' | 'forward';

const EDITOR_SELECTORS = [
  'div[role="textbox"][contenteditable="true"]',
  'div[g_editable="true"][contenteditable="true"]',
].join(', ');

const SEND_BUTTON_SELECTORS = [
  'div[role="button"][data-tooltip^="Send"]',
  'div[role="button"][aria-label^="Send"]',
  'div.aoO[role="button"]',
].join(', ');

const CONTAINER_SELECTORS = ['div[role="dialog"]', 'div.M9', 'table.aoP', 'div.ip'].join(', ');

/**
 * Finds all active Gmail compose containers (new compose dialogs, inline replies, and forwards).
 * Does not inspect or read inbox message lists.
 */
export function findComposeContainers(root: ParentNode = document): HTMLElement[] {
  const editors = root.querySelectorAll<HTMLElement>(EDITOR_SELECTORS);
  const containers = new Set<HTMLElement>();

  editors.forEach((editor) => {
    const container = editor.closest<HTMLElement>(CONTAINER_SELECTORS);
    if (!container) return;

    if (findSendButton(container)) {
      containers.add(container);
    }
  });

  return Array.from(containers);
}

/**
 * Finds the Send button inside a compose container.
 */
export function findSendButton(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(SEND_BUTTON_SELECTORS);
}

/**
 * Finds the compose message body editor inside a compose container.
 */
export function findBodyEditor(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(EDITOR_SELECTORS);
}

/**
 * Reads only the subject metadata from the compose container.
 */
export function findSubjectValue(container: HTMLElement): string | undefined {
  const input = container.querySelector<HTMLInputElement>('input[name="subjectbox"]');
  const value = input?.value?.trim();
  return value ? value.slice(0, 255) : undefined;
}

/**
 * Reads only the recipient reference metadata from the compose container.
 */
export function findRecipientReference(container: HTMLElement): string {
  const chips = Array.from(container.querySelectorAll<HTMLElement>('[email]'))
    .map((el) => el.getAttribute('email')?.trim())
    .filter((v): v is string => Boolean(v && v.includes('@')));

  if (chips.length > 0) {
    return Array.from(new Set(chips)).join(', ').slice(0, 320);
  }

  const toInput = container.querySelector<HTMLInputElement>(
    'input[aria-label*="To"], input[peoplekit-id], textarea[name="to"]',
  );
  const raw = toInput?.value?.trim();
  if (raw) {
    return raw.slice(0, 320);
  }

  return 'unspecified-recipient';
}

/**
 * Finds the toolbar anchor element where the MailTrack toggle should be mounted.
 * Prefers the toolbar cell adjacent to the Send button.
 */
export function findToolbarAnchor(container: HTMLElement): {
  anchor: HTMLElement;
  position: InsertPosition;
} | null {
  const sendButton = findSendButton(container);
  if (!sendButton) return null;

  const sendGroup = sendButton.closest<HTMLElement>('td.gU.Up, div.dC');
  if (sendGroup && sendGroup.parentElement) {
    return { anchor: sendGroup, position: 'afterend' };
  }

  if (sendButton.parentElement) {
    return { anchor: sendButton.parentElement, position: 'afterend' };
  }

  return null;
}

/**
 * Infers whether a compose container is a new compose, reply, or forward
 * using structural/header attributes only (never reads email body text).
 */
export function detectComposeMode(container: HTMLElement): ComposeMode {
  if (container.matches('div[role="dialog"]')) {
    return 'new';
  }

  const subjectInput = container.querySelector<HTMLInputElement>('input[name="subjectbox"]');
  const subjectVal = subjectInput?.value?.trim().toLowerCase() ?? '';
  if (subjectVal.startsWith('fwd:')) {
    return 'forward';
  }
  if (subjectVal.startsWith('re:')) {
    return 'reply';
  }

  const modeLabel = container.querySelector<HTMLElement>(
    '[aria-label*="Forward"], [data-tooltip*="Forward"]',
  );
  if (modeLabel) {
    return 'forward';
  }

  return 'reply';
}

export const TOGGLE_HOST_ATTR = 'data-mailtrack-toggle-host';

export function hasInjectedToggle(container: HTMLElement): boolean {
  return container.querySelector(`[${TOGGLE_HOST_ATTR}="1"]`) !== null;
}
