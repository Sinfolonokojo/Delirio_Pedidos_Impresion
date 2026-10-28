import {resolve} from 'node:path';
import {createApp} from './app.js';
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
const printer=process.env.PRINTER_HOST?{host:process.env.PRINTER_HOST,port:Number(process.env.PRINTER_PORT||9100),columns:Number(process.env.PRINTER_COLUMNS||42),cut:process.env.PRINTER_CUT!=='false',timeoutMs:Number(process.env.PRINTER_TIMEOUT_MS||5000)}:undefined;
const app=createApp({dbPath:resolve(process.env.DATA_FILE||'data/orders.sqlite'),pin:process.env.STAFF_PIN,secureCookies:process.env.COOKIE_SECURE==='true',publicOrigin:process.env.PUBLIC_ORIGIN,printer});
app.server.listen(port,host,()=>console.log(`DELIRIO: http://${host}:${port}\nStaff: http://${host}:${port}/staff.html\nLAN printing: ${printer?'configured (paper delivery unverified)':'not configured'}.`));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
