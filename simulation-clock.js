// Minutes of simulated time, anchored to one monotonic timestamp. Repainting
// a table or receiving a late timer tick must not rewind an animated aircraft.
export function createSimulationClock({time=360,speed=.5,now=()=>performance.now()}={}) {
    let anchorTime=time,anchorStamp=now(),playing=false;
    function read(stamp=now()) {
        const value=Math.min(1439,anchorTime+(playing?Math.max(0,stamp-anchorStamp)*speed/1000:0));
        if(value===1439){anchorTime=value;anchorStamp=stamp;playing=false;}
        return value;
    }
    function commit(){anchorTime=read();anchorStamp=now();}
    return {read,get playing(){return playing;},get speed(){return speed;},
        play(){commit();playing=anchorTime<1439;},pause(){commit();playing=false;},
        seek(value){if(!Number.isFinite(value)||value<360||value>1439)throw Error('Hora fora do dia simulado.');anchorTime=value;anchorStamp=now();},
        setSpeed(value){if(!Number.isFinite(value)||value<=0)throw Error('Velocidade inválida.');commit();speed=value;}
    };
}
