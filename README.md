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
- **Guardar e imprimir** durably saves a pending order and opens its kitchen ticket in a new tab. If the browser blocks that tab, use **Abrir última comanda**.
- **Pendientes**, **Pagados** and **Cancelados** have separate lists. **Pendientes** updates every four seconds across devices. Open an order to add dishes, view/reprint tickets, mark it paid or cancel it. All staff using the shared code have these permissions.
- Adding dishes produces an **ADICIÓN** ticket with only the new items. Existing submitted items are immutable in this first version; mistakes require cancellation and a replacement order. Tell the kitchen about cancellations yourself.
- Ticket reprints are explicitly marked **COPIA / REIMPRESIÓN**. Paid and cancelled orders cannot be changed.
- Drafts are saved in this browser tab's session storage. A failed submission retains its original request ID for a safe retry; don't clear site data during an uncertain submission. Submitted orders are stored on the server, not in the browser.
- Shared staff sessions last 12 hours and expire when the server restarts. Order data survives restarts.

## Printing: what works now and what remains

Waiters initiate the kitchen ticket from their phones, without caja approval or requiring the caja computer to route the order. Caja can also create and print orders.

The current build opens a printable kitchen ticket with 58 mm / 80 mm layouts. **It does not yet deliver jobs automatically to a physical printer.** The browser print button uses the device's available print options; it does not prove the ticket reached a printer. Ticket records remain `not_configured`, never falsely marked delivered.

Once the printer brand/model and connection are known, connect the appropriate printer adapter to the server's durable ticket records (or a compatible direct-device flow). Do not auto-replay historical tickets when enabling an adapter. Physical printer testing, paper sizing/margins and failure/retry behavior remain hardware setup work. The saved order and ticket flow can be tested now without a printer.

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

Browser checks cover customer browsing, phone/tablet/desktop layout, two independent staff sessions, ticket rendering, additions, payment, and draft recovery. The printer itself cannot be tested until its details and hardware are available.
