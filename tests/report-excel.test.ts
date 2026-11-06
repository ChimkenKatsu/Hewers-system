import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {createReportWorkbook} from '../app/report-excel';
import {googleRows} from '../app/google-export';
import {emptyState} from '../app/model';

const state=emptyState();
state.sites=[{id:'s',name:'Example site',location:'Iligan'}];
state.workers=[{id:'w',name:'=HYPERLINK("https://example.test")',trade:'Operator',siteId:'s'}];
state.attendance=[{id:'a',workerId:'w',siteId:'s',timeIn:'2026-11-07T00:00:00Z',timeOut:'2026-11-07T08:00:00Z',method:'Manual',note:''}];
const rows=googleRows(state,{includeNotes:true});
for(const kind of ['Attendance','Inventory','Movements'] as const){
 const workbook=createReportWorkbook(kind,rows[kind],'Example site','2026-11-07',new Date('2026-11-07T09:00:00Z'));
 const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
 assert.equal(loaded.worksheets.length,2);
 const sheet=loaded.getWorksheet(kind)!;
 assert.equal((sheet.views[0] as Partial<ExcelJS.WorksheetViewFrozen>).ySplit,5);
 assert.equal(sheet.pageSetup.orientation,'landscape');
 assert.ok(sheet.getColumn(1).width!>=25);
 assert.equal(sheet.getCell('A5').alignment.wrapText,true);
 assert.equal(sheet.getCell('A5').fill.type,'pattern');
 if(kind==='Attendance'){
  assert.equal(sheet.getCell('A6').value,state.workers[0].name,'Formula-looking names stay plain strings');
  assert.equal(sheet.getCell('G6').value,8,'Hours remain numeric');
  assert.equal(loaded.getWorksheet('Record details')!.getCell('A6').value,'a');
 }else assert.equal(sheet.rowCount,5,'Empty exports retain usable headers');
}
console.log('PASS: Excel round-trip, styled headers, column widths, frozen/filter rows, numeric hours, empty reports and formula-looking text.');
