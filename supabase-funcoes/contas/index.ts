// Gestão Rápida (Vistorias e Segurança) — administração de contas.
// Só quem está na tabela public.administradores pode mexer nas contas.
// A chave service_role fica aqui no servidor: nunca no app.
//
// Ações:
//   listar                      → contas com nome, último acesso e se estão bloqueadas
//   criar    {email,nome}       → cria o login já confirmado e devolve a senha UMA vez
//   senha    {id}               → sorteia senha nova e devolve UMA vez
//   definir  {id,senha}         → define a senha escolhida (compatibilidade)
//   renomear {id,nome}          → muda o nome mostrado
//   bloquear {id}               → tira o acesso SEM apagar (apagar a conta apagaria
//                                 as vistorias dela: as tabelas têm on delete cascade)
//   liberar  {id}               → devolve o acesso

const URL_BASE = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), {
    status: s,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const H = () => ({
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
});

function sortearSenha(): string {
  const abc = "abcdefghijkmnpqrstuvwxyz", ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ", num = "23456789";
  const tudo = abc + ABC + num;
  const n = new Uint32Array(12);
  crypto.getRandomValues(n);
  let s = abc[n[0] % abc.length] + ABC[n[1] % ABC.length] + num[n[2] % num.length];
  for (let i = 3; i < 11; i++) s += tudo[n[i] % tudo.length];
  return s;
}

type Usuario = {
  id: string; email: string; last_sign_in_at?: string | null;
  banned_until?: string | null; user_metadata?: Record<string, unknown>;
};

const bloqueado = (u: Usuario) =>
  !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();

async function pegar(id: string): Promise<Usuario | null> {
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, { headers: H() });
  return r.ok ? await r.json() : null;
}

async function atualizar(id: string, corpo: Record<string, unknown>) {
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
    method: "PUT", headers: H(), body: JSON.stringify(corpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.msg ?? d?.error_description ?? d?.message ?? "a base recusou");
  return d as Usuario;
}

async function todas(): Promise<Usuario[]> {
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=500`, { headers: H() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.msg ?? "não deu para listar as contas");
  return d?.users ?? [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return json({ erro: "sem sessão" }, 401);

  // 1. Quem está chamando?
  const u = await fetch(`${URL_BASE}/auth/v1/user`, {
    headers: { apikey: SERVICE, Authorization: auth },
  });
  if (!u.ok) return json({ erro: "sessão inválida" }, 401);
  const quem = await u.json();
  const email = String(quem?.email ?? "").toLowerCase();
  if (!email) return json({ erro: "sessão sem e-mail" }, 401);

  // 2. É administrador? (lista vazia = todo mundo, igual ao eh_admin() do banco)
  const a = await fetch(`${URL_BASE}/rest/v1/administradores?select=email`, { headers: H() });
  const admins = a.ok ? await a.json() : [];
  const ehAdmin = !Array.isArray(admins) || admins.length === 0 ||
    admins.some((x: { email?: string }) => String(x?.email ?? "").toLowerCase() === email);
  if (!ehAdmin) return json({ erro: "Só administradores mexem nas contas." }, 403);

  const corpo = await req.json().catch(() => ({})) as Record<string, unknown>;
  const acao = String(corpo.acao ?? "");
  const id = String(corpo.id ?? "");

  try {
    if (acao === "listar") {
      const contas = (await todas()).map((x) => ({
        id: x.id,
        email: x.email,
        nome: String(x.user_metadata?.nome ?? ""),
        ultimo: x.last_sign_in_at ?? null,
        bloqueado: bloqueado(x),
      })).sort((p, q) => p.email.localeCompare(q.email));
      return json({ contas });
    }

    if (acao === "criar") {
      const alvo = String(corpo.email ?? "").trim().toLowerCase();
      const nome = String(corpo.nome ?? "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alvo)) return json({ erro: "E-mail inválido." }, 400);

      const existente = (await todas()).find((x) => x.email?.toLowerCase() === alvo);
      if (existente) {
        // Já tinha login: devolve o acesso e atualiza o nome, sem mexer na senha.
        const d = await atualizar(existente.id, {
          ban_duration: "none",
          user_metadata: { ...(existente.user_metadata ?? {}), nome: nome || existente.user_metadata?.nome || "" },
        });
        return json({ ok: true, jaExistia: true, id: d.id });
      }

      const senha = sortearSenha();
      const r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
        method: "POST", headers: H(),
        body: JSON.stringify({ email: alvo, password: senha, email_confirm: true, user_metadata: { nome } }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json({ erro: d?.msg ?? d?.error_description ?? "a base recusou o cadastro" }, 400);
      return json({ ok: true, jaExistia: false, id: d.id, senha });
    }

    if (!id) return json({ erro: "conta não informada" }, 400);
    const conta = await pegar(id);
    if (!conta) return json({ erro: "conta não encontrada" }, 404);
    const eu = conta.email?.toLowerCase() === email;

    if (acao === "senha") {
      const senha = sortearSenha();
      await atualizar(id, { password: senha });
      return json({ ok: true, senha, email: conta.email });
    }

    if (acao === "definir") {
      const senha = String(corpo.senha ?? "");
      if (senha.length < 8) return json({ erro: "A senha precisa de pelo menos 8 caracteres." }, 400);
      await atualizar(id, { password: senha });
      return json({ ok: true, email: conta.email });
    }

    if (acao === "renomear") {
      const nome = String(corpo.nome ?? "").trim();
      await atualizar(id, { user_metadata: { ...(conta.user_metadata ?? {}), nome } });
      return json({ ok: true });
    }

    if (acao === "bloquear") {
      if (eu) return json({ erro: "Você não pode tirar o seu próprio acesso." }, 400);
      // Bloqueada, a conta não entra mais nem renova a sessão; um acesso já
      // aberto cai em no máximo 1 hora, quando o token vence.
      await atualizar(id, { ban_duration: "876000h" });
      return json({ ok: true });
    }

    if (acao === "liberar") {
      await atualizar(id, { ban_duration: "none" });
      return json({ ok: true });
    }

    return json({ erro: "ação desconhecida" }, 400);
  } catch (e) {
    return json({ erro: String((e as Error)?.message ?? e) }, 400);
  }
});
