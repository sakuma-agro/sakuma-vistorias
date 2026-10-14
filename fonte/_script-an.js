/* ══════════════════════════════════════════════════════════════════════════
   Anomalias
   Vistoria livre e simples, para quem não é técnico: anda pela fazenda e,
   para cada coisa errada, tira a foto, escreve o problema, o plano de ação e
   quem vai arrumar. Três partes:
     Apontamento — o relatório em preenchimento (novo ou reaberto para editar)
     Painel      — abertas, vencidas e concluídas, só deste módulo; concluir
                   com a foto do corrigido
     Histórico   — todos os relatórios: imprimir de novo, editar, apagar
   Editar um relatório salvo atualiza o mesmo relatório (decisão do Guilherme).
   Assinatura: só a de quem fez os apontamentos.

   Roda num <script> próprio: um erro aqui não derruba o login nem o resto do
   app. Todos os nomes começam com "an" (o _script-extra.js já usa anNorma).
   ══════════════════════════════════════════════════════════════════════════ */

const AN_RASC="sakuma-an-rascunho", AN_CACHE="sakuma-an-lista", AN_NOME="sakuma-an-nome";
const AN_FAZENDAS=["Sede","Lote 35 PADAP","Fazenda Faca","Fazenda Morro Branco","Fazenda Três Riachos","Fazenda Quebra Cocão"];
let anRels=[], anCarregou=false, anOffline=false, anAtual=null, anSalvando=false;
let anVista="apontamento", anVoltar="apontamento";
let anFiltro={sit:"abertas",local:"",resp:"",busca:""}, anHist={local:"",busca:""};
let anConcluindo=null;              /* {relId, uid, _src} enquanto o diálogo de concluir está aberto */
const anDados=new Map();            /* caminho no bucket → foto em data URL (para a impressão) */

/* ─────────── utilidades ─────────── */
function anHoje(){ const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
function anData(iso){ return iso?String(iso).slice(0,10).split("-").reverse().join("/"):""; }
function anNl(t){ return esc(t||"").replace(/\n/g,"<br>"); }
function anMaisDias(iso,n){ const [a,m,d]=String(iso||anHoje()).split("-").map(Number); const x=new Date(a,m-1,d+n); return new Date(x.getTime()-x.getTimezoneOffset()*60000).toISOString().slice(0,10); }
/* dias até o prazo: duas meia-noites locais */
function anDiasAte(iso){ if(!iso)return null; const [a,m,d]=iso.split("-").map(Number); const h=new Date(); h.setHours(0,0,0,0); return Math.round((new Date(a,m-1,d)-h)/86400000); }
function anPrazoPadrao(){ try{ const n=regras&&regras.dias&&Number(regras.dias["Médio"]); return Number.isFinite(n)&&n>0?n:30; }catch(e){ return 30; } }
function anConcluida(it){ return it&&it.status==="Concluída"; }
function anVencida(it){ if(anConcluida(it))return false; const d=anDiasAte(it.prazo); return d!==null&&d<0; }
function anNomePadrao(){ try{ return localStorage.getItem(AN_NOME)||""; }catch(e){ return ""; } }
function anCopia(r){ return JSON.parse(JSON.stringify(r)); }
function anSeloPrazo(it){
  if(anConcluida(it))return `<span class="an-selo ok">Concluída${it.fim_data?" em "+esc(anData(it.fim_data)):""}</span>`;
  const d=anDiasAte(it.prazo);
  if(d===null)return `<span class="an-selo">Aberta · sem prazo</span>`;
  if(d<0)return `<span class="an-selo venc">Vencida há ${-d} dia${d===-1?"":"s"}</span>`;
  if(d===0)return `<span class="an-selo atencao">Vence hoje</span>`;
  const at=(typeof regras!=="undefined"&&Number.isFinite(regras.atencao))?regras.atencao:3;
  return `<span class="an-selo ${d<=at?"atencao":""}">Aberta · vence em ${d} dia${d===1?"":"s"}</span>`;
}
function anSemRede(m){ return /Failed to fetch|NetworkError|Load failed/i.test(String(m||"")); }

/* foto do item: recém-tirada (data URL) ou da base (URL assinada) */
async function anSrc(cam,novo){ if(novo)return novo; if(!cam)return ""; return anDados.get(cam)||await urlDaFoto(cam); }
async function anSrcDados(cam,novo){
  if(novo)return novo; if(!cam)return "";
  if(anDados.has(cam))return anDados.get(cam);
  const url=await urlDaFoto(cam); if(!url)return "";
  try{
    const b=await (await fetch(url)).blob();
    const d=await new Promise((ok,erro)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=erro;fr.readAsDataURL(b);});
    anDados.set(cam,d); return d;
  }catch(e){ return url; }
}

/* ─────────── rascunho no aparelho ─────────── */
function anGuardarRascunho(){
  if(!anAtual)return;
  try{ localStorage.setItem(AN_RASC,JSON.stringify(anAtual)); }
  catch(e){ toast("O aparelho está sem espaço para guardar o rascunho com as fotos. Salve o relatório."); }
}
function anLerRascunho(){ try{ const t=localStorage.getItem(AN_RASC); return t?JSON.parse(t):null; }catch(e){ return null; } }
function anApagarRascunho(){ try{ localStorage.removeItem(AN_RASC); }catch(e){} }

function anNovoRel(){
  return {id:uuid(),_novo:true,codigo:"",local:"",responsavel:anNomePadrao(),data:anHoje(),itens:[],assinatura:"",assinado_em:null};
}
function anNovoItem(){
  return {uid:uuid(),foto:"",problema:"",plano:"",responsavel:"",prazo:anMaisDias(anAtual&&anAtual.data,anPrazoPadrao()),
    status:"Aberta",fim_foto:"",fim_data:"",fim_obs:""};
}

/* ─────────── base ─────────── */
async function anCarregar(){
  const doCache=()=>{ try{ anRels=JSON.parse(localStorage.getItem(AN_CACHE)||"[]"); }catch(e){ anRels=[]; } };
  if(!conectado()){ anOffline=true; doCache(); anCarregou=true; anContador(); return; }
  try{
    const d=await rest("anomalias_relatorios?select=*&order=data.desc.nullslast,criado_em.desc");
    anRels=d||[]; anOffline=false; anCarregou=true; anCarregadoEm=new Date();
    try{ localStorage.setItem(AN_CACHE,JSON.stringify(anRels)); }catch(e){}
  }catch(e){
    anOffline=true; anCarregou=true; doCache();
    if(!/sem-sessao/.test(String(e.message))&&!anSemRede(e.message))console.warn("anomalias:",e);
  }
  anContador();
}
function anGuardarCache(){ try{ localStorage.setItem(AN_CACHE,JSON.stringify(anRels)); }catch(e){} }

function anTodosItens(){
  const l=[];
  anRels.forEach(r=>(r.itens||[]).forEach((it,i)=>l.push({rel:r,it,n:i+1})));
  return l;
}
function anContador(){
  const n=anTodosItens().filter(x=>!anConcluida(x.it)).length;
  const c=$("#cont-an"); if(c){ c.textContent=String(n); c.hidden=!n; }
  const m=$("#mi-an"); if(m){ m.textContent=n?String(n):""; m.hidden=!n; }
}

async function anProximoCodigo(){
  try{
    const d=await rest("anomalias_relatorios?select=codigo&codigo=like.ANOM-*");
    const maior=(d||[]).reduce((m,x)=>{const k=/^ANOM-(\d+)$/.exec(x.codigo||"");return k?Math.max(m,+k[1]):m;},0);
    return "ANOM-"+String(maior+1).padStart(3,"0");
  }catch(e){ return ""; }
}

/* o que vai para a base: sem as fotos em data URL */
function anLimparItem(it){
  const c={...it}; Object.keys(c).forEach(k=>{ if(k[0]==="_")delete c[k]; }); return c;
}

async function anSalvar(){
  if(anSalvando||!anAtual)return;
  const r=anAtual;
  const foco=s=>{ const e=$(s); if(e){ e.scrollIntoView({block:"center",behavior:"smooth"}); e.focus&&e.focus(); } };
  if(!String(r.local||"").trim()){ toast("Escreva o local (nome da fazenda)."); foco("#an-local"); return; }
  if(!String(r.responsavel||"").trim()){ toast("Escreva quem está fazendo o relatório."); foco("#an-resp"); return; }
  if(!r.itens.length){ toast("Adicione pelo menos uma anomalia."); return; }
  for(let i=0;i<r.itens.length;i++){
    const it=r.itens[i], n=i+1;
    if(!it.foto&&!it._fotoSrc){ toast(`Anomalia ${n}: falta a foto.`); foco(`[data-an-card="${it.uid}"]`); return; }
    if(!String(it.problema||"").trim()){ toast(`Anomalia ${n}: escreva qual é o problema.`); foco(`[data-an-campo="problema"][data-uid="${it.uid}"]`); return; }
    if(!String(it.plano||"").trim()){ toast(`Anomalia ${n}: escreva o plano de ação.`); foco(`[data-an-campo="plano"][data-uid="${it.uid}"]`); return; }
  }
  if(!conectado()){ anGuardarRascunho(); toast("Sem conexão com a base: ficou guardado no aparelho. Salve de novo quando a rede voltar."); return; }
  anSalvando=true;
  const bt=$("#an-salvar"); const rot=bt?bt.innerHTML:""; if(bt){bt.disabled=true;bt.textContent="Salvando…";}
  try{
    const carimbo=Date.now();
    for(const it of r.itens){
      if(it._fotoSrc){ it.foto=await enviarFoto(`${r.id}/an-${it.uid}-${carimbo}.jpg`,it._fotoSrc); anDados.set(it.foto,it._fotoSrc); delete it._fotoSrc; }
      if(it._fimSrc){ it.fim_foto=await enviarFoto(`${r.id}/an-${it.uid}-fim-${carimbo}.jpg`,it._fimSrc); anDados.set(it.fim_foto,it._fimSrc); delete it._fimSrc; }
    }
    try{ localStorage.setItem(AN_NOME,String(r.responsavel).trim()); }catch(e){}
    const corpo={local:String(r.local).trim(),responsavel:String(r.responsavel).trim(),data:r.data||null,
      itens:r.itens.map(anLimparItem),assinatura:r.assinatura||null,assinado_em:r.assinado_em||null};
    let salvo;
    if(r._novo){
      corpo.id=r.id; corpo.codigo=String(r.codigo||"").trim()||await anProximoCodigo()||null;
      salvo=await rest("anomalias_relatorios",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(corpo)});
    }else{
      if(String(r.codigo||"").trim())corpo.codigo=String(r.codigo).trim();
      salvo=await rest(`anomalias_relatorios?id=eq.${encodeURIComponent(r.id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(corpo)});
    }
    if(!salvo||!salvo.length)throw new Error("A base não confirmou a gravação. Confira se você tem acesso a este relatório.");
    const novo=salvo[0];
    anRels=[novo,...anRels.filter(x=>x.id!==novo.id)];
    anGuardarCache(); anApagarRascunho();
    anAtual=anCopia(novo);
    anContador();
    toast(`${novo.codigo||"Relatório"} salvo com ${novo.itens.length} anomalia${novo.itens.length===1?"":"s"}. Elas já aparecem no Painel.`);
    anRender();
  }catch(e){
    anGuardarRascunho();
    const m=String(e.message||e);
    toast(anSemRede(m)?"Sem rede: ficou guardado no aparelho. Salve de novo quando a rede voltar.":"Não deu para salvar: "+m.slice(0,110));
  }finally{
    anSalvando=false;
    const b=$("#an-salvar"); if(b&&b.disabled){b.disabled=false;b.innerHTML=rot;}
  }
}

async function anApagarRel(id){
  const r=anRels.find(x=>x.id===id); if(!r)return;
  if(!confirm(`Apagar o relatório ${r.codigo||""} (${r.local||"sem local"}) com ${(r.itens||[]).length} anomalia(s)? As fotos saem da base e não dá para desfazer.`))return;
  try{
    const d=await rest(`anomalias_relatorios?id=eq.${encodeURIComponent(id)}`,{method:"DELETE",headers:{Prefer:"return=representation"}});
    if(!d||!d.length)throw new Error("Só quem lançou ou um administrador pode apagar.");
    const cams=(r.itens||[]).flatMap(it=>[it.foto,it.fim_foto]).filter(Boolean);
    for(const cam of cams){ try{ const h=await comToken(); await fetch(`${cfg.url}/storage/v1/object/${encodeURI("vistorias/"+cam)}`,{method:"DELETE",headers:h}); }catch(e){} }
    anRels=anRels.filter(x=>x.id!==id); anGuardarCache();
    if(anAtual&&anAtual.id===id){ anAtual=null; anApagarRascunho(); }
    anContador(); toast("Relatório apagado."); anRender();
  }catch(e){ toast("Não deu para apagar: "+String(e.message).slice(0,110)); }
}

/* grava só a mudança de um item (concluir / reabrir), sem mexer no resto */
async function anGravarItem(relId,uid,mudar){
  const r=anRels.find(x=>x.id===relId); if(!r)throw new Error("Relatório não encontrado.");
  /* lê da base a versão atual, para não apagar o que outra pessoa mudou */
  let atual=r;
  try{ const d=await rest(`anomalias_relatorios?select=*&id=eq.${encodeURIComponent(relId)}`); if(d&&d[0])atual=d[0]; }catch(e){ if(anSemRede(e.message))throw e; }
  const itens=(atual.itens||[]).map(it=>it.uid===uid?{...it,...mudar}:it);
  const salvo=await rest(`anomalias_relatorios?id=eq.${encodeURIComponent(relId)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({itens})});
  if(!salvo||!salvo.length)throw new Error("A base não confirmou. Confira se você tem acesso a este relatório.");
  anRels=anRels.map(x=>x.id===relId?salvo[0]:x); anGuardarCache();
  if(anAtual&&anAtual.id===relId&&!anAtual._novo){
    const it=anAtual.itens.find(x=>x.uid===uid); const novo=salvo[0].itens.find(x=>x.uid===uid);
    if(it&&novo)Object.assign(it,{status:novo.status,fim_foto:novo.fim_foto,fim_data:novo.fim_data,fim_obs:novo.fim_obs});
  }
  anContador();
}

/* ─────────── telas ─────────── */
function anMostrar(qual){
  anVista=qual; aba("an");
}
function anRender(){
  const C=$("#an-corpo"); if(!C)return;
  document.querySelectorAll("[data-an-vista]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.anVista===anVista||(anVista==="previa"&&b.dataset.anVista===anVoltar))));
  if(anVista==="apontamento")anRenderApontamento();
  else if(anVista==="painel")anRenderPainel();
  else if(anVista==="historico")anRenderHistorico();
}

function anLocais(){
  return [...new Set([...AN_FAZENDAS,...anRels.map(r=>(r.local||"").trim()).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"pt-BR"));
}
function anResponsaveis(){
  return [...new Set(anTodosItens().map(x=>(x.it.responsavel||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
}

/* ── Apontamento ── */
function anRenderApontamento(){
  const C=$("#an-corpo");
  if(!anAtual){
    const rasc=anLerRascunho();
    anAtual=rasc||anNovoRel();
  }
  const r=anAtual;
  const conc=r.itens.filter(anConcluida).length;
  C.innerHTML=`
    <div class="secao-topo">
      <h2>${r._novo?"Novo relatório de anomalias":"Editando "+esc(r.codigo||"relatório")}</h2>
      ${r._novo?`<span class="dica">Para cada coisa errada: foto, o problema, o que fazer e quem vai arrumar.</span>`
        :`<span class="dica">Ao salvar, este mesmo relatório é atualizado.</span>`}
      ${r._novo?"":`<button class="bt" type="button" data-an-novo style="margin-left:auto">＋ Novo relatório</button>`}
    </div>
    ${anOffline?`<p class="ad-aviso">Sem conexão com a base: dá para preencher e imprimir; para salvar, precisa de rede.</p>`:""}
    <div class="cartao"><div class="grade">
      <div class="campo"><label for="an-local">Local (fazenda) *</label><input type="text" id="an-local" data-an-rel="local" list="an-locais" value="${esc(r.local)}" placeholder="Ex.: Fazenda Morro Branco"></div>
      <div class="campo"><label for="an-resp">Quem está fazendo o relatório *</label><input type="text" id="an-resp" data-an-rel="responsavel" value="${esc(r.responsavel)}" placeholder="Seu nome"></div>
      <div class="campo"><label for="an-data">Data</label><input type="date" id="an-data" data-an-rel="data" value="${esc(r.data||"")}"></div>
      ${r._novo?"":`<div class="campo"><label for="an-cod">Número</label><input type="text" id="an-cod" data-an-rel="codigo" value="${esc(r.codigo||"")}"></div>`}
    </div></div>
    <datalist id="an-locais">${anLocais().map(u=>`<option value="${esc(u)}">`).join("")}</datalist>
    <datalist id="an-resps">${anResponsaveis().map(u=>`<option value="${esc(u)}">`).join("")}</datalist>

    <div class="an-lista-topo"><h3>Anomalias <b>${r.itens.length}</b></h3>
      ${r.itens.length?`<span class="dica">${r.itens.length-conc} aberta${r.itens.length-conc===1?"":"s"} · ${conc} concluída${conc===1?"":"s"}</span>`:""}</div>
    <div class="an-itens">
      ${r.itens.map((it,i)=>anCardItem(it,i)).join("")||`<div class="vazio"><p>Nenhuma anomalia ainda. Toque em <b>＋ Nova anomalia</b> e tire a foto do que está errado.</p></div>`}
    </div>
    <button class="an-mais" type="button" data-an-add>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
      ＋ Nova anomalia (tirar foto)
    </button>

    <div class="cartao ck-assin-cx an-assin">
      <h3 class="ck-assin-tt">Assinatura de quem fez os apontamentos</h3>
      ${r.assinatura?`<div class="ck-assin feita"><img src="${esc(r.assinatura)}" alt="Assinatura">
          <span><b>${esc(r.responsavel||"")}</b> · assinado em ${esc(anQuando(r.assinado_em))}</span>
          <div class="ck-assin-bts"><button class="bt bt-fantasma" type="button" data-an-refazer>Refazer</button></div></div>`
        :`<p class="ck-assin-ajuda">Assine com o dedo ou o mouse no quadro e toque em Confirmar. Sai no fim do relatório, com o nome de quem está fazendo.</p>
          <div class="ck-assin"><canvas class="ck-assin-tela" id="an-tela" aria-label="Quadro para assinar"></canvas>
          <div class="ck-assin-bts"><button class="bt bt-fantasma" type="button" data-an-limpar>Limpar</button><button class="bt bt-forte" type="button" data-an-assinar>Confirmar assinatura</button></div></div>`}
    </div>

    <div class="ad-acoes an-acoes">
      <button class="btn" type="button" id="an-salvar">Salvar relatório</button>
      <button class="btn secundario" type="button" data-an-rel-atual>Ver / imprimir</button>
      <button class="bt bt-fantasma bt-perigo" type="button" data-an-descartar style="margin-left:auto">${r._novo?"Descartar":"Apagar relatório"}</button>
    </div>`;
  r.itens.forEach(async it=>{
    const im=C.querySelector(`img[data-an-img="${it.uid}"]`); if(!im)return;
    const u=await anSrc(it.foto,it._fotoSrc); if(u)im.src=u; else im.replaceWith(Object.assign(document.createElement("span"),{className:"ad-vazia",textContent:"Foto indisponível sem rede"}));
  });
  const cv=$("#an-tela"); if(cv&&typeof ckLigarTela==="function")ckLigarTela(cv);
}
function anQuando(iso){
  if(!iso)return ""; const d=new Date(iso); if(isNaN(d))return "";
  return d.toLocaleDateString("pt-BR")+" às "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
}
function anCardItem(it,i){
  const tem=!!(it.foto||it._fotoSrc), c=anConcluida(it);
  return `<article class="an-item${c?" ok":""}" data-an-card="${esc(it.uid)}" tabindex="-1">
    <header><span class="an-num">${i+1}</span><b>Anomalia ${i+1}</b>${anSeloPrazo(it)}
      <button class="bt bt-fantasma bt-perigo an-tirar" type="button" data-an-remover="${esc(it.uid)}" title="Tirar esta anomalia">✕</button></header>
    <div class="an-item-corpo">
      <button type="button" class="ad-foto an-foto" data-an-foto="${esc(it.uid)}">
        ${tem?`<img alt="Foto da anomalia ${i+1}" data-an-img="${esc(it.uid)}"><span class="ad-trocar">Trocar foto</span>`
          :`<span class="ad-vazia"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Tirar foto do problema</span>`}
      </button>
      <div class="an-campos">
        <div class="campo"><label>Qual é o problema *</label><textarea data-an-campo="problema" data-uid="${esc(it.uid)}" placeholder="Ex.: lixo jogado no chão perto do barracão">${esc(it.problema||"")}</textarea></div>
        <div class="campo"><label>Plano de ação (o que fazer) *</label><textarea data-an-campo="plano" data-uid="${esc(it.uid)}" placeholder="Ex.: recolher o lixo e colocar uma lixeira com tampa">${esc(it.plano||"")}</textarea></div>
        <div class="an-dupla">
          <div class="campo"><label>Quem vai arrumar</label><input type="text" list="an-resps" data-an-campo="responsavel" data-uid="${esc(it.uid)}" value="${esc(it.responsavel||"")}" placeholder="Nome de quem resolve"></div>
          <div class="campo"><label>Prazo</label><input type="date" data-an-campo="prazo" data-uid="${esc(it.uid)}" value="${esc(it.prazo||"")}"></div>
        </div>
        ${c?`<p class="an-fim">✓ Concluída${it.fim_data?" em "+esc(anData(it.fim_data)):""}${it.fim_obs?" — "+esc(it.fim_obs):""}</p>`:""}
      </div>
    </div>
  </article>`;
}

function anTirarFoto(cb){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
  inp.onchange=()=>{ const f=inp.files&&inp.files[0]; if(f)comprimir(f,cb); };
  inp.click();
}

/* ── Painel ──
   Mesmo desenho dos painéis do Gestão Rápida Pessoas (vencimentos do SST):
   cartão de cabeçalho com Atualizar e Imprimir o painel, filtros, cartões por
   faixa de prazo que filtram a lista, "Precisa de atenção", "Por local",
   "Por responsável" e o gráfico mês a mês. */
const AN_BREVE=7;   /* "vence em breve": até 7 dias */
let anCarregadoEm=null;
const AN_FAIXAS=[
  {ch:"vencidas",rot:"Vencidas",cor:"perigo",dica:"prazo já passou"},
  {ch:"breve",rot:"Vencem em até 7 dias",cor:"alerta",dica:"resolver esta semana"},
  {ch:"noprazo",rot:"Abertas no prazo",cor:"atencao",dica:"mais de 7 dias"},
  {ch:"concluidas",rot:"Concluídas",cor:"calma",dica:"com foto do corrigido"}
];
function anFaixa(it){
  if(anConcluida(it))return "concluidas";
  const d=anDiasAte(it.prazo);
  if(d!==null&&d<0)return "vencidas";
  if(d!==null&&d<=AN_BREVE)return "breve";
  return "noprazo";
}
function anTagPrazo(it){
  const f=anFaixa(it), d=anDiasAte(it.prazo);
  if(f==="concluidas")return `<span class="anp-tag calma">concluída${it.fim_data?" "+esc(anData(it.fim_data)):""}</span>`;
  if(d===null)return `<span class="anp-tag neutra">sem prazo</span>`;
  if(f==="vencidas")return `<span class="anp-tag perigo">vencida há ${-d} d</span>`;
  if(d===0)return `<span class="anp-tag alerta">vence hoje</span>`;
  if(f==="breve")return `<span class="anp-tag alerta">vence em ${d} d</span>`;
  return `<span class="anp-tag atencao">em ${d} d</span>`;
}
function anBase(){
  /* recorte dos filtros de cima (local e responsável), sem a faixa */
  return anTodosItens().filter(({rel,it})=>
    (!anFiltro.local||(rel.local||"").trim()===anFiltro.local)&&
    (!anFiltro.resp||(it.responsavel||"").trim()===anFiltro.resp));
}
function anFiltrarItens(){
  const b=anFiltro.busca.trim().toLowerCase();
  return anBase().filter(({rel,it})=>{
    const f=anFaixa(it);
    if(anFiltro.sit==="abertas"&&f==="concluidas")return false;
    if(!["abertas","todas"].includes(anFiltro.sit)&&f!==anFiltro.sit)return false;
    if(b&&![rel.codigo,rel.local,rel.responsavel,it.problema,it.plano,it.responsavel].join(" ").toLowerCase().includes(b))return false;
    return true;
  }).sort((x,y)=>{
    const ca=anConcluida(x.it), cb=anConcluida(y.it);
    if(ca!==cb)return ca?1:-1;
    if(ca)return String(y.it.fim_data||"").localeCompare(String(x.it.fim_data||""));
    return String(x.it.prazo||"9999").localeCompare(String(y.it.prazo||"9999"));
  });
}
function anMeses(n){
  const d=new Date(), l=[];
  for(let i=n-1;i>=0;i--){ const x=new Date(d.getFullYear(),d.getMonth()-i,1); l.push(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`); }
  return l;
}
function anRotMes(k){ return ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][+k.slice(5,7)-1]+"/"+k.slice(2,4); }
function anGrafico(base){
  const meses=anMeses(6);
  const reg=meses.map(m=>base.filter(x=>String(x.rel.data||"").slice(0,7)===m).length);
  const con=meses.map(m=>base.filter(x=>anConcluida(x.it)&&String(x.it.fim_data||"").slice(0,7)===m).length);
  const W=900,H=210,E=34,T=14,B=26, larg=(W-E-8)/meses.length;
  const max=Math.max(4,...reg,...con);
  const y=v=>T+(H-T-B)*(1-v/max);
  const passo=Math.max(1,Math.ceil(max/4));
  const marcas=[]; for(let v=0;v<=max;v+=passo)marcas.push(v);
  return `<figure class="anp-graf"><figcaption>Registradas × concluídas · últimos 6 meses</figcaption>
    <div class="anp-rola"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Anomalias registradas e concluídas por mês">
      ${marcas.map(v=>`<line class="anp-eixo" x1="${E}" x2="${W-8}" y1="${y(v)}" y2="${y(v)}"/><text class="anp-txt" x="${E-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`).join("")}
      ${meses.map((m,i)=>{
        const x=E+i*larg+larg*0.18, w=larg*0.3;
        const bar=(v,dx,cls,rot)=>v?`<rect class="${cls}" x="${x+dx}" y="${y(v)}" width="${w}" height="${Math.max(1,H-B-y(v))}" rx="3"><title>${anRotMes(m)}: ${v} ${rot}</title></rect><text class="anp-txt anp-val" x="${x+dx+w/2}" y="${y(v)-4}" text-anchor="middle">${v}</text>`:"";
        return bar(reg[i],0,"anp-b-reg","registrada(s)")+bar(con[i],w+larg*0.04,"anp-b-con","concluída(s)")
          +`<text class="anp-txt" x="${x+w+larg*0.02}" y="${H-8}" text-anchor="middle">${anRotMes(m)}</text>`;
      }).join("")}
    </svg></div>
    <p class="anp-legenda"><span class="anp-cx reg"></span>registradas no mês (data do relatório) · <span class="anp-cx con"></span>concluídas no mês (data da correção)</p>
  </figure>`;
}
function anTabelaGrupo(base,chave,rotulo,dataAttr){
  const nomes=[...new Set(base.map(x=>chave(x)))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  if(!nomes.length)return `<div class="vazio">Nenhuma anomalia ainda.</div>`;
  const tot={vencidas:0,breve:0,noprazo:0,concluidas:0,n:0};
  const linhas=nomes.map(nm=>{
    const dele=base.filter(x=>chave(x)===nm);
    const c=f=>dele.filter(x=>anFaixa(x.it)===f).length;
    AN_FAIXAS.forEach(f=>tot[f.ch]+=c(f.ch)); tot.n+=dele.length;
    return `<tr><td><button type="button" class="anp-link" ${dataAttr}="${esc(nm)}">${esc(nm)}</button></td>
      ${AN_FAIXAS.map(f=>{ const n=c(f.ch); return `<td class="ce${n?" anp-n-"+f.cor:" anp-sem"}">${n||"—"}</td>`; }).join("")}
      <td class="ce"><b>${dele.length}</b></td></tr>`;
  }).join("");
  return `<div class="anp-rola"><table class="anp-tab"><thead><tr><th>${esc(rotulo)}</th>${AN_FAIXAS.map(f=>`<th class="ce">${esc(f.rot.replace("Vencem em até 7 dias","Até 7 dias").replace("Abertas no prazo","No prazo"))}</th>`).join("")}<th class="ce">Total</th></tr></thead>
    <tbody>${linhas}<tr class="anp-total"><td>Total</td>${AN_FAIXAS.map(f=>`<td class="ce">${tot[f.ch]||"—"}</td>`).join("")}<td class="ce">${tot.n}</td></tr></tbody></table></div>`;
}
function anRenderPainel(){
  const C=$("#an-corpo");
  const base=anBase();
  const conta=f=>base.filter(x=>anFaixa(x.it)===f).length;
  const tot=base.length, conc=conta("concluidas"), pct=tot?Math.round(conc*100/tot):0;
  const locais=[...new Set(anRels.map(r=>(r.local||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const resps=anResponsaveis();
  const hora=anCarregadoEm?anCarregadoEm.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"";
  const urg=base.filter(x=>["vencidas","breve"].includes(anFaixa(x.it))).sort((a,b)=>String(a.it.prazo||"").localeCompare(String(b.it.prazo||"")));
  const nomeSit={abertas:"Abertas",todas:"Todas",vencidas:"Vencidas",breve:"Vencem em até 7 dias",noprazo:"Abertas no prazo",concluidas:"Concluídas"}[anFiltro.sit];
  C.innerHTML=`
  <div class="anp">
    <div class="anp-cartao">
      <div class="anp-barra-tit">
        <div><h2>Painel das anomalias</h2>
          <p class="anp-dica">Só as anomalias deste módulo. Clique num cartão para ver a lista.${hora?` · atualizado às ${esc(hora)}`:""}</p></div>
        <span class="anp-acoes"><button type="button" class="anp-btn" data-an-atualizar>Atualizar</button>
          <button type="button" class="anp-btn principal" data-an-imp-painel>Imprimir o painel</button></span>
      </div>
      ${anOffline?`<div class="anp-aviso">Sem conexão com a base: mostrando o que estava guardado neste aparelho.</div>`:""}
      <div class="anp-filtros">
        <label class="anp-campo">Local <select id="an-f-local"><option value="">Todos</option>${locais.map(u=>`<option ${u===anFiltro.local?"selected":""}>${esc(u)}</option>`).join("")}</select></label>
        <label class="anp-campo">Quem vai arrumar <select id="an-f-resp"><option value="">Todos</option>${resps.map(u=>`<option ${u===anFiltro.resp?"selected":""}>${esc(u)}</option>`).join("")}</select></label>
      </div>
      <div class="anp-cards">
        ${AN_FAIXAS.map(f=>{ const n=conta(f.ch); return `<button type="button" class="anp-card anp-${f.cor}${n?"":" anp-zero"}" data-an-sit="${f.ch}" aria-pressed="${anFiltro.sit===f.ch}">
          <span>${esc(f.rot)}</span><strong>${n}</strong><small>${n?esc(f.dica):"nada aqui"}</small></button>`; }).join("")}
        <button type="button" class="anp-card anp-ok" data-an-sit="todas" aria-pressed="${anFiltro.sit==="todas"}"><span>Total</span><strong>${tot}</strong><small>${tot-conc} aberta${tot-conc===1?"":"s"}</small></button>
      </div>
      <div class="anp-progresso"><div class="anp-progresso-tit"><b>${pct}% concluídas</b><span>${conc} de ${tot}</span></div><div class="anp-trilho"><i style="width:${pct}%"></i></div></div>

      <div class="anp-bloco"><h3>Precisa de atenção</h3>
        <p class="anp-dica">Vencidas e as que vencem nos próximos ${AN_BREVE} dias.</p>
        ${urg.length?`<div class="anp-rola"><table class="anp-tab"><thead><tr><th>Problema</th><th>Local</th><th>Quem vai arrumar</th><th class="ce">Prazo</th><th class="ce">Situação</th><th></th></tr></thead><tbody>
          ${urg.map(({rel,it,n})=>`<tr><td><b>${esc(it.problema||"—")}</b><br><span class="anp-sem">${esc([rel.codigo,"nº "+n].filter(Boolean).join(" · "))}</span></td>
            <td>${esc(rel.local||"—")}</td><td>${esc(it.responsavel||"—")}</td><td class="ce">${esc(anData(it.prazo)||"—")}</td>
            <td class="ce">${anTagPrazo(it)}</td><td class="ce"><button type="button" class="anp-btn mini" data-an-concluir="${esc(rel.id)}|${esc(it.uid)}">Concluir</button></td></tr>`).join("")}
          </tbody></table></div>`:`<div class="vazio">Nada vencido nem vencendo nos próximos ${AN_BREVE} dias. Tudo em ordem.</div>`}
      </div>

      <div class="anp-bloco"><h3>Por local</h3>${anTabelaGrupo(base,x=>(x.rel.local||"").trim()||"Sem local","Local","data-an-glocal")}</div>
      <div class="anp-bloco"><h3>Por responsável</h3>${anTabelaGrupo(base,x=>(x.it.responsavel||"").trim()||"Sem responsável","Quem vai arrumar","data-an-gresp")}</div>
      <div class="anp-bloco">${anGrafico(base)}</div>
    </div>

    <div class="anp-cartao">
      <div class="anp-barra-tit"><div><h2>Lista · ${esc(nomeSit)}</h2><p class="anp-dica">Com as fotos. Concluir pede a foto do corrigido.</p></div>
        ${anFiltro.sit!=="abertas"?`<span class="anp-acoes"><button type="button" class="anp-btn" data-an-sit="abertas">Ver todas as abertas</button></span>`:""}</div>
      <div class="anp-filtros"><label class="anp-campo larga">Buscar <input type="search" id="an-f-busca" placeholder="Problema, plano, responsável, número…" value="${esc(anFiltro.busca)}"></label></div>
      <div class="an-plista" id="an-plista"></div>
    </div>
  </div>`;
  anRenderPlista();
}
function anRenderPlista(){
  const L=$("#an-plista"); if(!L)return;
  if(!anCarregou){ L.innerHTML=`<div class="vazio">Carregando…</div>`; return; }
  const lista=anFiltrarItens();
  if(!lista.length){
    L.innerHTML=`<div class="vazio">${anRels.length?"Nenhuma anomalia com esse filtro.":"Nenhum relatório de anomalias salvo ainda. Comece em <b>Apontamento</b>."}</div>`; return;
  }
  L.innerHTML=lista.map(({rel,it,n})=>{
    const c=anConcluida(it), f=anFaixa(it);
    return `<article class="an-pcard anp-f-${f}">
      <div class="an-pfotos">
        <figure><img alt="" data-an-pf="${esc(it.foto||"")}"><figcaption class="antes">Problema</figcaption></figure>
        ${c?`<figure><img alt="" data-an-pf="${esc(it.fim_foto||"")}"><figcaption class="depois">Corrigido</figcaption></figure>`:""}
      </div>
      <div class="an-pinfo">
        <span class="ref">${esc([rel.codigo,"nº "+n,rel.local].filter(Boolean).join(" · "))}</span>
        <h3>${esc(it.problema||"—")}</h3>
        <p><b>Plano de ação:</b> ${anNl(it.plano)}</p>
        <p><b>Quem vai arrumar:</b> ${esc(it.responsavel||"—")} · <b>Prazo:</b> ${esc(anData(it.prazo)||"—")}</p>
        ${c&&it.fim_obs?`<p><b>O que foi feito:</b> ${anNl(it.fim_obs)}</p>`:""}
        <span>${anTagPrazo(it)}</span>
      </div>
      <div class="pe">
        ${c?`<button class="anp-btn" type="button" data-an-reabrir="${esc(rel.id)}|${esc(it.uid)}">Reabrir</button>`
          :`<button class="anp-btn principal" type="button" data-an-concluir="${esc(rel.id)}|${esc(it.uid)}">✓ Concluir</button>`}
        <button class="anp-btn" type="button" data-an-ver="${esc(rel.id)}">Relatório</button>
      </div>
    </article>`;
  }).join("");
  [...L.querySelectorAll("img[data-an-pf]")].forEach(async im=>{
    const cam=im.dataset.anPf; const u=cam?await anSrc(cam):"";
    if(u)im.src=u; else im.replaceWith(Object.assign(document.createElement("div"),{className:"ad-falta",textContent:cam?"Foto indisponível sem rede":"Sem foto"}));
  });
}

/* folha impressa do painel: A4 em pé, padrão SAKUMA, sem assinatura */
function anFolhaPainel(){
  const base=anBase();
  const conta=f=>base.filter(x=>anFaixa(x.it)===f).length;
  const tot=base.length, conc=conta("concluidas"), pct=tot?Math.round(conc*100/tot):0;
  const urg=base.filter(x=>["vencidas","breve"].includes(anFaixa(x.it))).sort((a,b)=>String(a.it.prazo||"").localeCompare(String(b.it.prazo||"")));
  const filtro=[anFiltro.local&&"Local: "+anFiltro.local,anFiltro.resp&&"Responsável: "+anFiltro.resp].filter(Boolean).join(" · ")||"Todos os locais e responsáveis";
  return `<div class="anr-doc anr-painel">
    <header class="anr-cab"><div><h1>Painel das Anomalias</h1><p>${esc(filtro)} · emitido em ${esc(anData(anHoje()))}</p></div><img src="${LOGO}" alt="SAKUMA Agronegócios"></header>
    <div class="anr-kpis cinco">
      ${AN_FAIXAS.map(f=>`<div class="${{perigo:"venc",alerta:"breve",atencao:"ab",calma:"ok"}[f.cor]}"><b>${conta(f.ch)}</b><span>${esc(f.rot)}</span></div>`).join("")}
      <div><b>${tot}</b><span>total · ${pct}% concluídas</span></div>
    </div>
    <h2 class="anr-h2">Precisa de atenção</h2>
    ${urg.length?`<table class="anr-lista"><thead><tr><th>Problema</th><th>Local</th><th>Quem vai arrumar</th><th>Prazo</th><th>Situação</th></tr></thead><tbody>
      ${urg.map(({rel,it,n})=>`<tr><td><b>${esc(it.problema||"—")}</b><br><small>${esc([rel.codigo,"nº "+n].join(" · "))} · ${esc(it.plano||"")}</small></td><td>${esc(rel.local||"—")}</td><td>${esc(it.responsavel||"—")}</td><td>${esc(anData(it.prazo)||"—")}</td><td>${anTagPrazo(it)}</td></tr>`).join("")}
      </tbody></table>`:`<p class="anr-vazio">Nada vencido nem vencendo nos próximos ${AN_BREVE} dias.</p>`}
    <h2 class="anr-h2">Por local</h2>${anTabelaGrupo(base,x=>(x.rel.local||"").trim()||"Sem local","Local","data-x").replace(/anp-tab/g,"anr-lista")}
    <h2 class="anr-h2">Por responsável</h2>${anTabelaGrupo(base,x=>(x.it.responsavel||"").trim()||"Sem responsável","Quem vai arrumar","data-x").replace(/anp-tab/g,"anr-lista")}
    <div class="anr-graf">${anGrafico(base)}</div>
    <footer class="anr-rod"><span>SAKUMA Agronegócios · Painel das Anomalias</span>${typeof docLop==="function"?docLop():""}</footer>
  </div>`;
}

/* ── Concluir com a foto do corrigido ── */
function anAbrirConcluir(relId,uid){
  const rel=anRels.find(x=>x.id===relId), it=rel&&(rel.itens||[]).find(x=>x.uid===uid); if(!it)return;
  if(!conectado()||anOffline){ toast("Para concluir é preciso estar conectado à base."); return; }
  anConcluindo={relId,uid,_src:"",data:anHoje(),obs:""};
  let d=$("#an-dlg");
  if(!d){ d=document.createElement("dialog"); d.id="an-dlg"; d.className="an-dlg"; document.body.appendChild(d);
    d.addEventListener("click",anDlgClique); d.addEventListener("input",ev=>{ if(!anConcluindo)return; if(ev.target.id==="an-c-obs")anConcluindo.obs=ev.target.value; if(ev.target.id==="an-c-data")anConcluindo.data=ev.target.value; }); }
  d.innerHTML=anDlgHtml(rel,it);
  anSrc(it.foto).then(u=>{ const im=d.querySelector("[data-an-c-antes]"); if(im&&u)im.src=u; });
  d.showModal ? d.showModal() : d.setAttribute("open","");
}
function anDlgHtml(rel,it){
  const s=anConcluindo;
  return `<div class="dlg-topo"><h3>Concluir anomalia · ${esc([rel.codigo,rel.local].filter(Boolean).join(" · "))}</h3><button class="x" type="button" data-an-c-cancelar>×</button></div>
    <div class="dlg-corpo an-dlg-corpo">
      <p class="an-dlg-prob"><b>${esc(it.problema||"")}</b><br><span>Plano: ${esc(it.plano||"")}</span></p>
      <div class="an-dlg-fotos">
        <figure><img alt="" data-an-c-antes><figcaption class="antes">Problema</figcaption></figure>
        <button type="button" class="ad-foto" data-an-c-foto>${s._src?`<img src="${esc(s._src)}" alt="Foto do corrigido"><span class="ad-trocar">Trocar foto</span>`
          :`<span class="ad-vazia"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Foto do corrigido *</span>`}</button>
      </div>
      <div class="campo"><label for="an-c-obs">O que foi feito</label><textarea id="an-c-obs" placeholder="Ex.: lixo recolhido e lixeira instalada">${esc(s.obs)}</textarea></div>
      <div class="campo"><label for="an-c-data">Data da correção</label><input type="date" id="an-c-data" value="${esc(s.data)}"></div>
    </div>
    <div class="dlg-rodape"><button class="bt bt-fantasma" type="button" data-an-c-cancelar>Cancelar</button>
      <button class="bt bt-forte" type="button" data-an-c-ok>Concluir</button></div>`;
}
async function anDlgClique(ev){
  const d=$("#an-dlg"), s=anConcluindo; if(!s)return;
  if(ev.target.closest("[data-an-c-cancelar]")){ anConcluindo=null; d.close?d.close():d.removeAttribute("open"); return; }
  if(ev.target.closest("[data-an-c-foto]")){
    anTirarFoto(url=>{ s._src=url; const rel=anRels.find(x=>x.id===s.relId), it=rel.itens.find(x=>x.uid===s.uid);
      d.innerHTML=anDlgHtml(rel,it); anSrc(it.foto).then(u=>{ const im=d.querySelector("[data-an-c-antes]"); if(im&&u)im.src=u; }); });
    return;
  }
  const ok=ev.target.closest("[data-an-c-ok]");
  if(ok){
    if(!s._src){ toast("Tire a foto do corrigido para concluir."); return; }
    ok.disabled=true; ok.textContent="Gravando…";
    try{
      const cam=await enviarFoto(`${s.relId}/an-${s.uid}-fim-${Date.now()}.jpg`,s._src); anDados.set(cam,s._src);
      await anGravarItem(s.relId,s.uid,{status:"Concluída",fim_foto:cam,fim_data:s.data||anHoje(),fim_obs:(s.obs||"").trim()});
      anConcluindo=null; d.close?d.close():d.removeAttribute("open");
      toast("Anomalia concluída."); anRender();
    }catch(e){ ok.disabled=false; ok.textContent="Concluir"; toast(anSemRede(e.message)?"Sem rede. Tente de novo quando a conexão voltar.":"Não deu para concluir: "+String(e.message).slice(0,100)); }
  }
}
async function anReabrir(relId,uid){
  if(!confirm("Reabrir esta anomalia? Ela volta para as abertas e a foto do corrigido sai do relatório."))return;
  try{ await anGravarItem(relId,uid,{status:"Aberta",fim_foto:"",fim_data:"",fim_obs:""}); toast("Anomalia reaberta."); anRender(); }
  catch(e){ toast("Não deu para reabrir: "+String(e.message).slice(0,100)); }
}

/* ── Histórico ── */
function anRenderHistorico(){
  const C=$("#an-corpo");
  const locais=[...new Set(anRels.map(r=>(r.local||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const b=anHist.busca.trim().toLowerCase();
  const lista=anRels.filter(r=>{
    if(anHist.local&&(r.local||"").trim()!==anHist.local)return false;
    if(b&&![r.codigo,r.local,r.responsavel,...(r.itens||[]).map(i=>i.problema+" "+i.responsavel)].join(" ").toLowerCase().includes(b))return false;
    return true;
  });
  const meu=(typeof sessao!=="undefined"&&sessao&&sessao.uid)||"";
  C.innerHTML=`
    <div class="secao-topo"><h2>Histórico de relatórios</h2>
      <span class="dica">Abra de novo para imprimir ou editar. Editar atualiza o mesmo relatório.</span></div>
    ${anOffline?`<p class="ad-aviso">Sem conexão com a base: mostrando o que estava guardado neste aparelho.</p>`:""}
    <div class="ad-filtros">
      ${locais.length>1?`<select id="an-h-local" aria-label="Local"><option value="">Todos os locais</option>${locais.map(u=>`<option ${u===anHist.local?"selected":""}>${esc(u)}</option>`).join("")}</select>`:""}
      <input type="search" id="an-h-busca" placeholder="Buscar número, local, responsável…" value="${esc(anHist.busca)}">
    </div>
    <div class="an-hist">${!anCarregou?`<div class="vazio"><p>Carregando…</p></div>`:lista.length?lista.map(r=>{
      const its=r.itens||[], c=its.filter(anConcluida).length, v=its.filter(anVencida).length, pct=its.length?Math.round(c*100/its.length):0;
      const podeApagar=souAdmin||!r.user_id||r.user_id===meu;
      return `<article class="an-hcard">
        <div class="an-hinfo">
          <span class="ref">${esc(r.codigo||"sem número")} · ${esc(anData(r.data)||"sem data")}</span>
          <h3>${esc(r.local||"Sem local")}</h3>
          <span class="info">Feito por ${esc(r.responsavel||"—")} · ${its.length} anomalia${its.length===1?"":"s"}</span>
          <div class="an-hsit"><span class="an-selo">${its.length-c} aberta${its.length-c===1?"":"s"}</span>${v?`<span class="an-selo venc">${v} vencida${v===1?"":"s"}</span>`:""}<span class="an-selo ok">${c} concluída${c===1?"":"s"}</span></div>
          <div class="an-barra mini"><i style="width:${pct}%"></i></div>
        </div>
        <div class="pe">
          <button class="bt bt-forte" type="button" data-an-ver="${esc(r.id)}">Imprimir</button>
          <button class="bt" type="button" data-an-editar="${esc(r.id)}">Editar</button>
          ${podeApagar?`<button class="bt bt-fantasma bt-perigo" type="button" data-an-apagar="${esc(r.id)}">Apagar</button>`:""}
        </div>
      </article>`;}).join(""):`<div class="vazio"><p>${anRels.length?"Nenhum relatório com esse filtro.":"Nenhum relatório salvo ainda."}</p></div>`}</div>`;
}

function anEditar(id){
  const r=anRels.find(x=>x.id===id); if(!r)return;
  const rasc=anLerRascunho();
  if(anAtual&&anAtual._novo&&anAtual.itens.length&&anAtual.id!==id&&!confirm("Há um relatório novo ainda não salvo neste aparelho. Abrir outro descarta o que não foi salvo. Continuar?"))return;
  anAtual=(rasc&&rasc.id===id)?rasc:anCopia(r);
  anGuardarRascunho();
  anMostrar("apontamento");
}

/* ─────────── relatório impresso (A4 em pé, padrão SAKUMA) ─────────── */
async function anMontarDoc(r){
  const its=r.itens||[];
  const fotos=await Promise.all(its.map(async it=>[await anSrcDados(it.foto,it._fotoSrc),anConcluida(it)?await anSrcDados(it.fim_foto,it._fimSrc):""]));
  const conc=its.filter(anConcluida).length, venc=its.filter(anVencida).length;
  const cod=r.codigo||"Relatório de anomalias";
  const blocos=its.map((it,i)=>{
    const [fA,fC]=fotos[i], c=anConcluida(it);
    const sit=c?`Concluída${it.fim_data?" em "+anData(it.fim_data):""}`:anVencida(it)?"Aberta · vencida":"Aberta";
    return `<section class="anr-item">
      <div class="anr-item-cab"><span class="anr-n">${i+1}</span><h3>${esc(it.problema||"")}</h3><span class="anr-sit ${c?"ok":anVencida(it)?"venc":""}">${esc(sit)}</span></div>
      <div class="anr-item-corpo">
        <div class="anr-fotos${fC?" duas":""}">
          <figure><div class="anr-img">${fA?`<img src="${esc(fA)}" alt="">`:`<span>Sem foto</span>`}</div><figcaption class="antes">Problema</figcaption></figure>
          ${fC?`<figure><div class="anr-img"><img src="${esc(fC)}" alt=""></div><figcaption class="depois">Corrigido</figcaption></figure>`:""}
        </div>
        <table class="anr-tab"><tbody>
          <tr><th>Plano de ação</th><td>${anNl(it.plano)}</td></tr>
          <tr><th>Quem vai arrumar</th><td>${esc(it.responsavel||"—")}</td></tr>
          <tr><th>Prazo</th><td>${esc(anData(it.prazo)||"—")}</td></tr>
          ${c&&it.fim_obs?`<tr><th>O que foi feito</th><td>${anNl(it.fim_obs)}</td></tr>`:""}
        </tbody></table>
      </div>
    </section>`;
  }).join("");
  return `<div class="anr-doc">
    <header class="anr-cab">
      <div><h1>Relatório de Anomalias</h1><p>${esc([r.codigo,r.local,anData(r.data)].filter(Boolean).join(" · "))}</p></div>
      <img src="${LOGO}" alt="SAKUMA Agronegócios">
    </header>
    <table class="anr-quadro"><tbody>
      <tr><th>Local</th><td>${esc(r.local||"—")}</td><th>Data</th><td>${esc(anData(r.data)||"—")}</td></tr>
      <tr><th>Responsável pelos apontamentos</th><td colspan="3">${esc(r.responsavel||"—")}</td></tr>
    </tbody></table>
    <div class="anr-kpis">
      <div><b>${its.length}</b><span>anomalia${its.length===1?"":"s"}</span></div>
      <div class="ab"><b>${its.length-conc}</b><span>aberta${its.length-conc===1?"":"s"}</span></div>
      <div class="venc"><b>${venc}</b><span>vencida${venc===1?"":"s"}</span></div>
      <div class="ok"><b>${conc}</b><span>concluída${conc===1?"":"s"}</span></div>
    </div>
    ${blocos||`<p class="anr-vazio">Nenhuma anomalia registrada.</p>`}
    <section class="anr-ass">
      <div class="anr-ass-cx">
        ${r.assinatura?`<img src="${esc(r.assinatura)}" alt="Assinatura">`:`<div class="anr-ass-branco"></div>`}
        <div class="anr-ass-linha"></div>
        <b>${esc(r.responsavel||"")}</b>
        <span>Responsável pelos apontamentos</span>
        <span>${r.assinatura&&r.assinado_em?"Assinado em "+esc(anQuando(r.assinado_em)):"Data: ____/____/________"}</span>
      </div>
    </section>
    <footer class="anr-rod"><span>SAKUMA Agronegócios · ${esc(cod)} · emitido em ${esc(anData(anHoje()))}</span>${typeof docLop==="function"?docLop():""}</footer>
  </div>`;
}

async function anPrevia(r,voltar){
  anVoltar=voltar||anVista; anVista="previa"; anRender();
  const C=$("#an-corpo");
  C.innerHTML=`<div class="secao-topo ad-previa-topo">
      <button class="bt bt-fantasma" type="button" data-an-previa-voltar>← Voltar</button>
      <h2>${esc(r.codigo||"Relatório de anomalias")}</h2>
      <div class="ad-previa-bts"><button class="btn" type="button" data-an-imprimir>Imprimir / PDF</button></div>
    </div>
    <p class="dica ad-previa-dica">Folha A4 em pé. Para mandar em PDF: Imprimir → Salvar como PDF.</p>
    <div class="an-previa-palco" id="an-palco"><div class="vazio"><p>Montando o relatório…</p></div></div>`;
  const doc=await anMontarDoc(r);
  const p=$("#an-palco"); if(p&&anVista==="previa"){ p.innerHTML=doc; anZoom(); }
}
function anZoom(){
  const p=$("#an-palco"), d=p&&p.querySelector(".anr-doc"); if(!d)return;
  d.style.zoom=String(Math.min(1,(p.clientWidth||794)/794));
}
window.addEventListener("resize",()=>{ if(anVista==="previa")anZoom(); });

async function anImprimir(html){
  const p=$("#an-palco"), doc=p&&p.querySelector(".anr-doc");
  if(!html&&!doc){ toast("O relatório ainda está sendo montado."); return; }
  const alvo=$("#an-imprimir");
  alvo.innerHTML=html||doc.outerHTML;
  const d=alvo.querySelector(".anr-doc"); if(d)d.style.zoom="";
  await Promise.all([...alvo.querySelectorAll("img")].map(i=>i.decode?i.decode().catch(()=>{}):null));
  let st=document.getElementById("an-pagina");
  if(!st){ st=document.createElement("style"); st.id="an-pagina"; }
  st.textContent="@media print{@page{size:A4 portrait;margin:0 12mm}}";
  document.head.appendChild(st);
  document.body.classList.add("an-imprimindo");
  const limpar=()=>{ document.body.classList.remove("an-imprimindo"); st.remove(); alvo.innerHTML=""; window.removeEventListener("afterprint",limpar); };
  window.addEventListener("afterprint",limpar);
  setTimeout(()=>{ try{ window.print(); }catch(e){ toast("A impressão foi bloqueada aqui."); limpar(); } },150);
}

/* ─────────── eventos ─────────── */
$("#painel-an").addEventListener("click",ev=>{
  const t=ev.target, q=s=>t.closest(s);
  let el;
  if(el=q("[data-an-vista]")){ anVista=el.dataset.anVista; if(anVista!=="apontamento")anCarregar().then(()=>{ if(anVista===el.dataset.anVista)anRender(); }); anRender(); return; }
  if(q("[data-an-novo]")){
    if(anAtual&&!anAtual._novo)anApagarRascunho();
    anAtual=anNovoRel(); anRender(); return;
  }
  if(q("[data-an-add]")){
    const it=anNovoItem(); anAtual.itens.push(it); anGuardarRascunho(); anRender();
    anTirarFoto(url=>{ it._fotoSrc=url; anGuardarRascunho(); anRender();
      const ta=document.querySelector(`[data-an-campo="problema"][data-uid="${it.uid}"]`); if(ta){ ta.scrollIntoView({block:"center"}); ta.focus(); } });
    return;
  }
  if(el=q("[data-an-foto]")){
    const it=anAtual.itens.find(x=>x.uid===el.dataset.anFoto); if(!it)return;
    anTirarFoto(url=>{ it._fotoSrc=url; anGuardarRascunho(); anRender(); }); return;
  }
  if(el=q("[data-an-remover]")){
    const i=anAtual.itens.findIndex(x=>x.uid===el.dataset.anRemover); if(i<0)return;
    const it=anAtual.itens[i];
    if((it.problema||it.foto||it._fotoSrc)&&!confirm(`Tirar a anomalia ${i+1} do relatório?${anAtual._novo?"":" Ela só sai da base quando você salvar."}`))return;
    anAtual.itens.splice(i,1); anGuardarRascunho(); anRender(); return;
  }
  if(q("[data-an-limpar]")){ const cv=$("#an-tela"); if(cv)ckLigarTela(cv); return; }
  if(q("[data-an-assinar]")){
    const cv=$("#an-tela");
    if(!String(anAtual.responsavel||"").trim()){ toast("Escreva primeiro quem está fazendo o relatório."); const e=$("#an-resp"); if(e)e.focus(); return; }
    if(!cv||!cv._riscou){ toast("Assine no quadro antes de confirmar."); return; }
    anAtual.assinatura=cv.toDataURL("image/png"); anAtual.assinado_em=new Date().toISOString();
    anGuardarRascunho(); anRender(); toast("Assinatura registrada. Salve o relatório para gravar."); return;
  }
  if(q("[data-an-refazer]")){ anAtual.assinatura=""; anAtual.assinado_em=null; anGuardarRascunho(); anRender(); return; }
  if(q("#an-salvar")){ anSalvar(); return; }
  if(q("[data-an-rel-atual]")){
    if(!anAtual.itens.length){ toast("Adicione pelo menos uma anomalia."); return; }
    anPrevia(anAtual,"apontamento"); return;
  }
  if(q("[data-an-descartar]")){
    if(anAtual._novo){
      if((anAtual.itens.length||anAtual.local)&&!confirm("Descartar este relatório que ainda não foi salvo?"))return;
      anApagarRascunho(); anAtual=anNovoRel(); anRender();
    }else anApagarRel(anAtual.id);
    return;
  }
  if(el=q("[data-an-sit]")){ const v=el.dataset.anSit; anFiltro.sit=(anFiltro.sit===v&&v!=="abertas")?"abertas":v; anRenderPainel(); return; }
  if(q("[data-an-atualizar]")){ anCarregar().then(()=>{ if(anVista==="painel")anRenderPainel(); toast("Painel atualizado."); }); return; }
  if(q("[data-an-imp-painel]")){ anImprimir(anFolhaPainel()); return; }
  if(el=q("[data-an-glocal]")){ anFiltro.local=el.dataset.anGlocal==="Sem local"?"":el.dataset.anGlocal; anFiltro.sit="todas"; anRenderPainel(); $("#an-plista").scrollIntoView({behavior:"smooth"}); return; }
  if(el=q("[data-an-gresp]")){ anFiltro.resp=el.dataset.anGresp==="Sem responsável"?"":el.dataset.anGresp; anFiltro.sit="todas"; anRenderPainel(); $("#an-plista").scrollIntoView({behavior:"smooth"}); return; }
  if(el=q("[data-an-concluir]")){ const [a,b]=el.dataset.anConcluir.split("|"); anAbrirConcluir(a,b); return; }
  if(el=q("[data-an-reabrir]")){ const [a,b]=el.dataset.anReabrir.split("|"); anReabrir(a,b); return; }
  if(el=q("[data-an-ver]")){ const r=anRels.find(x=>x.id===el.dataset.anVer); if(r)anPrevia(r,anVista); return; }
  if(el=q("[data-an-editar]")){ anEditar(el.dataset.anEditar); return; }
  if(el=q("[data-an-apagar]")){ anApagarRel(el.dataset.anApagar); return; }
  if(q("[data-an-previa-voltar]")){ anVista=anVoltar; anRender(); return; }
  if(q("[data-an-imprimir]")){ anImprimir(); return; }
});
$("#painel-an").addEventListener("input",ev=>{
  const t=ev.target;
  if(t.id==="an-f-busca"){ anFiltro.busca=t.value; anRenderPlista(); return; }
  if(t.id==="an-h-busca"){ anHist.busca=t.value; const pos=t.selectionStart; anRenderHistorico(); const n=$("#an-h-busca"); if(n){ n.focus(); try{n.setSelectionRange(pos,pos);}catch(e){} } return; }
  if(!anAtual)return;
  if(t.dataset.anRel){ anAtual[t.dataset.anRel]=t.value; anGuardarRascunho(); return; }
  if(t.dataset.anCampo){ const it=anAtual.itens.find(x=>x.uid===t.dataset.uid); if(it){ it[t.dataset.anCampo]=t.value; anGuardarRascunho(); } }
});
$("#painel-an").addEventListener("change",ev=>{
  const t=ev.target;
  if(t.id==="an-f-local"){ anFiltro.local=t.value; anRenderPainel(); return; }
  if(t.id==="an-f-resp"){ anFiltro.resp=t.value; anRenderPainel(); return; }
  if(t.id==="an-h-local"){ anHist.local=t.value; anRenderHistorico(); return; }
  if(t.dataset.anCampo==="prazo")anRender();   /* atualiza o selo do prazo */
});

/* ─────────── ligações com o resto do app ─────────── */
if(typeof PAINEIS!=="undefined"&&!PAINEIS.includes("an"))PAINEIS.push("an");
const _abaAN=aba;
aba=function(qual){ _abaAN(qual); if(qual==="an")anRender(); };
$("#t-an").onclick=()=>{ anMostrar(anVista==="previa"?anVoltar:anVista); anCarregar().then(()=>{ if(!$("#painel-an").hidden&&anVista!=="previa"&&anVista!=="apontamento")anRender(); }); };
const _abrirAppAN=abrirApp;
abrirApp=async function(){ const r=await _abrirAppAN.apply(this,arguments); anCarregar().then(()=>{ if(!$("#painel-an").hidden&&anVista!=="previa"&&anVista!=="apontamento")anRender(); }); return r; };

if(new URLSearchParams(location.search).get("aba")==="an")anMostrar("apontamento");
if(conectado())anCarregar();
