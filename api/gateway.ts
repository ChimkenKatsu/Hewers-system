import {proxyHewersApi} from '../hosting/vercel/proxy.js';
// Node ESM needs the emitted extension. Keep the runtime context out of the
// proxy's optional fetch dependency (used by its isolated tests).
const gateway={fetch(request:Request){return proxyHewersApi(request)}};
export default gateway;
