import assert from 'node:assert/strict';
import {emptyState} from '../app/model';
import {payrollReview} from '../app/payroll';
import {applyReviewOperation} from '../app/review-operations';

const state=emptyState();
const date='2026-11-20', week='2026-11-16', now=date+'T10:00:00.000Z';
const time=(clock:string)=>date+'T'+clock+':00.000Z';
const record={id:'day-shift',workerId:'worker',siteId:'site',timeIn:time('00:00'),timeOut:time('09:00'),lunchOut:time('04:00'),method:'Manual',note:''};
state.attendance.push(record);
state.workers.push({id:'worker',name:'Worker',trade:'',siteId:'site'});
const rates=new Map([['worker',{idnum:'worker',rate:null,hr_rate:125,week_start:week}]]);
const request={attendanceId:record.id,expectedIn:record.timeIn,expectedOut:record.timeOut,
  proposedIn:record.timeIn,proposedOut:record.timeOut,expectedLunchOut:record.lunchOut,
  expectedLunchIn:null,proposedLunchOut:record.lunchOut,proposedLunchIn:time('05:00'),reason:'Worker returned at 1 PM; the scan was missed.'};
const submit=(changes={})=>applyReviewOperation(state,'attendance-correction-request',{...request,...changes},'Auditor',now,'auditor-id');

assert.equal(payrollReview(state,week,rates)[0].weekly_pay,null);
assert.throws(()=>submit({proposedLunchIn:time('03:00')}),/later than Lunch Out/);
assert.throws(()=>submit({proposedLunchIn:time('09:30')}),/around the recorded lunch break/);
assert.throws(()=>submit({expectedLunchOut:time('04:15')}),/CONFLICT/);
const pending=submit();
const correction=pending.attendanceCorrections![0];
assert.equal(pending.attendance[0].lunchIn,undefined);
assert.equal(payrollReview(pending,week,rates)[0].weekly_pay,null);
const approval={requestId:correction.id,decision:'accepted'};
assert.throws(()=>applyReviewOperation(pending,'attendance-correction-review',approval,'Auditor',now,'auditor-id'),/Another administrator/);
const stale=structuredClone(pending);
stale.attendance[0].lunchIn=time('05:15');
assert.throws(()=>applyReviewOperation(stale,'attendance-correction-review',approval,'Admin',now,'admin-id'),/CONFLICT/);
const reviewed=applyReviewOperation(pending,'attendance-correction-review',approval,'Admin',now,'admin-id');
assert.equal(reviewed.attendance[0].lunchIn,time('05:00'));
assert.equal(reviewed.attendance[0].timeOut,record.timeOut);
assert.equal(reviewed.attendanceCorrections![0].originalLunchIn,null);
assert.equal(payrollReview(reviewed,week,rates)[0].hours_to_pay,8);
assert.equal(payrollReview(reviewed,week,rates)[0].weekly_pay,1000);
console.log('PASS: missed lunch approval unblocks payroll, preserves history, rejects stale and invalid requests, and prevents self-approval');
