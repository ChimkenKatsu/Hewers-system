import assert from 'node:assert/strict';
import {googleRows} from '../app/google-export.ts';
import {emptyState} from '../app/model.ts';
const state=emptyState();state.workers=[{id:'w',name:'=IMPORTXML("bad")',trade:'Mason',siteId:'s'}];state.sites=[{id:'s',name:'Site A',location:'Test'}];state.attendance=[{id:'a',workerId:'w',siteId:'s',timeIn:'2026-11-02T00:00:00Z',timeOut:null,method:'Face-assisted pilot',note:'Private note'}];
state.materials=[{id:'m',name:'Cement',siteId:'s',unit:'bags',balance:3,minimum:5}];
const rows=googleRows(state);assert.equal(rows.Attendance[1][1],state.workers[0].name);assert.equal(rows.Attendance[1][2],'Site A');assert.equal(rows.Attendance[1][4],'');assert.equal(rows.Inventory[1][3],3);assert.equal(rows.Movements.length,1);assert.ok(!JSON.stringify(rows).includes('Private note'));assert.deepEqual(Object.keys(rows),['Attendance','Inventory','Movements']);
console.log('PASS: explicit Google export columns, names/sites, quantities, empty histories, private-note exclusion. Values must be sent with RAW input.');
