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
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

export const statusColors: Record<string, string> = {
  source: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  affected: 'bg-red-500/15 text-red-400 border-red-500/30',
  uncertain: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  safe: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  sold: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  unaccounted: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  not_relevant: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

export const incidentStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400',
  analyzing: 'bg-blue-500/15 text-blue-400',
  analyzed: 'bg-cyan-500/15 text-cyan-400',
  responding: 'bg-orange-500/15 text-orange-400',
  recovering: 'bg-purple-500/15 text-purple-400',
  resolved: 'bg-emerald-500/15 text-emerald-400',
};
