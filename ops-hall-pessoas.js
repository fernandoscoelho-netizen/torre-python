// Bloco 4 · Relatório do dia, Fase 6: operadores em modelos glTF (.glb) no centro de operações.
// Opcional: se a pasta modelos/operadores/ tiver um ficheiro lista.json com modelos .glb, as
// pessoas geradas no código são trocadas por esses modelos (sentados nas consolas ou de pé).
// Se faltar a pasta, um ficheiro, ou o carregador, a sala fica com as pessoas do código.
//
// lista.json, por exemplo:
//   { "sentados": ["operadora-1.glb", "operador-2.glb"], "de_pe": ["supervisor.glb"], "altura": 1.72 }
// Os modelos devem ser humanoides com esqueleto (Quaternius, Mixamo, Ready Player Me, Blender
// Rigify...). A pose sentada é feita apontando os ossos das pernas e dos braços, por isso não
// depende dos eixos de cada esqueleto. Se o modelo tiver uma animação com "sit" (ou "sentad")
// no nome, é essa que se usa; para quem está de pé usa-se uma animação "idle", se houver.
import * as THREE from 'three';

const PASTA = './modelos/operadores/';
const SENTADO = /sit|sentad/i, PARADO = /idle|parad|stand/i;

// --- Ossos: reconhece os nomes mais comuns (Mixamo, Quaternius, Rigify, Ready Player Me) --------------
function lado(nome) {
    const n = nome.replace(/^mixamorig[:_]?/i, '');
    if (/[a-z0-9]L$/.test(n)) return 'E'; if (/[a-z0-9]R$/.test(n)) return 'D';               // Quaternius: UpperArmL, LowerLegR
    if (/(^|[^a-z])(left|l)([^a-z]|$)|left|[._]l$|_l_|\.l\b|^l[_.]/i.test(n)) return 'E';
    if (/(^|[^a-z])(right|r)([^a-z]|$)|right|[._]r$|_r_|\.r\b|^r[_.]/i.test(n)) return 'D';
    return '';
}
const PADROES = {
    anca: /hips|pelvis|^root$|bacia/i,
    coxa: /upleg|upper_?leg|thigh|femur|leg_?upper|coxa/i,
    perna: /^(?!.*up).*(leg|calf|shin|knee|lower_?leg|perna)(?!.*up)/i,
    pe: /foot|ankle|^pe[._]/i,
    braco: /^(?!.*fore)(?!.*lower).*(upper_?arm|arm_?upper|^(mixamorig[:_]?)?(left|right)arm$|shoulder_?arm|braco)/i,
    antebraco: /fore_?arm|lower_?arm|arm_?lower|antebraco|elbow/i,
    mao: /hand(?!.*(index|thumb|middle|ring|pinky))|wrist|mao/i,
    cabeca: /head(?!.*(top|end))|cabeca/i,
};
export function encontrarOssos(raiz) {
    const ossos = {};
    raiz.traverse(o => {
        if (!o.isBone) return;
        const n = o.name, l = lado(n);
        for (const [chave, re] of Object.entries(PADROES)) {
            const k = ['anca', 'cabeca'].includes(chave) ? chave : chave + l;
            if (re.test(n) && !ossos[k] && (['anca', 'cabeca'].includes(chave) || l)) { ossos[k] = o; break; }
        }
    });
    // o braço pode vir com o nome "Arm.L"; se não foi apanhado, usa o pai do antebraço
    for (const l of ['E', 'D']) if (!ossos['braco' + l] && ossos['antebraco' + l]?.parent?.isBone) ossos['braco' + l] = ossos['antebraco' + l].parent;
    for (const l of ['E', 'D']) if (!ossos['perna' + l] && ossos['pe' + l]?.parent?.isBone) ossos['perna' + l] = ossos['pe' + l].parent;
    for (const l of ['E', 'D']) if (!ossos['coxa' + l] && ossos['perna' + l]?.parent?.isBone) ossos['coxa' + l] = ossos['perna' + l].parent;
    return ossos;
}

// Roda um osso para que o segmento até ao filho aponte na direção dada (no espaço do modelo).
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qm = new THREE.Quaternion(), _qmi = new THREE.Quaternion();
function apontar(raiz, osso, filho, dir) {
    if (!osso || !filho) return;
    raiz.updateMatrixWorld(true);
    raiz.getWorldQuaternion(_qm); _qmi.copy(_qm).invert();
    osso.getWorldPosition(_a); filho.getWorldPosition(_b);
    const atual = _b.sub(_a).normalize().applyQuaternion(_qmi);                       // direção atual, no espaço do modelo
    if (atual.lengthSq() < 1e-8) return;
    const rot = new THREE.Quaternion().setFromUnitVectors(atual, dir.clone().normalize());
    const rotMundo = _qm.clone().multiply(rot).multiply(_qmi);                          // a mesma rotação, no espaço do mundo
    osso.getWorldQuaternion(_q); _q.premultiply(rotMundo);
    osso.parent.getWorldQuaternion(_qp); osso.quaternion.copy(_qp.invert().multiply(_q));
    raiz.updateMatrixWorld(true);
}
// Filho "principal" de um osso: o que segue o membro (o mais afastado, se houver vários)
function seguinte(osso, preferido) {
    if (preferido) return preferido;
    let melhor = null, d = -1;
    for (const c of osso?.children ?? []) if (c.isBone && c.position.length() > d) { d = c.position.length(); melhor = c; }
    return melhor;
}

// Pose sentada: modelo virado para +z (convenção glTF), mãos à frente, no teclado.
function sentar(raiz, o) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    for (const l of ['E', 'D']) {
        const s = l === 'E' ? 1 : -1;                                                     // +x é a esquerda do modelo, quando olha para +z
        apontar(raiz, o['coxa' + l], seguinte(o['coxa' + l], o['perna' + l]), V(s * 0.08, -0.08, 1));
        apontar(raiz, o['perna' + l], seguinte(o['perna' + l], o['pe' + l]), V(0, -1, 0.08));
        apontar(raiz, o['braco' + l], seguinte(o['braco' + l], o['antebraco' + l]), V(s * 0.12, -0.85, 0.35));
        apontar(raiz, o['antebraco' + l], seguinte(o['antebraco' + l], o['mao' + l]), V(-s * 0.25, 0.05, 1));
    }
}
function deBracosEmBaixo(raiz, o) {                                                    // tira a pose em T, se o modelo vier assim
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    for (const l of ['E', 'D']) {
        const s = l === 'E' ? 1 : -1;
        apontar(raiz, o['braco' + l], seguinte(o['braco' + l], o['antebraco' + l]), V(s * 0.12, -1, 0.02));
        apontar(raiz, o['antebraco' + l], seguinte(o['antebraco' + l], o['mao' + l]), V(s * 0.05, -1, 0.12));
    }
}

// Variedade: tons de pele, cabelo e roupa de escritório escolhidos por pessoa, pelo nome do material.
// Os materiais iguais são partilhados (cache), para não multiplicar os programas de sombreamento.
const PALETA = {
    skin: ['#f1c7a5', '#e8b58f', '#d39a72', '#b07a52', '#8a5a3c', '#f6d5bd'],
    hair: ['#2b1d14', '#4a3222', '#1c1a18', '#7a4e26', '#b38b55', '#8d8d8d'],
    shirt: ['#f4f6f8', '#d6e6f5', '#ffffff', '#1f4e79', '#9fb3c2', '#e9e4da', '#16365f'],
    pants: ['#1f2a38', '#2b3440', '#3a3f46', '#4a4f57', '#1a2230'],
};
const cacheMat = new Map();
function variar(mat, semente) {
    const n = mat.name.toLowerCase().replace(/\d+$/, ''), pal = PALETA[n === 'hair' ? 'hair' : n] ?? (/shirt|top|dress|jacket|suit/.test(n) ? PALETA.shirt : /pant|skirt/.test(n) ? PALETA.pants : null);
    if (!pal) { mat.envMapIntensity = 0.8; return mat; }
    const sal = { skin: 3, hair: 5, shirt: 7, pants: 11 }[n] ?? (mat.name.length * 13);
    const cor = pal[Math.floor(((semente * 2654435761 + sal * 40503) >>> 0) / 4294967296 * pal.length)] ;
    const chave = mat.name + cor;
    if (!cacheMat.has(chave)) { const m = mat.clone(); m.color.set(cor); if (/2$/.test(mat.name)) m.color.multiplyScalar(0.85); m.envMapIntensity = 0.8; cacheMat.set(chave, m); }
    return cacheMat.get(chave);
}

// ---------------------------------------------------------------------------
export async function carregarPessoas(scene, modelo) {
    let lista;
    try { const r = await fetch(PASTA + 'lista.json', { cache: 'no-cache' }); if (!r.ok) return null; lista = await r.json(); } catch { return null; }
    const sentadosUrl = lista.sentados ?? lista.modelos ?? [], dePeUrl = lista.de_pe ?? sentadosUrl, ALTURA = lista.altura ?? 1.72;
    if (!sentadosUrl.length && !dePeUrl.length) return null;
    let GLTFLoader, SkeletonUtils;
    try { ({ GLTFLoader } = await import('./vendor/GLTFLoader.js')); SkeletonUtils = await import('./vendor/SkeletonUtils.js'); }
    catch (e) { console.warn('Operações: não foi possível carregar o GLTFLoader; ficam as pessoas do código.', e); return null; }
    const carregador = new GLTFLoader(), cache = new Map();
    const abrir = url => { if (!cache.has(url)) cache.set(url, carregador.loadAsync(PASTA + url).catch(e => { console.warn('Operações: falhou ' + url, e); return null; })); return cache.get(url); };
    const [sent, pe] = await Promise.all([Promise.all(sentadosUrl.map(abrir)), Promise.all(dePeUrl.map(abrir))]);
    const okS = sent.filter(Boolean), okP = pe.filter(Boolean);
    if (!okS.length && !okP.length) return null;

    const grupo = new THREE.Group(); grupo.name = 'Operadores (glTF)'; modelo.sala.add(grupo);
    const misturadores = [];
    for (const lugar of modelo.lugares) {
        const fontes = lugar.sentado ? (okS.length ? okS : okP) : (okP.length ? okP : okS);
        const gltf = fontes[lugar.semente % fontes.length];
        const raiz = SkeletonUtils.clone(gltf.scene);
        raiz.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.material = [].concat(m.material).map(x => variar(x, lugar.semente)); if (m.material.length === 1) m.material = m.material[0]; } });
        // Escala: a altura do modelo em pé passa a ser ALTURA metros (com uma pequena variação)
        raiz.updateMatrixWorld(true);
        const caixa = new THREE.Box3().setFromObject(raiz), alt = Math.max(0.01, caixa.max.y - caixa.min.y);
        const escala = ALTURA * (0.95 + ((lugar.semente * 37) % 11) / 100) / alt;
        raiz.scale.setScalar(escala);
        const pivo = new THREE.Group(); pivo.add(raiz); grupo.add(pivo);
        pivo.position.set(lugar.x, lugar.y, lugar.z); pivo.rotation.y = lugar.ry + Math.PI;   // as pessoas do código olham para -z; o glTF olha para +z
        raiz.position.y = -caixa.min.y * escala;
        const ossos = encontrarOssos(raiz);
        const clips = gltf.animations ?? [], clip = clips.find(c => (lugar.sentado ? SENTADO : PARADO).test(c.name));
        if (clip) {
            const mx = new THREE.AnimationMixer(raiz), acao = mx.clipAction(clip); acao.play();
            mx.setTime((lugar.semente % 17) / 17 * clip.duration); misturadores.push(mx);   // cada um em sua fase, para não mexerem todos ao mesmo tempo
        } else if (lugar.sentado) sentar(raiz, ossos);
        else deBracosEmBaixo(raiz, ossos);
        if (lugar.sentado) {                                                           // assenta a anca na cadeira (0,50 m acima do piso da fila)
            raiz.updateMatrixWorld(true);
            const anca = ossos.anca ?? ossos.coxaE?.parent;
            if (anca) {
                const p = anca.getWorldPosition(new THREE.Vector3()); pivo.worldToLocal(p);
                raiz.position.y += 0.53 - p.y; raiz.position.z += -0.02 - p.z; raiz.position.x -= p.x;
            }
        }
    }
    if (modelo.pessoasMalha) modelo.pessoasMalha.visible = false;
    return { grupo, atualizar: dt => { for (const mx of misturadores) mx.update(dt); } };
}
