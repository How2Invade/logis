'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, AlertTriangle, Map, ShieldCheck, Wrench,
  BarChart3, Settings, Truck, Layers, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModeToggle } from '@/components/mode-toggle';
import { useEffect, useState } from 'react';
import { isAuthenticated, signOut } from '@/lib/auth';

const navGroups = [
  {
    title: 'OPERATE',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
      { href: '/dashboard/incidents', icon: AlertTriangle, label: 'Incidents' },
      { href: '/dashboard/impact', icon: Map, label: 'Impact Map' },
    ]
  },
  {
    title: 'ACT',
    items: [
      { href: '/dashboard/response', icon: ShieldCheck, label: 'Response' },
      { href: '/dashboard/recovery', icon: Wrench, label: 'Recovery' },
      { href: '/dashboard/resources', icon: Truck, label: 'Resources' },
      { href: '/dashboard/scenarios', icon: Layers, label: 'Scenarios' },
    ]
  },
  {
    title: 'REPORT',
    items: [
      { href: '/dashboard/reports', icon: BarChart3, label: 'Reports' },
      { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
    ]
  }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const check = () => {
      if (!isAuthenticated()) {
        window.location.replace('/');
      } else {
        setAuthorized(true);
      }
    };
    check();
    // Re-check when a page is restored from the back/forward cache after logout.
    const onPageShow = () => check();
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  if (!authorized) {
    return <div className="h-screen bg-background" />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-300">
      {/* Sidebar */}
      <aside className="flex flex-col bg-background border-r border-border shrink-0 z-50 w-[200px]">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-[56px] shrink-0 border-b border-border">
          <img src="/logo.png" alt="LOGIS Logo" className="w-12 h-12 shrink-0 scale-[1.7] -ml-1 object-contain" />
          <span className="font-bold text-[14px] tracking-widest whitespace-nowrap">
            LOGIS
          </span>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="mb-6">
               <div className="px-5 mb-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                {group.title}
              </div>
              <div className="space-y-0.5 px-3">
                {group.items.map(item => {
                  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 h-[34px] px-2 text-[13px] font-medium transition-colors rounded-lg',
                        active ? 'bg-dark-action text-dark-action-fg shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                      )}
                      title={item.label}
                    >
                      <item.icon className={cn("w-[16px] h-[16px] shrink-0", active ? "text-dark-action-fg" : "text-muted-foreground group-hover:text-foreground")} />
                      <span className="whitespace-nowrap">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="p-4 shrink-0 border-t border-border flex flex-col gap-3">
          <ModeToggle collapsed={false} />
          <div className="min-w-0 pt-2 border-t border-border border-dashed">
            <div className="text-[13px] font-semibold truncate text-foreground leading-none mb-1">Ethan Moore</div>
            <div className="text-[11px] text-muted-foreground mb-3">Operations Manager</div>
            <button 
              onClick={signOut}
              className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-auto bg-background transition-colors duration-300">
        <main>
          {children}
        </main>
      </div>
    </div>
  );
}
