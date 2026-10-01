import type { Config } from "@netlify/functions";
import { today } from "../../lib/campaign";
import { AppError, checkOrigin, context, evidenceIndex, evidenceStore, responseError, save, type Evidence } from "./_server.mts";

export default async (request: Request) => {
  try {
    if (request.method === "GET") {
      const c = await context(request);
      const id = new URL(request.url).searchParams.get("id");
      const index = await evidenceIndex();
      if (id) {
        const file = index.find((item) => item.id === id);
        if (!file || (!c.admin && file.person !== c.person?.id)) throw new AppError("Arquivo indisponível.", 404);
        const data = await evidenceStore().get(`files/${id}`, { type: "arrayBuffer" });
        if (!data) throw new AppError("Arquivo não encontrado.", 404);
        return new Response(data, { headers: {
          "Content-Type": file.type || "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        } });
      }
      const visible = c.admin ? index : index.filter((item) => item.person === c.person!.id);
      return Response.json(visible, { headers: { "Cache-Control": "no-store" } });
    }
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    checkOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > 13 * 1024 * 1024) throw new AppError("Máximo de 3 arquivos com 4 MB cada.");
    const c = await context(request);
    const form = await request.formData();
    const task = c.state.tasks.find((item) => item.id === form.get("task"));
    if (!task || !c.person || task.person !== c.person.id) throw new AppError("Você só pode anexar comprovantes aos seus desafios.", 403);
    if (c.state.months[task.date.slice(0, 7)].closed || task.date !== today() || !["open", "rejected"].includes(task.status)) throw new AppError("O prazo de envio não está aberto.");
    const files = form.getAll("file").filter((item): item is File => item instanceof File && item.size > 0);
    if (!files.length || files.some((file) => file.size > 4 * 1024 * 1024)) throw new AppError("Selecione de 1 a 3 arquivos, com até 4 MB cada.");
    if (files.length > 3 || files.some((file) => !/\.(png|jpe?g|webp|pdf|xlsx?|csv|docx?|txt)$/i.test(file.name))) throw new AppError("Envie no máximo 3 arquivos em formato de imagem, PDF, planilha, Word ou texto.");
    const store = evidenceStore();
    const index = await evidenceIndex();
    const previous = index.filter((item) => item.task === task.id);
    const existing = task.status === "rejected" ? 0 : previous.length;
    if (existing + files.length > 3) throw new AppError(`Este desafio aceita até 3 arquivos. Já existem ${existing} anexado(s).`);
    const records: Evidence[] = files.map((file) => ({ id: crypto.randomUUID(), task: task.id, person: task.person, name: file.name.slice(0, 200), size: file.size, created: new Date().toISOString(), type: file.type }));
    const contents = await Promise.all(files.map((file) => file.arrayBuffer()));
    await Promise.all(records.map((record, i) => store.set(`files/${record.id}`, contents[i])));
    if (task.status === "rejected") await Promise.all(previous.map((item) => store.delete(`files/${item.id}`)));
    const retainedIndex = task.status === "rejected" ? index.filter((item) => item.task !== task.id) : index;
    await store.setJSON("index", [...retainedIndex, ...records]);
    task.status = "pending";
    task.submittedAt = new Date().toISOString();
    task.review = "";
    await save(c, `submit · ${task.date.slice(0, 7)} · ${task.id} · comprovante anexado`);
    return Response.json({ ok: true });
  } catch (error) {
    return responseError(error);
  }
};

export const config: Config = { path: "/api/evidence" };
