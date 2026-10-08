'use client';

import React, { useEffect, useState } from 'react';
import { 
  LandingNavbar, HeroSection, ProblemSection, WorkflowSection,
  NetworkSection, ImpactSection, ResponseSection, RecoverySection,
  ScenariosSection, SdgSection, CtaFooter
} from '@/components/landing';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null; // Avoid hydration mismatch on initial render

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-foreground font-sans">
      <LandingNavbar />
      
      <main>
        <HeroSection />
        <ProblemSection />
        <WorkflowSection />
        <NetworkSection />
        <ImpactSection />
        <ResponseSection />
        <RecoverySection />
        <ScenariosSection />
        <SdgSection />
      </main>

      <CtaFooter />
    </div>
  );
}
