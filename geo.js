// Conversão aproximada num plano local, alinhado com a pista.
// Não é uma projeção cartográfica de precisão. Edifícios ainda não georreferenciados.
export const origin={latitude:41.247934722222226,longitude:-8.681220833333333};
const R=6378137,rad=Math.PI/180,angle=11.17*rad,c=Math.cos(angle),s=Math.sin(angle);
export const northOffsetRadians=angle;
export function geoToLocal(latitude,longitude){const east=(longitude-origin.longitude)*rad*R*Math.cos(origin.latitude*rad),north=(latitude-origin.latitude)*rad*R;return {x:c*east+s*north,z:s*east-c*north};}
export function localToGeo(x,z){const east=c*x+s*z,north=s*x-c*z;return {latitude:origin.latitude+north/R/rad,longitude:origin.longitude+east/(R*Math.cos(origin.latitude*rad))/rad};}
