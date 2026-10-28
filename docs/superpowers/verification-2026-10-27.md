# LAN printing verification

- `npm test`: **24/24 pass** (Node 26.3.0, loopback networking enabled).
- SQLite tests: tickets/jobs committed together; duplicate request IDs do not create duplicate jobs; one active sender; cancelled queued jobs skipped; preview history remains unqueued after enabling printing; queued work survives restart; interrupted sends become uncertain; explicit retries reject stale attempts and mark possible duplicates as copies.
- Real loopback TCP tests: order/addition bytes, control-character stripping, ASCII transliteration, width wrapping, optional cut, authenticated reprint, connection refusal, stalled write timeout, and reset after receiving bytes. Reset regression reproduced `sent` before correction, then passed as `uncertain`.
- Independent review found the socket-end callback error and browser-device copy-marker issues. Both corrected and re-reviewed; no remaining blocker reported.
- Browser verification used a separate in-memory application and TCP simulator, never existing user orders. A 390 px mesero session created an order without a new tab; an independent desktop caja session saw the same pending order and delivery state. A lost response after an accepted reprint was retried after reload with the same request ID: exactly two total jobs, original plus one marked copy.
- Staff preview and ticket page checked at 320, 390, 768 and 1440 px with no horizontal overflow. No browser JavaScript errors. Device-print duplicate marker verified before invoking the browser print function. Screenshot: workspace `tmp/qa/lan-pending-mobile.png`.
- `git diff --check` passed.

Physical printer **not tested**. No real printer IP has been supplied. The live local preview remains unconfigured, so no existing or new user orders have been sent to hardware. Port/protocol/character page/cut/paper remain acceptance checks described in README. A socket write reports **sent**, never physically printed.
