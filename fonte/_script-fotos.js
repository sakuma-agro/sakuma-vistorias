/* ══════════════════════════════════════════════════════════════════════════
   Fotos no Google Drive (conta escritoriosakuma1@gmail.com)
   O app não fala com o Google: fala com a função "fotos" do Supabase, que
   guarda a autorização do Drive no servidor. Aqui só trocamos as três portas
   por onde toda foto passa: enviarFoto, urlDaFoto e apagarFoto.

   Regra de segurança da troca: se o Drive não estiver configurado, ou a
   autorização expirar, tudo volta a funcionar como antes, no bucket do
   Supabase. Fotos antigas (no bucket) continuam abrindo normalmente.

   <script> próprio, carregado por último: se der erro aqui, as funções
   originais continuam valendo. Nomes começam com "fd".
   ══════════════════════════════════════════════════════════════════════════ */

const FD_FUNCAO = () => `${cfg.url}/functions/v1/fotos`;
let fdEstado = null;                 /* Promise<{drive, conta, livre_gb, erro}> */
const fdCache = new Map();           /* caminho → Promise<url> (blob: ou data:) */
const _enviarFotoSB = enviarFoto, _urlDaFotoSB = urlDaFoto;

function fdStatus(){
  if(!fdEstado){
    fdEstado = (async()=>{
      try{
        const h = await comToken();
        const r = await fetch(`${FD_FUNCAO()}?acao=status`, {headers:h});
        if(!r.ok) return {drive:false, erro:"http-"+r.status};
        return await r.json();
      }catch(e){
        /* sem rede ou sem login: tenta de novo na próxima foto */
        setTimeout(()=>{ fdEstado=null; }, 0);
        return {drive:false, erro:"rede"};
      }
    })();
  }
  return fdEstado;
}

enviarFoto = async function(caminho, dataUrl){
  const st = await fdStatus();
  if(!st.drive) return _enviarFotoSB(caminho, dataUrl);
  const h = await comToken();
  const blob = dataUrlParaBlob(dataUrl);
  const r = await fetch(`${FD_FUNCAO()}?acao=enviar&caminho=${encodeURIComponent(caminho)}`,
    {method:"POST", headers:{...h, "Content-Type":blob.type||"image/jpeg"}, body:blob});
  if(r.status===503){                /* Drive saiu do ar ou autorização expirou: grava no Supabase */
    fdEstado = null;
    console.warn("fotos: Drive indisponível, gravando no Supabase", await r.text());
    return _enviarFotoSB(caminho, dataUrl);
  }
  if(!r.ok) throw new Error("Falha ao enviar a foto: "+(await r.text()).slice(0,160));
  fdCache.set(caminho, Promise.resolve(dataUrl));    /* acabou de tirar: mostra sem baixar de novo */
  return caminho;
};

urlDaFoto = function(caminho){
  if(!caminho) return Promise.resolve("");
  if(fdCache.has(caminho)) return fdCache.get(caminho);
  const p = (async()=>{
    const st = await fdStatus();
    if(st.drive){
      try{
        const h = await comToken();
        const r = await fetch(`${FD_FUNCAO()}?acao=ver&caminho=${encodeURIComponent(caminho)}`, {headers:h});
        if(!r.ok) return "";                 /* sem acesso ou falha: igual ao bucket, sem foto */
        if(!/json/.test(r.headers.get("content-type")||"")) return URL.createObjectURL(await r.blob());
        /* {origem:"supabase"}: foto antiga, segue para o bucket */
      }catch(e){ return ""; }
    }
    return await _urlDaFotoSB(caminho);    /* foto antiga, ainda no bucket do Supabase */
  })();
  fdCache.set(caminho, p);
  p.then(u=>{ if(!u) fdCache.delete(caminho); });
  return p;
};

/* apagar: no Drive (vai para a lixeira) ou, se for foto antiga, no bucket */
window.apagarFoto = async function(caminho){
  if(!caminho) return;
  fdCache.delete(caminho);
  const h = await comToken();
  const st = await fdStatus();
  if(st.drive){
    const r = await fetch(`${FD_FUNCAO()}?acao=apagar&caminho=${encodeURIComponent(caminho)}`, {method:"POST", headers:h});
    if(r.status===403) return;
    if(r.ok){ const d=await r.json().catch(()=>({})); if(d.origem!=="supabase") return; }
  }
  await fetch(`${cfg.url}/storage/v1/object/${encodeURI("vistorias/"+caminho)}`, {method:"DELETE", headers:h});
};

/* sair da conta: esquece as fotos já abertas neste aparelho */
document.addEventListener("click", ev=>{
  if(ev.target.closest && ev.target.closest("#bt-sair")){
    fdCache.forEach(p=>p.then(u=>{ if(String(u).startsWith("blob:")) URL.revokeObjectURL(u); }));
    fdCache.clear(); fdEstado = null;
  }
}, true);

/* Configurações: mostra onde as fotos estão sendo guardadas */
function fdRenderConfig(){
  const pai = $("#painel-config"); if(!pai) return;
  let box = $("#fd-config");
  if(!box){
    box = document.createElement("div"); box.id = "fd-config"; box.className = "cfg-secao";
    pai.appendChild(box);
  }
  box.innerHTML = `<h3>Onde ficam as fotos</h3><p class="fd-linha">Conferindo…</p>`;
  fdStatus().then(st=>{
    const l = box.querySelector(".fd-linha"); if(!l) return;
    if(st.drive){
      l.innerHTML = `<span class="ex-selo ok">Google Drive</span> As fotos novas vão para a pasta <b>SAKUMA Vistorias – fotos</b>`+
        `${st.conta?` da conta <b>${esc(st.conta)}</b>`:""}${st.livre_gb!=null?` · ${String(st.livre_gb).replace(".",",")} GB livres`:""}. As fotos antigas continuam abrindo da base.`;
    }else{
      const motivo = {"drive-nao-configurado":"o Drive ainda não foi ligado","drive-autorizacao-expirou":"a autorização do Google expirou — é preciso autorizar de novo",
        "rede":"sem conexão agora"}[st.erro] || "o Drive não respondeu";
      l.innerHTML = `<span class="ex-selo sem">Base do Supabase</span> As fotos estão sendo guardadas na base (1 GB gratuito) porque ${esc(motivo)}.`;
    }
  });
}
const _renderConfigFD = renderConfig;
renderConfig = function(){ const r=_renderConfigFD.apply(this, arguments); try{ fdRenderConfig(); }catch(e){} return r; };
