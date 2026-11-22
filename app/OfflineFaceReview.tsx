'use client';

const stamp=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'});

export default function OfflineFaceReview({scans}:{scans:{id:string;occurredAt:string;error:string}[]}){
 if(!scans.length)return null;
 return <details>
  <summary>Needs review · {scans.length} {scans.length===1?'scan':'scans'}</summary>
  <ul>{scans.map(scan=><li key={scan.id}>{stamp.format(new Date(scan.occurredAt))} PHT. {scan.error}</li>)}</ul>
 </details>;
}
