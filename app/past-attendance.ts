import {day, type State} from './model';
import {validAttendance} from './review-operations';
import {shiftTime, siteSchedule, validateSchedule} from './shift-policy';
import {validDate} from './workspace-navigation';

export function recordPastShifts(original:State, entry:Record<string,unknown>, actor:string, actorId:string|undefined, now:string):State {
  if (!actorId) throw Error('A signed-in administrator is required.');
  const worker = original.workers.find(person => person.id === entry.workerId);
  if (!worker || worker.archivedAt) throw Error('Select an active worker.');
  if (typeof entry.note !== 'string' || entry.note.trim().length < 10 || entry.note.length > 500) {
    throw Error('Give a reason for the entry using 10 to 500 characters.');
  }
  const first = entry.firstDate;
  const last = entry.lastDate || first;
  if (typeof first !== 'string' || typeof last !== 'string' || !validDate(first) || !validDate(last) || last < first || last > day(now)) {
    throw Error('Choose past or current work dates in Philippine Time.');
  }
  const days = (Date.parse(last) - Date.parse(first)) / 86400000 + 1;
  if (days > 7) throw Error('Enter up to seven consecutive workdays at a time.');
  const times = validateSchedule({start:entry.start, end:entry.end, breakStart:entry.breakStart, breakEnd:entry.breakEnd});
  const paidLunch = entry.paidLunch === true;
  if (paidLunch && !times.breakStart) throw Error('Enter the start and end of the paid lunch break.');
  if (times.breakStart === times.start || times.breakEnd === times.end) throw Error('Enter a lunch break strictly between time in and time out.');
  const schedule = siteSchedule(original, worker.siteId);
  if (times.start >= schedule.end || times.end > schedule.end) throw Error('Use the overtime workflow for hours after the regular shift.');

  const state = structuredClone(original);
  for (let index = 0; index < days; index++) {
    const date = new Date(Date.parse(first) + index * 86400000).toISOString().slice(0,10);
    const stamp = (clock:string) => new Date(shiftTime(date, clock)).toISOString();
    const timeIn = stamp(times.start), timeOut = stamp(times.end);
    if (Date.parse(timeOut) > Date.parse(now)) throw Error('The shift must have ended before it can be saved.');
    if (state.attendance.some(row => row.workerId === worker.id && day(row.timeIn) === date && row.shiftKind !== 'overtime')) {
      throw Error('Regular attendance already exists on ' + date + '. Open its correction form.');
    }
    if (state.offlineAttendance?.some(row => row.workerId === worker.id && row.status === 'pending' && day(row.occurredAt) === date)
      || state.attendanceCorrections?.some(row => row.workerId === worker.id && row.status === 'pending' && [day(row.originalIn),day(row.proposedIn)].includes(date))) {
      throw Error('Resolve the pending attendance entry for ' + date + ' first.');
    }
    validAttendance(state, worker.id, '', timeIn, timeOut);
    const id = crypto.randomUUID();
    const note = entry.note.trim();
    state.attendance.push({id, workerId:worker.id, siteId:worker.siteId, timeIn, timeOut,
      ...(times.breakStart && times.breakEnd ? {lunchOut:stamp(times.breakStart), lunchIn:stamp(times.breakEnd)} : {}),
      ...(paidLunch ? {paidLunch:true} : {}),
      schedule:{...schedule}, shiftKind:'regular', shiftEndAt:stamp(schedule.end),
      method:'Manual backfill', timeOutMethod:'Manual backfill', note});
    const lunch = times.breakStart ? ', ' + (paidLunch ? 'paid' : 'unpaid') + ' lunch ' + times.breakStart + '–' + times.breakEnd : '';
    state.audit.unshift({id:crypto.randomUUID(), kind:'attendance-backfill', siteId:worker.siteId, created:now, actor,
      action:`Recorded completed shift for ${worker.name} on ${date}, ${times.start}–${times.end}${lunch} PHT. ${note} (record ${id}, account ${actorId})`});
  }
  return state;
}
