import {env} from 'cloudflare:workers';
import type {Access} from './permissions';
import type {ScanReason} from './scan-reasons';
export type DiagnosticInput={id:string;workerId:string;siteId:string;purpose:string;outcome:'matched'|'rejected'|'error';reason:ScanReason;source:'server'|'device';durationMs?:unknown;captureMs?:unknown;serverMs?:unknown;modelMs?:unknown;device?:unknown;browser?:unknown;connection?:unknown};
const ms=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=300000?Math.round(v):null;
export async function recordDiagnostic(access:Access,p:DiagnosticInput){
 try{
  const connection=['Offline','Online','slow-2g','2g','3g','4g'].includes(String(p.connection))?String(p.connection):'Unknown';
  const now=new Date().toISOString(),device=['Mobile','Desktop'].includes(String(p.device))?String(p.device):'Unknown',browser=['Chrome','Safari','Firefox','Edge'].includes(String(p.browser))?String(p.browser):'Other';
  await env.DB!.prepare(`INSERT INTO scan_diagnostics(owner,id,operator_id,actor,worker_id,site_id,purpose,outcome,reason,source,duration_ms,capture_ms,server_ms,model_ms,device,browser,connection_type,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(owner,id) DO UPDATE SET outcome=CASE WHEN excluded.source='server' THEN excluded.outcome ELSE scan_diagnostics.outcome END,reason=CASE WHEN excluded.source='server' THEN excluded.reason ELSE scan_diagnostics.reason END,source=CASE WHEN excluded.source='server' THEN 'server' ELSE scan_diagnostics.source END,duration_ms=coalesce(excluded.duration_ms,scan_diagnostics.duration_ms),capture_ms=coalesce(excluded.capture_ms,scan_diagnostics.capture_ms),server_ms=coalesce(excluded.server_ms,scan_diagnostics.server_ms),model_ms=coalesce(excluded.model_ms,scan_diagnostics.model_ms),device=CASE WHEN excluded.device<>'Unknown' THEN excluded.device ELSE scan_diagnostics.device END,browser=CASE WHEN excluded.browser<>'Other' THEN excluded.browser ELSE scan_diagnostics.browser END,connection_type=CASE WHEN excluded.connection_type<>'Unknown' THEN excluded.connection_type ELSE scan_diagnostics.connection_type END
   WHERE scan_diagnostics.operator_id=excluded.operator_id AND scan_diagnostics.worker_id=excluded.worker_id AND scan_diagnostics.purpose=excluded.purpose`).bind(access.owner,p.id,access.userId,access.email,p.workerId,p.siteId,p.purpose,p.outcome,p.reason,p.source,ms(p.durationMs),ms(p.captureMs),ms(p.serverMs),ms(p.modelMs),device,browser,connection,now).run();
 }catch{console.warn('Scan diagnostic could not be saved');}
}
export function diagnosticId(value:unknown){return typeof value==='string'&&/^[a-zA-Z0-9-]{16,64}$/.test(value)?value:crypto.randomUUID();}
