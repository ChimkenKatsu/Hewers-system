import {proxyHewersApi} from '../hosting/vercel/proxy';
const gateway={fetch:proxyHewersApi};
export default gateway;
