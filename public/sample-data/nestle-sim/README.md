# Nestlé India Simulated Supply Chain Dataset (Maggi 2015 Incident Intelligence Case)

> [!IMPORTANT]
> **SIMULATION NOTICE & DISCLAIMER:**
> Simulation inspired by publicly reported events involving Nestlé India's Maggi instant noodles in 2015. All supply-chain records (suppliers, lots, batches, pallets, shipments, quantities, costs) are synthetic and do NOT represent Nestlé's actual internal data. Names "Nestlé India" and "Maggi" are used strictly for simulation realism. All licence numbers, supplier names, contact emails, batch codes, and truck numbers are artificially generated.

---

## 1. Public-Event Context Modeled
* **Incident Classification:** Regulatory Test Dispute & Reverse-Logistics Operational Recovery.
* **Core Scenario:** In 2015, a regional food laboratory in Barabanki, Uttar Pradesh issued an adverse test notice on Maggi Masala noodle samples. The finding was disputed based on test protocol and product category definitions. LOGIS models the decision trade-offs:
  * **Option A (Blind Naive Destruction):** Scrap entire nationwide inventory instantly (\$Millions in unnecessary loss, product shortages).
  * **Option B (LOGIS Intelligent Triage):** **Scope & Hold + Re-test** at accredited NABL labs within 5 days, isolate affected regional clusters (Uttar Pradesh priority), and maintain safe inventory lines moving elsewhere.

---

## 2. Network Specifications
* **Suppliers:** 12 Indian regional suppliers (Punjab & MP wheat mills, Gujarat & AP palm refiners, Kerala & Gujarat spice blenders, Maharashtra packaging converters).
* **Materials:** 30 raw and packaging materials.
* **Supplier Lots:** 80 inbound lots with verified COA references and receipt timestamps.
* **Manufacturing Plants:** 5 regional plants (Moga-Punjab, Nanjangud-Karnataka, Tahliwal-Himachal/Haryana, Bicholim-Goa, Pantnagar-Uttarakhand) with 3 lines each and 2 shared tastemaker blending silos.
* **Batches:** 150 production runs over 90 days.
* **Warehouses:** 6 national distribution centers (Delhi, Lucknow, Kolkata, Mumbai, Bengaluru, Hyderabad).
* **Pallets:** 800 finished goods pallets.
* **Shipments & Downstream Customers:** 400 shipments dispatched to 120 customer nodes (Modern Trade, Quick-Commerce dark stores, and Regional Distributors across 10 Indian states).

---

## 3. Seeded Incidents & Ground Truth
1. **HERO INCIDENT (Contested State Lab Finding - Barabanki, UP):**
   * Triggered on suspect tastemaker lot `LOT-NESTLE-001` blended into Silo 1.
   * `method_disputed: true` $\rightarrow$ Recommends HOLD + Accredited Re-test with 5-day lead time.
2. **INCIDENT 2 (Supplier COA Retest Failure):**
   * Inbound spice lot failure in shared blender spreading across 2 manufacturing plants.
3. **INCIDENT 3 (Cold/Moisture Excursion on Highway Transit):**
   * Telemetry-triggered moisture breach on Lucknow corridor (`SHP-NESTLE-042`).

---

## 4. Realistic Noise Injected (in `nestle_sim_noisy.csv`)
* **10% Dropped `batchLotUsage` rows** (simulates unrecorded manual blend additions or ERP sync drops).
* **15% Downgraded to "probable"** confidence.
* **Overlapping batch windows & silo blending**.
* **3% Duplicate rows, out-of-order timestamps, whitespace inconsistencies**.
* **2% Pallets missing explicit batch IDs**.

---

## 5. Artifacts in this Directory
* `nestle_sim_complete.csv` — Full deterministic clean dataset (100% precision & recall baseline).
* `nestle_sim_noisy.csv` — Full industry dataset with realistic enterprise noise injected.
* `entities_payload.json` — Pre-parsed JSON payload for `/api/v1/import`.
* `truth.json` — Ground truth containing exact lists of affected, verification, and safe entities per incident.
* `cost_model.json` — Operational cost assumptions in INR (holding costs, disposal, re-testing, freight, OTIF penalties).
* `events_timeline.json` — Chronological timeline of public events with source notes.

