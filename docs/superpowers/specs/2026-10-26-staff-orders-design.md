# DELIRIO staff orders

Customers browse the current menu without a cart. Staff use phones and the caja computer to select a table, food, variants, quantities and notes; totals are calculated and orders saved as Pendiente. Staff initiate kitchen printing themselves, without caja approval or routing through its computer. Caja shares these records and can mark them paid. User authorized implementation now and will provide printer details later.

Implementation choices: keep the existing dependency-free HTML/CSS/JS menu; add a separate Spanish /staff.html interface and a Node >=22.13 server with persistent SQLite. The server can run independently of caja. A shared staff access code plus staff name protects the order API. Devices connect to the same server. The current static Vercel deployment continues to serve the public menu only; staff operations require this server and persistent storage. No production hosting changes in this task.

Persist orders and immutable kitchen ticket snapshots atomically. Repeated submissions use idempotency keys; updates use versions to prevent stale edits. Server validates menu options and calculates authoritative prices. Additional dishes create addition-only kitchen tickets to avoid cooking previous items again. Paid/cancelled orders are read-only. Print status is separate from payment status.

Printer connection is deliberately pending. Save-and-print opens a ticket preview, with browser printing as a manual fallback. Never label an order printed or delivered based on opening a preview or closing a browser print dialog. Durable ticket records provide the future printer integration boundary; no automatic replay of historical tickets when an adapter is later configured.

Verification: existing suite, actual HTTP/SQLite tests for auth, persistence, invalid options, duplicate submissions, concurrent revisions, and safe ticket rendering; desktop/mobile browser workflow and two isolated staff sessions.
