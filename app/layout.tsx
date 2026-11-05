import type { Metadata } from 'next';
import './globals.css';
import './mood-board.css';
import './design-refresh.css';
import './startup-brand.css';
import StartupBrand from './StartupBrand';
export const metadata: Metadata = {title:'Hewers Manpower Services | Site Operations',description:'Attendance, materials and site evidence in one workspace.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body><StartupBrand/>{children}</body></html>}
