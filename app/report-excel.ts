import ExcelJS from 'exceljs';
import {payrollColumns,type PayrollRow} from './payroll';
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
   row.eachCell({includeEmpty:true},cell=>{cell.font={name:'Calibri',size:11,color:{argb:'FF17364D'}};cell.alignment={vertical:'top',wrapText:true};cell.border={bottom:{style:'hair',color:{argb:'FFDCE5EE'}}};if(n%2===1)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F5FA'}};if(typeof cell.value==='number')cell.numFmt='0.###'});
   const maxLines=Math.max(...indexes.map((i,c)=>Math.ceil(String(source[i]??'').length/Math.max(10,(sheet.getColumn(c+1).width||25)-3))));row.height=Math.min(180,Math.max(30,maxLines*16));
  }
  sheet.autoFilter={from:{row:5,column:1},to:{row:Math.max(5,rows.length+4),column:indexes.length}};
  sheet.headerFooter={oddFooter:'&LHewers · Philippine Time (UTC+8)&RPage &P of &N'};
 }
 return workbook;
}

export async function downloadReportExcel(kind:ReportKind,rows:(string|number)[][],site:string,date:string){
 if('HewersDownloads' in window)throw Error('For formatted Excel, open Hewers in your browser. CSV downloads are available in this app.');
 await downloadWorkbook(createReportWorkbook(kind,rows,site,date),'Hewers-'+kind+'-'+date+'.xlsx');
}

export function createPayrollWorkbook(rows:PayrollRow[]){
 const book=new ExcelJS.Workbook();
 const sheet=book.addWorksheet('Weekly payroll',{views:[{state:'frozen',ySplit:1}]});
 const header=sheet.addRow(payrollColumns);
 header.font={name:'Calibri',size:11,bold:true,color:{argb:'FFFFFFFF'}};
 header.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF082C45'}};
 header.height=23;
 const context=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
 function width(text:string,bold=false){
   if(!context)return Array.from(text).reduce((total,c)=>total+(/[MW@\u3000-\uffff]/u.test(c)?2:1),0)+3;
   context.font='11pt Calibri, Arial, sans-serif';
   const unit=context.measureText('0').width;
   if(bold)context.font='bold '+context.font;
   return Math.ceil(context.measureText(text).width/unit)+3;
 }
 const widths=payrollColumns.map(title=>width(title,true));
 const decimal=new Intl.NumberFormat('en-PH',{minimumFractionDigits:2,maximumFractionDigits:4});
 for(const row of rows){
   const values=[row.idnum,row.name,row.rate,row.hr_rate,new Date(row.week_start+'T00:00:00Z'),row.hours_to_pay,row.weekly_pay];
   const record=sheet.addRow(values);
   values.forEach((value,index)=>{
     const cell=record.getCell(index+1);
     let label=String(value??'');
     if(value instanceof Date){cell.numFmt='yyyy-mm-dd';label=row.week_start;}
     if(typeof value==='number'){cell.numFmt=index===6?'#,##0.00':'#,##0.00##';label=decimal.format(value);}
     const needed=width(label);
     widths[index]=Math.max(widths[index],Math.min(255,needed));
     if(needed>255)cell.alignment={wrapText:true};
   });
 }
 widths.forEach((size,index)=>{sheet.getColumn(index+1).width=size;});
 return book;
}

export async function downloadWorkbook(workbook:ExcelJS.Workbook,filename:string){
 const bytes=await workbook.xlsx.writeBuffer();
 const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
