@AGENTS.md

# Claude Assistant Guidelines for LOGIS

## 🚨 Git Commit Attribution Rules (STRICT)
- **NEVER** add `Co-authored-by: Claude <noreply@anthropic.com>` or any other AI co-author trailer to git commit messages.
- **NEVER** append bot/assistant attribution footers to commits.
- **ONLY** attribute commits to the user.
- Keep all commit messages clean, concise, and conventional (e.g. `feat(...)`, `fix(...)`, `perf(...)`).

---

## 🛠️ Project Reference
- **Handover Document**: See `handover.md` for full architectural breakdown, data models, and page details.
- **App Working Directory**: `logis/`
- **Build / Typecheck**: `cd logis && npm run build`
- **Dev Server**: `cd logis && npm run dev`
- **Database**: `logis/logis.db` (SQLite via `better-sqlite3`)
- **Theme**: Pure dark theme using semantic tokens (`bg-surface`, `bg-surface-2`, `border-border`, `text-primary`, etc.).

---

## 📐 Key Design Conventions
- Financial & quantity formatting: always use `formatNumber` and `formatCurrency` from `src/lib/utils.ts` (supports Indian numbering: `10,20,331`, `₹1,36,692`).
- React Flow optimization: avoid subscribing to continuous `useStore(s => s.transform[2])`. Use boolean thresholds (`useStore(s => s.transform[2] >= 0.7)`) and wrap custom nodes in `React.memo` to keep 60fps performance on 800+ node graphs.
- Never write to database during clean-stock queries (read-only verification).
