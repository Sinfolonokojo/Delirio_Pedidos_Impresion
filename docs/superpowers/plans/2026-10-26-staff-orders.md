# Staff Orders Implementation Plan

> **For agentic workers:** use superpowers:executing-plans inline. User explicitly requested starting work without further questions.

**Goal:** Deliver a browse-only customer menu and shared staff pedidos with kitchen ticket previews.
**Architecture:** Existing static frontend plus a small Node HTTP API and SQLite store. Separate staff UI and immutable kitchen tickets. Physical printer adapter deferred by user.
**Tech Stack:** Vanilla JS/CSS/HTML, Node >=22.13 built-in SQLite, node:test.
**Spec:** docs/superpowers/specs/2026-10-26-staff-orders-design.md

## Global constraints
- Spanish staff interface, COP integer prices, shared records across devices.
- No caja approval or caja-computer dependency for waiter submission.
- Never claim physical printing while hardware is unconfigured.
- Work in existing clean GitHub checkout on codex/staff-orders; no publish/push.

## Review focus
- Network retry must not duplicate a pedido or kitchen ticket.
- Two staff updating one pedido must not lose additions or charge a stale total.
- Invalid quantities, menu options and unauthorized requests must not create records.
- Print cancellation must leave a saved pending order; notes must be escaped.
- Phone layout and connection errors must preserve drafts and actionable recovery.

## Task 1: Shared order API
Files: server/store.js, server/app.js, server/start.js, tests/staff.test.js.
Interfaces: createApp({dbPath,pin,secureCookies}) returns {server,close}; JSON /api/login, /api/session, /api/orders, /api/orders/:id, /api/tickets/:id.
- [x] Write and run failing HTTP tests for auth, authoritative totals, idempotency, persistence, validation and concurrent additions/payment.
- [x] Implement transaction-backed records, session auth, immutable tickets, static serving.
- [x] Run npm test; expect all passing.

## Task 2: Customer and staff interfaces
Files: dist/index.html, dist/app.js, dist/staff.html, dist/staff.css, dist/staff.js, dist/ticket.html, dist/ticket.js, dist/ticket.css.
- [x] Remove customer cart markup and handlers while retaining dish previews and customizations.
- [x] Build login, menu selection, table/notes, draft, shared pending/closed list, additions, payment/cancel confirmation.
- [x] Implement save-and-print preview and escaped addition/reprint tickets, with explicit unconfigured hardware state.
- [x] Browser-check mobile layout, customer preview, two staff sessions, addition ticket and pending persistence.

## Task 3: Handoff
Files: README.md, package.json, .env.example, .gitignore.
- [x] Document local/shared server setup and static hosting distinction.
- [x] Run full suite, syntax/diff checks, and one independent final code review; fix important findings.
- [x] Open preview and report physical printer and production hosting as remaining setup.

## Progress / rulings
- Baseline: 8 tests passed. User's request to start overrides further brainstorming/planning approval gates.
- Reuse the clean existing checkout on a feature branch; no additional worktree needed.

- Final verification recorded in docs/superpowers/verification-2026-10-26.md. No production deployment or physical printer connection attempted.
