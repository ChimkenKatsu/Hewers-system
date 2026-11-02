import * as workspace from '../app/api/workspace/route';
import * as staff from '../app/api/staff/route';
import * as face from '../app/api/face/route';
import * as photos from '../app/api/photos/route';
export default {fetch(request:Request){const routes:any={'/api/workspace':workspace,'/api/staff':staff,'/api/face':face,'/api/photos':photos};return routes[new URL(request.url).pathname]?.[request.method]?.(request)||new Response('Not found',{status:404})}};
