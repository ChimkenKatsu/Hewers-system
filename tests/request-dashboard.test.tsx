import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import RequestsDashboard from '../app/RequestsDashboard';
import {emptyState} from '../app/model';

const data=emptyState();
data.sites=[{id:'s',name:'Test site',location:'Test'}];
data.workerRequests=[
 {id:'pending',siteId:'s',name:'Pending worker',trade:'Mason',createdBy:'auditor1',created:'2026-11-05T00:00:00Z',status:'pending'},
 {id:'approved',siteId:'s',name:'Approved worker',trade:'Mason',createdBy:'auditor1',created:'2026-11-05T00:00:00Z',status:'accepted',reviewedBy:'admin1',reviewedAt:'2026-11-05T01:00:00Z'},
];
const props={data,workspaceId:'test',revision:1,actor:'admin1',actorId:'admin-account-id',onUpdated:()=>{}};
const admin=renderToStaticMarkup(<RequestsDashboard {...props} admin/>);
assert.match(admin,/Approval queue/);
assert.match(admin,/Pending worker/);
assert.doesNotMatch(admin,/Approved worker/,'Admin queue starts with pending work only');
assert.match(admin,/>Accept<\/button>/);
const focused=renderToStaticMarkup(<RequestsDashboard {...props} admin focusRequestId="approved"/>);
assert.match(focused,/Approved worker/,'Opening a notification reveals completed requests too');
const auditor=renderToStaticMarkup(<RequestsDashboard {...props} admin={false} actor="auditor1"/>);
assert.match(auditor,/My requests/);
assert.match(auditor,/Pending worker/);
assert.match(auditor,/Approved worker/,'Auditor starts with complete request history');
assert.doesNotMatch(auditor,/>Accept<\/button>/,'Auditors have no approval action');
assert.doesNotMatch(auditor,/<form/,'History does not duplicate request submission forms');
console.log('Request dashboard role and default-filter checks passed');
