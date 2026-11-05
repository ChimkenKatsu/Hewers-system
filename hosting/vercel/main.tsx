import React from 'react';
import {createRoot} from 'react-dom/client';
import App from '../../app/page';
import Login from '../../app/login/page';
import '../../app/globals.css';
import '../../app/mood-board.css';
import '../../app/design-refresh.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{window.location.pathname==='/login'?<Login/>:<App/>}</React.StrictMode>);
