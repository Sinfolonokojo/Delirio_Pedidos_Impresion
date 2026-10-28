# LAN printing

Approved flow: phones and caja use the same server and one LAN printer queue. Caja approval and its computer are not required. Printer photo identifies STARPOS STAR-TP80NC-M with USB and Ethernet; simultaneous interface operation and the firmware protocol remain unverified. IP is not yet known.

1. Persist jobs in SQLite atomically with new tickets, only when configured. Never enqueue historical preview tickets automatically. Serialize sends; recover interrupted sends as uncertain. Do not automatically retry failed or uncertain jobs.
2. Add a configurable raw TCP ESC/POS adapter (IP, port, width, cutter, timeout). Use conservative ASCII transliteration until the hardware character table is verified. Strip control characters from user content. A successful socket write means sent, never physically printed.
3. Display concise live delivery status on staff orders and tickets. Make explicit retries idempotent with a latest-job precondition. Mark possible duplicates as copies. Cancel unsent queued jobs when the order is cancelled; warn kitchen manually for jobs already sent.
4. Test persistence, concurrent submissions, addition-only payloads, network failure, interrupted recovery, cancellation, authenticated retry, and exact bytes with a local TCP simulator. Verify mobile UI. Document local server/network requirements and deferred hardware acceptance.

Run one application instance against the database. A dedicated local host can run it independently from caja. A cloud server needs a private route to the printer or a future local bridge; a browser cannot send raw TCP itself. Do not expose the printer port to the internet.

Hardware acceptance (pending): discover/reserve IP using router or supplier instructions, confirm raw TCP port and ESC/POS support, enable adapter deliberately, create one test order and one addition, inspect paper/cut/accents, test power/network failure and manual recovery. Never print historical records as a setup test.
