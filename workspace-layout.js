const $=id=>document.getElementById(id);
const defaults={columns:48,code:60,scene:58},KEY='porto-python.layout.v1';
let sizes={...defaults};
try{const saved=JSON.parse(localStorage.getItem(KEY));for(const key of Object.keys(defaults))if(Number.isFinite(saved?.[key]))sizes[key]=saved[key];}catch{}
const panels=document.querySelector('.lab-panels'),program=document.querySelector('.program-panel'),airport=document.querySelector('.airport-panel');
panels.classList.add('resize-layout');program.classList.add('resize-layout');airport.classList.add('resize-layout');
const definitions=[
    {id:'workspace-divider',key:'columns',axis:'x',container:panels,first:'Editor',second:'Aeroporto',minFirst:280,minSecond:300},
    {id:'editor-output-divider',key:'code',axis:'y',container:program,first:'Código',second:'Resultados',minFirst:90,minSecond:130},
    {id:'airport-data-divider',key:'scene',axis:'y',container:airport,first:'Aeroporto 3D',second:'Dados',minFirst:140,minSecond:160}
];
function geometry(def){
    const rect=def.container.getBoundingClientRect(),divider=$(def.id),style=getComputedStyle(def.container);
    if(def.axis==='x')return {start:rect.left+parseFloat(style.paddingLeft),space:def.container.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-divider.offsetWidth};
    const fixed=def.key==='code'?[program.querySelector('.file-bar'),program.querySelector('.mission-brief'),program.querySelector('.code-toolbar')]:[airport.querySelector('.airport-toolbar')];
    const header=fixed.reduce((sum,el)=>sum+el.getBoundingClientRect().height,0);
    return {start:rect.top+def.container.clientTop+header,space:def.container.clientHeight-header-divider.offsetHeight};
}
function limits(def,space){
    if(space<=def.minFirst+def.minSecond)return {min:100*def.minFirst/(def.minFirst+def.minSecond),max:100*def.minFirst/(def.minFirst+def.minSecond)};
    return {min:100*def.minFirst/space,max:100*(1-def.minSecond/space)};
}
function apply(){
    for(const def of definitions){
        const handle=$(def.id);if(!handle.offsetParent)continue;
        const {space}=geometry(def);if(space<=0)continue;
        const {min,max}=limits(def,space),value=Math.max(min,Math.min(max,sizes[def.key]));sizes[def.key]=value;
        const property=def.key==='columns'?'program':def.key==='code'?'code':'scene';
        def.container.style.setProperty('--'+property+'-fr',value+'fr');
        def.container.style.setProperty('--'+(def.key==='columns'?'airport':def.key==='code'?'output':'data')+'-fr',(100-value)+'fr');
        const first=Math.round(value),second=100-first;
        handle.setAttribute('aria-valuemin',String(Math.round(min)));handle.setAttribute('aria-valuemax',String(Math.round(max)));handle.setAttribute('aria-valuenow',String(first));
        handle.setAttribute('aria-valuetext',def.first+' '+first+'%, '+def.second+' '+second+'%');handle.dataset.value=def.first+' '+first+'% · '+def.second+' '+second+'%';
    }
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(sizes));}catch{}}
for(const def of definitions){
    const handle=$(def.id);let dragging=null;
    handle.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;event.preventDefault();handle.focus();handle.setPointerCapture(event.pointerId);dragging=event.pointerId;
        handle.classList.add('dragging');document.body.classList.add(def.axis==='x'?'resizing-columns':'resizing-rows');
    });
    handle.addEventListener('pointermove',event=>{
        if(event.pointerId!==dragging)return;
        const {start,space}=geometry(def);if(space<=0)return;
        sizes[def.key]=100*((def.axis==='x'?event.clientX:event.clientY)-start)/space;apply();
    });
    const finish=()=>{if(dragging===null)return;dragging=null;handle.classList.remove('dragging');document.body.classList.remove('resizing-columns','resizing-rows');save();};
    handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
    handle.addEventListener('dblclick',()=>{sizes[def.key]=defaults[def.key];apply();save();});
    handle.addEventListener('keydown',event=>{
        const negative=def.axis==='x'?'ArrowLeft':'ArrowUp',positive=def.axis==='x'?'ArrowRight':'ArrowDown';
        if(event.key===negative||event.key===positive){event.preventDefault();sizes[def.key]+=(event.key===negative?-1:1)*(event.shiftKey?10:2);apply();save();}
        else if(event.key==='Enter'){event.preventDefault();sizes[def.key]=defaults[def.key];apply();save();}
    });
}
let layoutFrame;
function schedule(){cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(apply);}
new ResizeObserver(schedule).observe(panels);new ResizeObserver(schedule).observe(program);new ResizeObserver(schedule).observe(airport);
window.addEventListener('workspace-layout-change',schedule);window.addEventListener('resize',schedule);window.addEventListener('workspace-ready',schedule);apply();

// Move the real output pane into the reading dialog. This preserves live
// console output, guide controls and the existing function/lexicon buttons.
const names={console:'Consola',variables:'Variáveis',functions:'Funções do jogo',guide:'Guia Python'};
const reader=$('output-reading-dialog'),readingContent=$('output-reading-content'),placeholder=$('output-reading-placeholder');
let mounted=null;
function restore(){if(mounted){placeholder.before(mounted);mounted=null;}placeholder.hidden=true;}
function reflect(tab){
    $('output-reading-label').textContent=names[tab];
    document.querySelectorAll('[data-reading-output]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.readingOutput===tab)));
    if(!reader.open)return;
    const pane=$('output-'+tab);if(mounted!==pane){restore();mounted=pane;readingContent.append(pane);}
    $('output-reading-title').textContent=names[tab]+' · Janela de leitura';placeholder.textContent=names[tab]+' aberta em janela de leitura.';placeholder.hidden=false;
}
function initializeReader(){
    $('output-read-open').disabled=false;reflect(window.workspaceBridge.getOutput());
    $('output-read-open').onclick=()=>{reader.showModal();reflect(window.workspaceBridge.getOutput());};
    document.querySelectorAll('[data-reading-output]').forEach(button=>button.onclick=()=>window.workspaceBridge.showOutput(button.dataset.readingOutput));
}
$('output-read-close').onclick=()=>reader.close();reader.addEventListener('close',()=>{restore();schedule();});
window.addEventListener('workspace-output-change',event=>reflect(event.detail.tab));
if(window.workspaceBridge)initializeReader();else window.addEventListener('workspace-ready',initializeReader,{once:true});
