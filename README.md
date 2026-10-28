# DELIRIO · Pedidos e impresión

The customer menu at `/` is browse-only: categories, search, dish illustrations, pizza sizes, pasta shapes and additions remain available, with no cart. The separate Spanish staff screen at `/staff.html` supports phones and the caja computer using one shared order database.

## Run the staff system locally

Requires Node.js 22.13 or later. No dependency installation or build step is needed.

1. Copy `.env.example` to `.env` and choose a private `STAFF_PIN` (at least 6 characters).
2. Run `npm start`.
3. Open http://127.0.0.1:4173/staff.html. Enter your name and the staff code.

For a menu-only static preview, run `npm run menu`. This does not run the staff API.

## Staff workflow

The staff interface prioritizes phones: compact labels, no decorative slogans or repeated section headings, table entry before dish selection, and all four order tabs visible at 320 px. The mobile order shortcut hides while the save action is on screen to avoid duplicate controls. Keep future staff UI changes concise and focused on taking orders.

- Select the table, dishes, quantities, pizza sizes/pasta shapes/juice flavors, additions and kitchen notes. Prices are calculated from the shared menu on the server.
- **Guardar y enviar a cocina** saves a pending order and queues its kitchen ticket automatically when LAN printing is configured. It stays on the phone screen and shows delivery status in **Pendientes**. Without printer configuration, **Guardar pedido** saves it and opens a preview; use **Abrir última comanda** if popups are blocked.
- **Pendientes**, **Pagados** and **Cancelados** have separate lists. **Pendientes** updates every four seconds across devices. Open an order to add dishes, view/reprint tickets, mark it paid or cancel it. All staff using the shared code have these permissions.
- Adding dishes produces an **ADICIÓN** ticket with only the new items. Existing submitted items are immutable in this first version; mistakes require cancellation and a replacement order. Tell the kitchen about cancellations yourself.
- Ticket reprints are explicitly marked **COPIA / REIMPRESIÓN**. Paid and cancelled orders cannot be changed.
- Drafts are saved in this browser tab's session storage. A failed submission retains its original request ID for a safe retry; don't clear site data during an uncertain submission. Submitted orders are stored on the server, not in the browser.
- Shared staff sessions last 12 hours and expire when the server restarts. Order data survives restarts.

## LAN printing

Waiters and caja initiate printing through one durable, serialized server queue. No caja approval or caja computer is required when the server runs on a separate local host. The printer is connected by Ethernet to the router; phones connect to the same reachable network by Wi-Fi. USB is not used by this adapter.

The supplied label identifies **STARPOS STAR-TP80NC-M**, USB + LAN (RJ45). Its IP, raw TCP port, ESC/POS compatibility, cutter and character table still require hardware verification. This is a generic ESC/POS adapter, not a confirmed Star Micronics/CloudPRNT integration.

### Configuration

Leave `PRINTER_HOST` empty for preview-only operation. Once the printer's network settings and ESC/POS support have been checked, set these in the server's private `.env` and restart:

```dotenv
PRINTER_HOST=192.168.1.50
PRINTER_PORT=9100
PRINTER_COLUMNS=42
PRINTER_CUT=true
PRINTER_TIMEOUT_MS=5000
```

The IP above is an **example**, not a discovered address. Obtain the actual IP from the router's connected-device list or the supplier's configuration/self-test instructions, and reserve it in the router. Port 9100 is a configurable starting assumption. Columns accept 24–48; start at 42 for 80 mm paper and adjust after a paper test. Set `PRINTER_CUT=false` if cutting is unsupported. Timeout accepts 100–30000 ms.

The Node server must be able to reach that printer IP. A dedicated local computer can run it independently of caja. A cloud deployment needs a private network route or a local print bridge (not implemented here). Do not expose port 9100 to the public internet. Run **one Node application instance** per database/queue; multi-process clustering is not supported.

### Delivery and recovery

- New tickets and jobs are saved in one SQLite transaction. Historical previews are **not** automatically queued when LAN is enabled. Existing deliberately queued jobs resume after restart.
- **En cola / Enviando**: waiting or sending. All clients share one queue.
- **Enviada**: the TCP write completed. This does **not** prove paper printed, paper is loaded, or kitchen received the order. This adapter does not read physical printer status.
- **Sin enviar**: connection failed before writing. The pending order remains saved. Open its comanda and select **Reintentar envío** after correcting the connection.
- **Revisar impresora**: connection failed during a write or the server restarted during sending. Check the paper before using **Reenviar copia**. The system does not automatically retry failures or uncertain deliveries.
- Manual retries preserve a request ID across refreshes and reject concurrent stale attempts. Resending a potentially delivered ticket marks it **COPIA - NO DUPLICAR PREPARACION**. Every attempt is retained on the ticket record.
- Cancellation removes queued, unsent jobs. A job already sending or sent cannot be recalled; tell the kitchen personally. Payment and print status are separate.

The LAN output includes table, order number, staff, dish quantities/options/additions, kitchen notes and ticket/job references. Addition tickets contain only newly added dishes. It uses plain ASCII transliteration (`piña` → `pina`, `adición` → `adicion`) until the hardware code page is verified; unsupported symbols become `?`. Saved orders and browser previews retain accents. Control characters in user input are stripped from printer content.

The browser preview retains 58/80 mm layouts and **Imprimir desde dispositivo** as a manual alternative. That action does not update LAN delivery status. The LAN paper width is configured on the server, independently of the preview selector.

### First hardware test (pending)

Connect Ethernet to the router, confirm/reserve the printer IP, verify raw TCP/ESC/POS with supplier documentation, then configure the server. Create a **new test order** and inspect table, quantities, long notes, margins and cut. Add a dish and verify only the addition prints. Disconnect the printer before another test, check the saved order and delivery error, reconnect and retry explicitly. Do not send historical orders as test data. Concurrent USB/LAN operation has not been verified.

Command references: [Epson ESC @ initialization](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/esc_atsign.html), [Epson GS V cutting](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_cv.html), and [Node TCP socket semantics](https://nodejs.org/api/net.html#socketwrite-data-encoding-callback). These explain the generic implementation, not this STARPOS model's firmware compatibility.

## Use phones and caja together

All staff devices must open the **same running server**. For a trusted local Wi-Fi trial, set `HOST=0.0.0.0` in `.env` and use `http://<server-LAN-IP>:4173/staff.html` on each device. The local server must remain running and reachable. It can run on a dedicated host independently of the caja computer. Guests use the public menu; give the staff URL and code only to the team.

For permanent hosting, run the Node server on a host with a persistent disk, HTTPS, backups and process supervision. Configure `COOKIE_SECURE=true` and `PUBLIC_ORIGIN=https://your-actual-host` behind the HTTPS reverse proxy. Proxy all routes to the same Node service. The HTTP LAN configuration is for a trusted trial; use HTTPS for production.

Orders, immutable price snapshots, kitchen tickets and idempotency records are stored in `DATA_FILE` (default `data/orders.sqlite`). Back up the database with a SQLite-aware backup or stop the server before copying its database files. `data/` and `.env` are ignored by Git. This first version is a single-server deployment with a shared staff code, not per-person roles or accounting/fiscal invoicing software.

## Repository and hosting

Project repository: [Sinfolonokojo/Delirio_Pedidos_Impresion](https://github.com/Sinfolonokojo/Delirio_Pedidos_Impresion).

This repository runs the staff application and shared order API on Node with persistent SQLite storage. It also includes the browse-only customer menu and its shared product catalog. It is independent of the original [Delirio_Menu repository](https://github.com/Sinfolonokojo/Delirio_Menu).

Deploy the complete Node application to a host with a persistent disk, using `npm start` and the environment settings above. A static-only deployment of `dist/` cannot save or synchronize staff pedidos. The old static Vercel configuration is intentionally absent here. No production hosting has been configured yet.

## Menu content

Edit `dist/menu.js` for names, descriptions, prices and categories. Prices are integer Colombian pesos; pizza arrays are ordered: slice, personal, medium, large. Historical saved orders retain their original price and name snapshots.

`dist/pizza.js` and `dist/pasta.js` retain procedural food illustrations and customizations. Images are illustrative. Source branding and the menu PDF are in `dist/assets/`. The public menu retains automatic lightweight rendering for supported device/network signals and reduced-motion preferences.

Half-and-half pizzas and beverage michelada supplements remain consultation notes in the original menu; they are not configurable priced options in this first staff version.

## Verification

Run `npm test` (HTTP tests require loopback networking). Tests exercise menu pricing/search, performance modes, authentication, shared orders, restart persistence, invalid inputs, duplicate submission protection, concurrent changes, addition-only tickets and safe static routing.

Browser checks cover customer browsing, phone/tablet/desktop layout, two independent staff sessions, ticket rendering, additions, payment, and draft recovery. LAN tests use a loopback TCP simulator and cover durable queuing, serialized output, retry deduplication, cancellation, restart recovery, addition-only bytes and connection failures. Physical printer acceptance remains pending its IP and an on-site paper test.

## Brand palette

The interface follows the supplied `menu delirio 5.pdf`: cream `#f8ead1`, dark green `#1a3820`, and red `#ab1c18`, sampled from rendered pages 1–3. Shared palette tokens are in `dist/theme.css`; derived surface and text colors keep mobile controls legible. Kitchen printouts remain black on white. The reference PDF is used for colors only; menu items and prices have not changed.
