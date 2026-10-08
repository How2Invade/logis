'use client';

import { useRouter } from 'next/navigation';
import { Shield, ClipboardCheck, ArrowRight, Activity, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { signIn } from '@/lib/auth';

export default function EntryPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function enterAs(role: 'operations_manager' | 'quality_inspector') {
    signIn(role);
    if (role === 'operations_manager') {
      router.push('/dashboard');
    } else {
      router.push('/inspector');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-background">
      <div className="absolute top-6 left-6 z-50">
        <a href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-surface-2">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </a>
      </div>

      {/* Subtle background grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(24,24,24,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,24,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />

      <div className={`relative z-10 w-full max-w-md px-6 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        
        {/* Auth Card */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm p-8">
          
          <div className="flex flex-col items-center mb-10">
            <div className="w-32 h-32 mb-4 scale-[1.7] flex items-center justify-center">
              <img src="/logo.png" alt="LOGIS Logo" className="w-full h-full object-contain" />
            </div>
            
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
              LOGIS
            </h1>
            <p className="text-sm text-muted-foreground text-center">
              Product Incident Intelligence<br />& Operational Recovery
            </p>
            
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-warning/20 bg-warning/10 text-[10px] font-bold text-warning uppercase tracking-widest">
              <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
              Demo Environment
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => enterAs('operations_manager')}
              className="w-full group flex items-center justify-between px-5 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-[14px] hover:shadow-lg transition-all duration-200 active:scale-[0.98] shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 opacity-80" />
                <span>Enter as Operations</span>
              </div>
              <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => enterAs('quality_inspector')}
              className="w-full group flex items-center justify-between px-5 py-4 rounded-xl border border-border bg-surface hover:bg-surface-2 font-semibold text-[14px] text-foreground transition-all duration-200 active:scale-[0.98] hover:border-success/30"
            >
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-5 h-5 text-muted-foreground group-hover:text-success transition-colors" />
                <span>Enter as Quality Control</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-success group-hover:translate-x-1 transition-all" />
            </button>
          </div>
          
        </div>
        
        <p className="text-center text-[12px] text-muted-foreground mt-8 font-medium">
          Synthetic operational network · No credentials required
        </p>

      </div>
    </div>
  );
}
