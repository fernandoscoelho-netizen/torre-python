import * as THREE from './vendor/three.module.js';
import {standPose,taxiPoints,routesForStand,runwayExit,ease,stopEase} from './ground-routes.js';
export {standPose,taxiPoints} from './ground-routes.js';
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
// Fixed phase boundaries make seeking reproducible. Every boundary has the
// same position and nose direction on both sides, including runway entry.
export const ARRIVAL_PHASES=[.25,.50,.62,1];
export const DEPARTURE_PHASES=[.16,.19,.52,.55,.80,1];
export function sampleMovement(flight,stand,time){
    if(!stand)throw Error('Parqueamento sem geometria: '+flight.parqueamento);
    const u=clamp((time-flight.inicio)/(flight.fim-flight.inicio),0,1),p=standPose(stand),routes=routesForStand(stand);
    if(flight.tipo==='chegada'){
        if(u<.25){const v=u/.25;return {x:0,y:Math.pow(1-v,1.12)*110,z:lerp(-3100,-1140,v),heading:Math.PI,pitch:.045,phase:'Aproximação'};}
        if(u<.50){const v=(u-.25)/.25,m0=1960/1404,m1=runwayExit.length/.12*.25/1404;const distance=(m0+m1-2)*v*v*v+(3-2*m0-m1)*v*v+m0*v;return {x:0,y:0,z:lerp(-1140,264,distance),heading:Math.PI,pitch:.045*(1-ease(v/.08)),phase:'Aterragem e travagem'};}
        if(u<.62)return {...runwayExit.sample((u-.5)/.12),phase:'Saída da pista'};
        if(u<1){const startSlope=runwayExit.length/.12*.38/routes.arrival.length;return {...routes.arrival.sample(stopEase((u-.62)/.38,startSlope)),phase:'Circulação até '+stand.code};}
        return {...p,y:0,pitch:0,phase:'Estacionado'};
    }
    if(u<.16)return {...routes.pushback.sample(ease(u/.16),true),phase:'Recuo assistido · '+stand.code};
    if(u<.19)return {...routes.pushback.sample(1,true),phase:'Fim do recuo · preparação para circular'};
    if(u<.52)return {...routes.departure.sample(ease((u-.19)/.33)),phase:'Circulação para a pista 35'};
    if(u<.55)return {...routes.departure.sample(1),phase:'Alinhado na pista 35'};
    if(u<.8){const v=(u-.55)/.25,exponent=2850*.25/(2040*.2);return {x:0,y:0,z:lerp(1590,-450,Math.pow(v,exponent)),heading:0,pitch:.065*ease((v-.85)/.15),phase:'Corrida de descolagem'};}
    const v=(u-.8)/.2;
    return {x:0,y:Math.pow(v,1.1)*220,z:lerp(-450,-3300,v),heading:0,pitch:.065,phase:'Descolagem e subida'};
}

export function createDayRenderer({originalPlanes,createActor,stands,camera,controls,addLabel}){
    const actors=new Map(),labels=new Map(),original=originalPlanes.map(p=>[p,p.visible]);
    const desiredCamera=new THREE.Vector3(),desiredTarget=new THREE.Vector3(),direction=new THREE.Vector3(),side=new THREE.Vector3();
    let snapshot=null,anchor=0,rate=0,follow=null,entered=false,cameraSnap=true,lastFrame=null;
    const damping=controls.enableDamping;
    function actor(id){if(!actors.has(id)){const a=createActor(id);a.visible=false;actors.set(id,a);labels.set(id,addLabel(id,a));}return actors.get(id);}
    function release(){follow=null;controls.enableDamping=damping;}
    function update(now=performance.now()){
        const dt=lastFrame===null?0:Math.max(0,Math.min(.1,(now-lastFrame)/1000));lastFrame=now;
        const enabled=document.body.classList.contains('day-mode')&&snapshot;
        if(!enabled){if(entered){original.forEach(([p,v])=>p.visible=v);actors.forEach(a=>a.visible=false);entered=false;release();}return;}
        entered=true;original.forEach(([p])=>p.visible=false);actors.forEach(a=>a.visible=false);
        const time=Math.min(1439,snapshot.hora+Math.max(0,now-anchor)/1000*rate);
        for(const [code,id] of Object.entries(snapshot.parqueamentos)){
            if(!id)continue;const stand=stands.find(s=>s.code===code);if(!stand)continue;
            const a=actor(id),p=standPose(stand);a.visible=true;a.position.set(p.x,0,p.z);a.rotation.set(0,p.heading,0,'YXZ');
            const next=snapshot.voos.find(f=>f.aeronave===id&&f.tipo==='partida'&&f.estado==='previsto');
            labels.get(id).textContent=next?next.indicativo+' → '+next.destino:id+' · '+code;
        }
        let tracked=null;
        for(const f of snapshot.voos.filter(f=>f.inicio!==null&&f.inicio<=time&&time<f.fim)){
            const a=actor(f.aeronave),p=sampleMovement(f,stands.find(s=>s.code===f.parqueamento),time);
            a.visible=true;a.position.set(p.x,p.y,p.z);a.rotation.set(p.pitch,p.heading,0,'YXZ');labels.get(f.aeronave).textContent=f.indicativo+' · '+p.phase;
            if(a.userData.displayCode!==f.codigo){a.traverse(o=>{if(o.isMesh)o.userData={name:f.indicativo,info:f.origem+' → '+f.destino+' · '+f.passageiros+' passageiros'};});a.userData.displayCode=f.codigo;}
            if(follow===f.codigo)tracked=a;
        }
        const followed=snapshot.voos.find(f=>f.codigo===follow);
        if(!tracked&&followed?.tipo==='chegada'&&followed.fim!==null&&time>=followed.fim&&snapshot.parqueamentos[followed.parqueamento]===followed.aeronave){const a=actors.get(followed.aeronave);if(a?.visible)tracked=a;}
        if(tracked){
            const heading=tracked.rotation.y;direction.set(-Math.sin(heading),0,-Math.cos(heading));side.set(Math.cos(heading),0,-Math.sin(heading));
            desiredCamera.copy(tracked.position).addScaledVector(direction,-155).addScaledVector(side,95);desiredCamera.y+=90;
            desiredTarget.copy(tracked.position).addScaledVector(direction,20);desiredTarget.y+=5;
            const alpha=cameraSnap?1:1-Math.exp(-6*dt);
            camera.position.lerp(desiredCamera,alpha);controls.target.lerp(desiredTarget,alpha);cameraSnap=false;
        }
    }
    return {update,sync(data,speed,timestamp=performance.now()){
        if(snapshot&&Math.abs(data.hora-(snapshot.hora+Math.max(0,timestamp-anchor)/1000*rate))>.05)cameraSnap=true;
        snapshot=data;anchor=timestamp;rate=speed;
    },follow(id){follow=id;cameraSnap=true;controls.enableDamping=false;},release,actors};
}
