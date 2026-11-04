'use client';
import {Children,cloneElement,isValidElement,type ReactNode} from 'react';
type NodeProps={children?:ReactNode;'data-label'?:string};
// Keep desktop table semantics and add the labels used by the phone card layout.
export default function ResponsiveTable({labels,children}:{labels:string[];children:ReactNode}){
 const sections=Children.map(children,section=>isValidElement<NodeProps>(section)&&section.type==='tbody'?cloneElement(section,{children:Children.map(section.props.children,row=>isValidElement<NodeProps>(row)&&row.type==='tr'?cloneElement(row,{children:Children.toArray(row.props.children).map((cell,i)=>isValidElement<NodeProps>(cell)?cloneElement(cell,{'data-label':labels[i]||'Details',children:<div className="record-value">{cell.props.children}</div>}):cell)}):row)}):section);
 return <table className="mobile-records" role="table">{sections}</table>;
}
