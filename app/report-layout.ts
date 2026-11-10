export type ReportKind='Attendance'|'Inventory'|'Movements';
export const reportKinds:ReportKind[]=['Attendance','Inventory','Movements'];
export const reportColumns:Record<ReportKind,number[]>={Attendance:[1,2,7,9,10,11,12,5,15,16,17],Inventory:[1,2,3,4,5,7,8],Movements:[1,2,3,4,7,8,10,12,13]};
export const reportDescriptions:Record<ReportKind,string>={Attendance:'Attendance for the selected date · Philippine Time',Inventory:'Current inventory balances for the selected sites',Movements:'All recorded stock movements for the selected sites'};
