import type {State} from './model';
export function stockAlerts(state:State){
 return state.materials.filter(m=>m.balance<=m.minimum).sort((a,b)=>a.balance-b.balance||a.name.localeCompare(b.name)).map(m=>({
  ...m,siteName:state.sites.find(s=>s.id===m.siteId)?.name||'Unknown site',
  shortage:Math.max(0,m.minimum-m.balance),empty:m.balance===0,
 }));
}
