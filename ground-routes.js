import * as THREE from './vendor/three.module.js';

// The aircraft nose points along local -Z. Curves never extrapolate past
// their control polygon: unlike interpolating splines, they cannot overshoot
// a short straight section and then double back.
export function standPose(stand) {
    return stand.aircraft ? {...stand.aircraft} : {x:stand.x-12,z:stand.z,heading:-Math.PI/2};
}
const vector = p => new THREE.Vector3(p[0],0,p[1]);
const clamp = THREE.MathUtils.clamp;

export function roundedPath(input, radius=20) {
    const points=input.map(vector).filter((p,i,a)=>!i||p.distanceTo(a[i-1])>1e-6);
    const curves=[];
    let cursor=points[0];
    const lineTo=end=>{if(cursor.distanceTo(end)>1e-6)curves.push(new THREE.LineCurve3(cursor,end));cursor=end;};
    for(let i=1;i<points.length-1;i++) {
        const a=points[i-1],b=points[i],c=points[i+1];
        const incoming=b.clone().sub(a).normalize(),outgoing=c.clone().sub(b).normalize();
        if(incoming.dot(outgoing)<-.999)throw Error('A rota contém uma inversão sem curva.');
        if(incoming.dot(outgoing)>.999999){lineTo(b);continue;}
        const trim=Math.min(radius,a.distanceTo(b)*.4,b.distanceTo(c)*.4);
        const entry=b.clone().addScaledVector(incoming,-trim),exit=b.clone().addScaledVector(outgoing,trim);
        lineTo(entry);
        curves.push(new THREE.QuadraticBezierCurve3(entry,b,exit));
        cursor=exit;
    }
    lineTo(points[points.length-1]);
    return curveRoute(curves);
}

function curveRoute(curves) {
    const lengths=curves.map(c=>c.getLength()),length=lengths.reduce((a,b)=>a+b,0);
    return {length,sample(u,reverse=false){
        let distance=clamp(u,0,1)*length,index=0;
        while(index<curves.length-1&&distance>lengths[index])distance-=lengths[index++];
        const v=clamp(distance/lengths[index],0,1),curve=curves[index];
        const position=curve.getPointAt(v),tangent=curve.getTangentAt(v);
        return {x:position.x,y:0,z:position.z,heading:Math.atan2(-tangent.x,-tangent.z)+(reverse?Math.PI:0),pitch:0};
    }};
}

function parallelX(z){return z<=620?210:z>=740?235:210+(z-620)*25/120;}
function parallelBetween(start,end){
    // Omit a shallow bend immediately after a join: retaining two close
    // waypoints would force an unnecessarily tight turn onto the parallel.
    return [[parallelX(start),start],...[620,740].filter(z=>z>start+80&&z<end).map(z=>[parallelX(z),z]),[parallelX(end),end]];
}

export function taxiPoints(stand) {
    const p=standPose(stand),back=[p.x+Math.sin(p.heading)*35,p.z+Math.cos(p.heading)*35];
    const laneZ=stand.type==='walk'&&p.z<700?535:back[1];
    return [...parallelBetween(475,laneZ),[back[0],laneZ],back,[p.x,p.z]];
}

const routes=new Map();
export const runwayExit=roundedPath([[0,264],[0,280],[45,350],[120,400],[210,420],[210,475]],18);
export function routesForStand(stand) {
    const p=standPose(stand),key=JSON.stringify([stand.code,stand.type,p]);
    if(!routes.has(key)) {
        const forward=new THREE.Vector3(-Math.sin(p.heading),0,-Math.cos(p.heading));
        const start=new THREE.Vector3(p.x,0,p.z);
        // A curved, towed pushback turns the nose towards the departure
        // corridor. North-facing stands leave westwards; other stands leave
        // southwards. The aircraft stops before beginning forward taxi.
        const outbound=forward.z<-.25?new THREE.Vector3(-1,0,0):new THREE.Vector3(0,0,1);
        const end=start.clone().addScaledVector(forward,-45).addScaledVector(outbound,-22);
        const pushback=curveRoute([new THREE.CubicBezierCurve3(start,start.clone().addScaledVector(forward,-32),end.clone().addScaledVector(outbound,18),end)]);
        const lead=end.clone().addScaledVector(outbound,30),laneZ=lead.z;
        const departurePoints=[[end.x,end.z],[lead.x,lead.z],...parallelBetween(laneZ,1660),[0,1660],[0,1590]];
        routes.set(key,{arrival:roundedPath(taxiPoints(stand)),pushback,departure:roundedPath(departurePoints,32),departurePoints});
    }
    return routes.get(key);
}

export const ease = u => {u=clamp(u,0,1);return u*u*(3-2*u);};
export const stopEase = (u,startSlope=1) => {
    u=clamp(u,0,1);
    if(startSlope>3)return 1-Math.pow(1-u,startSlope);
    return (startSlope-2)*u*u*u+(3-2*startSlope)*u*u+startSlope*u;
};
