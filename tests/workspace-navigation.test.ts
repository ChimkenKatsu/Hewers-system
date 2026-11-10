import assert from 'node:assert/strict';
import {readWorkspaceRoute,workspaceRouteHash} from '../app/workspace-navigation';
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
