export const MONTHS=['2026-10','2026-11','2026-12'];
export const NAMES=['Alexandre Humberto','Raimundo Damasceno','Matheus Andrade','Isabel Silva'];
export type Person={id:string;name:string;email:string;sector:string};
export type Task={id:string;person:string;date:string;title:string;description:string;status:'open'|'pending'|'approved'|'rejected'|'waived';comment:string;review:string;submittedAt?:string};
export type Month={excluded:string[];sectors:Record<string,{target:number;revenue:number}>;closed?:{at:string;scores:Record<string,Score>}};
export type Score={retained:number;base:number|null;award:number|null;achievement:number|null;lost:number;pending:number;days:number};
export type State={admin:string;people:Person[];months:Record<string,Month>;tasks:Task[];audit:{at:string;actor:string;action:string}[]};
export function initial(admin:string,emails:string[]=[]):State{return {admin,people:NAMES.map((name,i)=>({id:String(i+1),name,email:(emails[i]||'').trim().toLowerCase(),sector:['Refrigerado','Linha Seca','Administrativo','Linha Seca'][i]})),months:Object.fromEntries(MONTHS.map(m=>[m,{excluded:[],sectors:{}}])),tasks:[],audit:[]};}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function days(month:string,excluded:string[]=[]){const dates:string[]=[];for(let i=1;i<=31;i++){const d=new Date(month+'-'+String(i).padStart(2,'0')+'T12:00:00Z');if(!Number.isNaN(+d)&&d.toISOString().slice(0,7)===month&&![0,6].includes(d.getUTCDay())&&!excluded.includes(d.toISOString().slice(0,10)))dates.push(d.toISOString().slice(0,10));}return dates;}
export function score(s:State,p:Person,month:string,now=today()):Score{const m=s.months[month];if(m.closed)return m.closed.scores[p.id];const workdays=days(month,m.excluded);const tasks=s.tasks.filter(t=>t.person===p.id&&t.date.startsWith(month));let lost=0;for(const d of workdays){const daily=tasks.filter(t=>t.date===d);if(d<now&&daily.length)lost+=daily.filter(t=>t.status==='open'||t.status==='rejected').length/daily.length*100/workdays.length;}const retained=Math.max(0,100-lost);const metric=m.sectors[p.sector];const achievement=metric?.target>0?metric.revenue/metric.target*100:null;const base=achievement===null?null:achievement>=110?600:achievement>=100?500:achievement>=90?400:0;return {retained,base,award:base===null?null:Math.round(base*retained)/100,achievement,lost,pending:tasks.filter(t=>t.status==='pending').length,days:workdays.length};}
export const money=(v:number|null)=>v===null?'A configurar':v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const pct=(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';

