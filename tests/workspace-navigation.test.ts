import assert from 'node:assert/strict';
import {readWorkspaceRoute,workspaceRouteHash,readWorkspaceFilters} from '../app/workspace-navigation';
for(const [page,tab] of [['Attendance','Attendance log'],['Attendance','Worker directory'],['Attendance','Face recognition'],['Attendance','Overtime approvals'],['Materials','Movement history'],['Materials','Physical counts'],['Site evidence','Stock overview'],['Reports','Stock overview']]){
 assert.deepEqual(readWorkspaceRoute(workspaceRouteHash(page,tab)),{page,tab});
}
assert.deepEqual(readWorkspaceRoute('#Attendance'),{page:'Attendance',tab:'Attendance log'});
assert.equal(readWorkspaceRoute('#Site%20evidence').page,'Site evidence');
assert.equal(readWorkspaceRoute('#Attendance?tab=bogus').tab,'Attendance log');
assert.equal(readWorkspaceRoute('#Materials?tab=Face+recognition').tab,'Stock overview');
assert.equal(readWorkspaceRoute('#%broken').page,'Overview');
assert.equal(readWorkspaceRoute('#unknown').page,'Overview');
assert.equal(readWorkspaceRoute('','?notifications=1').page,'Notifications');
assert.equal(readWorkspaceRoute('','?google=connected').page,'Settings');
assert.equal(readWorkspaceRoute('','?googleSetup=1').page,'Settings');
assert.equal(readWorkspaceRoute('#Attendance','?google=connected').page,'Attendance','Explicit navigation wins over a previous Google callback query');
console.log('PASS: refreshable page/tab URLs, legacy links, invalid links, tab validation and Google/notification entry routes');

const filtered=workspaceRouteHash('Reports',undefined,{site:'site-123',date:'2026-11-09'});
assert.deepEqual(readWorkspaceFilters(filtered),{site:'site-123',date:'2026-11-09'});
assert.equal(readWorkspaceRoute(filtered).page,'Reports');
assert.deepEqual(readWorkspaceFilters('#Reports?site=bad%2Fid&date=2026-02-30'),{site:'all',date:''});
assert.equal(readWorkspaceFilters('#Reports?date=2028-02-29').date,'2028-02-29');
assert.deepEqual(readWorkspaceFilters(workspaceRouteHash('Attendance','Overtime approvals',{site:'s1',date:'2026-11-09'})),{site:'s1',date:'2026-11-09'});
assert.equal(readWorkspaceRoute(workspaceRouteHash('Attendance','Overtime approvals',{site:'s1',date:'2026-11-09'})).tab,'Overtime approvals');
console.log('PASS: site/date filter URL round-trip, real-date validation and combined tab/filter navigation');
