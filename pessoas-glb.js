// Pessoas em modelos glTF (.glb) para as salas 3D: passageiros, pessoal de terra e operadores.
// Opcional: se existir modelos/pessoas/lista.json, as pessoas desenhadas no código (malhas com o
// material "matPessoas" de cada sala) passam a ter dentro um modelo animado: anda quando a malha
// se desloca, fica parado (a respirar) quando não, e senta-se quando a sala usa a figura sentada.
// A sala continua a mexer só na sua malha (posição, rotação, visível), por isso o resto do código
// não muda; se faltar a lista, um ficheiro ou o carregador, ficam as pessoas do código.
//
// Modelos: Quaternius, "Animated Men/Women Characters" (CC0), convertidos para .glb com um só
// material de cor por vértice e as animações Idle, Walk e Sitting. Cada modelo traz em userData a
// lista das regiões de cor (pele, cabelo, camisa…), que aqui se trocam para dar variedade.
import * as THREE from 'three';

const PASTA = './modelos/pessoas/';
let promessa = null;

// Paletas por papel. Cada pessoa tira uma cor de cada regiao, de forma estável pela sua semente.
const PELE = ['#f1c7a5', '#e8b58f', '#d39a72', '#b07a52', '#8a5a3c', '#f6d5bd', '#c98e66'];
const CABELO = ['#2b1d14', '#4a3222', '#1c1a18', '#7a4e26', '#b38b55', '#8d8d8d', '#5a2e1a'];
const PAPEIS = {
    passageiro: { roupa: ['#2f4a6b', '#7a2e2e', '#3d5a3a', '#c8b68a', '#252a33', '#8a8f96', '#b5532a', '#4b3b63', '#d7d2c4', '#1f5f6b', '#a23b4a', '#5b6f8c', '#e9e4da', '#6b8fb3'],
        calca: ['#22262d', '#2c3e58', '#4a4033', '#3a3a3a', '#5b5f66', '#1d2a3a', '#6b5a44', '#8a7f6a'] },
    agente: { roupa: ['#1c2b4a', '#16365f', '#1c2b4a'], calca: ['#18233b', '#1a2230'], camisa2: ['#f2f2ee'] },          // farda da casa
    placa: { roupa: ['#f08a1c', '#f2c40f', '#f08a1c', '#e9d31a'], calca: ['#1d2a3a', '#232b36'], camisa2: ['#e9f0c2'] },   // colete de alta visibilidade
    operador: { roupa: ['#f4f6f8', '#d6e6f5', '#ffffff', '#1f4e79', '#9fb3c2', '#e9e4da', '#16365f'], calca: ['#1f2a38', '#2b3440', '#3a3f46', '#4a4f57'] },
};
const REGIAO = n => /skin/i.test(n) ? 'pele' : /hair/i.test(n) ? 'cabelo' : /eyes/i.test(n) ? null : /shirt2|details/i.test(n) ? 'camisa2'
    : /shirt|dress|top|jacket/i.test(n) ? 'roupa' : /pant|skirt/i.test(n) ? 'calca' : null;
const escolher = (lista, semente, sal) => lista[Math.floor((((semente + 1) * 2654435761 + sal * 40503) >>> 0) / 4294967296 * lista.length)];

export function carregarElenco() {
    promessa ??= (async () => {
        const r = await fetch(PASTA + 'lista.json', { cache: 'no-cache' }); if (!r.ok) return null;
        const lista = await r.json();
        const [{ GLTFLoader }, SkeletonUtils] = await Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/SkeletonUtils.js')]);
        const carregador = new GLTFLoader();
        const modelos = (await Promise.all((lista.modelos ?? []).map(async m => {
            try { const g = await carregador.loadAsync(PASTA + m.ficheiro); return preparar(g, m); }
            catch (e) { console.warn('Pessoas: falhou ' + m.ficheiro, e); return null; }
        }))).filter(Boolean);
        if (!modelos.length) return null;
        return { modelos, SkeletonUtils, altura: lista.altura ?? 1.72, mulheres: modelos.filter(m => m.mulher), homens: modelos.filter(m => !m.mulher) };
    })().catch(e => { console.warn('Pessoas: modelos .glb não carregados; ficam as pessoas do código.', e); return null; });
    return promessa;
}

// Mede o modelo uma vez: escala para a altura pedida, posição da anca na pose sentada.
function preparar(gltf, def) {
    let malha = null; gltf.scene.traverse(o => { if (o.isSkinnedMesh && !malha) malha = o; });
    if (!malha) return null;
    const clips = Object.fromEntries(gltf.animations.map(c => [c.name.toLowerCase().includes('walk') ? 'andar' : c.name.toLowerCase().includes('sit') ? 'sentar' : 'parado', c]));
    gltf.scene.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(gltf.scene, true), altura = caixa.max.y - caixa.min.y;
    let anca = null; gltf.scene.traverse(o => { if (o.isBone && !anca && /hips|pelvis/i.test(o.name)) anca = o; });
    const ossos = []; gltf.scene.traverse(o => { if (o.isBone) ossos.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
    const medir = (clip, t) => {
        if (!clip || !anca) return null;
        const mx = new THREE.AnimationMixer(gltf.scene), a = mx.clipAction(clip); a.play(); a.time = t; mx.update(0); gltf.scene.updateMatrixWorld(true);
        const p = anca.getWorldPosition(new THREE.Vector3()); mx.stopAllAction(); mx.uncacheRoot(gltf.scene);
        for (const [o, pp, q, e] of ossos) { o.position.copy(pp); o.quaternion.copy(q); o.scale.copy(e); }
        return p;
    };
    // A animação "Sitting" da Quaternius é o gesto de se sentar (≈0,7 s) seguido da pose sentada:
    // usa-se só a parte já sentada, sem repetir o gesto.
    const SENTADO_DESDE = clips.sentar ? Math.min(1.0, clips.sentar.duration * 0.3) : 0;
    const ancaSentada = medir(clips.sentar, clips.sentar ? clips.sentar.duration * 0.5 : 0);
    return { gltf, malha, clips, altura, chao: caixa.min.y, ancaSentada, sentadoDesde: SENTADO_DESDE, regioes: malha.userData.regioes ?? [], mulher: !!def.mulher, papeis: def.papeis ?? null, nome: def.ficheiro, variantes: new Map() };
}

// Geometria com as cores trocadas (partilha posições, normais e ossos com o original).
function variante(modelo, papel, semente) {
    const chave = papel + ':' + (semente % 9);
    if (modelo.variantes.has(chave)) return modelo.variantes.get(chave);
    const base = modelo.malha.geometry, pal = PAPEIS[papel] ?? PAPEIS.passageiro, s = semente % 9;
    const troca = modelo.regioes.map(r => {
        const reg = REGIAO(r.nome); if (!reg) return null;
        const lista = reg === 'pele' ? PELE : reg === 'cabelo' ? CABELO : pal[reg] ?? (reg === 'camisa2' ? null : pal.roupa);
        if (!lista) return null;
        const c = new THREE.Color(escolher(lista, s + (papel === 'passageiro' ? 0 : 3), reg.length * 7 + (reg === 'pele' || reg === 'cabelo' ? modelo.nome.length : 0)));
        if (reg === 'camisa2' && !pal.camisa2) c.multiplyScalar(0.8);
        return { de: r.cor, para: c };
    });
    const origem = base.attributes.color.array, cor = new Float32Array(origem);
    for (let i = 0; i < cor.length; i += 3) {
        for (let k = 0; k < troca.length; k++) {
            const t = troca[k]; if (!t) continue;
            if (Math.abs(origem[i] - t.de[0]) < 2e-3 && Math.abs(origem[i + 1] - t.de[1]) < 2e-3 && Math.abs(origem[i + 2] - t.de[2]) < 2e-3) { cor[i] = t.para.r; cor[i + 1] = t.para.g; cor[i + 2] = t.para.b; break; }
        }
    }
    const g = new THREE.BufferGeometry();
    for (const [n, a] of Object.entries(base.attributes)) g.setAttribute(n, n === 'color' ? new THREE.BufferAttribute(cor, 3) : a);
    g.setIndex(base.index); g.boundingSphere = base.boundingSphere; g.boundingBox = base.boundingBox;
    modelo.variantes.set(chave, g);
    return g;
}

const matPartilhado = new Map();
function material(modelo) {
    if (!matPartilhado.has(modelo.malha.material)) { const m = modelo.malha.material.clone(); m.vertexColors = true; m.roughness = 0.72; m.envMapIntensity = 0.7; matPartilhado.set(modelo.malha.material, m); }
    return matPartilhado.get(modelo.malha.material);
}

// Uma pessoa: um Group com o modelo animado e uma função para a pôr a andar, parada ou sentada.
export function criarFigura(elenco, semente, { papel = 'passageiro', mulher = null } = {}) {
    let fontes = elenco.modelos.filter(m => !m.papeis || m.papeis.includes(papel));
    if (mulher !== null) { const f = fontes.filter(m => m.mulher === mulher); if (f.length) fontes = f; }
    if (!fontes.length) fontes = elenco.modelos;
    const modelo = fontes[Math.floor((((semente + 7) * 2246822519) >>> 0) / 4294967296 * fontes.length)];
    const raiz = elenco.SkeletonUtils.clone(modelo.gltf.scene);
    let malha = null; raiz.traverse(o => { if (o.isSkinnedMesh && !malha) malha = o; });
    malha.geometry = variante(modelo, papel, semente); malha.material = material(modelo);
    malha.castShadow = true; malha.receiveShadow = false; malha.frustumCulled = false;
    const escala = elenco.altura * (0.94 + ((semente * 37) % 13) / 100) / modelo.altura;
    raiz.scale.setScalar(escala); raiz.position.y = -modelo.chao * escala;
    const figura = new THREE.Group(); figura.name = 'Pessoa (glTF)'; figura.add(raiz);
    const mixer = new THREE.AnimationMixer(raiz), acoes = {};
    for (const [k, c] of Object.entries(modelo.clips)) { acoes[k] = mixer.clipAction(c); acoes[k].enabled = true; }
    const fase = ((semente * 0.6180339887) % 1);
    let atual = null, assento = 0.5;
    const passar = (nome, t = 0.25) => {
        const nova = acoes[nome] ?? acoes.parado; if (!nova || nova === atual) return;
        const dur = nova.getClip().duration;
        nova.reset();
        if (nome === 'sentar') { nova.setLoop(THREE.LoopOnce, 1); nova.clampWhenFinished = true; nova.time = modelo.sentadoDesde + fase * (dur - modelo.sentadoDesde) * 0.5; }
        else nova.time = fase * dur;
        nova.setEffectiveWeight(1).play();
        if (atual) nova.crossFadeFrom(atual, t, false); atual = nova;
        // sentado: a anca vai para cima do assento; de pé: os pés no chão
        if (nome === 'sentar' && modelo.ancaSentada) raiz.position.set(-modelo.ancaSentada.x * escala, assento - modelo.ancaSentada.y * escala, -0.03 - modelo.ancaSentada.z * escala);
        else raiz.position.set(0, -modelo.chao * escala, 0);
    };
    passar('parado', 0);
    mixer.update(fase * 3);
    const ultimo = new THREE.Vector3(), agora = new THREE.Vector3();
    let primeiro = true;
    return {
        figura, modelo,
        // velocidade em m/s (de tempo real); sentado: pose sentada
        atualizar(dt, { sentado = false, velocidade = null, altura = 0.5 } = {}) {
            if (altura !== assento) { assento = altura; if (atual === acoes.sentar) { atual = null; } }
            figura.getWorldPosition(agora);
            const v = velocidade ?? (primeiro || dt <= 0 ? 0 : Math.hypot(agora.x - ultimo.x, agora.z - ultimo.z) / dt);
            ultimo.copy(agora); primeiro = false;
            if (sentado) passar('sentar');
            else if (v > 0.15) { passar('andar', 0.2); if (acoes.andar) acoes.andar.timeScale = THREE.MathUtils.clamp(v / 1.25, 0.6, 3.2); }
            else passar('parado', 0.35);
            mixer.update(Math.min(dt, 0.1));
        },
    };
}

// "Veste" as malhas de pessoas de uma sala: cada malha com o material matPessoas recebe dentro
// uma figura .glb e deixa de desenhar a sua própria geometria. A sala continua a mover a malha.
// Chamar depois de criar as pessoas (pode chamar-se várias vezes: só trata as malhas novas).
const invisivel = new THREE.MeshBasicMaterial({ visible: false });
export function vestir(elenco, raiz, matPessoas, { papel = null, tirarSalto = true } = {}) {
    if (!elenco) return 0;
    let n = 0;
    raiz.traverse(m => {
        if (!m.isMesh || m.userData.vestida || (m.material !== matPessoas && m.userData.matOriginal !== matPessoas)) return;
        const g = m.geometry, info = g.userData ?? {};
        const semente = info.semente ?? (m.id * 7919);
        const fig = criarFigura(elenco, semente, { papel: papel ?? info.papel ?? 'passageiro' });
        m.userData.vestida = fig; m.userData.matOriginal = m.material; m.material = invisivel;
        m.add(fig.figura);
        raiz.userData.figuras = (raiz.userData.figuras ?? 0) + 1;                       // multidões grandes: só as primeiras 60 fazem sombra
        if (raiz.userData.figuras > 60) fig.figura.traverse(o => { if (o.isMesh) o.castShadow = false; });
        fig.figura.scale.set(1 / m.scale.x, 1 / m.scale.y, 1 / m.scale.z);                // algumas pessoas do código vêm achatadas (condutores)
        const ehSentada = geo => geo.userData?.sentado === true;
        let antes = performance.now();
        // a figura atualiza-se quando é desenhada; a malha da sala pode trocar de geometria (de pé/sentada)
        let malhaGlb = null; fig.figura.traverse(o => { if (o.isSkinnedMesh) malhaGlb = o; });
        malhaGlb.onBeforeRender = () => {
            const agora = performance.now(), dt = (agora - antes) / 1000; antes = agora;
            if (dt <= 0) return;
            if (tirarSalto && m.parent?.isScene && !ehSentada(m.geometry)) fig.figura.position.y = -m.position.y;   // tira o "saltitar" das pessoas do código
            fig.atualizar(Math.min(dt, 0.25), { sentado: ehSentada(m.geometry), altura: m.geometry.userData?.assento ?? 0.5 });
        };
        n++;
    });
    return n;
}
