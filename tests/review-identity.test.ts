import assert from 'node:assert/strict';
import {emptyState} from '../app/model';
import {applyOperation} from '../app/operations';
import {visibleState,type Access} from '../app/permissions';
const now='2026-11-10T10:00:00Z';
const state=emptyState();state.sites=[{id:'s',name:'Site',location:'Test'}];state.workers=[{id:'w',name:'Worker',siteId:'s',trade:'Mason'}];state.attendance=[{id:'a',workerId:'w',siteId:'s',timeIn:'2026-11-10T00:00:00Z',timeOut:'2026-11-10T09:00:00Z',method:'Manual',note:'Original'}];state.materials=[{id:'m',siteId:'s',name:'Cement',balance:10,minimum:2,unit:'bags'}];
for(const kind of ['attendance','stock'] as const){
 const payload=kind==='attendance'?{attendanceId:'a',expectedIn:state.attendance[0].timeIn,expectedOut:state.attendance[0].timeOut,proposedIn:'2026-11-10T00:05:00Z',proposedOut:state.attendance[0].timeOut,reason:'Confirmed by site supervisor'}:{materialId:'m',expectedBalance:10,countedBalance:8,reason:'Physical count by site supervisor'};
 const request=kind==='attendance'?'attendance-correction-request':'stock-count-request',review=kind==='attendance'?'attendance-correction-review':'stock-count-review';
 const pending=applyOperation(state,request,{...payload,createdById:'forged-other-id'},'admin_old',now,'permanent-admin-id');
 const records=kind==='attendance'?pending.attendanceCorrections!:pending.stockReconciliations!;
 assert.equal(records[0].createdById,'permanent-admin-id','Ignore client-supplied submitter IDs');
 const decision={requestId:records[0].id,decision:'accepted',reviewedById:'forged-other-id'};
 assert.throws(()=>applyOperation(pending,review,decision,'admin_new',now,'permanent-admin-id'),/Another administrator/,'Renaming the same account must not permit self-approval');
 assert.throws(()=>applyOperation(pending,review,decision,'different_admin',now),/verified reviewer/);
 const accepted=applyOperation(pending,review,decision,'admin_old',now,'different-permanent-id');
 const approved=(kind==='attendance'?accepted.attendanceCorrections!:accepted.stockReconciliations!)[0];
 assert.equal(approved.status,'accepted','A different account can approve even if it now uses the old username');assert.equal(approved.reviewedById,'different-permanent-id');
 const legacy=structuredClone(pending);delete (kind==='attendance'?legacy.attendanceCorrections!:legacy.stockReconciliations!)[0].createdById;
 assert.throws(()=>applyOperation(legacy,review,decision,'admin_new',now,'permanent-admin-id'),/older request/,'Legacy requests fail closed after rename');
 assert.doesNotThrow(()=>applyOperation(legacy,review,{...decision,decision:'declined'},'other_admin',now,'other-id'),'Legacy requests can be declined and resubmitted');
 const auditor:Access={owner:'o',userId:'permanent-admin-id',email:'renamed_auditor',role:'auditor',siteIds:['s']};
 assert.equal((kind==='attendance'?visibleState(pending,auditor).attendanceCorrections:visibleState(pending,auditor).stockReconciliations)?.length,1,'Request visibility follows account ID');
 assert.equal((kind==='attendance'?visibleState(pending,{...auditor,userId:'different-id',email:'admin_old'}).attendanceCorrections:visibleState(pending,{...auditor,userId:'different-id',email:'admin_old'}).stockReconciliations)?.length,0,'Reusing a username does not expose another account request');
}
console.log('PASS: permanent reviewer identity, username-change self-approval denial, spoofed IDs, legacy resubmission, independent approval and scoped ownership');
