import * as THREE from 'three';
import { createAdditionalStands } from './apron-stands.js';
// Geometria interpretada das fotografias e da vista oblíqua Google Earth fornecida.
export function buildTerminal({scene,box,line,tag,selectable,concrete,steel,glass,white,yellow}){
const group=new THREE.Group();group.name='Terminal Francisco Sá Carneiro — estudo arquitetónico';scene.add(group);
const aluminium=new THREE.MeshStandardMaterial({color:'#e0e3df',metalness:.52,roughness:.37});
const frame=new THREE.MeshStandardMaterial({color:'#cbd3d0',metalness:.75,roughness:.29});
const glazing=new THREE.MeshStandardMaterial({color:'#305354',metalness:.65,roughness:.18});
const wall=new THREE.MeshStandardMaterial({color:'#b4b5ab',roughness:.87});
const asphalt=new THREE.MeshStandardMaterial({color:'#4c5253',roughness:.94});
const concreteLight=new THREE.MeshStandardMaterial({color:'#d6d8cf',roughness:.8});
const dark=new THREE.MeshStandardMaterial({color:'#243b3b',metalness:.3,roughness:.4});
function block(w,h,d,x,y,z,mat){return box(w,h,d,x,y,z,mat,group);}
function tube(points,r,mat=frame){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const m=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(4,points.length*6),r,6,false),mat);m.castShadow=true;group.add(m);return m;}
function beam(a,b,r=.3,mat=frame){const pa=new THREE.Vector3(...a),pb=new THREE.Vector3(...b);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,pa.distanceTo(pb),6),mat);m.position.copy(pa).add(pb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),pb.sub(pa).normalize());m.castShadow=true;group.add(m);return m;}
function panel(points,mat){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.material.side=THREE.DoubleSide;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
const roofCanvas=document.createElement('canvas');roofCanvas.width=roofCanvas.height=1024;const roofCtx=roofCanvas.getContext('2d');roofCtx.fillStyle='#dedfda';roofCtx.fillRect(0,0,1024,1024);roofCtx.strokeStyle='#b4bcb8';roofCtx.lineWidth=1.1;for(let i=0;i<1024;i+=32){roofCtx.beginPath();roofCtx.moveTo(0,i);roofCtx.lineTo(1024,i);roofCtx.stroke();}const roofMap=new THREE.CanvasTexture(roofCanvas);roofMap.colorSpace=THREE.SRGBColorSpace;roofMap.anisotropy=8;
const z0=890,z1=1325,L=z1-z0;
function airEdge(z){return 520;}
function roofHeight(u,z){return 31+4*Math.sin(Math.PI*u)+.7*Math.cos((z-z0)/L*Math.PI*2);}
function surface(under=false){const v=[],ids=[],uv=[],nx=28,nz=120;for(let j=0;j<=nz;j++){const z=z0+j/nz*L;for(let i=0;i<=nx;i++){const u=i/nx,x=airEdge(z)+(660-airEdge(z))*u;v.push(x,roofHeight(u,z)-(under?1.3:0),z);uv.push(u,j/nz);if(j<nz&&i<nx){const n=j*(nx+1)+i;ids.push(n,n+nx+1,n+1,n+1,n+nx+1,n+nx+2);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();const m=new THREE.Mesh(g,under?new THREE.MeshStandardMaterial({color:'#9da8a5',roughness:.6,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({color:'#f0f1eb',map:roofMap,metalness:.35,roughness:.48,side:THREE.DoubleSide}));m.castShadow=true;m.receiveShadow=under;group.add(m);return m;}
block(152,2,449,590,1,1107,concreteLight);block(136,6,435,590,4,1107,wall);
const terminal=block(136,23,435,590,18,1107,glazing);selectable(terminal,'Terminal Francisco Sá Carneiro','Modelo interpretado das fotografias: cobertura ondulada, fachadas envidraçadas e estrutura exterior. Dimensões e pormenores ainda aproximados.');
surface();surface(true);
// Bordos arredondados e juntas discretas da cobertura metálica.
for(const side of [0,1]){const pts=[];for(let j=0;j<=120;j++){const z=z0+j/120*L;pts.push([side?660:airEdge(z),roofHeight(side,z)-.6,z]);}tube(pts,.85,aluminium);}
for(const z of [z0,z1]){const pts=[];for(let i=0;i<=28;i++){const u=i/28;pts.push([airEdge(z)+(660-airEdge(z))*u,roofHeight(u,z)-.6,z]);}tube(pts,.85,aluminium);}
// Claraboias alongadas e relevos em cunha, interpretados da vista aérea fornecida.
const skylightMat=new THREE.MeshStandardMaterial({color:'#6f969d',metalness:.6,roughness:.23,side:THREE.DoubleSide});
for(let z=912;z<1310;z+=54){const points=[];const xA=532,xB=646;for(let i=0;i<=30;i++){const u=i/30,x=xA+(xB-xA)*u;const roofU=(x-airEdge(z))/(660-airEdge(z));const lift=5.5*Math.sin(Math.PI*u);const baseY=roofHeight(roofU,z)+.3;points.push({x,y:baseY+lift,z:z-2+u*12,width:1.2+8*Math.sin(Math.PI*u),base:baseY});}
const verts=[],idx=[],glassVerts=[],glassIdx=[];for(let i=0;i<points.length;i++){const p=points[i];verts.push(p.x,p.y,p.z,p.x,p.base,p.z+p.width);glassVerts.push(p.x,p.y,p.z,p.x,p.base,p.z-1.3);if(i<points.length-1){const k=i*2;idx.push(k,k+2,k+1,k+1,k+2,k+3);glassIdx.push(k,k+1,k+2,k+1,k+3,k+2);}}
for(const [v,indices,mat] of [[verts,idx,aluminium],[glassVerts,glassIdx,skylightMat]]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(indices);g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.castShadow=true;group.add(m);}tube(points.map(p=>[p.x,p.y+.08,p.z]),.14,frame);}
// Galeria baixa e comprida, distinta do átrio alto da fachada dos acessos.
const gallery=block(91,14,720,495,9,1080,glazing);selectable(gallery,'Galeria de embarque','Volume baixo e linear junto às mangas, separado do corpo mais alto de chegadas e partidas. Planta aproximada a partir da imagem aérea.');
block(103,1.6,732,495,17,1080,aluminium);block(98,1.2,725,495,2,1080,concreteLight);
for(let z=727;z<1435;z+=8){block(.32,13,.32,449.2,9,z,frame);for(const y of [6,11])block(.3,.16,8,449,y,z+4,frame);}
for(let z=733;z<1435;z+=24){block(1.4,6,1.4,447,3,z,concreteLight);}
// Os dois remates da galeria são volumes próprios; não prolongamentos do átrio.
function polygonVolume(points,base,height,material,bevel=0){const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,steps:1});const m=new THREE.Mesh(g,material);m.rotation.x=-Math.PI/2;m.position.y=base;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
const pavilionPlan=[[442,1302],[631,1468],[631,1500],[600,1512],[393,1462],[390,1437]];
const pavilion=polygonVolume(pavilionPlan,2,20,glazing,1.8);selectable(pavilion,'Pavilhão triangular','Remate de planta triangular, identificado na vista aérea. Forma e escala relativas interpretadas da imagem.');
polygonVolume(pavilionPlan,23,1.7,aluminium,1.5);
// Montantes e travessas da fachada do pavilhão, junto às novas mangas.
let pavilionArea=0;for(let i=0;i<pavilionPlan.length;i++){const a=pavilionPlan[i],b=pavilionPlan[(i+1)%pavilionPlan.length];pavilionArea+=a[0]*b[1]-b[0]*a[1];}
for(let i=0;i<pavilionPlan.length;i++){const a=pavilionPlan[i],b=pavilionPlan[(i+1)%pavilionPlan.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),sign=pavilionArea>0?1:-1,nx=sign*dz/length,nz=-sign*dx/length;for(let distance=5;distance<length;distance+=9){const x=a[0]+dx*distance/length+nx*1.9,z=a[1]+dz*distance/length+nz*1.9;beam([x,3.5,z],[x,21.5,z],.17,frame);}for(const y of [7,14,21])beam([a[0]+nx*1.9,y,a[1]+nz*1.9],[b[0]+nx*1.9,y,b[1]+nz*1.9],.15,frame);}
// Grande claraboia triangular, recuada da bordadura branca.
polygonVolume([[448,1340],[603,1472],[423,1442]],26.5,.25,skylightMat,.3);
beam([448,27,1340],[603,27,1472],.35,frame);beam([603,27,1472],[423,27,1442],.35,frame);beam([423,27,1442],[448,27,1340],.35,frame);
// Extremidade da torre: duas alas diagonais, com ponta triangular e pátio aberto.
// Contorno em V, em vez de um cotovelo ortogonal ou de um triângulo preenchido.
const endWing=[[463,852],[334,705],[334,681],[620,600],[634,637],[397,694],[497,825]];
const southernWing=polygonVolume(endWing,2,13,glazing,.25);selectable(southernWing,'Extremidade triangular da torre','Duas alas diagonais formam uma ponta triangular e delimitam um pátio aberto junto à torre. Planta e pormenores interpretados da fotografia de referência.');
const wingRoofCanvas=document.createElement('canvas');wingRoofCanvas.width=wingRoofCanvas.height=512;const wingCtx=wingRoofCanvas.getContext('2d');wingCtx.fillStyle='#d3d2c6';wingCtx.fillRect(0,0,512,512);for(let k=0;k<512;k+=12){wingCtx.fillStyle='rgba(85,92,87,.15)';wingCtx.fillRect(k,0,1,512);}for(let k=0;k<3500;k++){const n=(Math.sin(k*41.71)*43758.5453)%1;wingCtx.fillStyle=n>0?'rgba(255,255,255,.055)':'rgba(50,60,54,.035)';wingCtx.fillRect((k*73)%512,(k*139)%512,3,3);}const wingMap=new THREE.CanvasTexture(wingRoofCanvas);wingMap.wrapS=wingMap.wrapT=THREE.RepeatWrapping;wingMap.colorSpace=THREE.SRGBColorSpace;wingMap.anisotropy=8;const wingRoofMat=new THREE.MeshStandardMaterial({color:'#bbc0b8',map:wingMap,roughness:.83,metalness:.12});
const wingRoof=polygonVolume(endWing,15.7,1.05,wingRoofMat,.45);const roofUV=wingRoof.geometry.attributes.uv,roofPos=wingRoof.geometry.attributes.position;for(let i=0;i<roofUV.count;i++)roofUV.setXY(i,roofPos.getX(i)/110,roofPos.getY(i)/110);roofUV.needsUpdate=true;
polygonVolume(endWing,7.6,.42,concreteLight,.35);polygonVolume(endWing,13.2,.35,frame,.35);
// Fachadas: montantes, dois pisos e remates finos na cobertura.
let wingArea=0;for(let i=0;i<endWing.length;i++){const p=endWing[i],q=endWing[(i+1)%endWing.length];wingArea+=p[0]*q[1]-q[0]*p[1];}
for(let i=0;i<endWing.length;i++){const p=endWing[i],q=endWing[(i+1)%endWing.length],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);const sign=wingArea>0?1:-1,nx=sign*dz/len,nz=-sign*dx/len;for(let d=3;d<len;d+=6){const x=p[0]+dx*d/len+nx*.42,z=p[1]+dz*d/len+nz*.42;beam([x,2.4,z],[x,15.1,z],.13,frame);}for(const y of [4.8,10.4,14.8,16.85])beam([p[0]+nx*.43,y,p[1]+nz*.43],[q[0]+nx*.43,y,q[1]+nz*.43],y===16.85?.17:.1,frame);}
// Pequenas saídas e equipamento técnico sem esconder a forma em V.
for(const [x,z] of [[438,671],[544,638],[407,760]]){block(3.2,.7,2.1,x,17.1,z,frame);block(.7,1.2,.7,x,17.8,z,steel);}
// Pátio triangular e via de serviço em torno do edifício da torre.
polygonVolume([[416,705],[636,647],[666,791],[494,806]],.03,.12,new THREE.MeshStandardMaterial({color:'#8a8e87',roughness:1}));
for(let z=688;z<798;z+=18){line([[609,z],[625,z]],white,.35,.3);}
for(let z=1340;z<1470;z+=18){const ratio=(z-1302)/198;const x=442+(631-442)*ratio;beam([x,3,z],[x,22,z],.28,frame);}
// Fachada do lado da plataforma: planos de vidro, montantes e contraventamentos brancos.
for(let z=z0;z<z1;z+=12){const end=Math.min(z+12,z1);const x=airEdge(z)-.4,xx=airEdge(end)-.4;const top=roofHeight(0,z)-1.8,topEnd=roofHeight(0,end)-1.8;
panel([[x,7,z],[xx,7,end],[xx,topEnd,end],[x,top,z]],glazing);beam([x-.2,7,z],[x-.2,top,z],.2);for(const y of [11,17,23])beam([x-.4,y,z],[xx-.4,y,end],.12);
if(Math.round((z-z0)/12)%2===0){beam([x-1,7,z+1],[xx-1,topEnd-1,end-1],.25);beam([x-1,top-1,z+1],[xx-1,8,end-1],.25);}}
for(let z=z0+8;z<z1;z+=26){block(2,7,2,airEdge(z)+8,3.5,z,concreteLight);}
// Fachada inclinada dos acessos: vidro contínuo e apoios escultóricos em betão.
for(let z=z0;z<z1;z+=10){const end=Math.min(z+10,z1);panel([[696,3,z],[696,3,end],[651,30,end],[651,30,z]],glazing);beam([696,3,z],[651,30,z],.18);for(const y of [9,15,21,27]){const x=696-(y-3)/27*45;beam([x+.2,y,z],[x+.2,y,end],.13);}}
for(let z=z0+8;z<z1;z+=28){const shape=new THREE.Shape();shape.moveTo(718,0);shape.lineTo(703,0);shape.bezierCurveTo(693,0,697,6,692,10);shape.bezierCurveTo(682,19,669,29,648,31);shape.lineTo(648,34);shape.bezierCurveTo(678,32,696,20,707,8);shape.bezierCurveTo(710,5,717,5,721,4);shape.lineTo(721,1);shape.closePath();const hole=new THREE.Path();hole.absellipse(705,4.5,3.6,2.2,0,Math.PI*2,true,0);shape.holes.push(hole);const support=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:2.5,bevelEnabled:true,bevelThickness:.15,bevelSize:.15,bevelSegments:1,curveSegments:16}),concreteLight);support.position.z=z;support.castShadow=true;support.receiveShadow=true;group.add(support);
beam([715,5,z+1.2],[656,38,z+1.2],.28);beam([709,10,z+1.2],[650,35,z+1.2],.15);}
// Ala traseira recuada: o pátio triangular fica aberto à frente do volume.
const annex=block(156,19,162,568,10.5,870,glazing);selectable(annex,'Ala lateral junto à torre','Ala recuada que delimita o pátio da torre. Fachadas em dois pisos e cobertura técnica interpretadas da fotografia.');
block(172,1.8,180,571,21,868,aluminium);block(166,1.2,172,568,10.4,870,concreteLight);block(170,2.3,178,568,1.3,870,concreteLight);
for(let z=798;z<950;z+=10){for(const x of [489.6,646.4]){block(.5,17,.4,x,10,z,frame);block(.5,17,.4,x,10,z+5,frame);}}
for(let x=493;x<646;x+=10)block(.4,18,.5,x,10,788.5,frame);
for(const y of [5,15]){block(157,.25,.5,568,y,788);for(const x of [489.3,646.7])block(.4,.25,162,x,y,870,frame);}
for(let z=808;z<948;z+=26){block(2,10,2,659,5,z,concreteLight);block(30,1,7,658,10.5,z,concreteLight);}
// Faixa central de ventilação, grelhas e proteção da cobertura.
block(8,.4,51,576,22.3,850,dark);for(let z=829;z<875;z+=6){block(6,1.2,4,576,23,z,steel);for(const x of [574.5,577.5])block(.2,.3,3.4,x,23.8,z,dark);}
for(const x of [487,652])beam([x,22.6,787],[x,22.6,948],.19,frame);
for(const z of [784,953])beam([487,22.6,z],[652,22.6,z],.19,frame);
// Faixas ajardinadas ao pé dos apoios.
block(16,.2,490,727,.1,1138,new THREE.MeshStandardMaterial({color:'#53764b',roughness:1}));
// Vias de chegadas e partidas; tabuleiro elevado com pilares e guarda-corpos.
function road(points,width,y){const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,y,z)));const pts=curve.getPoints(120);const v=[],idx=[];for(let i=0;i<pts.length;i++){const tangent=curve.getTangent(i/(pts.length-1));const normal=new THREE.Vector3(tangent.z,0,-tangent.x).normalize();const a=pts[i].clone().addScaledVector(normal,width/2),b=pts[i].clone().addScaledVector(normal,-width/2);v.push(...a.toArray(),...b.toArray());if(i<pts.length-1){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#62696a',roughness:.9,side:THREE.DoubleSide}));m.receiveShadow=true;group.add(m);for(const sign of [-1,1]){const side=pts.map((p,i)=>{const t=curve.getTangent(i/(pts.length-1));return[p.x+sign*t.z*width/2,p.y+.65,p.z-sign*t.x*width/2];});tube(side,.22,concreteLight);}for(let i=0;i<pts.length;i+=4){const p=pts[i],q=pts[Math.min(i+1,pts.length-1)];beam([p.x,p.y+.07,p.z],[q.x,q.y+.07,q.z],.11,white);}if(y>2){for(let i=6;i<pts.length-5;i+=10){const p=pts[i];block(1.8,y,2,p.x,y/2,p.z,concreteLight);}}}
road([[753,815],[744,920],[744,1370],[755,1460],[792,1485],[821,1460],[814,1370]],13,9);
road([[766,780],[769,950],[769,1430],[800,1510],[840,1510]],16,.4);
for(const z of [960,1090,1220,1350]){block(54,1.5,16,712,9,z,concreteLight);block(53,.7,19,712,15,z,aluminium);for(const x of [688,735])block(.5,6,.5,x,12,z,frame);}
// Mangas com secções de vidro e torres cilíndricas de embarque.
const stands=[];
function bridge(a,b,startY=10,endY=startY){const begin=new THREE.Vector3(a[0],startY,a[1]),end=new THREE.Vector3(b[0],endY,b[1]),direction=end.clone().sub(begin),len=direction.length();const bridgeGroup=new THREE.Group();bridgeGroup.position.copy(begin).add(end).multiplyScalar(.5);bridgeGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.normalize());group.add(bridgeGroup);box(4.7,3.7,len,0,0,0,glazing,bridgeGroup);for(const y of [-2,2])box(5.2,.6,len+1,0,y,0,aluminium,bridgeGroup);for(let z=-len/2;z<len/2;z+=3.5)for(const x of [-2.45,2.45])box(.16,3.8,.15,x,0,z,frame,bridgeGroup);}
for(let i=0;i<9;i++){const z=875+i*59,x=(i===0||i===8)?350:395;stands.push({code:'P'+String(i+1).padStart(2,'0'),x,z,type:'jetbridge',boarding:'Manga de embarque',zone:'Galeria central',occupiedBy:null,didactic:true});line([[280,z],[x+17,z]],yellow,.8);line([[x+17,z-8],[x+17,z+8]],yellow,.8);const bx=x+35,bz=z+6;bridge([448,z-6],[bx,bz]);const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(4.5,4.5,14,20),glazing);cylinder.position.set(bx,7,bz);cylinder.castShadow=true;group.add(cylinder);for(const y of [1,5,10,14.3]){const ring=new THREE.Mesh(new THREE.CylinderGeometry(4.9,4.9,.4,20),aluminium);ring.position.set(bx,y,bz);group.add(ring);}for(let k=0;k<8;k++){const a=k*Math.PI/4;block(.22,14,.22,bx+Math.cos(a)*4.5,7,bz+Math.sin(a)*4.5,frame);}bridge([bx,bz],[x,z-3.5],10,6.25);block(4,3.8,3.2,x,6.25,z-3.5,dark);block(1.4,7,1.4,x+24,3.5,z,concreteLight);
// Marcação vermelha de área de equipamento junto às mangas.
const red=new THREE.MeshBasicMaterial({color:'#b95d4b'});line([[bx-7,z-15],[bx+6,z-15],[bx+6,z+17],[bx-7,z+17],[bx-7,z-15]],red,.35,.28);
}
const additional=createAdditionalStands({group,block,beam,line,bridge,tag,selectable,white,yellow,glazing,aluminium,frame,dark,concreteLight});stands.push(...additional.stands);
tag('TERMINAL',[590,56,1110]);return {stands,group,updateApron:additional.update};
}
