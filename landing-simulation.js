import * as THREE from './vendor/three.module.js';
import {routesForStand,runwayExit} from './ground-routes.js';
// Same bounded, tangent-continuous routes as the daily flights.
const touchdownZ=-1140,taxi=routesForStand({code:'P04',type:'jetbridge',x:395,z:1052}).arrival;
export const phases=[{id:'approach',label:'Aproximação',duration:26},{id:'rollout',label:'Aterragem e travagem',duration:36},{id:'exit',label:'Saída da pista',duration:runwayExit.length/8},{id:'taxi',label:'Circulação e parqueamento',duration:taxi.length/8+6}];
let accumulated=0;for(const p of phases){p.start=accumulated;accumulated+=p.duration;p.end=accumulated;}
export const totalDuration=accumulated;
export function sampleLanding(time){
    time=THREE.MathUtils.clamp(time,0,totalDuration);
    const phase=phases.find(p=>time<p.end)||phases[phases.length-1],t=time-phase.start,u=THREE.MathUtils.clamp(t/phase.duration,0,1);
    let position,heading,pitch=0,speed=0;
    if(phase.id==='approach'){
        const z=-3100+1960*u,d=touchdownZ-z;
        const altitude=d>120?d*Math.tan(Math.PI/60):120*Math.tan(Math.PI/60)*(d/120)**1.4;
        position=new THREE.Vector3(0,altitude,z);heading=Math.PI;pitch=(2+2*THREE.MathUtils.smoothstep(120-d,0,120))*Math.PI/180;speed=1960/26;
    }else if(phase.id==='rollout'){
        speed=70-(62/36)*t;position=new THREE.Vector3(0,0,touchdownZ+70*t-(31/36)*t*t);heading=Math.PI;pitch=4*Math.PI/180*(1-THREE.MathUtils.smoothstep(t,0,4));
    }else{
        let point;
        if(phase.id==='exit'){point=runwayExit.sample(u);speed=8;}
        else{const cruise=(taxi.length-48)/8;let distance;if(t<cruise){distance=8*t;speed=8;}else{const b=Math.min(12,t-cruise);distance=taxi.length-48+8*b-b*b/3;speed=Math.max(0,8-2*b/3);}point=taxi.sample(distance/taxi.length);}
        position=new THREE.Vector3(point.x,0,point.z);heading=point.heading;
    }
    const complete=time>=totalDuration;
    if(complete){position.set(383,0,1052);heading=-Math.PI/2;pitch=0;speed=0;}
    return {time,phase:phase.id,phaseIndex:phases.indexOf(phase),label:complete?'Estacionado em P04':phase.label,position,heading,pitch,speed,complete,progress:time/totalDuration,phaseProgress:u,onGround:phase.id!=='approach'||time===26};
}
