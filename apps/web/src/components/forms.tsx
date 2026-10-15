'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

export type ActionState = { ok: boolean; error?: { code: string; message: string }; data?: unknown } | null;
type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

export function SubmitButton({ children, variant = 'primary', disabled }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const cls =
    variant === 'danger'
      ? 'bg-red-700 text-white hover:bg-red-800'
      : variant === 'secondary'
        ? 'border border-brand-700 text-brand-700 hover:bg-brand-100'
        : 'bg-brand-700 text-white hover:bg-brand-900';
  return (
    <button type="submit" disabled={pending || disabled} className={`inline-flex min-h-12 items-center justify-center rounded-lg px-4 font-medium disabled:opacity-50 ${cls}`}>
      {children}
    </button>
  );
}

/** Shows an API error by its code (errors.<code> in messages), falling back to a generic text. */
export function ErrorText({ state }: { state: ActionState }) {
  const t = useTranslations('errors');
  if (!state?.error) return null;
  const key = state.error.code.replace(/\./g, '_');
  const text = t.has(key) ? t(key) : t('generic', { code: state.error.code });
  return (
    <p role="alert" className="text-red-700">
      {text}
    </p>
  );
}

/**
 * A form bound to a server action. `hidden` adds hidden inputs (ids). Shows the error
 * or the saved message. Resets on success when `resetOnSuccess`.
 */
export function ActionForm({
  action,
  children,
  hidden,
  className = 'space-y-4',
  resetOnSuccess = false,
  successText,
  confirm,
}: {
  action: Action;
  children: ReactNode;
  hidden?: Record<string, string>;
  className?: string;
  resetOnSuccess?: boolean;
  successText?: string;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <ErrorText state={state} />
      {state?.ok && successText && (
        <p role="status" className="text-brand-700">
          {successText}
        </p>
      )}
    </form>
  );
}

/** One-button form, e.g. "Accept" or "Approve". */
export function ActionButton({
  action,
  hidden,
  children,
  variant,
  confirm,
}: {
  action: Action;
  hidden?: Record<string, string>;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  confirm?: string;
}) {
  return (
    <ActionForm action={action} hidden={hidden} className="inline-flex flex-col gap-1" confirm={confirm}>
      <SubmitButton variant={variant}>{children}</SubmitButton>
    </ActionForm>
  );
}
