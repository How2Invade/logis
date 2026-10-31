<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent Guidelines for LOGIS

## 🚨 Git Commit Attribution Rules (STRICT)
- **NEVER** add `Co-authored-by: Claude <noreply@anthropic.com>` or any other AI co-author trailer to git commit messages.
- **NEVER** append bot/assistant attribution footers to commits.
- **ONLY** attribute commits to the user.
- Keep all commit messages clean, concise, and conventional (e.g. `feat(...)`, `fix(...)`, `perf(...)`).

---

## 🛠️ Project Handover & Context
- See `handover.md` for complete system architecture, workflows, SQLite database schema, and design guidelines.
