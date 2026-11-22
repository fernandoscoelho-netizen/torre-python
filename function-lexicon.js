import {GAME_FUNCTIONS} from './game-functions.js?v=relatorio-1';

const $=id=>document.getElementById(id);
const nameOf=item=>item.name.split('(')[0];
const items=[...GAME_FUNCTIONS].sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'pt'));
let selected='consultar_voos',query='',sources=new Map(),loading=false,loadError='O código aparece quando o interpretador Python estiver pronto.';
const dialog=$('function-lexicon');

function group(name){return ['pista_livre','reservar_pista'].includes(name)?'Pista': ['aterrar','parquear'].includes(name)?'Ação':'Consulta';}
function renderList(){
    const list=$('lexicon-list');list.replaceChildren();
    const filtered=items.filter(item=>[item.name,item.description,item.input,item.output].join(' ').toLocaleLowerCase('pt').includes(query));
    if(!filtered.some(item=>nameOf(item)===selected))selected=filtered[0]?nameOf(filtered[0]):null;
    $('lexicon-count').textContent=filtered.length+' de '+items.length+' funções';
    if(!filtered.length){const p=document.createElement('p');p.className='lexicon-empty';p.textContent='Nenhuma função corresponde à pesquisa.';list.append(p);}
    for(const item of filtered){
        const name=nameOf(item),button=document.createElement('button');button.type='button';button.className='lexicon-entry';button.setAttribute('aria-pressed',String(name===selected));
        const title=document.createElement('strong');title.textContent=name+'()';const small=document.createElement('small');small.textContent=group(name);
        button.append(title,small);button.onclick=()=>{selected=name;renderList();};list.append(button);
    }
    renderDetail();
}

function renderDetail(){
    const item=items.find(item=>nameOf(item)===selected);$('lexicon-detail').hidden=!item;
    if(!item)return;
    $('lexicon-signature').textContent=item.name;$('lexicon-description').textContent=item.description;$('lexicon-input').textContent=item.input;$('lexicon-output').textContent=item.output;$('lexicon-example').textContent=item.example;
    const source=sources.get(selected);$('lexicon-source').textContent=source?.code||loadError;
    $('lexicon-copy').disabled=!source;$('lexicon-copy-status').textContent='';
    $('lexicon-source-state').textContent=source?'Implementação real carregada pelo jogo':loading?'A carregar o código Python…':'Código ainda indisponível';
    $('lexicon-retry').hidden=!!source;$('lexicon-retry').disabled=loading;
    const dependencies=$('lexicon-dependencies');dependencies.replaceChildren();
    const helper=$('lexicon-helpers');helper.replaceChildren();
    for(const name of source?.dependencies||[]){
        const entry=sources.get(name);if(!entry)continue;
        if(entry.internal){const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=name+'() · auxiliar interna';pre.textContent=entry.code;details.append(summary,pre);helper.append(details);}
        else{const button=document.createElement('button');button.type='button';button.textContent='Ver '+name+'()';button.onclick=()=>{query='';$('lexicon-search').value='';selected=name;renderList();};dependencies.append(button);}
    }
    $('lexicon-related').hidden=!source?.dependencies?.length;
}

async function loadSources(){
    if(loading||sources.size)return;
    loading=true;renderDetail();
    try{
        if(!window.workspaceBridge?.getFunctionSources)throw Error('O editor ainda está a carregar. Podes consultar já as descrições e exemplos.');
        const result=await window.workspaceBridge.getFunctionSources();
        if(!result.ok)throw Error(result.error?.message||'Não foi possível ler as funções.');
        if(!Array.isArray(result.functions))throw Error('Esta versão ainda não carregou o código das funções. Atualiza a página e volta a abrir o léxico.');
        const received=new Map(result.functions.map(item=>[item.name,item]));
        const missing=items.filter(item=>!received.has(nameOf(item)));
        if(missing.length)throw Error('Falta carregar o código de '+missing.map(nameOf).join(', ')+'.');
        sources=received;
    }catch(error){loadError=error.message;}
    finally{loading=false;renderDetail();}
}

function open(){if(!dialog.open)dialog.showModal();renderList();loadSources();$('lexicon-search').focus();}
document.addEventListener('click',event=>{if(event.target.closest('[data-open-lexicon]'))open();});
$('lexicon-close').onclick=()=>dialog.close();
$('lexicon-search').oninput=event=>{query=event.target.value.toLocaleLowerCase('pt');renderList();};
$('lexicon-retry').onclick=loadSources;
$('lexicon-copy').onclick=async()=>{
    try{await navigator.clipboard.writeText(sources.get(selected).code);$('lexicon-copy-status').textContent='Código copiado.';}
    catch{$('lexicon-copy-status').textContent='Seleciona o código e usa Ctrl+C para o copiar.';}
};
window.addEventListener('python-functions-ready',()=>{sources=new Map();if(dialog.open)loadSources();});
