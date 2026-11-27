import assert from 'node:assert/strict';
import {emptyState} from '../app/model';
import {authorize, type Access} from '../app/permissions';
import {applyOperation} from '../app/operations';
import {payrollReview} from '../app/payroll';
import {attendanceHours} from '../app/shift-policy';

const original = emptyState();
original.sites.push({id:'site',name:'Site',location:'',schedule:{start:'08:00',end:'17:00',breakStart:'12:00',breakEnd:'13:00'}});
original.workers.push({id:'worker',name:'Test Worker',trade:'',siteId:'site'});
const input = {workerId:'worker',firstDate:'2026-11-23',lastDate:'2026-11-27',start:'08:00',end:'16:00',
  breakStart:'12:00',breakEnd:'13:00',paidLunch:true,note:'Work dates and paid lunch confirmed.'};
const admin:Access = {owner:'team',userId:'id',email:'admin',role:'administrator',siteIds:[]};
const action = 'attendance-backfill';
const save = (state=original, changes={}) => {
  const payload = {...input,...changes};
  authorize(admin,state,action,payload);
  return applyOperation(state,action,payload,admin.email,'2026-11-27T12:00:00Z',admin.userId);
};
const saved = save();
assert.equal(saved.attendance.length,5);
assert.equal(saved.audit.length,5);
assert(saved.audit.every(row => row.actor === admin.email && row.action.includes('paid lunch')));
assert.equal(saved.attendance.at(-1)?.timeOut,'2026-11-27T08:00:00.000Z');
const paidHours = (state:typeof original) => payrollReview(state,input.firstDate,new Map())[0].hours_to_pay;
assert.equal(paidHours(saved),40);
assert.equal(attendanceHours(saved.attendance[0]).regularMinutes,480);
assert.equal(paidHours(save(original,{paidLunch:false})),35);
assert.throws(()=>save(saved),/already exists/);
const conflict = save(original,{firstDate:input.lastDate});
assert.throws(()=>save(conflict),/already exists/);
assert.equal(conflict.attendance.length,1);
conflict.attendance[0].timeIn = '2026-11-19T07:11:31Z';
conflict.attendance[0].timeOut = null;
assert.throws(()=>save(conflict),/overlap/);
assert.throws(()=>save(original,{end:'18:00'}),/overtime/);
assert.throws(()=>save(original,{breakEnd:''}),/break window/);
assert.throws(()=>save(original,{lastDate:'2026-11-28'}),/work dates/);
assert.throws(()=>save(original,{firstDate:'2026-02-30'}),/work dates/);
for (const role of ['auditor','viewer','supervisor','manager','custodian'] as const) {
  assert.throws(()=>authorize({...admin,role,siteIds:['site']},original,action,input),/FORBIDDEN/);
}
assert.equal(original.attendance.length,0);
