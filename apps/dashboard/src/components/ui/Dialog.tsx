import { useEffect, useRef, type ReactNode } from 'react';
import { IconX } from '../Icons.js';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  labelledBy?: string;
  maxWidthClass?: string;
  children: ReactNode;
}

export function ModalDialog({
  open,
  onClose,
  title,
  description,
  labelledBy = 'modal-dialog-title',
  maxWidthClass = 'max-w-lg',
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (open) {
      if (typeof el.showModal === 'function') {
        if (!el.open) el.showModal();
      } else {
        el.setAttribute('open', '');
      }
    } else if (el.open) {
      if (typeof el.close === 'function') {
        el.close();
      } else {
        el.removeAttribute('open');
      }
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className={`m-auto w-[calc(100%-24px)] ${maxWidthClass} rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-0 text-[var(--text-primary)] shadow-[var(--shadow-md)]`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border-default)] px-5 py-3.5">
        <div className="min-w-0">
          <h2 id={labelledBy} className="text-[15px] font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
