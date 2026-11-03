// Public deployment information only. Server credentials stay on the existing backend.
declare const __HEWERS_VERCEL__:boolean;
export const vercelFrontend=typeof __HEWERS_VERCEL__!=='undefined'&&__HEWERS_VERCEL__;
export const canonicalAppUrl='https://hewers-workforce.tristandominicparajes-202200583.workers.dev';
export const photoLimitMb=vercelFrontend?4:8;
