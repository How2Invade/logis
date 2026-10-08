/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, Shield, Activity, Network, CheckCircle2, 
  AlertTriangle, Clock, Map, TrendingDown, Factory,
  Layers, Settings, Search, AlertOctagon, HeartPulse, Recycle, Target, X, UserCircle, ShieldCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth';
import { ModeToggle } from '@/components/mode-toggle';
import { LandingImpactMap } from '@/components/landing/LandingImpactMap';

const FADE_UP: any = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

const STAGGER = {
  visible: { transition: { staggerChildren: 0.1 } }
};

// ---------------------------------------------------------
// NAVBAR
// ---------------------------------------------------------
export const LandingNavbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const login = () => {
    signIn('operations_manager');
    router.push('/dashboard');
  };

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/80 backdrop-blur-md border-b border-border shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="LOGIS" className="w-12 h-12 object-contain scale-[1.3]" />
            <span className="font-bold text-foreground tracking-tight text-2xl">LOGIS</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#platform" className="hover:text-foreground transition-colors">Platform</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#impact" className="hover:text-foreground transition-colors">Impact</a>
            <a href="#recovery" className="hover:text-foreground transition-colors">Recovery</a>
          </div>
          
          <div className="flex items-center gap-4">
            <ModeToggle collapsed={false} />
            <a href="/login" className="hidden md:block text-sm font-medium text-foreground hover:text-primary transition-colors">
              Log in
            </a>
            <a href="/login" className="group flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-full text-sm font-semibold shadow-lg hover:shadow-primary/20 hover:scale-105 transition-all">
              Get Started 
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </nav>
    </>
  );
};

// ---------------------------------------------------------
// HERO
// ---------------------------------------------------------
export const HeroSection = () => {
  const router = useRouter();
  const enterApp = () => {
    signIn('operations_manager');
    router.push('/dashboard');
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/10 blur-[100px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        
        <motion.div initial="hidden" animate="visible" variants={STAGGER} className="z-10">
          <motion.div variants={FADE_UP} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/10 text-[10px] font-bold text-primary uppercase tracking-widest mb-6 shadow-sm">
            Incident Intelligence &middot; Operational Recovery
          </motion.div>
          <motion.h1 variants={FADE_UP} className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-6">
            Turn supply-chain incidents into the <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-500">next best action.</span>
          </motion.h1>
          <motion.p variants={FADE_UP} className="text-lg text-muted-foreground mb-8 max-w-xl leading-relaxed">
            Trace the impact. Isolate the risk. Coordinate the response. Recover faster.
          </motion.p>
          <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row gap-4">
            <a href="/login" className="group flex items-center justify-center gap-2 bg-primary text-primary-foreground px-7 py-3.5 rounded-full text-[15px] font-semibold shadow-xl hover:shadow-primary/25 hover:scale-105 transition-all">
              Open Command Center
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="#how-it-works" className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border border-border bg-surface text-foreground text-[15px] font-semibold shadow-sm hover:bg-surface-2 hover:scale-105 transition-all">
              See how it works
            </a>
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative lg:h-[500px] flex items-center justify-center">
          {/* Illustration */}
          <div className="relative w-full h-[400px] md:h-full border border-border hover:border-primary/50 rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden flex items-center justify-center bg-surface-2 group">
            
            <img 
              src="/hero-illustration.jpg" 
              alt="LOGIS Supply Chain" 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out" 
            />
            
            {/* Overlay gradient for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />

            {/* Floating Card */}
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.5 }} className="absolute bottom-6 left-6 right-6 bg-surface/90 backdrop-blur-md border border-border rounded-xl p-4 shadow-2xl">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">INC-003</span>
                <span className="text-[10px] bg-critical/10 text-critical px-2 py-0.5 rounded-full font-bold">CRITICAL</span>
              </div>
              <div className="text-sm font-semibold text-foreground mb-1">Microbial contamination</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-critical" /> 7,975 affected units traced
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------
// PROBLEM CARDS
// ---------------------------------------------------------
export const ProblemSection = () => {
  return (
    <section className="py-20 bg-surface-2/30 border-y border-border" id="platform">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">One incident can ripple through an entire network.</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A single affected lot can move through batches, warehouses, shipments and stores before anyone sees the full picture.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Search, title: 'TRACE', desc: 'Follow the incident through the supply network.' },
            { icon: Activity, title: 'ASSESS', desc: 'Separate affected, safe and uncertain inventory.' },
            { icon: Shield, title: 'ACT', desc: 'Turn intelligence into coordinated response.' }
          ].map((item, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -4 }}
              className="bg-surface border-t-2 border-t-border border-x border-b border-border rounded-b-2xl rounded-t-sm p-8 shadow-sm hover:border-t-primary hover:shadow-lg hover:shadow-primary/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
                <item.icon className="w-6 h-6 text-primary transition-colors" />
              </div>
              <h3 className="text-sm font-bold text-foreground tracking-widest uppercase mb-3">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------
// WORKFLOW (TRACE -> ASSESS -> RESPOND -> RECOVER)
// ---------------------------------------------------------
export const WorkflowSection = () => {
  const steps = [
    { num: '01', title: 'TRACE', desc: 'Find where the incident traveled.' },
    { num: '02', title: 'ASSESS', desc: 'Measure the actual blast radius.' },
    { num: '03', title: 'RESPOND', desc: 'Execute targeted operational actions.' },
    { num: '04', title: 'RECOVER', desc: 'Redirect safe resources toward unmet demand.' },
  ];

  return (
    <section className="py-24" id="how-it-works">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-foreground mb-16 text-center">From first signal to operational recovery.</h2>
        
        <div className="relative">
          <div className="absolute top-6 left-6 right-6 h-[2px] bg-border hidden md:block" />
          <div className="absolute top-6 bottom-6 left-6 w-[2px] bg-border md:hidden" />
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
            {steps.map((step, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="relative pl-12 md:pl-0"
              >
                <div className="absolute md:relative left-0 md:mb-6 w-12 h-12 rounded-full bg-surface border-2 border-primary/40 flex items-center justify-center text-xs font-bold text-primary z-10 shadow-[0_0_15px_rgba(234,88,12,0.15)] group-hover:border-primary group-hover:scale-110 transition-all">
                  {step.num}
                </div>
                <h3 className="text-sm font-bold tracking-widest text-foreground uppercase mt-1 md:mt-0 mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------
// NETWORK SECTION
// ---------------------------------------------------------
export const NetworkSection = () => {
  return (
    <section className="py-24 bg-surface-2/30 border-y border-border overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">See the impact before you act.</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          LOGIS turns complex supply-chain relationships into an operational map you can explore, trace and act on.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 relative">
        <div className="aspect-[16/9] lg:aspect-[2/1] bg-surface border border-border rounded-2xl shadow-lg hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col">
          
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface-2/50 relative z-20">
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-critical"></div>Affected</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-success"></div>Safe</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-warning"></div>Needs Verification</div>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold hidden sm:block">
              Synthetic demonstration data
            </div>
          </div>
          
          {/* Real Graph Body */}
          <div className="flex-1 relative bg-surface">
            <LandingImpactMap />
          </div>
          
          {/* Footer Metrics */}
          <div className="px-6 py-4 border-t border-border bg-surface flex justify-between relative z-20">
            <div className="text-center"><div className="text-lg font-bold text-foreground">301</div><div className="text-[10px] uppercase text-muted-foreground font-bold">Network Nodes</div></div>
            <div className="text-center"><div className="text-lg font-bold text-foreground">524</div><div className="text-[10px] uppercase text-muted-foreground font-bold">Connections</div></div>
            <div className="text-center hidden sm:block"><div className="text-lg font-bold text-foreground">4</div><div className="text-[10px] uppercase text-muted-foreground font-bold">Warehouses</div></div>
            <div className="text-center hidden sm:block"><div className="text-lg font-bold text-foreground">18</div><div className="text-[10px] uppercase text-muted-foreground font-bold">Stores</div></div>
          </div>

        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------
// IMPACT SECTION
// ---------------------------------------------------------
export const ImpactSection = () => {
  return (
    <section className="py-24" id="impact">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Know exactly what is at risk.</h2>
          <p className="text-muted-foreground mb-8">
            Stop guessing. LOGIS calculates the precise operational exposure by aggregating the status of every connected node in real-time.
          </p>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-4">Synthetic demonstration data &middot; INC-003</div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
            <div className="text-3xl font-bold text-critical tabular-nums mb-1">7,975</div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Affected</div>
          </div>
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
            <div className="text-3xl font-bold text-success tabular-nums mb-1">12,949</div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Safe</div>
          </div>
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
            <div className="text-3xl font-bold text-warning tabular-nums mb-1">732</div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Needs Verif.</div>
          </div>
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
            <div className="text-3xl font-bold text-foreground tabular-nums mb-1">2,343</div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Already Sold</div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------
// RESPONSE SECTION
// ---------------------------------------------------------
export const ResponseSection = () => {
  return (
    <section className="py-24 bg-surface-2/30 border-y border-border">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        <div className="order-2 md:order-1 bg-surface border border-border hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
            <div className="text-xs font-bold text-foreground uppercase tracking-widest">Action Tracker</div>
            <div className="text-xs font-semibold text-muted-foreground">4 / 6 completed</div>
          </div>
          
          <div className="space-y-3">
            {[
              { text: 'Quarantine affected inventory WH-001', status: 'approved' },
              { text: 'Stop shipment SH-0019', status: 'approved' },
              { text: 'Withdraw from Store ST-042', status: 'approved' },
              { text: 'Customer recall for Batch 4A', status: 'rejected' },
              { text: 'Inspect Batch B55', status: 'pending', priority: 'critical' },
              { text: 'Verify WH-002 inventory', status: 'pending', priority: 'warning' }
            ].map((action, i) => (
              <div key={i} className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${action.status !== 'pending' ? 'bg-surface-2/50 border-transparent opacity-60' : 'bg-surface border-border shadow-sm'}`}>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${action.status !== 'pending' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{action.text}</div>
                  {action.status !== 'pending' ? (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {action.status === 'approved' ? 'Approved' : 'Rejected'} today at 09:42 AM
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${action.priority === 'critical' ? 'bg-critical/10 text-critical' : 'bg-warning/10 text-warning'}`}>
                        {action.priority}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Operations Team</span>
                    </div>
                  )}
                </div>
                {action.status === 'pending' ? (
                  <div className="flex gap-2 shrink-0">
                    <button className="p-1.5 rounded-md hover:bg-success/10 text-success transition-colors border border-success/20">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded-md hover:bg-critical/10 text-critical transition-colors border border-critical/20">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : action.status === 'approved' ? (
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                ) : (
                  <X className="w-5 h-5 text-critical shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="order-1 md:order-2">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Insight is only useful when it becomes action.</h2>
          <p className="text-muted-foreground mb-8">
            LOGIS auto-generates a targeted response plan based on the graph analysis. Assign owners, set priorities, and track operational execution in real-time.
          </p>
          <a href="#" className="inline-flex items-center gap-2 text-primary font-semibold hover:opacity-80 transition-opacity">
            See response workflow <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------
// RECOVERY SECTION
// ---------------------------------------------------------
export const RecoverySection = () => {
  return (
    <section className="py-24" id="recovery">
      <div className="max-w-7xl mx-auto px-6 text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Contain the incident. Then recover the operation.</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          LOGIS matches available safe capacity with disrupted demand to help teams recover value faster.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-surface border border-border hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 rounded-2xl p-8 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-bl-full" />
          
          <div className="grid md:grid-cols-[1fr_auto_1fr] gap-8 items-center">
            <div className="space-y-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Available Capacity</div>
              {['Homogenizer Alpha', 'Cheese Press Delta', 'Fermentation Unit C'].map((c, i) => (
                <div key={i} className="bg-surface-2 p-3 rounded-lg border border-border text-sm font-medium text-foreground">
                  {c} <span className="float-right text-success text-xs font-bold mt-0.5">Free</span>
                </div>
              ))}
            </div>
            
            <div className="hidden md:flex flex-col items-center justify-center gap-2">
              <ArrowRight className="w-6 h-6 text-muted-foreground opacity-50" />
              <ArrowRight className="w-6 h-6 text-muted-foreground opacity-50" />
              <ArrowRight className="w-6 h-6 text-muted-foreground opacity-50" />
            </div>

            <div className="space-y-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Unmet Demand</div>
              {['Nova Butter (2k units)', 'Cheese Spread (2k units)', 'Paneer (700 units)'].map((d, i) => (
                <div key={i} className="bg-surface-2 p-3 rounded-lg border border-border text-sm font-medium text-foreground">
                  {d} <span className="float-right text-critical text-xs font-bold mt-0.5">At Risk</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <div className="text-3xl font-bold text-foreground tabular-nums">₹2.22L</div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Potential recovery value</div>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Synthetic demonstration data
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------
// COMMAND CENTER / SCENARIO
// ---------------------------------------------------------
export const ScenariosSection = () => {
  return (
    <section className="py-24 bg-surface-2/30 border-y border-border">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">Make the cost of inaction visible.</h2>
          
          <div className="space-y-6 mb-8">
            <div className="bg-surface border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 rounded-xl p-5 shadow-sm">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Broad Response (Naive)</div>
              <div className="flex justify-between items-end">
                <div className="text-2xl font-bold text-foreground">23,999 <span className="text-sm font-medium text-muted-foreground">units recalled</span></div>
              </div>
            </div>
            
            <div className="bg-surface border border-primary/30 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/15 hover:-translate-y-1 transition-all duration-300 rounded-xl p-5 shadow-md relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">LOGIS Targeted Response</div>
              <div className="flex justify-between items-end">
                <div className="text-2xl font-bold text-foreground">9,989 <span className="text-sm font-medium text-muted-foreground">units targeted</span></div>
                <div className="text-right">
                  <div className="text-lg font-bold text-success">14,010</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Avoided Recalls</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Simulated / synthetic demonstration values</div>
        </div>

        <div className="bg-surface border border-border hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 rounded-2xl p-8 shadow-sm">
          <h3 className="text-xl font-bold text-foreground mb-2">Plan for what happens next.</h3>
          <p className="text-sm text-muted-foreground mb-8">Compare hypothetical outcomes with Scenario Analysis.</p>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-surface-2">
              <span className="text-sm font-medium text-muted-foreground">Baseline Cost</span>
              <span className="text-sm font-bold text-foreground tabular-nums">₹1,39,281</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg border border-border bg-surface shadow-sm">
              <div>
                <span className="text-sm font-bold text-foreground block">Scenario: Added Contamination</span>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">+1,060 affected units</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-foreground tabular-nums block">₹1,45,531</span>
                <span className="text-[10px] text-critical uppercase font-bold tracking-widest">+₹6,250</span>
              </div>
            </div>
          </div>
          
          <a href="#" className="inline-flex items-center gap-2 text-primary text-sm font-semibold hover:opacity-80 transition-opacity mt-6">
            Explore scenarios <ArrowRight className="w-4 h-4" />
          </a>
        </div>

      </div>
    </section>
  );
};

// ---------------------------------------------------------
// SDG SECTION
// ---------------------------------------------------------
export const SdgSection = () => {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-foreground text-center mb-16">Built for more resilient operations.</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 border border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1 rounded-[2rem] bg-surface shadow-sm text-center flex flex-col items-center group">
            <img src="/sdg3.png" alt="SDG 3" className="w-32 h-32 rounded-2xl mb-6 shadow-md object-cover group-hover:scale-105 transition-transform" />
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">SDG 3</div>
            <h3 className="text-sm font-bold text-foreground mb-3">GOOD HEALTH & WELL-BEING</h3>
            <p className="text-sm text-muted-foreground">Faster containment can help reduce exposure to unsafe products.</p>
          </div>
          <div className="p-6 border border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1 rounded-[2rem] bg-surface shadow-sm text-center flex flex-col items-center group">
            <img src="/sdg9.png" alt="SDG 9" className="w-32 h-32 rounded-2xl mb-6 shadow-md object-cover group-hover:scale-105 transition-transform" />
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">SDG 9</div>
            <h3 className="text-sm font-bold text-foreground mb-3">INDUSTRY, INNOVATION & INFRASTRUCTURE</h3>
            <p className="text-sm text-muted-foreground">Intelligent infrastructure for complex operational networks.</p>
          </div>
          <div className="p-6 border border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1 rounded-[2rem] bg-surface shadow-sm text-center flex flex-col items-center group">
            <img src="/sdg12.png" alt="SDG 12" className="w-32 h-32 rounded-2xl mb-6 shadow-md object-cover group-hover:scale-105 transition-transform" />
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">SDG 12</div>
            <h3 className="text-sm font-bold text-foreground mb-3">RESPONSIBLE CONSUMPTION & PRODUCTION</h3>
            <p className="text-sm text-muted-foreground">Targeted intervention can reduce unnecessary recalls and product waste.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------
// CTA & FOOTER
// ---------------------------------------------------------
export const CtaFooter = () => {
  const router = useRouter();
  const enterApp = () => {
    signIn('operations_manager');
    router.push('/dashboard');
  };

  return (
    <>
      <section className="py-24 bg-foreground text-background text-center px-6">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">Trace smarter. Respond faster. Recover stronger.</h2>
        <p className="text-background/70 max-w-2xl mx-auto mb-10 text-lg">
          LOGIS gives operations teams the intelligence to act with precision when disruption hits.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button onClick={enterApp} className="flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-full text-[15px] font-semibold hover:bg-primary/90 transition-all shadow-lg">
            Open LOGIS Command Center <ArrowRight className="w-4 h-4" />
          </button>
          <a href="#platform" className="flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-background/20 text-background text-[15px] font-semibold hover:bg-background/10 transition-all">
            Explore the platform
          </a>
        </div>
      </section>

      <footer className="py-12 bg-surface border-t border-border px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src="/logo.png" alt="LOGIS" className="w-6 h-6 object-contain grayscale opacity-70" />
              <span className="font-bold text-foreground tracking-tight text-lg">LOGIS</span>
            </div>
            <div className="text-xs text-muted-foreground">Incident Intelligence &middot; Operational Recovery</div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Platform</a>
            <a href="#" className="hover:text-foreground transition-colors">How it works</a>
            <a href="/dashboard" className="hover:text-foreground transition-colors">Command Center</a>
            <a href="/dashboard/reports" className="hover:text-foreground transition-colors">Reports</a>
            <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-border text-center md:text-left text-[11px] text-muted-foreground font-medium uppercase tracking-widest">
          Synthetic demonstration environment
        </div>
      </footer>
    </>
  );
};
