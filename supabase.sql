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

-- Checklist da norma: as respostas ficam congeladas na própria vistoria — o
-- enunciado do item é gravado junto da resposta, como o texto das normas nos
-- apontamentos. Mexer na biblioteca depois não altera relatório que já existe.
alter table public.vistorias add column if not exists checklist          jsonb not null default '[]'::jsonb;
alter table public.vistorias add column if not exists proprietario       text;
alter table public.vistorias add column if not exists responsavel_turma  text;
alter table public.vistorias add column if not exists colaboradores      int;
alter table public.vistorias add column if not exists hora_inicio        text;
alter table public.vistorias add column if not exists hora_fim           text;
alter table public.vistorias add column if not exists tecnico_registro   text;
alter table public.vistorias add column if not exists observacoes        text;

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

-- ─────────── 2b. Quem administra e quem enxerga tudo ───────────
-- Definido antes das políticas porque elas chamam estas funções.
-- Bootstrap: enquanto a tabela estiver vazia, qualquer pessoa logada conta como
-- administrador — é assim que o primeiro se cadastra.

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

-- ve_tudo: quem enxerga as vistorias de toda a equipe. Padrao true para quem
-- ja estava na lista — ninguem perde acesso sem decisao de quem administra.
alter table public.administradores add column if not exists ve_tudo boolean not null default true;

create or replace function public.ve_tudo()
returns boolean
language sql stable security definer set search_path = public, auth as $$
  select
    not exists (select 1 from public.administradores)
    or exists (
      select 1 from public.administradores a
      where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and a.ve_tudo
    );
$$;


-- ────────────────────── 3. Segurança por linha ──────────────────────
-- Regra adotada: cada conta enxerga e trata as vistorias que ela mesma lançou.
-- Quem estiver marcado com ve_tudo na tabela administradores enxerga as de toda
-- a equipe — é isso que permite o Guilherme encerrar o apontamento que o técnico
-- abriu e acompanhar o quadro inteiro. Quem NÃO tem conta não enxerga nada.
-- A marcação é feita na aba Configurações, na lista "Quem pode editar".

alter table public.vistorias enable row level security;
alter table public.itens     enable row level security;

drop policy if exists vistorias_ler      on public.vistorias;
drop policy if exists vistorias_inserir  on public.vistorias;
drop policy if exists vistorias_alterar  on public.vistorias;
drop policy if exists vistorias_apagar   on public.vistorias;

-- Quem enxerga o quê: cada conta vê o que ela mesma lançou; quem estiver
-- marcado com ve_tudo na tabela administradores vê as vistorias de todos.
create policy vistorias_ler     on public.vistorias for select to authenticated using (user_id = auth.uid() or public.ve_tudo());
create policy vistorias_inserir on public.vistorias for insert to authenticated with check (user_id = auth.uid());
create policy vistorias_alterar on public.vistorias for update to authenticated using (user_id = auth.uid() or public.ve_tudo()) with check (user_id = auth.uid() or public.ve_tudo());
create policy vistorias_apagar  on public.vistorias for delete to authenticated using (user_id = auth.uid());

drop policy if exists itens_ler     on public.itens;
drop policy if exists itens_inserir on public.itens;
drop policy if exists itens_alterar on public.itens;
drop policy if exists itens_apagar  on public.itens;

create policy itens_ler     on public.itens for select to authenticated using (user_id = auth.uid() or public.ve_tudo());
create policy itens_inserir on public.itens for insert to authenticated with check (user_id = auth.uid());
create policy itens_alterar on public.itens for update to authenticated using (user_id = auth.uid() or public.ve_tudo()) with check (user_id = auth.uid() or public.ve_tudo());
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

-- A foto segue a vistoria: o caminho no bucket comeca com o id dela.
create policy fotos_ler    on storage.objects for select to authenticated
  using (bucket_id = 'vistorias' and (
    public.ve_tudo()
    or owner = auth.uid()
    or exists (select 1 from public.vistorias v
               where v.user_id = auth.uid() and v.id::text = split_part(name, '/', 1))
  ));
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

alter table public.administradores enable row level security;

drop policy if exists admin_ler     on public.administradores;
drop policy if exists admin_inserir on public.administradores;
drop policy if exists admin_apagar  on public.administradores;

create policy admin_ler     on public.administradores for select to authenticated using (true);
create policy admin_inserir on public.administradores for insert to authenticated with check (public.eh_admin());
create policy admin_apagar  on public.administradores for delete to authenticated using (public.eh_admin());

grant select, insert, update, delete on public.administradores to authenticated;
grant execute on function public.eh_admin() to authenticated;

grant execute on function public.ve_tudo() to authenticated;

drop policy if exists admin_alterar on public.administradores;
create policy admin_alterar on public.administradores for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

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
alter table public.configuracoes add column if not exists checklists jsonb not null default '{}'::jsonb;

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
-- ─────────────── 9. Responsável pela vistoria ───────────────
-- O administrador escolhe outra conta para responder por uma vistoria. Essa
-- pessoa passa a enxergar a vistoria e a encerrar os apontamentos dela, mesmo
-- sem "ve_tudo". Quem lançou continua com acesso. Só administrador troca.

alter table public.vistorias add column if not exists designado_id    uuid references auth.users(id) on delete set null;
alter table public.vistorias add column if not exists designado_email text;
alter table public.vistorias add column if not exists designado_nome  text;
alter table public.vistorias add column if not exists designado_em    timestamptz;
alter table public.vistorias add column if not exists designado_por   text;

-- Pode tratar a vistoria: quem lançou ou quem foi designado.
create or replace function public.pode_tratar(p_vistoria uuid)
returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.vistorias v
    where v.id = p_vistoria
      and (v.user_id = auth.uid() or v.designado_id = auth.uid())
  );
$$;
grant execute on function public.pode_tratar(uuid) to authenticated;

-- Trava no banco: ninguém além do administrador mexe no responsável.
create or replace function public.trava_designado()
returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if (new.designado_id is distinct from old.designado_id
      or new.designado_email is distinct from old.designado_email
      or new.designado_nome is distinct from old.designado_nome)
     and not public.eh_admin() then
    raise exception 'Só administrador altera o responsável da vistoria.';
  end if;
  return new;
end $$;

drop trigger if exists vistorias_trava_designado on public.vistorias;
create trigger vistorias_trava_designado before update on public.vistorias
  for each row execute function public.trava_designado();

-- Troca o responsável. p_usuario nulo devolve a vistoria só para quem lançou.
create or replace function public.designar_responsavel(p_vistoria uuid, p_usuario uuid)
returns json
language plpgsql security definer set search_path = public, auth as $$
declare
  u record;
begin
  if not public.eh_admin() then
    raise exception 'Só administrador altera o responsável da vistoria.';
  end if;
  if not exists (select 1 from public.vistorias where id = p_vistoria) then
    raise exception 'Vistoria não encontrada.';
  end if;
  if p_usuario is null then
    update public.vistorias
       set designado_id = null, designado_email = null, designado_nome = null,
           designado_em = now(), designado_por = auth.jwt() ->> 'email'
     where id = p_vistoria;
    return json_build_object('ok', true);
  end if;
  select id, email, coalesce(raw_user_meta_data ->> 'nome', raw_user_meta_data ->> 'name', '') as nome
    into u from auth.users where id = p_usuario;
  if not found then
    raise exception 'Conta não encontrada.';
  end if;
  update public.vistorias
     set designado_id = u.id, designado_email = u.email, designado_nome = nullif(u.nome, ''),
         designado_em = now(), designado_por = auth.jwt() ->> 'email'
   where id = p_vistoria;
  return json_build_object('ok', true, 'email', u.email, 'nome', nullif(u.nome, ''));
end $$;
revoke all on function public.designar_responsavel(uuid, uuid) from public, anon;
grant execute on function public.designar_responsavel(uuid, uuid) to authenticated;

-- Políticas refeitas incluindo o designado.
drop policy if exists vistorias_ler     on public.vistorias;
drop policy if exists vistorias_alterar on public.vistorias;
create policy vistorias_ler     on public.vistorias for select to authenticated
  using (user_id = auth.uid() or designado_id = auth.uid() or public.ve_tudo());
create policy vistorias_alterar on public.vistorias for update to authenticated
  using (user_id = auth.uid() or designado_id = auth.uid() or public.ve_tudo())
  with check (user_id = auth.uid() or designado_id = auth.uid() or public.ve_tudo());

drop policy if exists itens_ler     on public.itens;
drop policy if exists itens_alterar on public.itens;
create policy itens_ler     on public.itens for select to authenticated
  using (user_id = auth.uid() or public.ve_tudo() or public.pode_tratar(vistoria_id));
create policy itens_alterar on public.itens for update to authenticated
  using (user_id = auth.uid() or public.ve_tudo() or public.pode_tratar(vistoria_id))
  with check (user_id = auth.uid() or public.ve_tudo() or public.pode_tratar(vistoria_id));

drop policy if exists fotos_ler on storage.objects;
create policy fotos_ler on storage.objects for select to authenticated
  using (bucket_id = 'vistorias' and (
    public.ve_tudo()
    or owner = auth.uid()
    or exists (select 1 from public.vistorias v
               where (v.user_id = auth.uid() or v.designado_id = auth.uid())
                 and v.id::text = split_part(name, '/', 1))
  ));

-- Visão de pendências com o responsável e o tipo (vistoria ou checklist).
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
  (current_date - v.data) as dias_em_aberto,
  v.motivo          as vistoria_motivo,
  (jsonb_typeof(v.checklist) = 'array' and jsonb_array_length(v.checklist) > 0) as eh_checklist,
  v.designado_id    as designado_id,
  v.designado_email as designado_email,
  v.designado_nome  as designado_nome
from public.itens i
join public.vistorias v on v.id = i.vistoria_id;

grant select on public.pendencias to authenticated;

notify pgrst, 'reload schema';
