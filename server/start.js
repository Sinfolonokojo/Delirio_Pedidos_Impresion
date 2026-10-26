import {resolve} from 'node:path';
import {createApp} from './app.js';
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
const app=createApp({dbPath:resolve(process.env.DATA_FILE||'data/orders.sqlite'),pin:process.env.STAFF_PIN,secureCookies:process.env.COOKIE_SECURE==='true',publicOrigin:process.env.PUBLIC_ORIGIN});
app.server.listen(port,host,()=>console.log(`DELIRIO: http://${host}:${port}\nStaff: http://${host}:${port}/staff.html\nPhysical printer: not configured.`));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
