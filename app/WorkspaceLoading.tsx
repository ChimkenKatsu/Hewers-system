export default function WorkspaceLoading(){
 return <div className="workspace-loading" aria-busy="true">
  <div className="workspace-loading-status" role="status"><span className="loading-spinner" aria-hidden="true"/><span>Opening your workspace<span className="loading-detail">Loading your sites, workers and attendance…</span></span></div>
  <div className="skeleton-layout" aria-hidden="true">
   <aside className="skeleton-sidebar"><img src="/hewers-logo.svg" alt=""/>{Array.from({length:6},(_,i)=><span className="skeleton skeleton-nav" key={i}/>)}</aside>
   <div className="skeleton-main"><div className="skeleton skeleton-topbar"/><div className="skeleton-content"><div className="skeleton skeleton-hero"/><div className="skeleton skeleton-title"/><div className="skeleton skeleton-subtitle"/><div className="skeleton-stats">{Array.from({length:4},(_,i)=><div className="skeleton skeleton-stat" key={i}/>)}</div><div className="skeleton-table">{Array.from({length:5},(_,i)=><div className="skeleton skeleton-row" key={i}/>)}</div></div></div>
  </div>
 </div>;
}
