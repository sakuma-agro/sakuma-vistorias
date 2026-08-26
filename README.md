# SAKUMA Vistorias & Segurança

App de vistoria instalável no celular e no PC. O técnico escolhe a anomalia, anexa a foto do errado e a do correto, e o relatório sai em PDF no padrão SAKUMA com a norma citada em cada apontamento. As pendências ficam na aba **Em aberto** até alguém encerrar com foto de evidência.

Funciona de três formas, na mesma base de código:

**O acesso é por login.** Sem conta criada no Supabase, o app não abre — quem chega vê a tela de entrada e nada mais. Depois do primeiro login o aparelho continua entrando mesmo sem sinal, e o que for registrado offline sobe quando a rede voltar.

---

## Parte 1 — GitHub Pages

O repositório já existe e o Pages já está ligado:

- Repositório: <https://github.com/sakuma-agro/sakuma-vistorias>
- Endereço do app: **<https://sakuma-agro.github.io/sakuma-vistorias/>**
- Publicação: branch `main`, pasta `/ (root)`, HTTPS obrigatório

**Para subir uma versão nova dos arquivos**

Vá em <https://github.com/sakuma-agro/sakuma-vistorias/upload/main> e arraste a pasta `sakuma-vistorias` inteira (ou só os arquivos que mudaram), mantendo a estrutura:

```
index.html
manifest.webmanifest
sw.js
favicon.ico
.nojekyll
supabase.sql
README.md
icons/
  icon-192.png
  icon-512.png
  icon-maskable-512.png
  apple-touch-icon.png
  favicon-32.png
  favicon-16.png
```

Arrastar a pasta `icons` inteira preserva o caminho. Depois **Commit changes**. O Pages republica sozinho em um ou dois minutos.

**Sempre que publicar uma versão nova, mude o número em `VERSAO` no `sw.js`** (`v1` → `v2`). Sem isso, quem já instalou continua abrindo a versão guardada no aparelho.

**Instalar no aparelho**

- **Android / Chrome:** abra o endereço → botão **⤓ Instalar** no topo do app, ou menu ⋮ → *Instalar aplicativo*.
- **iPhone / Safari:** abra o endereço → Compartilhar → **Adicionar à Tela de Início**. (O iOS não mostra o botão Instalar; é sempre por aí.)
- **Windows / Mac, no Chrome ou Edge:** o ícone de instalar aparece na barra de endereço, à direita.

O ícone do escudo SAKUMA Vistorias & Segurança vai para a tela inicial e para a área de trabalho, e o app abre em janela própria.

## Parte 2 — Ligar o Supabase

Sem esta parte o app já funciona: os dados ficam no aparelho de quem preencheu. Com ela, tudo passa a ser compartilhado.

**1. Criar o projeto**

Em <https://supabase.com> → *New project*.

- Name: `sakuma-vistorias`
- Database password: gere uma forte e **guarde** — ela não aparece de novo
- Region: *South America (São Paulo)*

Leva uns dois minutos para provisionar.

**2. Criar as tabelas**

**SQL Editor → New query** → cole o conteúdo de `supabase.sql` → **Run**.

Isso cria as tabelas `vistorias` e `itens`, a visão `pendencias`, as regras de acesso e o bucket de fotos. Pode rodar de novo depois sem quebrar nada.

**3. Criar as contas dos técnicos**

**Authentication → Sign In / Providers**:

- *Email* ligado
- **Allow new users to sign up: desligado** — assim ninguém cria conta sozinho

**Authentication → Users → Add user**, para cada pessoa:

- e-mail e senha
- marque **Auto Confirm User** (senão a pessoa precisa confirmar por e-mail)

**4. Conectar o app**

**Project Settings → API**, copie:

- **Project URL** — `https://xxxxxxxx.supabase.co`
- **anon public** — a chave longa que começa com `eyJ...`

No app: botão **Conectar base** no topo → cole os dois → *Continuar* → entre com e-mail e senha.

Cada pessoa faz isso uma vez, no aparelho dela. Fica guardado.

> A chave `anon public` é feita para ficar exposta — é ela que vai no navegador de todo mundo. Quem protege os dados é a regra de acesso do `supabase.sql`: sem login, ela não abre nada. A chave **`service_role`** é o oposto: essa nunca entra no app nem no repositório.

---

## As quatro abas

**Vistoria** — o registro em si: dados da vistoria e a lista de não conformidades, cada uma com foto do errado e do correto.

**Em aberto** — os apontamentos ainda não encerrados, de todas as vistorias e de toda a equipe, agrupados por unidade. Clique no título ou em *Abrir ficha* para ver o apontamento inteiro: fotos grandes, o texto da norma aplicável, ação corretiva, responsável, prazo e evidência exigida. Dali mesmo dá para mudar o status ou encerrar.

**Relatório** — o PDF no padrão SAKUMA, pronto para imprimir.

**Configurações** — as regras de prazo, descritas abaixo.

---

## Regras de prazo

Ficam na aba **Configurações** e valem para toda a equipe: são gravadas na base, então mudar em um aparelho muda para todos.

**Prazo por grau de risco** — quantos dias cada grau tem para ser resolvido, contados da data da vistoria. O padrão é Crítico 1 dia, Alto 7, Médio 30, Baixo 90.

**Aviso de atenção** — quantos dias antes do vencimento o apontamento fica laranja como "vence em breve". Padrão: 3 dias. A prévia na tela mostra na hora como cada faixa vai aparecer.

**Prazo específico por anomalia** — cada uma das 28 anomalias pode ter grau diferente do padrão, ou um prazo próprio em dias que ignora o grau. Útil quando um item da realidade de vocês é mais urgente do que a regra geral sugere. Prazo em branco = segue o grau.

Prazo já gravado em apontamento antigo não muda sozinho: a regra nova vale para os próximos. Isso é proposital — mudar a régua não pode reescrever o histórico.

---

## Biblioteca de normas e anomalias

Também na aba **Configurações**, e também guardada na base.

**Normas** — a referência, o item e o texto da exigência que o app cita em cada apontamento. As que vêm de fábrica podem ser corrigidas; você cria as suas com *Nova norma*. A caixa **Confirmar** marcada faz o selo *confirmar item* aparecer no relatório — deixe marcada enquanto o número do dispositivo não tiver sido conferido em fonte oficial.

**Anomalias** — os textos que o app preenche sozinho: título, categoria, grau padrão, situação encontrada, risco, situação requerida, ação corretiva, evidência e pendências, mais quais normas ela cita. Dá para criar novas e para *ocultar* uma que não se usa mais — ocultar tira da lista sem apagar o histórico de quem já a registrou.

### O texto fica congelado

Quando a vistoria é salva, o texto de cada norma citada é **gravado junto com o apontamento**. Editar uma norma depois não muda relatório nenhum que já existe: o de março continua dizendo o que dizia em março, e a versão nova vale a partir do próximo apontamento. Num documento que serve de prova em auditoria, isso não é detalhe.

### Quem pode editar

Só quem estiver na lista de **administradores** altera prazos, normas e anomalias. Os demais usam o app normalmente e enxergam tudo — só não mudam a régua.

A trava não é só visual: a regra está no banco, na política `config_alterar` do `supabase.sql`, que consulta a função `eh_admin()`. Mesmo que alguém contorne a interface, o banco recusa.

Enquanto a lista estiver vazia, qualquer pessoa logada conta como administrador — é assim que o primeiro se cadastra. **Adicione o seu e-mail primeiro:** o primeiro nome gravado fecha a porta para todos os outros, inclusive para você se esquecer de se incluir.

---

## Como o app se comporta

**Sem base conectada** — vistorias e pendências ficam no navegador daquele aparelho. A aba Em aberto mostra o que foi salvo ali.

**Com base conectada** — *Salvar vistoria* envia os dados e as fotos. A aba Em aberto passa a mostrar os apontamentos de toda a equipe, de todas as unidades. Mudar o status ou encerrar um item vale para todo mundo.

**Sem internet** — o app abre normalmente e o rascunho continua sendo salvo no aparelho. Ao voltar a rede, clique em *Salvar vistoria* de novo para enviar.

**Fotos** — o app reduz cada foto para no máximo 1400 px antes de guardar, o que dá algo entre 150 KB e 400 KB por imagem. O bucket é privado: as imagens só abrem por link assinado de 1 hora, gerado pelo app para quem está logado.

---

## Limites gratuitos

| | Grátis | O que isso dá |
|---|---|---|
| GitHub Pages | 1 GB de repositório, 100 GB/mês de tráfego | O app inteiro tem menos de 1 MB |
| Supabase — banco | 500 MB | Dezenas de milhares de apontamentos (são só textos) |
| Supabase — fotos | 1 GB | Aproximadamente 4 a 6 mil fotos no tamanho que o app gera |
| Supabase — pausa | Projeto sem acesso por 7 dias entra em pausa | Basta abrir o painel para religar; use o app toda semana e não acontece |

---

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | O app inteiro: interface, biblioteca de anomalias, normas, relatório e integração |
| `manifest.webmanifest` | Nome, cores e ícones da instalação |
| `sw.js` | Faz o app abrir sem internet. Mude `VERSAO` a cada publicação |
| `supabase.sql` | Tabelas, regras de acesso, bucket de fotos, regras de prazo e a visão de pendências |
| `icons/` | Ícone do app em todos os tamanhos |

---

## Ajustes que você provavelmente vai querer

**Cada técnico vendo só as próprias vistorias** — em `supabase.sql`, troque `using (true)` por `using (user_id = auth.uid())` nas políticas de `select`. Atenção: assim o aprovador deixa de enxergar o que os outros abriram.

**Nova anomalia na biblioteca** — no `index.html`, procure `const ANOMALIAS` e copie o formato de uma existente. A norma vem de `const NORMAS`, logo acima; marque `ok:false` em toda citação cujo número de item ainda não tenha sido conferido — é isso que faz o selo *confirmar item* aparecer no relatório.

**Trocar quem aprova** — o campo *Aprovado por* fica no cabeçalho da vistoria e é gravado junto.
