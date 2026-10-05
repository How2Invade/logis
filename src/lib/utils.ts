import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

export function formatCurrency(n: number): string {
  return `₹${new Intl.NumberFormat('en-IN').format(Math.round(n))}`;
}

export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatTimeAgo(d: string): string {
  const now = Date.now();
  const then = new Date(d).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const severityColors: Record<string, string> = {
  critical: 'bg-critical/10 text-critical border-critical/20',
  high: 'bg-primary/10 text-primary border-primary/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-foreground/10 text-foreground border-border',
};

export const statusColors: Record<string, string> = {
  source: 'bg-critical/10 text-critical border-critical/20',
  affected: 'bg-critical/10 text-critical border-critical/20',
  uncertain: 'bg-warning/10 text-warning border-warning/20',
  safe: 'bg-success/10 text-success border-success/20',
  sold: 'bg-muted/10 text-muted-foreground border-border',
  unaccounted: 'bg-primary/10 text-primary border-primary/20',
  not_relevant: 'bg-surface-2 text-muted border-border',
};

export const incidentStatusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border border-warning/20',
  analyzing: 'bg-primary/10 text-primary border border-primary/20',
  analyzed: 'bg-primary/10 text-primary border border-primary/20',
  responding: 'bg-primary/10 text-primary border border-primary/20',
  recovering: 'bg-primary/10 text-primary border border-primary/20',
  resolved: 'bg-success/10 text-success border border-success/20',
};
