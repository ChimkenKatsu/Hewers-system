'use client';
import type {State} from './model';
import {stockAlerts} from './stock-alerts';
export default function StockAlerts({data,onOpen}:{data:State;onOpen:()=>void}){
 const alerts=stockAlerts(data);
 return <section className="panel approval-panel" aria-label="Low-stock notifications"><div className="panel-head"><div><h2>Stock alerts</h2><p>Alerts appear at or below the minimum and clear automatically after restocking above it.</p></div><span className={'badge '+(alerts.length?'amber':'green')}>{alerts.length} active</span></div>{!alerts.length&&<p className="approval-empty">All materials are above their minimum stock levels.</p>}{alerts.map(a=><div className="approval-row" key={a.id}><div><strong>{a.name}</strong><small>{a.siteName} · {a.balance} {a.unit} remaining · Minimum {a.minimum} {a.unit}</small><small>{a.shortage>0?`${a.shortage} ${a.unit} below minimum`:'At minimum — plan a replenishment'}</small></div><span className="badge amber">{a.empty?'Out of stock':'Low stock'}</span><button className="btn secondary" onClick={onOpen}>Review inventory</button></div>)}</section>;
}
