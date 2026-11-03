import type { State, Score } from './campaign';

export async function exportMonth(state: State, scores: Record<string, Score>, month: string) {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  book.creator = 'Escritório Nota 10';
  book.created = new Date();
  const closed = state.months[month].closed;
  const summary = book.addWorksheet('Resultado mensal');
  summary.addRow(['Escritório Nota 10 — Resultado mensal', month]);
  summary.addRow(['Situação', closed ? 'Fechado' : 'Provisório — sujeito à validação e fechamento']);
  summary.addRow(['Exportado em (Brasília)', new Date().toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo'})]);
  if (closed) summary.addRow(['Fechado em (Brasília)', new Date(closed.at).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo'})]);
  summary.addRow([]);
  const header = summary.addRow(['Participante','Setor','Meta (R$)','Faturamento (R$)','Atingimento','Percentual preservado','Percentual perdido','Prêmio-base (R$)','Prêmio (R$)','Dias úteis','Aguardando validação']);
  for (const person of state.people) {
    const q = scores[person.id], metric = state.months[month].sectors[person.sector];
    const row = summary.addRow([person.name,person.sector,metric?.target??null,metric?.revenue??null,q.achievement===null?null:q.achievement/100,q.retained/100,q.lost/100,q.base,q.award,q.days,q.pending]);
    for (const col of [3,4,8,9]) row.getCell(col).numFmt = '"R$" #,##0.00';
    for (const col of [5,6,7]) row.getCell(col).numFmt = '0.00%';
  }
  const total = summary.addRow(['Total de premiação',...Array(7).fill(null),state.people.reduce((sum,p)=>sum+(scores[p.id].award??0),0)]);
  total.getCell(9).numFmt = '"R$" #,##0.00';
  total.font = {bold:true};
  summary.addRow(['Campos vazios indicam valores ainda não configurados. O total soma os prêmios disponíveis.']);
  summary.columns.forEach((col,i)=>{col.width=[30,22,20,23,20,25,23,23,23,16,26][i]||24;});
  summary.views = [{state:'frozen',ySplit:header.number}];
  summary.autoFilter = {from:{row:header.number,column:1},to:{row:header.number+state.people.length,column:11}};
  const detail = book.addWorksheet('Desafios');
  const detailHeader = detail.addRow(['Data','Participante','Setor','Desafio','Orientação','Situação','Relato','Validação do gestor','Enviado em (Brasília)']);
  const statuses = {open:'A realizar',pending:'Aguardando validação',approved:'Aprovado',rejected:'Devolvido',waived:'Abonado'};
  for (const task of state.tasks.filter(t=>t.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date)||a.person.localeCompare(b.person))) {
    const person = state.people.find(p=>p.id===task.person);
    detail.addRow([task.date.split('-').reverse().join('/'),person?.name??'',person?.sector??'',task.title,task.description,statuses[task.status],task.comment,task.review,task.submittedAt?new Date(task.submittedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'']);
  }
  detail.columns.forEach((col,i)=>{col.width=[15,30,22,45,55,25,55,45,26][i];});
  detail.views = [{state:'frozen',ySplit:1}];
  detail.autoFilter = {from:{row:1,column:1},to:{row:Math.max(1,detail.rowCount),column:9}};
  for (const sheet of [summary,detail]) {
    sheet.eachRow(row=>{row.eachCell(cell=>{cell.alignment={vertical:'top',wrapText:true};});});
  }
  for (const row of [header,detailHeader]) {
    row.height = 32;
    row.eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF123C73'}};});
  }
  const bytes = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = `escritorio-nota-10-resultados-${month}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
