import json, urllib.request, urllib.error, uuid
base='http://terminal.local:4173'
owner='qa-'+str(uuid.uuid4())
def request(path, data=None, user=owner, origin=base, headers=None):
    h={'oai-authenticated-user-id':user,'oai-authenticated-user-email':'qa@example.test','Origin':origin}
    if headers:h.update(headers)
    if isinstance(data,dict):data=json.dumps(data).encode();h['Content-Type']='application/json'
    req=urllib.request.Request(base+path,data=data,headers=h)
    try:
        r=urllib.request.urlopen(req);return r.status,r.read()
    except urllib.error.HTTPError as e:return e.code,e.read()
status,raw=request('/api/workspace');assert status==200,raw
b=json.loads(raw);assert not b['state']['sites']
status,raw=request('/api/workspace',{'action':'site','payload':{'name':'QA site','location':'Test only'},'revision':0});assert status==200,raw
b=json.loads(raw);assert b['revision']==1
assert request('/api/workspace',{'action':'site','payload':{'name':'Stale','location':'Test'},'revision':0})[0]==409
assert request('/api/workspace',user='')[0]==401
assert request('/api/workspace',{'action':'site','payload':{},'revision':1},origin='https://other.example')[0]==403
assert not json.loads(request('/api/workspace',user=owner+'-other')[1])['state']['sites']
assert json.loads(request('/api/workspace')[1])['state']['sites'][0]['name']=='QA site'
assert request('/api/photos?key=other-owner/file')[0]==403
print('PASS: API persistence, anonymous rejection, owner isolation, cross-origin rejection, stale revision conflict, photo access isolation.')
