
/* ══════════════════════════════════════════════════════════════════════════
   Gestão Rápida (Vistorias e Segurança)
   Tela inicial no padrão dos outros Gestão Rápida, assinatura da LOP nos
   relatórios e o módulo de CHECKLISTS PRONTOS: o técnico escolhe um modelo
   já cadastrado, preenche C / NC / NA item a item e o relatório sai no
   formato da planilha. Por baixo, o checklist pronto é uma vistoria como
   outra qualquer — salva na mesma tabela, e o que for Não conforme abre
   apontamento com prazo na aba Em aberto.
   Nomes deste arquivo começam com ck, gr ou lop para não colidir com os
   dos outros dois scripts (armadilha que já custou caro).
   ══════════════════════════════════════════════════════════════════════════ */

/* ─────────── assinatura da LOP nos relatórios ───────────
   Igual aos relatórios do Gestão Rápida (Pessoas): no pé do documento, à
   direita, a marca pequena da LOP (o mesmo arquivo img/lop-marca.png dos
   outros apps, só reduzido) e ao lado "Inteligência para o agronegócio".
   Embutida para sair também no arquivo exportado e no PDF sem internet. */
function lopMarca(){ return "data:image/png;base64,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"; }
function docLop(){
  return `<div class="doc-lop"><img src="${lopMarca()}" alt="LOP"><span>Inteligência para o agronegócio</span></div>`;
}
window.docLop=docLop;

/* ─────────── modelos de checklist que já vêm cadastrados ─────────── */
const CK_PADRAO = {
  "modelo:nr24-1590": {
    sigla:"NR-24", titulo:"Checklist de Verificação – NR-24", subtitulo:"Portaria MTE nº 1.590/2026",
    ref:"NR-24 · Portaria MTE nº 1.590/2026",
    arquivo:"arquivos/Checklist_NR24_Portaria_MTE_1590_2026.xlsx",
    campos:["Fazenda", "Data da verificação", "Nº de trabalhadores", "Responsável", "Atividade/Talhão", "Identificação", "Revisão", "Elaboração", "Aprovação", "Data"],
    grupos:[
      {titulo:"Instalações sanitárias", itens:[
        ["1.1", "Há instalação sanitária disponível aos trabalhadores?"],
        ["1.2", "Quando utilizado banheiro móvel, existe justificativa para a inviabilidade técnica de instalação fixa?"],
        ["1.3", "O banheiro está localizado, preferencialmente, a até 150 m do posto de trabalho?"],
        ["1.4", "Quando ultrapassa 150 m, existe meio de transporte disponível para deslocamento dos trabalhadores?"],
        ["1.5", "O banheiro garante privacidade aos usuários?"],
        ["1.6", "A porta possui sistema de fechamento interno?"],
        ["1.7", "O local possui ventilação adequada?"],
        ["1.8", "Possui iluminação adequada, inclusive para utilização no período noturno, quando aplicável?"],
        ["1.9", "O banheiro está instalado em local plano, estável e com acesso seguro?"],
        ["1.10", "Há proteção contra exposição excessiva ao sol/calor?"]
      ]},
      {titulo:"Higiene e limpeza", itens:[
        ["2.1", "O banheiro é higienizado no mínimo diariamente?"],
        ["2.2", "Existem registros da limpeza realizada?"],
        ["2.3", "O reservatório de dejetos é esvaziado/sugado conforme a necessidade?"],
        ["2.4", "Existem comprovantes dos serviços de sucção/esvaziamento?"],
        ["2.5", "Os comprovantes estão disponíveis para consulta?"],
        ["2.6", "O banheiro encontra-se em condições adequadas de higiene e utilização?"]
      ]},
      {titulo:"Lavatório e higiene das mãos", itens:[
        ["3.1", "Existe lavatório disponível para higienização das mãos?"],
        ["3.2", "Há água disponível para lavagem das mãos?"],
        ["3.3", "Há sabonete líquido ou produto adequado para higienização?"],
        ["3.4", "Não é utilizado sabonete em barra?"],
        ["3.5", "Há papel-toalha ou outro meio adequado para secagem das mãos?"],
        ["3.6", "Não são utilizadas toalhas coletivas?"]
      ]},
      {titulo:"Papel higiênico e descarte", itens:[
        ["4.1", "Há papel higiênico disponível?"],
        ["4.2", "Existe suporte adequado para o papel?"],
        ["4.3", "Quando o papel não pode ser descartado na bacia, existe recipiente adequado com tampa?"]
      ]},
      {titulo:"Água potável", itens:[
        ["5.1", "É disponibilizada água potável, filtrada e fresca?"],
        ["5.2", "A quantidade de água é suficiente para os trabalhadores durante a jornada?"],
        ["5.3", "A água é armazenada em recipientes adequados e higienizados?"],
        ["5.4", "Quando fornecida em recipientes portáteis, estes permanecem fechados e adequadamente acondicionados?"],
        ["5.5", "Não são utilizados copos coletivos?"]
      ]},
      {titulo:"Controles e evidências", itens:[
        ["6.1", "Existe controle periódico de inspeção dos banheiros?"],
        ["6.2", "Existem registros de limpeza/higienização?"],
        ["6.3", "Existem comprovantes de sucção/esvaziamento dos banheiros químicos?"],
        ["6.4", "Os registros estão disponíveis e organizados para apresentação em auditorias?"],
        ["6.5", "As não conformidades identificadas possuem plano de ação/correção?"]
      ]}
    ],
    orientacoes:[
      ["Classificação", "C = Conforme | NC = Não Conforme | NA = Não Aplicável"],
      ["Evidências", "Registrar fotos, registros de limpeza, comprovantes de sucção/esvaziamento e demais documentos aplicáveis."],
      ["Distância", "Verificar a distância entre o posto de trabalho/frente de serviço e a instalação sanitária."],
      ["Banheiro móvel", "Verificar justificativa de inviabilidade técnica quando houver uso de instalação sanitária móvel."],
      ["Higiene", "A limpeza deve ocorrer, no mínimo, diariamente."],
      ["Lavatório", "Disponibilizar água e produto adequado para higienização das mãos; não utilizar sabonete em barra ou toalhas coletivas."],
      ["Água", "Verificar disponibilidade de água potável, filtrada e fresca, em quantidade suficiente."],
      ["Registros", "Manter evidências organizadas para apresentação em auditorias."]
    ]
  }
};

function ckModelos(){
  const m={};
  Object.entries(CK_PADRAO).forEach(([k,v])=>{ m[k]=JSON.parse(JSON.stringify(v)); });
  Object.entries(chkCustom||{}).forEach(([k,v])=>{
    if(!k.startsWith("modelo:"))return;
    if(v===null){ delete m[k]; return; }
    m[k]=JSON.parse(JSON.stringify(v));
  });
  return m;
}
const ckTotalItens=m=>(m.grupos||[]).reduce((s,g)=>s+(g.itens||[]).length,0);

/* Os campos do cabeçalho de cada planilha que já existem na vistoria
   vão para o mesmo lugar — assim a aba Em aberto, a lista de vistorias
   salvas e o número VIST-xxx continuam funcionando sem mudar o banco. */
function ckCampoCab(rotulo){
  const r=String(rotulo||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[:.]/g,"").trim();
  if(/^(fazenda|unidade|propriedade)/.test(r))return "unidade";
  if(/^data da (verificacao|vistoria|inspecao)/.test(r))return "data";
  if(/(trabalhadores|colaboradores)/.test(r))return "colaboradores";
  if(r==="responsavel"||/^responsavel (pela|do|da) (turma|setor|area)/.test(r))return "responsavelTurma";
  if(/^(atividade|talhao|setor|local)/.test(r))return "setor";
  if(/^(elaboracao|elaborado|tecnico|inspetor|verificado por)/.test(r))return "tecnico";
  if(/^(aprovacao|aprovado)/.test(r))return "aprovador";
  return null;
}
function ckTipo(rotulo){
  const r=String(rotulo||"").toLowerCase();
  if(/^data/.test(r))return "date";
  if(/^n[º°o]\s/.test(r)||/^numero/.test(r))return "number";
  return "text";
}
function ckValor(rotulo,cab,modelo){
  const k=ckCampoCab(rotulo);
  if(k)return cab[k]||"";
  return (modelo.valores||{})[rotulo]||"";
}

/* ─────────── começar um checklist ─────────── */
function ckTemRascunho(){
  const respondido=chkLista().some(b=>(b.itens||[]).some(i=>i.r));
  return !estado.salvoEm && (estado.itens.length>0 || respondido);
}

function ckIniciar(chave){
  const m=ckModelos()[chave];
  if(!m){toast("Esse checklist não está mais na lista.");return;}
  if(ckTemRascunho()&&!confirm("Há uma vistoria ou checklist em andamento que ainda não foi salvo. Começar este checklist mesmo assim?"))return;
  const ant=estado.cab||{};
  const hoje=new Date().toISOString().slice(0,10);
  estado={
    cab:{unidade:"",setor:"",data:hoje,tecnico:ant.tecnico||"",cargo:ant.cargo||"Técnico de Segurança do Trabalho",
         motivo:"Checklist "+(m.sigla||m.titulo),aprovador:"",aprovadorCargo:"",codigo:"",
         tecnicoRegistro:ant.tecnicoRegistro||""},
    id:uuid(),salvoEm:null,itens:[],
    modelo:{chave,sigla:m.sigla||"",titulo:m.titulo||"",subtitulo:m.subtitulo||"",ref:m.ref||"",
            campos:(m.campos||[]).slice(),orientacoes:(m.orientacoes||[]).slice(),valores:{}},
    chk:(m.grupos||[]).map((g,gi)=>({
      id:chave.replace(/^modelo:/,"")+"-"+(gi+1), ref:"", titulo:g.titulo||("Grupo "+(gi+1)),
      itens:(g.itens||[]).map((x,k)=>({n:k+1,cod:String(x[0]||""),txt:String(x[1]||""),r:"",obs:"",fotos:[]}))
    }))
  };
  /* "Data" solta no cabeçalho da planilha é a data do documento */
  estado.modelo.campos.forEach(c=>{ if(!ckCampoCab(c)&&ckTipo(c)==="date")estado.modelo.valores[c]=hoje; });
  proximoId=1;
  preencherCabecalho(); render(); chkRender(); salvar();
  ckMostrar("preencher");
  window.scrollTo({top:0});
}

/* ─────────── tela: lista de checklists ─────────── */
function ckRenderLista(){
  const alvo=$("#ck-lista"); if(!alvo)return;
  const ms=ckModelos(), chaves=Object.keys(ms);
  let andamento="";
  if(estado.modelo){
    const tot=chkLista().reduce((s,b)=>s+b.itens.length,0);
    const resp=chkLista().reduce((s,b)=>s+b.itens.filter(i=>i.r).length,0);
    andamento=`<div class="ck-andamento">
      <b>${estado.salvoEm?"Último checklist salvo":"Checklist em andamento"}: ${esc(estado.modelo.titulo)} — ${resp} de ${tot} itens respondidos${estado.cab.unidade?" · "+esc(estado.cab.unidade):""}</b>
      <button class="btn" type="button" data-ck-continuar>${estado.salvoEm?"Abrir":"Continuar"}</button></div>`;
  }
  alvo.innerHTML=`
    <div class="secao-topo">
      <h2>Checklists prontos</h2>
      <span class="dica">Escolha o checklist, preencha no local e salve. O que for Não conforme vira apontamento com prazo.</span>
    </div>
    ${andamento}
    ${chaves.length?`<div class="ck-modelos">${chaves.map(k=>{
      const m=ms[k];
      return `<div class="ck-card">
        <span class="ref">${esc(m.ref||m.sigla||"Checklist")}</span>
        <h3>${esc(m.titulo)}</h3>
        <span class="info">${ckTotalItens(m)} itens · ${(m.grupos||[]).length} grupos</span>
        <div class="grupos">${(m.grupos||[]).map(g=>`<span>${esc(g.titulo)}</span>`).join("")}</div>
        <div class="pe">
          <button class="btn" type="button" data-ck-iniciar="${esc(k)}">Preencher</button>
          ${m.arquivo?`<a href="${esc(m.arquivo)}" download>Planilha original</a>`:""}
        </div>
      </div>`;}).join("")}</div>`
    :`<div class="vazio"><p>Nenhum checklist cadastrado. Cadastre em Configurações → Checklists prontos.</p></div>`}`;
}

/* ─────────── tela: preenchimento ─────────── */
function ckMostrar(qual){
  const lista=$("#ck-lista"), prep=$("#ck-preencher");
  if(qual==="preencher"&&estado.modelo){
    lista.hidden=true; prep.hidden=false; ckMontarTela();
  }else{
    prep.hidden=true; lista.hidden=false; ckRenderLista();
  }
  aba("checklists");
}

function ckMontarTela(){
  const alvo=$("#ck-preencher"); if(!alvo||!estado.modelo)return;
  const m=estado.modelo, c=estado.cab;
  const campo=rot=>{
    const k=ckCampoCab(rot), tipo=ckTipo(rot), id="ckf-"+chkSlug(rot);
    const val=ckValor(rot,c,m);
    const extra=k?`data-ck-cab="${k}"`:`data-ck-val="${esc(rot)}"`;
    const ph=k==="unidade"?"Fazenda Morro Branco":(k==="setor"?"Frente de trabalho, talhão":"");
    return `<div class="campo"><label for="${id}">${esc(rot)}</label>
      <input type="${tipo}" id="${id}" ${extra} value="${esc(val)}" ${tipo==="number"?'min="0" step="1"':""} placeholder="${esc(ph)}"></div>`;
  };
  alvo.innerHTML=`
    <div class="ck-barra">
      <button class="bt" type="button" data-ck-voltar>← Checklists</button>
      <h2>${esc(m.titulo)}<small>${esc(m.subtitulo||m.ref||"")}${c.codigo?" · "+esc(c.codigo):""}</small></h2>
    </div>
    <div class="ck-progresso"><i id="ck-barra-prog" style="width:0"></i></div>
    <div class="cartao" style="margin-bottom:16px">
      <div class="grade">${m.campos.map(campo).join("")}</div>
    </div>
    ${m.orientacoes&&m.orientacoes.length?`<details class="ck-orient"><summary>Orientações para aplicação</summary>
      <dl>${m.orientacoes.map(o=>`<dt>${esc(o[0])}</dt><dd>${esc(o[1])}</dd>`).join("")}</dl></details>`:""}
    <div class="ck-kpis" id="ck-kpis"></div>
    <div id="ck-corpo"></div>
    <div class="cartao" style="padding:14px;margin-bottom:14px">
      <div class="campo largo"><label for="ck-observacoes">Observações</label>
        <textarea id="ck-observacoes" data-ck-cab="observacoes" rows="3" placeholder="Leitura geral da verificação.">${esc(c.observacoes||"")}</textarea></div>
    </div>
    <div class="ck-fim">
      <button class="bt" type="button" data-ck-voltar>Voltar</button>
      <button class="btn secundario" type="button" data-ck-imprimir>Imprimir / PDF</button>
      <button class="btn" type="button" data-ck-salvar>Salvar checklist</button>
    </div>`;
  ckRenderPreencher();
}

function ckContagem(blocos){
  const t={total:0,C:0,NC:0,NA:0,sem:0};
  (blocos||[]).forEach(b=>(b.itens||[]).forEach(i=>{
    t.total++; if(i.r==="C")t.C++; else if(i.r==="NC")t.NC++; else if(i.r==="NA")t.NA++; else t.sem++;
  }));
  t.pc=(t.C+t.NC)?Math.round(t.C*100/(t.C+t.NC)):null;
  return t;
}

function ckRenderPreencher(){
  const corpo=$("#ck-corpo"); if(!corpo||!estado.modelo)return;
  const blocos=chkLista(), t=ckContagem(blocos);
  const k=$("#ck-kpis");
  if(k)k.innerHTML=`
    <div class="ck-kpi"><b>${t.total}</b><span>Itens</span></div>
    <div class="ck-kpi c"><b>${t.C}</b><span>Conformes</span></div>
    <div class="ck-kpi nc"><b>${t.NC}</b><span>Não conformes</span></div>
    <div class="ck-kpi na"><b>${t.NA}</b><span>Não aplicáveis</span></div>
    <div class="ck-kpi sr"><b>${t.sem}</b><span>Sem resposta</span></div>`;
  const p=$("#ck-barra-prog"); if(p)p.style.width=(t.total?Math.round((t.total-t.sem)*100/t.total):0)+"%";

  corpo.innerHTML=blocos.map((b,bi)=>{
    const nc=b.itens.filter(i=>i.r==="NC").length, feitos=b.itens.filter(i=>i.r).length;
    return `<div class="ck-grupo">
      <div class="ck-grupo-topo">
        <span class="n">${bi+1}</span><span class="tt">${esc(b.titulo)}</span>
        <span class="ck-conta">${feitos}/${b.itens.length}${nc?` · ${nc} NC`:""}</span>
        ${feitos<b.itens.length?`<button type="button" data-ck-todos="${esc(b.id)}" title="Marca como Conforme os itens ainda sem resposta">Restantes conformes</button>`:""}
      </div>
      ${b.itens.map(it=>{
        const ap=it.r==="NC"?estado.itens.find(x=>x.origemChk===b.id+":"+it.n):null;
        return `<div class="ck-item${it.r?" r-"+it.r:""}">
        <div class="ck-txt"><span class="cod">${esc(it.cod||(bi+1)+"."+it.n)}</span>${esc(it.txt)}</div>
        <div class="ck-resp">
          ${[["C","C","Conforme"],["NC","NC","Não conforme"],["NA","NA","Não se aplica"]].map(([v,rot,tit])=>
            `<button type="button" class="ck-bt r-${v}${it.r===v?" on":""}" title="${tit}" data-chk-r="${v}" data-bloco="${esc(b.id)}" data-n="${it.n}">${rot}</button>`).join("")}
          <button type="button" class="ck-bt foto" data-chk-foto="1" data-bloco="${esc(b.id)}" data-n="${it.n}">＋ foto${it.fotos&&it.fotos.length?" ("+it.fotos.length+")":""}</button>
        </div>
        ${it.r==="NC"||it.obs?`<input type="text" class="ck-obs" placeholder="Ação necessária / prazo" value="${esc(it.obs||"")}"
               data-chk-obs="1" data-bloco="${esc(b.id)}" data-n="${it.n}">`:""}
        ${ap?`<div class="ck-apont">Apontamento aberto na aba Vistoria · prazo ${esc(ap.prazo||"")}${ap.prazoData?" (até "+dataBR(ap.prazoData)+")":""}</div>`:""}
        ${(it.fotos&&it.fotos.length)?`<div class="chk-fotos">${it.fotos.map((f,fi)=>
          `<figure><img src="${esc(f.url||f.assinada||"")}" alt="Foto do item ${esc(it.cod||"")}">
           <button type="button" class="x" data-chk-tirar="${fi}" data-bloco="${esc(b.id)}" data-n="${it.n}" title="Tirar foto">×</button></figure>`).join("")}</div>`:""}
      </div>`;}).join("")}
    </div>`;}).join("");
}

/* ─────────── eventos do módulo ─────────── */
$("#painel-checklists").addEventListener("click",ev=>{
  const t=ev.target;
  const ini=t.closest("[data-ck-iniciar]"); if(ini){ckIniciar(ini.dataset.ckIniciar);return;}
  if(t.closest("[data-ck-continuar]")){ckMostrar("preencher");return;}
  if(t.closest("[data-ck-voltar]")){ckMostrar("lista");return;}
  if(t.closest("[data-ck-salvar]")){salvarVistoria().then(()=>{ if(estado.modelo)ckMontarTela(); });return;}
  if(t.closest("[data-ck-imprimir]")){imprimir();return;}
  const todos=t.closest("[data-ck-todos]");
  if(todos){
    const b=chkBloco(todos.dataset.ckTodos); if(!b)return;
    b.itens.forEach(i=>{ if(!i.r)i.r="C"; });
    chkRender(); render(); salvar();
    return;
  }
});
$("#painel-checklists").addEventListener("input",ev=>{
  const el=ev.target;
  if(el.dataset.ckCab){
    estado.cab[el.dataset.ckCab]=el.value;
    const espelho=document.querySelector(`#painel-vistoria [data-cab="${el.dataset.ckCab}"]`);
    if(espelho)espelho.value=el.value;
    salvar(); return;
  }
  if(el.dataset.ckVal!==undefined&&estado.modelo){
    (estado.modelo.valores=estado.modelo.valores||{})[el.dataset.ckVal]=el.value;
    salvar(); return;
  }
});

/* ═══════════ Relatório no modelo "visita técnica de campo" ═══════════
   Um só desenho para tudo o que o app imprime — vistoria, checklist da
   norma, checklist pronto e vistoria antiga aberta pela base:
     cabeçalho em quadro (data, início, fim, avaliador, avaliado)
     RESULTADOS em tópicos numerados, cada item com a resposta à direita
       e a observação logo abaixo
     depois de cada tópico, "Fotos das questões do tópico N", duas por
       linha, cada foto com o texto do item — um item pode ter várias
     observações do técnico e o fecho com técnico, registro e responsável
   Numeração de página e código do documento no rodapé de cada folha. */

const PD_RESP={C:["Conforme","c"],NC:["Não conforme","nc"],NA:["Não se aplica","na"],"":["Sem resposta","sr"]};

function pdData(iso){ return iso?dataBR(String(iso).slice(0,10)):""; }

function pdLinha(rot,val){
  return `<div class="pd-item"><div class="pd-q">${rot}</div><div class="pd-r">${val||"—"}</div></div>`;
}

function pdFotos(titulo,fotos){
  if(!fotos.length)return "";
  return `<div class="pd-faixa">${titulo}</div>
    <div class="pd-fotos">${fotos.map(f=>`<figure class="pd-foto"><figcaption>${esc(f.leg)}</figcaption>
      <img src="${esc(f.src)}" alt=""></figure>`).join("")}</div>`;
}

function pdTopico(num,titulo,corpo,cls){
  return `<section class="pd-topico${cls?" "+cls:""}">
    <div class="pd-tt"><span class="n">${num==null?"":num}</span><span>${titulo}</span></div>
    ${corpo}</section>`;
}

/* d = {titulo, subtitulo, codigo, logo, quadro:[[rot,val]...], ident:[[rot,val]...],
        blocos:[{titulo, itens:[{cod,txt,r,obs,obsRot,prazo,fotos:[src]}]}],
        apont:[{titulo,grau,local,encontrada,risco,normas:[{ref,item,txt,ok}],requerida,acao,
                prazo,prazoData,responsavel,evidencia,situacao,encerramento,fotos:[{src,leg}]}],
        observacoes, fecho:[[rot,val]...], resumo:bool} */
function pdoc(d){
  let n=0;
  const partes=[];

  /* identificação */
  if(d.ident&&d.ident.length)
    partes.push(pdTopico(null,"Identificação",d.ident.map(([r,v])=>pdLinha(esc(r),esc(v))).join(""),"pd-dados"));

  /* resumo do checklist */
  const t={total:0,C:0,NC:0,NA:0,sem:0};
  (d.blocos||[]).forEach(b=>b.itens.forEach(i=>{t.total++; if(i.r==="C")t.C++; else if(i.r==="NC")t.NC++; else if(i.r==="NA")t.NA++; else t.sem++;}));
  const pc=(t.C+t.NC)?Math.round(t.C*100/(t.C+t.NC)):null;
  if(t.total)partes.push(`<div class="pd-resumo">
      <div><b>${t.total}</b><span>Itens verificados</span></div>
      <div class="c"><b>${t.C}</b><span>Conformes</span></div>
      <div class="nc"><b>${t.NC}</b><span>Não conformes</span></div>
      <div><b>${t.NA}</b><span>Não se aplica</span></div>
      ${t.sem?`<div class="sr"><b>${t.sem}</b><span>Sem resposta</span></div>`:""}
      <div class="pc"><b>${pc==null?"—":pc+"%"}</b><span>Conformidade</span></div></div>`);

  /* um tópico por bloco do checklist, com as fotos logo depois */
  (d.blocos||[]).forEach(b=>{
    n++;
    const titulo=esc(b.titulo);
    const linhas=b.itens.map((it,k)=>{
      const cod=it.cod||`${n}.${k+1}`;
      const [rot,cls]=PD_RESP[it.r||""]||PD_RESP[""];
      const obs=[];
      if(it.obs)obs.push(`${esc(it.obsRot||"Observação")}: ${esc(it.obs)}`);
      if(it.r==="NC"&&it.prazo)obs.push(`Prazo para correção: ${pdData(it.prazo)}`);
      return `<div class="pd-item${it.r==="NC"?" nc":""}"><div class="pd-q">${esc(cod)} - ${esc(it.txt)}</div>
        <div class="pd-r r-${cls}">${rot}</div>
        ${obs.length?`<div class="pd-obs">${obs.join("<br>")}</div>`:""}</div>`;
    }).join("");
    const fotos=[];
    b.itens.forEach((it,k)=>(it.fotos||[]).forEach(src=>{ if(src)fotos.push({src,leg:`${it.cod||n+"."+(k+1)} - ${it.txt}`}); }));
    partes.push(pdTopico(n,titulo,linhas+pdFotos(`Fotos das questões do tópico ${n} - ${titulo}`,fotos)));
  });

  /* não conformidades registradas na vistoria */
  const ap=d.apont||[];
  if(ap.length){
    n++;
    const num=n;
    const linhas=ap.map((a,i)=>{
      const g=(GRAUS[a.grau]||GRAUS["Médio"]).doc;
      const normas=(a.normas||[]).map(x=>`${esc(x.ref)}${x.item&&x.item!=="—"?", item "+esc(x.item):""}${x.ok===false?" (confirmar item)":""} — ${esc(x.txt)}`).join("<br>");
      const obs=[
        a.local&&`Local: ${esc(a.local)}`,
        a.encontrada&&`Situação encontrada: ${nl(a.encontrada)}`,
        a.risco&&`Risco: ${nl(a.risco)}`,
        normas&&`Requisito: ${normas}`,
        a.requerida&&`Situação requerida: ${nl(a.requerida)}`,
        a.acao&&`Ação corretiva: ${nl(a.acao)}`,
        (a.prazo||a.prazoData)&&`Prazo: ${esc(a.prazo||"")}${a.prazoData?" · até "+pdData(a.prazoData):""}`,
        a.responsavel&&`Responsável: ${esc(a.responsavel)}`,
        a.evidencia&&`Evidência para encerrar: ${nl(a.evidencia)}`,
        a.situacao&&`Situação atual: ${esc(a.situacao)}`,
        a.encerramento&&`Encerramento: ${esc(a.encerramento)}`
      ].filter(Boolean).join("<br>");
      return `<div class="pd-item nc"><div class="pd-q">${num}.${i+1} - ${esc(a.titulo)}</div>
        <div class="pd-r"><span class="pd-grau g-${g}">${esc(a.grau||"")}</span></div>
        <div class="pd-obs">${obs}</div></div>`;
    }).join("");
    const fotos=[];
    ap.forEach((a,i)=>(a.fotos||[]).forEach(f=>{ if(f.src)fotos.push({src:f.src,leg:`${num}.${i+1} - ${a.titulo} · ${f.leg}`}); }));
    const plano=`<table class="pd-plano"><thead><tr><th style="width:40px">Nº</th><th>Ação corretiva</th><th style="width:110px">Responsável</th><th style="width:78px">Prazo</th>${ap.some(a=>a.situacao)?'<th style="width:100px">Situação</th>':""}</tr></thead>
      <tbody>${ap.map((a,i)=>`<tr><td>${num}.${i+1}</td><td>${esc(a.acao)||"—"}</td><td>${esc(a.responsavel)||"—"}</td>
        <td>${a.prazoData?pdData(a.prazoData):esc(a.prazo)||"—"}</td>${ap.some(x=>x.situacao)?`<td>${esc(a.situacao||"")}</td>`:""}</tr>`).join("")}</tbody></table>`;
    partes.push(pdTopico(num,"Não conformidades e plano de ação",
      linhas+pdFotos(`Fotos das questões do tópico ${num} - Não conformidades`,fotos)+
      `<div class="pd-sub">Plano de ação</div>`+plano));
  }

  if(d.observacoes&&String(d.observacoes).trim())
    partes.push(pdTopico(null,"Observações do técnico",
      `<div class="pd-item"><div class="pd-texto">${nl(d.observacoes)}</div></div>`));

  if(d.fecho&&d.fecho.length)
    partes.push(pdTopico(null,"Técnico de segurança e responsável do setor",
      d.fecho.map(([r,v])=>pdLinha(esc(r),esc(v))).join(""),"pd-dados"));

  const quadro=(d.quadro||[]).filter(q=>q[1]);
  const rodapeTxt=`${d.codigo||"(sem número)"} · ${d.titulo} · SAKUMA Agronegócios`.replace(/["\\]/g,"");
  return `
    <style>@media print{@page{@bottom-left{content:"${rodapeTxt}"}}}</style>
    <div class="pd-cab">
      <div class="pd-titulo"><h1>${esc(d.titulo)}</h1>${d.subtitulo?`<p>${esc(d.subtitulo)}</p>`:""}</div>
      <img src="${d.logo||LOGO}" alt="SAKUMA Agronegócios">
    </div>
    <div class="pd-quadro">${quadro.map(([r,v])=>`<div><span>${esc(r)}</span><b>${esc(v)}</b></div>`).join("")}</div>
    <h2 class="pd-resultados">Resultados</h2>
    ${partes.join("")}
    ${docLop()}`;
}

/* ─────────── montar os dados: rascunho deste aparelho ─────────── */
function pdocRascunho(){
  const c=estado.cab, m=estado.modelo;
  const blocos=chkLista().map(b=>({
    titulo:(b.ref?b.ref+" ":"")+b.titulo,
    itens:b.itens.map(it=>{
      const ap=it.r==="NC"?estado.itens.find(x=>x.origemChk===b.id+":"+it.n):null;
      return {cod:it.cod||"",txt:it.txt,r:it.r||"",obs:it.obs||"",obsRot:m?"Ação necessária":"Observação",
        prazo:ap&&ap.prazoData||"",fotos:(it.fotos||[]).map(f=>f.url||f.assinada||"")};
    })
  }));
  /* no checklist pronto os itens NC já aparecem no tópico dele — os
     apontamentos entram de novo só quando foram lançados à parte */
  const apont=estado.itens.filter(it=>!(m&&it.origemChk)).map(it=>({
    titulo:it.titulo,grau:it.grau,local:it.local,encontrada:it.encontrada,risco:it.risco,
    normas:typeof normasDoItem==="function"?normasDoItem(it):[],requerida:it.requerida,acao:it.acao,
    prazo:it.prazo,prazoData:it.prazoData,responsavel:it.responsavel,evidencia:it.evidencia,
    fotos:[{src:it.fotoE,leg:"Situação encontrada"},{src:it.fotoR,leg:"Situação requerida"}]
  }));
  return pdoc(pdDados(c,m,blocos,apont,null));
}

/* cabeçalho, identificação e fecho — iguais para rascunho e para vistoria salva */
function pdDados(c,m,blocos,apont,logo){
  const quadro=[["Data",pdData(c.data)],["Início",c.inicio||""],["Avaliador",[c.tecnico,c.cargo].filter(Boolean).join(" — ")],
    ["Fim",c.fim||""],["Avaliado",[c.unidade,c.proprietario].filter(Boolean).join(" · ")],["Código",c.codigo||""]];
  let ident, fecho, titulo, subtitulo;
  if(m){
    titulo=m.titulo||"Checklist de verificação"; subtitulo=m.subtitulo||m.ref||"";
    ident=(m.campos||[]).map(rot=>{
      let v=ckValor(rot,c,m); if(ckTipo(rot)==="date"&&v)v=pdData(v); return [rot,v];
    });
    fecho=[["Elaboração",[c.tecnico,c.cargo].filter(Boolean).join(" — ")+(c.tecnicoRegistro?" · Registro: "+c.tecnicoRegistro:"")],
      ["Responsável",c.responsavelTurma||""],["Aprovação",[ckValor("Aprovação",c,m)||c.aprovador,c.aprovadorCargo].filter(Boolean).join(" — ")]];
  }else{
    titulo="Visita Técnica de Campo"; subtitulo=c.motivo||"Relatório de vistoria de conformidade";
    ident=[["Fazenda / unidade",c.unidade],["Setor ou área",c.setor],["Proprietário",c.proprietario],
      ["Responsável pela turma",c.responsavelTurma],["Nº de colaboradores na frente de trabalho",c.colaboradores]]
      .filter(x=>x[1]!==undefined&&x[1]!==null&&String(x[1]).trim()!=="").map(x=>[x[0],String(x[1])]);
    fecho=[["Técnico de segurança do trabalho",(c.tecnico||"")+(c.tecnicoRegistro?" · Registro: "+c.tecnicoRegistro:"")],
      ["Cargo",c.cargo||""],["Responsável do setor",c.responsavelTurma||""],
      ["Aprovado por",[c.aprovador,c.aprovadorCargo].filter(Boolean).join(" — ")]].filter(x=>x[1]);
  }
  return {titulo,subtitulo,codigo:c.codigo,logo,quadro,ident,blocos,apont,observacoes:c.observacoes,fecho};
}

/* ─────────── vistoria salva na base (vistorias.js) ───────────
   sit(it) devolve o texto da situação atual; normas(it) o texto congelado. */
window.pdocSalvo=function(v,itens,logo,sit,normas){
  const blocosBase=Array.isArray(v.checklist)?v.checklist:[];
  const m=blocosBase.length&&blocosBase[0].modelo?blocosBase[0].modelo:null;
  const c={unidade:v.unidade,setor:v.setor,data:v.data,tecnico:v.tecnico,cargo:v.cargo,
    aprovador:v.aprovador,aprovadorCargo:v.aprovador_cargo,colaboradores:v.colaboradores,
    responsavelTurma:v.responsavel_turma,proprietario:v.proprietario,codigo:v.codigo,
    observacoes:v.observacoes,inicio:v.hora_inicio,fim:v.hora_fim,tecnicoRegistro:v.tecnico_registro,motivo:v.motivo};
  const blocos=blocosBase.map(b=>({
    titulo:(b.ref?b.ref+" ":"")+b.titulo,
    itens:(b.itens||[]).map(it=>({cod:it.cod||"",txt:it.txt,r:it.r||"",obs:it.obs||"",
      obsRot:m?"Ação necessária":"Observação",prazo:it.prazo||"",fotos:(it.fotos||[]).map(f=>f._url||"")}))
  }));
  const apont=(itens||[]).filter(it=>!(m&&m.sigla&&String(it.titulo||"").startsWith(m.sigla+" ")))
    .map(it=>({titulo:it.titulo,grau:it.grau,local:it.local,encontrada:it.encontrada,risco:it.risco,
      normas:normas?normas(it):[],requerida:it.requerida,acao:it.acao,prazo:it.prazo,prazoData:it.prazo_data,
      responsavel:it.responsavel,evidencia:it.evidencia,situacao:sit?sit(it):"",
      encerramento:it.status==="Concluído"?(pdData(it.encerrado_em)+(it.encerrado_obs?" — "+it.encerrado_obs:"")):"",
      fotos:[{src:it._fotoE,leg:"Situação encontrada"},{src:it._fotoR,leg:"Situação requerida"},{src:it._fotoC,leg:"Evidência do encerramento"}]}));
  return pdoc(pdDados(c,m,blocos,apont,logo));
};


/* ─────────── Configurações: cadastro dos checklists prontos ─────────── */
let ckEditando=null;

function ckRenderConfig(){
  const corpo=$("#md-corpo"); if(!corpo)return;
  const ms=ckModelos(), chaves=Object.keys(ms);
  corpo.innerHTML=chaves.length?chaves.map(k=>`<tr>
      <td><b>${esc(ms[k].sigla||"")}</b>${ms[k].sigla?" · ":""}${esc(ms[k].titulo)}<div class="cfg-cat" style="text-transform:none">${esc(ms[k].subtitulo||"")}</div></td>
      <td style="text-align:center">${ckTotalItens(ms[k])}</td>
      <td><button class="bt-mini" type="button" data-md-editar="${esc(k)}">editar</button></td>
      <td><button class="bt-mini" type="button" data-md-apagar="${esc(k)}" title="Tirar da lista">×</button></td></tr>`).join("")
    :'<tr><td colspan="4" class="cfg-padrao">Nenhum checklist. Importe uma planilha.</td></tr>';
  const tv=$("#trava-modelos"); if(tv)tv.hidden=souAdmin;
  ckRenderEditor();
}

function ckTextoItens(m){
  return (m.grupos||[]).flatMap(g=>(g.itens||[]).map(x=>`${x[0]} | ${g.titulo} | ${x[1]}`)).join("\n");
}

function ckRenderEditor(){
  const cx=$("#md-editor"); if(!cx)return;
  if(!ckEditando){cx.innerHTML="";return;}
  const m=ckEditando;
  cx.innerHTML=`
    <div class="grade" style="padding:0;margin-top:14px">
      <div class="campo"><label for="md-sigla">Sigla</label><input type="text" id="md-sigla" value="${esc(m.sigla||"")}" placeholder="NR-24"></div>
      <div class="campo largo"><label for="md-titulo">Título</label><input type="text" id="md-titulo" value="${esc(m.titulo||"")}" placeholder="Checklist de Verificação – NR-24"></div>
      <div class="campo largo"><label for="md-sub">Subtítulo / norma</label><input type="text" id="md-sub" value="${esc(m.subtitulo||"")}" placeholder="Portaria MTE nº 1.590/2026"></div>
    </div>
    <div class="campo largo" style="margin-top:10px"><label for="md-campos">Campos do cabeçalho — um por linha</label>
      <textarea id="md-campos" rows="5" spellcheck="false">${esc((m.campos||[]).join("\n"))}</textarea></div>
    <div class="campo largo" style="margin-top:10px"><label for="md-itens">Itens — um por linha: Nº | Categoria | Item de verificação</label>
      <textarea id="md-itens" rows="12" spellcheck="false">${esc(ckTextoItens(m))}</textarea></div>
    <div class="campo largo" style="margin-top:10px"><label for="md-orient">Orientações — uma por linha: Assunto | Orientação</label>
      <textarea id="md-orient" rows="4" spellcheck="false">${esc((m.orientacoes||[]).map(o=>o[0]+" | "+o[1]).join("\n"))}</textarea></div>
    <div class="rodape-item" style="margin-top:10px">
      <button class="bt bt-fantasma" type="button" id="md-cancelar">Cancelar</button>
      <button class="bt bt-forte" type="button" id="md-guardar">Guardar checklist</button>
    </div>`;
  $("#md-cancelar").onclick=()=>{ckEditando=null;ckRenderEditor();};
  $("#md-guardar").onclick=()=>{
    const titulo=$("#md-titulo").value.trim();
    if(!titulo){toast("O checklist precisa de um título.");return;}
    const grupos=[], idx={};
    $("#md-itens").value.split("\n").map(l=>l.trim()).filter(Boolean).forEach((l,i)=>{
      const p=l.split("|").map(x=>x.trim());
      let cod,cat,txt;
      if(p.length>=3){[cod,cat,txt]=[p[0],p[1],p.slice(2).join(" | ")];}
      else if(p.length===2){[cod,cat,txt]=[p[0],"Itens",p[1]];}
      else {[cod,cat,txt]=[String(i+1),"Itens",p[0]];}
      if(!(cat in idx)){idx[cat]=grupos.length;grupos.push({titulo:cat,itens:[]});}
      grupos[idx[cat]].itens.push([cod,txt]);
    });
    if(!grupos.length){toast("O checklist precisa de pelo menos um item.");return;}
    const obj={sigla:$("#md-sigla").value.trim(),titulo,subtitulo:$("#md-sub").value.trim(),
      ref:[$("#md-sigla").value.trim(),$("#md-sub").value.trim()].filter(Boolean).join(" · "),
      arquivo:m.arquivo||"",
      campos:$("#md-campos").value.split("\n").map(l=>l.trim().replace(/:$/,"")).filter(Boolean),
      grupos,
      orientacoes:$("#md-orient").value.split("\n").map(l=>l.trim()).filter(Boolean).map(l=>{
        const i=l.indexOf("|"); return i<0?["",l]:[l.slice(0,i).trim(),l.slice(i+1).trim()];})};
    const chave=m.chave||("modelo:"+chkSlug(obj.sigla||titulo)+"-"+Date.now().toString(36).slice(-4));
    chkCustom[chave]=obj;
    ckEditando=null;
    ckRenderConfig(); ckAtualizarTelas();
    toast("Checklist guardado. Clique em Salvar regras para valer para a equipe.");
  };
}

$("#md-corpo").addEventListener("click",ev=>{
  const ed=ev.target.closest("[data-md-editar]");
  if(ed){
    const k=ed.dataset.mdEditar, m=ckModelos()[k]; if(!m)return;
    ckEditando={...m,chave:k}; ckRenderEditor();
    $("#md-titulo").scrollIntoView({block:"center"}); return;
  }
  const ap=ev.target.closest("[data-md-apagar]");
  if(ap){
    const k=ap.dataset.mdApagar;
    if(!confirm("Tirar esse checklist da lista? Os checklists já preenchidos não mudam."))return;
    chkCustom[k]=null;
    if(ckEditando&&ckEditando.chave===k)ckEditando=null;
    ckRenderConfig(); ckAtualizarTelas();
    toast("Checklist removido. Clique em Salvar regras para valer para a equipe.");
  }
});
$("#md-novo").onclick=()=>{
  ckEditando={sigla:"",titulo:"",subtitulo:"",campos:["Fazenda","Data da verificação","Nº de trabalhadores","Responsável","Atividade/Talhão","Elaboração","Aprovação"],grupos:[],orientacoes:[]};
  ckRenderEditor(); $("#md-sigla").focus();
};

/* Importar planilha: lê a planilha no formato do checklist NR-24 — título na
   primeira linha, campos "Rótulo:" no cabeçalho, depois a tabela Nº /
   Categoria / Item de verificação / C / NC / NA. A leitura do Excel usa a
   biblioteca SheetJS, baixada só na hora de importar (precisa de internet). */
function ckCarregarSheetJS(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  return new Promise((ok,erro)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload=()=>ok(window.XLSX); s.onerror=()=>erro(new Error("sem-internet"));
    document.head.appendChild(s);
  });
}

function ckLerPlanilha(wb,nomeArquivo){
  const norm=v=>String(v==null?"":v).trim();
  const semAc=v=>norm(v).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  let achado=null;
  for(const nome of wb.SheetNames){
    const lin=XLSX.utils.sheet_to_json(wb.Sheets[nome],{header:1,defval:""});
    const h=lin.findIndex(r=>r.some(c=>/^item/.test(semAc(c)))&&r.some(c=>semAc(c)==="nc"));
    if(h>=0){achado={nome,lin,h};break;}
  }
  if(!achado)throw new Error("Não achei a tabela do checklist (colunas Nº, Categoria, Item de verificação, C, NC, NA).");
  const {lin,h}=achado, cab=lin[h].map(semAc);
  const iN=cab.findIndex(c=>/^n[º°o]?$|^numero|^item n/.test(c));
  const iCat=cab.findIndex(c=>/^categoria|^grupo|^bloco|^secao/.test(c));
  const iTxt=cab.findIndex(c=>/^item/.test(c)&&!/^item n/.test(c));
  const titulo=norm(lin[0].find(c=>norm(c)))||nomeArquivo.replace(/\.xlsx?$/i,"");
  const campos=[];
  for(let r=1;r<h;r++)lin[r].forEach(c=>{const v=norm(c);if(/:$/.test(v))campos.push(v.replace(/:$/,"").trim());});
  const grupos=[], idx={};
  let catAtual="Itens";
  for(let r=h+1;r<lin.length;r++){
    const txt=norm(lin[r][iTxt]); if(!txt)continue;
    const cod=iN>=0?norm(lin[r][iN]):String(r-h);
    if(iCat>=0&&norm(lin[r][iCat]))catAtual=norm(lin[r][iCat]);
    if(!(catAtual in idx)){idx[catAtual]=grupos.length;grupos.push({titulo:catAtual,itens:[]});}
    grupos[idx[catAtual]].itens.push([cod,txt]);
  }
  if(!grupos.length)throw new Error("A tabela do checklist está vazia.");
  /* orientações: outra aba com duas colunas (assunto | orientação) */
  let orientacoes=[];
  for(const nome of wb.SheetNames){
    if(nome===achado.nome||!/orienta/i.test(nome))continue;
    const l=XLSX.utils.sheet_to_json(wb.Sheets[nome],{header:1,defval:""});
    orientacoes=l.slice(1).filter(r=>norm(r[0])&&norm(r[1])).map(r=>[norm(r[0]),norm(r[1])]);
  }
  const partes=titulo.split("|").map(x=>x.trim());
  const principal=partes[0], sub=partes.slice(1).join(" · ");
  const sigla=(/\b(NR[\s-]?\d+)/i.exec(titulo)||[])[1]||"";
  return {sigla:sigla.toUpperCase().replace(/\s/,"-"),
    titulo:principal.replace(/^CHECKLIST/i,"Checklist").replace(/\bDE VERIFICAÇÃO\b/i,"de Verificação"),
    subtitulo:sub, ref:[sigla,sub].filter(Boolean).join(" · "),
    campos, grupos, orientacoes, arquivo:""};
}

$("#md-importar").onclick=()=>{
  const inp=document.createElement("input");
  inp.type="file"; inp.accept=".xlsx,.xls";
  inp.onchange=async()=>{
    const f=inp.files&&inp.files[0]; if(!f)return;
    const aviso=$("#md-aviso"); aviso.textContent="Lendo a planilha…";
    try{
      await ckCarregarSheetJS();
      const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});
      const m=ckLerPlanilha(wb,f.name);
      ckEditando=m; ckRenderEditor();
      aviso.textContent=`Planilha lida: ${ckTotalItens(m)} itens em ${m.grupos.length} grupos. Confira e clique em Guardar checklist.`;
      $("#md-titulo").scrollIntoView({block:"center"});
    }catch(e){
      aviso.textContent=e.message==="sem-internet"
        ?"Para importar planilha é preciso internet (o leitor de Excel é baixado na hora)."
        :e.message;
    }
  };
  inp.click();
};

/* ─────────── tela inicial ─────────── */
function grRenderInicio(){
  const d=new Date();
  const dias=["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
  const abertos=Number(($("#cont-aberto")||{}).textContent||0);
  const dica=$("#mi-dica");
  if(dica)dica.innerHTML=`Hoje é ${dias[d.getDay()]}, ${d.toLocaleDateString("pt-BR")}`+
    (abertos?` — <strong>${abertos} apontamento${abertos>1?"s":""} em aberto</strong>.`:".");
  const n=$("#mi-aberto"); if(n)n.textContent=abertos?abertos+" pendente"+(abertos>1?"s":""):"";
  const ms=ckModelos(), chaves=Object.keys(ms);
  const alvo=$("#mi-modelos");
  if(alvo)alvo.innerHTML=chaves.length?`<span class="rot">Preencher agora</span>`+
    chaves.map(k=>`<button type="button" class="mi-modelo" data-ck-iniciar-inicio="${esc(k)}">${esc(ms[k].sigla||ms[k].titulo)}</button>`).join(""):"";
}

function ckAtualizarTelas(){
  grRenderInicio();
  if($("#ck-lista")&&!$("#ck-lista").hidden)ckRenderLista();
}

/* ─────────── ligações com o resto do app ─────────── */
const _abaGR=aba;
aba=function(qual){
  _abaGR(qual);
  document.body.classList.toggle("no-inicio",qual==="inicio");
  document.body.dataset.aba=qual;
  if(qual==="inicio")grRenderInicio();
  if(qual==="checklists"&&!$("#ck-lista").hidden)ckRenderLista();
};
$("#t-inicio").onclick=()=>aba("inicio");
$("#bt-inicio").onclick=()=>aba("inicio");
$("#t-checklists").onclick=()=>ckMostrar(estado.modelo&&!estado.salvoEm?"preencher":"lista");
$("#painel-inicio").addEventListener("click",ev=>{
  const m=ev.target.closest("[data-ck-iniciar-inicio]");
  if(m){ckIniciar(m.dataset.ckIniciarInicio);return;}
  const ir=ev.target.closest("[data-ir]"); if(!ir)return;
  const q=ir.dataset.ir;
  if(q==="checklists")ckMostrar("lista");
  else if(q==="aberto"){carregarPendencias();aba("aberto");}
  else aba(q);
});

/* botão do aviso na aba Vistoria: sair do checklist pronto e começar uma vistoria comum */
document.addEventListener("click",ev=>{
  if(ev.target.closest("[data-gr-nova]")){const b=$("#bt-nova-vistoria");if(b)b.click();}
});
const _renderConfigGR=renderConfig;
renderConfig=function(){ _renderConfigGR.apply(this,arguments); ckRenderConfig(); };
const _aplicarRegrasGR=aplicarRegras;
aplicarRegras=function(){ const r=_aplicarRegrasGR.apply(this,arguments); ckAtualizarTelas(); return r; };
const _renderAbertoGR=renderAberto;
renderAberto=function(){ const r=_renderAbertoGR.apply(this,arguments); grRenderInicio(); return r; };
const _abrirAppGR=abrirApp;
abrirApp=async function(){ const r=await _abrirAppGR.apply(this,arguments); if(!grParametroAba)aba("inicio"); return r; };

/* abre na tela inicial, como os outros Gestão Rápida — a não ser que o
   atalho do app peça outra coisa */
const grParametroAba=new URLSearchParams(location.search).get("aba")||
  (new URLSearchParams(location.search).get("acao")==="nova"?"vistoria":"");
if(grParametroAba==="checklists")ckMostrar("lista");
else if(grParametroAba)aba(grParametroAba);
else aba("inicio");
ckRenderConfig();
