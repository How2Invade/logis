# LOGIS — Product Incident Intelligence & Operational Recovery

> **Project Handover & Architectural Blueprint**  
> **Repository Root**: `/Users/jeetchavan/LOGIS_MCRC/logis`  
> **Stack**: Next.js 16 (App Router + Turbopack), TypeScript, React 19, Tailwind CSS v4, `@xyflow/react` (React Flow), SQLite (`better-sqlite3`), `dagre`, `recharts`, `lucide-react`.

---

## 1. What is LOGIS?

**LOGIS** is an enterprise operational decision engine designed for FMCG, food manufacturing, and complex supply chain networks facing product contamination, recalls, or quality excursions.

### The Problem It Solves
Traditional manufacturers respond to contamination with **naive, broad-brush recalls**—halting entire multi-state production lines, discarding hundreds of thousands of safe products, and waiting weeks for manual QA audits. This leads to catastrophic revenue losses, brand damage, and supply shortfalls.

### The LOGIS Solution
LOGIS uses directed acyclic supply-chain graphs (DAGs) and heuristic scoring to enable **surgical containment**:
1. **Trace the exact contagion path** from raw material lot $\to$ production batches $\to$ warehouse pallets $\to$ intransit shipments $\to$ retail darkstores.
2. **Quarantine only what is truly affected** while rapidly identifying and clearing unlinked pallets ("Clean Stock").
3. **Reallocate idle factory capacity** (machines, skilled labor, warehouse slots) to cover retail demand shortfalls before retail commitments fail.

---

## 2. System Architecture & Page Hierarchy

The app is divided into three core workflows (**OPERATE**, **ACT**, **REPORT**):

```
├── OPERATE
│   ├── Overview (/dashboard)            → Command center KPIs, active incident alert, live telemetry
│   ├── Incidents (/dashboard/incidents)  → Master incident registry, severity classification, status
│   └── Impact Map (/dashboard/impact)    → Full interactive React Flow DAG with trace-down animations
│
├── ACT
│   ├── Response (/dashboard/response)    → Surgical containment plan, CUS scoring, Clean Stock, Decision Impact
│   ├── Recovery (/dashboard/recovery)    → Resource reallocation, product demand gaps, machine recovery plans
│   ├── Resources (/dashboard/resources)  → Registry of machines, workers, warehouse slots, and trucks
│   └── Scenarios (/dashboard/scenarios)  → What-if simulation sandbox (quarantine delays, alternate routing)
│
└── REPORT
    ├── Reports (/dashboard/reports)      → Regulatory compliance exports, Executive Summary, PDF generation
    └── Settings (/dashboard/settings)    → CSV data importer, active simulation switcher, audit trail
```

---

## 3. Core Modules & Key Logic

### A. Impact Map (`/dashboard/impact`)
- **Engine**: `@xyflow/react` + `dagre` layout engine (`rankdir: 'LR'`).
- **Functionality**:
  - Maps 800+ nodes across 8 tiers: `Supplier` $\to$ `Material` $\to$ `Lot` $\to$ `Batch` $\to$ `Product` $\to$ `Warehouse` $\to$ `Shipment` $\to$ `Store`.
  - **Trace Downstream**: Animated BFS traversal that guides the user along the contagion path from the source lot down to affected stores.
  - **Performance Optimization**: Nodes are wrapped in `React.memo` with a custom comparator; zoom levels use discrete boolean subscriptions (`useStore(s => s.transform[2] >= 0.7)`) and coordinate camera pans via `setCenter` to eliminate lag on 800+ node graphs.

### B. Response Plan (`/dashboard/response`)
- **Contamination Urgency Score (CUS)** (`src/lib/cus.ts`):
  - Mathematical risk index ($0$ to $100$) calculating the ratio of units already in consumer/retail hands ("Escaped Units") vs units interceptable in warehouses/lines ("Interceptable Units").
  - Identifies top surgical cut-points (e.g. halting specific packaging lines) with live checkbox recalculation.
- **Clean Stock Velocity & Hold Evaluation** (`src/components/CleanStockCard.tsx`):
  - Evaluates warehouse inventory with strict hold-by-default isolation.
  - Automatically identifies pallets with zero graph connection to the contaminated lot as **Release Candidates**, requiring manual QA sign-off before dispatch.
- **LOGIS Decision Impact**:
  - Compares LOGIS surgical containment against a naive mass-recall baseline (calculates unnecessary recalls avoided, monetary exposure saved, and recovery hours gained).

### C. Recovery Center (`/dashboard/recovery`)
- **Service**: `src/services/recoveryService.ts`
- **Functionality**:
  - **Demand Gap by Product**: Product-level horizontal bar charts comparing available operational capacity against unmet demand gaps created by the incident.
  - **Proposed Allocations**: Multi-factor greedy allocation algorithm that assigns idle production lines to products based on revenue recovered, gap urgency, and plant affinity (e.g. Punjab lines to Chicken Noodles, Uttar Pradesh lines to Masala Noodles).
  - **Before vs After Simulation**: Tracks reduction in idle machines and projected recovery time.

### D. Resources (`/dashboard/resources`)
- **Database Tables**: `machines`, `workers`, `warehouses`, `trucks`.
- **Dynamic Skill Detection**: Detects product category on import—dairy datasets receive dairy skills (`pasteurization`, `fermentation`), while FMCG/noodle datasets receive dry manufacturing skills (`food_manufacturing`, `noodle_extrusion`, `seasoning_blending`, `packaging`, `quality_control`).

---

## 4. Database Schema (`logis.db` — SQLite)

The backend uses a local SQLite database accessed synchronously via `better-sqlite3`:

| Table | Purpose |
| :--- | :--- |
| **`incidents`** | Primary incident records (`id`, `source_lot`, `severity`, `status`, `title`, `description`) |
| **`suppliers`** | Raw material suppliers (`id`, `name`, `location`, `rating`) |
| **`materials`** | Raw materials (`id`, `name`, `supplier_id`, `category`) |
| **`lots`** | Raw material lots received (`id`, `material_id`, `quantity`, `status`) |
| **`products`** | Finished goods SKUs (`id`, `name`, `unit_price`, `category`) |
| **`batches`** | Factory manufacturing batches (`id`, `product_id`, `machine_id`, `quantity`, `status`) |
| **`batch_lot_usage`** | M:N genealogy mapping lot usage into batches with `confidence` and `fraction` |
| **`warehouses`** | Regional distribution centers and storage hubs (`id`, `name`, `capacity`, `free_slots`) |
| **`inventory`** | Palletized stock stored in warehouses (`id`, `warehouse_id`, `batch_id`, `quantity`) |
| **`shipments`** | In-transit dispatches (`id`, `batch_id`, `origin`, `destination`, `quantity`, `status`) |
| **`stores`** | Retail destination endpoints / darkstores (`id`, `name`, `location`) |
| **`machines`** | Production lines (`id`, `capacity_per_day`, `compatible_products`, `status`) |
| **`workers`** | Factory shifts and crews (`id`, `name`, `skills` JSON, `shift_hours`, `status`) |
| **`demand`** | Retail order commitments and shortfalls (`id`, `product_id`, `units`, `deadline`, `unit_value`) |
| **`cost_rates`** | Unit cost rates for transport, quarantine, changeover, and penalties |
| **`dataset_meta`** | Active dataset metadata (`name`, `source_file`, `is_simulation`) |

---

## 5. Active Datasets & Simulation Modes

1. **NovaFoods Dairy Network** (Baseline Demo Seed):
   - Products: Fresh Milk, Paneer, Yogurt, Butter, Cheese Spread.
   - Incident `INC-001`: Microbial contamination in whole milk lot `MILK-204`.
2. **Nestlé India (Maggi 2015 Simulation)** (`nestle_sim_complete.csv`):
   - Products: Maggi 2-Minute Noodles Masala 70g, Maggi Special Chicken Noodles 70g.
   - Incident `INC-2015-UP-001`: Contested state lab finding in Barabanki, UP.
   - Multi-plant distribution spanning Punjab, Uttar Pradesh, Delhi, Bengaluru, Mumbai, and Kolkata hubs.

---

## 6. Developer Guidelines & Constraints

- **Theme & UI**: Pure dark mode using semantic design tokens (`bg-surface`, `bg-surface-2`, `border-border`, `text-primary`, `text-critical`, `text-success`, `text-warning`).
- **Numeric Formatting**: Financial and inventory metrics use Indian number grouping via `formatNumber` and `formatCurrency` in `src/lib/utils.ts` (e.g. `10,20,331`, `₹1,36,692`).
- **Build Command**: `cd logis && npm run build` (runs Next.js Turbopack type checking and page optimization).
- **Git Commit Attribution**: ONLY attribute commits to the user. Never include AI co-author trailers (`Co-authored-by: Claude...`).

