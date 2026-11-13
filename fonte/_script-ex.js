/* ══════════════════════════════════════════════════════════════════════════
   Extintores — cadastro fixo e painel de vencimentos (etapa 1)
   Cada extintor é cadastrado uma vez, com a data da última recarga e do último
   teste hidrostático. O app calcula a validade (carga 1 ano, teste 5 anos) e
   aceita a data digitada quando a empresa de recarga usa outro prazo.
   Etapa 2 (13/11/2026, pedido do Guilherme): inspeção semanal e trimestral —
   pressão, obstrução, altura, sinalização, informações legíveis e natureza
   (classe do fogo), mais lacre; a trimestral confere também corpo, mangueira,
   gatilho, suporte, peso do CO₂ e validade. Tabela extintores_inspecoes.

   <script> próprio: um erro aqui não derruba o resto do app. Nomes com "ex".
   ══════════════════════════════════════════════════════════════════════════ */

const EX_CACHE="sakuma-ex-lista", EX_AVISO=30;
const EX_TIPOS=["Pó ABC","Pó BC","Água pressurizada","CO₂","Espuma mecânica"];
let exRegs=[], exCarregou=false, exOffline=false, exAtual=null, exSalvando=false;
let exFiltro={sit:"todos",unidade:"",busca:""};
let exInsp=[], exVista="lista";
const EX_INSP_CACHE="sakuma-ex-insp";
/* natureza do fogo: o que cada tipo apaga (classes A sólidos, B líquidos, C elétrico) */
const EX_CLASSE={"Pó ABC":"A, B, C","Pó BC":"B, C","Água pressurizada":"A","CO₂":"B, C","Espuma mecânica":"A, B"};
const EX_RISCOS=[["","—"],["A","A · sólidos (madeira, papel, palha, pano)"],["B","B · líquidos e gases (diesel, óleo, gás)"],["C","C · equipamento elétrico ligado"],
  ["A, B","A e B"],["A, C","A e C"],["B, C","B e C"],["A, B, C","A, B e C"],["K","K · óleo de cozinha"]];

/* ─────────── datas ─────────── */
function exHoje(){ const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
function exData(iso){ return iso?String(iso).slice(0,10).split("-").reverse().join("/"):""; }
function exSomaAnos(iso,anos){
  if(!iso)return "";
  const [a,m,d]=String(iso).slice(0,10).split("-").map(Number); if(!a)return "";
  const dt=new Date(a+anos,m-1,d);
  if(dt.getMonth()!==m-1)dt.setDate(0);            /* 29/02 → 28/02 */
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
}
/* dias entre hoje e a data, comparando duas meia-noites locais */
function exDias(iso){
  if(!iso)return null;
  const [a,m,d]=String(iso).slice(0,10).split("-").map(Number); if(!a)return null;
  const h=new Date(); const hoje=new Date(h.getFullYear(),h.getMonth(),h.getDate());
  return Math.round((new Date(a,m-1,d)-hoje)/86400000);
}
/* situação de uma validade: venc / breve / ok / sem */
function exSitData(iso){ const n=exDias(iso); if(n==null)return "sem"; if(n<0)return "venc"; if(n<=EX_AVISO)return "breve"; return "ok"; }
const EX_ORDEM={venc:0,breve:1,sem:2,ok:3};
function exSituacao(r){
  const a=exSitData(r.recarga_validade), b=exSitData(r.teste_validade);
  return EX_ORDEM[a]<=EX_ORDEM[b]?a:b;
}
function exProxima(r){
  const ds=[r.recarga_validade,r.teste_validade].filter(Boolean).sort();
  return ds[0]||"";
}
const EX_ROT={venc:"Vencido",breve:"Vence em breve",ok:"Em dia",sem:"Sem data"};
function exSelo(iso){
  const s=exSitData(iso), n=exDias(iso);
  if(s==="sem")return `<span class="ex-selo sem">sem data</span>`;
  const txt=s==="venc"?`vencido há ${-n} d`:n===0?"vence hoje":s==="breve"?`vence em ${n} d`:"em dia";
  return `<span class="ex-selo ${s}">${exData(iso)} · ${txt}</span>`;
}

/* ─────────── base ─────────── */
function exGuardarCache(){ try{ localStorage.setItem(EX_CACHE,JSON.stringify(exRegs)); }catch(e){} }
async function exCarregar(){
  if(!conectado()){
    exOffline=true; try{ exRegs=JSON.parse(localStorage.getItem(EX_CACHE)||"[]"); }catch(e){ exRegs=[]; }
    try{ exInsp=JSON.parse(localStorage.getItem(EX_INSP_CACHE)||"[]"); }catch(e){ exInsp=[]; }
    exCarregou=true; exContador(); return;
  }
  try{
    const [regs,insp]=await Promise.all([
      rest("extintores?select=*&ativo=eq.true&order=codigo.asc"),
      rest("extintores_inspecoes?select=*&order=data.desc,criado_em.desc&limit=5000").catch(e=>{ console.warn("inspeções de extintor",e); return null; })
    ]);
    exRegs=regs||[];
    if(insp){ exInsp=insp; try{ localStorage.setItem(EX_INSP_CACHE,JSON.stringify(exInsp)); }catch(e){} }
    exOffline=false; exCarregou=true; exGuardarCache();
  }catch(e){
    exOffline=true; exCarregou=true;
    try{ exRegs=JSON.parse(localStorage.getItem(EX_CACHE)||"[]"); }catch(x){ exRegs=[]; }
    try{ exInsp=JSON.parse(localStorage.getItem(EX_INSP_CACHE)||"[]"); }catch(x){ exInsp=[]; }
  }
  exContador();
}
function exContador(){
  const n=exRegs.filter(r=>["venc","breve"].includes(exSituacao(r))||exNcAberta(r)).length;
  const c=$("#cont-ex"); if(c){ c.textContent=String(n); c.hidden=!n; }
  const m=$("#mi-ex"); if(m){ m.textContent=n?String(n):""; m.hidden=!n; }
}

async function exSalvar(outro){
  if(exSalvando||!exAtual)return;
  const r=exAtual;
  r.codigo=String(r.codigo||"").trim();
  if(!r.codigo){ toast("Preencha o número do extintor."); const c=$("#ex-codigo"); if(c)c.focus(); return; }
  const rep=exRegs.find(x=>x.id!==r.id&&String(x.codigo).trim().toLowerCase()===r.codigo.toLowerCase()&&(x.unidade||"")===(r.unidade||""));
  if(rep&&!confirm(`Já existe o extintor ${r.codigo}${r.unidade?" em "+r.unidade:""}. Salvar outro com o mesmo número?`))return;
  if(!conectado()){ toast("Sem conexão com a base: o cadastro precisa de rede para ser salvo."); return; }
  exSalvando=true;
  const bt=$("#ex-salvar"); if(bt){bt.disabled=true;}
  try{
    const corpo={codigo:r.codigo,unidade:r.unidade||null,local:r.local||null,tipo:r.tipo||null,capacidade:r.capacidade||null,
      classe:r.classe||null,risco:r.risco||null,
      recarga_data:r.recarga_data||null,recarga_validade:r.recarga_validade||null,
      teste_data:r.teste_data||null,teste_validade:r.teste_validade||null,obs:r.obs||null};
    let d;
    if(r._novo){ corpo.id=r.id; d=await rest("extintores",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(corpo)}); }
    else d=await rest(`extintores?id=eq.${encodeURIComponent(r.id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(corpo)});
    if(!d||!d.length)throw new Error("A base não confirmou a gravação.");
    const novo=d[0];
    exRegs=[...exRegs.filter(x=>x.id!==novo.id),novo].sort((a,b)=>String(a.codigo).localeCompare(String(b.codigo),"pt-BR",{numeric:true}));
    exGuardarCache(); exContador();
    if(outro){
      /* cadastrar o próximo: mantém unidade, tipo, capacidade e as datas, que costumam ser iguais no lote */
      exAtual=exNovo({unidade:r.unidade,tipo:r.tipo,capacidade:r.capacidade,classe:r.classe,recarga_data:r.recarga_data,recarga_validade:r.recarga_validade,
        teste_data:r.teste_data,teste_validade:r.teste_validade});
      toast(`Extintor ${novo.codigo} salvo. Cadastre o próximo.`);
      exRenderForm(); const c=$("#ex-codigo"); if(c)c.focus();
    }else{
      toast(`Extintor ${novo.codigo} salvo.`); exAtual=null; exMostrar("lista");
    }
  }catch(e){
    const m=String(e.message||e);
    toast(/Failed to fetch|NetworkError|Load failed/i.test(m)?"Sem rede: o cadastro não foi salvo. Tente de novo com sinal.":"Não deu para salvar: "+m.slice(0,110));
  }finally{ exSalvando=false; const b=$("#ex-salvar"); if(b)b.disabled=false; }
}

async function exRemover(){
  const r=exAtual; if(!r||r._novo){ exAtual=null; exMostrar("lista"); return; }
  if(!confirm(`Tirar o extintor ${r.codigo} do cadastro? Ele some da lista, mas o histórico fica guardado na base.`))return;
  try{
    const d=await rest(`extintores?id=eq.${encodeURIComponent(r.id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({ativo:false})});
    if(!d||!d.length)throw new Error("A base não confirmou.");
    exRegs=exRegs.filter(x=>x.id!==r.id); exGuardarCache(); exContador();
    toast(`Extintor ${r.codigo} tirado do cadastro.`); exAtual=null; exMostrar("lista");
  }catch(e){ toast("Não deu para tirar: "+String(e.message).slice(0,110)); }
}

function exNovo(base){
  return Object.assign({id:uuid(),_novo:true,codigo:"",unidade:"",local:"",tipo:"Pó ABC",capacidade:"",classe:EX_CLASSE["Pó ABC"],risco:"",
    recarga_data:"",recarga_validade:"",teste_data:"",teste_validade:"",obs:""},base||{});
}

/* ─────────── telas ─────────── */
function exMostrar(qual){
  ["lista","form","insp","hist"].forEach(v=>{ const el=$("#ex-"+v); if(el)el.hidden=v!==qual; });
  exVista=qual;
  aba("ex");
  if(qual==="lista"){ exRenderLista(); exCarregar().then(()=>{ if(!$("#ex-lista").hidden)exRenderLista(); }); }
  else if(qual==="insp"){ exiRender(); exCarregar().then(()=>{ if(exVista==="insp")exiRender(); }); }
  else if(qual==="hist"){ exhRender(); exCarregar().then(()=>{ if(exVista==="hist")exhRender(); }); }
  else exRenderForm();
}
function exUnidades(){ return [...new Set(exRegs.map(r=>(r.unidade||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR")); }
function exFiltrados(){
  const b=exFiltro.busca.trim().toLowerCase();
  return exRegs.filter(r=>{
    if(exFiltro.sit!=="todos"&&exSituacao(r)!==exFiltro.sit)return false;
    if(exFiltro.unidade&&(r.unidade||"").trim()!==exFiltro.unidade)return false;
    if(b&&![r.codigo,r.unidade,r.local,r.tipo,r.capacidade,r.obs].join(" ").toLowerCase().includes(b))return false;
    return true;
  }).sort((a,c)=>EX_ORDEM[exSituacao(a)]-EX_ORDEM[exSituacao(c)]||String(exProxima(a)||"9").localeCompare(String(exProxima(c)||"9"))||
    String(a.codigo).localeCompare(String(c.codigo),"pt-BR",{numeric:true}));
}

function exRenderLista(){
  const alvo=$("#ex-lista"); if(!alvo)return;
  const base=exFiltro.unidade?exRegs.filter(r=>(r.unidade||"").trim()===exFiltro.unidade):exRegs;
  const conta={todos:base.length,venc:0,breve:0,ok:0,sem:0};
  base.forEach(r=>conta[exSituacao(r)]++);
  const kpi=(k,rot,cls)=>`<button type="button" class="ex-kpi ${cls}" data-ex-sit="${k}" aria-pressed="${exFiltro.sit===k}"><b>${conta[k]}</b><span>${rot}</span></button>`;
  const unids=exUnidades();
  alvo.innerHTML=`
    <div class="secao-topo">
      <h2>Extintores</h2>
      <span class="dica">Cadastro de todos os extintores com a validade da carga (1 ano) e do teste hidrostático (5 anos). Vence em breve = até ${EX_AVISO} dias.</span>
      <div class="ex-topo-bts">
        <button class="bt" type="button" data-ex-imprimir>Imprimir lista</button>
        <button class="btn" type="button" data-ex-novo>＋ Cadastrar extintor</button>
      </div>
    </div>
    ${exOffline?`<p class="ad-aviso">Sem conexão com a base: mostrando o que estava guardado neste aparelho. Para cadastrar ou alterar, precisa de rede.</p>`:""}
    <div class="ex-kpis">
      ${kpi("todos","extintores","")}${kpi("venc","vencidos","venc")}${kpi("breve","vencem em breve","breve")}${kpi("ok","em dia","ok")}${kpi("sem","sem data","sem")}
    </div>
    ${exFaixaInsp(base)}
    <div class="ad-filtros">
      ${unids.length?`<select id="ex-f-unidade" aria-label="Unidade"><option value="">Todas as unidades</option>${unids.map(u=>`<option ${u===exFiltro.unidade?"selected":""}>${esc(u)}</option>`).join("")}</select>`:""}
      <input type="search" id="ex-f-busca" placeholder="Buscar número, local, tipo…" value="${esc(exFiltro.busca)}">
    </div>
    <div id="ex-grade" class="ex-grade"></div>`;
  exRenderGrade();
}

function exRenderGrade(){
  const g=$("#ex-grade"); if(!g)return;
  if(!exCarregou){ g.innerHTML=`<div class="vazio"><p>Carregando…</p></div>`; return; }
  const lista=exFiltrados();
  if(!lista.length){
    g.innerHTML=`<div class="vazio"><p>${exRegs.length?"Nenhum extintor com esse filtro.":"Nenhum extintor cadastrado. Toque em <b>＋ Cadastrar extintor</b>: dá para cadastrar um atrás do outro, sem sair da tela."}</p></div>`;
    return;
  }
  g.innerHTML=lista.map(r=>{
    const s=exSituacao(r);
    return `<button type="button" class="ex-card ${s}" data-ex-abrir="${esc(r.id)}">
      <span class="ex-num">${esc(r.codigo)}</span>
      <span class="ex-info"><b>${esc([r.tipo,r.capacidade].filter(Boolean).join(" · ")||"Extintor")}</b>
        <small>${esc([r.unidade,r.local].filter(Boolean).join(" · ")||"local não informado")}</small></span>
      <span class="ex-datas"><span><i>Carga</i>${exSelo(r.recarga_validade)}</span><span><i>Teste</i>${exSelo(r.teste_validade)}</span></span>
      ${exSelosInsp(r)}
    </button>`;
  }).join("");
}

function exRenderForm(){
  const alvo=$("#ex-form"); if(!alvo||!exAtual)return;
  const r=exAtual;
  alvo.innerHTML=`
    <div class="secao-topo">
      <button class="bt bt-fantasma" type="button" data-ex-voltar>← Extintores</button>
      <h2>${r._novo?"Cadastrar extintor":"Extintor "+esc(r.codigo)}</h2>
      ${r._novo?"":`<span class="ex-selo ${exSituacao(r)}">${EX_ROT[exSituacao(r)]}</span>`}
    </div>
    <div class="cartao"><div class="grade">
      <div class="campo"><label for="ex-codigo">Número / identificação *</label><input type="text" id="ex-codigo" data-ex="codigo" value="${esc(r.codigo)}" placeholder="Ex.: 01 ou EXT-01" autocomplete="off"></div>
      <div class="campo"><label for="ex-unidade">Unidade / fazenda</label><input type="text" id="ex-unidade" data-ex="unidade" list="ex-unidades" value="${esc(r.unidade)}" placeholder="Fazenda Morro Branco"></div>
      <div class="campo"><label for="ex-local">Local</label><input type="text" id="ex-local" data-ex="local" value="${esc(r.local)}" placeholder="Galpão de máquinas, porta lateral"></div>
      <div class="campo"><label for="ex-tipo">Tipo</label><select id="ex-tipo" data-ex="tipo">${[...new Set([...EX_TIPOS,r.tipo].filter(Boolean))].map(t=>`<option ${t===r.tipo?"selected":""}>${esc(t)}</option>`).join("")}</select></div>
      <div class="campo"><label for="ex-cap">Capacidade</label><input type="text" id="ex-cap" data-ex="capacidade" list="ex-caps" value="${esc(r.capacidade)}" placeholder="Ex.: 6 kg"></div>
      <div class="campo"><label for="ex-classe">Classes que apaga</label><input type="text" id="ex-classe" data-ex="classe" value="${esc(r.classe||"")}" placeholder="A, B, C"></div>
      <div class="campo"><label for="ex-risco">Natureza do fogo no local</label><select id="ex-risco" data-ex="risco">${EX_RISCOS.map(([v,l])=>`<option value="${esc(v)}" ${v===(r.risco||"")?"selected":""}>${esc(l)}</option>`).join("")}${r.risco&&!EX_RISCOS.some(([v])=>v===r.risco)?`<option selected>${esc(r.risco)}</option>`:""}</select></div>
    </div>
    <div class="exi-natureza" id="ex-natureza">${exNaturezaTxt(r)}</div></div>
    <datalist id="ex-unidades">${exUnidades().map(u=>`<option value="${esc(u)}">`).join("")}</datalist>
    <datalist id="ex-caps">${["1 kg","2 kg","4 kg","6 kg","8 kg","10 L","12 kg","20 kg","50 kg"].map(c=>`<option value="${c}">`).join("")}</datalist>
    <div class="ex-prazos">
      <div class="ad-lado">
        <div class="ad-lado-topo"><span class="ad-rot depois">Carga</span><span class="dica">recarga a cada 1 ano</span></div>
        <div class="campo"><label for="ex-rec">Data da última recarga</label><input type="date" id="ex-rec" data-ex="recarga_data" value="${esc(r.recarga_data||"")}"></div>
        <div class="campo"><label for="ex-rec-v">Validade da carga</label><input type="date" id="ex-rec-v" data-ex="recarga_validade" value="${esc(r.recarga_validade||"")}"></div>
        <div class="ex-situ" id="ex-situ-rec">${exSelo(r.recarga_validade)}</div>
      </div>
      <div class="ad-lado">
        <div class="ad-lado-topo"><span class="ad-rot antes">Teste hidrostático</span><span class="dica">a cada 5 anos</span></div>
        <div class="campo"><label for="ex-tes">Data do último teste</label><input type="date" id="ex-tes" data-ex="teste_data" value="${esc(r.teste_data||"")}"></div>
        <div class="campo"><label for="ex-tes-v">Validade do teste</label><input type="date" id="ex-tes-v" data-ex="teste_validade" value="${esc(r.teste_validade||"")}"></div>
        <div class="ex-situ" id="ex-situ-tes">${exSelo(r.teste_validade)}</div>
      </div>
    </div>
    <p class="dica ex-dica-val">A validade é calculada a partir da data (carga +1 ano, teste +5 anos). Se a etiqueta trouxer outra data, digite a validade direto: ela passa a valer.</p>
    <div class="cartao"><div class="grade"><div class="campo largo"><label for="ex-obs">Observação</label><textarea id="ex-obs" data-ex="obs" placeholder="Ex.: suporte trocado em 09/2026">${esc(r.obs||"")}</textarea></div></div></div>
    <div class="ad-acoes" style="margin-top:16px">
      <button class="btn" type="button" id="ex-salvar">Salvar</button>
      ${r._novo?`<button class="btn secundario" type="button" data-ex-salvar-outro>Salvar e cadastrar outro</button>`:""}
      <button class="bt bt-fantasma bt-perigo" type="button" data-ex-remover style="margin-left:auto">${r._novo?"Cancelar":"Tirar do cadastro"}</button>
    </div>
    ${r._novo?"":exHistDoExtintor(r)}`;
}

function exAtualizarSituacao(){
  const a=$("#ex-situ-rec"), b=$("#ex-situ-tes");
  if(a)a.innerHTML=exSelo(exAtual.recarga_validade);
  if(b)b.innerHTML=exSelo(exAtual.teste_validade);
}

/* ─────────── lista impressa (A4 em pé, padrão SAKUMA) ─────────── */
function exImprimir(){
  const lista=exFiltrados();
  if(!lista.length){ toast("Nenhum extintor na lista para imprimir."); return; }
  const conta={venc:0,breve:0,ok:0,sem:0}; lista.forEach(r=>conta[exSituacao(r)]++);
  const sel=(iso)=>{ const s=exSitData(iso); return `<td class="exr-${s}">${exData(iso)||"—"}</td>`; };
  const filtro=[exFiltro.unidade||"Todas as unidades",exFiltro.sit!=="todos"?EX_ROT[exFiltro.sit]:""].filter(Boolean).join(" · ");
  const alvo=$("#ex-imprimir");
  alvo.innerHTML=`<div class="exr-doc">
    <header class="adr-cab"><div><h1>Controle de extintores</h1><p>${esc(filtro)} · emitido em ${exData(exHoje())}</p></div><img src="${LOGO}" alt="SAKUMA Agronegócios"></header>
    <div class="adr-kpis exr-kpis">
      <div><b>${lista.length}</b><span>extintores</span></div>
      <div class="exr-k-venc"><b>${conta.venc}</b><span>vencidos</span></div>
      <div class="ag"><b>${conta.breve}</b><span>vencem em ${EX_AVISO} dias</span></div>
      <div class="ok"><b>${conta.ok}</b><span>em dia</span></div>
    </div>
    <table class="adr-ind exr-tab"><thead><tr><th>Nº</th><th>Unidade · local</th><th>Tipo</th><th>Cap.</th><th>Última recarga</th><th>Validade carga</th><th>Último teste</th><th>Validade teste</th><th>Situação</th></tr></thead><tbody>
    ${lista.map(r=>{const s=exSituacao(r); return `<tr><td><b>${esc(r.codigo)}</b></td><td>${esc([r.unidade,r.local].filter(Boolean).join(" · "))||"—"}</td>
      <td>${esc(r.tipo||"—")}</td><td>${esc(r.capacidade||"—")}</td><td>${exData(r.recarga_data)||"—"}</td>${sel(r.recarga_validade)}
      <td>${exData(r.teste_data)||"—"}</td>${sel(r.teste_validade)}<td class="exr-${s}"><b>${EX_ROT[s]}</b></td></tr>`;}).join("")}
    </tbody></table>
    <footer class="adr-rod"><span>SAKUMA Agronegócios · Controle de extintores · NR-23 / NBR 12962</span>${typeof docLop==="function"?docLop():""}</footer>
  </div>`;
  const st=document.createElement("style"); st.id="ex-pagina";
  st.textContent="@media print{@page{size:A4 portrait;margin:0 10mm}}";
  document.head.appendChild(st);   /* por último: vence a orientação escolhida no relatório comum */
  document.body.classList.add("ex-imprimindo");
  const limpar=()=>{ document.body.classList.remove("ex-imprimindo"); st.remove(); alvo.innerHTML=""; window.removeEventListener("afterprint",limpar); };
  window.addEventListener("afterprint",limpar);
  setTimeout(()=>{ try{ window.print(); }catch(e){ toast("A impressão foi bloqueada aqui."); limpar(); } },150);
}

/* ══════════════════════════════════════════════════════════════════════════
   Inspeções dos extintores — semanal e trimestral (13/11/2026)
   A ronda pega os extintores de uma unidade e, para cada um, os itens com
   C / NC / NA. Só sobe o extintor em que alguém mexeu. O rascunho fica no
   aparelho até salvar (sem sinal, não se perde).
   ══════════════════════════════════════════════════════════════════════════ */
const EXI_PRAZO={semanal:7,trimestral:92};
const EXI_NOME={semanal:"Inspeção semanal",trimestral:"Inspeção trimestral"};
const EXI_ITENS=[
  {k:"pressao",rot:"Pressão",q:"O ponteiro do manômetro está na faixa verde?",d:"CO₂ não tem manômetro: Não se aplica (na trimestral ele é pesado)."},
  {k:"obstrucao",rot:"Obstrução",q:"O acesso está livre, sem nada na frente ou bloqueando o extintor?",d:"Caixas, sacarias, máquinas, veículos, porta trancada.",n:"NBR 12693 · 5.3.4"},
  {k:"altura",rot:"Altura",q:"A alça está no máximo a 1,60 m do piso e o fundo a pelo menos 0,10 m?",d:"Extintor em suporte de piso ou carreta: confira se está no lugar.",n:"NBR 12693 · 5.3.7"},
  {k:"sinalizacao",rot:"Sinalização",q:"A placa acima do extintor está visível e, onde exigido, há demarcação no piso?",d:"Galpão, oficina e garagem pedem também a pintura no piso.",n:"NBR 16820"},
  {k:"legivel",rot:"Informações legíveis",q:"O rótulo com as instruções, o selo do INMETRO e a etiqueta da recarga estão legíveis?",d:"Etiquetas no corpo do extintor."},
  {k:"natureza",rot:"Natureza",q:"O tipo do extintor serve para a natureza do fogo do local (classe A, B ou C)?",d:"A: madeira, papel, palha · B: diesel, óleo, gás · C: elétrico ligado."},
  {k:"lacre",rot:"Lacre e pino",q:"O pino de segurança está no lugar e o lacre está inteiro?",d:"Lacre rompido: o extintor pode ter sido usado."},
  {k:"corpo",rot:"Corpo",q:"O corpo está sem amassado, ferrugem, vazamento ou pintura danificada?",tri:1},
  {k:"mangueira",rot:"Mangueira e difusor",q:"A mangueira e o difusor estão sem rachadura, ressecamento ou entupimento?",d:"Extintor sem mangueira: Não se aplica.",tri:1},
  {k:"gatilho",rot:"Gatilho e válvula",q:"O gatilho e a válvula estão inteiros, sem quebra nem emenda?",tri:1},
  {k:"suporte",rot:"Suporte",q:"O suporte de parede, de piso ou a carreta está firme e em bom estado?",tri:1},
  {k:"peso",rot:"Peso (CO₂)",q:"O CO₂ foi pesado e a perda está abaixo de 10% da carga?",d:"Só para CO₂. Os outros: Não se aplica.",tri:1},
  {k:"validade",rot:"Carga e teste em dia",q:"A carga (1 ano) e o teste hidrostático (5 anos) estão na validade?",d:"Vem preenchido pelo cadastro; confira a etiqueta.",tri:1}
];
const exiItens=per=>EXI_ITENS.filter(i=>per==="trimestral"||!i.tri);
const EXI_RASCUNHO="sakuma-ex-ronda-";
let exiEst=null;

const exEhCO2=r=>/co\s*₂|co2/i.test(r.tipo||"");
function exNaturezaTxt(r){
  const ext=String(r.classe||EX_CLASSE[r.tipo]||"").toUpperCase().match(/[ABCDK]/g)||[];
  const loc=String(r.risco||"").toUpperCase().match(/[ABCDK]/g)||[];
  if(!loc.length)return `<span class="dica">Extintor apaga: <b>${esc(ext.join(", ")||"—")}</b>. Informe a natureza do fogo do local para a inspeção conferir a natureza.</span>`;
  const falta=loc.filter(c=>!ext.includes(c));
  return falta.length
    ? `<span class="exi-nat-nao">⚠ O local tem fogo classe <b>${esc(loc.join(", "))}</b> e este extintor não apaga <b>${esc(falta.join(", "))}</b>.</span>`
    : `<span class="exi-nat-ok">✓ Extintor (${esc(ext.join(", "))}) serve para o fogo do local (${esc(loc.join(", "))}).</span>`;
}

/* ─────────── situação das inspeções ─────────── */
function exUltInsp(id,per){ return exInsp.find(i=>i.extintor_id===id&&(!per||i.periodicidade===per))||null; }  /* exInsp vem do mais novo */
function exSitInsp(r,per){
  const u=exUltInsp(r.id,per); if(!u)return {s:"nunca",u:null};
  const n=-exDias(u.data);
  return {s:n>EXI_PRAZO[per]?"atrasada":"ok",u,n};
}
function exItensNc(i){ return Object.entries(i&&i.respostas||{}).filter(([,v])=>v&&v.r==="nc").map(([k])=>(EXI_ITENS.find(x=>x.k===k)||{rot:k}).rot); }
function exNcAberta(r){ const u=exUltInsp(r.id); return !!(u&&u.nc>0); }
function exSelosInsp(r){
  const sel=per=>{ const x=exSitInsp(r,per);
    const txt=x.s==="nunca"?"nunca feita":x.s==="atrasada"?`${exData(x.u.data)} · atrasada`:`${exData(x.u.data)}`;
    return `<span><i>${per==="semanal"?"Semanal":"Trimestral"}</i><span class="ex-selo ${x.s==="ok"?"ok":x.s==="atrasada"?"breve":"sem"}">${txt}</span></span>`; };
  const u=exUltInsp(r.id), nc=u&&u.nc>0?exItensNc(u):[];
  return `<span class="ex-datas exi-datas">${sel("semanal")}${sel("trimestral")}</span>
    ${nc.length?`<span class="exi-nc-tag">NC em ${exData(u.data)}: ${esc(nc.join(", "))}</span>`:""}`;
}
function exFaixaInsp(base){
  if(!base.length)return "";
  const bloco=per=>{
    let ok=0,atr=0,nunca=0; base.forEach(r=>{ const s=exSitInsp(r,per).s; if(s==="ok")ok++; else if(s==="atrasada")atr++; else nunca++; });
    const ult=exInsp.filter(i=>i.periodicidade===per&&base.some(r=>r.id===i.extintor_id))[0];
    return `<div class="exi-bloco ${atr+nunca?"pend":"ok"}">
      <div><b>${EXI_NOME[per]}</b><small>a cada ${per==="semanal"?"7 dias":"3 meses"}</small></div>
      <span class="exi-bloco-num"><b>${ok}</b> de ${base.length} em dia${atr?` · <em>${atr} atrasada${atr>1?"s":""}</em>`:""}${nunca?` · ${nunca} nunca feita${nunca>1?"s":""}`:""}</span>
      <span class="dica">${ult?`última: ${exData(ult.data)}${ult.responsavel?" · "+esc(ult.responsavel):""}`:"nenhuma ainda"}</span>
      <button class="btn" type="button" data-exi-abrir="${per}">Fazer ${per==="semanal"?"a semanal":"a trimestral"}</button>
    </div>`;
  };
  const nNc=base.filter(exNcAberta).length;
  return `<div class="exi-faixa">${bloco("semanal")}${bloco("trimestral")}
    <div class="exi-bloco exi-bloco-hist"><div><b>Histórico</b><small>todas as inspeções</small></div>
      <span class="exi-bloco-num">${nNc?`<em>${nNc} com NC na última inspeção</em>`:"nenhuma NC em aberto"}</span>
      <button class="bt" type="button" data-exh-abrir>Ver histórico</button></div></div>`;
}

/* ─────────── ronda ─────────── */
function exiResp(){ try{ return localStorage.getItem("sakuma-ex-resp")||""; }catch(e){ return ""; } }
function exiAbrir(per,o){
  o=o||{};
  let rasc=null; try{ rasc=JSON.parse(localStorage.getItem(EXI_RASCUNHO+per)||"null"); }catch(e){}
  if(rasc&&!o.soId&&Object.values(rasc.ex||{}).some(x=>x.toque)) exiEst=rasc;
  else exiEst={per,unidade:o.unidade!=null?o.unidade:(exFiltro.unidade||""),data:exHoje(),resp:exiResp(),soId:o.soId||"",ex:{}};
  exAtual=null; exMostrar("insp");
}
function exiGuardar(){ if(!exiEst)return; try{ localStorage.setItem(EXI_RASCUNHO+exiEst.per,JSON.stringify(exiEst)); }catch(e){} }
function exiLista(){
  const e=exiEst;
  return exRegs.filter(r=>e.soId?r.id===e.soId:(!e.unidade||(r.unidade||"").trim()===e.unidade))
    .sort((a,b)=>String(a.unidade||"").localeCompare(String(b.unidade||""),"pt-BR")||String(a.codigo).localeCompare(String(b.codigo),"pt-BR",{numeric:true}));
}
/* respostas que já vêm do cadastro (não contam como "mexeu") */
function exiPreset(r,per){
  const p={};
  if(exEhCO2(r))p.pressao="na";
  if(per==="trimestral"){
    if(!exEhCO2(r))p.peso="na";
    const s=exSituacao(r); if(s==="venc")p.validade="nc"; else if(s==="ok"||s==="breve")p.validade="c";
  }
  return p;
}
function exiDoExt(r){
  const e=exiEst; if(!e.ex[r.id])e.ex[r.id]={toque:false,r:exiPreset(r,e.per),obs:{},aberto:false};
  return e.ex[r.id];
}
function exiFaltam(r){ const x=exiDoExt(r); return exiItens(exiEst.per).filter(i=>!x.r[i.k]).length; }
function exiRender(){
  const alvo=$("#ex-insp"); if(!alvo)return;
  if(!exiEst){ exiEst={per:"semanal",unidade:"",data:exHoje(),resp:exiResp(),soId:"",ex:{}}; }
  const e=exiEst, itens=exiItens(e.per), lista=exiLista(), unids=exUnidades();
  const feitos=lista.filter(r=>exiDoExt(r).toque), nc=feitos.filter(r=>Object.values(exiDoExt(r).r).includes("nc"));
  alvo.innerHTML=`
    <div class="secao-topo">
      <button class="bt bt-fantasma" type="button" data-ex-voltar>← Extintores</button>
      <h2>${EXI_NOME[e.per]} dos extintores</h2>
      <div class="exi-per" role="group" aria-label="Periodicidade">
        <button type="button" data-exi-per="semanal" aria-pressed="${e.per==="semanal"}">Semanal</button>
        <button type="button" data-exi-per="trimestral" aria-pressed="${e.per==="trimestral"}">Trimestral</button>
      </div>
      <div class="ex-topo-bts"><button class="bt" type="button" data-exi-imprimir>Imprimir ficha</button></div>
    </div>
    <p class="dica exi-intro">${e.per==="semanal"
      ?"Toda semana, em cada extintor: pressão, obstrução, altura, sinalização, informações legíveis, natureza do fogo e lacre."
      :"A cada 3 meses: os itens da semanal mais corpo, mangueira, gatilho, suporte, peso do CO₂ e validade da carga e do teste."}
      A ficha impressa sai com o que já foi marcado; sem nada marcado, serve de ficha em branco para o campo.</p>
    ${exOffline?`<p class="ad-aviso">Sem conexão com a base: o que você marcar fica guardado neste aparelho. Para salvar, precisa de sinal.</p>`:""}
    <div class="cartao"><div class="grade">
      <div class="campo"><label for="exi-unid">Unidade / fazenda</label><select id="exi-unid" data-exi-cab="unidade" ${e.soId?"disabled":""}>
        <option value="">Todas as unidades</option>${unids.map(u=>`<option ${u===e.unidade?"selected":""}>${esc(u)}</option>`).join("")}</select></div>
      <div class="campo"><label for="exi-data">Data da inspeção</label><input type="date" id="exi-data" data-exi-cab="data" value="${esc(e.data)}"></div>
      <div class="campo"><label for="exi-resp">Responsável pela inspeção</label><input type="text" id="exi-resp" data-exi-cab="resp" value="${esc(e.resp)}" placeholder="Nome de quem inspecionou"></div>
    </div></div>
    ${e.soId?`<p class="dica">Só o extintor ${esc((lista[0]||{}).codigo||"")}. <button class="bt bt-fantasma" type="button" data-exi-todos>Mostrar todos da unidade</button></p>`:""}
    <div class="exi-resumo" id="exi-resumo"><b>${feitos.length}</b> de ${lista.length} inspecionados${nc.length?` · <em>${nc.length} com NC</em>`:""}
      <span class="exi-leg"><i class="c">C</i> conforme <i class="nc">NC</i> não conforme <i class="na">NA</i> não se aplica</span></div>
    <div class="exi-lista">${lista.length?lista.map(r=>exiCard(r,itens)).join(""):`<div class="vazio"><p>${exRegs.length?"Nenhum extintor nesta unidade.":"Nenhum extintor cadastrado ainda. Cadastre em Extintores e volte aqui."}</p></div>`}</div>
    <div class="ad-acoes exi-acoes">
      <button class="btn" type="button" data-exi-salvar ${feitos.length?"":"disabled"}>Salvar inspeção${feitos.length?` (${feitos.length})`:""}</button>
      <button class="bt bt-fantasma" type="button" data-exi-descartar style="margin-left:auto">Descartar o que marquei</button>
    </div>`;
}
function exiCard(r,itens){
  const x=exiDoExt(r), falta=itens.filter(i=>!x.r[i.k]).length, temNc=itens.some(i=>x.r[i.k]==="nc");
  const sit=exSitInsp(r,exiEst.per);
  const estado=!x.toque?"":falta?"meio":temNc?"nc":"ok";
  const aberto=x.aberto||(x.toque&&(falta||temNc));
  const rotEst=!x.toque?"":falta?`faltam ${falta}`:temNc?"com NC":"✓ conforme";
  return `<div class="exi-ext ${estado}" data-exi-id="${esc(r.id)}">
    <div class="exi-ext-topo">
      <button type="button" class="exi-ext-abre" data-exi-abre aria-expanded="${!!aberto}">
        <span class="ex-num">${esc(r.codigo)}</span>
        <span class="ex-info"><b>${esc([r.tipo,r.capacidade].filter(Boolean).join(" · ")||"Extintor")}</b>
          <small>${esc([r.unidade,r.local].filter(Boolean).join(" · ")||"local não informado")}</small>
          <small>${sit.u?`última ${exiEst.per}: ${exData(sit.u.data)} (há ${sit.n} d)`:`${exiEst.per} nunca feita`}</small></span>
      </button>
      ${rotEst?`<span class="exi-est ${estado}">${rotEst}</span>`:""}
      <button class="bt exi-tudo" type="button" data-exi-tudo>✓ Tudo conforme</button>
    </div>
    ${aberto?`<div class="exi-itens">${itens.map(i=>exiLinha(r,i,x)).join("")}</div>`:""}
  </div>`;
}
function exiLinha(r,i,x){
  const v=x.r[i.k]||"";
  const dica=i.k==="natureza"?exNaturezaTxt(r):i.k==="validade"?`Carga ${exSelo(r.recarga_validade)} · Teste ${exSelo(r.teste_validade)}`:esc(i.d||"");
  const bt=(c,t)=>`<button type="button" class="${c}" data-exi-r="${c}" data-exi-k="${i.k}" aria-pressed="${v===c}">${t}</button>`;
  return `<div class="exi-item ${v}">
    <div class="exi-q"><b>${esc(i.rot)}</b> <span>${esc(i.q)}</span>${dica?`<small>${dica}</small>`:""}${i.n?`<small class="exi-norma">${esc(i.n)}</small>`:""}</div>
    <div class="exi-resp">${bt("c","C")}${bt("nc","NC")}${bt("na","NA")}</div>
    ${v==="nc"?`<input type="text" class="exi-obs" data-exi-obs="${i.k}" value="${esc(x.obs[i.k]||"")}" placeholder="O que está errado e o que foi feito?">`:""}
  </div>`;
}
function exiRepintar(id){
  const r=exRegs.find(z=>z.id===id), el=document.querySelector(`.exi-ext[data-exi-id="${CSS.escape(id)}"]`);
  if(r&&el){ el.outerHTML=exiCard(r,exiItens(exiEst.per)); }
  const lista=exiLista(), feitos=lista.filter(z=>exiDoExt(z).toque), nc=feitos.filter(z=>Object.values(exiDoExt(z).r).includes("nc"));
  const res=$("#exi-resumo"); if(res)res.innerHTML=`<b>${feitos.length}</b> de ${lista.length} inspecionados${nc.length?` · <em>${nc.length} com NC</em>`:""}<span class="exi-leg"><i class="c">C</i> conforme <i class="nc">NC</i> não conforme <i class="na">NA</i> não se aplica</span>`;
  const bs=document.querySelector("[data-exi-salvar]"); if(bs){ bs.disabled=!feitos.length; bs.textContent="Salvar inspeção"+(feitos.length?` (${feitos.length})`:""); }
}
let exiSalvando=false;
async function exiSalvar(){
  if(exiSalvando||!exiEst)return;
  const e=exiEst, itens=exiItens(e.per), lista=exiLista().filter(r=>exiDoExt(r).toque);
  if(!lista.length){ toast("Marque pelo menos um extintor."); return; }
  if(!e.data){ toast("Preencha a data da inspeção."); return; }
  if(!String(e.resp||"").trim()){ toast("Preencha o responsável pela inspeção."); const c=$("#exi-resp"); if(c)c.focus(); return; }
  const meio=lista.find(r=>exiFaltam(r));
  if(meio){ exiDoExt(meio).aberto=true; exiRepintar(meio.id); toast(`Extintor ${meio.codigo}: faltam ${exiFaltam(meio)} itens. Marque C, NC ou NA.`);
    const el=document.querySelector(`.exi-ext[data-exi-id="${CSS.escape(meio.id)}"]`); if(el)el.scrollIntoView({behavior:"smooth",block:"center"}); return; }
  if(!conectado()){ exiGuardar(); toast("Sem rede: a inspeção ficou guardada neste aparelho. Salve quando tiver sinal."); return; }
  exiSalvando=true; const bt=document.querySelector("[data-exi-salvar]"); if(bt)bt.disabled=true;
  try{
    const autor=(typeof sessao!=="undefined"&&sessao&&sessao.email)||null;
    const linhas=lista.map(r=>{ const x=exiDoExt(r), resp={};
      itens.forEach(i=>{ resp[i.k]={r:x.r[i.k]}; if(x.r[i.k]==="nc"&&x.obs[i.k])resp[i.k].obs=x.obs[i.k]; });
      return {id:uuid(),extintor_id:r.id,codigo:r.codigo,unidade:r.unidade||null,local:r.local||null,periodicidade:e.per,data:e.data,
        responsavel:String(e.resp).trim(),autor,respostas:resp,nc:itens.filter(i=>x.r[i.k]==="nc").length};
    });
    const d=await rest("extintores_inspecoes",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(linhas)});
    if(!d||d.length!==linhas.length)throw new Error("A base não confirmou a gravação.");
    exInsp=[...d,...exInsp].sort((a,b)=>String(b.data).localeCompare(String(a.data))||String(b.criado_em||"").localeCompare(String(a.criado_em||"")));
    try{ localStorage.setItem(EX_INSP_CACHE,JSON.stringify(exInsp)); localStorage.setItem("sakuma-ex-resp",String(e.resp).trim()); localStorage.removeItem(EXI_RASCUNHO+e.per); }catch(x){}
    const nNc=d.filter(i=>i.nc>0).length;
    toast(`${EXI_NOME[e.per]} salva: ${d.length} extintor${d.length>1?"es":""}${nNc?`, ${nNc} com NC`:", tudo conforme"}.`);
    exiEst=null; exContador(); exMostrar("lista");
  }catch(err){
    exiGuardar();
    const m=String(err.message||err);
    toast(/Failed to fetch|NetworkError|Load failed/i.test(m)?"Sem rede: a inspeção ficou guardada neste aparelho. Tente de novo com sinal.":"Não deu para salvar: "+m.slice(0,110));
  }finally{ exiSalvando=false; const b=document.querySelector("[data-exi-salvar]"); if(b)b.disabled=false; }
}

/* ─────────── histórico ─────────── */
let exhFiltro={per:"",unidade:""};
function exhRondas(){
  const g=new Map();
  exInsp.forEach(i=>{
    if(exhFiltro.per&&i.periodicidade!==exhFiltro.per)return;
    if(exhFiltro.unidade&&(i.unidade||"").trim()!==exhFiltro.unidade)return;
    const k=[i.data,i.periodicidade,(i.unidade||"").trim(),i.responsavel||""].join("|");
    if(!g.has(k))g.set(k,{k,data:i.data,per:i.periodicidade,unidade:(i.unidade||"").trim(),resp:i.responsavel||"",itens:[]});
    g.get(k).itens.push(i);
  });
  return [...g.values()].sort((a,b)=>String(b.data).localeCompare(String(a.data)));
}
function exhRender(){
  const alvo=$("#ex-hist"); if(!alvo)return;
  const rondas=exhRondas(), unids=[...new Set(exInsp.map(i=>(i.unidade||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  alvo.innerHTML=`
    <div class="secao-topo">
      <button class="bt bt-fantasma" type="button" data-ex-voltar>← Extintores</button>
      <h2>Histórico das inspeções</h2>
      <span class="dica">Cada linha é uma ronda: mesma data, periodicidade, unidade e responsável.</span>
    </div>
    <div class="ad-filtros">
      <select data-exh-f="per" aria-label="Periodicidade"><option value="">Semanal e trimestral</option>
        <option value="semanal" ${exhFiltro.per==="semanal"?"selected":""}>Só semanal</option><option value="trimestral" ${exhFiltro.per==="trimestral"?"selected":""}>Só trimestral</option></select>
      ${unids.length?`<select data-exh-f="unidade" aria-label="Unidade"><option value="">Todas as unidades</option>${unids.map(u=>`<option ${u===exhFiltro.unidade?"selected":""}>${esc(u)}</option>`).join("")}</select>`:""}
    </div>
    ${rondas.length?`<div class="exh-tab-caixa"><table class="exh-tab"><thead><tr><th>Data</th><th>Inspeção</th><th>Unidade</th><th>Responsável</th><th>Extintores</th><th>Não conformidades</th><th></th></tr></thead><tbody>
      ${rondas.map(g=>{ const nc=g.itens.filter(i=>i.nc>0);
        return `<tr><td>${exData(g.data)}</td><td>${g.per==="semanal"?"Semanal":"Trimestral"}</td><td>${esc(g.unidade||"—")}</td><td>${esc(g.resp||"—")}</td>
        <td class="num">${g.itens.length}</td>
        <td>${nc.length?nc.map(i=>`<span class="exi-nc-tag">${esc(i.codigo)}: ${esc(exItensNc(i).join(", "))}</span>`).join(" "):`<span class="exi-nat-ok">tudo conforme</span>`}</td>
        <td><button class="bt" type="button" data-exh-imprimir="${esc(g.k)}">Imprimir</button></td></tr>`; }).join("")}
      </tbody></table></div>`:`<div class="vazio"><p>${exInsp.length?"Nenhuma inspeção com esse filtro.":"Nenhuma inspeção salva ainda."}</p></div>`}`;
}
function exHistDoExtintor(r){
  const l=exInsp.filter(i=>i.extintor_id===r.id).slice(0,12);
  return `<div class="cartao exi-hist-ext"><div class="exi-hist-topo"><h3>Inspeções deste extintor</h3>
      <button class="bt" type="button" data-exi-so="semanal">Semanal deste</button><button class="bt" type="button" data-exi-so="trimestral">Trimestral deste</button></div>
    ${l.length?`<table class="exh-tab"><thead><tr><th>Data</th><th>Inspeção</th><th>Responsável</th><th>Resultado</th></tr></thead><tbody>
      ${l.map(i=>{ const nc=exItensNc(i); return `<tr><td>${exData(i.data)}</td><td>${i.periodicidade==="semanal"?"Semanal":"Trimestral"}</td><td>${esc(i.responsavel||"—")}</td>
        <td>${nc.length?`<span class="exi-nc-tag">NC: ${esc(nc.join(", "))}</span>`:`<span class="exi-nat-ok">conforme</span>`}</td></tr>`; }).join("")}</tbody></table>`
      :`<p class="dica">Nenhuma inspeção ainda.</p>`}</div>`;
}

/* ─────────── ficha impressa (A4 deitada) ─────────── */
function exiImprimirFicha(per,cab,linhas){
  const itens=exiItens(per);
  const marca=v=>v==="c"?`<td class="exf-c">C</td>`:v==="nc"?`<td class="exf-nc">NC</td>`:v==="na"?`<td class="exf-na">NA</td>`:`<td class="exf-vazio"></td>`;
  const alvo=$("#ex-imprimir");
  alvo.innerHTML=`<div class="exr-doc exf-doc">
    <header class="adr-cab"><div><h1>${EXI_NOME[per]} de extintores</h1>
      <p>Unidade: <b>${esc(cab.unidade||"todas")}</b> · Data: <b>${cab.data?exData(cab.data):"____/____/______"}</b> · Responsável: <b>${esc(cab.resp||"")||"_______________________________"}</b></p></div>
      <img src="${LOGO}" alt="SAKUMA Agronegócios"></header>
    <table class="adr-ind exf-tab"><thead><tr><th>Nº</th><th>Local</th><th>Tipo · cap.</th>${itens.map(i=>`<th class="exf-it">${esc(i.rot)}</th>`).join("")}<th>Observação</th></tr></thead><tbody>
      ${linhas.map(({r,resp,obs})=>`<tr><td><b>${esc(r.codigo)}</b></td><td>${esc([r.unidade&&!cab.unidade?r.unidade:"",r.local].filter(Boolean).join(" · ")||"—")}</td>
        <td>${esc([r.tipo,r.capacidade].filter(Boolean).join(" · ")||"—")}</td>${itens.map(i=>marca(resp&&resp[i.k])).join("")}
        <td class="exf-obs">${esc(Object.entries(obs||{}).filter(([,v])=>v).map(([k,v])=>((EXI_ITENS.find(x=>x.k===k)||{}).rot||k)+": "+v).join(" · "))}</td></tr>`).join("")}
    </tbody></table>
    <p class="exf-leg"><b>C</b> conforme · <b>NC</b> não conforme (descreva na observação) · <b>NA</b> não se aplica — ${itens.map(i=>`<b>${esc(i.rot)}</b>: ${esc(i.q)}`).join(" ")}</p>
    <div class="exf-assin"><span>Assinatura do responsável</span></div>
    <footer class="adr-rod"><span>SAKUMA Agronegócios · ${EXI_NOME[per]} de extintores · NR-23 / NBR 12962</span>${typeof docLop==="function"?docLop():""}</footer>
  </div>`;
  const st=document.createElement("style"); st.id="ex-pagina";
  st.textContent="@media print{@page{size:A4 landscape;margin:0 8mm}}";
  document.head.appendChild(st);
  document.body.classList.add("ex-imprimindo");
  const limpar=()=>{ document.body.classList.remove("ex-imprimindo"); st.remove(); alvo.innerHTML=""; window.removeEventListener("afterprint",limpar); };
  window.addEventListener("afterprint",limpar);
  setTimeout(()=>{ try{ window.print(); }catch(e){ toast("A impressão foi bloqueada aqui."); limpar(); } },150);
}
function exiImprimirAtual(){
  const e=exiEst, lista=exiLista();
  if(!lista.length){ toast("Nenhum extintor para a ficha."); return; }
  exiImprimirFicha(e.per,{unidade:e.unidade,data:Object.values(e.ex).some(x=>x.toque)?e.data:"",resp:e.resp},
    lista.map(r=>{ const x=exiDoExt(r); return {r,resp:x.toque?x.r:null,obs:x.toque?x.obs:null}; }));
}
function exhImprimir(k){
  const g=exhRondas().find(z=>z.k===k); if(!g)return;
  exiImprimirFicha(g.per,{unidade:g.unidade,data:g.data,resp:g.resp},
    g.itens.slice().sort((a,b)=>String(a.codigo).localeCompare(String(b.codigo),"pt-BR",{numeric:true})).map(i=>{
      const r=exRegs.find(z=>z.id===i.extintor_id)||{codigo:i.codigo,unidade:i.unidade,local:i.local};
      const resp={},obs={}; Object.entries(i.respostas||{}).forEach(([kk,v])=>{ resp[kk]=v.r; if(v.obs)obs[kk]=v.obs; });
      return {r,resp,obs};
    }));
}

/* ─────────── eventos das inspeções ─────────── */
$("#painel-ex").addEventListener("click",ev=>{
  const q=s=>ev.target.closest(s); let el;
  if(el=q("[data-exi-abrir]")){ exiAbrir(el.dataset.exiAbrir); return; }
  if(el=q("[data-exi-so]")){ const r=exAtual; if(r)exiAbrir(el.dataset.exiSo,{soId:r.id,unidade:r.unidade||""}); return; }
  if(q("[data-exh-abrir]")){ exMostrar("hist"); return; }
  if(el=q("[data-exh-imprimir]")){ exhImprimir(el.dataset.exhImprimir); return; }
  if(!exiEst||exVista!=="insp")return;
  if(el=q("[data-exi-per]")){ exiGuardar(); const per=el.dataset.exiPer; if(per!==exiEst.per){ const cab={unidade:exiEst.unidade,soId:exiEst.soId}; exiEst=null; exiAbrir(per,cab); } return; }
  if(q("[data-exi-todos]")){ exiEst.soId=""; exiRender(); return; }
  if(q("[data-exi-imprimir]")){ exiImprimirAtual(); return; }
  if(q("[data-exi-salvar]")){ exiSalvar(); return; }
  if(q("[data-exi-descartar]")){ if(!confirm("Apagar o que foi marcado nesta inspeção?"))return;
    try{ localStorage.removeItem(EXI_RASCUNHO+exiEst.per); }catch(e){} const p=exiEst.per,u=exiEst.unidade; exiEst=null; exiAbrir(p,{unidade:u}); return; }
  const card=q("[data-exi-id]"); if(!card)return;
  const r=exRegs.find(z=>z.id===card.dataset.exiId); if(!r)return;
  const x=exiDoExt(r);
  if(q("[data-exi-abre]")){ x.aberto=!q("[data-exi-abre]").matches('[aria-expanded="true"]'); exiRepintar(r.id); return; }
  if(q("[data-exi-tudo]")){ exiItens(exiEst.per).forEach(i=>{ if(!x.r[i.k])x.r[i.k]="c"; }); x.toque=true; x.aberto=false; exiGuardar(); exiRepintar(r.id); return; }
  if(el=q("[data-exi-r]")){ const k=el.dataset.exiK, v=el.dataset.exiR; x.r[k]=x.r[k]===v?"":v; if(!x.r[k])delete x.r[k]; x.toque=true; x.aberto=true;
    exiGuardar(); exiRepintar(r.id); if(v==="nc"&&x.r[k]==="nc"){ const o=document.querySelector(`.exi-ext[data-exi-id="${CSS.escape(r.id)}"] [data-exi-obs="${k}"]`); if(o)o.focus(); } return; }
});
$("#painel-ex").addEventListener("input",ev=>{
  const t=ev.target; if(!exiEst||exVista!=="insp")return;
  if(t.dataset.exiCab&&t.dataset.exiCab!=="unidade"){ exiEst[t.dataset.exiCab]=t.value; exiGuardar(); return; }
  if(t.dataset.exiObs){ const card=t.closest("[data-exi-id]"); const r=card&&exRegs.find(z=>z.id===card.dataset.exiId); if(r){ exiDoExt(r).obs[t.dataset.exiObs]=t.value; exiGuardar(); } }
});
$("#painel-ex").addEventListener("change",ev=>{
  const t=ev.target;
  if(t.dataset.exhF){ exhFiltro[t.dataset.exhF]=t.value; exhRender(); return; }
  if(exiEst&&exVista==="insp"&&t.dataset.exiCab==="unidade"){ exiEst.unidade=t.value; exiGuardar(); exiRender(); }
});
window.exIr=function(v){ if(v==="semanal"||v==="trimestral")exiAbrir(v); else exMostrar(v==="hist"?"hist":"lista"); };

/* ─────────── eventos ─────────── */
$("#painel-ex").addEventListener("click",ev=>{
  const q=s=>ev.target.closest(s); let el;
  if(q("[data-ex-novo]")){ exAtual=exNovo(); exMostrar("form"); setTimeout(()=>{const c=$("#ex-codigo");if(c)c.focus();},50); return; }
  if(el=q("[data-ex-sit]")){ exFiltro.sit=exFiltro.sit===el.dataset.exSit&&el.dataset.exSit!=="todos"?"todos":el.dataset.exSit; exRenderLista(); return; }
  if(el=q("[data-ex-abrir]")){ const r=exRegs.find(x=>x.id===el.dataset.exAbrir); if(r){ exAtual=JSON.parse(JSON.stringify(r)); exMostrar("form"); } return; }
  if(q("[data-ex-voltar]")){ if(exVista==="insp")exiGuardar(); exAtual=null; exMostrar("lista"); return; }
  if(q("#ex-salvar")){ exSalvar(false); return; }
  if(q("[data-ex-salvar-outro]")){ exSalvar(true); return; }
  if(q("[data-ex-remover]")){ exRemover(); return; }
  if(q("[data-ex-imprimir]")){ exImprimir(); return; }
});
$("#painel-ex").addEventListener("input",ev=>{
  const t=ev.target;
  if(t.id==="ex-f-busca"){ exFiltro.busca=t.value; exRenderGrade(); return; }
  if(!(t.dataset&&t.dataset.ex&&exAtual))return;
  exAtual[t.dataset.ex]=t.value;
});
$("#painel-ex").addEventListener("change",ev=>{
  const t=ev.target;
  if(t.id==="ex-f-unidade"){ exFiltro.unidade=t.value; exRenderLista(); return; }
  if(!(t.dataset&&t.dataset.ex&&exAtual))return;
  const k=t.dataset.ex; exAtual[k]=t.value;
  if(k==="tipo"&&EX_CLASSE[t.value]){ exAtual.classe=EX_CLASSE[t.value]; const c=$("#ex-classe"); if(c)c.value=exAtual.classe; }
  if(["tipo","classe","risco"].includes(k)){ const n=$("#ex-natureza"); if(n)n.innerHTML=exNaturezaTxt(exAtual); }
  /* data nova: recalcula a validade, a não ser que a validade tenha sido digitada à mão nesta tela */
  if(k==="recarga_data"&&!exAtual._recDigitada){ exAtual.recarga_validade=exSomaAnos(t.value,1); const v=$("#ex-rec-v"); if(v)v.value=exAtual.recarga_validade; }
  if(k==="teste_data"&&!exAtual._testeDigitada){ exAtual.teste_validade=exSomaAnos(t.value,5); const v=$("#ex-tes-v"); if(v)v.value=exAtual.teste_validade; }
  if(k==="recarga_validade")exAtual._recDigitada=!!t.value;
  if(k==="teste_validade")exAtual._testeDigitada=!!t.value;
  exAtualizarSituacao();
});

/* ─────────── ligações com o resto do app ─────────── */
if(typeof PAINEIS!=="undefined"&&!PAINEIS.includes("ex"))PAINEIS.push("ex");
const _abaEX=aba;
aba=function(qual){ _abaEX(qual); if(qual==="ex"&&!$("#ex-lista").hidden)exRenderLista(); };
$("#t-ex").onclick=()=>exMostrar(exVista==="form"&&exAtual?"form":exVista==="insp"&&exiEst?"insp":exVista==="hist"?"hist":"lista");
const _abrirAppEX=abrirApp;
abrirApp=async function(){ const r=await _abrirAppEX.apply(this,arguments); exCarregar().then(()=>{ if(!$("#painel-ex").hidden&&!$("#ex-lista").hidden)exRenderLista(); }); return r; };
{ const qa=new URLSearchParams(location.search); if(qa.get("aba")==="ex"){ const v=qa.get("ex"); if(v)window.exIr(v); else exMostrar("lista"); } }
if(conectado())exCarregar();
