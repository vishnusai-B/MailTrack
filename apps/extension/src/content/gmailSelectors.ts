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

const EMAIL_ADDRESS_REGEX = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/;

/**
 * Parses one or more email addresses from a Gmail chip attribute or typed recipient input.
 * Rejects instructional/placeholder text and malformed addresses.
 */
export function extractValidRecipientEmails(raw: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  for (const part of raw.split(/[,;]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Support "Display Name <user@example.com>" format as well as bare "user@example.com"
    const angleMatch = trimmed.match(/<([^<>]+)>/);
    const candidate = (angleMatch?.[1] ?? trimmed).trim();

    if (EMAIL_ADDRESS_REGEX.test(candidate)) {
      const normalized = candidate.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        results.push(candidate);
      }
    }
  }

  return results;
}

/**
 * Reads only validated recipient email addresses from Gmail compose recipient fields.
 * Excludes the message body editor (so quoted reply/forward headers are ignored) and
 * rejects placeholder or instructional UI text. Returns null if no valid recipient exists.
 */
export function findRecipientReference(container: HTMLElement): string | null {
  const emails: string[] = [];
  const seen = new Set<string>();

  const addEmails = (candidates: string[]) => {
    for (const email of candidates) {
      const key = email.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        emails.push(email);
      }
    }
  };

  // 1. Read Gmail recipient chips ([email] or modern PeopleKit [data-hovercard-id]),
  //    explicitly excluding any elements inside the message body editor.
  const chipElements = container.querySelectorAll<HTMLElement>('[email], [data-hovercard-id]');
  for (const el of chipElements) {
    if (el.closest(EDITOR_SELECTORS)) {
      continue;
    }
    const attrValue = el.getAttribute('email') ?? el.getAttribute('data-hovercard-id') ?? '';
    addEmails(extractValidRecipientEmails(attrValue));
  }

  // 2. Fallback to actual typed recipient inputs (To/Cc/Bcc), rejecting placeholders/labels
  if (emails.length === 0) {
    const inputSelectors = [
      'input[name="to"]',
      'textarea[name="to"]',
      'input[name="cc"]',
      'textarea[name="cc"]',
      'input[name="bcc"]',
      'textarea[name="bcc"]',
      'input[role="combobox"][aria-label*="To" i]',
      'input[peoplekit-id]',
    ].join(', ');

    const inputs = container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      inputSelectors,
    );
    for (const input of inputs) {
      if (input.closest(EDITOR_SELECTORS)) {
        continue;
      }
      const raw = input.value?.trim() ?? '';
      const placeholder = input.getAttribute('placeholder')?.trim() ?? '';
      if (!raw || (placeholder && raw === placeholder)) {
        continue;
      }
      addEmails(extractValidRecipientEmails(raw));
    }
  }

  if (emails.length === 0) {
    return null;
  }

  // Join complete validated addresses within the 320-char backend limit
  let joined = '';
  for (const email of emails) {
    const next = joined ? `${joined}, ${email}` : email;
    if (next.length > 320) {
      break;
    }
    joined = next;
  }

  return joined || emails[0]!.slice(0, 320);
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
