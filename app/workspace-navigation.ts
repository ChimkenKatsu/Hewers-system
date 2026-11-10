const pages=['Overview','Attendance','Exceptions','Materials','Site evidence','Reports','Staff & permissions','Notifications','Settings'];
const tabs:Record<string,string[]>={Attendance:['Attendance log','Worker directory','Face recognition','Correction requests','Scan diagnostics','Overtime approvals'],Materials:['Stock overview','Movement history','Physical counts']};
export const defaultWorkspaceTab=(page:string)=>tabs[page]?.[0]||'Stock overview';
export function readWorkspaceRoute(hash:string,search=''){
 const [rawPage,query='']=hash.replace(/^#/,'').split('?');let page='';
 try{page=decodeURIComponent(rawPage)}catch{/* Invalid links fall back to Home. */}
 if(!pages.includes(page)){
  const params=new URLSearchParams(search);
  page=!rawPage&&params.has('notifications')?'Notifications':!rawPage&&(params.has('google')||params.has('googleSetup'))?'Settings':'Overview';
 }
 const requestedTab=new URLSearchParams(query).get('tab')||'';
 return {page,tab:tabs[page]?.includes(requestedTab)?requestedTab:defaultWorkspaceTab(page)};
}
export type WorkspaceFilters={site?:string;date?:string};
const validSite=(value:string)=>value==='all'||/^[a-zA-Z0-9_-]{1,128}$/.test(value);
const validDate=(value:string)=>/^\d{4}-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function readWorkspaceFilters(hash:string){
 const params=new URLSearchParams(hash.split('?')[1]||'');const site=params.get('site')||'all',date=params.get('date')||'';
 return {site:validSite(site)?site:'all',date:validDate(date)?date:''};
}
export function workspaceRouteHash(page:string,tab=defaultWorkspaceTab(page),filters:WorkspaceFilters={}){
 const safePage=pages.includes(page)?page:'Overview';
 const safeTab=tabs[safePage]?.includes(tab)?tab:defaultWorkspaceTab(safePage);
 const params=new URLSearchParams();if(tabs[safePage]&&safeTab!==defaultWorkspaceTab(safePage))params.set('tab',safeTab);
 if(filters.site&&filters.site!=='all'&&validSite(filters.site))params.set('site',filters.site);
 if(filters.date&&validDate(filters.date))params.set('date',filters.date);
 return '#'+encodeURIComponent(safePage)+(params.size?'?'+params.toString():'');
}
