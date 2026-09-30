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
        'fixed lg:static inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface transition-all duration-300 shadow-lg lg:shadow-none',
        collapsed ? 'w-20' : 'w-72',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-4 px-6 h-20 border-b border-border shrink-0">
          <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center shrink-0 shadow-md">
            <Activity className="w-6 h-6 text-background" />
          </div>
          {!collapsed && (
            <span className="font-black text-xl tracking-wider text-foreground">LOGIS</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-2 text-muted-foreground transition-colors"
          >
            <ChevronLeft className={cn('w-5 h-5 transition-transform duration-300', collapsed && 'rotate-180')} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {navItems.map(item => {
            const active = pathname === item.href || 
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-bold transition-all duration-200',
                  active
                    ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-2 hover:scale-[1.02]'
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-border px-6 py-6 shrink-0 bg-surface">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            {!collapsed && (
              <span className="text-sm font-bold text-foreground">System Online</span>
            )}
          </div>
          {!collapsed && (
            <div className="mt-2 text-xs font-medium text-muted-foreground">
              Demo Role: Ops Manager
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-20 border-b border-border bg-surface flex items-center px-8 gap-6 shrink-0 shadow-sm z-40">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 border-border bg-surface-2/50 text-base font-medium text-muted-foreground hover:border-primary/50 hover:bg-surface transition-all max-w-md flex-1 group"
          >
            <Search className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span>Search incidents, facilities...</span>
            <kbd className="ml-auto text-xs px-2 py-1 rounded-md bg-background border border-border font-mono font-bold shadow-sm group-hover:border-primary/30 transition-colors">⌘K</kbd>
          </button>

          <div className="flex-1" />

          <ModeToggle />

          {/* Notifications */}
          <button className="relative text-muted-foreground hover:text-foreground transition-all p-2.5 rounded-xl hover:bg-surface-2 hover:shadow-sm">
            <Bell className="w-6 h-6" />
            <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-surface" />
          </button>

          {/* User */}
          <div className="flex items-center gap-3 ml-2 pl-6 border-l border-border h-10">
            <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-sm font-bold text-primary shadow-sm">
              DM
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-bold text-foreground">Demo Manager</span>
              <span className="text-xs font-medium text-muted-foreground">Ops Team</span>
            </div>
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
