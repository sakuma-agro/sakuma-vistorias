# Fonte do app

O `index.html` na raiz do repositório é **gerado**, não editado à mão. Ele nasce
da junção dos arquivos desta pasta pelo `montar.py`.

| Arquivo | O que é |
|---|---|
| `_markup.html` | Toda a interface: cabeçalho, abas, formulários, diálogos |
| `_estilo.css` | Estilo base, incluindo as regras de impressão |
| `_estilo-extra.css` | Estilo do que veio depois: login, pendências, configurações |
| `_script.js` | Núcleo original: biblioteca de normas e anomalias, formulário, relatório |
| `_script-extra.js` | Login, Supabase, pendências, configurações, exportação, numeração |
| `_estilo-gr.css` | Padrão Gestão Rápida: topo, menu, tela inicial, rodapé LOP, checklists prontos |
| `_script-gr.js` | Tela inicial, assinatura LOP nos relatórios e o módulo **Checklists prontos** (modelos, preenchimento, relatório no formato da planilha, importação de planilha) |
| `montar.py` | Junta tudo e escreve `../index.html` |

**Para alterar o app:** edite os arquivos daqui, rode `python3 montar.py` e
publique o `index.html` gerado. Editar o `index.html` direto funciona, mas a
próxima montagem apaga a alteração.

O `montar.py` aplica emendas no `_script.js` pela função `troca()`, sempre
casando um trecho exato. Se um desses trechos mudar, a montagem para com
`NÃO ENCONTRADO: <nome>` em vez de gerar um arquivo silenciosamente errado.

O `vistorias.js` **não** passa por aqui: é um arquivo solto, carregado depois do
script principal, e se edita direto na raiz.

## Checklists prontos

Os modelos que já vêm no app ficam em `CK_PADRAO`, no `_script-gr.js` (hoje: NR-24 ·
Portaria MTE nº 1.590/2026, tirado de `arquivos/Checklist_NR24_Portaria_MTE_1590_2026.xlsx`).
Os que o administrador cadastra em Configurações ficam em `configuracoes.checklists`,
com chave começando por `modelo:` — a mesma coluna dos blocos de checklist, sem mudança
no banco. Um checklist preenchido é salvo como vistoria (motivo "Checklist …"); o
modelo e o cabeçalho vão congelados no primeiro bloco de `vistorias.checklist`.
