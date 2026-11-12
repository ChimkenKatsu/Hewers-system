import assert from 'node:assert/strict';
import {emptyState} from '../app/model.ts';
import {applyOperation} from '../app/operations.ts';
let s=applyOperation(emptyState(),'site',{name:'Test Site',location:'Test location'},'QA');
const siteId=s.sites[0].id;
s=applyOperation(s,'worker',{name:'Test Worker',trade:'Mason',siteId},'QA');
const workerId=s.workers[0].id;
assert.throws(()=>applyOperation(s,'attendance',{workerId,type:'out'},'QA'),/no open/);
s=applyOperation(s,'attendance',{workerId,type:'in',note:'Authorized manual entry'},'QA','2026-11-10T00:00:00Z');
assert.equal(s.attendance[0].method,'Manual');
assert.throws(()=>applyOperation(s,'attendance',{workerId,type:'in',note:'duplicate'},'QA','2026-11-10T00:01:00Z'),/already/);
s=applyOperation(s,'attendance',{workerId,type:'out'},'QA','2026-11-10T09:00:00Z');assert.ok(s.attendance[0].timeOut);
s=applyOperation(s,'material',{siteId,name:'Cement',unit:'bags',balance:100,minimum:20},'QA');
const materialId=s.materials[0].id;
for(const [type,quantity] of [['Issue',30],['Return',5],['Damage',2],['Delivery',10]] as const)s=applyOperation(s,'movement',{materialId,type,quantity,note:'QA movement'},'QA');
assert.equal(s.materials[0].balance,83);
const before=JSON.stringify(s);
assert.throws(()=>applyOperation(s,'movement',{materialId,type:'Issue',quantity:84,note:'Too much'},'QA'),/Insufficient/);
assert.equal(JSON.stringify(s),before);
assert.throws(()=>applyOperation(s,'movement',{materialId,type:'Delivery',quantity:-10,note:'Invalid'},'QA'),/valid quantity/);
assert.throws(()=>applyOperation(s,'worker',{siteId:'unknown',name:'Invalid',trade:'Mason'},'QA'),/valid site/);
assert.throws(()=>applyOperation(s,'photo',{siteId,url:'/api/photos?key=example',caption:'Example',category:'Delivery',transactionId:'bad'},'QA'),/Transaction/);
assert.equal(s.audit.length,9);
console.log('PASS: attendance transitions, negative stock prevention, inventory accounting, site validation, photo linkage, audit trail, immutable failures.');

let pending=applyOperation(s,'worker-request',{name:'Pending worker',trade:'Carpenter',siteId},'auditor1');
assert.equal(pending.workers.length,s.workers.length);const request=pending.workerRequests![0];
assert.throws(()=>applyOperation(pending,'attendance',{workerId:request.id,type:'in',note:'pending'},'auditor1'),/valid worker/);
assert.throws(()=>applyOperation(pending,'worker-request',{name:'Pending worker',trade:'Carpenter',siteId},'auditor1'),/already waiting/);
const accepted=applyOperation(pending,'worker-review',{requestId:request.id,decision:'accepted'},'admin1');
assert.equal(accepted.workers.length,pending.workers.length+1);assert.equal(accepted.workerRequests![0].reviewedBy,'admin1');
assert.throws(()=>applyOperation(accepted,'worker-review',{requestId:request.id,decision:'declined'},'admin2'),/already been reviewed/);
const declined=applyOperation(pending,'worker-review',{requestId:request.id,decision:'declined',reason:'Missing worker details'},'admin2');assert.equal(declined.workers.length,pending.workers.length);
console.log('PASS: pending-worker isolation, duplicate requests, accept/decline, reviewer attribution, double-review denial.');

// Validate after rounding as well as before it: no successful zero-effect movements.
for(const type of ['Delivery','Issue','Return','Damage','Loss']){
 for(const quantity of [0.0001,0.00049,Number.MIN_VALUE]){
  assert.throws(()=>applyOperation(s,'movement',{materialId,type,quantity,note:'Too small'},'QA'),/at least 0.001/);
  assert.equal(JSON.stringify(s),before,'Rejected movement leaves stock and audit history unchanged');
 }
 const minimum=applyOperation(s,'movement',{materialId,type,quantity:0.001,note:'Minimum valid amount'},'QA');
 assert.equal(minimum.movements.at(-1)!.quantity,0.001);
 assert.equal(minimum.materials[0].balance,['Issue','Damage','Loss'].includes(type)?82.999:83.001);
}
const zeroOpening=applyOperation(s,'material',{siteId,name:'Empty stock',unit:'m³',balance:0,minimum:0},'QA');
assert.equal(zeroOpening.materials.at(-1)!.balance,0,'Zero opening balances remain supported');
console.log('PASS: all movement types reject quantities rounded to zero without mutations; 0.001 movements and zero opening balances work.');
