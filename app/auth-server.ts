import {env} from 'cloudflare:workers';
import {betterAuth} from 'better-auth/minimal';
import {username} from 'better-auth/plugins/username';
import {drizzleAdapter} from '@better-auth/drizzle-adapter';
import {drizzle} from 'drizzle-orm/d1';
import * as schema from '../db/auth-schema';
export function authConfigured(){const e=env as unknown as {AUTH_SECRET?:string;AUTH_BASE_URL?:string};return !!(e.AUTH_SECRET&&e.AUTH_BASE_URL);}
// Cache configuration only. Sessions and current account permissions are still read from D1 on every request.
let cached: {db:NonNullable<typeof env.DB>;secret:string;baseURL:string;instance:ReturnType<typeof createAuth>}|undefined;
export function auth(){
 const e=env as unknown as {AUTH_SECRET?:string;AUTH_BASE_URL?:string};if(!e.AUTH_SECRET||e.AUTH_SECRET.length<32||!e.AUTH_BASE_URL||!env.DB)throw Error('Account sign-in needs server configuration');
 if(cached?.db===env.DB&&cached.secret===e.AUTH_SECRET&&cached.baseURL===e.AUTH_BASE_URL)return cached.instance;
 const instance=createAuth(env.DB,e.AUTH_SECRET,e.AUTH_BASE_URL);
 cached={db:env.DB,secret:e.AUTH_SECRET,baseURL:e.AUTH_BASE_URL,instance};
 void instance.$context.catch(()=>{if(cached?.instance===instance)cached=undefined});
 return instance;
}
export async function localSession(req:Request){
 if(!/(?:^|;\s*)(?:__Secure-)?hewers\.session_token=/.test(req.headers.get('cookie')||''))return null;
 if(!authConfigured())throw Error('AUTH');const result=await auth().api.getSession({headers:req.headers});if(!result||!result.user.active)throw Error('AUTH');return result;
}


function createAuth(db:NonNullable<typeof env.DB>,secret:string,baseURL:string){
 return betterAuth({appName:'Hewers Workforce',baseURL:baseURL,secret:secret,database:drizzleAdapter(drizzle(db),{provider:'sqlite',schema,transaction:false}),
  emailAndPassword:{enabled:true,disableSignUp:true,minPasswordLength:12,maxPasswordLength:128},
  user:{additionalFields:{workspaceId:{type:'string',input:false},role:{type:'string',input:false},siteIds:{type:'string',input:false},mustChangePassword:{type:'boolean',input:false},active:{type:'boolean',input:false}}},
  session:{expiresIn:43200,cookieCache:{enabled:false}},
  rateLimit:{enabled:true,storage:'database',window:60,max:30,customRules:{'/sign-in/username':{window:60,max:6},'/sign-in/email':{window:60,max:6}}},
  advanced:{cookiePrefix:'hewers',ipAddress:{ipAddressHeaders:['cf-connecting-ip']}},plugins:[username()],
 });
}
