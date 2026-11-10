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
export function workspaceRouteHash(page:string,tab=defaultWorkspaceTab(page)){
 const safePage=pages.includes(page)?page:'Overview';
 const safeTab=tabs[safePage]?.includes(tab)?tab:defaultWorkspaceTab(safePage);
 return '#'+encodeURIComponent(safePage)+(tabs[safePage]&&safeTab!==defaultWorkspaceTab(safePage)?'?'+new URLSearchParams({tab:safeTab}).toString():'');
}
