import {auth} from '../../../auth-server';
import {fail,json} from '../../../server-access';
export async function GET(req:Request){try{if(new URL(req.url).pathname!=='/api/auth/get-session')return json({error:'Endpoint unavailable'},403);return await auth().handler(req)}catch(e){return fail(e)}}
export async function POST(req:Request){try{if(!['/api/auth/sign-in/username','/api/auth/sign-out'].includes(new URL(req.url).pathname))return json({error:'Endpoint unavailable'},403);return await auth().handler(req)}catch(e){return fail(e)}}
