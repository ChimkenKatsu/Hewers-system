import React from 'react';
import {createRoot} from 'react-dom/client';
import App from '../../app/page';
import Login from '../../app/login/page';
import '../../app/globals.css';
import '../../app/mood-board.css';
import '../../app/design-refresh.css';
import '../../app/startup-brand.css';
import StartupBrand from '../../app/StartupBrand';
import {clearOfflineWorkspace} from '../../app/offline-workspace';
if(window.location.pathname==='/login')clearOfflineWorkspace();
if(import.meta.env.PROD&&'serviceWorker' in navigator){
  void navigator.serviceWorker.register('/hewers-offline.js',{updateViaCache:'none'}).catch(()=>{});
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><StartupBrand/>{window.location.pathname==='/login'?<Login/>:<App/>}</React.StrictMode>);
