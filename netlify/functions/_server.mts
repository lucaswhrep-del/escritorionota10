import { getDeployStore, getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import { initial, type State } from "../../lib/campaign";

export class AppError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const isProduction = () => Netlify.context?.deploy.context === "production";
export const campaignStore = () => isProduction()
  ? getStore("campaign-data", { consistency: "strong" })
  : getDeployStore("campaign-data", { consistency: "strong" });
export const evidenceStore = () => isProduction()
  ? getStore("campaign-evidence", { consistency: "strong" })
  : getDeployStore("campaign-evidence", { consistency: "strong" });

export type StoredCampaign = { revision: number; state: State };

export async function context() {
  const user = await getUser();
  if (!user?.email) throw new AppError("Entre com sua conta para acessar a campanha.", 401);
  const stored = await campaignStore().get("main", { type: "json" }) as StoredCampaign | null;
  if (!stored) throw new AppError("A campanha ainda precisa ser ativada pelo gestor.", 428);
  const email = user.email.toLowerCase();
  const admin = stored.state.admin === user.id;
  const person = stored.state.people.find((item) => item.email && item.email === email);
  if (!admin && !person) throw new AppError("Seu e-mail ainda não foi vinculado à campanha. Solicite o cadastro ao gestor.", 403);
  return { user: { id: user.id, email }, state: stored.state, revision: stored.revision, admin, person };
}

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new AppError("Origem inválida.", 403);
}

export function responseError(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ error: "Não foi possível concluir. Seus dados não foram descartados; tente novamente." }, { status: 503 });
}

export async function save(c: Awaited<ReturnType<typeof context>>, action: string) {
  const latest = await campaignStore().get("main", { type: "json" }) as StoredCampaign | null;
  if (!latest || latest.revision !== c.revision) throw new AppError("Outra alteração ocorreu. Atualize a página antes de tentar novamente.", 409);
  c.state.audit.push({ at: new Date().toISOString(), actor: c.user.email, action });
  await campaignStore().setJSON("main", { revision: c.revision + 1, state: c.state });
}

function configuredEmails() {
  const raw = Netlify.env.get("PARTICIPANT_EMAILS");
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function bootstrap(request: Request) {
  checkOrigin(request);
  const user = await getUser();
  if (!user?.email) throw new AppError("Entre com sua conta.", 401);
  const adminEmail = Netlify.env.get("ADMIN_EMAIL")?.trim().toLowerCase();
  if (!adminEmail || user.email.toLowerCase() !== adminEmail) throw new AppError("Somente o gestor configurado pode ativar a campanha.", 403);
  const store = campaignStore();
  const current = await store.get("main");
  if (!current) await store.setJSON("main", { revision: 0, state: initial(user.id, configuredEmails()) });
}

export type Evidence = { id: string; task: string; person: string; name: string; size: number; created: string; type: string };
export async function evidenceIndex() {
  return (await evidenceStore().get("index", { type: "json" }) as Evidence[] | null) ?? [];
}
