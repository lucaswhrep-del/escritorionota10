import type { Config } from "@netlify/functions";
import { today } from "../../lib/campaign";
import { AppError, checkOrigin, context, evidenceIndex, evidenceStore, responseError, type Evidence } from "./_server.mts";

export default async (request: Request) => {
  try {
    if (request.method === "GET") {
      const c = await context();
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
    if (Number(request.headers.get("content-length") || 0) > 5 * 1024 * 1024) throw new AppError("Máximo de 4 MB por arquivo.");
    const c = await context();
    const form = await request.formData();
    const task = c.state.tasks.find((item) => item.id === form.get("task"));
    if (!task || !c.person || task.person !== c.person.id) throw new AppError("Você só pode anexar comprovantes aos seus desafios.", 403);
    if (c.state.months[task.date.slice(0, 7)].closed || task.date !== today() || !["open", "rejected"].includes(task.status)) throw new AppError("O prazo de envio não está aberto.");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024) throw new AppError("Selecione um arquivo de até 4 MB.");
    if (!/\.(png|jpe?g|webp|pdf|xlsx?|csv|docx?|txt)$/i.test(file.name)) throw new AppError("Use imagem, PDF, planilha, Word ou texto.");
    const store = evidenceStore();
    const index = await evidenceIndex();
    if (index.filter((item) => item.task === task.id).length >= 10) throw new AppError("Limite de 10 comprovantes por desafio.");
    const record: Evidence = { id: crypto.randomUUID(), task: task.id, person: task.person, name: file.name.slice(0, 200), size: file.size, created: new Date().toISOString(), type: file.type };
    await store.set(`files/${record.id}`, await file.arrayBuffer());
    await store.setJSON("index", [...index, record]);
    return Response.json({ ok: true });
  } catch (error) {
    return responseError(error);
  }
};

export const config: Config = { path: "/api/evidence" };
