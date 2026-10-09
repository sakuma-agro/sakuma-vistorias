/* ══════════════════════════════════════════════════════════════════════════
   Extintores — cadastro fixo e painel de vencimentos (etapa 1)
   Cada extintor é cadastrado uma vez, com a data da última recarga e do último
   teste hidrostático. O app calcula a validade (carga 1 ano, teste 5 anos) e
   aceita a data digitada quando a empresa de recarga usa outro prazo.
   A ronda de inspeção mensal vem na etapa 2.

   <script> próprio: um erro aqui não derruba o resto do app. Nomes com "ex".
   ══════════════════════════════════════════════════════════════════════════ */

const EX_CACHE="sakuma-ex-lista", EX_AVISO=30;
const EX_TIPOS=["Pó ABC","Pó BC","Água pressurizada","CO₂","Espuma mecânica"];
let exRegs=[], exCarregou=false, exOffline=false, exAtual=null, exSalvando=false;
let exFiltro={sit:"todos",unidade:"",busca:""};

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
    exCarregou=true; exContador(); return;
  }
  try{
    exRegs=(await rest("extintores?select=*&ativo=eq.true&order=codigo.asc"))||[];
    exOffline=false; exCarregou=true; exGuardarCache();
  }catch(e){
    exOffline=true; exCarregou=true;
    try{ exRegs=JSON.parse(localStorage.getItem(EX_CACHE)||"[]"); }catch(x){ exRegs=[]; }
  }
  exContador();
}
function exContador(){
  const n=exRegs.filter(r=>["venc","breve"].includes(exSituacao(r))).length;
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
      exAtual=exNovo({unidade:r.unidade,tipo:r.tipo,capacidade:r.capacidade,recarga_data:r.recarga_data,recarga_validade:r.recarga_validade,
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
  return Object.assign({id:uuid(),_novo:true,codigo:"",unidade:"",local:"",tipo:"Pó ABC",capacidade:"",
    recarga_data:"",recarga_validade:"",teste_data:"",teste_validade:"",obs:""},base||{});
}

/* ─────────── telas ─────────── */
function exMostrar(qual){
  $("#ex-lista").hidden=qual!=="lista"; $("#ex-form").hidden=qual!=="form";
  aba("ex");
  if(qual==="lista"){ exRenderLista(); exCarregar().then(()=>{ if(!$("#ex-lista").hidden)exRenderLista(); }); }
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
    </div></div>
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
    </div>`;
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

/* ─────────── eventos ─────────── */
$("#painel-ex").addEventListener("click",ev=>{
  const q=s=>ev.target.closest(s); let el;
  if(q("[data-ex-novo]")){ exAtual=exNovo(); exMostrar("form"); setTimeout(()=>{const c=$("#ex-codigo");if(c)c.focus();},50); return; }
  if(el=q("[data-ex-sit]")){ exFiltro.sit=exFiltro.sit===el.dataset.exSit&&el.dataset.exSit!=="todos"?"todos":el.dataset.exSit; exRenderLista(); return; }
  if(el=q("[data-ex-abrir]")){ const r=exRegs.find(x=>x.id===el.dataset.exAbrir); if(r){ exAtual=JSON.parse(JSON.stringify(r)); exMostrar("form"); } return; }
  if(q("[data-ex-voltar]")){ exAtual=null; exMostrar("lista"); return; }
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
$("#t-ex").onclick=()=>exMostrar(!$("#ex-form").hidden&&exAtual?"form":"lista");
const _abrirAppEX=abrirApp;
abrirApp=async function(){ const r=await _abrirAppEX.apply(this,arguments); exCarregar().then(()=>{ if(!$("#painel-ex").hidden&&!$("#ex-lista").hidden)exRenderLista(); }); return r; };
if(new URLSearchParams(location.search).get("aba")==="ex")exMostrar("lista");
if(conectado())exCarregar();
