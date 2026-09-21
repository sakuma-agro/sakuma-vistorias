script = open('_script.js', encoding='utf-8').read()
def troca(v,n,nome):
    global script
    if v not in script: raise SystemExit('NÃO ENCONTRADO: '+nome)
    script = script.replace(v,n,1)

troca('codigo:""},itens:[]};\nlet proximoId=1;',
      'codigo:""},id:null,salvoEm:null,itens:[]};\nlet proximoId=1;','estado')
troca('''    fotoE:"",fotoR:""
  };''',
'''    fotoE:"",fotoR:"",
    uid:uuid(),status:"Aberto",prazoData:"",
    fotoEPath:"",fotoRPath:"",fotoC:"",fotoCPath:"",encerradoEm:"",encerradoObs:""
  };''','novoItem')
troca("""function aba(qual){
  const v=qual==="vistoria";
  $("#painel-vistoria").hidden=!v;
  $("#painel-relatorio").hidden=v;
  $("#t-vistoria").setAttribute("aria-selected",v);
  $("#t-relatorio").setAttribute("aria-selected",!v);
  window.scrollTo({top:0,behavior:"smooth"});
}
$("#t-vistoria").onclick=()=>aba("vistoria");
$("#t-relatorio").onclick=()=>{renderDoc();aba("relatorio");};""",
"""const PAINEIS=["inicio","checklists","vistoria","aberto","relatorio","config"];
function aba(qual){
  PAINEIS.forEach(p=>{
    $("#painel-"+p).hidden = p!==qual;
    $("#t-"+p).setAttribute("aria-selected", String(p===qual));
  });
  window.scrollTo({top:0,behavior:"smooth"});
}
$("#t-vistoria").onclick=()=>aba("vistoria");
$("#t-aberto").onclick=()=>{carregarPendencias();aba("aberto");};
$("#t-relatorio").onclick=()=>{renderDoc();aba("relatorio");};
$("#t-config").onclick=()=>{renderConfig();aba("config");};""",'abas')

troca('codigo:""},itens:[]};\n  proximoId=1;',
      'codigo:""},id:uuid(),salvoEm:null,itens:[]};\n  proximoId=1;','limpar')


troca("""    const normas=it.normas.map(k=>{
      const n=NORMAS[k];if(!n)return"";
      const item=n.item&&n.item!=="—"?`, item ${esc(n.item)}`:"";
      return `<div class="doc-norma"><b>${esc(n.ref)}${item}${n.ok?"":'<span class="conf">confirmar item</span>'}</b><i>${esc(n.txt)}</i></div>`;
    }).join("")||`<div class="doc-texto">Requisito não vinculado.</div>`;""",
"""    const normas=normasDoItem(it).map(n=>{
      const item=n.item&&n.item!=="—"?`, item ${esc(n.item)}`:"";
      return `<div class="doc-norma"><b>${esc(n.ref)}${item}${n.ok?"":'<span class="conf">confirmar item</span>'}</b><i>${esc(n.txt)}</i></div>`;
    }).join("")||`<div class="doc-texto">Requisito não vinculado.</div>`;""",'normas do relatorio')

troca("""function opcoesAnomalia(sel){
  return CATEGORIAS.map(c=>{
    const opts=Object.entries(ANOMALIAS).filter(([,a])=>a.cat===c.id)""",
"""function opcoesAnomalia(sel){
  return CATEGORIAS.map(c=>{
    const opts=Object.entries(ANOMALIAS).filter(([k,a])=>a.cat===c.id&&(k===sel||!a.oculta))""",'anomalias ocultas')


extra  = open('_script-extra.js', encoding='utf-8').read() + '\n' + open('_script-gr.js', encoding='utf-8').read()
estilo = open('_estilo.css', encoding='utf-8').read() + open('_estilo-extra.css', encoding='utf-8').read() + open('_estilo-gr.css', encoding='utf-8').read()
markup = open('_markup.html', encoding='utf-8').read()

CABECA = '''<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Gestão Rápida (Vistorias e Segurança) · SAKUMA</title>
<meta name="description" content="Vistorias e checklists de segurança da SAKUMA Agronegócios: não conformidades com a norma citada, checklists prontos para preencher, pendências da equipe e relatório em PDF.">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#84BD00">
<meta name="color-scheme" content="light">
<link rel="icon" href="icons/favicon-gr-vs.v1.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="icons/gr-vs-32.v1.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/gr-vs-192.v1.png">
<link rel="apple-touch-icon" href="icons/gr-vs-apple-180.v1.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Vistorias">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="mobile-web-app-capable" content="yes">
'''

corpo = (markup + '\n<script src="config.js"></script>\n<script>\n' + script + '\n' + extra
         + '\n</script>\n<script src="vistorias.js"></script>\n')
open('../index.html','w',encoding='utf-8').write(
 f'<!doctype html>\n<html lang="pt-BR" data-theme="light">\n<head>\n{CABECA}\n<style>{estilo}</style>\n</head>\n<body>\n{corpo}</body>\n</html>\n')
open('vistoria-body.html','w',encoding='utf-8').write(
 '<title>SAKUMA Vistorias</title>\n'
 '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
 '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
 '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">\n'
 f'<style>{estilo}</style>\n' + corpo)
print('montado')
