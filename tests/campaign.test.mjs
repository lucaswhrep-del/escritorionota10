import assert from 'node:assert/strict';
import {initial,score,days} from '../lib/campaign.ts';
const s=initial('test'),p=s.people[0],m=s.months['2026-10'];
for(const [revenue,base] of [[89.99,0],[90,400],[99.99,400],[100,500],[109.99,500],[110,600]]){m.sectors[p.sector]={target:100,revenue};assert.equal(score(s,p,'2026-10','2026-11-01').base,base)}
m.excluded=['2026-10-12','2026-10-13'];assert.equal(days('2026-10',m.excluded).length,20);m.sectors[p.sector]={target:100,revenue:103};
for(const [i,date] of ['2026-10-01','2026-10-02'].entries())s.tasks.push({id:String(i),person:p.id,date,title:'Teste',description:'',status:'open',comment:'',review:''});
assert.equal(score(s,p,'2026-10','2026-11-01').award,450);assert.equal(score(s,p,'2026-10','2026-09-16').retained,100);
s.tasks[0].status='pending';assert.equal(score(s,p,'2026-10','2026-11-01').award,475);
s.tasks[0].status='approved';s.tasks.push({...s.tasks[1],id:'3',status:'waived'});assert.equal(score(s,p,'2026-10','2026-11-01').award,487.5);
assert.equal(score(s,p,'2026-11','2026-12-01').retained,100);
assert.equal(score(s,p,'2026-11','2026-12-01').award,null);
const snapshot=score(s,p,'2026-10','2026-11-01');m.closed={at:new Date().toISOString(),scores:{[p.id]:snapshot}};m.sectors[p.sector].revenue=0;assert.deepEqual(score(s,p,'2026-10'),snapshot);
console.log('Faixas, dias úteis, perda parcial, pendências, reinício mensal e fechamento: OK');
