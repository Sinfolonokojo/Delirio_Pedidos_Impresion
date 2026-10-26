# Staff orders verification — 2026-10-26

- Baseline: eight existing Node tests passed before changes.
- Final server suite: 16 tests, all passing. Real loopback HTTP and temporary SQLite files exercise auth, cross-origin rejection, save/list across sessions, restart persistence, authoritative COP totals, duplicate request keys, invalid options, version conflicts, immutable addition tickets, static-file isolation and split UTF-8 request bytes.
- Desktop and mobile browser: 320, 390, 768 and 1440 CSS-pixel widths, no horizontal page overflow after grid fix.
- Two independent browser contexts: Ana submitted 2 large Delirio pizzas with tocineta and champiñones ($178,000); Caja saw the same pedido. Ana added one $8,000 limonada; addition ticket contained only the limonada. Caja's stale $178,000 payment attempt was rejected; reopening showed the $186,000 total and payment succeeded.
- Lost-response simulation: browser intercepted a POST, allowed the server to commit, then aborted the response. After page reload, retry used the stored original key. Orders for that table remained exactly one; successful retry cleared the draft.
- Kitchen ticket: literal script-like note rendered as text, no injected script element; copy banner present, 58 mm layout selected and print stylesheet hides controls. Physical printer not tested.
- Customer menu: no cart buttons; pizza extras still update the displayed price; pasta shape selection still works; no uncaught JavaScript errors in the guest flow.
- Independent code review found static-root normalization and split UTF-8 decoding issues. Both reproduced with failing regression tests, fixed and verified by the complete suite.
- Browser screenshots are workspace QA artifacts in ../tmp/qa/. This is local validation; no production deployment or physical-phone/printer certification.

## Mobile simplification follow-up

Checked 320, 390, 768 and 1440 px: no horizontal page overflow and all four status tabs fit. Table appears before dishes. Adding a Margarita yields $23,000; draft table and total survive reload. The floating order shortcut hides when the save button enters the viewport. Cancelled view remains accessible. Browser run had no uncaught JavaScript errors. Tests used an isolated browser context with fixture API reads and did not alter live preview pedidos.
