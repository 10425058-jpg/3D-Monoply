import React, { createContext, useContext, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Crown, X, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import './royal-ui.css';
import './royal-surfaces.css';

type Tone = 'gold' | 'emerald' | 'ruby' | 'teal';
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export function RoyalButton({ variant = 'secondary', className, ...props }: ButtonProps) {
  return <button type="button" {...props} className={clsx('royal-button', className)} data-variant={variant} />;
}

export function RoyalIconButton({ className, ...props }: ButtonProps & { 'aria-label': string }) {
  return <RoyalButton {...props} className={clsx('royal-ui-icon', className)} />;
}

export function RoyalPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('royal-ui-panel', className)} />;
}

export function RoyalNotice({ tone = 'gold', className, ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div {...props} className={clsx('royal-notice', className)} data-tone={tone} />;
}

export function RoyalArt({ prop, className }: { prop: 'gavel' | 'vault' | 'chance' | 'chest'; className?: string }) {
  return <span aria-hidden="true" className={clsx('royal-art', className)} data-prop={prop} />;
}

const RoyalClosing = createContext(false);
const closeDuration = 150;

export function RoyalPresence({ children }: { children: React.ReactElement | false | null | undefined }) {
  const [retained, retain] = useState<React.ReactElement | null>(null);

  useLayoutEffect(() => {
    if (children) {
      retain(children);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      retain(null);
      return;
    }
    const timer = window.setTimeout(() => retain(null), closeDuration);
    return () => window.clearTimeout(timer);
  }, [children]);

  return <RoyalClosing.Provider value={!children}>{children || retained}</RoyalClosing.Provider>;
}

type DialogEntry = { element: HTMLDialogElement; priority: number; lastFocus?: HTMLElement };
const dialogs = new Set<DialogEntry>();
let currentDialog: DialogEntry | undefined;

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const useRoyalModalOpen = () => useSyncExternalStore(subscribe, () => !!currentDialog, () => false);
export const useRoyalModalElement = () => useSyncExternalStore(subscribe, () => currentDialog?.element ?? null, () => null);

function focusHeading(dialog: HTMLDialogElement) {
  dialog.querySelector<HTMLElement>('.royal-dialog-title')?.focus({ preventScroll: true });
}

function recoverDialogFocus(dialog: HTMLDialogElement) {
  const active = document.activeElement;
  if (dialog.open && (!dialog.contains(active) || active?.matches(':disabled'))) focusHeading(dialog);
}

// Keep one native top-layer dialog even when an online result arrives during settings.
function updateDialog() {
  let next: DialogEntry | undefined;
  for (const entry of dialogs) if (!next || entry.priority >= next.priority) next = entry;
  if (currentDialog === next) return;
  if (currentDialog) {
    const { element } = currentDialog;
    if (document.activeElement instanceof HTMLElement && element.contains(document.activeElement)) {
      currentDialog.lastFocus = document.activeElement;
    }
    element.close();
  }
  currentDialog = next;
  listeners.forEach(listener => listener());
  if (next) {
    next.element.showModal();
    if (next.lastFocus?.isConnected && !next.lastFocus.matches(':disabled')) {
      next.lastFocus.focus({ preventScroll: true });
    } else {
      focusHeading(next.element);
    }
  }
}

const focusSelector = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

function containTab(event: React.KeyboardEvent<HTMLDialogElement>) {
  const dialog = event.currentTarget;
  const stops = Array.from(dialog.querySelectorAll<HTMLElement>(focusSelector)).filter(element =>
    element.tabIndex >= 0 && !element.matches(':disabled, input[type="radio"]:not(:checked)') && element.getClientRects().length > 0);
  const first = stops[0];
  const last = stops.at(-1);
  const active = document.activeElement;
  if (!first || (event.shiftKey ? active === first || !stops.includes(active as HTMLElement) : active === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus();
  }
}

interface ModalProps {
  title: string;
  titleId?: string;
  icon?: LucideIcon;
  size?: 'small' | 'medium' | 'large';
  tone?: Tone;
  className?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  dismissOnBackdrop?: boolean;
  priority?: 'utility' | 'decision' | 'result';
}

export function RoyalModal({ title, titleId, icon: Icon = Crown, size = 'medium', tone = 'gold', className,
  description, children, footer, onClose, closeLabel = 'Close dialog', dismissOnBackdrop = false,
  priority = 'utility' }: ModalProps) {
  const id = useId();
  const headingId = titleId ?? `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
  const present = !useContext(RoyalClosing);

  useLayoutEffect(() => {
    const element = ref.current!;
    const entry = { element, priority: priority === 'result' ? 2 : priority === 'decision' ? 1 : 0 };
    dialogs.add(entry);
    updateDialog();
    return () => { dialogs.delete(entry); updateDialog(); };
  }, [priority]);

  useLayoutEffect(() => {
    recoverDialogFocus(ref.current!);
  });

  return <dialog ref={ref} role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={descriptionId}
    className={clsx('royal-dialog', className)} data-size={size} data-tone={tone} data-closing={!present || undefined}
    onCancel={event => { event.preventDefault(); if (present) onClose?.(); }}
    onPointerDown={event => { backdropPress.current = event.target === event.currentTarget; }}
    onClick={event => {
      if (present && dismissOnBackdrop && backdropPress.current && event.target === event.currentTarget) onClose?.();
      backdropPress.current = false;
    }}
    onClickCapture={event => { if (!present) { event.preventDefault(); event.stopPropagation(); } }}
    onSubmitCapture={event => { if (!present) { event.preventDefault(); event.stopPropagation(); } }}
    onBlur={event => {
      const dialog = event.currentTarget;
      if (!dialog.contains(event.relatedTarget)) queueMicrotask(() => recoverDialogFocus(dialog));
    }}
    onKeyDown={event => { if (event.key === 'Tab') containTab(event); }}>
    <div className="royal-frame">
      <span className="royal-corners" aria-hidden="true"><i /><i /><i /><i /></span>
      <header className="royal-dialog-header">
        <span className="royal-crest" aria-hidden="true"><Icon size={25} strokeWidth={1.65} /></span>
        <div className="royal-ribbon"><h2 className="royal-dialog-title" id={headingId} tabIndex={-1}>{title}</h2></div>
      </header>
      {onClose && <RoyalIconButton className="royal-dialog-close" aria-label={closeLabel} onClick={onClose}><X aria-hidden="true" /></RoyalIconButton>}
      <div className="royal-dialog-body">
        {description && <p className="royal-intro" id={descriptionId}>{description}</p>}
        {children}
      </div>
      {footer && <footer className="royal-dialog-footer">{footer}</footer>}
    </div>
  </dialog>;
}

export function RoyalTabs<T extends string>({ label, tabs, value, onChange, children }: {
  label: string;
  tabs: { value: T; label: string; icon: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return <>
    <div className="royal-tabs" role="tablist" aria-label={label}>
      {tabs.map(({ value: tab, label: text, icon: Icon }, index) => <button type="button" key={tab}
        ref={element => { refs.current[index] = element; }} className="royal-tab" role="tab" id={`${id}-${tab}`}
        aria-selected={tab === value} aria-controls={`${id}-panel-${tab}`} tabIndex={tab === value ? 0 : -1}
        onClick={() => onChange(tab)} onKeyDown={event => {
          const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
            event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length :
            event.key === 'ArrowRight' ? (index + 1) % tabs.length : undefined;
          if (target === undefined) return;
          event.preventDefault();
          onChange(tabs[target].value);
          refs.current[target]?.focus();
        }}><Icon size={17} aria-hidden="true" />{text}</button>)}
    </div>
    {tabs.map(({ value: tab }) => <div key={tab} role="tabpanel" id={`${id}-panel-${tab}`} aria-labelledby={`${id}-${tab}`}
      className="royal-tab-panel" hidden={tab !== value} tabIndex={tab === value ? 0 : -1}>
      {tab === value && children}
    </div>)}
  </>;
}
