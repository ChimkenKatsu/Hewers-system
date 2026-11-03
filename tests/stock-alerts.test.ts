import assert from 'node:assert/strict';
import {stockAlerts} from '../app/stock-alerts.ts';
const state={sites:[{id:'s',name:'TOC',location:''}],materials:[{id:'a',name:'Cement',siteId:'s',unit:'bags',balance:0,minimum:10},{id:'b',name:'Sand',siteId:'s',unit:'m3',balance:5,minimum:5},{id:'c',name:'Steel',siteId:'s',unit:'pcs',balance:11,minimum:10}],workers:[],attendance:[],photos:[],movements:[],audit:[]};
assert.deepEqual(stockAlerts(state).map(a=>[a.id,a.empty,a.shortage]),[['a',true,10],['b',false,0]]);
state.materials[0].balance=11;state.materials[1].balance=6;
assert.equal(stockAlerts(state).length,0);
console.log('PASS: threshold, empty-stock urgency and automatic resolution after restock');
