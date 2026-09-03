// Reusable UI primitives.

import { useEffect, type ReactNode } from 'react';

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="flex-row mt-3">
        <button className="btn btn--secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function EmptyState({
  emoji,
  title,
  children,
  action,
  onAction,
  actionLabel,
}: {
  emoji: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__emoji" aria-hidden="true">
        {emoji}
      </div>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
      {onAction && actionLabel ? (
        <button className="btn btn--primary btn--sm" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  return <span className={`chip chip--${status}`}>{status}</span>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="field__error" role="alert">{message}</span>;
}