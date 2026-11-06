import ExcelJS from 'exceljs';
import {reportColumns,reportDescriptions,type ReportKind} from './report-layout';

export function createReportWorkbook(kind:ReportKind,rows:(string|number)[][],site:string,date:string,generatedAt=new Date()){
 const workbook=new ExcelJS.Workbook();workbook.creator='Hewers Manpower Services';workbook.created=generatedAt;
 const snapshot=generatedAt.toLocaleString('en-PH',{timeZone:'Asia/Manila'});
 for(const detailed of [false,true]){
  const indexes=detailed?rows[0].map((_,i)=>i):reportColumns[kind];
  const sheet=workbook.addWorksheet(detailed?'Record details':kind,{views:[{state:'frozen',ySplit:5}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:5'},properties:{defaultRowHeight:30}});
  sheet.columns=indexes.map(i=>{const title=String(rows[0][i]);return {width:/ID|request|Reference|Worker|Material|Site|role|Recorded by/.test(title)?30:/Time|Recorded|hours/.test(title)?25:20}});
  for(const n of [1,2,3])sheet.mergeCells(n,1,n,indexes.length);
  sheet.getCell('A1').value='HEWERS MANPOWER SERVICES · '+kind.toUpperCase();sheet.getRow(1).height=34;sheet.getCell('A1').font={name:'Calibri',size:17,bold:true,color:{argb:'FFFFFFFF'}};sheet.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF082C45'}};
  sheet.getCell('A2').value=site+' · '+(kind==='Attendance'?'Attendance date: '+date:'Current snapshot')+' · '+(rows.length-1)+' records';sheet.getCell('A2').font={bold:true,color:{argb:'FF082C45'},size:12};
  sheet.getCell('A3').value=reportDescriptions[kind]+' · Generated '+snapshot+' PHT';sheet.getCell('A3').font={size:10,color:{argb:'FF52677D'}};
  sheet.getRow(5).values=indexes.map(i=>rows[0][i]);sheet.getRow(5).height=48;
  sheet.getRow(5).eachCell(cell=>{cell.font={bold:true,color:{argb:'FF082C45'},size:11};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5B800'}};cell.alignment={vertical:'middle',wrapText:true}});
  for(const [n,source] of rows.slice(1).entries()){
   const row=sheet.addRow(indexes.map(i=>source[i]??''));
   row.eachCell({includeEmpty:true},cell=>{cell.font={name:'Calibri',size:11,color:{argb:'FF17364D'}};cell.alignment={vertical:'top',wrapText:true};cell.border={bottom:{style:'hair',color:{argb:'FFDCE5EE'}}};if(n%2===1)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F5FA'}};if(typeof cell.value==='number')cell.numFmt='0.##'});
   const maxLines=Math.max(...indexes.map((i,c)=>Math.ceil(String(source[i]??'').length/Math.max(10,(sheet.getColumn(c+1).width||25)-3))));row.height=Math.min(180,Math.max(30,maxLines*16));
  }
  sheet.autoFilter={from:{row:5,column:1},to:{row:Math.max(5,rows.length+4),column:indexes.length}};
  sheet.headerFooter={oddFooter:'&LHewers · Philippine Time (UTC+8)&RPage &P of &N'};
 }
 return workbook;
}

export async function downloadReportExcel(kind:ReportKind,rows:(string|number)[][],site:string,date:string){
 if('HewersDownloads' in window)throw Error('For formatted Excel, open Hewers in your browser. CSV downloads are available in this app.');
 const workbook=createReportWorkbook(kind,rows,site,date),bytes=await workbook.xlsx.writeBuffer();
 const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download='Hewers-'+kind+'-'+date+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
