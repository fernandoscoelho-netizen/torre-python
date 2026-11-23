// Bloco 2 · Bagagens: sala de recolha em 3D.
// Não simula nada: reproduz o registo de eventos devolvido pelo motor Python (bagagens.py),
// por isso o que se vê é exatamente o que o programa do aluno fez. A cena só decide o caminho
// de cada mala dentro do minuto em que o registo diz que ela mudou de estado.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { melhorarCamara } from './camara-salas.js?v=camara-1';
import { carregarElenco, vestir } from './pessoas-glb.js?v=pessoas-1';
import { G, pontoCircuito, pontoAlimentacao, COMPRIMENTO_ALIMENTACAO, geometriaMala, geometriaPessoa, construirSala } from './baggage-hall-model.js?v=pessoas-1';

const V = 8;                                     // carrossel: metros por minuto simulado com o motor ligado
const VF = 60;                                   // tapete de alimentação: metros por minuto
const TF = COMPRIMENTO_ALIMENTACAO / VF;         // minutos entre o cais e a queda no carrossel
const CADENCIA = 32;                             // máximo de malas por minuto a cair no carrossel
const VP = 20;                                   // passo dos passageiros: metros por minuto simulado
const CORES_VOO = ['#e4572e', '#2e86de', '#f2b705', '#3fa34d', '#9b5de5'];
const acaso = (i, k = 0) => { let x = Math.imul(i + 1, 2654435761) ^ Math.imul(k + 7, 1597334677); x = Math.imul(x ^ (x >>> 15), 2246822519); x ^= x >>> 13; return (x >>> 0) / 4294967296; };

// ---------------------------------------------------------------------------
// Reconstrução do estado a partir do registo (funções puras)
export function prepararRegisto(registo) {
    const malas = new Map(), tapetes = {}, voos = {}, ocorrencias = [];
    for (const codigo of registo.tapetes) tapetes[codigo] = { estados: [], motor: [], entradas: [] };
    registo.voos.forEach((voo, i) => {
        voos[voo.codigo] = { codigo: voo.codigo, hora: voo.hora, cor: CORES_VOO[i % CORES_VOO.length] };
        for (const codigo of voo.malas) malas.set(codigo, { codigo, voo: voo.codigo, indice: malas.size, cor: CORES_VOO[i % CORES_VOO.length], passos: [] });
    });
    for (const e of registo.eventos) {
        if (e.tipo === 'mala') {
            const passo = { minuto: e.minuto, estado: e.estado, tapete: e.tapete };
            malas.get(e.mala)?.passos.push(passo);
            if (e.estado === 'no_carrossel') tapetes[e.tapete]?.entradas.push(passo);
        } else if (e.tipo === 'tapete') {
            tapetes[e.tapete]?.estados.push({ minuto: e.minuto, estado: e.estado, voo: e.voo });
            if (e.estado === 'avariado') tapetes[e.tapete]?.motor.push({ minuto: e.minuto, ligado: false });   // a avaria para o motor
        } else if (e.tipo === 'motor') tapetes[e.tapete]?.motor.push({ minuto: e.minuto, ligado: e.ligado });
        else if (e.tipo === 'ocorrencia') ocorrencias.push(e);
    }
    for (const mala of malas.values()) mala.passos.forEach((p, i) => {
        p.fim = mala.passos[i + 1]?.minuto ?? Infinity;
        if (p.estado === 'entregue') p.recolha = p.minuto + acaso(mala.indice, 3) * 0.8;   // o passageiro pega na mala durante esse minuto
    });
    // Dentro do minuto em que entram, as malas sobem pelo tapete de alimentação e caem uma a uma no carrossel.
    for (const tp of Object.values(tapetes)) {
        const total = {}, ordem = {};
        for (const p of tp.entradas) total[p.minuto] = (total[p.minuto] ?? 0) + 1;
        let fila = -Infinity, anterior = -Infinity, faixa = 0;
        for (const p of tp.entradas) {
            const n = ordem[p.minuto] = (ordem[p.minuto] ?? -1) + 1;
            p.ordem = n; p.total = total[p.minuto];
            fila = Math.max(p.minuto + TF + n / p.total * 0.7, fila + 1 / CADENCIA);
            p.entra = Math.min(fila, Math.max(p.minuto + 0.05, p.fim - 0.05));
            p.carga = Math.max(p.minuto, p.entra - TF);
            faixa = V * (p.entra - anterior) < 0.52 ? 1 - faixa : 0; p.faixa = faixa; anterior = p.entra;
            p.tmEntra = tempoMotor(tp.motor, p.entra);
        }
    }
    return { inicio: registo.inicio, fim: registo.fim, malas: [...malas.values()], tapetes, voos, ocorrencias, resumo: registo.resumo };
}

// Minutos de motor ligado entre o início e t (o carrossel só anda com o motor ligado).
export function tempoMotor(motor, t) {
    let total = 0, desde = null;
    for (const m of motor) {
        if (m.minuto > t) break;
        if (m.ligado && desde === null) desde = m.minuto;
        if (!m.ligado && desde !== null) { total += m.minuto - desde; desde = null; }
    }
    return desde === null ? total : total + (t - desde);
}

export function estadoTapete(tapete, t) {
    let estado = 'livre', voo = null, motor = false;
    for (const e of tapete.estados) { if (e.minuto > t) break; estado = e.estado; voo = e.voo; }
    for (const m of tapete.motor) { if (m.minuto > t) break; motor = m.ligado; }
    return { estado, voo, motor: motor && estado !== 'avariado' };
}

// Passo atual da mala no instante t, o anterior e o seguinte.
export function passoMala(mala, t) {
    let i = -1;
    while (i + 1 < mala.passos.length && mala.passos[i + 1].minuto <= t) i++;
    return { atual: mala.passos[i] ?? null, seguinte: mala.passos[i + 1] ?? null, anterior: mala.passos[i - 1] ?? null };
}

export function contar(dados, t) {
    const n = { porao: 0, transporte: 0, espera: 0, carrossel: 0, entregue: 0, inspecao: 0 };
    for (const mala of dados.malas) {
        const e = passoMala(mala, t).atual?.estado ?? 'no_porao';
        if (e === 'no_porao' || e === 'descarregada') n.porao++;
        else if (e === 'em_transporte') n.transporte++;
        else if (e === 'em_espera') n.espera++;
        else if (e === 'no_carrossel') n.carrossel++;
        else n[e]++;
    }
    return n;
}

export function tapeteDoVoo(dados, voo, t) {
    for (const [codigo, tp] of Object.entries(dados.tapetes)) if (estadoTapete(tp, t).voo === voo) return codigo;
    return null;
}

// ---------------------------------------------------------------------------
// Interface
const estilo = document.createElement('style');
estilo.textContent = `
.baggage-hall{position:absolute;inset:0;z-index:6;background:#cfd6d8;display:none}
.baggage-hall.aberta{display:block}
.baggage-hall canvas{display:block;width:100%;height:100%}
.bh-topo{position:absolute;top:12px;left:14px;right:14px;display:flex;gap:10px;align-items:flex-start;justify-content:space-between;pointer-events:none;font:13px/1.35 system-ui,sans-serif}
.bh-cartao{pointer-events:auto;background:#14273ae8;color:#e8eef2;border-radius:6px;padding:9px 12px;backdrop-filter:blur(8px)}
.bh-cartao b{font-size:12px;letter-spacing:1.5px;font-weight:650}
.bh-contadores{display:grid;grid-template-columns:repeat(3,auto);gap:4px 14px;margin-top:6px;font-variant-numeric:tabular-nums}
.bh-contadores span{color:#9fb3c2;font-size:11px;display:block}
.bh-ocorrencias{max-width:260px;max-height:120px;overflow:auto;font-size:12px}
.bh-ocorrencias li{margin-left:16px}
.bh-controlos{position:absolute;left:14px;right:14px;bottom:14px;display:flex;gap:8px;align-items:center;background:#14273ae8;color:#e8eef2;border-radius:6px;padding:8px 10px;font:13px system-ui,sans-serif}
.bh-controlos input[type=range]{flex:1;min-width:60px}
.bh-controlos button,.bh-controlos select{background:#2d4b63;color:#fff;border:1px solid #ffffff33;border-radius:4px;padding:4px 9px;font:inherit;cursor:pointer}
.bh-hora{font-variant-numeric:tabular-nums;min-width:44px;text-align:center;font-weight:650}
.bh-seguir{position:absolute;right:14px;top:12px;max-width:280px;font-size:12px}
.bh-seguir ol{margin:6px 0 0 18px;padding:0}
.bh-seguir button{margin-top:6px;background:#2d4b63;color:#fff;border:1px solid #ffffff33;border-radius:4px;padding:3px 8px;cursor:pointer}
.bh-legenda i{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 10px;vertical-align:-1px}
.bh-dica{font-size:11px;color:#9fb3c2;margin-top:6px}
.bh-abrir{position:absolute;right:12px;bottom:32px;z-index:5;background:#14273ae8;color:#e8eef2;border:1px solid #ffffff33;border-radius:4px;padding:6px 11px;font:13px system-ui,sans-serif;cursor:pointer}
.bh-vazio[hidden],.bh-cartao[hidden]{display:none}
.bh-vazio{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);background:#14273ae8;color:#e8eef2;border-radius:6px;padding:8px 14px;font:13px system-ui,sans-serif;text-align:center;pointer-events:none;max-width:80%}
`;
document.head.append(estilo);

const viewport = document.querySelector('.workspace-viewport') ?? document.getElementById('scene')?.parentElement ?? document.body;
const sala = document.createElement('div');
sala.className = 'baggage-hall';
sala.innerHTML = `
<div class="bh-topo">
  <div class="bh-cartao"><b>SALA DE RECOLHA · BAGAGENS</b><span class="bh-legenda" id="bh-legenda"></span><div class="bh-contadores" id="bh-contadores"></div><div class="bh-dica">A cinta de cada mala tem a cor do voo. Clica numa mala para a seguir.</div></div>
  <div class="bh-cartao bh-ocorrencias" id="bh-ocorrencias" hidden></div>
</div>
<div class="bh-cartao bh-seguir" id="bh-seguir" hidden></div>
<div class="bh-vazio" id="bh-vazio">Executa um programa do Bloco 2 (por exemplo, o nível 21) para ver aqui as malas do PY001.</div>
<div class="bh-controlos">
  <button id="bh-play" title="Reproduzir ou pausar">▶</button>
  <span class="bh-hora" id="bh-hora">--:--</span>
  <input type="range" id="bh-tempo" min="0" max="1" step="0.002" value="0" aria-label="Hora simulada">
  <select id="bh-velocidade" aria-label="Velocidade"><option value="0.1">0,1 min/s</option><option value="0.25" selected>0,25 min/s</option><option value="0.5">0,5 min/s</option><option value="1">1 min/s</option><option value="2">2 min/s</option><option value="4">4 min/s</option></select>
  <select id="bh-vista" aria-label="Vista"><option value="geral">Vista geral</option><option value="passageiro">Passageiro</option><option value="carrossel">Carrossel</option><option value="tecnica">Zona técnica</option></select>
  <button id="bh-fechar" title="Voltar à maquete do aeroporto">Aeroporto ✕</button>
</div>`;
viewport.append(sala);
const botaoAbrir = document.createElement('button');
botaoAbrir.className = 'bh-abrir';
botaoAbrir.textContent = '🧳 Sala de bagagens';
viewport.append(botaoAbrir);
const $ = id => sala.querySelector('#' + id);
const NOMES_ESTADO = { no_porao: 'no porão', descarregada: 'descarregada', em_transporte: 'em transporte', em_espera: 'em espera', no_carrossel: 'no carrossel', entregue: 'entregue', inspecao: 'em inspeção' };
function hhmm(m) { m = Math.floor(m); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

// ---------------------------------------------------------------------------
// Cena
let elenco = null;
let renderer = null, scene, camera, controls, modelo, marcador;
let dados = null, t = 0, fimVisual = 0, aReproduzir = false, ultimo = 0, ciclo = null, seguida = null;
let malhasMala = new Map(), pessoas = [], lotes = [], operadores = [], objetos = [];
const geoMalas = new Map(), geoPessoas = [];
const UP = new THREE.Vector3(0, 1, 0), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const poseA = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }, poseB = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
const COMP_RAMPA = Math.hypot(G.R_MALA - 1.02, 1.42 - 0.9), TOPO_RAMPA = pontoAlimentacao(COMP_RAMPA);

function construir() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
    sala.prepend(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#cfd6d8');
    camera = new THREE.PerspectiveCamera(45, 1, 0.25, 500);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.minDistance = 1.5; controls.maxDistance = 170;
    modelo = construirSala(scene, renderer);
    melhorarCamara({ controls, camera, scene, sala, barra: sala.querySelector('.bh-controlos'), antesDe: sala.querySelector('#bh-fechar') });
    carregarElenco().then(e => { elenco = e; vestir(e, scene, modelo.matPessoas); });     // pessoas .glb, se existirem (opcional)
    for (let i = 0; i < 4; i++) {                // um operador de pista em cada cais de carga
        const m = new THREE.Mesh(geometriaPessoa(900 + i, true), modelo.matPessoas);
        m.position.set(G.XS[i] + 1.05, 0, -28.9); m.rotation.y = -Math.PI / 2; m.castShadow = true; m.visible = false; scene.add(m); operadores.push(m);
    }
    marcador = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffd400', depthTest: false, transparent: true }));
    marcador.rotation.x = Math.PI / 2; marcador.renderOrder = 5; marcador.visible = false; scene.add(marcador);
    const raio = new THREE.Raycaster(), ponteiro = new THREE.Vector2();
    let inicioClique = null;
    renderer.domElement.addEventListener('pointerdown', e => { inicioClique = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', e => {
        if (!inicioClique || Math.hypot(e.clientX - inicioClique[0], e.clientY - inicioClique[1]) > 5 || !dados) return;
        const caixa = renderer.domElement.getBoundingClientRect();
        ponteiro.set((e.clientX - caixa.left) / caixa.width * 2 - 1, -(e.clientY - caixa.top) / caixa.height * 2 + 1);
        raio.setFromCamera(ponteiro, camera);
        const alvo = raio.intersectObjects([...malhasMala.values()].filter(m => m.visible))[0]?.object;
        seguir(alvo ? alvo.userData.codigo : null);
    });
    new ResizeObserver(ajustar).observe(sala);
    ajustar(); vista('geral');
}

function ajustar() {
    if (!renderer) return;
    const w = Math.max(1, sala.clientWidth), h = Math.max(1, sala.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

export function vista(nome) {
    if (!camera) return;
    let x0 = 0;
    if (dados) { const voo = Object.keys(dados.voos)[0], tap = tapeteDoVoo(dados, voo, Math.min(t, dados.fim)) ?? Object.keys(dados.tapetes).find(c => dados.tapetes[c].entradas.length); x0 = modelo.carrosseis[tap]?.x ?? 0; }
    const v = Array.isArray(nome) ? nome : { geral: [[0, 60, 47], [0, 0, -5]], passageiro: [[x0 - 13.5, 1.72, 18.6], [x0 + 2, 1.25, 7.5]], carrossel: [[x0 + 11.5, 7.4, 21], [x0 - 0.5, 0.8, 3]], tecnica: [[x0 + 13, 8.5, -45], [x0 + 1, 1, -22]] }[nome] ?? null;
    if (!v) return;
    camera.position.set(...v[0]); controls.target.set(...v[1]); controls.update();
    if (!Array.isArray(nome)) $('bh-vista').value = nome;
}

// --- Posições das malas --------------------------------------------------------
function base(o, x, y, z, frente) {              // orienta o comprimento da mala segundo `frente`
    _x.copy(frente).normalize(); _z.crossVectors(_x, UP).normalize(); _y.crossVectors(_z, _x);
    _m.makeBasis(_x, _y, _z); o.quaternion.setFromRotationMatrix(_m); o.position.set(x, y, z);
}
function girar(o, angulo) { _q.setFromAxisAngle(UP, angulo); o.quaternion.multiply(_q); }

function noCarrossel(o, dim, x0, s, faixa, i) {
    const r = (faixa ? 2.2 : 3.0) - dim.L * 0.48, p = pontoCircuito(s, r), c = Math.cos(G.INCLINACAO), sn = Math.sin(G.INCLINACAO);
    _x.set(p.rx * c, -sn, p.rz * c); _y.set(p.rx * sn, c, p.rz * sn); _z.crossVectors(_x, _y);
    _m.makeBasis(_x, _y, _z); o.quaternion.setFromRotationMatrix(_m); girar(o, (acaso(i, 13) - 0.5) * 0.6);
    o.position.set(x0 + p.x, p.y + 0.012, p.z);
}

function naAlimentacao(o, dim, x0, d, faixa, i) {
    const p = pontoAlimentacao(d);
    if (p.oculto) return false;
    if (p.troco === 0) {                         // rampa de queda: desliza até à faixa onde vai ficar
        const a = pontoCircuito(G.S_QUEDA, (faixa ? 2.2 : 3.0) - dim.L * 0.48), k = Math.min(1, d / COMP_RAMPA);
        const x = a.x + (TOPO_RAMPA.x - a.x) * k, y = a.y + (TOPO_RAMPA.y - a.y) * k + 0.03;
        base(o, x0 + x, y, a.z, _x.set(a.x - TOPO_RAMPA.x, a.y - TOPO_RAMPA.y, 0));
        return true;
    }
    const cd = Math.cos(p.declive);
    base(o, x0 + p.x, p.y + 0.01, p.z, _x.set(-Math.sin(p.angulo) * cd, -Math.sin(p.declive), -Math.cos(p.angulo) * cd));
    girar(o, (acaso(i, 15) - 0.5) * 0.25);
    return true;
}

function noReboque(o, dim, passo, i) {
    const lote = passo.lote, r = lote?.reboques[Math.floor(passo.lugar / 30)];
    if (!r?.visivel) return false;
    const k = passo.lugar % 30, lx = -1.12 + (k % 5) * 0.56, lz = (Math.floor(k / 5) % 2 - 0.5) * 0.74, c = Math.cos(r.ang), s = Math.sin(r.ang);
    o.position.set(r.x + lx * c + lz * s, 0.615 + Math.floor(k / 10) * 0.31, r.z - lx * s + lz * c);
    o.quaternion.setFromEuler(_e.set(0, r.ang + Math.PI / 2 + (acaso(i, 16) - 0.5) * 0.2, 0));
    return true;
}

function naInspecao(o, k) {
    const ix = 38, iz = -22.5;
    if (k < 8) o.position.set(ix + (k < 4 ? 1 : -1) * 2.75 - 1.2 + (k % 4) * 0.8, 0.93, iz);
    else o.position.set(ix - 3.2 + ((k - 8) % 8) * 0.85, 0, iz + 1.5 + Math.floor((k - 8) / 8) * 0.8);
    o.quaternion.setFromEuler(_e.set(0, Math.PI / 2, 0));
    return true;
}

function naMao(o, dim, pose) {                   // mala de pé, a rodar ao lado do passageiro
    const s = Math.sin(pose.ang), c = Math.cos(pose.ang);
    o.position.set(pose.x + c * 0.36 - s * 0.22, dim.L / 2 + 0.03, pose.z - s * 0.36 - c * 0.22);
    o.quaternion.setFromEuler(_e.set(0, pose.ang + Math.PI / 2, Math.PI / 2, 'YXZ'));
    return true;
}

function misturar(o, a, b, k, arco) {
    k = Math.max(0, Math.min(1, k));
    o.position.lerpVectors(a.position, b.position, k); o.position.y += Math.sin(k * Math.PI) * arco;
    o.quaternion.slerpQuaternions(a.quaternion, b.quaternion, k);
}

function cicloTapete(o, dim, p, i, tt) {         // do reboque ao carrossel, dentro do passo no_carrossel
    const x0 = modelo.carrosseis[p.tapete]?.x;
    if (x0 === undefined) return false;
    if (tt >= p.entra) { noCarrossel(o, dim, x0, G.S_QUEDA + V * (tempoMotor(dados.tapetes[p.tapete].motor, tt) - p.tmEntra), p.faixa, i); return true; }
    if (tt >= p.carga) return naAlimentacao(o, dim, x0, VF * (p.entra - tt), p.faixa, i);
    if (tt >= p.carga - 0.05 && noReboque(poseA, dim, p, i) && naAlimentacao(poseB, dim, x0, VF * (p.entra - p.carga), p.faixa, i)) { misturar(o, poseA, poseB, (tt - p.carga + 0.05) / 0.05, 0.45); return true; }
    return noReboque(o, dim, p, i);
}

function colocarMala(mala, o, tt) {
    const { atual, anterior } = passoMala(mala, tt), dim = o.geometry.userData, i = mala.indice;
    if (!atual) return false;
    switch (atual.estado) {
        case 'em_transporte': case 'em_espera': return noReboque(o, dim, atual, i);
        case 'inspecao': return naInspecao(o, atual.lugarInspecao ?? 0);
        case 'no_carrossel': return cicloTapete(o, dim, atual, i, tt);
        case 'entregue': {
            if (anterior?.estado !== 'no_carrossel') return false;
            if (tt < atual.recolha) return cicloTapete(o, dim, anterior, i, tt);
            const pose = mala.dono?.pose;
            if (!pose) return false;             // o passageiro já saiu para o átrio das chegadas
            if (tt < atual.recolha + 0.08) { naMao(poseB, dim, pose); cicloTapete(poseA, dim, anterior, i, atual.recolha); misturar(o, poseA, poseB, (tt - atual.recolha) / 0.08, 0.3); return true; }
            return naMao(o, dim, pose);
        }
    }
    return false;
}

// --- Tratores e reboques na zona técnica ------------------------------------------
const Z_CAIS = -30.1, caminhos = {};
function curva(pontos) { const c = new THREE.CatmullRomCurve3(pontos.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'); c.arcLengthDivisions = 400; return { c, comp: c.getLength() }; }
function caminho(tipo, x0) {
    const chave = tipo + x0;
    if (caminhos[chave]) return caminhos[chave];
    const xd = x0 + 5.4;
    if (tipo === 'chegada') return caminhos[chave] = curva([[-60, -26], [-49, -26], [-43.5, -27.6], ...(x0 - 12 > -36 ? [[-39.5, -31.2], [-34, -31.8], [x0 - 13, -31.8], [x0 - 6, Z_CAIS - 0.2]] : [[x0 - 9, Z_CAIS + 0.4], [x0 - 4, Z_CAIS]]), [xd - 5, Z_CAIS], [xd, Z_CAIS]]);
    return caminhos[chave] = curva([[xd, Z_CAIS], [xd + 4, Z_CAIS - 0.3], ...(xd + 14 < 37 ? [[xd + 9, -31.7], [35, -31.8]] : []), [42.5, -29.3], [49, -26.2], [62, -26]]);
}
function noCaminho(cam, d) {                     // posição e rumo a d metros do início (extrapola antes e depois)
    const u = Math.max(0, Math.min(1, d / cam.comp)), p = cam.c.getPointAt(u), tg = cam.c.getTangentAt(u), fora = d < 0 ? d : d > cam.comp ? d - cam.comp : 0;
    return { x: p.x + tg.x * fora, z: p.z + tg.z * fora, ang: Math.atan2(-tg.z, tg.x) };
}

const suave = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
function avanco(l, tt, comp) {                   // metros já percorridos na chegada: vem da placa, aguarda vez atrás do cais e só depois encosta
    const entra = l.A + (l.B - l.A) * 0.2, para = Math.max(entra + 0.05, l.B - 0.45), vai = Math.max(para, l.B - 0.28), espera = Math.min(14, comp / 2);
    if (tt < para) return suave((tt - entra) / (para - entra)) * (comp - espera);
    if (tt < vai || l.curto) return comp - espera;
    return comp - espera + suave((tt - vai) / (l.B - 0.02 - vai)) * espera;
}

function atualizarLotes(tt, tapeteAgora) {
    const parados = new Map();
    for (const l of lotes) {
        l.fase = 'fora';
        const chega = l.A === null ? l.B : l.B - 0.02, entra = l.A === null ? l.B : l.A + (l.B - l.A) * 0.2;
        if (tt < entra) continue;
        if (tt < chega) l.fase = 'viagem';
        else if (tt <= l.fim + 0.06) { l.fase = 'parado'; const d = tapeteAgora[l.voo] ?? '-'; if (!parados.has(d)) parados.set(d, []); parados.get(d).push(l); }
        else if (tt < l.fim + 1.2 && l.tapeteFim) { l.fase = 'saida'; l.k = (tt - l.fim - 0.06) / 1.14; }
    }
    for (const m of operadores) m.visible = false;
    for (const [d, lista] of parados) {
        const x0 = modelo.carrosseis[d]?.x; let q = 0;
        lista.forEach((l, ordem) => {
            l.veiculos[0].visivel = false;
            l.reboques.forEach((r, j) => {
                r.visivel = true; r.ang = 0;
                if (x0 === undefined) { r.x = -5.4 + (q % 4) * 3.6; r.z = -19.2 - Math.floor(q / 4) * 2.1; q++; }       // sem carrossel: zona de espera
                else if (ordem === 0) { r.x = x0 + 2.05 - 3.4 * j; r.z = Z_CAIS; Object.assign(l.veiculos[0], { visivel: true, x: x0 + 5.4, z: Z_CAIS, ang: 0 }); }
                else { r.x = x0 + 4 - 3.4 * q; r.z = -34.75; q++; }                                                 // fila de reboques à espera de vez
            });
        });
        const n = Object.keys(modelo.carrosseis).indexOf(d);
        if (n >= 0) operadores[n].visible = true;
    }
    for (const l of lotes) {
        if (l.fase === 'fora') for (const v of l.veiculos) v.visivel = false;
        else if (l.fase !== 'parado') {
            const cam = l.fase === 'viagem' ? caminho('chegada', modelo.carrosseis[l.tapeteB]?.x ?? -2) : caminho('saida', modelo.carrosseis[l.tapeteFim].x);
            const d = l.fase === 'viagem' ? avanco(l, tt, cam.comp) : l.k ** 1.3 * (cam.comp + 4 * l.veiculos.length);
            l.veiculos.forEach((v, j) => Object.assign(v, noCaminho(cam, d - (j ? 3.35 + 3.4 * (j - 1) : 0)), { visivel: true }));
        }
        l.veiculos.forEach(v => { v.malha.visible = v.visivel; if (v.visivel) { v.malha.position.set(v.x, 0, v.z); v.malha.rotation.y = v.ang; } });
    }
}

// --- Passageiros ---------------------------------------------------------------------
const BANDA = 17;
function acesso(p, j) {                           // do corredor principal até um lugar junto a um carrossel
    if (p.z >= 15.4) return [];
    let x0 = G.XS[0]; for (const x of G.XS) if (Math.abs(p.x - x) < Math.abs(p.x - x0)) x0 = x;
    const ax = x0 + (p.x >= x0 ? 6.3 : -6.3) + j * 1.5;
    return [[ax, BANDA + j * 2.2], [ax, Math.max(-7.6, Math.min(14.8, p.z))]];
}
function rota(de, para, j, extra) {
    const a = acesso(de, j), b = acesso(para, j), pts = [[de.x, de.z]];
    if (a.length && b.length && a[0][0] === b[0][0]) pts.push(a[1], b[1]);
    else { if (a.length) pts.push(a[1], a[0]); if (b.length) pts.push(b[0], b[1]); }
    pts.push([para.x, para.z]); if (extra) pts.push(extra);
    const acum = [0]; for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, acum, comp: acum.at(-1) };
}
function naRota(r, d) {
    d = Math.max(0, Math.min(r.comp, d)); let i = 1; while (i < r.pts.length - 1 && r.acum[i] < d) i++;
    const a = r.pts[i - 1], b = r.pts[i], L = r.acum[i] - r.acum[i - 1], k = L > 1e-6 ? (d - r.acum[i - 1]) / L : 1;
    return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, ang: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}
function avaliar(trocos, tt) {
    let tr = null; for (const x of trocos) { if (x.t0 > tt) break; tr = x; }
    if (!tr) return null;
    const k = Math.min(1, (tt - tr.t0) / (tr.t1 - tr.t0)), p = naRota(tr.r, k * tr.r.comp);
    return { x: p.x, z: p.z, ang: k < 1 ? p.ang : tr.face ?? p.ang, anda: k < 1, d: k * tr.r.comp };
}

function planear() {
    // Lotes: cada grupo de malas que viaja no mesmo reboque (ou que é retirado de um carrossel numa transferência)
    const mapa = new Map(); let inspecoes = 0;
    const lote = (voo, B, A) => { const chave = voo + '|' + B + '|' + (A === null ? 't' : 'c'); if (!mapa.has(chave)) mapa.set(chave, { voo, B, A, n: 0, fim: -Infinity }); return mapa.get(chave); };
    for (const mala of dados.malas) mala.passos.forEach((p, i) => {
        const ant = mala.passos[i - 1], seg = mala.passos[i + 1];
        if (p.estado === 'inspecao') p.lugarInspecao = inspecoes++;
        if (p.estado === 'em_transporte') { p.lote = lote(mala.voo, seg?.estado === 'em_espera' ? seg.minuto : p.minuto + 3, p.minuto); p.lugar = p.lote.n++; if (!seg) p.lote.fim = Infinity; }
        if (p.estado !== 'em_espera') return;
        if (ant?.estado === 'em_transporte') { p.lote = ant.lote; p.lugar = ant.lugar; } else { p.lote = lote(mala.voo, p.minuto, null); p.lugar = p.lote.n++; }
        if (seg?.estado === 'no_carrossel') { seg.lote = p.lote; seg.lugar = p.lugar; }
        p.lote.fim = Math.max(p.lote.fim, seg ? (seg.estado === 'no_carrossel' ? seg.carga : seg.minuto) : Infinity);
    });
    lotes = [...mapa.values()].sort((a, b) => a.B - b.B);
    for (const l of lotes) {
        l.tapeteB = tapeteDoVoo(dados, l.voo, l.B); l.tapeteFim = Number.isFinite(l.fim) ? tapeteDoVoo(dados, l.voo, l.fim) : null;
        l.veiculos = [{ malha: modelo.novoTrator() }]; for (let j = 0; j < Math.ceil(l.n / 30); j++) l.veiculos.push({ malha: modelo.novoReboque() });
        l.reboques = l.veiculos.slice(1); objetos.push(...l.veiculos.map(v => v.malha));
        l.curto = l.A !== null && lotes.some(o => o !== l && o.B <= l.B && o.fim + 0.06 > l.B && tapeteDoVoo(dados, o.voo, l.B) === l.tapeteB) ? 9 + 3.4 * l.reboques.length : 0;   // cais ocupado: para atrás
    }
    // Passageiros: o dono de cada mala entra na sala, espera junto ao carrossel do voo e sai com a mala
    const ocupados = {}, entrada = i => ({ x: -45.3, z: 18.2 + acaso(i, 10) * 2 });
    const lugarNoTapete = (tap, s, i) => {
        const m = ocupados[tap] ??= new Map(), n = Math.round(G.PERIMETRO / 0.62), s0 = Math.round(s / 0.62); let slot = ((s0 % n) + n) % n;
        procura: for (let d = 0; d < 9; d++) for (const k of [1, -1]) { const c = (((s0 + k * d) % n) + n) % n; if ((m.get(c) ?? 0) < 3) { slot = c; break procura; } }
        const fila = m.get(slot) ?? 0; m.set(slot, fila + 1);
        const p = pontoCircuito(slot * 0.62 + (acaso(i, 5) - 0.5) * 0.3, G.R_FASCIA + 0.42 + fila * 0.58 + acaso(i, 6) * 0.12), x0 = modelo.carrosseis[tap].x;
        let x = x0 + p.x, z = p.z;
        if (z < -5 && Math.abs(p.x) < 1.25) x = x0 + (acaso(i, 7) < 0.5 ? -1 : 1) * (1.4 + fila * 0.5);        // não ficar debaixo do tapete de alimentação
        if (Math.hypot(p.x - 4.75, z - 12.2) < 0.9) z += 1.2;                                                  // nem em cima do totem
        return { x, z, face: Math.atan2(-p.rx, -p.rz) };
    };
    const mudancas = {};
    for (const voo of Object.keys(dados.voos)) { const lista = mudancas[voo] = []; for (let m = dados.inicio; m <= dados.fim; m++) { const tap = tapeteDoVoo(dados, voo, m); if (!lista.length || lista.at(-1).tap !== tap) lista.push({ t: m, tap }); } }
    const planos = dados.malas.map(mala => {
        const i = mala.indice, iE = mala.passos.findIndex(p => p.estado === 'entregue'), entregue = mala.passos[iE] ?? null, ultimo = entregue && mala.passos[iE - 1]?.estado === 'no_carrossel' ? mala.passos[iE - 1] : null;
        const lugares = {};
        if (ultimo) lugares[ultimo.tapete] = lugarNoTapete(ultimo.tapete, G.S_QUEDA + V * (tempoMotor(dados.tapetes[ultimo.tapete].motor, entregue.recolha) - ultimo.tmEntra), i);
        return { mala, i, entregue, ultimo, lugares };
    });
    pessoas = planos.map(({ mala, i, entregue, ultimo, lugares }) => {
        const voo = dados.voos[mala.voo], j = acaso(i, 12) - 0.5, limite = ultimo ? entregue.recolha : Infinity, trocos = [];
        const chegada = Math.min(voo.hora + 1.5 + acaso(i, 1) * 4.5, limite - 1.2);
        const espera = { x: -34 + acaso(i, 8) * 68, z: 21.7 + acaso(i, 9) * 1.5, face: Math.PI };
        const lugar = tap => tap === null || !modelo.carrosseis[tap] ? espera : lugares[tap] ??= lugarNoTapete(tap, acaso(i, 2) * G.PERIMETRO, i);
        const lista = mudancas[mala.voo], primeiro = Math.max(0, lista.findLastIndex(m => m.t <= chegada));
        lista.slice(primeiro).forEach((mud, n) => {
            const t0 = n ? mud.t + 0.05 + acaso(i, 20 + n) * 0.3 : chegada;
            if (t0 >= limite - 0.05) return;
            const destino = lugar(mud.tap), de = trocos.length ? avaliar(trocos, t0) : entrada(i), r = rota(de, destino, j);
            let dur = Math.max(0.02, r.comp / (VP * (0.85 + acaso(i, 4) * 0.3)));
            if (mud.tap === ultimo?.tapete && t0 + dur > limite - 0.03) dur = Math.max(0.02, limite - 0.03 - t0);
            trocos.push({ t0, t1: t0 + dur, r, face: destino.face });
        });
        let fimVida = Infinity;
        if (ultimo) {
            const t0 = entregue.recolha + 0.08, de = avaliar(trocos, t0) ?? lugares[ultimo.tapete], xs = -4 + (acaso(i, 11) - 0.5) * 3.2, r = rota(de, { x: xs, z: 26.2 }, j, [xs, 33.2]);
            fimVida = t0 + r.comp / VP; trocos.push({ t0, t1: fimVida, r });
        }
        if (!geoPessoas[i % 28]) geoPessoas[i % 28] = geometriaPessoa(i % 28 + 1);
        const malha = new THREE.Mesh(geoPessoas[i % 28], modelo.matPessoas); malha.castShadow = true; malha.visible = false; scene.add(malha); objetos.push(malha);
        return mala.dono = { chegada, trocos, fimVida, malha, pose: null };
    });
    vestir(elenco, scene, modelo.matPessoas);
}

function carregar(registo) {
    for (const o of objetos) scene.remove(o);
    objetos = []; malhasMala.clear();
    dados = prepararRegisto(registo);
    for (const mala of dados.malas) {
        const tipo = Math.floor(acaso(mala.indice, 14) * 24), chave = mala.cor + tipo;
        if (!geoMalas.has(chave)) geoMalas.set(chave, geometriaMala(tipo, mala.cor));
        const malha = new THREE.Mesh(geoMalas.get(chave), modelo.matMalas);
        malha.castShadow = true; malha.visible = false; malha.userData.codigo = mala.codigo; scene.add(malha); objetos.push(malha);
        malhasMala.set(mala.codigo, malha);
    }
    planear();
    $('bh-vazio').hidden = true;
    seguir(null);
    $('bh-legenda').innerHTML = Object.values(dados.voos).map(v => `<i style="background:${v.cor}"></i>${v.codigo}`).join('');
    fimVisual = dados.fim + 3;
    $('bh-tempo').min = dados.inicio; $('bh-tempo').max = fimVisual;
    const lista = dados.ocorrencias;
    $('bh-ocorrencias').hidden = !lista.length;
    $('bh-ocorrencias').innerHTML = '<b>OCORRÊNCIAS</b><ul>' + lista.map(o => `<li>${hhmm(o.minuto)} · ${o.texto.replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;')}</li>`).join('') + '</ul>';
    const primeira = Math.min(...lotes.map(l => l.A ?? l.B), dados.fim);
    t = Math.max(dados.inicio, primeira - 1.5); aReproduzir = true;
    vista('geral');
}

function desenharEcra(c, est, n, tt) {
    const chave = [est.estado, est.voo, est.motor, n, Math.floor(tt)].join('|');
    if (c.chave === chave) return;
    c.chave = chave;
    const g = c.ecraCanvas.getContext('2d'), W = 512, H = 384, avaria = est.estado === 'avariado';
    g.fillStyle = avaria ? '#3a0f0c' : '#0b1b33'; g.fillRect(0, 0, W, H);
    g.fillStyle = avaria ? '#6b1a14' : '#16335f'; g.fillRect(0, 0, W, 62);
    g.fillStyle = '#fff'; g.font = 'bold 28px Arial, sans-serif'; g.textAlign = 'left'; g.fillText('Recolha de bagagens', 20, 40); g.textAlign = 'right'; g.fillText(hhmm(tt), W - 20, 40); g.textAlign = 'left';
    g.fillStyle = '#ffd21f'; g.font = 'bold 150px Arial, sans-serif'; g.fillText(String(c.numero), 22, 208);
    g.fillStyle = '#fff'; g.font = 'bold 60px Arial, sans-serif'; g.fillText(est.voo ?? '—', 150, 146);
    g.fillStyle = '#b9c7dd'; g.font = '28px Arial, sans-serif'; g.fillText(est.voo ? 'Chegada ' + hhmm(dados.voos[est.voo]?.hora ?? tt) : avaria ? 'Fora de serviço' : 'Sem voo atribuído', 152, 194);
    const [cor, texto] = avaria ? ['#c0392b', 'AVARIA · OUT OF SERVICE'] : est.motor ? ['#1f8a4c', 'ENTREGA EM CURSO'] : est.estado === 'ocupado' ? ['#b7791f', 'A AGUARDAR · MOTOR PARADO'] : ['#33414f', 'LIVRE'];
    g.fillStyle = cor; g.fillRect(0, 240, W, 72); g.fillStyle = '#fff'; g.font = 'bold 32px Arial, sans-serif'; g.fillText(texto, 20, 288);
    g.fillStyle = '#b9c7dd'; g.font = '28px Arial, sans-serif'; g.fillText(n + (n === 1 ? ' mala no tapete' : ' malas no tapete'), 20, 354);
    c.ecraTex.needsUpdate = true;
}

function desenhar() {
    modelo.teto.visible = camera.position.y < G.ALTURA - 0.2;
    if (!dados) return;
    const tapeteAgora = {}, noTapete = {}, pulso = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    for (const voo of Object.keys(dados.voos)) tapeteAgora[voo] = tapeteDoVoo(dados, voo, t);
    atualizarLotes(t, tapeteAgora);
    for (const p of pessoas) {
        p.pose = t >= p.chegada && t < p.fimVida ? avaliar(p.trocos, t) : null;
        p.malha.visible = !!p.pose;
        if (p.pose) { p.malha.position.set(p.pose.x, p.pose.anda ? Math.abs(Math.sin(p.pose.d * 3.6)) * 0.035 : 0, p.pose.z); p.malha.rotation.y = p.pose.ang; }
    }
    for (const mala of dados.malas) {
        const malha = malhasMala.get(mala.codigo), a = passoMala(mala, t).atual;
        malha.visible = colocarMala(mala, malha, t);
        if (a?.estado === 'no_carrossel') noTapete[a.tapete] = (noTapete[a.tapete] ?? 0) + 1;
    }
    for (const [codigo, tp] of Object.entries(dados.tapetes)) {
        const c = modelo.carrosseis[codigo]; if (!c) continue;
        const est = estadoTapete(tp, t), tm = tempoMotor(tp.motor, t), avaria = est.estado === 'avariado';
        c.texPlacas.offset.x = -((V * tm / 0.56) % 1); c.texAl.offset.y = (VF * tm * 14 / 8.5) % 1;
        c.matPlacas.color.set(avaria ? '#f0b9b2' : '#ffffff');
        const acesa = avaria ? 0 : est.motor ? 2 : est.estado === 'ocupado' ? 1 : -1;
        c.luzes.forEach((l, k) => { l.material.emissiveIntensity = k === acesa ? (avaria ? 0.6 + 2.4 * pulso : 2.4) : 0; });
        desenharEcra(c, est, noTapete[codigo] ?? 0, t);
    }
    if (seguida) {
        const mala = dados.malas.find(m => m.codigo === seguida), malha = malhasMala.get(seguida);
        marcador.visible = malha.visible;
        if (malha.visible) {
            marcador.position.set(malha.position.x, malha.position.y + 0.75, malha.position.z);
            const passo = malha.position.clone().sub(controls.target).multiplyScalar(0.08);
            controls.target.add(passo); camera.position.add(passo);
        }
        const passos = mala.passos.filter(p => p.minuto <= t), atual = passos.at(-1)?.estado ?? 'no_porao', chave = seguida + '|' + passos.length;
        if ($('bh-seguir').dataset.chave !== chave) {
            $('bh-seguir').dataset.chave = chave;
            $('bh-seguir').innerHTML = `<b>MALA ${seguida}</b><div>Voo ${mala.voo} · ${NOMES_ESTADO[atual]}</div><ol>` +
                passos.map(p => `<li>${hhmm(p.minuto)} · ${NOMES_ESTADO[p.estado]}${p.tapete ? ' (' + p.tapete + ')' : ''}</li>`).join('') +
                '</ol><button id="bh-largar">Deixar de seguir</button>';
            $('bh-largar').onclick = () => seguir(null);
        }
    }
    const n = contar(dados, t);
    const quadro = [['Entregues', n.entregue], ['No carrossel', n.carrossel], ['Em espera', n.espera], ['Em transporte', n.transporte], ['No porão', n.porao], ['Inspeção', n.inspecao]]
        .map(([r, v]) => `<div><span>${r}</span>${v}</div>`).join('');
    if ($('bh-contadores').dataset.chave !== quadro) { $('bh-contadores').dataset.chave = quadro; $('bh-contadores').innerHTML = quadro; }
    const hora = hhmm(Math.min(t, dados.fim)); if ($('bh-hora').textContent !== hora) $('bh-hora').textContent = hora;
    $('bh-tempo').value = t;
}

function animar(agora) {
    ciclo = requestAnimationFrame(animar);
    const dt = Math.min(0.25, (agora - (ultimo || agora)) / 1000); ultimo = agora;
    if (dados && aReproduzir) {
        t = Math.min(fimVisual, t + dt * Number($('bh-velocidade').value));
        if (t >= fimVisual) aReproduzir = false;
    }
    $('bh-play').textContent = aReproduzir ? 'Ⅱ' : '▶';
    controls.update();
    desenhar();
    renderer.render(scene, camera);
}

export function seguir(codigo) {
    seguida = codigo && malhasMala.has(codigo) ? codigo : null;
    if (marcador) marcador.visible = false;
    $('bh-seguir').hidden = !seguida;
    $('bh-seguir').dataset.chave = '';
    $('bh-ocorrencias').style.visibility = seguida ? 'hidden' : '';
}

export function abrir() {
    if (!renderer) construir();
    window.dispatchEvent(new CustomEvent('hall-open', { detail: 'baggage' }));
    sala.classList.add('aberta'); botaoAbrir.hidden = true;
    ajustar();
    if (ciclo === null) { ultimo = 0; ciclo = requestAnimationFrame(animar); }
}

export function fechar() {
    sala.classList.remove('aberta'); botaoAbrir.hidden = false;
    if (ciclo !== null) cancelAnimationFrame(ciclo);
    ciclo = null;
}

botaoAbrir.onclick = abrir;
$('bh-fechar').onclick = fechar;
$('bh-play').onclick = () => { if (!dados) return; if (t >= fimVisual) t = dados.inicio; aReproduzir = !aReproduzir; };
$('bh-tempo').oninput = e => { t = Number(e.target.value); aReproduzir = false; };
$('bh-vista').onchange = e => { seguir(null); vista(e.target.value); };

window.addEventListener('baggage-run', e => { abrir(); carregar(e.detail); });
window.addEventListener('hall-open', e => { if (e.detail !== 'baggage' && sala.classList.contains('aberta')) fechar(); });
window.baggageHall = { abrir, fechar, seguir, vista, info: () => renderer && { ...renderer.info.render, geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures }, lotes: () => lotes.map(l => ({ voo: l.voo, A: l.A, B: l.B, n: l.n, fim: l.fim, fase: l.fase, tapeteB: l.tapeteB, tapeteFim: l.tapeteFim, curto: l.curto })) };
