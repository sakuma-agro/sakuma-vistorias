/* ══════════════════════════════════════════════════════════════════════════
   Painel geral da área Vistorias e Segurança (14/10/2026)
   Junta tudo o que tem prazo ou pendência — apontamentos das vistorias,
   checklists, anomalias, extintores e antes e depois — no desenho dos painéis
   do Gestão Rápida Pessoas (o mesmo do painel das Anomalias): cartões por
   faixa de prazo que filtram a lista, Por módulo, Precisa de atenção, Por
   local, Por responsável, gráfico mês a mês e Imprimir o painel.

   Só lê o que os módulos já carregaram (pendencias, anRels, exRegs, adRegs);
   não grava nada. <script> próprio: erro aqui não derruba o resto.
   Nomes começam com "pg".
   ══════════════════════════════════════════════════════════════════════════ */

const PG_BREVE=7;   /* "vence em breve": 7 dias (extintores seguem a regra deles, 30) */
const PG_MODS=[
  {ch:"ap",rot:"Apontamentos de vistoria"},
  {ch:"ck",rot:"Checklists (não conformes)"},
  {ch:"an",rot:"Anomalias"},
  {ch:"ex",rot:"Extintores"},
  {ch:"ad",rot:"Antes e Depois"}
];
const PG_FAIXAS=[
  {ch:"vencidos",rot:"Vencidos",cor:"perigo",dica:"prazo já passou"},
  {ch:"breve",rot:"Vencem em breve",cor:"alerta",dica:"7 dias · extintores 30"},
  {ch:"noprazo",rot:"Abertos no prazo",cor:"atencao",dica:"ainda dá tempo"},
  {ch:"concluidos",rot:"Concluídos",cor:"calma",dica:"resolvidos"}
];
let pgFiltro={sit:"abertos",local:"",mod:"",busca:""};
let pgCarregadoEm=null, pgCarregando=false;

/* ─────────── datas (duas meia-noites locais) ─────────── */
function pgDias(iso){
  if(!iso)return null;
  const [a,m,d]=String(iso).slice(0,10).split("-").map(Number); if(!a)return null;
  const h=new Date(); const hoje=new Date(h.getFullYear(),h.getMonth(),h.getDate());
  return Math.round((new Date(a,m-1,d)-hoje)/86400000);
}
function pgData(iso){ return iso?String(iso).slice(0,10).split("-").reverse().join("/"):""; }
function pgHoje(){ const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }

/* ─────────── tudo num formato só ─────────── */
function pgFaixaPrazo(prazo,breve){
  const d=pgDias(prazo);
  if(d!==null&&d<0)return "vencidos";
  if(d!==null&&d<=breve)return "breve";
  return "noprazo";
}
function pgItens(){
  const l=[];
  (typeof pendencias!=="undefined"?pendencias:[]).forEach(p=>{
    const conc=p.status==="Concluído";
    l.push({mod:p.ehChecklist?"ck":"ap", tit:p.titulo||"—", sub:[p.codigo,p.grau].filter(Boolean).join(" · "),
      local:(p.unidade||"").trim(), resp:(p.designadoNome||p.responsavel||"").trim(),
      prazo:p.prazoData||"", conc, faixa:conc?"concluidos":pgFaixaPrazo(p.prazoData,PG_BREVE),
      reg:p.data||"", fim:conc?String(p.encerradoEm||"").slice(0,10):"", ir:"aberto", chave:p.codigo||""});
  });
  if(typeof anTodosItens==="function")anTodosItens().forEach(({rel,it,n})=>{
    const conc=typeof anConcluida==="function"&&anConcluida(it);
    l.push({mod:"an", tit:it.problema||"—", sub:[rel.codigo,"nº "+n].filter(Boolean).join(" · "),
      local:(rel.local||"").trim(), resp:(it.responsavel||"").trim(),
      prazo:it.prazo||"", conc, faixa:conc?"concluidos":pgFaixaPrazo(it.prazo,PG_BREVE),
      reg:rel.data||"", fim:conc?(it.fim_data||""):"", ir:"an", chave:rel.codigo||""});
  });
  (typeof exRegs!=="undefined"?exRegs:[]).forEach(r=>{
    const s=typeof exSituacao==="function"?exSituacao(r):"sem";
    l.push({mod:"ex", tit:"Extintor "+(r.codigo||"")+(r.tipo?" · "+r.tipo:""),
      sub:[r.local,r.capacidade].filter(Boolean).join(" · "),
      local:(r.unidade||"").trim(), resp:"", prazo:typeof exProxima==="function"?exProxima(r):"",
      conc:false, faixa:{venc:"vencidos",breve:"breve"}[s]||"noprazo", semData:s==="sem",
      reg:"", fim:"", ir:"ex", chave:r.codigo||""});
  });
  (typeof adRegs!=="undefined"?adRegs:[]).forEach(r=>{
    const conc=!!r.foto_depois;
    l.push({mod:"ad", tit:r.titulo||"—", sub:[r.codigo,r.local].filter(Boolean).join(" · "),
      local:(r.unidade||"").trim(), resp:(r.responsavel||"").trim(), prazo:"",
      conc, faixa:conc?"concluidos":"noprazo", aguardando:!conc,
      reg:r.data_antes||"", fim:conc?(r.data_depois||""):"", ir:"ad", chave:r.codigo||""});
  });
  return l;
}
function pgBase(){
  return pgItens().filter(x=>(!pgFiltro.local||x.local===pgFiltro.local)&&(!pgFiltro.mod||x.mod===pgFiltro.mod));
}
const pgModRot=ch=>(PG_MODS.find(m=>m.ch===ch)||{rot:ch}).rot;
function pgTag(x){
  if(x.conc)return `<span class="anp-tag calma">concluído${x.fim?" "+esc(pgData(x.fim)):""}</span>`;
  if(x.aguardando)return `<span class="anp-tag neutra">aguardando o depois</span>`;
  if(x.semData||!x.prazo)return `<span class="anp-tag neutra">sem prazo</span>`;
  const d=pgDias(x.prazo);
  if(d<0)return `<span class="anp-tag perigo">vencido há ${-d} d</span>`;
  if(d===0)return `<span class="anp-tag alerta">vence hoje</span>`;
  if(x.faixa==="breve")return `<span class="anp-tag alerta">vence em ${d} d</span>`;
  return `<span class="anp-tag atencao">em ${d} d</span>`;
}
function pgOrdenar(a,b){
  if(a.conc!==b.conc)return a.conc?1:-1;
  if(a.conc)return String(b.fim).localeCompare(String(a.fim));
  return String(a.prazo||"9999").localeCompare(String(b.prazo||"9999"));
}

/* ─────────── tabelas e gráfico ─────────── */
function pgTabela(base,chave,rotulo,attr){
  const ordem=k=>{ const i=PG_MODS.findIndex(m=>m.ch===k); return i<0?99:i; };
  const nomes=[...new Set(base.map(chave))].sort((a,b)=>attr==="data-pg-mod"?ordem(a)-ordem(b):a.localeCompare(b,"pt-BR"));
  if(!nomes.length)return `<div class="vazio">Nada registrado ainda.</div>`;
  const tot={n:0}; PG_FAIXAS.forEach(f=>tot[f.ch]=0);
  const linhas=nomes.map(nm=>{
    const dele=base.filter(x=>chave(x)===nm);
    const cel=PG_FAIXAS.map(f=>{ const n=dele.filter(x=>x.faixa===f.ch).length; tot[f.ch]+=n;
      return `<td class="ce${n?" anp-n-"+f.cor:" anp-sem"}">${n||"—"}</td>`; }).join("");
    tot.n+=dele.length;
    return `<tr><td>${attr?`<button type="button" class="anp-link" ${attr}="${esc(nm)}">${esc(attr==="data-pg-mod"?pgModRot(nm):nm)}</button>`:esc(nm)}</td>${cel}<td class="ce"><b>${dele.length}</b></td></tr>`;
  }).join("");
  return `<div class="anp-rola"><table class="anp-tab"><thead><tr><th>${esc(rotulo)}</th>
    ${PG_FAIXAS.map(f=>`<th class="ce">${esc(f.rot.replace("Abertos no prazo","No prazo"))}</th>`).join("")}<th class="ce">Total</th></tr></thead>
    <tbody>${linhas}<tr class="anp-total"><td>Total</td>${PG_FAIXAS.map(f=>`<td class="ce">${tot[f.ch]||"—"}</td>`).join("")}<td class="ce">${tot.n}</td></tr></tbody></table></div>`;
}
function pgMeses(n){
  const d=new Date(), l=[];
  for(let i=n-1;i>=0;i--){ const x=new Date(d.getFullYear(),d.getMonth()-i,1); l.push(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`); }
  return l;
}
function pgRotMes(k){ return ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][+k.slice(5,7)-1]+"/"+k.slice(2,4); }
function pgGrafico(base){
  const b=base.filter(x=>x.mod!=="ex");
  const meses=pgMeses(6);
  const reg=meses.map(m=>b.filter(x=>String(x.reg).slice(0,7)===m).length);
  const con=meses.map(m=>b.filter(x=>x.conc&&String(x.fim).slice(0,7)===m).length);
  const W=900,H=210,E=34,T=14,B=26, larg=(W-E-8)/meses.length;
  const max=Math.max(4,...reg,...con);
  const y=v=>T+(H-T-B)*(1-v/max);
  const passo=Math.max(1,Math.ceil(max/4));
  const marcas=[]; for(let v=0;v<=max;v+=passo)marcas.push(v);
  return `<figure class="anp-graf"><figcaption>Registrados × concluídos · últimos 6 meses</figcaption>
    <div class="anp-rola"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Registrados e concluídos por mês">
      ${marcas.map(v=>`<line class="anp-eixo" x1="${E}" x2="${W-8}" y1="${y(v)}" y2="${y(v)}"/><text class="anp-txt" x="${E-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`).join("")}
      ${meses.map((m,i)=>{
        const x=E+i*larg+larg*0.18, w=larg*0.3;
        const bar=(v,dx,cls,rot)=>v?`<rect class="${cls}" x="${x+dx}" y="${y(v)}" width="${w}" height="${Math.max(1,H-B-y(v))}" rx="3"><title>${pgRotMes(m)}: ${v} ${rot}</title></rect><text class="anp-txt anp-val" x="${x+dx+w/2}" y="${y(v)-4}" text-anchor="middle">${v}</text>`:"";
        return bar(reg[i],0,"anp-b-reg","registrado(s)")+bar(con[i],w+larg*0.04,"anp-b-con","concluído(s)")
          +`<text class="anp-txt" x="${x+w+larg*0.02}" y="${H-8}" text-anchor="middle">${pgRotMes(m)}</text>`;
      }).join("")}
    </svg></div>
    <p class="anp-legenda"><span class="anp-cx reg"></span>registrados no mês · <span class="anp-cx con"></span>concluídos no mês · extintores ficam de fora (não têm registro mensal)</p>
  </figure>`;
}

/* ─────────── tela ─────────── */
function pgRender(){
  const C=$("#pg-corpo"); if(!C)return;
  const todos=pgItens(), base=pgBase();
  const conta=f=>base.filter(x=>x.faixa===f).length;
  const comFim=base.filter(x=>x.mod!=="ex");
  const conc=comFim.filter(x=>x.conc).length, pct=comFim.length?Math.round(conc*100/comFim.length):0;
  const abertos=base.filter(x=>!x.conc).length;
  const locais=[...new Set(todos.map(x=>x.local).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const urg=base.filter(x=>!x.conc&&["vencidos","breve"].includes(x.faixa)).sort(pgOrdenar);
  const hora=pgCarregadoEm?pgCarregadoEm.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"";
  const semRede=!conectado()||(typeof anOffline!=="undefined"&&anOffline)||(typeof exOffline!=="undefined"&&exOffline);
  C.innerHTML=`
  <div class="anp pg">
    <div class="anp-cartao">
      <div class="anp-barra-tit">
        <div><h2>Painel geral · Vistorias e Segurança</h2>
          <p class="anp-dica">Apontamentos, checklists, anomalias, extintores e antes e depois juntos. Clique num cartão para ver a lista.${hora?` · atualizado às ${esc(hora)}`:""}</p></div>
        <span class="anp-acoes"><button type="button" class="anp-btn" data-pg-atualizar>${pgCarregando?"Atualizando…":"Atualizar"}</button>
          <button type="button" class="anp-btn principal" data-pg-imprimir>Imprimir o painel</button></span>
      </div>
      ${semRede?`<div class="anp-aviso">Sem conexão com a base: mostrando o que estava guardado neste aparelho.</div>`:""}
      <div class="anp-filtros">
        <label class="anp-campo">Local <select id="pg-f-local"><option value="">Todos</option>${locais.map(u=>`<option ${u===pgFiltro.local?"selected":""}>${esc(u)}</option>`).join("")}</select></label>
        <label class="anp-campo">Módulo <select id="pg-f-mod"><option value="">Todos</option>${PG_MODS.map(m=>`<option value="${m.ch}" ${m.ch===pgFiltro.mod?"selected":""}>${esc(m.rot)}</option>`).join("")}</select></label>
      </div>
      <div class="anp-cards">
        ${PG_FAIXAS.map(f=>{ const n=conta(f.ch); return `<button type="button" class="anp-card anp-${f.cor}${n?"":" anp-zero"}" data-pg-sit="${f.ch}" aria-pressed="${pgFiltro.sit===f.ch}">
          <span>${esc(f.rot)}</span><strong>${n}</strong><small>${n?esc(f.dica):"nada aqui"}</small></button>`; }).join("")}
        <button type="button" class="anp-card anp-ok" data-pg-sit="abertos" aria-pressed="${pgFiltro.sit==="abertos"}"><span>Em aberto</span><strong>${abertos}</strong><small>de ${base.length} no total</small></button>
      </div>
      <div class="anp-progresso"><div class="anp-progresso-tit"><b>${pct}% concluídos</b><span>${conc} de ${comFim.length} · sem contar extintores</span></div><div class="anp-trilho"><i style="width:${pct}%"></i></div></div>

      <div class="anp-bloco"><h3>Por módulo</h3>
        <p class="anp-dica">Clique no nome para abrir o módulo.</p>${pgTabela(base,x=>x.mod,"Módulo","data-pg-mod")}</div>

      <div class="anp-bloco"><h3>Precisa de atenção</h3>
        <p class="anp-dica">Vencidos e os que vencem nos próximos ${PG_BREVE} dias (extintores: 30 dias).</p>
        ${urg.length?`<div class="anp-rola"><table class="anp-tab"><thead><tr><th>O quê</th><th>Módulo</th><th>Local</th><th>Responsável</th><th class="ce">Prazo</th><th class="ce">Situação</th><th></th></tr></thead><tbody>
          ${urg.map(x=>`<tr><td><b>${esc(x.tit)}</b>${x.sub?`<br><span class="anp-sem">${esc(x.sub)}</span>`:""}</td>
            <td>${esc(pgModRot(x.mod))}</td><td>${esc(x.local||"—")}</td><td>${esc(x.resp||"—")}</td>
            <td class="ce">${esc(pgData(x.prazo)||"—")}</td><td class="ce">${pgTag(x)}</td>
            <td class="ce"><button type="button" class="anp-btn mini" data-pg-ir="${x.ir}">Abrir</button></td></tr>`).join("")}
          </tbody></table></div>`:`<div class="vazio">Nada vencido nem vencendo nos próximos dias. Tudo em ordem.</div>`}
      </div>

      <div class="anp-bloco"><h3>Por local</h3>${pgTabela(base,x=>x.local||"Sem local","Local","data-pg-local")}</div>
      <div class="anp-bloco"><h3>Por responsável</h3>
        <p class="anp-dica">Extintores não têm responsável e ficam de fora.</p>${pgTabela(base.filter(x=>x.mod!=="ex"),x=>x.resp||"Sem responsável","Responsável",null)}</div>
      <div class="anp-bloco">${pgGrafico(base)}</div>
    </div>

    <div class="anp-cartao">
      <div class="anp-barra-tit"><div><h2>Lista · ${esc(pgNomeSit())}</h2><p class="anp-dica">Abrir leva ao módulo de onde o item veio.</p></div>
        ${pgFiltro.sit!=="abertos"?`<span class="anp-acoes"><button type="button" class="anp-btn" data-pg-sit="abertos">Ver todos em aberto</button></span>`:""}</div>
      <div class="anp-filtros"><label class="anp-campo larga">Buscar <input type="search" id="pg-f-busca" placeholder="O quê, número, local, responsável…" value="${esc(pgFiltro.busca)}"></label></div>
      <div id="pg-lista"></div>
    </div>
  </div>`;
  pgRenderLista();
}
function pgNomeSit(){
  return {abertos:"Em aberto",todos:"Todos"}[pgFiltro.sit]||(PG_FAIXAS.find(f=>f.ch===pgFiltro.sit)||{}).rot||"";
}
function pgFiltrados(){
  const b=pgFiltro.busca.trim().toLowerCase();
  return pgBase().filter(x=>{
    if(pgFiltro.sit==="abertos"&&x.conc)return false;
    if(!["abertos","todos"].includes(pgFiltro.sit)&&x.faixa!==pgFiltro.sit)return false;
    if(b&&![x.tit,x.sub,x.local,x.resp,x.chave,pgModRot(x.mod)].join(" ").toLowerCase().includes(b))return false;
    return true;
  }).sort(pgOrdenar);
}
function pgRenderLista(){
  const L=$("#pg-lista"); if(!L)return;
  const l=pgFiltrados();
  if(!l.length){ L.innerHTML=`<div class="vazio">Nada com esse filtro.</div>`; return; }
  const max=300, cortado=l.length>max;
  L.innerHTML=`<div class="anp-rola"><table class="anp-tab"><thead><tr><th>O quê</th><th>Módulo</th><th>Local</th><th>Responsável</th><th class="ce">Prazo</th><th class="ce">Situação</th><th></th></tr></thead><tbody>
    ${l.slice(0,max).map(x=>`<tr class="pg-f-${x.faixa}"><td><b>${esc(x.tit)}</b>${x.sub?`<br><span class="anp-sem">${esc(x.sub)}</span>`:""}</td>
      <td>${esc(pgModRot(x.mod))}</td><td>${esc(x.local||"—")}</td><td>${esc(x.resp||"—")}</td>
      <td class="ce">${esc(pgData(x.prazo)||"—")}</td><td class="ce">${pgTag(x)}</td>
      <td class="ce"><button type="button" class="anp-btn mini" data-pg-ir="${x.ir}">Abrir</button></td></tr>`).join("")}
    </tbody></table></div>${cortado?`<p class="anp-dica" style="margin-top:8px">Mostrando ${max} de ${l.length}. Use os filtros para achar o resto.</p>`:""}`;
}

/* ─────────── folha impressa: A4 em pé, padrão SAKUMA, sem assinatura ─────────── */
function pgFolha(){
  const base=pgBase();
  const conta=f=>base.filter(x=>x.faixa===f).length;
  const comFim=base.filter(x=>x.mod!=="ex"), conc=comFim.filter(x=>x.conc).length, pct=comFim.length?Math.round(conc*100/comFim.length):0;
  const urg=base.filter(x=>!x.conc&&["vencidos","breve"].includes(x.faixa)).sort(pgOrdenar);
  const filtro=[pgFiltro.local&&"Local: "+pgFiltro.local,pgFiltro.mod&&"Módulo: "+pgModRot(pgFiltro.mod)].filter(Boolean).join(" · ")||"Todos os locais e módulos";
  const tab=h=>h.replace(/anp-tab/g,"anr-lista").replace(/<button type="button" class="anp-link"[^>]*>([^<]*)<\/button>/g,"$1");
  return `<div class="anr-doc anr-painel">
    <header class="anr-cab"><div><h1>Painel geral · Vistorias e Segurança</h1><p>${esc(filtro)} · emitido em ${esc(pgData(pgHoje()))}</p></div><img src="${LOGO}" alt="SAKUMA Agronegócios"></header>
    <div class="anr-kpis cinco">
      ${PG_FAIXAS.map(f=>`<div class="${{perigo:"venc",alerta:"breve",atencao:"ab",calma:"ok"}[f.cor]}"><b>${conta(f.ch)}</b><span>${esc(f.rot)}</span></div>`).join("")}
      <div><b>${base.filter(x=>!x.conc).length}</b><span>em aberto · ${pct}% concluídos</span></div>
    </div>
    <h2 class="anr-h2">Por módulo</h2>${tab(pgTabela(base,x=>x.mod,"Módulo","data-pg-mod"))}
    <h2 class="anr-h2">Precisa de atenção</h2>
    ${urg.length?`<table class="anr-lista"><thead><tr><th>O quê</th><th>Módulo</th><th>Local</th><th>Responsável</th><th>Prazo</th><th>Situação</th></tr></thead><tbody>
      ${urg.map(x=>`<tr><td><b>${esc(x.tit)}</b>${x.sub?`<br><small>${esc(x.sub)}</small>`:""}</td><td>${esc(pgModRot(x.mod))}</td><td>${esc(x.local||"—")}</td><td>${esc(x.resp||"—")}</td><td>${esc(pgData(x.prazo)||"—")}</td><td>${pgTag(x)}</td></tr>`).join("")}
      </tbody></table>`:`<p class="anr-vazio">Nada vencido nem vencendo nos próximos dias.</p>`}
    <h2 class="anr-h2">Por local</h2>${tab(pgTabela(base,x=>x.local||"Sem local","Local",null))}
    <h2 class="anr-h2">Por responsável</h2>${tab(pgTabela(base.filter(x=>x.mod!=="ex"),x=>x.resp||"Sem responsável","Responsável",null))}
    <div class="anr-graf">${pgGrafico(base)}</div>
    <footer class="anr-rod"><span>SAKUMA Agronegócios · Painel geral · Vistorias e Segurança</span>${typeof docLop==="function"?docLop():""}</footer>
  </div>`;
}

/* ─────────── dados ─────────── */
async function pgCarregar(){
  if(pgCarregando)return;
  pgCarregando=true; if(!$("#painel-pg").hidden)pgRender();
  const passos=[
    typeof carregarPendencias==="function"?carregarPendencias():null,
    typeof anCarregar==="function"?anCarregar():null,
    typeof exCarregar==="function"?exCarregar():null,
    typeof adCarregar==="function"?adCarregar():null
  ];
  await Promise.all(passos.map(p=>p&&p.catch?p.catch(e=>console.warn("painel geral:",e)):p));
  pgCarregando=false; pgCarregadoEm=new Date();
  if(!$("#painel-pg").hidden)pgRender();
}
function pgIr(q){
  if(q==="aberto"){ carregarPendencias(); aba("aberto"); return; }
  if(q==="an"){ if(typeof anMostrar==="function")anMostrar("painel"); else aba("an"); return; }
  if(q==="ex"){ $("#t-ex").click(); return; }
  if(q==="ad"){ $("#t-ad").click(); return; }
  aba(q);
}

/* ─────────── eventos ─────────── */
$("#painel-pg").addEventListener("click",ev=>{
  const q=s=>ev.target.closest(s);
  let b;
  if(q("[data-pg-atualizar]")){ pgCarregar(); return; }
  if(q("[data-pg-imprimir]")){ if(typeof anImprimir==="function")anImprimir(pgFolha()); return; }
  if((b=q("[data-pg-sit]"))){ const s=b.dataset.pgSit; pgFiltro.sit=(pgFiltro.sit===s&&s!=="abertos")?"abertos":s; pgRender();
    const l=$("#pg-lista"); if(l)l.scrollIntoView({behavior:"smooth",block:"start"}); return; }
  if((b=q("[data-pg-ir]"))){ pgIr(b.dataset.pgIr); return; }
  if((b=q("[data-pg-mod]"))){ const m=b.dataset.pgMod; pgIr({ap:"aberto",ck:"aberto",an:"an",ex:"ex",ad:"ad"}[m]); return; }
  if((b=q("[data-pg-local]"))){ pgFiltro.local=b.dataset.pgLocal==="Sem local"?"":b.dataset.pgLocal; pgRender(); return; }
});
$("#painel-pg").addEventListener("change",ev=>{
  if(ev.target.id==="pg-f-local"){ pgFiltro.local=ev.target.value; pgRender(); }
  if(ev.target.id==="pg-f-mod"){ pgFiltro.mod=ev.target.value; pgRender(); }
});
$("#painel-pg").addEventListener("input",ev=>{
  if(ev.target.id==="pg-f-busca"){ pgFiltro.busca=ev.target.value; pgRenderLista(); }
});

/* ─────────── ligações com o resto do app ─────────── */
if(typeof PAINEIS!=="undefined"&&!PAINEIS.includes("pg"))PAINEIS.push("pg");
const _abaPG=aba;
aba=function(qual){ _abaPG(qual); if(qual==="pg"){ pgRender(); if(!pgCarregadoEm)pgCarregar(); } };
$("#t-pg").onclick=()=>{ aba("pg"); pgCarregar(); };
if(new URLSearchParams(location.search).get("aba")==="pg"){ aba("pg"); }
