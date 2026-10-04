import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { ArrowLeft, ArrowRight, X, CheckCircle, LockKey } from '@phosphor-icons/react';

export const money = (value: number, compact = false) => '$' + new Intl.NumberFormat('en-US', compact ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }).format(value);
export const number = (value: number) => new Intl.NumberFormat('en-US').format(value);

export function AnimatedNumber({ value, currency = false, compact = false }: { value: number; currency?: boolean; compact?: boolean }) {
  const v = useMotionValue(value);
  const text = useTransform(v, n => currency ? money(Math.round(n), compact) : number(Math.round(n)));
  useEffect(() => { const animation = animate(v, value, { duration: .5, ease: 'easeOut' }); return () => animation.stop(); }, [value, v]);
  return <motion.span>{text}</motion.span>;
}
export function Button({ children, variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={`button ${variant} ${className}`} {...props}>{children}</button>;
}
export function Tag({ children, tone = '' }: { children: ReactNode; tone?: string }) { return <span className={`tag ${tone}`}>{children}</span>; }
export function Bar({ value, max = 100, tone = '', label }: { value: number; max?: number; tone?: string; label?: string }) {
  return <div className={`progress-track ${tone}`} role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemax={max} aria-valuemin={0}><motion.div initial={false} animate={{ width: `${Math.max(0, Math.min(100, value / max * 100))}%` }} transition={{ duration: .5 }} /></div>;
}
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="section-title"><h2>{title}</h2>{action && <button className="text-link" onClick={onAction}>{action}<ArrowRight size={14} /></button>}</div>;
}
export function EmptyState({ title, text, children }: { title: string; text: string; children?: ReactNode }) { return <div className="empty-state"><div className="empty-mark"><LockKey size={26} /></div><h3>{title}</h3><p>{text}</p>{children}</div>; }
export function useCompact() {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 700px)').matches);
  useEffect(() => { const query = window.matchMedia('(max-width: 700px)'); const update = () => setCompact(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  return compact;
}
export function usePagination<T>(items: T[], desktopSize: number, mobileSize: number, resetKey = '') {
  const compact = useCompact(); const size = compact ? mobileSize : desktopSize;
  const [current, setPage] = useState(0); const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(current, pages - 1);
  useEffect(() => setPage(0), [resetKey]);
  return { visible: items.slice(page * size, (page + 1) * size), page, pages, setPage, total: items.length };
}
export function Pagination({ page, pages, setPage, total }: { page: number; pages: number; setPage: (n: number) => void; total: number }) {
  if (pages < 2) return <div className="pagination single"><span>{total} {total === 1 ? 'entry' : 'entries'}</span></div>;
  return <div className="pagination"><span>{page + 1} / {pages}<span className="muted"> · {total} entries</span></span><div><button aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ArrowLeft size={18} /></button><button aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ArrowRight size={18} /></button></div></div>;
}
export function Tabs({ options, value, onChange }: { options: {id: string; label: string; count?: number}[]; value: string; onChange: (v: string) => void }) {
  return <div className="segmented" role="tablist">{options.map(o => <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)} className={value === o.id ? 'selected' : ''}>{o.label}{o.count !== undefined && <span>{o.count}</span>}</button>)}</div>;
}
export function Modal({ title, children, onClose, className = '', dismissible = true }: { title: string; children: ReactNode; onClose?: () => void; className?: string; dismissible?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null); const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); const cancel = (event: Event) => { event.preventDefault(); if (dismissible) closeRef.current?.(); }; dialog?.addEventListener('cancel', cancel); return () => { dialog?.removeEventListener('cancel', cancel); dialog?.close(); }; }, [dismissible]);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onClick={e => { if (e.target === e.currentTarget && dismissible) onClose?.(); }}><motion.div className="modal-inner" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }}><div className="modal-heading"><span className="eyebrow">BLACKLINE</span>{dismissible && onClose && <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>}</div>{children}</motion.div></dialog>;
}
export function Toggle({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: () => void }) {
  return <div className="setting-row"><div><strong>{label}</strong>{description && <p>{description}</p>}</div><button className={`switch ${value ? 'on' : ''}`} role="switch" aria-label={label} aria-checked={value} onClick={onChange}><span /></button></div>;
}
export function Requirement({ met, children }: { met: boolean; children: ReactNode }) { return <div className={`requirement ${met ? 'met' : ''}`}>{met ? <CheckCircle size={18} weight="fill" /> : <LockKey size={18} />}<span>{children}</span></div>; }
