import type { Config } from "@netlify/functions";
import { MONTHS, days, today, score } from "../../lib/campaign";
import { AppError, bootstrap, checkOrigin, context, evidenceIndex, responseError, save } from "./_server.mts";

function text(value: unknown, max = 500) {
  if (typeof value !== "string" || value.length > max) throw new AppError("Texto inválido.");
  return value.trim();
}

export default async (request: Request) => {
  try {
    if (request.method === "GET") {
      const c = await context(request);
      const people = c.admin ? c.state.people : c.state.people.filter((person) => person.id === c.person!.id);
      const state = {
        ...c.state,
        admin: undefined,
        people: people.map((person) => ({ ...person, email: c.admin ? person.email : "" })),
        tasks: c.admin ? c.state.tasks : c.state.tasks.filter((task) => task.person === c.person!.id),
        audit: c.admin ? c.state.audit.slice(-100) : [],
      };
      return Response.json({
        state,
        admin: c.admin,
        email: c.user.email,
        revision: c.revision,
        scores: Object.fromEntries(MONTHS.map((month) => [month, Object.fromEntries(people.map((person) => [person.id, score(c.state, person, month)]))])),
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    checkOrigin(request);
    // The action payload is validated field by field below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await request.json() as Record<string, any>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError("Requisição inválida.");
    if (body.action === "activate") {
      await bootstrap(request);
      return Response.json({ ok: true });
    }
    const c = await context(request);
    if (body.revision !== c.revision) throw new AppError("Os dados foram alterados. Atualize antes de salvar.", 409);
    const state = c.state;
    const month = String(body.month);
    if (!MONTHS.includes(month)) throw new AppError("Mês inválido.");
    const selected = state.months[month];
    if (selected.closed) throw new AppError("Este mês já foi fechado.");
    if (body.action !== "submit" && !c.admin) throw new AppError("Ação exclusiva do gestor.", 403);

    if (body.action === "person") {
      const person = state.people.find((item) => item.id === body.id);
      if (!person) throw new AppError("Pessoa inválida.");
      const email = text(body.email, 200).toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("Informe um e-mail válido.");
      if (email && state.people.some((item) => item.id !== person.id && item.email === email)) throw new AppError("E-mail já utilizado por outra pessoa.");
      const sector = text(body.sector, 100);
      if (state.tasks.some((task) => task.person === person.id && task.submittedAt) && person.sector !== sector) throw new AppError("O setor fica fixo após a primeira entrega.");
      person.email = email;
      person.sector = sector;
    } else if (body.action === "metrics") {
      const sector = text(body.sector, 100);
      if (!sector || !state.people.some((person) => person.sector === sector)) throw new AppError("Configure primeiro os setores dos participantes.");
      const target = Number(body.target), revenue = Number(body.revenue);
      if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(revenue) || revenue < 0 || target > 1e12 || revenue > 1e12) throw new AppError("Informe meta positiva e faturamento não negativo.");
      selected.sectors[sector] = { target, revenue };
    } else if (body.action === "calendar") {
      if (today() >= month + "-01" || state.tasks.some((task) => task.date.startsWith(month))) throw new AppError("Defina o calendário antes do início do mês e antes de cadastrar desafios.");
      if (!Array.isArray(body.excluded) || body.excluded.some((value: unknown) => typeof value !== "string" || !days(month).includes(value))) throw new AppError("Informe datas úteis válidas deste mês.");
      selected.excluded = [...new Set(body.excluded)] as string[];
      if (!days(month, selected.excluded).length) throw new AppError("O mês precisa ter ao menos um dia útil.");
    } else if (body.action === "create") {
      const requestedDates = Array.isArray(body.dates) ? body.dates : [body.date];
      const dates = [...new Set(requestedDates.map((value: unknown) => text(value, 10)))];
      if (!dates.length || dates.length > 31 || dates.some((date) => !days(month, selected.excluded).includes(date) || date < today())) throw new AppError("Escolha uma ou mais datas úteis atuais ou futuras deste mês.");
      const ids = body.person === "all" ? state.people.map((person) => person.id) : [body.person];
      if (ids.some((id: string) => !state.people.some((person) => person.id === id))) throw new AppError("Pessoa inválida.");
      if (state.tasks.some((task) => dates.includes(task.date) && ids.includes(task.person) && task.submittedAt)) throw new AppError("Uma das datas escolhidas já possui entrega e não pode receber novos desafios.");
      const title = text(body.title, 150), description = text(body.description, 2000);
      if (!title) throw new AppError("Informe o desafio.");
      for (const date of dates) for (const person of ids) state.tasks.push({ id: crypto.randomUUID(), person, date, title, description, status: "open", comment: "", review: "" });
    } else if (body.action === "submit") {
      const task = state.tasks.find((item) => item.id === body.id && item.date.startsWith(month));
      if (!task || !c.person || task.person !== c.person.id) throw new AppError("Você só pode enviar seus próprios desafios.", 403);
      if (task.date !== today()) throw new AppError("As entregas são permitidas apenas no dia do desafio, até 23h59 de Brasília.");
      if (!["open", "rejected"].includes(task.status)) throw new AppError("Esta entrega já foi enviada.");
      const comment = text(body.comment, 2000);
      if (!comment && !(await evidenceIndex()).some((item) => item.task === task.id)) throw new AppError("Escreva um relato ou anexe pelo menos um comprovante antes de enviar.");
      task.comment = comment;
      task.status = "pending";
      task.submittedAt = new Date().toISOString();
    } else if (body.action === "review") {
      const task = state.tasks.find((item) => item.id === body.id && item.date.startsWith(month));
      if (!task || !["approved", "rejected", "waived"].includes(body.status)) throw new AppError("Validação inválida.");
      if (body.status !== "waived" && task.status !== "pending") throw new AppError("Só é possível validar uma entrega pendente.");
      const reason = text(body.reason, 1000);
      if (body.status !== "approved" && !reason) throw new AppError("Informe a justificativa.");
      task.status = body.status;
      task.review = reason;
    } else if (body.action === "close") {
      if (today() <= days(month).slice(-1)[0]) throw new AppError("O fechamento só fica disponível após o último dia útil do mês.");
      if (state.tasks.some((task) => task.date.startsWith(month) && task.status === "pending")) throw new AppError("Valide todas as entregas pendentes antes de fechar.");
      if (state.people.some((person) => !person.sector || !selected.sectors[person.sector]?.target)) throw new AppError("Configure as metas de todos os setores antes de fechar.");
      selected.closed = { at: new Date().toISOString(), scores: Object.fromEntries(state.people.map((person) => [person.id, score(state, person, month)])) };
    } else {
      throw new AppError("Ação inválida.");
    }
    await save(c, `${body.action} · ${month}${body.id ? " · " + body.id : ""}${body.reason ? " · " + body.reason : ""}`);
    return Response.json({ ok: true });
  } catch (error) {
    return responseError(error);
  }
};

export const config: Config = { path: "/api/campaign" };
