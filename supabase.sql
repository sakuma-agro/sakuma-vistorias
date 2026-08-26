-- ═══════════════════════════════════════════════════════════════════════════
-- SAKUMA Vistorias — estrutura do banco
-- Cole tudo isto no Supabase → SQL Editor → New query → Run.
-- Pode rodar mais de uma vez sem quebrar nada.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── 1. Tabelas ───────────────────────────

create table if not exists public.vistorias (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  codigo          text not null,
  unidade         text,
  setor           text,
  data            date,
  tecnico         text,
  cargo           text,
  motivo          text,
  aprovador       text,
  aprovador_cargo text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create table if not exists public.itens (
  id                uuid primary key default gen_random_uuid(),
  vistoria_id       uuid not null references public.vistorias(id) on delete cascade,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ordem             int  not null default 0,
  chave             text,
  categoria         text,
  titulo            text,
  local             text,
  encontrada        text,
  risco             text,
  grau              text check (grau in ('Crítico','Alto','Médio','Baixo')),
  normas            text[] not null default '{}',
  normas_texto      jsonb  not null default '[]'::jsonb,  -- texto congelado no momento do salvamento
  requerida         text,
  acao              text,
  prazo             text,
  prazo_data        date,
  responsavel       text,
  evidencia         text,
  pendencias        text,
  status            text not null default 'Aberto'
                    check (status in ('Aberto','Em andamento','Concluído')),
  foto_encontrada   text,   -- caminho no bucket, não URL
  foto_requerida    text,
  foto_encerramento text,
  encerrado_em      timestamptz,
  encerrado_obs     text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

-- Colunas acrescentadas depois da primeira versão: o "create table if not
-- exists" acima não as adiciona num banco que já existe, então vão aqui.
alter table public.itens add column if not exists normas_texto jsonb not null default '[]'::jsonb;

create index if not exists itens_vistoria_idx on public.itens (vistoria_id);
create index if not exists itens_status_idx   on public.itens (status);
create index if not exists itens_prazo_idx    on public.itens (prazo_data);
create index if not exists vistorias_data_idx on public.vistorias (data desc);

-- ─────────────────── 2. atualizado_em automático ───────────────────

create or replace function public.marca_atualizacao()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists vistorias_atualizado on public.vistorias;
create trigger vistorias_atualizado before update on public.vistorias
  for each row execute function public.marca_atualizacao();

drop trigger if exists itens_atualizado on public.itens;
create trigger itens_atualizado before update on public.itens
  for each row execute function public.marca_atualizacao();

-- ────────────────────── 3. Segurança por linha ──────────────────────
-- Regra adotada: a SAKUMA é uma organização só. Quem tem conta criada por você
-- enxerga e trata todas as vistorias — é isso que permite o Guilherme encerrar
-- o apontamento que o técnico abriu. Quem NÃO tem conta não enxerga nada.
-- Para restringir cada técnico às suas próprias vistorias, troque
-- "using (true)" por "using (user_id = auth.uid())" nas quatro políticas.

alter table public.vistorias enable row level security;
alter table public.itens     enable row level security;

drop policy if exists vistorias_ler      on public.vistorias;
drop policy if exists vistorias_inserir  on public.vistorias;
drop policy if exists vistorias_alterar  on public.vistorias;
drop policy if exists vistorias_apagar   on public.vistorias;

create policy vistorias_ler     on public.vistorias for select to authenticated using (true);
create policy vistorias_inserir on public.vistorias for insert to authenticated with check (user_id = auth.uid());
create policy vistorias_alterar on public.vistorias for update to authenticated using (true) with check (true);
create policy vistorias_apagar  on public.vistorias for delete to authenticated using (user_id = auth.uid());

drop policy if exists itens_ler     on public.itens;
drop policy if exists itens_inserir on public.itens;
drop policy if exists itens_alterar on public.itens;
drop policy if exists itens_apagar  on public.itens;

create policy itens_ler     on public.itens for select to authenticated using (true);
create policy itens_inserir on public.itens for insert to authenticated with check (user_id = auth.uid());
create policy itens_alterar on public.itens for update to authenticated using (true) with check (true);
create policy itens_apagar  on public.itens for delete to authenticated using (user_id = auth.uid());

-- ────────────────────────── 4. Fotos ──────────────────────────
-- Bucket privado: nenhuma foto fica acessível por link solto. O app pede uma
-- URL assinada de 1 hora para exibir cada imagem.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vistorias', 'vistorias', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists fotos_ler     on storage.objects;
drop policy if exists fotos_enviar  on storage.objects;
drop policy if exists fotos_trocar  on storage.objects;
drop policy if exists fotos_apagar  on storage.objects;

create policy fotos_ler    on storage.objects for select to authenticated
  using (bucket_id = 'vistorias');
create policy fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'vistorias');
create policy fotos_trocar on storage.objects for update to authenticated
  using (bucket_id = 'vistorias') with check (bucket_id = 'vistorias');
create policy fotos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'vistorias' and owner = auth.uid());

-- ─────────────────── 5. Permissões de leitura/escrita ───────────────────
-- O Supabase costuma conceder isto sozinho, mas deixar explícito evita o erro
-- "permission denied for table" quando o projeto foi criado fora do padrão.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.vistorias to authenticated;
grant select, insert, update, delete on public.itens     to authenticated;

-- ─────────────────── 6. Quem pode editar normas e regras ───────────────────
-- Só administradores mudam a biblioteca de normas, as anomalias e os prazos.
-- Bootstrap: enquanto a tabela estiver vazia, qualquer pessoa logada conta como
-- administrador — é assim que o primeiro se cadastra. A partir do primeiro nome
-- gravado, só quem está na lista edita.

create table if not exists public.administradores (
  email      text primary key,
  nome       text,
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users(id)
);

create or replace function public.eh_admin()
returns boolean
language sql stable security definer set search_path = public, auth as $$
  select
    not exists (select 1 from public.administradores)
    or exists (
      select 1 from public.administradores a
      where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

alter table public.administradores enable row level security;

drop policy if exists admin_ler     on public.administradores;
drop policy if exists admin_inserir on public.administradores;
drop policy if exists admin_apagar  on public.administradores;

create policy admin_ler     on public.administradores for select to authenticated using (true);
create policy admin_inserir on public.administradores for insert to authenticated with check (public.eh_admin());
create policy admin_apagar  on public.administradores for delete to authenticated using (public.eh_admin());

grant select, insert, delete on public.administradores to authenticated;
grant execute on function public.eh_admin() to authenticated;

-- ─────────────────── 7. Regras de prazo, normas e anomalias ───────────────────
-- Uma linha só, compartilhada por toda a equipe: prazo de cada grau de risco,
-- a janela de atenção e os prazos específicos por anomalia.

create table if not exists public.configuracoes (
  id            int primary key default 1 check (id = 1),
  regras        jsonb not null default '{}'::jsonb,   -- prazos por grau, janela de atenção
  normas        jsonb not null default '{}'::jsonb,   -- normas criadas ou alteradas pela equipe
  anomalias     jsonb not null default '{}'::jsonb,   -- anomalias criadas ou alteradas pela equipe
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id)
);

alter table public.configuracoes add column if not exists normas    jsonb not null default '{}'::jsonb;
alter table public.configuracoes add column if not exists anomalias jsonb not null default '{}'::jsonb;

insert into public.configuracoes (id, regras) values (1, '{}'::jsonb)
on conflict (id) do nothing;

drop trigger if exists configuracoes_atualizado on public.configuracoes;
create trigger configuracoes_atualizado before update on public.configuracoes
  for each row execute function public.marca_atualizacao();

alter table public.configuracoes enable row level security;

drop policy if exists config_ler     on public.configuracoes;
drop policy if exists config_alterar on public.configuracoes;

create policy config_ler     on public.configuracoes for select to authenticated using (true);
create policy config_alterar on public.configuracoes for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

grant select, update on public.configuracoes to authenticated;

-- ───────────────────── 8. Visão de pendências ─────────────────────
-- Alimenta a aba "Em aberto" com uma consulta só.

-- A visão é recriada do zero: o "create or replace" recusa mudar a ordem ou o
-- nome das colunas de uma visão que já existe.
drop view if exists public.pendencias;

create view public.pendencias
with (security_invoker = true) as
select
  i.id, i.vistoria_id, i.ordem, i.chave, i.categoria,
  i.titulo, i.local, i.grau, i.status,
  i.encontrada, i.risco, i.requerida, i.acao, i.evidencia, i.pendencias,
  i.responsavel, i.prazo, i.prazo_data, i.normas, i.normas_texto,
  i.foto_encontrada, i.foto_requerida, i.foto_encerramento,
  i.encerrado_em, i.encerrado_obs,
  v.codigo   as vistoria_codigo,
  v.unidade  as unidade,
  v.setor    as setor,
  v.data     as vistoria_data,
  v.tecnico  as tecnico,
  case
    when i.status = 'Concluído' then 'Concluído'
    when i.prazo_data is null then 'Sem prazo'
    when i.prazo_data < current_date then 'Vencido'
    when i.prazo_data <= current_date + 3 then 'Vence em breve'
    else 'No prazo'
  end as situacao_prazo,
  (current_date - v.data) as dias_em_aberto
from public.itens i
join public.vistorias v on v.id = i.vistoria_id;

grant select on public.pendencias to authenticated;

-- Faz a API enxergar as tabelas novas na hora, sem esperar o cache virar.
notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- Depois de rodar: Authentication → Providers → Email ligado;
-- Authentication → Users → Add user para cada técnico (marque "Auto Confirm").
-- Em Authentication → Sign In / Providers, deixe "Allow new users to sign up"
-- DESLIGADO — assim só entra quem você cadastrar.
-- ═══════════════════════════════════════════════════════════════════════════
