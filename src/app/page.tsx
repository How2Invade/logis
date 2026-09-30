'use client';

import { useRouter } from 'next/navigation';
import { Shield, ClipboardCheck, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function EntryPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function enterAs(role: 'operations_manager' | 'quality_inspector') {
    document.cookie = `logis_role=${role}; path=/; max-age=86400`;
    if (role === 'operations_manager') {
      router.push('/dashboard');
    } else {
      router.push('/inspector');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />
      
      {/* Subtle supply chain line motif */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" viewBox="0 0 1200 800">
        <path d="M0 400 Q300 350 600 400 T1200 400" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M0 300 Q400 250 800 300 T1200 350" stroke="currentColor" strokeWidth="0.5" fill="none" />
        <path d="M0 500 Q200 450 600 500 T1200 480" stroke="currentColor" strokeWidth="0.5" fill="none" />
        {[200, 400, 600, 800, 1000].map(x => (
          <circle key={x} cx={x} cy={400 + Math.sin(x / 100) * 30} r="3" fill="currentColor" opacity="0.5" />
        ))}
      </svg>

      <div className={`relative z-10 text-center max-w-2xl px-6 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Demo badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface/50 text-xs text-muted-foreground mb-8 backdrop-blur-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          DEMO ENVIRONMENT
        </div>

        {/* Wordmark */}
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-3">
          LOGIS
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg text-muted-foreground mb-2">
          Product Incident Intelligence & Operational Recovery
        </p>
        
        {/* Tagline */}
        <p className="text-sm text-muted mb-12">
          Understand the impact. Act precisely. Recover faster.
        </p>

        {/* Role buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <button
            onClick={() => enterAs('operations_manager')}
            className="group flex items-center justify-center gap-3 px-8 py-4 rounded-lg bg-foreground text-background font-medium text-sm
              hover:bg-foreground/90 transition-all duration-200 active:scale-[0.98]"
          >
            <Shield className="w-5 h-5" />
            Enter as Operations Manager
            <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200" />
          </button>

          <button
            onClick={() => enterAs('quality_inspector')}
            className="group flex items-center justify-center gap-3 px-8 py-4 rounded-lg border border-border bg-surface hover:bg-surface-2 
              font-medium text-sm text-foreground transition-all duration-200 active:scale-[0.98]"
          >
            <ClipboardCheck className="w-5 h-5" />
            Enter as Quality Inspector
            <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200" />
          </button>
        </div>

        <p className="text-xs text-muted">
          Synthetic operational network · No credentials required
        </p>
      </div>
    </div>
  );
}
