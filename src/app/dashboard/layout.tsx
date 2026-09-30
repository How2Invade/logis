'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, AlertTriangle, Map, ShieldCheck, Wrench,
  BoxSelect, BarChart3, Settings, Search, Bell, ChevronLeft,
  Activity, Truck, Database as DbIcon, Menu, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModeToggle } from '@/components/mode-toggle';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/dashboard/incidents', icon: AlertTriangle, label: 'Incidents' },
  { href: '/dashboard/impact', icon: Map, label: 'Impact Map' },
  { href: '/dashboard/response', icon: ShieldCheck, label: 'Response' },
  { href: '/dashboard/recovery', icon: Wrench, label: 'Recovery' },
  { href: '/dashboard/resources', icon: Truck, label: 'Resources' },
  { href: '/dashboard/scenarios', icon: Layers, label: 'Scenarios' },
  { href: '/dashboard/reports', icon: BarChart3, label: 'Reports' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface transition-all duration-200',
        collapsed ? 'w-16' : 'w-56',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
          <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-background" />
          </div>
          {!collapsed && (
            <span className="font-bold text-sm tracking-wide">LOGIS</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden lg:flex items-center justify-center w-6 h-6 rounded hover:bg-surface-2 text-muted"
          >
            <ChevronLeft className={cn('w-3.5 h-3.5 transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map(item => {
            const active = pathname === item.href || 
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                )}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-border px-4 py-4 shrink-0 bg-surface">
          <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            {!collapsed && (
              <span className="text-xs font-medium text-foreground">System Online</span>
            )}
          </div>
          {!collapsed && (
            <div className="mt-1.5 text-[10px] text-muted-foreground">
              Demo Role: Ops Manager
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-surface flex items-center px-4 gap-4 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-sm text-muted-foreground 
              hover:border-muted transition-colors max-w-xs flex-1"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search…</span>
            <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-border font-mono">⌘K</kbd>
          </button>

          <div className="flex-1" />

          <ModeToggle />

          {/* Notifications */}
          <button className="relative text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded hover:bg-surface">
            <Bell className="w-4.5 h-4.5" />
            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
          </button>

          {/* User */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-medium">
              DM
            </div>
            <span className="hidden sm:inline text-muted-foreground">Demo Manager</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Search Modal */}
      {searchOpen && (
        <SearchModal onClose={() => setSearchOpen(false)} />
      )}
    </div>
  );
}

function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.data || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  const typeIcons: Record<string, typeof AlertTriangle> = {
    incident: AlertTriangle,
    lot: DbIcon,
    batch: BoxSelect,
    product: BoxSelect,
    warehouse: BoxSelect,
    store: BoxSelect,
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-4 h-4 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search incidents, lots, products, warehouses…"
            className="flex-1 py-3 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-border font-mono text-muted">ESC</kbd>
        </div>
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto p-2">
            {results.map((r, i) => {
              const Icon = typeIcons[r.type] || BoxSelect;
              return (
                <button
                  key={`${r.type}-${r.id}-${i}`}
                  onClick={onClose}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-left hover:bg-surface-2 transition-colors"
                >
                  <Icon className="w-4 h-4 text-muted shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.label}</div>
                    <div className="text-xs text-muted truncate">{r.type} · {r.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {query && !loading && results.length === 0 && (
          <div className="p-6 text-center text-sm text-muted">No results found</div>
        )}
        {loading && (
          <div className="p-4">
            {[1,2,3].map(i => <div key={i} className="skeleton h-10 mb-2 rounded-md" />)}
          </div>
        )}
      </div>
    </div>
  );
}
