/* ══════════════════════════════════════════════════════════════════════════
   Antes e Depois
   Registro rápido, fora da vistoria: a foto do problema agora, a foto do
   depois quando estiver resolvido. Sai em relatório deitado (A4 paisagem),
   um registro por folha, e como imagem pronta para o WhatsApp.

   Este arquivo roda num <script> próprio, depois do principal: um erro aqui
   não derruba o login nem o resto do app. Todos os nomes começam com "ad"
   para não colidir com os outros scripts.
   ══════════════════════════════════════════════════════════════════════════ */

const AD_RASC="sakuma-ad-rascunho", AD_CACHE="sakuma-ad-lista", AD_NOME="sakuma-ad-nome";
let adRegs=[], adCarregou=false, adOffline=false, adAtual=null, adSalvando=false;
let adFiltro={sit:"todos",busca:"",unidade:"",vista:"grade"};   /* vista: "grade" (cartões) ou "historico" (tabela) */
const AD_POR_INDICE=8;
let adPreviaRegs=[], adPreviaGaleria=false, adVoltarPara="lista";
const adDados=new Map();   /* caminho no bucket → foto em data URL (para imprimir e montar a imagem) */

/* ─────────── utilidades ─────────── */
function adHoje(){ const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
function adData(iso){ return iso?String(iso).slice(0,10).split("-").reverse().join("/"):""; }
function adNl(t){ return esc(t).replace(/\n/g,"<br>"); }
function adTemDepois(r){ return !!(r&&(r._depoisSrc||r.foto_depois)); }
function adTemAntes(r){ return !!(r&&(r._antesSrc||r.foto_antes)); }
function adNomePadrao(){ try{ return localStorage.getItem(AD_NOME)||""; }catch(e){ return ""; } }
function adSituacao(r){ return adTemDepois(r)?"Concluído":"Aguardando o depois"; }
/* Mais fotos (19/10/2026, pedido dele): além da foto principal de cada lado,
   quantas quiser. Na base ficam em `fotos_mais` (lista de {lado, caminho});
   as recém-tiradas ficam em `_mais` ({lado, src}) até salvar. */
function adMais(r,lado){ return [...((r&&r.fotos_mais)||[]).filter(f=>f.lado===lado).map(f=>({caminho:f.caminho})), ...((r&&r._mais)||[]).filter(f=>f.lado===lado).map(f=>({src:f.src}))]; }
function adMaisTotal(r){ return ((r&&r.fotos_mais)||[]).length+((r&&r._mais)||[]).length; }
async function adMaisSrcDados(r,lado){
  const out=[];
  for(const f of adMais(r,lado)){ if(f.src){ out.push(f.src); continue; } const d=await adSrcDadosCaminho(f.caminho); if(d)out.push(d); }
  return out;
}
async function adSrcDadosCaminho(cam){
  if(!cam)return "";
  if(adDados.has(cam))return adDados.get(cam);
  const url=await urlDaFoto(cam); if(!url)return "";
  try{
    const b=await (await fetch(url)).blob();
    const d=await new Promise((ok,erro)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=erro;fr.readAsDataURL(b);});
    adDados.set(cam,d); return d;
  }catch(e){ return url; }
}

/* foto do registro: a recém-tirada (data URL) ou a da base (URL assinada) */
async function adSrc(r,lado){
  const novo=r["_"+lado+"Src"]; if(novo)return novo;
  const cam=r["foto_"+lado]; if(!cam)return "";
  return await urlDaFoto(cam);
}
/* a mesma foto em data URL — o canvas e a impressão não dependem da rede depois disso */
async function adSrcDados(r,lado){
  const novo=r["_"+lado+"Src"]; if(novo)return novo;
  const cam=r["foto_"+lado]; if(!cam)return "";
  if(adDados.has(cam))return adDados.get(cam);
  const url=await urlDaFoto(cam); if(!url)return "";
  try{
    const b=await (await fetch(url)).blob();
    const d=await new Promise((ok,erro)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=erro;fr.readAsDataURL(b);});
    adDados.set(cam,d); return d;
  }catch(e){ return url; }
}

function adGuardarRascunho(){
  if(!adAtual)return;
  adAtual._sujo=true;
  try{ localStorage.setItem(AD_RASC,JSON.stringify(adAtual)); }
  catch(e){ toast("O aparelho está sem espaço para guardar o rascunho com as fotos."); }
}
function adLerRascunho(){ try{ const t=localStorage.getItem(AD_RASC); return t?JSON.parse(t):null; }catch(e){ return null; } }
function adApagarRascunho(){ try{ localStorage.removeItem(AD_RASC); }catch(e){} }

/* ─────────── base ─────────── */
async function adCarregar(){
  if(!conectado()){
    adOffline=true;
    try{ adRegs=JSON.parse(localStorage.getItem(AD_CACHE)||"[]"); }catch(e){ adRegs=[]; }
    adCarregou=true; adContador(); return;
  }
  try{
    const d=await rest("antes_depois?select=*&order=data_antes.desc.nullslast,criado_em.desc");
    adRegs=d||[]; adOffline=false; adCarregou=true;
    try{ localStorage.setItem(AD_CACHE,JSON.stringify(adRegs)); }catch(e){}
  }catch(e){
    adOffline=true; adCarregou=true;
    try{ adRegs=JSON.parse(localStorage.getItem(AD_CACHE)||"[]"); }catch(x){ adRegs=[]; }
    if(!/sem-sessao/.test(String(e.message))&&!/Failed to fetch|NetworkError|Load failed/i.test(String(e.message)))
      console.warn("antes e depois:",e);
  }
  adContador();
}

function adContador(){
  const n=adRegs.filter(r=>!adTemDepois(r)).length;
  const c=$("#cont-ad"); if(c){ c.textContent=String(n); c.hidden=!n; }
  const m=$("#mi-ad"); if(m){ m.textContent=n?String(n):""; m.hidden=!n; }
}

async function adProximoCodigo(){
  try{
    const d=await rest("antes_depois?select=codigo&codigo=like.AD-*");
    const maior=(d||[]).reduce((m,x)=>{const k=/^AD-(\d+)$/.exec(x.codigo||"");return k?Math.max(m,+k[1]):m;},0);
    return "AD-"+String(maior+1).padStart(3,"0");
  }catch(e){ return ""; }
}

async function adSalvar(){
  if(adSalvando||!adAtual)return;
  const r=adAtual;
  if(!String(r.titulo||"").trim()){ toast("Dê um título ao registro (ex.: Lixeira com tampa quebrada)."); const t=$("[data-ad='titulo']"); if(t)t.focus(); return; }
  if(!adTemAntes(r)){ toast("Tire a foto do antes para salvar."); return; }
  if(!conectado()){ adGuardarRascunho(); toast("Sem conexão com a base: ficou guardado no aparelho. Salve de novo quando a rede voltar."); return; }
  adSalvando=true;
  const bt=$("#ad-salvar"); const rot=bt?bt.innerHTML:""; if(bt){bt.disabled=true;bt.textContent="Salvando…";}
  try{
    const carimbo=Date.now();
    if(r._antesSrc){ r.foto_antes=await enviarFoto(`${r.id}/antes-${carimbo}.jpg`,r._antesSrc); adDados.set(r.foto_antes,r._antesSrc); }
    if(r._depoisSrc){ r.foto_depois=await enviarFoto(`${r.id}/depois-${carimbo}.jpg`,r._depoisSrc); adDados.set(r.foto_depois,r._depoisSrc); }
    /* mais fotos: sobe as novas, tira da lista as apagadas */
    r.fotos_mais=(r.fotos_mais||[]).filter(f=>!(r._maisApagar||[]).includes(f.caminho));
    const novas=r._mais||[];
    for(let k=0;k<novas.length;k++){
      const f=novas[k];
      const cam=await enviarFoto(`${r.id}/mais-${f.lado}-${carimbo}-${k+1}.jpg`,f.src);
      adDados.set(cam,f.src); r.fotos_mais.push({lado:f.lado,caminho:cam});
    }
    r._mais=[];
    for(const cam of (r._maisApagar||[])){
      try{ if(typeof window.apagarFoto==="function")await window.apagarFoto(cam);
           else{ const h=await comToken(); await fetch(`${cfg.url}/storage/v1/object/${encodeURI("vistorias/"+cam)}`,{method:"DELETE",headers:h}); } }catch(e){}
    }
    r._maisApagar=[];
    if(r.autor_nome){ try{ localStorage.setItem(AD_NOME,r.autor_nome); }catch(e){} }
    const corpo={
      titulo:String(r.titulo).trim(), unidade:r.unidade||null, local:r.local||null, descricao:r.descricao||null,
      responsavel:r.responsavel||null, autor:r.autor_nome||r.autor||(sessao&&sessao.email)||null,
      data_antes:r.data_antes||null, foto_antes:r.foto_antes||null,
      data_depois:adTemDepois(r)?(r.data_depois||adHoje()):null, foto_depois:r.foto_depois||null, obs_depois:r.obs_depois||null,
      fotos_mais:r.fotos_mais||[]
    };
    let salvo;
    if(r._novo){
      corpo.id=r.id; corpo.codigo=r.codigo||await adProximoCodigo()||null;
      salvo=await rest("antes_depois",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(corpo)});
    }else{
      salvo=await rest(`antes_depois?id=eq.${encodeURIComponent(r.id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(corpo)});
    }
    let novo=(salvo&&salvo[0])||{...r,...corpo};
    if(novo&&!novo.fotos_mais)novo={...novo,fotos_mais:corpo.fotos_mais};
    if(!salvo||!salvo.length)throw new Error("A base não confirmou a gravação. Confira se você tem acesso a este registro.");
    adRegs=[novo,...adRegs.filter(x=>x.id!==novo.id)];
    try{ localStorage.setItem(AD_CACHE,JSON.stringify(adRegs)); }catch(e){}
    adApagarRascunho();
    adAtual=adCopia(novo);
    adContador();
    toast(adTemDepois(novo)?"Salvo. Antes e depois completo.":"Salvo. Quando resolver, abra o registro e tire a foto do depois.");
    adRenderForm();
  }catch(e){
    adGuardarRascunho();
    const m=String(e.message||e);
    toast(/Failed to fetch|NetworkError|Load failed/i.test(m)?"Sem rede: ficou guardado no aparelho. Salve de novo quando a rede voltar."
      :"Não deu para salvar: "+m.slice(0,110));
  }finally{
    adSalvando=false;
    const b=$("#ad-salvar"); if(b&&b.disabled){b.disabled=false;b.innerHTML=rot;}
  }
}

async function adApagar(){
  const r=adAtual; if(!r)return;
  if(r._novo){
    if(!confirm("Descartar este registro que ainda não foi salvo?"))return;
    adApagarRascunho(); adAtual=null; adMostrar("lista"); return;
  }
  if(!confirm(`Apagar "${r.titulo}" (${r.codigo||"sem número"})? As fotos saem da base e não dá para desfazer.`))return;
  try{
    const d=await rest(`antes_depois?id=eq.${encodeURIComponent(r.id)}`,{method:"DELETE",headers:{Prefer:"return=representation"}});
    if(!d||!d.length)throw new Error("Só quem lançou ou um administrador pode apagar.");
    for(const cam of [r.foto_antes,r.foto_depois,...(r.fotos_mais||[]).map(f=>f.caminho)].filter(Boolean)){
      try{ if(typeof window.apagarFoto==="function")await window.apagarFoto(cam);
           else{ const h=await comToken(); await fetch(`${cfg.url}/storage/v1/object/${encodeURI("vistorias/"+cam)}`,{method:"DELETE",headers:h}); } }catch(e){}
    }
    adRegs=adRegs.filter(x=>x.id!==r.id);
    try{ localStorage.setItem(AD_CACHE,JSON.stringify(adRegs)); }catch(e){}
    adApagarRascunho(); adAtual=null; adContador();
    toast("Registro apagado."); adMostrar("lista");
  }catch(e){ toast("Não deu para apagar: "+String(e.message).slice(0,110)); }
}

function adCopia(r){ const c=JSON.parse(JSON.stringify(r)); delete c._sujo; return c; }
function adNovo(){
  return {id:uuid(),_novo:true,codigo:"",titulo:"",unidade:"",local:"",descricao:"",responsavel:"",
    autor_nome:adNomePadrao(),data_antes:adHoje(),foto_antes:"",data_depois:"",foto_depois:"",obs_depois:"",fotos_mais:[],_mais:[]};
}

/* ─────────── telas ─────────── */
function adMostrar(qual){
  const L=$("#ad-lista"),F=$("#ad-form"),P=$("#ad-previa");
  L.hidden=qual!=="lista"; F.hidden=qual!=="form"; P.hidden=qual!=="previa";
  aba("ad");
  if(qual==="lista"){ adRenderLista(); if(!adCarregou||!adOffline)adCarregar().then(()=>{ if(!L.hidden)adRenderLista(); }); }
  if(qual==="form")adRenderForm();
}

function adUnidades(){
  return [...new Set(adRegs.map(r=>(r.unidade||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
}
function adFiltrados(){
  const b=adFiltro.busca.trim().toLowerCase();
  return adRegs.filter(r=>{
    /* o histórico mostra todos, abertos e fechados */
    if(adFiltro.vista!=="historico"&&adFiltro.sit==="aguardando"&&adTemDepois(r))return false;
    if(adFiltro.vista!=="historico"&&adFiltro.sit==="concluidos"&&!adTemDepois(r))return false;
    if(adFiltro.unidade&&(r.unidade||"").trim()!==adFiltro.unidade)return false;
    if(b&&![r.codigo,r.titulo,r.local,r.unidade,r.descricao,r.responsavel,r.autor].join(" ").toLowerCase().includes(b))return false;
    return true;
  });
}

function adRenderLista(){
  const alvo=$("#ad-lista"); if(!alvo)return;
  const rasc=adLerRascunho();
  const tot=adRegs.length, ag=adRegs.filter(r=>!adTemDepois(r)).length, ok=tot-ag;
  const unids=adUnidades();
  alvo.innerHTML=`
    <div class="secao-topo">
      <h2>Antes e Depois${adFiltro.vista==="historico"?" · Histórico":adFiltro.sit==="aguardando"?" · Em aberto":adFiltro.sit==="concluidos"?" · Fechados":""}</h2>
      <span class="dica">Foto do problema agora; a do depois quando estiver resolvido. Sai em folha deitada, pronta para mostrar à equipe e mandar no WhatsApp.</span>
      <button class="btn" type="button" data-ad-novo style="margin-left:auto">＋ Novo antes e depois</button>
    </div>
    ${rasc?`<div class="ck-andamento"><b>Registro não salvo neste aparelho: ${esc(rasc.titulo||"sem título")}${rasc.codigo?" · "+esc(rasc.codigo):""}</b>
      <button class="btn" type="button" data-ad-rascunho>Continuar</button></div>`:""}
    ${adOffline?`<p class="ad-aviso">Sem conexão com a base: mostrando o que estava guardado neste aparelho. Dá para registrar e gerar o relatório; para salvar, precisa de rede.</p>`:""}
    <div class="ad-filtros">
      <div class="ad-chips" role="group" aria-label="Situação">
        <button type="button" data-ad-sit="todos" aria-pressed="${adFiltro.vista!=="historico"&&adFiltro.sit==="todos"}">Todos <b>${tot}</b></button>
        <button type="button" data-ad-sit="aguardando" aria-pressed="${adFiltro.vista!=="historico"&&adFiltro.sit==="aguardando"}">Em aberto <b>${ag}</b></button>
        <button type="button" data-ad-sit="concluidos" aria-pressed="${adFiltro.vista!=="historico"&&adFiltro.sit==="concluidos"}">Fechados <b>${ok}</b></button>
        <button type="button" data-ad-vista="historico" aria-pressed="${adFiltro.vista==="historico"}">Histórico</button>
      </div>
      ${unids.length>1?`<select id="ad-f-unidade" aria-label="Unidade"><option value="">Todas as unidades</option>${unids.map(u=>`<option ${u===adFiltro.unidade?"selected":""}>${esc(u)}</option>`).join("")}</select>`:""}
      <input type="search" id="ad-f-busca" placeholder="Buscar título, local, número…" value="${esc(adFiltro.busca)}">
    </div>
    <div class="ad-galeria-bar" id="ad-galeria-bar"></div>
    <div class="ad-grade" id="ad-grade"></div>`;
  adRenderGrade();
}

function adRenderGrade(){
  const g=$("#ad-grade"), bar=$("#ad-galeria-bar"); if(!g)return;
  const lista=adFiltrados();
  if(bar)bar.innerHTML=lista.length?`<span>${lista.length} registro${lista.length>1?"s":""} na tela</span>
    <button class="bt bt-marrom" type="button" data-ad-galeria>Relatório da galeria</button>`:"";
  if(!adCarregou){ g.innerHTML=`<div class="vazio"><p>Carregando…</p></div>`; return; }
  if(adFiltro.vista==="historico"){ adRenderHistorico(g,lista); return; }
  if(!lista.length){
    g.innerHTML=`<div class="vazio"><p>${adRegs.length?"Nenhum registro com esse filtro.":"Nenhum antes e depois registrado ainda. Toque em <b>＋ Novo antes e depois</b> e tire a primeira foto."}</p></div>`;
    return;
  }
  g.innerHTML=lista.map(r=>{
    const dep=adTemDepois(r);
    return `<article class="ad-card${dep?" ok":""}">
      <button type="button" class="ad-par" data-ad-abrir="${esc(r.id)}" aria-label="Abrir ${esc(r.titulo)}">
        <figure><img alt="" data-ad-foto="${esc(r.foto_antes||"")}"><figcaption class="antes">Antes</figcaption></figure>
        <figure>${dep?`<img alt="" data-ad-foto="${esc(r.foto_depois||"")}">`:`<div class="ad-falta">Aguardando<br>o depois</div>`}<figcaption class="depois">Depois</figcaption></figure>
      </button>
      <div class="ad-info">
        <span class="ref">${esc([r.codigo,r.unidade].filter(Boolean).join(" · ")||"—")}</span>
        <h3>${esc(r.titulo)}</h3>
        <span class="info">${esc([r.local,adData(r.data_antes)+(dep&&r.data_depois?" → "+adData(r.data_depois):"")].filter(Boolean).join(" · "))}${adMaisTotal(r)?` · <b>+${adMaisTotal(r)} foto${adMaisTotal(r)>1?"s":""}</b>`:""}</span>
      </div>
      <div class="pe">
        ${dep?"":`<button class="bt bt-forte" type="button" data-ad-depois="${esc(r.id)}">📷 Tirar o depois</button>`}
        <button class="bt" type="button" data-ad-rel="${esc(r.id)}">Relatório</button>
      </div>
    </article>`;
  }).join("");
  adPreencherFotos(g);
}

/* Histórico (14/10/2026, pedido dele): todos os registros, abertos e fechados,
   numa tabela só — do mais novo para o mais antigo, com quanto tempo levou
   para fechar (ou há quanto tempo está aberto). */
function adDias(de,ate){
  if(!de)return null;
  const a=new Date(String(de).slice(0,10)+"T12:00:00"), b=ate?new Date(String(ate).slice(0,10)+"T12:00:00"):new Date();
  return Math.max(0,Math.round((b-a)/864e5));
}
function adRenderHistorico(g,lista){
  g.classList.add("ad-grade-hist");
  if(!lista.length){
    g.innerHTML=`<div class="vazio"><p>${adRegs.length?"Nenhum registro com esse filtro.":"Nenhum antes e depois registrado ainda."}</p></div>`;
    return;
  }
  const fech=lista.filter(adTemDepois), abertos=lista.length-fech.length;
  const tempos=fech.map(r=>adDias(r.data_antes,r.data_depois)).filter(n=>n!=null);
  const media=tempos.length?Math.round(tempos.reduce((a,b)=>a+b,0)/tempos.length):null;
  const ordem=[...lista].sort((a,b)=>String(b.data_antes||"").localeCompare(String(a.data_antes||""))||String(b.codigo||"").localeCompare(String(a.codigo||"")));
  g.innerHTML=`<p class="ad-hist-resumo"><b>${lista.length}</b> registro${lista.length>1?"s":""} ·
      <span class="ad-tag aberto">${abertos} em aberto</span> <span class="ad-tag ok">${fech.length} fechado${fech.length===1?"":"s"}</span>
      ${media!=null?` · tempo médio para fechar: <b>${media} dia${media===1?"":"s"}</b>`:""}</p>
    <div class="anp-rola"><table class="anp-tab ad-hist"><thead><tr>
      <th>Nº</th><th>O quê</th><th>Unidade · local</th><th class="ce">Antes</th><th class="ce">Depois</th><th class="ce">Situação</th><th></th>
    </tr></thead><tbody>${ordem.map(r=>{
      const ok=adTemDepois(r), d=ok?adDias(r.data_antes,r.data_depois):adDias(r.data_antes);
      return `<tr class="${ok?"ad-h-ok":"ad-h-aberto"}">
        <td class="ce">${esc(r.codigo||"—")}</td>
        <td><b>${esc(r.titulo||"Sem título")}</b>${r.responsavel?`<br><span class="anp-sem">Responsável: ${esc(r.responsavel)}</span>`:""}</td>
        <td>${esc([r.unidade,r.local].filter(Boolean).join(" · ")||"—")}</td>
        <td class="ce">${esc(adData(r.data_antes)||"—")}</td>
        <td class="ce">${ok?esc(adData(r.data_depois)||"—"):"—"}</td>
        <td class="ce">${ok?`<span class="ad-tag ok">Fechado${d!=null?` em ${d} d`:""}</span>`:`<span class="ad-tag aberto">Aberto${d!=null?` há ${d} d`:""}</span>`}</td>
        <td class="ce"><button type="button" class="anp-btn mini" data-ad-abrir="${esc(r.id)}">Abrir</button>${ok?"":` <button type="button" class="anp-btn mini" data-ad-depois="${esc(r.id)}">Tirar o depois</button>`}</td>
      </tr>`; }).join("")}</tbody></table></div>`;
}

async function adPreencherFotos(raiz){
  const imgs=[...raiz.querySelectorAll("img[data-ad-foto]")];
  await Promise.all(imgs.map(async im=>{
    const cam=im.dataset.adFoto; if(!cam){ im.replaceWith(Object.assign(document.createElement("div"),{className:"ad-falta",textContent:"Sem foto"})); return; }
    const u=adDados.get(cam)||await urlDaFoto(cam);
    if(u)im.src=u; else im.replaceWith(Object.assign(document.createElement("div"),{className:"ad-falta",textContent:"Foto indisponível sem rede"}));
  }));
}

function adRenderForm(){
  const alvo=$("#ad-form"); if(!alvo||!adAtual)return;
  const r=adAtual, dep=adTemDepois(r);
  const lado=(q,rot)=>`
    <div class="ad-lado ${q}">
      <div class="ad-lado-topo"><span class="ad-rot ${q}">${rot}</span>${q==="depois"&&!dep?`<span class="dica">quando estiver resolvido</span>`:""}</div>
      <button type="button" class="ad-foto" data-ad-tirar="${q}">
        ${adTemAntes(r)&&q==="antes"||dep&&q==="depois"?`<img alt="Foto do ${q}" data-ad-src="${q}"><span class="ad-trocar">Trocar foto</span>`
          :`<span class="ad-vazia"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Tirar foto do ${q}</span>`}
      </button>
      <div class="ad-mais">
        ${adMais(r,q).map((f,i)=>`<span class="ad-mini"><img alt="" ${f.src?`src="${esc(f.src)}"`:`data-ad-mini="${esc(f.caminho)}"`}><button type="button" class="ad-mini-x" data-ad-mais-tirar="${q}" data-ad-mais-i="${i}" aria-label="Tirar esta foto">×</button></span>`).join("")}
        <button type="button" class="ad-mais-bt" data-ad-mais="${q}">＋ Mais fotos</button>
      </div>
      <div class="campo"><label for="ad-d-${q}">Data do ${q}</label><input type="date" id="ad-d-${q}" data-ad="data_${q}" value="${esc(r["data_"+q]||"")}"></div>
      ${q==="depois"?`<div class="campo"><label for="ad-obs">O que foi feito</label><textarea id="ad-obs" data-ad="obs_depois" placeholder="Ex.: tampa trocada e lixeira lavada">${esc(r.obs_depois||"")}</textarea></div>`:""}
    </div>`;
  alvo.innerHTML=`
    <div class="secao-topo">
      <button class="bt bt-fantasma" type="button" data-ad-voltar>← Galeria</button>
      <h2>${r._novo?"Novo antes e depois":esc(r.codigo||"Antes e depois")}</h2>
      <span class="ad-selo ${dep?"ok":""}">${adSituacao(r)}</span>
      ${r._novo?"":`<span class="dica">${esc(r.autor?"Registrado por "+r.autor:"")}</span>`}
    </div>
    <div class="cartao"><div class="grade">
      <div class="campo largo"><label for="ad-titulo">O que é *</label><input type="text" id="ad-titulo" data-ad="titulo" value="${esc(r.titulo)}" placeholder="Ex.: Lixeira com tampa quebrada"></div>
      <div class="campo"><label for="ad-unidade">Unidade / propriedade</label><input type="text" id="ad-unidade" data-ad="unidade" list="ad-unidades" value="${esc(r.unidade)}" placeholder="Fazenda Morro Branco"></div>
      <div class="campo"><label for="ad-local">Local</label><input type="text" id="ad-local" data-ad="local" value="${esc(r.local)}" placeholder="Barracão de insumos"></div>
      <div class="campo"><label for="ad-resp">Responsável pela correção</label><input type="text" id="ad-resp" data-ad="responsavel" value="${esc(r.responsavel)}" placeholder="Quem vai resolver"></div>
      ${r._novo?`<div class="campo"><label for="ad-autor">Registrado por</label><input type="text" id="ad-autor" data-ad="autor_nome" value="${esc(r.autor_nome||"")}" placeholder="Seu nome"></div>`:""}
      <div class="campo largo"><label for="ad-desc">Situação encontrada</label><textarea id="ad-desc" data-ad="descricao" placeholder="Ex.: tampa quebrada, lixo exposto à chuva e a animais">${esc(r.descricao||"")}</textarea></div>
    </div></div>
    <datalist id="ad-unidades">${adUnidades().map(u=>`<option value="${esc(u)}">`).join("")}</datalist>
    <div class="ad-fotos">${lado("antes","Antes")}${lado("depois","Depois")}</div>
    <div class="ad-acoes">
      <button class="btn" type="button" id="ad-salvar">Salvar</button>
      <button class="btn secundario" type="button" data-ad-rel-atual>Relatório</button>
      <button class="bt" type="button" data-ad-zap-atual>Enviar imagem</button>
      <button class="bt bt-fantasma bt-perigo" type="button" data-ad-apagar style="margin-left:auto">${r._novo?"Descartar":"Apagar"}</button>
    </div>`;
  ["antes","depois"].forEach(async q=>{
    const im=alvo.querySelector(`img[data-ad-src="${q}"]`); if(!im)return;
    const u=await adSrc(r,q); if(u)im.src=u; else im.replaceWith(Object.assign(document.createElement("span"),{className:"ad-vazia",textContent:"Foto indisponível sem rede"}));
  });
  alvo.querySelectorAll("img[data-ad-mini]").forEach(async im=>{
    const cam=im.dataset.adMini; const u=adDados.get(cam)||await urlDaFoto(cam);
    if(u)im.src=u; else im.alt="sem rede";
  });
}

/* mais fotos: aceita várias de uma vez */
function adMaisFotos(q){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*"; inp.multiple=true;
  inp.onchange=()=>{
    const fs=[...(inp.files||[])]; if(!fs.length||!adAtual)return;
    let n=0;
    const prox=()=>{
      const f=fs.shift();
      if(!f){ adGuardarRascunho(); adRenderForm(); toast(`${n} foto${n>1?"s":""} do ${q} adicionada${n>1?"s":""}. Salve para registrar.`); return; }
      comprimir(f,url=>{ if(adAtual){ (adAtual._mais=adAtual._mais||[]).push({lado:q,src:url}); n++; } prox(); });
    };
    prox();
  };
  inp.click();
}
function adMaisTirar(q,i){
  const r=adAtual; if(!r)return;
  const lista=adMais(r,q), f=lista[i]; if(!f)return;
  if(f.caminho){ r.fotos_mais=(r.fotos_mais||[]).filter(x=>x.caminho!==f.caminho); (r._maisApagar=r._maisApagar||[]).push(f.caminho); }
  else{ const k=(r._mais||[]).findIndex(x=>x.lado===q&&x.src===f.src); if(k>=0)r._mais.splice(k,1); }
  adGuardarRascunho(); adRenderForm();
}

function adAbrir(id){
  const r=adRegs.find(x=>x.id===id); if(!r)return;
  const rasc=adLerRascunho();
  adAtual=(rasc&&rasc.id===id)?rasc:adCopia(r);
  adMostrar("form");
}

function adTirarFoto(q){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
  inp.onchange=()=>{
    const f=inp.files&&inp.files[0]; if(!f)return;
    comprimir(f,url=>{
      if(!adAtual)return;
      adAtual["_"+q+"Src"]=url;
      if(!adAtual["data_"+q])adAtual["data_"+q]=adHoje();
      adGuardarRascunho(); adRenderForm();
      toast(q==="antes"?"Foto do antes pronta. Preencha o título e salve.":"Foto do depois pronta. Salve para registrar.");
    });
  };
  inp.click();
}

/* ─────────── relatório (A4 deitada, um registro por folha) ─────────── */
function adFolha(r,fA,fD,n,total,tag){
  const dep=!!fD;
  const foto=(src,q,data)=>`<figure class="adr-fig ${q}">
      <figcaption><b>${q==="antes"?"ANTES":"DEPOIS"}</b><span>${esc(adData(data))}</span></figcaption>
      <div class="adr-img">${src?`<img src="${esc(src)}" alt="">`:`<div class="adr-sem">${q==="depois"?"Aguardando a foto do depois":"Sem foto"}</div>`}</div>
    </figure>`;
  const linhas=[["Unidade",r.unidade],["Local",r.local],["Responsável pela correção",r.responsavel],["Registrado por",r.autor||r.autor_nome]].filter(x=>x[1]);
  return `<section class="adr-folha">
    <header class="adr-cab">
      <div><h1>${esc(r.titulo||"Antes e depois")}</h1>
        <p>${esc(["Antes e Depois",r.codigo,adSituacao(r)].filter(Boolean).join(" · "))}</p></div>
      <img src="${LOGO}" alt="SAKUMA Agronegócios">
    </header>
    <div class="adr-par">${foto(fA,"antes",r.data_antes)}${foto(fD,"depois",dep?r.data_depois:"")}</div>
    <div class="adr-texto">
      ${r.descricao?`<div><b>Situação encontrada</b><p>${adNl(r.descricao)}</p></div>`:""}
      ${r.obs_depois?`<div><b>O que foi feito</b><p>${adNl(r.obs_depois)}</p></div>`:""}
      ${linhas.length?`<div class="adr-dados">${linhas.map(([k,v])=>`<span>${esc(k)}: <b>${esc(v)}</b></span>`).join("")}</div>`:""}
    </div>
    <footer class="adr-rod"><span>SAKUMA Agronegócios · ${esc(tag)} · Folha ${n} de ${total}</span>${typeof docLop==="function"?docLop():""}</footer>
  </section>`;
}

/* folha extra: as fotos a mais de um registro (até 6 por folha, 3 colunas) */
const AD_MAIS_POR_FOLHA=6;
function adFolhaMais(r,fotos,n,total,tag,parte,nPartes){
  return `<section class="adr-folha">
    <header class="adr-cab">
      <div><h1>${esc(r.titulo||"Antes e depois")} · mais fotos${nPartes>1?` (${parte} de ${nPartes})`:""}</h1>
        <p>${esc(["Antes e Depois",r.codigo,adSituacao(r)].filter(Boolean).join(" · "))}</p></div>
      <img src="${LOGO}" alt="SAKUMA Agronegócios">
    </header>
    <div class="adr-mais-grade">${fotos.map(f=>`<figure class="adr-fig ${f.lado}">
      <figcaption><b>${f.lado==="antes"?"ANTES":"DEPOIS"}</b><span>${esc(adData(f.lado==="antes"?r.data_antes:r.data_depois))}</span></figcaption>
      <div class="adr-img"><img src="${esc(f.src)}" alt=""></div></figure>`).join("")}</div>
    <footer class="adr-rod"><span>SAKUMA Agronegócios · ${esc(tag)} · Folha ${n} de ${total}</span>${typeof docLop==="function"?docLop():""}</footer>
  </section>`;
}

function adCapa(regs,fotos,total,pag,nPags,ini,folhaDe){
  const ok=regs.filter(adTemDepois).length;
  const unids=[...new Set(regs.map(r=>r.unidade).filter(Boolean))];
  const datas=regs.map(r=>r.data_antes).filter(Boolean).sort();
  const periodo=datas.length?(datas[0]===datas[datas.length-1]?adData(datas[0]):adData(datas[0])+" a "+adData(datas[datas.length-1])):"—";
  const parte=regs.slice(ini,ini+AD_POR_INDICE);
  return `<section class="adr-folha adr-capa">
    <header class="adr-cab"><div><h1>Galeria Antes e Depois${pag>1?" · índice (continuação)":""}</h1><p>${esc(unids.length?unids.join(" · "):"Todas as unidades")}</p></div><img src="${LOGO}" alt="SAKUMA Agronegócios"></header>
    ${pag>1?"":`<div class="adr-kpis">
      <div><b>${regs.length}</b><span>registro${regs.length===1?"":"s"}</span></div>
      <div class="ok"><b>${ok}</b><span>resolvido${ok===1?"":"s"}</span></div>
      <div class="ag"><b>${regs.length-ok}</b><span>aguardando o depois</span></div>
      <div><b>${esc(periodo)}</b><span>período</span></div>
    </div>`}
    <table class="adr-ind"><thead><tr><th>Nº</th><th>Antes</th><th>Depois</th><th>O que é</th><th>Local</th><th>Data do antes</th><th>Data do depois</th><th>Folha</th></tr></thead><tbody>
    ${parte.map((r,j)=>{const i=ini+j; return `<tr><td>${esc(r.codigo||String(i+1))}</td>
      <td><div class="adr-mini">${fotos[i][0]?`<img src="${esc(fotos[i][0])}" alt="">`:""}</div></td>
      <td><div class="adr-mini">${fotos[i][1]?`<img src="${esc(fotos[i][1])}" alt="">`:"—"}</div></td>
      <td><b>${esc(r.titulo)}</b></td><td>${esc([r.unidade,r.local].filter(Boolean).join(" · "))||"—"}</td>
      <td>${esc(adData(r.data_antes))||"—"}</td><td>${adTemDepois(r)?esc(adData(r.data_depois)):"aguardando"}</td><td>${folhaDe?folhaDe[i]:nPags+i+1}</td></tr>`;}).join("")}
    </tbody></table>
    <footer class="adr-rod"><span>SAKUMA Agronegócios · Galeria Antes e Depois · emitida em ${esc(adData(adHoje()))} · Folha ${pag} de ${total}</span>${typeof docLop==="function"?docLop():""}</footer>
  </section>`;
}

async function adMontarDoc(regs,galeria){
  const fotos=await Promise.all(regs.map(async r=>[await adSrcDados(r,"antes"),adTemDepois(r)?await adSrcDados(r,"depois"):""]));
  /* as fotos a mais de cada registro, em folhas de até 6 */
  const mais=await Promise.all(regs.map(async r=>{
    const a=(await adMaisSrcDados(r,"antes")).map(src=>({lado:"antes",src}));
    const d=adTemDepois(r)?(await adMaisSrcDados(r,"depois")).map(src=>({lado:"depois",src})):[];
    const todas=[...a,...d], folhas=[];
    for(let i=0;i<todas.length;i+=AD_MAIS_POR_FOLHA)folhas.push(todas.slice(i,i+AD_MAIS_POR_FOLHA));
    return folhas;
  }));
  const nPags=galeria?Math.ceil(regs.length/AD_POR_INDICE):0;
  const total=regs.length+nPags+mais.reduce((s,f)=>s+f.length,0);
  const tag="Galeria Antes e Depois";
  let html="";
  const folhaDe=[]; { let f=nPags; regs.forEach((r,i)=>{ folhaDe.push(++f); f+=mais[i].length; }); }
  for(let p=0;p<nPags;p++)html+=adCapa(regs,fotos,total,p+1,nPags,p*AD_POR_INDICE,folhaDe);
  let n=nPags;
  regs.forEach((r,i)=>{
    const t=galeria?tag:(r.codigo||"Antes e Depois");
    html+=adFolha(r,fotos[i][0],fotos[i][1],++n,total,t);
    mais[i].forEach((f,k)=>{ html+=adFolhaMais(r,f,++n,total,t,k+1,mais[i].length); });
  });
  return `<div class="adr-doc">${html}</div>`;
}

async function adPrevia(regs,galeria,voltar){
  if(!regs.length){ toast("Nenhum registro para o relatório."); return; }
  adPreviaRegs=regs; adPreviaGaleria=galeria; adVoltarPara=voltar||"lista";
  const P=$("#ad-previa");
  P.innerHTML=`<div class="secao-topo ad-previa-topo">
      <button class="bt bt-fantasma" type="button" data-ad-previa-voltar>← Voltar</button>
      <h2>${galeria?`Relatório da galeria · ${regs.length} registro${regs.length>1?"s":""}`:"Relatório do antes e depois"}</h2>
      <div class="ad-previa-bts">
        <button class="btn" type="button" data-ad-imprimir>Imprimir / PDF</button>
        <button class="btn secundario" type="button" data-ad-zap>Enviar no WhatsApp</button>
      </div>
    </div>
    <p class="dica ad-previa-dica">Folha A4 deitada. Para mandar em PDF: Imprimir → Salvar como PDF → compartilhar. "Enviar no WhatsApp" manda ${galeria?"uma imagem por registro":"a imagem desta folha"}, que abre direto na conversa.</p>
    <div class="ad-previa-palco" id="ad-previa-palco"><div class="vazio"><p>Montando o relatório…</p></div></div>`;
  $("#ad-lista").hidden=true; $("#ad-form").hidden=true; P.hidden=false; aba("ad");
  const doc=await adMontarDoc(regs,galeria);
  const palco=$("#ad-previa-palco"); if(!palco)return;
  palco.innerHTML=doc; adAjustarZoom();
}
function adAjustarZoom(){
  const palco=$("#ad-previa-palco"), d=palco&&palco.querySelector(".adr-doc"); if(!d)return;
  const larg=palco.clientWidth||900, base=1123; /* 297 mm em px */
  d.style.zoom=String(Math.min(1,larg/base));
}
window.addEventListener("resize",()=>{ if(!$("#ad-previa").hidden)adAjustarZoom(); });

async function adImprimir(){
  const palco=$("#ad-previa-palco"), doc=palco&&palco.querySelector(".adr-doc");
  if(!doc){ toast("O relatório ainda está sendo montado."); return; }
  const alvo=$("#ad-imprimir");
  alvo.innerHTML=doc.outerHTML;
  const d=alvo.querySelector(".adr-doc"); if(d)d.style.zoom="";
  await Promise.all([...alvo.querySelectorAll("img")].map(i=>i.decode?i.decode().catch(()=>{}):null));
  let st=document.getElementById("ad-pagina");
  if(!st){ st=document.createElement("style"); st.id="ad-pagina"; }
  st.textContent="@media print{@page{size:A4 landscape;margin:0 10mm}}";
  document.head.appendChild(st);   /* por último: vence o @page do relatório comum */
  document.body.classList.add("ad-imprimindo");
  const limpar=()=>{ document.body.classList.remove("ad-imprimindo"); st.remove(); alvo.innerHTML=""; window.removeEventListener("afterprint",limpar); };
  window.addEventListener("afterprint",limpar);
  setTimeout(()=>{ try{ window.print(); }catch(e){ toast("A impressão foi bloqueada aqui."); limpar(); } },150);
}

/* ─────────── imagem para o WhatsApp ─────────── */
function adCarregarImg(src){
  return new Promise(ok=>{ if(!src)return ok(null); const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>ok(null); i.src=src; });
}
function adQuebrar(ctx,txt,larg,max){
  const pal=String(txt||"").replace(/\s+/g," ").trim().split(" "); const linhas=[]; let l="";
  for(const p of pal){ const t=l?l+" "+p:p; if(ctx.measureText(t).width>larg&&l){ linhas.push(l); l=p; if(linhas.length===max)break; } else l=t; }
  if(linhas.length<max&&l)linhas.push(l);
  if(linhas.length===max&&pal.join(" ")!==linhas.join(" ")){ let u=linhas[max-1]; while(u&&ctx.measureText(u+"…").width>larg)u=u.slice(0,-1); linhas[max-1]=u+"…"; }
  return linhas;
}
async function adImagem(r){
  const W=2000,H=1414, M=64, F="Arial, Helvetica, sans-serif";
  const c=document.createElement("canvas"); c.width=W; c.height=H;
  const x=c.getContext("2d");
  x.fillStyle="#FFFFFF"; x.fillRect(0,0,W,H);
  const [iA,iD,iLogo,iLop]=await Promise.all([adCarregarImg(await adSrcDados(r,"antes")),
    adTemDepois(r)?adCarregarImg(await adSrcDados(r,"depois")):null, adCarregarImg(LOGO),
    adCarregarImg(typeof lopMarca==="function"?lopMarca():"")]);
  /* cabeçalho */
  if(iLogo){ const h=96, w=iLogo.width*h/iLogo.height; x.drawImage(iLogo,W-M-w,M-6,w,h); }
  x.fillStyle="#51534A"; x.font=`bold 56px ${F}`; x.textBaseline="top";
  adQuebrar(x,r.titulo||"Antes e depois",W-2*M-360,1).forEach(t=>x.fillText(t,M,M));
  x.fillStyle="#744F28"; x.font=`28px ${F}`;
  x.fillText([r.codigo,r.unidade,r.local].filter(Boolean).join("  ·  ")||"Antes e Depois",M,M+70);
  x.fillStyle="#84BD00"; x.fillRect(M,M+118,W-2*M,6);
  /* as duas fotos */
  const topo=M+150, gap=40, bw=(W-2*M-gap)/2, bh=H-topo-210;
  [[iA,"ANTES",r.data_antes,"#744F28"],[iD,"DEPOIS",adTemDepois(r)?r.data_depois:"","#84BD00"]].forEach(([im,rot,data,cor],k)=>{
    const bx=M+k*(bw+gap), by=topo;
    x.fillStyle="#F4F5EE"; x.fillRect(bx,by,bw,bh);
    if(im){ const f=Math.min(bw/im.width,bh/im.height), w=im.width*f, h=im.height*f; x.drawImage(im,bx+(bw-w)/2,by+(bh-h)/2,w,h); }
    else{ x.fillStyle="#8A8C83"; x.font=`34px ${F}`; x.textAlign="center"; x.fillText(rot==="DEPOIS"?"Aguardando a foto do depois":"Sem foto",bx+bw/2,by+bh/2-17); x.textAlign="left"; }
    x.font=`bold 34px ${F}`; const tw=x.measureText(rot).width;
    x.font=`28px ${F}`; const dw=data?x.measureText(adData(data)).width+24:0;
    x.fillStyle=cor; x.fillRect(bx,by,tw+dw+48,62);
    x.fillStyle="#FFFFFF"; x.font=`bold 34px ${F}`; x.fillText(rot,bx+24,by+14);
    if(data){ x.font=`28px ${F}`; x.fillText(adData(data),bx+24+tw+24,by+18); }
  });
  /* rodapé: o que foi feito e quem */
  const py=topo+bh+26;
  x.fillStyle="#51534A"; x.font=`26px ${F}`;
  const txt=[r.descricao?"Encontrado: "+r.descricao:"", r.obs_depois?"Feito: "+r.obs_depois:""].filter(Boolean).join("   ·   ");
  adQuebrar(x,txt||(r.responsavel?"Responsável pela correção: "+r.responsavel:""),W-2*M-420,2).forEach((t,i)=>x.fillText(t,M,py+i*36));
  x.fillStyle="#8A8C83"; x.font=`22px ${F}`;
  x.fillText(["SAKUMA Agronegócios",r.responsavel&&txt?"Resp.: "+r.responsavel:"",r.autor||r.autor_nome?"Registrado por "+(r.autor||r.autor_nome):""].filter(Boolean).join("  ·  "),M,H-M-6);
  if(iLop){ const h=64, w=iLop.width*h/iLop.height; x.globalCompositeOperation="multiply"; x.drawImage(iLop,W-M-w,H-M-h+8,w,h); x.globalCompositeOperation="source-over"; }
  return await new Promise(ok=>c.toBlob(ok,"image/jpeg",0.88));
}

async function adEnviarImagens(regs,bt){
  if(!regs.length)return;
  const rot=bt?bt.innerHTML:""; if(bt){bt.disabled=true;bt.textContent="Gerando…";}
  try{
    const arqs=[];
    for(const r of regs){
      const b=await adImagem(r);
      const nome=`${(r.codigo||"antes-depois").replace(/[^\w-]+/g,"")}-${String(r.titulo||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^\w]+/g,"-").replace(/^-|-$/g,"").slice(0,40).toLowerCase()}.jpg`;
      arqs.push(new File([b],nome,{type:"image/jpeg"}));
    }
    if(navigator.canShare&&navigator.canShare({files:arqs})){
      try{ await navigator.share({files:arqs,title:"Antes e Depois"}); return; }
      catch(e){ if(e&&e.name==="AbortError")return; }
    }
    arqs.forEach((f,i)=>setTimeout(()=>{
      const u=URL.createObjectURL(f), a=document.createElement("a");
      a.href=u; a.download=f.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(u),4000);
    },i*400));
    toast(arqs.length>1?`${arqs.length} imagens baixadas. Anexe no WhatsApp.`:"Imagem baixada. Anexe no WhatsApp.");
  }catch(e){ toast("Não deu para gerar a imagem: "+String(e.message||e).slice(0,90)); }
  finally{ if(bt){bt.disabled=false;bt.innerHTML=rot;} }
}

/* ─────────── eventos ─────────── */
$("#painel-ad").addEventListener("click",ev=>{
  const t=ev.target, q=s=>t.closest(s);
  let el;
  if(q("[data-ad-novo]")){ adAtual=adNovo(); adMostrar("form"); return; }
  if(q("[data-ad-rascunho]")){ adAtual=adLerRascunho(); if(adAtual)adMostrar("form"); return; }
  if(el=q("[data-ad-sit]")){ adFiltro.sit=el.dataset.adSit; adFiltro.vista="grade"; adRenderLista(); return; }
  if(el=q("[data-ad-vista]")){ adFiltro.vista=el.dataset.adVista; adRenderLista(); return; }
  if(q("[data-ad-galeria]")){ adPrevia(adFiltrados(),true,"lista"); return; }
  if(el=q("[data-ad-depois]")){ adAbrir(el.dataset.adDepois); adTirarFoto("depois"); return; }
  if(el=q("[data-ad-rel]")){ const r=adRegs.find(x=>x.id===el.dataset.adRel); if(r)adPrevia([r],false,"lista"); return; }
  if(el=q("[data-ad-abrir]")){ adAbrir(el.dataset.adAbrir); return; }
  if(q("[data-ad-voltar]")){ adMostrar("lista"); return; }
  if(el=q("[data-ad-mais-tirar]")){ adMaisTirar(el.dataset.adMaisTirar,+el.dataset.adMaisI); return; }
  if(el=q("[data-ad-mais]")){ adMaisFotos(el.dataset.adMais); return; }
  if(el=q("[data-ad-tirar]")){ adTirarFoto(el.dataset.adTirar); return; }
  if(q("#ad-salvar")){ adSalvar(); return; }
  if(q("[data-ad-apagar]")){ adApagar(); return; }
  if(q("[data-ad-rel-atual]")){
    if(!adTemAntes(adAtual)){ toast("Tire a foto do antes primeiro."); return; }
    adPrevia([adAtual],false,"form"); return;
  }
  if(el=q("[data-ad-zap-atual]")){
    if(!adTemAntes(adAtual)){ toast("Tire a foto do antes primeiro."); return; }
    adEnviarImagens([adAtual],el); return;
  }
  if(q("[data-ad-previa-voltar]")){ adMostrar(adVoltarPara==="form"&&adAtual?"form":"lista"); return; }
  if(q("[data-ad-imprimir]")){ adImprimir(); return; }
  if(el=q("[data-ad-zap]")){ adEnviarImagens(adPreviaRegs,el); return; }
});
$("#painel-ad").addEventListener("input",ev=>{
  const t=ev.target;
  if(t.id==="ad-f-busca"){ adFiltro.busca=t.value; adRenderGrade(); return; }
  if(t.dataset&&t.dataset.ad&&adAtual){ adAtual[t.dataset.ad]=t.value; adGuardarRascunho(); }
});
$("#painel-ad").addEventListener("change",ev=>{
  const t=ev.target;
  if(t.id==="ad-f-unidade"){ adFiltro.unidade=t.value; adRenderGrade(); }
  if(t.dataset&&t.dataset.ad==="data_depois"&&adAtual)adRenderForm();
});

/* ─────────── ligações com o resto do app ─────────── */
if(typeof PAINEIS!=="undefined"&&!PAINEIS.includes("ad"))PAINEIS.push("ad");
const _abaAD=aba;
aba=function(qual){
  _abaAD(qual);
  if(qual==="ad"&&!$("#ad-lista").hidden)adRenderLista();
};
$("#t-ad").onclick=()=>adMostrar($("#ad-previa").hidden&&!$("#ad-form").hidden&&adAtual?"form":"lista");
const _abrirAppAD=abrirApp;
abrirApp=async function(){ const r=await _abrirAppAD.apply(this,arguments); adCarregar().then(()=>{ if(!$("#painel-ad").hidden&&!$("#ad-lista").hidden)adRenderLista(); }); return r; };

if(new URLSearchParams(location.search).get("aba")==="ad")adMostrar("lista");
if(conectado())adCarregar();
