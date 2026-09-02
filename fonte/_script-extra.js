
/* ══════════════════════════════════════════════════════════════════════════
   Base de dados, contas e pendências
   Sem SDK: só fetch contra a API REST do Supabase. Assim o app continua
   sendo um arquivo só, funciona offline e não depende de CDN nenhum.
   ══════════════════════════════════════════════════════════════════════════ */

/* Base da SAKUMA, gravada no próprio app: o técnico não configura nada,
   só entra com e-mail e senha. A chave anon é pública por definição —
   quem protege os dados é a segurança por linha do supabase.sql. */
const BASE = (window.SAKUMA_BASE && window.SAKUMA_BASE.key)
  ? window.SAKUMA_BASE
  : {url:"https://jhwnmtekxsdkhvgcjzhj.supabase.co", key:"__CHAVE_ANON__"};

const K_SESSAO="sakuma-sessao", K_HIST="sakuma-historico";
let cfg=BASE, sessao=null, pendencias=[], fonteRemota=false;

function lerJSON(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}}
function gravarJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}

function uuid(){
  if(crypto.randomUUID)return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{
    const r=crypto.getRandomValues(new Uint8Array(1))[0]%16;
    return (c==="x"?r:(r&0x3|0x8)).toString(16);
  });
}

/* ─────────────── sessão ─────────────── */
async function autenticar(email,senha){
  const r=await fetch(`${cfg.url}/auth/v1/token?grant_type=password`,{
    method:"POST",
    headers:{"apikey":cfg.key,"Content-Type":"application/json"},
    body:JSON.stringify({email,password:senha})
  });
  const d=await r.json();
  if(!r.ok)throw new Error(d.error_description||d.msg||d.message||"Não foi possível entrar.");
  sessao={token:d.access_token,refresh:d.refresh_token,expira:Date.now()+(d.expires_in-60)*1000,
          email:(d.user&&d.user.email)||email,uid:d.user&&d.user.id};
  gravarJSON(K_SESSAO,sessao);
  return sessao;
}

async function renovar(){
  if(!sessao||!sessao.refresh)return false;
  let r;
  try{
    r=await fetch(`${cfg.url}/auth/v1/token?grant_type=refresh_token`,{
      method:"POST",
      headers:{"apikey":cfg.key,"Content-Type":"application/json"},
      body:JSON.stringify({refresh_token:sessao.refresh})
    });
  }catch(e){ return false; }   // sem rede: mantém a sessão, o app segue offline
  if(!r.ok){
    // 400/401 = token de renovação inválido: a sessão acabou de verdade.
    // Qualquer outro caso (rede fora) mantém a sessão e o app segue offline.
    if(r.status===400||r.status===401){
      sessao=null;localStorage.removeItem(K_SESSAO);atualizarConta();
      if(typeof mostrarPortao==="function")mostrarPortao();
    }
    return false;
  }
  const d=await r.json();
  sessao={...sessao,token:d.access_token,refresh:d.refresh_token,expira:Date.now()+(d.expires_in-60)*1000};
  gravarJSON(K_SESSAO,sessao);
  return true;
}

const baseConfigurada=()=>!!(cfg&&cfg.url&&cfg.key&&!cfg.key.startsWith("__")&&!/^COLE_AQUI/i.test(cfg.key));
const conectado=()=>!!(baseConfigurada()&&sessao&&sessao.token);

async function comToken(){
  if(!conectado())throw new Error("sem-sessao");
  if(Date.now()>sessao.expira&&!await renovar())throw new Error("sem-sessao");
  return {"apikey":cfg.key,"Authorization":"Bearer "+sessao.token};
}

/* ─────────────── REST ─────────────── */
async function rest(caminho,opts={}){
  const h=await comToken();
  const r=await fetch(`${cfg.url}/rest/v1/${caminho}`,{
    ...opts,
    headers:{...h,"Content-Type":"application/json",...(opts.headers||{})}
  });
  const txt=await r.text();
  if(!r.ok)throw new Error(txt||("Erro "+r.status));
  return txt?JSON.parse(txt):null;
}

/* ─────────────── Storage ─────────────── */
function dataUrlParaBlob(u){
  const [cab,b64]=u.split(",");
  const tipo=(cab.match(/:(.*?);/)||[,"image/jpeg"])[1];
  const bin=atob(b64);
  const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:tipo});
}

async function enviarFoto(caminho,dataUrl){
  const h=await comToken();
  const r=await fetch(`${cfg.url}/storage/v1/object/${encodeURI("vistorias/"+caminho)}`,{
    method:"POST",
    headers:{...h,"x-upsert":"true","Content-Type":"image/jpeg"},
    body:dataUrlParaBlob(dataUrl)
  });
  if(!r.ok)throw new Error("Falha ao enviar a foto: "+(await r.text()));
  return caminho;
}

const cacheAssinado=new Map();
async function urlDaFoto(caminho){
  if(!caminho)return "";
  const agora=Date.now();
  const guardado=cacheAssinado.get(caminho);
  if(guardado&&guardado.ate>agora)return guardado.url;
  try{
    const h=await comToken();
    const r=await fetch(`${cfg.url}/storage/v1/object/sign/${encodeURI("vistorias/"+caminho)}`,{
      method:"POST",headers:{...h,"Content-Type":"application/json"},
      body:JSON.stringify({expiresIn:3600})
    });
    if(!r.ok)return "";
    const d=await r.json();
    const url=cfg.url+"/storage/v1"+d.signedURL;
    cacheAssinado.set(caminho,{url,ate:agora+3300*1000});
    return url;
  }catch(e){return "";}
}

/* ═══════════════════════ regras de prazo ═══════════════════════
   Editáveis na aba Configurações e compartilhadas por toda a equipe. */

const REGRAS_PADRAO={
  dias:{"Crítico":1,"Alto":7,"Médio":30,"Baixo":90},
  atencao:3,
  anomalias:{},     // chave da anomalia -> { grau?, dias? }
  cargos:["Gerente Administrativo","Diretor","Coordenador","Encarregado","Responsável Técnico"]
};
const K_REGRAS="sakuma-regras", K_BIBLIO="sakuma-biblioteca", K_ADMINS="sakuma-admins";
let regras=JSON.parse(JSON.stringify(REGRAS_PADRAO));

/* Biblioteca: o app nasce com as normas e anomalias embutidas; a equipe pode
   criar novas e alterar as existentes. O que vem da base entra por cima. */
const NORMAS_BASE=JSON.parse(JSON.stringify(NORMAS));
const ANOMALIAS_BASE=JSON.parse(JSON.stringify(ANOMALIAS));
let normasCustom={}, anomaliasCustom={}, administradores=[], souAdmin=false;

function aplicarBiblioteca(){
  Object.keys(NORMAS).forEach(k=>{ if(!NORMAS_BASE[k]&&!normasCustom[k])delete NORMAS[k]; });
  Object.keys(ANOMALIAS).forEach(k=>{ if(!ANOMALIAS_BASE[k]&&!anomaliasCustom[k])delete ANOMALIAS[k]; });
  Object.assign(NORMAS,NORMAS_BASE,normasCustom);
  Object.assign(ANOMALIAS,ANOMALIAS_BASE,anomaliasCustom);
}
const anomaliaVisivel=k=>!(ANOMALIAS[k]&&ANOMALIAS[k].oculta);

/* texto congelado: o que o apontamento citava no dia em que foi salvo */
function congelarNormas(chaves){
  return (chaves||[]).map(k=>{
    const n=NORMAS[k]; if(!n)return null;
    return {k,ref:n.ref,item:n.item,ok:n.ok,txt:n.txt};
  }).filter(Boolean);
}
function normasDoItem(it){
  if(it&&Array.isArray(it.normasTexto)&&it.normasTexto.length)return it.normasTexto;
  return congelarNormas(it&&it.normas);
}

const grauDe=(chave,padrao)=>(regras.anomalias[chave]&&regras.anomalias[chave].grau)||padrao;
function diasDe(chave,grau){
  const e=regras.anomalias[chave];
  if(e&&Number.isFinite(e.dias)&&e.dias>=0)return e.dias;
  const d=regras.dias[grau];
  return Number.isFinite(d)?d:30;
}
function rotuloPrazo(dias){
  if(dias<=0)return "Imediato";
  if(dias===1)return "Imediato (24 h)";
  return dias+" dias";
}
/* mantém GRAUS coerente com as regras, para o resto do app que já o consulta */
function aplicarRegras(){
  Object.keys(GRAUS).forEach(g=>{
    GRAUS[g].dias=Number.isFinite(regras.dias[g])?regras.dias[g]:GRAUS[g].dias;
    GRAUS[g].prazo=rotuloPrazo(GRAUS[g].dias);
  });
  preencherCargos();
}

/* ───────────── cargos de quem aprova ─────────────
   A lista mora nas regras, então é a mesma para toda a equipe. O campo começa
   vazio de propósito: quem aprova muda de vistoria para vistoria. */
function listaCargos(){
  const c=Array.isArray(regras.cargos)?regras.cargos:REGRAS_PADRAO.cargos;
  return c.map(x=>String(x||"").trim()).filter(Boolean);
}

function preencherCargos(){
  const sel=$("#f-aprovador-cargo");
  if(!sel)return;
  const atual=estado.cab.aprovadorCargo||"";
  const opcoes=listaCargos();
  /* um cargo gravado numa vistoria antiga continua aparecendo mesmo que a
     equipe já tenha tirado ele da lista — senão o campo mentiria */
  if(atual&&opcoes.indexOf(atual)<0)opcoes.push(atual);
  sel.innerHTML='<option value="">— escolher —</option>'+
    opcoes.map(c=>`<option value="${esc(c)}"${c===atual?" selected":""}>${esc(c)}</option>`).join("");
  sel.value=atual;
}

function calcularPrazoData(dataVistoria,grau,chave){
  const dias=diasDe(chave,grau);
  let base;
  if(dataVistoria){
    const [A,M,D]=String(dataVistoria).slice(0,10).split("-").map(Number);
    if(!A||!M||!D)return null;
    base=new Date(A,M-1,D);
  }else{
    base=new Date();base.setHours(0,0,0,0);
  }
  base.setDate(base.getDate()+dias);
  const p2=n=>String(n).padStart(2,"0");
  return `${base.getFullYear()}-${p2(base.getMonth()+1)}-${p2(base.getDate())}`;
}

function situacaoPrazo(p){
  if(p.status==="Concluído")return{cls:"p-feito",txt:"Concluído"};
  if(!p.prazoData)return{cls:"p-semprazo",txt:"Sem prazo"};
  /* dois meia-noites locais: assim "vence hoje" é hoje mesmo, sem meio dia de erro */
  const hoje=new Date();hoje.setHours(0,0,0,0);
  const [A,M,D]=String(p.prazoData).slice(0,10).split("-").map(Number);
  if(!A||!M||!D)return{cls:"p-semprazo",txt:"Sem prazo"};
  const venc=new Date(A,M-1,D);
  const dias=Math.round((venc-hoje)/86400000);
  const janela=Number.isFinite(regras.atencao)?regras.atencao:3;
  if(dias<0)return{cls:"p-vencido",txt:`Vencido há ${Math.abs(dias)} d`};
  if(dias<=janela)return{cls:"p-breve",txt:dias===0?"Vence hoje":`Vence em ${dias} d`};
  return{cls:"p-noprazo",txt:`${dias} d restantes`};
}

/* ─────────────── miniatura para o histórico local ─────────────── */
function miniatura(dataUrl){
  return new Promise(res=>{
    if(!dataUrl)return res("");
    const img=new Image();
    img.onload=()=>{
      const max=240;let{width:w,height:h}=img;
      const f=max/Math.max(w,h);
      if(f<1){w=Math.round(w*f);h=Math.round(h*f);}
      const c=document.createElement("canvas");c.width=w;c.height=h;
      c.getContext("2d").drawImage(img,0,0,w,h);
      res(c.toDataURL("image/jpeg",0.6));
    };
    img.onerror=()=>res("");
    img.src=dataUrl;
  });
}

/* ══════════════════════════ exportar a vistoria ══════════════════════════
   Sem internet, "Salvar" não sobe nada. Exportar resolve isso: gera um arquivo
   HTML fechado em si mesmo — relatório completo, fotos embutidas, abre em
   qualquer navegador sem app e sem rede. No celular vai direto para o
   WhatsApp ou o e-mail pelo compartilhamento do sistema. */

function nomeDoArquivo(){
  const c=estado.cab;
  const pedaco=t=>String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")   .replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,28);
  const partes=[pedaco(c.codigo)||"vistoria",pedaco(c.unidade),(c.data||"").slice(0,10)];
  return partes.filter(Boolean).join("_")+".html";
}

function montarArquivo(){
  renderDoc();
  const estilo=Array.from(document.querySelectorAll("style")).map(s=>s.textContent).join("\n");
  const c=estado.cab;
  const titulo=`${c.codigo||"Vistoria"} — ${c.unidade||"SAKUMA"}`;
  /* Os dados crus vão junto, num bloco que o navegador ignora. Serve de
     comprovante do que foi registrado e permite reimportar mais adiante. */
  const dados=JSON.stringify({versao:1,exportadoEm:new Date().toISOString(),cab:c,itens:estado.itens})
    .replace(/</g,"\\u003c");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<style>${estilo}
body{background:#fff;padding:0;margin:0}
.doc{max-width:820px;margin:0 auto;padding:28px 22px}
.aviso-exp{max-width:820px;margin:16px auto 0;padding:10px 14px;border:1px solid var(--linha,#DDD);border-radius:10px;font:13px/1.5 system-ui,sans-serif;color:#6b6f63}
@media print{.aviso-exp{display:none}}
</style>
</head>
<body>
<div class="aviso-exp">Relatório exportado do app SAKUMA Vistorias &amp; Segurança em ${new Date().toLocaleString("pt-BR")}. Para gerar o PDF, use Imprimir do navegador.</div>
<div class="doc">${$("#doc").innerHTML}</div>
<script type="application/json" id="sakuma-dados">${dados}<\/script>
</body>
</html>`;
}

async function exportarVistoria(){
  if(!estado.itens.length){toast("Adicione ao menos uma não conformidade antes de exportar.");return;}
  const bt=$("#bt-exportar");
  bt.disabled=true;const rotulo=bt.textContent;bt.textContent="Gerando…";
  try{
    const html=montarArquivo();
    const nome=nomeDoArquivo();
    const arquivo=new File([html],nome,{type:"text/html"});
    /* no celular o compartilhamento do sistema é o caminho natural */
    if(navigator.canShare&&navigator.canShare({files:[arquivo]})){
      try{
        await navigator.share({files:[arquivo],title:nome});
        toast("Relatório enviado.");
        return;
      }catch(e){
        if(e&&e.name==="AbortError")return;   /* a pessoa cancelou: não é erro */
      }
    }
    const url=URL.createObjectURL(new Blob([html],{type:"text/html"}));
    const a=document.createElement("a");
    a.href=url;a.download=nome;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    toast("Arquivo gerado: "+nome);
  }catch(e){
    toast("Não deu para exportar: "+String(e.message).slice(0,90));
  }finally{
    bt.disabled=false;bt.textContent=rotulo;
  }
}
$("#bt-exportar").onclick=exportarVistoria;

/* ─────────────── número da vistoria ───────────────
   Sequência contínua VIST-001, VIST-002… lida da base no momento de salvar.
   Códigos digitados à mão que não seguem o padrão são simplesmente ignorados
   na contagem, então numeração antiga e manual convivem sem estragar nada. */
async function codigoDaBase(){
  try{
    const d=await rest("vistorias?select=codigo&limit=2000");
    let maior=0;
    (d||[]).forEach(v=>{
      const m=/^VIST-(\d+)$/i.exec(String(v.codigo||"").trim());
      if(m){const n=Number(m[1]);if(n>maior)maior=n;}
    });
    return "VIST-"+String(maior+1).padStart(3,"0");
  }catch(e){
    return "";   /* sem base agora: fica em branco e ganha número no próximo salvamento */
  }
}

/* ══════════════════════════ salvar a vistoria ══════════════════════════ */
async function salvarVistoria(){
  if(!estado.itens.length){toast("Adicione ao menos uma não conformidade antes de salvar.");return;}
  if(!estado.cab.unidade){toast("Informe a unidade antes de salvar.");$("#f-unidade").focus();return;}
  if(!estado.id)estado.id=uuid();
  estado.itens.forEach(it=>{
    if(!it.uid)it.uid=uuid();
    it.prazoData=it.prazoData||calcularPrazoData(estado.cab.data,it.grau,it.chave);
    if(!it.status)it.status="Aberto";
    if(!Array.isArray(it.normasTexto)||!it.normasTexto.length)it.normasTexto=congelarNormas(it.normas);
  });

  await salvarLocal();

  if(!conectado()){
    salvar();
    toast("Vistoria salva neste aparelho. Entre na base para compartilhar com a equipe.");
    await carregarPendencias();
    return;
  }

  const bt=$("#bt-salvar");bt.disabled=true;bt.textContent="Salvando…";
  try{
    /* Número da vistoria: quem manda é a base, e só na hora de salvar. Assim
       dois técnicos preenchendo offline não brigam pelo mesmo código. Se o
       campo já tem algo digitado, respeita — o número é sugestão, não trava. */
    if(!String(estado.cab.codigo||"").trim()){
      estado.cab.codigo=await codigoDaBase();
      preencherCabecalho();
    }
    const c=estado.cab;
    await rest("vistorias",{
      method:"POST",
      headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify([{id:estado.id,codigo:c.codigo||"",unidade:c.unidade,setor:c.setor,
        data:c.data||null,tecnico:c.tecnico,cargo:c.cargo,motivo:c.motivo,
        aprovador:c.aprovador,aprovador_cargo:c.aprovadorCargo}])
    });

    for(const it of estado.itens){
      if(it.fotoE&&it.fotoE.startsWith("data:"))
        it.fotoEPath=await enviarFoto(`${estado.id}/${it.uid}-encontrada.jpg`,it.fotoE);
      if(it.fotoR&&it.fotoR.startsWith("data:"))
        it.fotoRPath=await enviarFoto(`${estado.id}/${it.uid}-requerida.jpg`,it.fotoR);
    }

    await rest("itens",{
      method:"POST",
      headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify(estado.itens.map((it,i)=>({
        id:it.uid,vistoria_id:estado.id,ordem:i+1,chave:it.chave,categoria:it.cat,
        titulo:it.titulo,local:it.local,encontrada:it.encontrada,risco:it.risco,grau:it.grau,
        normas:it.normas,normas_texto:it.normasTexto||[],
        requerida:it.requerida,acao:it.acao,prazo:it.prazo,prazo_data:it.prazoData,
        responsavel:it.responsavel,evidencia:it.evidencia,pendencias:it.pendencias,
        status:it.status||"Aberto",
        foto_encontrada:it.fotoEPath||null,foto_requerida:it.fotoRPath||null
      })))
    });

    estado.salvoEm=new Date().toISOString();
    salvar();
    toast("Vistoria salva na base.");
    await carregarPendencias();
  }catch(e){
    toast(e.message==="sem-sessao"?"A sessão expirou. Entre de novo."
      :"Salvo neste aparelho, mas a base recusou: "+String(e.message).slice(0,120));
  }finally{
    bt.disabled=false;bt.textContent="Salvar vistoria";
  }
}

async function salvarLocal(){
  const hist=lerJSON(K_HIST)||[];
  const itens=[];
  for(const it of estado.itens){
    itens.push({
      uid:it.uid,chave:it.chave,cat:it.cat,titulo:it.titulo,local:it.local,grau:it.grau,
      encontrada:it.encontrada,risco:it.risco,requerida:it.requerida,
      acao:it.acao,evidencia:it.evidencia,pendenciasTxt:it.pendencias,
      responsavel:it.responsavel,prazo:it.prazo,prazoData:it.prazoData,
      normas:it.normas,normasTexto:it.normasTexto||[],status:it.status||"Aberto",
      encerradoEm:it.encerradoEm||"",encerradoObs:it.encerradoObs||"",
      miniE:await miniatura(it.fotoE),miniR:await miniatura(it.fotoR)
    });
  }
  const reg={id:estado.id,cab:{...estado.cab},itens,salvoEm:new Date().toISOString()};
  const i=hist.findIndex(v=>v.id===estado.id);
  if(i>=0)hist[i]=reg;else hist.unshift(reg);
  while(hist.length>60)hist.pop();
  if(!gravarJSON(K_HIST,hist)){
    hist.forEach(v=>v.itens.forEach(it=>{it.miniE="";it.miniR="";}));
    gravarJSON(K_HIST,hist);
  }
}

/* ══════════════════════════ regras: base e aparelho ══════════════════════════ */
async function carregarRegras(){
  const local=lerJSON(K_REGRAS);
  if(local)regras={...REGRAS_PADRAO,...local,dias:{...REGRAS_PADRAO.dias,...(local.dias||{})},anomalias:local.anomalias||{}};
  const bib=lerJSON(K_BIBLIO);
  if(bib){normasCustom=bib.normas||{};anomaliasCustom=bib.anomalias||{};}
  administradores=lerJSON(K_ADMINS)||[];

  if(conectado()){
    try{
      const d=await rest("configuracoes?select=regras,normas,anomalias&id=eq.1");
      const c=(d&&d[0])||{};
      const r=c.regras;
      if(r&&Object.keys(r).length){
        regras={...REGRAS_PADRAO,...r,dias:{...REGRAS_PADRAO.dias,...(r.dias||{})},anomalias:r.anomalias||{}};
        gravarJSON(K_REGRAS,regras);
      }
      normasCustom=c.normas||{};
      anomaliasCustom=c.anomalias||{};
      gravarJSON(K_BIBLIO,{normas:normasCustom,anomalias:anomaliasCustom});

      const ad=await rest("administradores?select=email,nome&order=email.asc");
      administradores=ad||[];
      gravarJSON(K_ADMINS,administradores);
      $("#cfg-origem").textContent="Valem para toda a equipe — guardadas na base.";
    }catch(e){
      $("#cfg-origem").textContent="Mostrando as regras deste aparelho: a base não respondeu.";
    }
  }else{
    $("#cfg-origem").textContent="Regras deste aparelho. Entre na base para compartilhar com a equipe.";
  }

  const meu=((sessao&&sessao.email)||"").toLowerCase();
  souAdmin = !conectado() || administradores.length===0 ||
             administradores.some(a=>String(a.email||"").toLowerCase()===meu);

  aplicarBiblioteca();
  aplicarRegras();
}

async function salvarRegras(){
  const bt=$("#cfg-salvar"), aviso=$("#cfg-salvo");
  aviso.textContent="";
  gravarJSON(K_REGRAS,regras);
  gravarJSON(K_BIBLIO,{normas:normasCustom,anomalias:anomaliasCustom});
  aplicarBiblioteca();
  aplicarRegras();
  if(!souAdmin){
    aviso.textContent="Só administradores alteram as regras.";
    return;
  }
  if(!conectado()){
    aviso.textContent="Salvo neste aparelho.";
    renderConfig();renderAberto();return;
  }
  bt.disabled=true;bt.textContent="Salvando…";
  try{
    await rest("configuracoes?id=eq.1",{
      method:"PATCH",headers:{"Prefer":"return=minimal"},
      body:JSON.stringify({regras,normas:normasCustom,anomalias:anomaliasCustom,atualizado_por:sessao.uid||null})
    });
    aviso.textContent="Salvo. Vale para toda a equipe.";
  }catch(e){
    aviso.textContent="Salvo aqui, mas a base recusou: "+String(e.message).slice(0,80);
  }finally{
    bt.disabled=false;bt.textContent="Salvar regras";
    renderConfig();renderAberto();
  }
}

/* ══════════════════════════ pendências ══════════════════════════ */
async function carregarPendencias(){
  if(conectado()){
    try{
      const d=await rest("pendencias?select=*&order=prazo_data.asc.nullslast&limit=500");
      pendencias=d.map(p=>({
        uid:p.id,vistoriaId:p.vistoria_id,chave:p.chave,cat:p.categoria,
        titulo:p.titulo,local:p.local,grau:p.grau,status:p.status,
        encontrada:p.encontrada,risco:p.risco,requerida:p.requerida,
        acao:p.acao,evidencia:p.evidencia,pendenciasTxt:p.pendencias,
        responsavel:p.responsavel,prazo:p.prazo,prazoData:p.prazo_data,
        normas:p.normas||[],normasTexto:p.normas_texto||[],codigo:p.vistoria_codigo,unidade:p.unidade,setor:p.setor,
        data:p.vistoria_data,tecnico:p.tecnico,
        fotoEPath:p.foto_encontrada,fotoRPath:p.foto_requerida,fotoCPath:p.foto_encerramento,
        encerradoEm:p.encerrado_em,encerradoObs:p.encerrado_obs,remoto:true
      }));
      fonteRemota=true;
      $("#fonte-dados").textContent="Apontamentos de todas as vistorias da base, de toda a equipe.";
      renderAberto();
      return;
    }catch(e){
      if(e.message!=="sem-sessao")toast("Não deu para ler a base agora. Mostrando o que está neste aparelho.");
    }
  }
  const hist=lerJSON(K_HIST)||[];
  pendencias=hist.flatMap(v=>v.itens.map(it=>({
    ...it,vistoriaId:v.id,codigo:v.cab.codigo,unidade:v.cab.unidade,setor:v.cab.setor,
    data:v.cab.data,tecnico:v.cab.tecnico,remoto:false
  })));
  fonteRemota=false;
  $("#fonte-dados").textContent="Apontamentos das vistorias salvas neste aparelho.";
  renderAberto();
}

function pendenciasFiltradas(){
  const b=($("#fl-busca").value||"").toLowerCase().trim();
  const u=$("#fl-unidade").value, g=$("#fl-grau").value, s=$("#fl-status").value;
  return pendencias.filter(p=>{
    if(s==="abertos"){if(p.status==="Concluído")return false;}
    else if(s&&p.status!==s)return false;
    if(u&&p.unidade!==u)return false;
    if(g&&p.grau!==g)return false;
    if(b){
      const alvo=[p.titulo,p.acao,p.responsavel,p.local,p.codigo,p.setor].join(" ").toLowerCase();
      if(!alvo.includes(b))return false;
    }
    return true;
  });
}

function renderAberto(){
  const uni=[...new Set(pendencias.map(p=>p.unidade).filter(Boolean))].sort();
  const sel=$("#fl-unidade"), atual=sel.value;
  sel.innerHTML='<option value="">Todas</option>'+uni.map(u=>`<option${u===atual?" selected":""}>${esc(u)}</option>`).join("");

  const abertos=pendencias.filter(p=>p.status!=="Concluído");
  const vencidos=abertos.filter(p=>situacaoPrazo(p).cls==="p-vencido");
  const criticos=abertos.filter(p=>p.grau==="Crítico");
  const limite=new Date();limite.setDate(limite.getDate()-30);
  const feitos=pendencias.filter(p=>p.status==="Concluído"&&(!p.encerradoEm||new Date(p.encerradoEm)>=limite));

  $("#cont-aberto").textContent=abertos.length;
  $("#kpis-aberto").innerHTML=`
    <div class="kpi k-total"><div class="v">${abertos.length}</div><div class="r">Em aberto</div></div>
    <div class="kpi k-critico"><div class="v">${vencidos.length}</div><div class="r">Vencidos</div></div>
    <div class="kpi k-alto"><div class="v">${criticos.length}</div><div class="r">Críticos abertos</div></div>
    <div class="kpi k-baixo"><div class="v">${feitos.length}</div><div class="r">Encerrados · 30 d</div></div>`;

  const lista=pendenciasFiltradas();
  const alvo=$("#lista-aberto");
  if(!lista.length){
    alvo.innerHTML=`<div class="vazio"><p>${pendencias.length?"Nenhum apontamento com esses filtros.":"Nenhuma vistoria salva ainda. Registre as não conformidades na aba Vistoria e clique em Salvar vistoria."}</p></div>`;
    return;
  }

  const ordem={"Crítico":0,"Alto":1,"Médio":2,"Baixo":3};
  const grupos=new Map();
  lista.forEach(p=>{
    const chave=`${p.unidade||"Sem unidade"}${p.setor?" · "+p.setor:""}`;
    if(!grupos.has(chave))grupos.set(chave,[]);
    grupos.get(chave).push(p);
  });

  alvo.innerHTML=[...grupos.entries()].map(([nome,itens])=>{
    itens.sort((a,b)=>(ordem[a.grau]??9)-(ordem[b.grau]??9)||String(a.prazoData||"z").localeCompare(String(b.prazoData||"z")));
    return `<div class="grupo-titulo"><h3>${esc(nome)}</h3><span class="n">${itens.length} apontamento${itens.length>1?"s":""}</span></div>
      <div class="lista-pend">${itens.map(cartaoPendencia).join("")}</div>`;
  }).join("");

  if(fonteRemota)alvo.querySelectorAll("[data-foto-path]").forEach(async img=>{
    const u=await urlDaFoto(img.dataset.fotoPath);
    if(u)img.src=u;else img.remove();
  });
}

const refsNorma=it=>[...new Set(normasDoItem(it).map(n=>n.ref).filter(Boolean))].join(" · ");

function cartaoPendencia(p){
  const g=GRAUS[p.grau]||GRAUS["Médio"];
  const sp=situacaoPrazo(p);
  const feito=p.status==="Concluído";
  const fotos=[[p.miniE,p.fotoEPath,"Situação encontrada"],[p.miniR,p.fotoRPath,"Situação requerida"]]
    .filter(([m,c])=>m||c)
    .map(([m,c,alt])=>m
      ? `<img src="${m}" alt="${alt}" data-lupa="${m}">`
      : `<img alt="${alt}" data-foto-path="${esc(c)}" data-lupa-remota="1">`).join("");

  return `<article class="pend g-${g.cls}${feito?" feito":""}" data-pend="${esc(p.uid)}">
    <div class="pend-topo">
      <button class="tit" type="button" data-abrir="${esc(p.uid)}">${esc(p.titulo)}</button>
      <span class="selo s-${g.cls}">${esc(p.grau)}</span>
      <span class="prazo ${sp.cls}">${sp.txt}</span>
    </div>
    <div class="pend-meta">
      <span class="cod">${esc(p.codigo||"—")}</span>
      ${p.local?`<span>📍 ${esc(p.local)}</span>`:""}
      ${p.data?`<span>Vistoria de ${dataBR(p.data)}</span>`:""}
      ${p.responsavel?`<span>Responsável: ${esc(p.responsavel)}</span>`:""}
      ${refsNorma(p)?`<span>${esc(refsNorma(p))}</span>`:""}
    </div>
    <div class="pend-acao">${esc(p.acao)||"—"}</div>
    ${fotos?`<div class="pend-fotos">${fotos}</div>`:""}
    <div class="pend-pe">
      <select data-status="${esc(p.uid)}">
        ${["Aberto","Em andamento","Concluído"].map(s=>`<option${s===p.status?" selected":""}>${s}</option>`).join("")}
      </select>
      <button class="bt" type="button" data-abrir="${esc(p.uid)}">Abrir ficha</button>
      ${feito
        ? `<span class="dica">${p.encerradoEm?"Encerrado em "+dataBR(String(p.encerradoEm).slice(0,10)):"Encerrado"}${p.encerradoObs?" — "+esc(p.encerradoObs):""}</span>`
        : `<button class="bt" type="button" data-encerrar="${esc(p.uid)}">Encerrar com evidência</button>`}
    </div>
    <div class="encerrar" data-form="${esc(p.uid)}" hidden>
      <div class="campo"><label>Foto da evidência de encerramento</label>
        <div class="foto requerida" data-ev="${esc(p.uid)}" tabindex="0" role="button">
          <span class="tag">Evidência</span>
          <span class="icone">▤</span><span class="ajuda">Clique, arraste ou cole a foto que comprova a correção</span>
        </div>
      </div>
      <div class="campo"><label>Observação</label>
        <textarea data-obs="${esc(p.uid)}" placeholder="O que foi feito, por quem e quando"></textarea></div>
      <div class="rodape-item">
        <button class="bt bt-fantasma" type="button" data-cancelar="${esc(p.uid)}">Cancelar</button>
        <button class="bt bt-forte" type="button" data-confirmar-enc="${esc(p.uid)}">Confirmar encerramento</button>
      </div>
    </div>
  </article>`;
}

/* ─────────────── mudar status / encerrar ─────────────── */
const evidencias={};

async function gravarStatus(uid,status,obs,fotoEv){
  const p=pendencias.find(x=>x.uid===uid);
  if(!p)return;
  p.status=status;
  if(status==="Concluído"){p.encerradoEm=new Date().toISOString();p.encerradoObs=obs||"";}
  else{p.encerradoEm=null;p.encerradoObs="";}

  if(conectado()&&p.remoto){
    try{
      let caminho=null;
      if(fotoEv)caminho=await enviarFoto(`${p.vistoriaId}/${uid}-encerramento.jpg`,fotoEv);
      await rest(`itens?id=eq.${uid}`,{
        method:"PATCH",headers:{"Prefer":"return=minimal"},
        body:JSON.stringify({status,encerrado_em:p.encerradoEm,encerrado_obs:p.encerradoObs,
          ...(caminho?{foto_encerramento:caminho}:{})})
      });
    }catch(e){
      toast("Status mudou aqui, mas a base recusou: "+String(e.message).slice(0,100));
    }
  }

  const hist=lerJSON(K_HIST)||[];
  hist.forEach(v=>v.itens.forEach(it=>{
    if(it.uid===uid){it.status=status;it.encerradoEm=p.encerradoEm;it.encerradoObs=p.encerradoObs;}
  }));
  gravarJSON(K_HIST,hist);

  const local=estado.itens.find(it=>it.uid===uid);
  if(local){local.status=status;local.encerradoEm=p.encerradoEm;local.encerradoObs=p.encerradoObs;salvar();}

  renderAberto();
  if(typeof fichaAtual==="object"&&fichaAtual&&fichaAtual.uid===uid&&$("#dlg-item").open)abrirFicha(uid);
}

/* ══════════════════════════ conta ══════════════════════════ */
function atualizarConta(){
  const bt=$("#bt-conta"), sinc=$("#sinc");
  if(conectado()){
    bt.className="conta on";
    bt.innerHTML=`<span class="bola">${esc((sessao.email||"?")[0].toUpperCase())}</span><b>${esc(sessao.email)}</b>`;
    sinc.className="sinc on";sinc.textContent="base conectada";
  }else{
    bt.className="conta off";
    bt.innerHTML=`<span class="bola">—</span><b>Entrar</b>`;
    sinc.className="sinc off";sinc.textContent="só neste aparelho";
  }
}

function abrirConta(){
  const d=$("#dlg-conta"), erro=$("#dlg-erro");
  erro.hidden=true;
  if(!baseConfigurada()){
    erro.textContent="Este app ainda não recebeu a chave da base. Avise o administrador.";
    erro.hidden=false;
  }
  $("#bloco-login").hidden=conectado();
  $("#bloco-logado").hidden=!conectado();
  $("#bt-sair").hidden=!conectado();
  $("#bt-confirmar").hidden=conectado();
  $("#dlg-titulo").textContent=conectado()?"Sua conta":"Entrar";
  if(conectado())$("#lg-quem").textContent=sessao.email;
  d.showModal();
  if(!conectado())setTimeout(()=>$("#lg-email").focus(),60);
}

async function confirmarConta(){
  const erro=$("#dlg-erro");erro.hidden=true;
  const bt=$("#bt-confirmar");
  const email=$("#lg-email").value.trim(), senha=$("#lg-senha").value;
  if(!email||!senha){erro.textContent="Preencha e-mail e senha.";erro.hidden=false;return;}
  if(!baseConfigurada()){erro.textContent="Este app ainda não recebeu a chave da base. Avise o administrador.";erro.hidden=false;return;}
  bt.disabled=true;bt.textContent="Entrando…";
  try{
    await autenticar(email,senha);
    atualizarConta();
    $("#dlg-conta").close();
    toast("Conectado. Carregando pendências da base…");
    await carregarPendencias();
  }catch(e){
    erro.textContent=String(e.message);erro.hidden=false;
  }finally{bt.disabled=false;bt.textContent="Continuar";}
}

/* ══════════════════════════ eventos novos ══════════════════════════ */
$("#bt-conta").onclick=abrirConta;
$("#bt-confirmar").onclick=confirmarConta;
$("#bt-salvar").onclick=salvarVistoria;
$("#bt-recarregar").onclick=()=>carregarPendencias();
["#fl-busca","#fl-unidade","#fl-grau","#fl-status"].forEach(s=>{
  $(s).addEventListener("input",renderAberto);
  $(s).addEventListener("change",renderAberto);
});
$("#dlg-conta").addEventListener("click",ev=>{if(ev.target.closest("[data-fechar]"))$("#dlg-conta").close();});
$("#lg-senha").addEventListener("keydown",ev=>{if(ev.key==="Enter")confirmarConta();});

$("#bt-nova-vistoria").onclick=()=>{
  if(estado.itens.length&&!estado.salvoEm&&!confirm("A vistoria atual ainda não foi salva. Começar uma nova mesmo assim?"))return;
  estado={cab:{...estado.cab,setor:"",codigo:"",data:new Date().toISOString().slice(0,10)},
          id:uuid(),salvoEm:null,itens:[]};
  proximoId=1;preencherCabecalho();render();salvar();
  aba("vistoria");toast("Nova vistoria começada.");
};

/* cliques da aba Em aberto */
$("#lista-aberto").addEventListener("click",ev=>{
  const t=ev.target;

  const zoom=t.closest("[data-lupa],[data-lupa-remota]");
  if(zoom&&zoom.src){const l=$("#lupa");l.querySelector("img").src=zoom.src;l.hidden=false;return;}

  const abrir=t.closest("[data-abrir]");
  if(abrir){abrirFicha(abrir.dataset.abrir);return;}

  const enc=t.closest("[data-encerrar]");
  if(enc){
    const f=document.querySelector(`[data-form="${enc.dataset.encerrar}"]`);
    if(f)f.hidden=!f.hidden;
    return;
  }
  const can=t.closest("[data-cancelar]");
  if(can){
    const f=document.querySelector(`[data-form="${can.dataset.cancelar}"]`);
    if(f)f.hidden=true;
    delete evidencias[can.dataset.cancelar];
    return;
  }
  const ev2=t.closest("[data-ev]");
  if(ev2){
    const inp=document.createElement("input");inp.type="file";inp.accept="image/*";
    inp.onchange=()=>{
      const file=inp.files&&inp.files[0];if(!file)return;
      comprimir(file,url=>{
        evidencias[ev2.dataset.ev]=url;
        ev2.classList.add("cheia");
        ev2.innerHTML=`<span class="tag">Evidência</span><img src="${url}" alt="Evidência de encerramento">`;
      });
    };
    inp.click();return;
  }
  const ok=t.closest("[data-confirmar-enc]");
  if(ok){
    const uid=ok.dataset.confirmarEnc;
    const obs=document.querySelector(`[data-obs="${uid}"]`);
    gravarStatus(uid,"Concluído",obs?obs.value:"",evidencias[uid]);
    delete evidencias[uid];
    toast("Apontamento encerrado.");
    return;
  }
});
$("#lista-aberto").addEventListener("change",ev=>{
  const s=ev.target.closest("[data-status]");
  if(s)gravarStatus(s.dataset.status,s.value,"",null);
});
$("#lupa").onclick=()=>{$("#lupa").hidden=true;};

/* ══════════════════════════ instalar no aparelho ══════════════════════════ */
let convite=null;
window.addEventListener("beforeinstallprompt",ev=>{
  ev.preventDefault();convite=ev;$("#bt-instalar").hidden=false;
});
$("#bt-instalar").onclick=async()=>{
  if(!convite){toast("No iPhone: Compartilhar → Adicionar à Tela de Início.");return;}
  convite.prompt();
  await convite.userChoice;
  convite=null;$("#bt-instalar").hidden=true;
};
window.addEventListener("appinstalled",()=>{$("#bt-instalar").hidden=true;toast("App instalado.");});

if("serviceWorker" in navigator&&location.protocol.startsWith("http")){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  });
}

/* ══════════════════════════ início da parte nova ══════════════════════════ */
sessao=lerJSON(K_SESSAO);
if(!estado.id)estado.id=uuid();
estado.itens.forEach(it=>{if(!it.uid)it.uid=uuid();if(!it.status)it.status="Aberto";});
atualizarConta();

const parametros=new URLSearchParams(location.search);
if(parametros.get("aba")==="aberto")aba("aberto");
if(parametros.get("acao")==="nova"&&!estado.itens.length)adicionar();


/* ══════════════════════════ portão de entrada ══════════════════════════
   O app só abre para quem tem conta. Uma vez logado, a sessão fica guardada
   no aparelho: quem já entrou continua entrando mesmo sem sinal no campo,
   e o que registrar offline sobe assim que a rede voltar. */

function mostrarPortao(){
  $("#portao").hidden=false;
  document.body.classList.add("travado");
  $("#portao-logo").src=LOGO;
  setTimeout(()=>$("#pt-email").focus(),80);
}

async function abrirApp(){
  $("#portao").hidden=true;
  document.body.classList.remove("travado");
  atualizarConta();
  await carregarRegras();
  renderConfig();
  render();
  carregarPendencias();
}

async function entrarPeloPortao(){
  const erro=$("#pt-erro"), bt=$("#pt-entrar");
  erro.hidden=true;
  const email=$("#pt-email").value.trim(), senha=$("#pt-senha").value;
  if(!email||!senha){erro.textContent="Preencha e-mail e senha.";erro.hidden=false;return;}
  if(!baseConfigurada()){
    erro.textContent="Este app ainda não recebeu a chave da base. Avise o administrador.";
    erro.hidden=false;return;
  }
  bt.disabled=true;bt.textContent="Entrando…";
  try{
    await autenticar(email,senha);
    $("#pt-senha").value="";
    abrirApp();
    toast("Bem-vindo. Carregando pendências da base…");
  }catch(e){
    const msg=String(e.message);
    erro.textContent=/Failed to fetch|NetworkError/i.test(msg)
      ? "Sem conexão para verificar a conta. Conecte-se à internet e tente de novo."
      : (/Invalid login/i.test(msg) ? "E-mail ou senha incorretos." : msg);
    erro.hidden=false;
  }finally{bt.disabled=false;bt.textContent="Entrar";}
}

$("#pt-entrar").onclick=entrarPeloPortao;
["#pt-email","#pt-senha"].forEach(sel=>{
  $(sel).addEventListener("keydown",ev=>{if(ev.key==="Enter")entrarPeloPortao();});
});

/* sair volta para o portão */
$("#bt-sair").onclick=()=>{
  sessao=null;localStorage.removeItem(K_SESSAO);cacheAssinado.clear();
  pendencias=[];atualizarConta();$("#dlg-conta").close();
  $("#pt-email").value="";$("#pt-senha").value="";$("#pt-erro").hidden=true;
  mostrarPortao();
};

/* quem já entrou neste aparelho entra direto, com ou sem sinal */
preencherCargos();
if(sessao&&sessao.token){ abrirApp(); } else { mostrarPortao(); }


/* ══════════════════════════ aba Configurações ══════════════════════════ */

function renderConfig(){
  const ordem=["Crítico","Alto","Médio","Baixo"];

  $("#cfg-graus").innerHTML=ordem.map(g=>{
    const cls=GRAUS[g].cls;
    const dias=Number.isFinite(regras.dias[g])?regras.dias[g]:REGRAS_PADRAO.dias[g];
    return `<div class="cfg-grau g-${cls}">
      <div class="nome"><span class="selo s-${cls}">${g}</span></div>
      <div class="cfg-linha">
        <input type="number" min="0" max="365" step="1" value="${dias}" data-regra-grau="${g}">
        <span>dias</span>
      </div>
      <div class="cfg-exemplo">${rotuloPrazo(dias)}</div>
    </div>`;
  }).join("");

  $("#cfg-atencao").value=Number.isFinite(regras.atencao)?regras.atencao:3;
  renderCargos();

  const hoje=new Date();
  const exemplo=d=>{const x=new Date(hoje);x.setDate(x.getDate()+d);return x.toISOString().slice(0,10);};
  $("#cfg-previa").innerHTML=[
    {d:-2,rot:"vencido há 2 d"},{d:0,rot:"vence hoje"},
    {d:regras.atencao,rot:"limite do aviso"},{d:regras.atencao+5,rot:"folgado"}
  ].map(e=>{
    const sp=situacaoPrazo({status:"Aberto",prazoData:exemplo(e.d)});
    return `<span class="prazo ${sp.cls}">${sp.txt}</span>`;
  }).join("");

  const busca=($("#cfg-busca").value||"").toLowerCase().trim();
  const linhas=[];
  CATEGORIAS.forEach(c=>{
    const desta=Object.entries(ANOMALIAS)
      .filter(([k,a])=>a.cat===c.id&&k!=="outro")
      .filter(([k,a])=>!busca||a.titulo.toLowerCase().includes(busca)||c.nome.toLowerCase().includes(busca));
    if(!desta.length)return;
    linhas.push(`<tr><td colspan="3" class="cfg-cat">${esc(c.nome)}</td></tr>`);
    desta.forEach(([k,a])=>{
      const e=regras.anomalias[k]||{};
      const grau=e.grau||a.grau;
      const proprio=Number.isFinite(e.dias)?e.dias:"";
      linhas.push(`<tr>
        <td>${esc(a.titulo)}<div class="cfg-padrao">padrão: ${esc(a.grau)} · ${rotuloPrazo(regras.dias[grau])}</div></td>
        <td><select data-anom-grau="${k}">${["Crítico","Alto","Médio","Baixo"].map(g=>`<option${g===grau?" selected":""}>${g}</option>`).join("")}</select></td>
        <td><input type="number" min="0" max="365" step="1" placeholder="—" value="${proprio}" data-anom-dias="${k}"></td>
      </tr>`);
    });
  });
  $("#cfg-corpo").innerHTML=linhas.join("")||'<tr><td colspan="3" class="cfg-padrao">Nenhuma anomalia com esse termo.</td></tr>';

  renderNormas();
  renderAnomLista();
  renderAnomEditor();
  renderAdmins();
  aplicarTrava();
  carregarContas(false);
}

function guardaAnomalia(k){
  if(!regras.anomalias[k])regras.anomalias[k]={};
  return regras.anomalias[k];
}
function limpaAnomalia(k){
  const e=regras.anomalias[k];
  if(e&&e.grau===undefined&&e.dias===undefined)delete regras.anomalias[k];
}

$("#painel-config").addEventListener("input",ev=>{
  const t=ev.target;
  if(t.dataset.regraGrau!==undefined&&t.dataset.regraGrau!==""){
    const v=parseInt(t.value,10);
    if(Number.isFinite(v)&&v>=0){regras.dias[t.dataset.regraGrau]=v;aplicarRegras();renderConfig();}
    return;
  }
  if(t.id==="cfg-atencao"){
    const v=parseInt(t.value,10);
    if(Number.isFinite(v)&&v>=0){regras.atencao=v;renderConfig();}
    return;
  }
  if(t.id==="cfg-busca"){renderConfig();return;}
  if(t.dataset.anomDias!==undefined&&t.dataset.anomDias!==""){
    const k=t.dataset.anomDias, v=parseInt(t.value,10);
    const e=guardaAnomalia(k);
    if(t.value.trim()===""||!Number.isFinite(v)||v<0)delete e.dias; else e.dias=v;
    limpaAnomalia(k);
    return;
  }
});

$("#painel-config").addEventListener("change",ev=>{
  const t=ev.target;
  if(t.dataset.anomGrau){
    const k=t.dataset.anomGrau, e=guardaAnomalia(k);
    if(t.value===ANOMALIAS[k].grau)delete e.grau; else e.grau=t.value;
    limpaAnomalia(k);renderConfig();
  }
});

$("#cfg-salvar").onclick=salvarRegras;
$("#cfg-restaurar").onclick=()=>{
  if(!confirm("Voltar todas as regras de prazo ao padrão?"))return;
  regras=JSON.parse(JSON.stringify(REGRAS_PADRAO));
  aplicarRegras();renderConfig();
  $("#cfg-salvo").textContent="Padrão restaurado — clique em Salvar regras para valer.";
};

/* ══════════════════════════ ficha da anomalia ══════════════════════════ */

let fichaAtual=null;

async function abrirFicha(uid){
  const p=pendencias.find(x=>x.uid===uid);
  if(!p)return;
  fichaAtual=p;
  const g=GRAUS[p.grau]||GRAUS["Médio"];
  const sp=situacaoPrazo(p);
  const feito=p.status==="Concluído";

  $("#fd-titulo").textContent=p.titulo||"Apontamento";
  $("#fd-grau").className="selo s-"+g.cls; $("#fd-grau").textContent=p.grau||"";
  $("#fd-prazo").className="prazo "+sp.cls; $("#fd-prazo").textContent=sp.txt;

  const foto=(mini,caminho,cls,leg)=>
    (mini||caminho)
      ? `<figure class="${cls}"><img ${mini?`src="${mini}"`:""} ${caminho?`data-foto-path="${esc(caminho)}"`:""} alt="${leg}"><figcaption>${leg}</figcaption></figure>`
      : `<figure class="${cls}"><div class="sem">Sem registro fotográfico</div><figcaption>${leg}</figcaption></figure>`;

  const normas=normasDoItem(p).map(n=>{
    const item=n.item&&n.item!=="—"?", item "+esc(n.item):"";
    return `<div class="fd-norma"><b>${esc(n.ref)}${item}${n.ok?"":'<span class="conf">confirmar item</span>'}</b><i>${esc(n.txt)}</i></div>`;
  }).join("")||"—";

  const linha=(rot,val)=>val?`<dt>${rot}</dt><dd>${nl(val)}</dd>`:"";

  $("#fd-corpo").innerHTML=`
    <div class="fd-fotos">
      ${foto(p.miniE,p.fotoEPath,"e","Situação encontrada")}
      ${foto(p.miniR,p.fotoRPath,"r","Situação requerida")}
    </div>
    ${feito&&p.fotoCPath?`<div class="fd-fotos"><figure class="c"><img data-foto-path="${esc(p.fotoCPath)}" alt="Evidência de encerramento"><figcaption>Evidência de encerramento</figcaption></figure><div></div></div>`:""}
    <dl class="fd-campos">
      <dt>Vistoria</dt><dd>${esc(p.codigo||"—")} · ${esc(p.unidade||"—")}${p.setor?" · "+esc(p.setor):""}${p.data?" · "+dataBR(p.data):""}</dd>
      ${linha("Localização",p.local)}
      ${p.tecnico?`<dt>Registrado por</dt><dd>${esc(p.tecnico)}</dd>`:""}
      ${linha("Situação encontrada",p.encontrada)}
      ${linha("Risco associado",p.risco)}
      <dt>Requisito aplicável</dt><dd>${normas}</dd>
      ${linha("Situação requerida",p.requerida)}
      ${linha("Ação corretiva",p.acao)}
      <dt>Prazo</dt><dd>${esc(p.prazo||"—")}${p.prazoData?" · vence em "+dataBR(p.prazoData):""}</dd>
      ${linha("Responsável",p.responsavel)}
      ${linha("Evidência exigida",p.evidencia)}
      ${linha("Pendências de campo",p.pendenciasTxt)}
      ${feito?`<dt>Encerramento</dt><dd>${p.encerradoEm?dataBR(String(p.encerradoEm).slice(0,10)):"—"}${p.encerradoObs?" — "+nl(p.encerradoObs):""}</dd>`:""}
    </dl>`;

  const sel=$("#fd-status");
  sel.innerHTML=["Aberto","Em andamento","Concluído"].map(x=>`<option${x===p.status?" selected":""}>${x}</option>`).join("");
  $("#fd-encerrar").hidden=feito;

  $("#dlg-item").showModal();

  if(fonteRemota)$("#fd-corpo").querySelectorAll("[data-foto-path]").forEach(async img=>{
    if(img.getAttribute("src"))return;
    const u=await urlDaFoto(img.dataset.fotoPath);
    if(u)img.src=u; else img.closest("figure").innerHTML='<div class="sem">Foto não disponível</div>';
  });
}

$("#dlg-item").addEventListener("click",ev=>{
  if(ev.target.closest("[data-fechar-item]")){$("#dlg-item").close();return;}
  const img=ev.target.closest(".fd-fotos img");
  if(img&&img.src){const l=$("#lupa");l.querySelector("img").src=img.src;l.hidden=false;}
});
$("#fd-status").addEventListener("change",ev=>{
  if(fichaAtual)gravarStatus(fichaAtual.uid,ev.target.value,"",null);
});
$("#fd-encerrar").onclick=()=>{
  if(!fichaAtual)return;
  const uid=fichaAtual.uid;
  $("#dlg-item").close();
  aba("aberto");
  setTimeout(()=>{
    const f=document.querySelector(`[data-form="${uid}"]`);
    const cartao=document.querySelector(`[data-pend="${uid}"]`);
    if(f){f.hidden=false;}
    if(cartao)cartao.scrollIntoView({behavior:"smooth",block:"center"});
  },120);
};


/* ══════════════════ biblioteca de normas e anomalias ══════════════════ */

function chaveNova(prefixo){
  let i=1, k;
  do{ k=prefixo+"-"+String(i).padStart(2,"0"); i++; }while(NORMAS[k]||ANOMALIAS[k]);
  return k;
}

function renderNormas(){
  const busca=($("#nm-busca").value||"").toLowerCase().trim();
  const linhas=Object.entries(NORMAS)
    .filter(([k,n])=>!busca||(n.ref+" "+n.item+" "+n.txt).toLowerCase().includes(busca))
    .sort((a,b)=>a[1].ref.localeCompare(b[1].ref)||String(a[1].item).localeCompare(String(b[1].item)))
    .map(([k,n])=>{
      const daCasa=!!NORMAS_BASE[k];
      return `<tr>
        <td><input type="text" value="${esc(n.ref)}" data-nm="${esc(k)}" data-campo="ref"></td>
        <td><input type="text" value="${esc(n.item)}" data-nm="${esc(k)}" data-campo="item"></td>
        <td><textarea data-nm="${esc(k)}" data-campo="txt">${esc(n.txt)}</textarea></td>
        <td style="text-align:center"><input type="checkbox" data-nm="${esc(k)}" data-campo="conf"${n.ok?"":" checked"}></td>
        <td>${daCasa?'<span class="cfg-padrao" title="Vem de fábrica">·</span>':`<button class="bt-mini" type="button" data-nm-apagar="${esc(k)}" title="Apagar">×</button>`}</td>
      </tr>`;
    });
  $("#nm-corpo").innerHTML=linhas.join("")||'<tr><td colspan="5" class="cfg-padrao">Nenhuma norma com esse termo.</td></tr>';
}

function editarNorma(k,campo,valor){
  const atual=NORMAS[k]; if(!atual)return;
  const base=NORMAS_BASE[k];
  const alvo=normasCustom[k]||{...atual};
  if(campo==="conf")alvo.ok=!valor; else alvo[campo]=valor;
  if(base&&base.ref===alvo.ref&&base.item===alvo.item&&base.txt===alvo.txt&&base.ok===alvo.ok)
    delete normasCustom[k];
  else normasCustom[k]=alvo;
  aplicarBiblioteca();
}

$("#sec-normas").addEventListener("input",ev=>{
  const t=ev.target;
  if(t.id==="nm-busca"){renderNormas();return;}
  if(t.dataset.nm)editarNorma(t.dataset.nm,t.dataset.campo,t.value);
});
$("#sec-normas").addEventListener("change",ev=>{
  const t=ev.target;
  if(t.dataset.nm&&t.dataset.campo==="conf")editarNorma(t.dataset.nm,"conf",t.checked);
});
$("#sec-normas").addEventListener("click",ev=>{
  const ap=ev.target.closest("[data-nm-apagar]");
  if(ap){
    const k=ap.dataset.nmApagar;
    if(!confirm("Apagar esta norma da biblioteca? Apontamentos já salvos continuam com o texto congelado."))return;
    delete normasCustom[k];aplicarBiblioteca();renderNormas();renderAnomEditor();
  }
});
$("#nm-nova").onclick=()=>{
  const k=chaveNova("norma");
  normasCustom[k]={ref:"Nova norma",item:"—",ok:false,txt:"Descreva aqui a exigência."};
  aplicarBiblioteca();$("#nm-busca").value="";renderNormas();
  const alvo=document.querySelector(`[data-nm="${k}"][data-campo="ref"]`);
  if(alvo){alvo.scrollIntoView({block:"center"});alvo.select();}
};

/* ─────────────── anomalias ─────────────── */

function renderAnomLista(){
  const sel=$("#an-escolha"), atual=sel.value;
  sel.innerHTML=CATEGORIAS.map(c=>{
    const opts=Object.entries(ANOMALIAS).filter(([k,a])=>a.cat===c.id&&k!=="outro")
      .map(([k,a])=>`<option value="${esc(k)}"${k===atual?" selected":""}>${a.oculta?"(oculta) ":""}${esc(a.titulo)}</option>`).join("");
    return opts?`<optgroup label="${esc(c.nome)}">${opts}</optgroup>`:"";
  }).join("");
  if(!sel.value)sel.selectedIndex=0;
}

function renderAnomEditor(){
  const k=$("#an-escolha").value, a=ANOMALIAS[k];
  if(!a){$("#an-editor").innerHTML="";return;}
  const campo=(rot,nome,val,area)=>area
    ? `<div class="campo largo"><label>${rot}</label><textarea data-an="${esc(k)}" data-campo="${nome}">${esc(val||"")}</textarea></div>`
    : `<div class="campo"><label>${rot}</label><input type="text" data-an="${esc(k)}" data-campo="${nome}" value="${esc(val||"")}"></div>`;
  const normas=Object.entries(NORMAS).sort((x,y)=>x[1].ref.localeCompare(y[1].ref)).map(([nk,n])=>
    `<label><input type="checkbox" data-an-norma="${esc(nk)}"${(a.normas||[]).includes(nk)?" checked":""}>${esc(n.ref)}${n.item&&n.item!=="—"?" "+esc(n.item):""}</label>`).join("");
  $("#an-editor").innerHTML=`<div class="an-grade">
    ${campo("Título","titulo",a.titulo)}
    <div class="campo"><label>Categoria</label><select data-an="${esc(k)}" data-campo="cat">
      ${CATEGORIAS.map(c=>`<option value="${c.id}"${c.id===a.cat?" selected":""}>${esc(c.nome)}</option>`).join("")}</select></div>
    <div class="campo"><label>Grau padrão</label><select data-an="${esc(k)}" data-campo="grau">
      ${["Crítico","Alto","Médio","Baixo"].map(g=>`<option${g===a.grau?" selected":""}>${g}</option>`).join("")}</select></div>
    <div class="campo largo"><label>Normas citadas</label><div class="an-normas">${normas}</div></div>
    ${campo("Situação encontrada","encontrada",a.encontrada,1)}
    ${campo("Risco associado","risco",a.risco,1)}
    ${campo("Situação requerida","requerida",a.requerida,1)}
    ${campo("Ação corretiva","acao",a.acao,1)}
    ${campo("Evidência de encerramento","evidencia",a.evidencia,1)}
    ${campo("Pendências de verificação","pendencias",a.pendencias,1)}
  </div>`;
  $("#an-ocultar").textContent=a.oculta?"Voltar para a lista":"Ocultar da lista";
}

function editarAnomalia(k,campo,valor){
  const atual=ANOMALIAS[k]; if(!atual)return;
  const alvo=anomaliasCustom[k]||JSON.parse(JSON.stringify(atual));
  alvo[campo]=valor;
  anomaliasCustom[k]=alvo;
  aplicarBiblioteca();
}

$("#an-escolha").addEventListener("change",renderAnomEditor);
$("#sec-anomalias").addEventListener("input",ev=>{
  const t=ev.target;
  if(t.dataset.an)editarAnomalia(t.dataset.an,t.dataset.campo,t.value);
});
$("#sec-anomalias").addEventListener("change",ev=>{
  const t=ev.target;
  if(t.dataset.an&&(t.dataset.campo==="cat"||t.dataset.campo==="grau")){
    editarAnomalia(t.dataset.an,t.dataset.campo,t.value);
    if(t.dataset.campo==="cat")renderAnomLista();
    return;
  }
  if(t.dataset.anNorma!==undefined){
    const k=$("#an-escolha").value;
    const marcadas=[...$("#an-editor").querySelectorAll("[data-an-norma]:checked")].map(x=>x.dataset.anNorma);
    editarAnomalia(k,"normas",marcadas);
  }
});
$("#an-nova").onclick=()=>{
  const k=chaveNova("anomalia");
  anomaliasCustom[k]={cat:CATEGORIAS[0].id,titulo:"Nova anomalia",grau:"Médio",normas:[],
    encontrada:"",risco:"",requerida:"",acao:"",evidencia:"",pendencias:""};
  aplicarBiblioteca();renderAnomLista();
  $("#an-escolha").value=k;renderAnomEditor();
  const t=$("#an-editor").querySelector('[data-campo="titulo"]');
  if(t){t.scrollIntoView({block:"center"});t.select();}
};
$("#an-ocultar").onclick=()=>{
  const k=$("#an-escolha").value, a=ANOMALIAS[k]; if(!a)return;
  editarAnomalia(k,"oculta",!a.oculta);
  renderAnomLista();renderAnomEditor();
};

/* ─────────────── administradores ─────────────── */

function renderAdmins(){
  $("#ad-corpo").innerHTML=administradores.length
    ? administradores.map(a=>`<tr>
        <td>${esc(a.email)}</td><td>${esc(a.nome||"—")}</td>
        <td><button class="bt-mini" type="button" data-ad-apagar="${esc(a.email)}" title="Remover">×</button></td></tr>`).join("")
    : '<tr><td colspan="3" class="cfg-padrao">Lista vazia — qualquer pessoa logada pode editar. Adicione o primeiro nome para fechar.</td></tr>';
}

$("#ad-add").onclick=async()=>{
  const email=($("#ad-email").value||"").trim().toLowerCase();
  const nome=($("#ad-nome").value||"").trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){toast("Informe um e-mail válido.");return;}
  if(administradores.some(a=>String(a.email).toLowerCase()===email)){toast("Esse e-mail já está na lista.");return;}
  if(!conectado()){toast("Entre na base para gerenciar administradores.");return;}
  try{
    await rest("administradores",{method:"POST",headers:{"Prefer":"return=minimal"},
      body:JSON.stringify([{email,nome:nome||null,criado_por:sessao.uid||null}])});
    administradores.push({email,nome});
    administradores.sort((a,b)=>a.email.localeCompare(b.email));
    gravarJSON(K_ADMINS,administradores);
    $("#ad-email").value="";$("#ad-nome").value="";
    const meu=((sessao&&sessao.email)||"").toLowerCase();
    souAdmin=administradores.some(a=>String(a.email).toLowerCase()===meu);
    renderAdmins();aplicarTrava();
    toast(souAdmin?"Administrador adicionado.":"Adicionado — e você não está na lista, então perdeu a permissão de editar.");
  }catch(e){ toast("A base recusou: "+String(e.message).slice(0,110)); }
};

$("#ad-corpo").addEventListener("click",async ev=>{
  const b=ev.target.closest("[data-ad-apagar]"); if(!b)return;
  const email=b.dataset.adApagar;
  if(!confirm(`Remover ${email} da lista de administradores?`))return;
  try{
    await rest(`administradores?email=eq.${encodeURIComponent(email)}`,{method:"DELETE",headers:{"Prefer":"return=minimal"}});
    administradores=administradores.filter(a=>a.email!==email);
    gravarJSON(K_ADMINS,administradores);
    const meu=((sessao&&sessao.email)||"").toLowerCase();
    souAdmin=administradores.length===0||administradores.some(a=>String(a.email).toLowerCase()===meu);
    renderAdmins();aplicarTrava();
  }catch(e){ toast("A base recusou: "+String(e.message).slice(0,110)); }
});

/* ─────────────── lista de cargos na aba Configurações ─────────────── */
function renderCargos(){
  const alvo=$("#cfg-cargos");
  if(!alvo)return;
  const lista=listaCargos();
  alvo.innerHTML=lista.length
    ? lista.map((c,i)=>`<span class="cargo-chip">${esc(c)}<button type="button" class="x" data-cargo-fora="${i}" title="Tirar da lista">×</button></span>`).join("")
    : `<span class="dica">Nenhum cargo na lista — o campo do cabeçalho fica vazio até você adicionar um.</span>`;
}

function addCargo(){
  const campo=$("#cfg-cargo-novo");
  const nome=(campo.value||"").trim();
  if(!nome)return;
  const lista=listaCargos();
  if(lista.some(c=>c.toLowerCase()===nome.toLowerCase())){
    toast("Esse cargo já está na lista.");campo.value="";return;
  }
  lista.push(nome);
  regras.cargos=lista;
  campo.value="";
  renderCargos();preencherCargos();
}

const secCargos=$("#sec-cargos");
if(secCargos){
  $("#cfg-cargo-add").onclick=addCargo;
  $("#cfg-cargo-novo").addEventListener("keydown",ev=>{
    if(ev.key==="Enter"){ev.preventDefault();addCargo();}
  });
  secCargos.addEventListener("click",ev=>{
    const b=ev.target.closest("[data-cargo-fora]");
    if(!b)return;
    const lista=listaCargos();
    lista.splice(Number(b.dataset.cargoFora),1);
    regras.cargos=lista;
    renderCargos();preencherCargos();
  });
}

/* ─────────────── trava visual para quem não é administrador ─────────────── */
function aplicarTrava(){
  ["#sec-normas","#sec-anomalias","#sec-admins"].forEach(sel=>{
    const el=$(sel); if(el)el.classList.toggle("travada",!souAdmin);
  });
  document.querySelectorAll(".cfg-secao").forEach(el=>{
    if(el.id!=="sec-normas"&&el.id!=="sec-anomalias"&&el.id!=="sec-admins")
      el.classList.toggle("travada",!souAdmin);
  });
  $("#trava-normas").hidden=souAdmin;
  $("#trava-anomalias").hidden=souAdmin;
  const tc=$("#trava-cargos"); if(tc)tc.hidden=souAdmin;
  const tct=$("#trava-contas"); if(tct)tct.hidden=souAdmin;
  $("#cfg-salvar").disabled=!souAdmin;
  $("#cfg-restaurar").disabled=!souAdmin;
}

/* ─────────────── contas e senhas (só administrador) ─────────────── */
let contasBase=null;

async function chamarFuncao(nome,corpo){
  const h=await comToken();
  const r=await fetch(`${cfg.url}/functions/v1/${nome}`,{
    method:"POST",
    headers:{...h,"Content-Type":"application/json"},
    body:JSON.stringify(corpo||{})
  });
  const txt=await r.text();
  let d=null; try{ d=txt?JSON.parse(txt):null; }catch(e){}
  if(!r.ok)throw new Error((d&&d.erro)||txt||("Erro "+r.status));
  return d;
}

function quandoFoi(iso){
  if(!iso)return "nunca entrou";
  const d=new Date(iso);
  if(isNaN(d))return "—";
  return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
}

function renderContas(){
  const corpo=$("#ct-corpo"), sel=$("#ct-alvo");
  if(!corpo||!sel)return;
  const lista=contasBase||[];
  corpo.innerHTML=lista.length
    ? lista.map(c=>`<tr>
        <td>${esc(c.email)}</td><td>${esc(quandoFoi(c.ultimo))}</td>
        <td><button class="bt-mini" type="button" data-ct-alvo="${esc(c.id)}">Trocar senha</button></td></tr>`).join("")
    : '<tr><td colspan="3" class="cfg-padrao">Nenhuma conta lida.</td></tr>';
  const antes=sel.value;
  sel.innerHTML=lista.map(c=>`<option value="${esc(c.id)}">${esc(c.email)}</option>`).join("");
  if(antes&&lista.some(c=>c.id===antes))sel.value=antes;
}

function recadoContas(txt){
  const corpo=$("#ct-corpo"), sel=$("#ct-alvo");
  if(corpo)corpo.innerHTML=`<tr><td colspan="3" class="cfg-padrao">${esc(txt)}</td></tr>`;
  if(sel)sel.innerHTML="";
}

async function carregarContas(forcar){
  if(!$("#ct-corpo"))return;
  if(!conectado()){ contasBase=null; recadoContas("Entre na base para ver as contas."); return; }
  if(!souAdmin){ contasBase=null; recadoContas("Só administradores mexem em contas."); return; }
  if(contasBase&&!forcar){ renderContas(); return; }
  recadoContas("Lendo as contas…");
  try{
    const d=await chamarFuncao("contas",{acao:"listar"});
    contasBase=(d&&d.contas)||[];
    renderContas();
  }catch(e){
    contasBase=null;
    recadoContas("Não deu para ler as contas: "+String(e.message).slice(0,120));
  }
}

function sortearSenha(){
  const abc="abcdefghijkmnpqrstuvwxyz", ABC="ABCDEFGHJKLMNPQRSTUVWXYZ", num="23456789";
  const tudo=abc+ABC+num, n=new Uint32Array(12);
  crypto.getRandomValues(n);
  let s=abc[n[0]%abc.length]+ABC[n[1]%ABC.length]+num[n[2]%num.length];
  for(let i=3;i<11;i++)s+=tudo[n[i]%tudo.length];
  return s;
}

if($("#ct-gerar")){
  $("#ct-gerar").onclick=()=>{ $("#ct-senha").value=sortearSenha(); $("#ct-aviso").textContent="Senha sorteada — copie antes de definir."; };
  $("#ct-recarregar").onclick=()=>carregarContas(true);
  $("#ct-corpo").addEventListener("click",ev=>{
    const b=ev.target.closest("[data-ct-alvo]"); if(!b)return;
    $("#ct-alvo").value=b.dataset.ctAlvo;
    if(!$("#ct-senha").value)$("#ct-senha").value=sortearSenha();
    $("#ct-senha").focus();
    $("#ct-aviso").textContent="";
  });
  $("#ct-definir").onclick=async()=>{
    const bt=$("#ct-definir"), aviso=$("#ct-aviso");
    const id=$("#ct-alvo").value, senha=($("#ct-senha").value||"").trim();
    const conta=(contasBase||[]).find(c=>c.id===id);
    aviso.textContent="";
    if(!conectado()){ aviso.textContent="Sem conexão com a base."; return; }
    if(!souAdmin){ aviso.textContent="Só administradores mexem em contas."; return; }
    if(!id||!conta){ aviso.textContent="Escolha a conta."; return; }
    if(senha.length<8){ aviso.textContent="A senha precisa de pelo menos 8 caracteres."; return; }
    if(!confirm(`Definir a senha de ${conta.email} como "${senha}"?\n\nA senha antiga deixa de valer na hora.`))return;
    bt.disabled=true; bt.textContent="Definindo…";
    try{
      await chamarFuncao("contas",{acao:"definir",id,senha});
      aviso.textContent=`Senha de ${conta.email} trocada. Passe "${senha}" para a pessoa.`;
      toast("Senha trocada.");
    }catch(e){
      aviso.textContent="A base recusou: "+String(e.message).slice(0,110);
    }finally{
      bt.disabled=false; bt.textContent="Definir senha";
    }
  };
}
