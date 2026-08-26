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

-- ───────────────────── 6. Visão de pendências ─────────────────────
-- Alimenta a aba "Em aberto" com uma consulta só.

create or replace view public.pendencias
with (security_invoker = true) as
select
  i.id, i.vistoria_id, i.ordem, i.titulo, i.local, i.grau, i.status,
  i.acao, i.responsavel, i.prazo, i.prazo_data, i.normas,
  i.foto_encontrada, i.foto_requerida, i.encerrado_em,
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
