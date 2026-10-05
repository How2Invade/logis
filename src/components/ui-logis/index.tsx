import { cn } from "@/lib/utils";
import { Check, ChevronRight } from "lucide-react";

export function StatCard({ label, value, percent, color, info }: { label: string, value: string, percent: number, color: string, info?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col justify-between shadow-sm transition-colors duration-300" title={info}>
      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{label}</div>
      <div className="text-3xl font-semibold tabular-nums text-foreground mb-4">{value}</div>
      <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <div className="text-[11px] text-muted-foreground mt-2 font-medium">{percent}% of total</div>
    </div>
  );
}

export function StatusBadge({ status, color }: { status: string, color: string }) {
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border" 
      style={{ backgroundColor: `${color}15`, color: color, borderColor: `${color}30` }}>
      {status}
    </span>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-[17px] font-semibold text-foreground mb-4">{title}</h3>
  );
}

export function WorkflowStepper({ currentStep }: { currentStep: number }) {
  const steps = ["Detect", "Analyze impact", "Response plan", "Recovery"];
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, idx) => {
        const stepNum = idx + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;
        return (
          <div key={step} className="flex items-center gap-2">
            <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-colors duration-300", 
              isCompleted ? "bg-success text-white" : 
              isCurrent ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground border border-border")}>
              {isCompleted ? <Check className="w-3 h-3" /> : <span>{stepNum}</span>}
              {step}
            </div>
            {stepNum < steps.length && <ChevronRight className="w-3 h-3 text-border" />}
          </div>
        );
      })}
    </div>
  );
}

export function ActivityItem({ text, time, color }: { text: string, time: string, color: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-foreground">{text}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground">{time}</span>
        </div>
      </div>
    </div>
  );
}
