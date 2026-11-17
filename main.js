import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { buildTerminal } from './terminal.js';
import { geoToLocal,localToGeo,northOffsetRadians } from './geo.js';
import { sampleLanding,totalDuration,phases } from './landing-simulation.js';
import { createDayRenderer } from './daily-trajectories.js';
const root=document.getElementById('scene');
let viewportWidth=Math.max(1,root.clientWidth),viewportHeight=Math.max(1,root.clientHeight);
let renderer;
try {renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});} catch(e){document.getElementById('loading').innerHTML='<div class="error">Não foi possível iniciar o 3D.<br>Ativa a aceleração gráfica do navegador e volta a abrir esta página.</div>';throw e;}
renderer.setSize(viewportWidth,viewportHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;root.appendChild(renderer.domElement);
const scene=new THREE.Scene();
// Ambiente de iluminação e reflexos: céu suave, horizonte e solo.
const envCanvas=document.createElement('canvas');envCanvas.width=1024;envCanvas.height=512;const envCtx=envCanvas.getContext('2d');const envGradient=envCtx.createLinearGradient(0,0,0,512);envGradient.addColorStop(0,'#6f9dc5');envGradient.addColorStop(.42,'#d0dfe3');envGradient.addColorStop(.5,'#f3f2de');envGradient.addColorStop(.55,'#8d9a7d');envGradient.addColorStop(1,'#4d6348');envCtx.fillStyle=envGradient;envCtx.fillRect(0,0,1024,512);const envTex=new THREE.CanvasTexture(envCanvas);envTex.mapping=THREE.EquirectangularReflectionMapping;envTex.colorSpace=THREE.SRGBColorSpace;const pmrem=new THREE.PMREMGenerator(renderer);const envTarget=pmrem.fromEquirectangular(envTex);scene.environment=envTarget.texture;scene.environmentIntensity=.65;envTex.dispose();pmrem.dispose();
scene.background=new THREE.Color('#aebfc0');scene.fog=new THREE.FogExp2('#aebfc0',.000095);
const camera=new THREE.PerspectiveCamera(43,viewportWidth/viewportHeight,8,16000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=65;controls.maxDistance=6800;controls.maxPolarAngle=Math.PI/2-.025;controls.target.set(0,0,300);camera.position.set(2300,2500,3300);
const hemi=new THREE.HemisphereLight('#e6f1ff','#62704c',2.3);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0d7',3.1);sun.position.set(-1400,2100,-600);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-2000,right:2000,top:2000,bottom:-2000,near:100,far:6000});sun.shadow.bias=-.00025;sun.shadow.normalBias=1;scene.add(sun);scene.add(sun.target);
let seed=513;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function texture(base,noise){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,256,256);for(let i=0;i<16000;i++){const v=rand()>.5?255:0;g.fillStyle='rgba('+v+','+v+','+v+','+noise+')';g.fillRect(rand()*256,rand()*256,rand()*3+1,rand()*3+1);}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(40,40);t.colorSpace=THREE.SRGBColorSpace;return t;}
const grass=new THREE.MeshStandardMaterial({color:'#a5ad82',map:texture('#73835a',.06),roughness:1});
const asphalt=new THREE.MeshStandardMaterial({color:'#555a58',map:texture('#707470',.08),roughness:.98});
const concrete=new THREE.MeshStandardMaterial({color:'#b3b2a3',map:texture('#cac9bd',.05),roughness:.95});
const white=new THREE.MeshStandardMaterial({color:'#eee9d6',roughness:.8});const yellow=new THREE.MeshBasicMaterial({color:'#e8ba4c'});const steel=new THREE.MeshStandardMaterial({color:'#bbc0bd',metalness:.6,roughness:.45});const glass=new THREE.MeshStandardMaterial({color:'#395d64',metalness:.7,roughness:.23});const dark=new THREE.MeshStandardMaterial({color:'#263c3e',roughness:.65});
function box(w,h,d,x,y,z,mat,parent=scene){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=h>3;m.receiveShadow=true;parent.add(m);return m;}
function ground(w,d,x,z,mat=asphalt,y=.04){return box(w,.12,d,x,y,z,mat);}
function path(points,width,material=asphalt,height=.14){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];const len=Math.hypot(b[0]-a[0],b[1]-a[1]);const m=ground(width,len,(a[0]+b[0])/2,(a[1]+b[1])/2,material,height);m.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);}}
function line(points,material=yellow,width=.8,y=.24){path(points,width,material,y);}
const selectables=[],labels=[];
function tag(text,pos,maxDistance=Infinity){const el=document.createElement('div');el.className='label';el.textContent=text;document.getElementById('label-layer').appendChild(el);labels.push({el,pos:new THREE.Vector3(...pos),maxDistance});}
function selectable(mesh,name,info){mesh.userData={name,info};selectables.push(mesh);}
function textPlane(text,w,d,x,z,rotation=0,color='#eee9d6'){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font='bold 102px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,68);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.rotation.z=rotation;m.position.set(x,.3,z);scene.add(m);return m;}
ground(11000,11000,0,0,grass,-.14);
// 1 unidade = 1 metro. Referencial local alinhado com a pista; norte verdadeiro desfasado 11,17°.
ground(45,3480,0,0,asphalt);
for(let z=-1390;z<=1550;z+=80)ground(1.2,30,0,z,white,.23);
for(const x of [-21.5,21.5])ground(.8,3400,x,0,white,.23);
// Limiares deslocados: 300 m no 17; 150 m no 35 (eAIP LPPR AD 2.12).
for(const [sign,threshold,number] of [[-1,-1440,'17'],[1,1590,'35']]){for(let i=0;i<6;i++)ground(2.8,30,-17+i*6.8,threshold-sign*20,white,.23);textPlane(number,30,35,0,threshold-sign*75,sign===-1?Math.PI:0);for(const x of [-13,13]){ground(6,35,x,threshold-sign*300,white,.23);for(let j=0;j<3;j++)ground(2.3,22,x+j*3-3,threshold-sign*450,white,.23);}for(let z=sign*1700;sign*z>sign*threshold+35;z-=sign*75){line([[-3,z+sign*7],[0,z],[3,z+sign*7]],white,.8,.3);}}
const arp=geoToLocal(41+14/60+8/3600,-(8+40/60+41/3600));
tag('ARP · LPPR',[arp.x,6,arp.z]);
// Caminho paralelo e ligações principais, simplificados a partir da carta NAV.
path([[210,-1110],[210,620],[235,740],[235,1660]],26);
// Acesso sul: curva contínua para alinhar a norte antes da descolagem 35.
path([[235,1510],[235,1660],[0,1660]],26);line([[235,1510],[235,1660],[0,1660],[0,1590]]);
for(const z of [1460,1110,760,-910,-1040]){path([[0,z],[210,z]],24);line([[25,z],[210,z]]);}
path([[0,280],[45,350],[120,400],[210,420]],25);path([[0,-450],[90,-380],[210,-360]],25);line([[0,280],[45,350],[120,400],[210,420]]);line([[0,-450],[90,-380],[210,-360]]);
line([[210,-1110],[210,620],[235,740],[235,1510]]);
path([[-210,420],[-210,1410],[-280,1490]],24);for(const z of [1510,1190]){path([[0,z],[-210,z]],24);line([[0,z],[-210,z]]);}path([[0,50],[-70,70],[-210,350],[-210,420]],24);line([[0,50],[-70,70],[-210,350],[-210,1410]]);
ground(330,1120,398,1090,concrete);ground(330,490,-425,1260,concrete);
for(let z=560;z<1640;z+=28)line([[235,z],[560,z]],new THREE.MeshBasicMaterial({color:'#8e9685'}),.18,.21);
for(let x=255;x<570;x+=30)line([[x,530],[x,1650]],new THREE.MeshBasicMaterial({color:'#8e9685'}),.18,.21);
line([[280,570],[280,1480],[350,1540],[460,1540]],yellow,1.1);
for(const z of [760,1110,1460]){line([[210,z],[280,z]]);for(let x=35;x<95;x+=8)ground(3,14,x,z,white,.27);textPlane(z===760?'D':z===1110?'C':'B',18,15,125,z,0,'#e8ba4c');}
const {stands,updateApron}=buildTerminal({scene,box,line,tag,selectable,concrete,steel,glass,white,yellow});
// Torre interpretada da fotografia: base escalonada e cabine com faixa vermelha.
const tower=new THREE.Group();tower.position.set(570,0,728);scene.add(tower);
// Edifício de apoio da torre: cobertura larga, parapeitos e equipamentos.
box(94,5.8,92,0,2.9,0,concrete,tower);box(97,.8,95,0,6.2,0,steel,tower);
for(const x of [-47,47])box(.7,1.2,94,x,7,0,concrete,tower);for(const z of [-46,46])box(95,1.2,.7,0,7,z,concrete,tower);
for(const [x,z] of [[-29,-25],[24,29],[-28,28]]){box(8,2.7,6,x,7.9,z,steel,tower);box(8.4,.25,6.4,x,9.4,z,dark,tower);}
for(const z of [-41,41])for(let x=-39;x<=39;x+=11)box(5,.18,.14,x,6.75,z,white,tower);
const towerRed=new THREE.MeshStandardMaterial({color:'#944d45',roughness:.65});
box(45,5,40,0,2.5,0,concrete,tower);box(49,1.3,44,0,5.5,0,dark,tower);
box(33,7,29,0,8.5,0,concrete,tower);box(39,1.3,35,0,12.5,0,dark,tower);
box(12,23,12,0,24,0,white,tower);box(4,23,12.2,-4,24,0,concrete,tower);
const cab=new THREE.Mesh(new THREE.CylinderGeometry(10.5,8.5,6,8),glass);cab.position.y=38;cab.castShadow=true;tower.add(cab);
for(const [y,radius,height,mat] of [[34.8,9.5,1.5,steel],[41.7,11,2.2,towerRed],[43.3,12.2,1.2,white],[44.1,12.5,.7,dark]]){const cap=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,8),mat);cap.position.y=y;cap.castShadow=true;tower.add(cap);}
for(let i=0;i<8;i++){const a=i*Math.PI/4;box(.3,6,.3,Math.cos(a)*9.5,38,Math.sin(a)*9.5,steel,tower);}
box(.3,5,.3,0,46.5,0,steel,tower);selectable(cab,'Torre de controlo','Modelo visual da torre e da base escalonada, com geometria interpretada das fotografias. Implantação e altura ainda aproximadas.');tag('TORRE DE CONTROLO',[570,66,728]);
// Carga e manutenção.
for(const [x,z,w,d] of [[660,550,100,110],[-590,1320,110,180],[-580,1010,110,140]]){const h=box(w,15,d,x,7.5,z,concrete);box(w+4,1,d+4,x,15.5,z,steel);selectable(h,'Instalações de apoio','Volumes de apoio, carga e manutenção representados de forma simplificada.');for(let k=0;k<4;k++)box(2,9,d/6,x-w/2-.2,4.5,z-d/2+20+k*d/5,dark);}
tag('PLATAFORMA DE CARGA',[-425,35,1200]);
// Acessos viários, estacionamento e envolvente procedural.
path([[760,400],[760,1500],[690,1580],[600,1580],[600,1700],[970,1900]],20);
ground(200,440,935,1170,asphalt);for(let z=970;z<1380;z+=28){for(let x=855;x<1020;x+=16)line([[x,z],[x,z+13]],white,.4);}
const carMats=['#e4e5dd','#4a5a65','#b8bcb8','#733c32'].map(color=>new THREE.MeshStandardMaterial({color,metalness:.4,roughness:.5}));for(let i=0;i<100;i++){const x=859+Math.floor(rand()*10)*16,z=975+Math.floor(rand()*14)*28;box(2,1.6,4.5,x,1,z,carMats[i%4]);}
// Service vehicles around the apron.
for(let i=0;i<14;i++){const x=450+rand()*27,z=850+rand()*570;box(2.5,2.5,6,x,1.3,z,i%3?white:yellow);box(2.6,.8,2,x,2.3,z-1.5,glass);}
const treeTrunk=new THREE.MeshStandardMaterial({color:'#695e48'});const treeLeaf=new THREE.MeshStandardMaterial({color:'#526d4a',roughness:1});
for(let i=0;i<230;i++){const x=(rand()-.5)*5400,z=(rand()-.5)*5600;if(Math.abs(x)<800&&Math.abs(z)<2100)continue;const h=6+rand()*10;const t=new THREE.Mesh(new THREE.ConeGeometry(3+rand()*4,h,7),treeLeaf);t.position.set(x,h*.5+2,z);scene.add(t);}
const houseMat=new THREE.MeshStandardMaterial({color:'#d3c9af',roughness:.9});const roofMat=new THREE.MeshStandardMaterial({color:'#916d54',roughness:.9});
for(let i=0;i<160;i++){const x=(rand()>.5?1:-1)*(1100+rand()*1900),z=(rand()-.5)*5200;const w=15+rand()*28,d=18+rand()*25,h=5+rand()*11;box(w,h,d,x,h/2,z,houseMat);const roof=new THREE.Mesh(new THREE.ConeGeometry(w*.72,6,4),roofMat);roof.rotation.y=Math.PI/4;roof.scale.z=d/w;roof.position.set(x,h+3,z);scene.add(roof);}
for(const x of [-1150,1240]){path([[x,-4000],[x,4000]],16);for(let z=-3800;z<4000;z+=900)path([[x-600,z],[x+600,z]],12);}
// Luzes de bordo instanciadas.
function lights(color,points,radius){const mat=new THREE.MeshBasicMaterial({color});const inst=new THREE.InstancedMesh(new THREE.SphereGeometry(radius,5,4),mat,points.length);const dummy=new THREE.Object3D();points.forEach((p,i)=>{dummy.position.set(...p);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});scene.add(inst);return mat;}
const runwayPoints=[];for(let z=-1740;z<=1740;z+=60)for(const x of [-25,25])runwayPoints.push([x,.7,z]);lights('#fff4bd',runwayPoints,.9);
const taxiPoints=[];for(let z=-1100;z<1540;z+=45)for(const x of [193,227])taxiPoints.push([x,.7,z]);lights('#538bff',taxiPoints,.75);
for(let z=670;z<1560;z+=150){box(.65,24,.65,470,12,z,steel);box(9,.6,1.4,470,24,z,white);}
// Aviões genéricos, sem marcas comerciais. Comprimento aproximado: 38 m.
const planes=[];const bodyMat=new THREE.MeshStandardMaterial({color:'#f1f1e8',metalness:.28,roughness:.35});
function fin(points,mat,parent){const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const m=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.4,bevelEnabled:false}),mat);parent.add(m);return m;}
function aircraft(id,x,z,color,heading=0){const group=new THREE.Group();group.userData.flightCode=id;scene.add(group);group.position.set(x,0,z);group.rotation.y=heading;const mat=new THREE.MeshStandardMaterial({color,metalness:.35,roughness:.45});
const body=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),bodyMat);body.scale.set(2,2.1,19);body.position.y=4;body.castShadow=true;group.add(body);
const cockpit=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),glass);cockpit.scale.set(1.5,1.1,2);cockpit.position.set(0,4.7,-15.3);group.add(cockpit);
for(const sign of [-1,1]){const wing=fin([[0,-3],[sign*17,6],[sign*17,8],[sign*3,4],[0,5]],bodyMat,group);wing.rotation.x=Math.PI/2;wing.position.set(0,3.5,0);const tailWing=fin([[0,0],[sign*6,4],[sign*6,5],[0,3]],bodyMat,group);tailWing.rotation.x=Math.PI/2;tailWing.position.set(0,5,12);const engine=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.15,4,14),bodyMat);engine.rotation.x=Math.PI/2;engine.position.set(sign*6,2.5,0);engine.castShadow=true;group.add(engine);const intake=new THREE.Mesh(new THREE.CircleGeometry(.95,14),dark);intake.position.set(sign*6,2.5,-2.05);intake.rotation.y=Math.PI;group.add(intake);for(let k=0;k<15;k++)box(.08,.38,.55,sign*1.95,4.8,-11+k*1.65,glass,group);for(const zz of [-10,5]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.8,8),dark);wheel.rotation.z=Math.PI/2;wheel.position.set(sign*.9,.65,zz);group.add(wheel);}}
const tail=fin([[11,4],[17,4],[17,12],[14,12]],mat,group);tail.rotation.y=-Math.PI/2;tail.position.x=.2;
box(3.5,.18,15,0,6,5,mat,group);group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.userData={name:id+' · Avião',info:'Voo fictício de demonstração. Selecionável e preparado para receber ações de circulação, chegada e partida.'};selectables.push(o);}});planes.push(group);return group;}
for(const i of [0,2,4,6,8]){const s=stands[i];s.occupiedBy=['PY101','PY202','PY303','PY404','PY505'][i/2];aircraft(s.occupiedBy,s.x-12,s.z,['#4c7574','#b94e46','#51708e'][i%3],-Math.PI/2);}
for(const stand of stands.filter(s=>s.aircraft&&s.occupiedBy)){const a=stand.aircraft;aircraft(stand.occupiedBy,a.x,a.z,stand.type==='walk'?'#617987':'#71678a',a.heading);}
aircraft('PY606',-385,1260,'#718a65',Math.PI/2);
const moving=aircraft('PY001',210,380,'#a2493d',0);tag('PISTA 17 / 35',[0,12,-500]);
const daily3D=createDayRenderer({scene,originalPlanes:planes.slice(),createActor(id){const a=moving.clone(true);a.userData.flightCode=id;scene.add(a);a.traverse(o=>{if(o.isMesh)selectables.push(o);});return a;},stands,camera,controls,addLabel(text,actor){tag(text,[0,12,0],900);const label=labels[labels.length-1];label.sourcePlane=actor;label.dayOnly=true;return label.el;}});
let playbackStopTime=totalDuration,commandMode=false;
let running=false,paused=false,elapsed=0,speedMultiplier=6,follow=true,labelsVisible=true,dusk=false,fly=null;
const views={overview:{p:[2300,2500,3300],t:[0,0,260]},terminal:{p:[-220,470,440],t:[530,12,1110]},access:{p:[1450,310,510],t:[585,14,1040]},walk:{p:[300,105,455],t:[450,3,640]},gates:{p:[180,255,1810],t:[455,9,1435]},end:{p:[110,345,745],t:[510,8,760]},tower:{p:[554,47,728],t:[20,7,620]},runway:{p:[230,170,2070],t:[0,0,-200]},top:{p:[15,4900,180],t:[0,0,180]}};
function setFollow(on){follow=on;const btn=document.getElementById('follow');btn.setAttribute('aria-pressed',on);btn.textContent=on?'Câmara a seguir: ON':'Câmara a seguir: OFF';}
function view(name){const v=views[name];setFollow(false);daily3D.release();fly=null;camera.position.set(...v.p);controls.target.set(...v.t);controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));document.body.classList.toggle('focused-view',name==='terminal'||name==='access'||name==='end'||name==='walk'||name==='gates');}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
controls.addEventListener('start',()=>{fly=null;setFollow(false);daily3D.release();});
function setEvent(t){document.getElementById('event').textContent=t;}
function renderSimulation(){const state=sampleLanding(elapsed);if(commandMode&&playbackStopTime<totalDuration&&elapsed>=playbackStopTime)state.label='Na pista · aterragem concluída';const destination=stands.find(s=>s.code==='P04');destination.occupiedBy=state.complete?'PY001':null;moving.position.copy(state.position);moving.rotation.set(state.pitch,state.heading,0,'YXZ');document.getElementById('phase-name').textContent=state.label;document.getElementById('altitude').textContent=Math.round(state.position.y)+' m';document.getElementById('air-speed').textContent=Math.round(state.speed*3.6)+' km/h';document.getElementById('timeline').value=Math.round(state.progress*1000);document.getElementById('sim-progress').style.width=state.progress*100+'%';document.querySelectorAll('[data-phase]').forEach((el,i)=>{el.classList.toggle('current',i===state.phaseIndex&&!state.complete);el.classList.toggle('finished',i<state.phaseIndex||state.complete);});
document.querySelector('.player-note').textContent=speedMultiplier+'× · usa a barra para rever cada fase · arrastar o cenário liberta a câmara.';
const text=state.complete?'PY001 estacionado em P04 · chegada concluída.':paused?'Simulação em pausa · '+state.label:'PY001 · '+state.label+' · Pista 17 → P04';setEvent(text);document.getElementById('demo').textContent=state.complete?'▶ Repetir chegada':!running?'▶ Aterrar e parquear':paused?'▶ Continuar simulação':'Ⅱ Pausar simulação';document.getElementById('player-toggle').textContent=paused||!running?'▶':'Ⅱ';document.getElementById('player-toggle').setAttribute('aria-label',paused||!running?'Continuar simulação':'Pausar simulação');return state;}
function reset(){playbackStopTime=totalDuration;commandMode=false;running=false;paused=false;elapsed=0;document.body.classList.remove('simulating','focused-view');setFollow(true);camera.position.set(...views.overview.p);controls.target.set(...views.overview.t);controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='overview'));moving.position.set(0,103,-3100);moving.rotation.set(0,Math.PI,0);document.getElementById('flight-player').hidden=true;renderSimulation();setEvent('PY001 pronto para a aproximação à pista 17.');}
function toggleSimulation(){if(!running){elapsed=0;running=true;paused=false;document.getElementById('flight-player').hidden=false;setFollow(true);document.body.classList.add('focused-view','simulating');document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));}else paused=!paused;renderSimulation();}
document.getElementById('reset').onclick=reset;document.getElementById('player-reset').onclick=reset;document.getElementById('demo').onclick=toggleSimulation;document.getElementById('player-toggle').onclick=toggleSimulation;document.getElementById('follow').onclick=()=>setFollow(!follow);document.getElementById('sim-speed').onchange=e=>{speedMultiplier=Number(e.target.value);};document.getElementById('timeline').oninput=e=>{elapsed=Number(e.target.value)/1000*totalDuration;running=elapsed<totalDuration;paused=true;renderSimulation();};
document.getElementById('focus-toggle').onclick=()=>{const on=document.body.classList.toggle('model-only');document.getElementById('focus-toggle').textContent=on?'Mostrar controlos':'Ver só o modelo';};
document.getElementById('labels').onclick=()=>{labelsVisible=!labelsVisible;document.getElementById('labels').setAttribute('aria-pressed',labelsVisible);document.querySelector('#labels b').textContent=labelsVisible?'ON':'OFF';};
document.getElementById('light').onclick=()=>{dusk=!dusk;document.getElementById('light').setAttribute('aria-pressed',dusk);document.querySelector('#light b').textContent=dusk?'ON':'OFF';document.getElementById('mode-value').textContent=dusk?'Entardecer':'Luz diurna';scene.background.set(dusk?'#777f8d':'#aebfc0');scene.fog.color.copy(scene.background);sun.color.set(dusk?'#ffb577':'#fff0d7');sun.intensity=dusk?1.8:3.1;hemi.intensity=dusk?1.25:2.3;sun.position.set(-1400,dusk?550:2100,-600);renderer.toneMappingExposure=dusk?.88:1.05;};
const ray=new THREE.Raycaster();const pointer=new THREE.Vector2();let down=null;
renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(selectables).filter(hit=>{for(let o=hit.object;o;o=o.parent)if(!o.visible)return false;return true;});if(hits.length){const d=hits[0].object.userData;document.getElementById('object-name').textContent=d.name;document.getElementById('object-info').textContent=d.info;}});
function resizeViewport(){viewportWidth=Math.max(1,root.clientWidth);viewportHeight=Math.max(1,root.clientHeight);camera.aspect=viewportWidth/viewportHeight;camera.updateProjectionMatrix();renderer.setSize(viewportWidth,viewportHeight);}
new ResizeObserver(resizeViewport).observe(root);window.addEventListener('resize',resizeViewport);
let previous=performance.now();const projected=new THREE.Vector3();const direction=new THREE.Vector3();
function animate(now){requestAnimationFrame(animate);const dt=document.hidden?0:Math.min((now-previous)/1000,.25);previous=now;
if(fly){fly.t=Math.min(1,fly.t+dt/.95);const a=fly.t*fly.t*(3-2*fly.t);camera.position.lerpVectors(fly.from,fly.to,a);controls.target.lerpVectors(fly.start,fly.target,a);if(fly.t>=1)fly=null;}
if(running&&!paused){elapsed=Math.min(playbackStopTime,elapsed+dt*speedMultiplier);if(elapsed>=playbackStopTime){running=false;paused=false;}}
if(!document.getElementById('flight-player').hidden){const state=renderSimulation();if(follow){const forward=new THREE.Vector3(-Math.sin(state.heading),0,-Math.cos(state.heading)),side=new THREE.Vector3(-Math.cos(state.heading),0,Math.sin(state.heading));const airborne=state.phase==='approach';const offset=forward.clone().multiplyScalar(airborne?-135:-155).addScaledVector(side,airborne?83:105);offset.y=airborne?62:92;camera.position.copy(state.position).add(offset);controls.target.copy(state.position).addScaledVector(forward,22);controls.target.y+=5;}
}
daily3D.update(now);updateApron(now/1000);controls.update();for(const label of labels){if(label.sourcePlane)label.pos.copy(label.sourcePlane.position).add(new THREE.Vector3(0,15,0));projected.copy(label.pos).project(camera);direction.copy(label.pos).sub(camera.position);const visible=labelsVisible&&(!label.sourcePlane||label.sourcePlane.visible)&&camera.position.distanceTo(label.pos)<label.maxDistance&&projected.z<1&&projected.z>-1&&Math.abs(projected.x)<1&&Math.abs(projected.y)<1&&direction.dot(camera.getWorldDirection(new THREE.Vector3()))>0;label.el.style.display=(visible&&(!label.dayOnly||document.body.classList.contains('day-mode')))?'block':'none';if(visible){label.el.style.left=(projected.x*.5+.5)*viewportWidth+'px';label.el.style.top=(-projected.y*.5+.5)*viewportHeight-28+'px';label.el.style.transform='translate(-50%,-100%)';}}
const scaleA=controls.target.clone().project(camera),groundRight=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);groundRight.y=0;groundRight.normalize();const scaleB=controls.target.clone().addScaledVector(groundRight,100).project(camera);const pixelsPerMetre=Math.max(.001,Math.abs(scaleB.x-scaleA.x)*viewportWidth/200);const units=[1,2,5,10,20,50,100,200,500,1000];let scaleMetres=units[0];for(const n of units)if(n*pixelsPerMetre<=100)scaleMetres=n;document.querySelector('.scale span').style.width=scaleMetres*pixelsPerMetre+'px';document.getElementById('scale-length').textContent=scaleMetres+' m';const camDir=camera.getWorldDirection(new THREE.Vector3());document.querySelector('.compass svg').style.transform='rotate('+(Math.atan2(camDir.x,-camDir.z)+northOffsetRadians)+'rad)';renderer.render(scene,camera);}
reset();document.getElementById('loading').remove();requestAnimationFrame(animate);
// API de visualização: recebe ações da futura camada de execução Python.
function playCommands(actions){if(!Array.isArray(actions)||actions.length<1||actions.length>2)throw new Error('Sequência de ações inválida.');if(actions[0].type!=='land'||actions[0].flight!=='PY001')throw new Error('A primeira ação deve autorizar a aterragem de PY001.');const hasPark=actions.length===2;if(hasPark&&(actions[1].type!=='park'||actions[1].flight!=='PY001'||actions[1].stand!=='P04'))throw new Error('Nesta missão, o destino é P04.');reset();commandMode=true;playbackStopTime=hasPark?totalDuration:62;toggleSimulation();}
function setFlightIndicators(items){for(let i=labels.length-1;i>=0;i--)if(labels[i].dayOnly){labels[i].el.remove();labels.splice(i,1);}for(const item of items){const plane=planes.find(p=>p.userData.flightCode===item.aircraft);if(!plane)continue;tag(item.label,[plane.position.x,14,plane.position.z],700);labels[labels.length-1].dayOnly=true;}}
window.airportViewer={updateDay3D:(snapshot,rate,timestamp)=>daily3D.sync(snapshot,rate,timestamp),followDayFlight:id=>daily3D.follow(id),releaseDayCamera:()=>daily3D.release(),setFlightIndicators,scene,camera,planes,stands,view,reset,playCommands,pause:()=>{if(running){paused=true;renderSimulation();}},togglePause:()=>{if(running){paused=!paused;renderSimulation();}},setSpeed:value=>{if([1,3,6,12].includes(value)){speedMultiplier=value;document.getElementById('sim-speed').value=value;}},geoToLocal,localToGeo,getState:()=>({demoRunning:running,paused,elapsed,totalDuration,commandCompleted:commandMode&&elapsed>=playbackStopTime,missionComplete:commandMode&&elapsed>=totalDuration,follow,speedMultiplier,...sampleLanding(elapsed),stands:stands.map(s=>({...s}))})};
