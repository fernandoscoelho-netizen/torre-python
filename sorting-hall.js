// Bloco 2 · Bagagens, Fase 2: central de triagem em 3D.
// Não simula nada: reproduz o registo de eventos devolvido pelo motor Python (triagem.py),
// por isso o que se vê é exatamente o que o programa do aluno fez. A cena só reparte, dentro
// de cada minuto, as malas que o registo diz terem mudado de troço nesse minuto.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { geometriaMala } from './baggage-hall-model.js?v=bagagens-3';
import { T, NOS, CAMINHOS, construirCentral } from './sorting-hall-model.js?v=checkin-1';
import { prepararScada, desenharScada, zonaEm } from './sorting-scada.js?v=checkin-1';

const H = 1 / 16;                                // intervalo mínimo entre duas malas no mesmo ponto (minutos)
const CORES_VOO = ['#e4572e', '#2e86de', '#f2b705', '#3fa34d', '#9b5de5'];
const COR_SEM_VOO = '#8a8f96', COR_ILEGIVEL = '#f4f4ee';
const SAIDAS = ['S01', 'S02', 'S03', 'S04'];
const EM_FRENTE = { LEITOR: 'A1', A1: 'A2', A2: 'A3', A3: 'A4', A4: 'RET', B1: 'B2', B2: 'B3', B3: 'B4', B4: 'RET' };
const acaso = (i, k = 0) => { let x = Math.imul(i + 1, 2654435761) ^ Math.imul(k + 7, 1597334677); x = Math.imul(x ^ (x >>> 15), 2246822519); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
const suave = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };

// ---------------------------------------------------------------------------
// Reconstrução do estado a partir do registo (funções puras)
// Minutos em que o troço esteve a andar desde o início até t (um troço avariado não anda).
export function ativo(troco, t) {
    let parado = 0;
    for (const [de, ate] of troco.paragens) { if (de >= t) break; parado += Math.min(t, ate) - de; }
    return t - parado;
}
function quando(troco, t0, duracao) {             // instante em que o troço completa `duracao` minutos a andar depois de t0
    let t = t0, falta = duracao;
    for (const [de, ate] of troco.paragens) {
        if (ate <= t) continue;
        if (de > t) { if (falta <= de - t) return t + falta; falta -= de - t; }
        t = ate;
    }
    return t + falta;
}

export function prepararTriagem(reg) {
    const trocos = {}, malas = new Map(), voos = {}, ocorrencias = [], leituras = [], desvios = {}, rotas = {};
    for (const tr of reg.trocos) trocos[tr.codigo] = { ...tr, comp: CAMINHOS[tr.codigo]?.comp ?? 16, paragens: [], passos: [], ultimaEntrada: -Infinity, ultimaSaida: -Infinity };
    reg.partidas.forEach((p, i) => { voos[p.voo] = { ...p, cor: CORES_VOO[i % CORES_VOO.length], total: p.malas }; });
    reg.malas.forEach((m, i) => malas.set(m.codigo, { ...m, indice: i, cor: !voos[m.voo] ? COR_SEM_VOO : m.legivel ? voos[m.voo].cor : COR_ILEGIVEL, passos: [], fim: null, leituras: [] }));
    for (const s of SAIDAS) rotas[s] = reg.rotas_iniciais?.[s] ? [{ minuto: -Infinity, rota: reg.rotas_iniciais[s] }] : [];
    for (const e of reg.eventos) if (e.tipo === 'troco') { const tr = trocos[e.troco]; if (e.estado === 'avariado') tr.paragens.push([e.minuto, Infinity]); else if (tr.paragens.length) tr.paragens.at(-1)[1] = e.minuto; }
    const chegadas = {};
    for (const e of reg.eventos) {
        const mala = e.mala ? malas.get(e.mala) : null;
        if (e.tipo === 'mala' && mala) {
            const ant = mala.passos.at(-1) ?? null;
            let tau;
            if (e.estado === 'em_tapete') {
                const tr = trocos[e.troco];
                tau = Math.max(e.minuto + e.ordem / reg.debito, tr.ultimaEntrada + H, ant ? Math.max(ant.pronta, ant.troco.ultimaSaida + H) : -Infinity);
                tr.ultimaEntrada = tau;
                const passo = { troco: tr, mala, tIn: tau, tOut: Infinity, pronta: quando(tr, tau, tr.tempo), aIn: ativo(tr, tau), aOut: Infinity, minuto: e.minuto, pos: 0 };
                mala.passos.push(passo); tr.passos.push(passo);
                if (mala.leituraPendente) { mala.leituraPendente.t = tau; mala.leituraPendente = null; }
                if (ant && EM_FRENTE[tr.origem] && EM_FRENTE[tr.origem] !== tr.destino) (desvios[tr.origem] ??= []).push(tau);
            } else {
                const chave = e.minuto + '|' + ant.troco.codigo, k = chegadas[chave] = (chegadas[chave] ?? -1) + 1;
                tau = Math.max(e.minuto + k / reg.debito, ant.pronta, ant.troco.ultimaSaida + H);
                mala.fim = { estado: e.estado, saida: e.saida ?? 'INSPECAO', t: tau, minuto: e.minuto };
            }
            if (ant) { ant.tOut = tau; ant.aOut = ativo(ant.troco, tau); ant.troco.ultimaSaida = tau; }
        } else if (e.tipo === 'leitura' && mala) {
            const l = { t: e.minuto, minuto: e.minuto, mala: e.mala, voo: e.voo, destino: e.destino, vez: e.leituras };
            mala.leituras.push(l); mala.leituraPendente = l; leituras.push(l);
        } else if (e.tipo === 'retorno' && mala) (mala.retornos ??= []).push({ minuto: e.minuto, no: e.no });
        else if (e.tipo === 'rota') rotas[e.saida]?.push({ minuto: e.minuto, rota: e.rota });
        else if (e.tipo === 'ocorrencia') ocorrencias.push(e);
    }
    leituras.sort((a, b) => a.t - b.t);
    for (const lista of Object.values(desvios)) lista.sort((a, b) => a - b);
    // Lugar de cada mala no fim: reboque da saída, palete das malas erradas ou posto de inspeção
    const lugares = {}, ultima = {};
    const finais = [...malas.values()].filter(m => m.fim).sort((a, b) => a.fim.t - b.fim.t);
    for (const m of finais) {
        const chave = m.fim.estado === 'triada' ? m.fim.saida : m.fim.estado === 'errada' ? 'E' + m.fim.saida : 'INSPECAO';
        m.fim.lugar = lugares[chave] = (lugares[chave] ?? -1) + 1;
        if (m.fim.estado !== 'inspecao') ultima[m.fim.saida] = m.fim.t;
    }
    const saidas = {};
    for (const s of SAIDAS) {
        const voo = Object.values(voos).find(v => v.saida === s) ?? null;
        saidas[s] = { voo, reboques: Math.ceil(((lugares[s] ?? -1) + 1) / 30), partida: ultima[s] !== undefined ? ultima[s] + 1.2 + SAIDAS.indexOf(s) * 0.12 : Infinity };
    }
    return { inicio: reg.inicio, fim: reg.fim, debito: reg.debito, trocos, malas: [...malas.values()], voos, rotas, ocorrencias, leituras, desvios, saidas, resumo: reg.resumo };
}

export function estadoMala(mala, t) {
    if (mala.fim && t >= mala.fim.t) return { estado: mala.fim.estado, saida: mala.fim.saida };
    let passo = null;
    for (const p of mala.passos) { if (p.tIn > t) break; passo = p; }
    return passo ? { estado: 'em_tapete', passo } : { estado: 'no_checkin' };
}

export function contar(dados, t) {
    const n = { no_checkin: 0, em_tapete: 0, triada: 0, errada: 0, inspecao: 0, recirculacoes: 0, saidas: {}, erradas: {} };
    for (const mala of dados.malas) {
        const e = estadoMala(mala, t); n[e.estado]++;
        if (e.estado === 'triada') n.saidas[e.saida] = (n.saidas[e.saida] ?? 0) + 1;
        else if (e.estado === 'errada') n.erradas[e.saida] = (n.erradas[e.saida] ?? 0) + 1;
        for (const l of mala.leituras) if (l.vez > 1 && l.t <= t) n.recirculacoes++;
    }
    return n;
}

export function rotaAtual(dados, saida, t) {
    let rota = null;
    for (const r of dados.rotas[saida] ?? []) { if (r.minuto > t) break; rota = r.rota; }
    return rota;
}
const avariado = (troco, t) => troco.paragens.some(([de, ate]) => de <= t && t < ate);

// ---------------------------------------------------------------------------
// Interface
const estilo = document.createElement('style');
estilo.textContent = `
.sorting-hall{position:absolute;inset:0;z-index:6;background:#c5cbcd;display:none;container-type:size}
.sorting-hall.aberta{display:block}
.sorting-hall canvas{display:block;width:100%;height:100%}
.sorting-hall canvas.sh-scada{position:absolute;left:0;top:0;height:calc(100% - 58px);display:none}
.sorting-hall.scada canvas.sh-scada{display:block}
.sorting-hall.scada{background:#0a121c}
.sorting-hall.scada .sh-topo,.sorting-hall.scada .sh-seguir,.sorting-hall.scada .sh-vazio{display:none}
.sh-cam{position:absolute;display:none;z-index:3;pointer-events:none;justify-content:space-between;gap:8px;padding:5px 8px;box-sizing:border-box;font:700 11px ui-monospace,Consolas,monospace;color:#fff;text-shadow:0 1px 2px #000,0 0 6px #000;letter-spacing:.5px}
.sh-cam i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3b30;margin-right:6px;animation:sh-rec 1.2s steps(2) infinite}
@keyframes sh-rec{50%{opacity:.25}}
.sorting-hall.scada .sh-cam.visivel{display:flex}
.sh-controlos button.ativo{background:#1f6f93;border-color:#4cc9f0}
.sh-topo{position:absolute;top:12px;left:14px;right:14px;display:flex;gap:10px;align-items:flex-start;justify-content:space-between;pointer-events:none;font:13px/1.35 system-ui,sans-serif}
.sh-cartao{pointer-events:auto;background:#14273ae8;color:#e8eef2;border-radius:6px;padding:9px 12px;backdrop-filter:blur(8px)}
.sh-cartao b{font-size:12px;letter-spacing:1.5px;font-weight:650}
.sh-contadores{display:grid;grid-template-columns:repeat(3,auto);gap:4px 14px;margin-top:6px;font-variant-numeric:tabular-nums}
.sh-contadores span{color:#9fb3c2;font-size:11px;display:block}
.sh-ocorrencias{max-width:300px;max-height:132px;overflow:auto;font-size:12px}
.sh-ocorrencias li{margin-left:16px}
.sh-controlos{position:absolute;left:14px;right:14px;bottom:14px;display:flex;gap:8px;align-items:center;background:#14273ae8;color:#e8eef2;border-radius:6px;padding:8px 10px;font:13px system-ui,sans-serif}
.sh-controlos input[type=range]{flex:1;min-width:60px}
.sh-controlos button,.sh-controlos select{background:#2d4b63;color:#fff;border:1px solid #ffffff33;border-radius:4px;padding:4px 9px;font:inherit;cursor:pointer}
.sh-controlos button{white-space:nowrap}
.sh-controlos button[hidden]{display:none}
.sh-hora{font-variant-numeric:tabular-nums;min-width:44px;text-align:center;font-weight:650}
.sh-seguir{position:absolute;right:14px;top:12px;max-width:290px;font-size:12px}
.sh-seguir ol{margin:6px 0 0 18px;padding:0;max-height:180px;overflow:auto}
.sh-seguir button{margin-top:6px;background:#2d4b63;color:#fff;border:1px solid #ffffff33;border-radius:4px;padding:3px 8px;cursor:pointer}
.sh-legenda{display:block;margin-top:4px}
.sh-legenda i{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 0;vertical-align:-1px}
.sh-legenda span{margin-right:10px;white-space:nowrap}
.sh-dica{font-size:11px;color:#9fb3c2;margin-top:6px;max-width:430px}
.sh-abrir{position:absolute;right:12px;bottom:70px;z-index:5;background:#14273ae8;color:#e8eef2;border:1px solid #ffffff33;border-radius:4px;padding:6px 11px;font:13px system-ui,sans-serif;cursor:pointer}
.sh-vazio[hidden],.sh-cartao[hidden]{display:none}
@container (max-width: 820px){
.sorting-hall canvas.sh-scada{height:calc(100% - 46px)}
.sh-topo{top:8px;left:8px;right:8px;font-size:12px}
.sh-cartao{padding:6px 9px}
.sh-dica,.sh-topo .sh-ocorrencias{display:none}
.sh-legenda span{margin-right:8px;font-size:11px}
.sh-contadores{grid-template-columns:repeat(6,auto);gap:2px 10px;margin-top:4px}
.sh-contadores span{font-size:10px}
.sh-controlos{left:8px;right:8px;bottom:8px;gap:5px;padding:6px 7px;font-size:12px}
.sh-controlos button,.sh-controlos select{padding:3px 5px}
.sh-controlos select{max-width:104px}
.sh-longo{display:none}
.sh-seguir{right:8px;top:auto;bottom:52px;max-width:230px}
.sh-seguir ol{max-height:84px}
}
.sh-vazio{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);background:#14273ae8;color:#e8eef2;border-radius:6px;padding:8px 14px;font:13px system-ui,sans-serif;text-align:center;pointer-events:none;max-width:80%}
`;
document.head.append(estilo);

const viewport = document.querySelector('.workspace-viewport') ?? document.getElementById('scene')?.parentElement ?? document.body;
const sala = document.createElement('div');
sala.className = 'sorting-hall';
sala.innerHTML = `
<canvas class="sh-scada" id="sh-scada"></canvas>
<div class="sh-cam" id="sh-cam"><span><i></i><span id="sh-cam-nome">CAM</span></span><span id="sh-cam-hora"></span></div>
<div class="sh-topo">
  <div class="sh-cartao"><b>CENTRAL DE TRIAGEM · PARTIDAS</b><span class="sh-legenda" id="sh-legenda"></span><div class="sh-contadores" id="sh-contadores"></div><div class="sh-dica">A cinta de cada mala e a fita luminosa da rota têm a cor do voo. Clica numa mala para a seguir.</div></div>
  <div class="sh-cartao sh-ocorrencias" id="sh-ocorrencias" hidden></div>
</div>
<div class="sh-cartao sh-seguir" id="sh-seguir" hidden></div>
<div class="sh-vazio" id="sh-vazio">Executa um programa da central de triagem (níveis 23 a 25) para ver aqui as malas das partidas.</div>
<div class="sh-controlos">
  <button id="sh-play" title="Reproduzir ou pausar">▶</button>
  <span class="sh-hora" id="sh-hora">--:--</span>
  <input type="range" id="sh-tempo" min="0" max="1" step="0.002" value="0" aria-label="Hora simulada">
  <select id="sh-velocidade" aria-label="Velocidade"><option value="0.1">0,1 min/s</option><option value="0.25" selected>0,25 min/s</option><option value="0.5">0,5 min/s</option><option value="1">1 min/s</option><option value="2">2 min/s</option><option value="4">4 min/s</option></select>
  <select id="sh-vista" aria-label="Vista"><option value="geral">Vista geral</option><option value="leitor">Leitor de etiquetas</option><option value="desviadores">Desviadores</option><option value="saidas">Saídas e reboques</option><option value="inspecao">Inspeção</option><option value="sinotico">Sala de controlo</option></select>
  <button id="sh-checkin" title="Voltar à zona de check-in, de onde vieram estas malas" hidden>⬅<span class="sh-longo"> Check-in</span></button>
  <button id="sh-modo" title="Alternar entre a cena 3D e o sinótico SCADA">SCADA</button>
  <button id="sh-fechar" title="Voltar à maquete do aeroporto"><span class="sh-longo">Aeroporto </span>✕</button>
</div>`;
viewport.append(sala);
const botaoAbrir = document.createElement('button');
botaoAbrir.className = 'sh-abrir';
botaoAbrir.textContent = '🔀 Central de triagem';
viewport.append(botaoAbrir);
const $ = id => sala.querySelector('#' + id);
const NOMES_ESTADO = { no_checkin: 'no check-in', em_tapete: 'em tapete', triada: 'na saída certa', errada: 'na saída errada', inspecao: 'em inspeção' };
function hhmm(m) { m = Math.floor(m); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
const limpo = s => String(s).replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;');

// ---------------------------------------------------------------------------
// Cena
let renderer = null, scene, camera, controls, modelo, marcador;
let dados = null, t = 0, fimVisual = 0, aReproduzir = false, ultimo = 0, ciclo = null, seguida = null;
let malhasMala = new Map(), objetos = [], comboios = {}, aproximar = false;
let modoScada = false, scada = null, zonasScada = [], rectCctv = null, selecao = null, voo = null, cargaAtual = {}, contagem = null;
const geoMalas = new Map();
const UP = new THREE.Vector3(0, 1, 0), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = {};
const poseA = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }, poseB = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };

function construir() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
    renderer.domElement.classList.add('sh-3d'); sala.prepend(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#c5cbcd');
    camera = new THREE.PerspectiveCamera(45, 1, 0.25, 600);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.minDistance = 1.5; controls.maxDistance = 210;
    modelo = construirCentral(scene, renderer);
    SAIDAS.forEach((s, i) => {                   // um trator e três reboques no cais de cada saída
        const x = T.XS[i], c = new THREE.CatmullRomCurve3([[x - 9, 0], [x - 3, 0], [x + 3, 0], [x + 6.6, 0], [x + 8.8, 0.25], [x + 11.8, 4.9], [x + 15, 6], [62, 6], [84, 6]].map(([px, dz]) => new THREE.Vector3(px, 0, T.Z_CAIS + dz)), false, 'centripetal');
        c.arcLengthDivisions = 500;
        comboios[s] = { curva: c, comp: c.getLength(), d0: 15.6, trator: { malha: modelo.novoTrator() }, reboques: [0, 1, 2].map(() => ({ malha: modelo.novoReboque() })), extra: [] };
    });
    marcador = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffd400', depthTest: false, transparent: true }));
    marcador.rotation.x = Math.PI / 2; marcador.renderOrder = 5; marcador.visible = false; scene.add(marcador);
    const raio = new THREE.Raycaster(), ponteiro = new THREE.Vector2();
    let inicioClique = null;
    renderer.domElement.addEventListener('pointerdown', e => { inicioClique = [e.clientX, e.clientY]; voo = null; });
    renderer.domElement.addEventListener('pointerup', e => {
        if (!inicioClique || Math.hypot(e.clientX - inicioClique[0], e.clientY - inicioClique[1]) > 5 || !dados) return;
        const caixa = renderer.domElement.getBoundingClientRect();
        ponteiro.set((e.clientX - caixa.left) / caixa.width * 2 - 1, -(e.clientY - caixa.top) / caixa.height * 2 + 1);
        raio.setFromCamera(ponteiro, camera);
        const alvo = raio.intersectObjects([...malhasMala.values()].filter(m => m.visible))[0]?.object;
        seguir(alvo ? alvo.userData.codigo : null);
    });
    new ResizeObserver(ajustar).observe(sala);
    ajustar(); vista('geral'); desenharFixos(0);
}

function ajustar() {
    if (!renderer) return;
    const w = Math.max(1, renderer.domElement.clientWidth), h = Math.max(1, renderer.domElement.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

const VISTAS = {
    geral: [[-6, 54, 56], [-6, 0, 0]], leitor: [[-60, 10.5, 8], [-44, 2.6, -8.5]], desviadores: [[-12, 13, 25], [-4, 2.2, -4]],
    saidas: [[-9, 8.5, 43], [-9, 1.4, 15]], inspecao: [[-57, 8, 29], [-42.5, 1.1, 13]], sinotico: [[9, 6, -17.4], [9, 6.3, -30]],
};
export function vista(nome) {
    if (!camera) return;
    const v = Array.isArray(nome) ? nome : VISTAS[nome] ?? null;
    if (!v) return;
    voo = null;
    const f = nome === 'geral' ? Math.max(1, 1.62 / camera.aspect) : 1;            // num visor estreito, a vista geral recua para caber a rede toda
    controls.target.set(...v[1]); camera.position.set(...v[0]).sub(controls.target).multiplyScalar(f).add(controls.target); controls.update();
    if (!Array.isArray(nome)) $('sh-vista').value = nome;
}

// --- Posições das malas --------------------------------------------------------
function base(o, x, y, z, tx, ty, tz) {          // orienta o comprimento da mala segundo o tapete
    _x.set(tx, ty, tz).normalize(); _z.crossVectors(_x, UP).normalize(); _y.crossVectors(_z, _x);
    _m.makeBasis(_x, _y, _z); o.quaternion.setFromRotationMatrix(_m); o.position.set(x, y, z);
}
function noTapete(o, passo, i) {
    const cam = CAMINHOS[passo.troco.codigo]; if (!cam) return false;
    cam.em(passo.pos, _p);
    base(o, _p.x, _p.y + 0.012, _p.z, _p.tx, _p.ty, _p.tz);
    _q.setFromAxisAngle(UP, (acaso(i, 13) - 0.5) * 0.5); o.quaternion.multiply(_q);
    const hz = Math.hypot(_p.tx, _p.tz) || 1, lado = (acaso(i, 17) - 0.5) * 0.22;
    o.position.x += -_p.tz / hz * lado; o.position.z += _p.tx / hz * lado;
    return true;
}
function noReboque(o, saida, lugar, i) {
    const cb = comboios[saida], j = Math.floor(lugar / 30), r = j < 3 ? cb.reboques[j] : cb.extra[j - 3];
    if (!r?.visivel) return false;
    const k = lugar % 30, lx = -1.12 + (k % 5) * 0.56, lz = (Math.floor(k / 5) % 2 - 0.5) * 0.74, c = Math.cos(r.ang), s = Math.sin(r.ang);
    o.position.set(r.x + lx * c + lz * s, 0.615 + Math.floor(k / 10) * 0.31, r.z - lx * s + lz * c);
    o.quaternion.setFromEuler(_e.set(0, r.ang + Math.PI / 2 + (acaso(i, 16) - 0.5) * 0.2, 0));
    return true;
}
function naPalete(o, saida, k, i) {              // malas que chegaram à saída errada
    const x0 = modelo.saidas[saida].x - 4.6;
    o.position.set(x0 - 1.4 + (k % 6) * 0.56, 0.15 + Math.floor(k / 24) * 0.3, 14.7 + (Math.floor(k / 6) % 4) * 0.6);
    o.quaternion.setFromEuler(_e.set(0, Math.PI / 2 + (acaso(i, 18) - 0.5) * 0.3, 0));
    return true;
}
function naInspecao(o, k, i) {
    if (k < 8) o.position.set(T.XL + 1.25 + k * 0.62, T.YS - 0.01, 11.4);
    else { const q = k - 8; o.position.set(T.XL - 3.4 + (q % 14) * 0.78, Math.floor(q / 84) * 0.31, 16.4 + (Math.floor(q / 14) % 6) * 0.72); }
    o.quaternion.setFromEuler(_e.set(0, Math.PI / 2 + (acaso(i, 19) - 0.5) * 0.25, 0));
    return true;
}
function misturar(o, a, b, k, arco) {
    k = Math.max(0, Math.min(1, k));
    o.position.lerpVectors(a.position, b.position, k); o.position.y += Math.sin(k * Math.PI) * arco;
    o.quaternion.slerpQuaternions(a.quaternion, b.quaternion, k);
}
function noFim(o, mala) {
    const f = mala.fim;
    return f.estado === 'triada' ? noReboque(o, f.saida, f.lugar, mala.indice) : f.estado === 'errada' ? naPalete(o, f.saida, f.lugar, mala.indice) : naInspecao(o, f.lugar, mala.indice);
}
function colocarMala(mala, o, tt) {
    const f = mala.fim;
    if (f && tt >= f.t) {
        if (tt >= f.t + 0.14) return noFim(o, mala);
        const ult = mala.passos.at(-1); ult.pos = ult.troco.comp;                     // o operador passa a mala do tapete para o lugar
        if (!noTapete(poseA, ult, mala.indice) || !noFim(poseB, mala)) return false;
        misturar(o, poseA, poseB, suave((tt - f.t) / 0.14), 0.5); return true;
    }
    let passo = null;
    for (const p of mala.passos) { if (p.tIn > tt) break; passo = p; }
    return passo ? noTapete(o, passo, mala.indice) : false;
}

function atualizarTapetes(tt) {                   // posição de cada mala no seu troço, com acumulação atrás da que vai à frente
    for (const tr of Object.values(dados.trocos)) {
        const v = tr.comp / tr.tempo, folga = Math.max(0.85, v * H), a = ativo(tr, tt);
        let limite = Infinity;
        for (const p of tr.passos) {
            if (p.tIn > tt) break;
            if (p.tOut <= tt) { limite = tr.comp + v * (a - p.aOut) - folga; continue; }
            p.pos = Math.max(0, Math.min(v * (a - p.aIn), tr.comp, limite));
            limite = p.pos - folga;
        }
    }
}

function atualizarComboios(tt) {
    for (const s of SAIDAS) {
        const cb = comboios[s], info = dados?.saidas[s], n = info?.reboques ?? 0, dt = info ? tt - info.partida : -1;
        const d = cb.d0 + (dt > 0 ? 62 * (dt - 0.4 * (1 - Math.exp(-dt / 0.4))) : 0);
        [cb.trator, ...cb.reboques].forEach((veic, j) => {
            const dj = d - (j ? 3.35 + 3.4 * (j - 1) : 0), u = Math.max(0, Math.min(1, dj / cb.comp)), p = cb.curva.getPointAt(u), tg = cb.curva.getTangentAt(u);
            Object.assign(veic, { x: p.x, z: p.z, ang: Math.atan2(-tg.z, tg.x), visivel: p.x < 80 && (j === 0 || !dados || j <= Math.max(1, Math.min(3, n)) || dt <= 0) });
            veic.malha.visible = veic.visivel; veic.malha.position.set(veic.x, 0, veic.z); veic.malha.rotation.y = veic.ang;
        });
        cb.extra.forEach((veic, j) => {              // reboques a mais (quando chegam mais de 90 malas à mesma saída) ficam no cais
            Object.assign(veic, { x: modelo.saidas[s].x + 3.25 - 3.4 * (j % 3), z: T.Z_CAIS + 2.9 * (1 + Math.floor(j / 3)), ang: 0, visivel: true });
            veic.malha.visible = true; veic.malha.position.set(veic.x, 0, veic.z); veic.malha.rotation.y = 0;
        });
    }
}

function carregar(registo) {
    for (const o of objetos) scene.remove(o);
    objetos = []; malhasMala.clear();
    dados = prepararTriagem(registo); selecao = null; voo = null;
    for (const mala of dados.malas) {
        const tipo = Math.floor(acaso(mala.indice, 14) * 24), chave = mala.cor + tipo;
        if (!geoMalas.has(chave)) geoMalas.set(chave, geometriaMala(tipo, mala.cor));
        const malha = new THREE.Mesh(geoMalas.get(chave), modelo.matMalas);
        malha.castShadow = true; malha.visible = false; malha.userData.codigo = mala.codigo; scene.add(malha); objetos.push(malha);
        malhasMala.set(mala.codigo, malha);
    }
    for (const s of SAIDAS) {
        const cb = comboios[s], n = dados.saidas[s].reboques;
        cb.extra = []; for (let j = 3; j < n; j++) { const malha = modelo.novoReboque(); objetos.push(malha); cb.extra.push({ malha }); }
        modelo.matRota[s].color.set(dados.saidas[s].voo?.cor ?? '#ffffff');
    }
    $('sh-vazio').hidden = true;
    seguir(null);
    $('sh-legenda').innerHTML = Object.values(dados.voos).map(v => `<span><i style="background:${v.cor}"></i>${limpo(v.voo)} → ${v.saida}</span>`).join('') + `<span><i style="background:${COR_ILEGIVEL}"></i>ilegível</span><span><i style="background:${COR_SEM_VOO}"></i>sem voo</span>`;
    const partidas = Object.values(dados.saidas).map(s => s.partida).filter(Number.isFinite);
    fimVisual = Math.max(dados.fim + 2, ...partidas.map(p => p + 2.2));
    $('sh-tempo').min = dados.inicio; $('sh-tempo').max = fimVisual;
    scada = prepararScada(dados, fimVisual);
    const lista = dados.ocorrencias;
    $('sh-ocorrencias').hidden = !lista.length;
    $('sh-ocorrencias').innerHTML = '<b>OCORRÊNCIAS</b><ul>' + lista.slice(0, 40).map(o => `<li>${hhmm(o.minuto)} · ${limpo(o.texto)}</li>`).join('') + (lista.length > 40 ? `<li>… e mais ${lista.length - 40}</li>` : '') + '</ul>';
    t = dados.inicio; aReproduzir = true;
    vista('geral');
}

// --- Ecrãs e sinótico -----------------------------------------------------------
function desenharEcraSaida(s, n, erradas, tt) {
    const info = dados?.saidas[s], voo = info?.voo ?? null, e = modelo.saidas[s], partiu = info && tt >= info.partida;
    const chave = [voo?.voo, n, erradas, partiu, Math.floor(tt)].join('|');
    if (e.chave === chave) return;
    e.chave = chave;
    const g = e.canvas.getContext('2d'), W = 512, Hh = 288;
    g.fillStyle = '#0b1b33'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#16335f'; g.fillRect(0, 0, W, 56);
    g.fillStyle = '#fff'; g.font = 'bold 26px Arial, sans-serif'; g.textAlign = 'left'; g.fillText('Preparação do voo', 18, 37); g.textAlign = 'right'; g.fillText(dados ? hhmm(Math.min(tt, dados.fim)) : '--:--', W - 18, 37); g.textAlign = 'left';
    g.fillStyle = '#ffd21f'; g.font = 'bold 92px Arial, sans-serif'; g.fillText(s, 18, 150);
    g.fillStyle = voo?.cor ?? '#33414f'; g.fillRect(238, 74, 14, 84);
    g.fillStyle = '#fff'; g.font = 'bold 54px Arial, sans-serif'; g.fillText(voo?.voo ?? '—', 264, 120);
    g.fillStyle = '#b9c7dd'; g.font = '26px Arial, sans-serif'; g.fillText(voo ? `${voo.destino} · ${hhmm(voo.hora)}` : 'Sem voo atribuído', 264, 156);
    const total = voo?.total ?? 0, [cor, texto] = !voo ? ['#33414f', erradas ? 'SEM VOO ATRIBUÍDO' : 'LIVRE'] : partiu ? ['#1f5d8a', 'REBOQUES A CAMINHO DA PLACA'] : n ? ['#1f8a4c', 'A CARREGAR'] : ['#b7791f', 'A AGUARDAR MALAS'];
    g.fillStyle = cor; g.fillRect(0, 184, W, 52); g.fillStyle = '#fff'; g.font = 'bold 26px Arial, sans-serif'; g.fillText(texto, 18, 219);
    g.fillStyle = '#b9c7dd'; g.font = '26px Arial, sans-serif'; g.fillText(`${n} de ${total} malas`, 18, 270);
    if (erradas) { g.fillStyle = '#ff6b5e'; g.font = 'bold 26px Arial, sans-serif'; g.textAlign = 'right'; g.fillText(`${erradas} de outros voos`, W - 18, 270); g.textAlign = 'left'; }
    e.tex.needsUpdate = true;
}

function desenharLeitor(tt) {
    const no = modelo.nos.LEITOR; let ult = null;
    if (dados) for (const l of dados.leituras) { if (l.t > tt) break; ult = l; }
    const flash = ult ? Math.max(0, 1 - (tt - ult.t) / 0.05) : 0, paraInspecao = ult?.destino === 'INSPECAO';
    no.luz.material.emissive.set(paraInspecao ? '#ff8a1f' : '#27c152'); no.luz.material.emissiveIntensity = 0.25 + 3 * flash;
    no.feixe.material.opacity = 0.07 + 0.2 * flash;
    const chave = ult ? ult.mala + ult.vez : '-';
    if (no.ecra.chave === chave) return;
    no.ecra.chave = chave;
    const g = no.ecra.canvas.getContext('2d');
    g.fillStyle = '#0b1b33'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#b7791f'; g.fillRect(0, 0, 512, 50);
    g.fillStyle = '#fff'; g.font = 'bold 26px Arial, sans-serif'; g.fillText('LEITOR DE ETIQUETAS', 16, 34);
    if (ult) {
        g.font = 'bold 44px Arial, sans-serif'; g.fillText(ult.mala, 16, 108);
        g.font = '30px Arial, sans-serif'; g.fillStyle = '#b9c7dd'; g.fillText(ult.voo ? 'Voo ' + ult.voo : 'Etiqueta ilegível', 16, 154);
        g.fillStyle = paraInspecao ? '#b0461c' : '#1f8a4c'; g.fillRect(0, 184, 512, 72); g.fillStyle = '#fff'; g.font = 'bold 38px Arial, sans-serif'; g.fillText('→ ' + (paraInspecao ? 'INSPEÇÃO' : ult.destino) + (ult.vez > 1 ? `  (${ult.vez}.ª leitura)` : ''), 16, 233);
    } else { g.font = '30px Arial, sans-serif'; g.fillStyle = '#b9c7dd'; g.fillText('A aguardar malas', 16, 130); }
    no.ecra.tex.needsUpdate = true;
}

const funcoesScada = { ativo, avariado, rotaAtual, estadoMala };
const piscar = () => (performance.now() % 1000) / 1000;
function desenharSinotico(tt, carga, n) {         // mural da sala de controlo: o mesmo ecrã do painel SCADA
    const sn = modelo.sinotico, alarme = dados && Object.values(dados.trocos).some(tr => avariado(tr, tt));
    const chave = dados ? Math.floor(tt * 6) + (alarme ? '|' + Math.floor(performance.now() / 500) : '') : 'vazio';
    if (sn.chave === chave) return;
    sn.chave = chave;
    desenharScada(sn.canvas.getContext('2d'), sn.canvas.width, sn.canvas.height, { dados, sc: scada, t: tt, n, carga, f: funcoesScada, modo: 'mural', selecao: null, pulso: piscar(), dpr: 1 });
    sn.tex.needsUpdate = true;
}

// --- Painel SCADA: o sinótico em primeiro plano e a cena 3D numa janela de câmara ---------------
const CAM_GERAL = { pos: [-6, 40, 46], alvo: [-4, 0, -2], nome: 'VISTA GERAL' };
function camaraDe(sel) {
    if (!sel) return CAM_GERAL;
    if (sel.tipo === 'troco') {
        const cam = CAMINHOS[sel.id]; if (!cam) return CAM_GERAL;
        cam.em(cam.comp / 2, _p);
        const hz = Math.hypot(_p.tx, _p.tz) || 1, tx = _p.tx / hz, tz = _p.tz / hz, d = Math.min(12, 5.5 + cam.comp * 0.2);
        let sx = -tz, sz = tx; if (sz < -0.3 || (Math.abs(sz) <= 0.3 && sx > 0)) { sx = -sx; sz = -sz; }
        return { pos: [_p.x + sx * d - tx * 2.5, _p.y + d * 0.7, _p.z + sz * d - tz * 2.5], alvo: [_p.x, _p.y, _p.z], nome: sel.id.replace('>', ' → ').replace('INSPECAO', 'INSPEÇÃO') };
    }
    if (sel.tipo === 'saida') { const x = T.XS[SAIDAS.indexOf(sel.id)]; return { pos: [x - 7.5, 6.5, 32], alvo: [x, 1.2, 17], nome: 'SAÍDA ' + sel.id }; }
    if (sel.id === 'LEITOR') return { pos: VISTAS.leitor[0], alvo: VISTAS.leitor[1], nome: 'LEITOR' };
    if (sel.id === 'INSPECAO') return { pos: VISTAS.inspecao[0], alvo: VISTAS.inspecao[1], nome: 'INSPEÇÃO' };
    const no = NOS[sel.id]; if (!no) return CAM_GERAL;
    const [x, y, z] = no;
    return sel.id[0] === 'C' ? { pos: [x + 11, y + 4.5, z + 7], alvo: [x + 3, y - 0.6, z], nome: 'ENTRADA ' + sel.id } : { pos: [x - 5.5, y + 6, z + 8.5], alvo: [x, y, z], nome: (sel.id === 'RET' ? 'RETORNO ' : 'DESVIADOR ') + sel.id };
}
function voar(pos, alvo) {
    voo = { k: 0, p0: camera.position.clone(), p1: new THREE.Vector3(...pos), a0: controls.target.clone(), a1: new THREE.Vector3(...alvo) };
}
export function selecionar(sel) {                 // sel: { tipo: 'troco' | 'no' | 'saida' | 'mala', id } ou null
    if (sel?.tipo === 'mala') { seguir(sel.id); return; }
    seguir(null);
    selecao = sel ? { tipo: sel.tipo, id: sel.id } : null;
    if (camera && modoScada) { const c = camaraDe(selecao); voar(c.pos, c.alvo); }
}
function desenharPainel(n) {
    const tela = $('sh-scada'), dpr = Math.min(devicePixelRatio || 1, 2), w = tela.clientWidth, h = tela.clientHeight;
    if (!w || !h) return;
    if (tela.width !== Math.round(w * dpr) || tela.height !== Math.round(h * dpr)) { tela.width = Math.round(w * dpr); tela.height = Math.round(h * dpr); }
    const r = desenharScada(tela.getContext('2d'), w, h, { dados, sc: scada, t, n, carga: cargaAtual, f: funcoesScada, modo: 'painel', selecao, pulso: piscar(), dpr });
    zonasScada = r.zonas;
    const c = r.cctv, el = renderer.domElement, chave = c ? [c.x, c.y, c.w, c.h].map(Math.round).join() : 'sem';
    if (el.dataset.cctv !== chave) {               // a cena 3D ocupa a janela de câmara que o desenho reservou
        el.dataset.cctv = chave;
        if (c) Object.assign(el.style, { position: 'absolute', zIndex: 2, display: 'block', left: c.x + 3 + 'px', top: c.y + 3 + 'px', width: c.w - 6 + 'px', height: c.h - 6 + 'px', borderRadius: '4px' });
        else el.style.display = 'none';
        Object.assign($('sh-cam').style, c ? { left: c.x + 3 + 'px', top: c.y + 3 + 'px', width: c.w - 6 + 'px' } : {});
        $('sh-cam').classList.toggle('visivel', !!c);
        ajustar();
    }
    rectCctv = c;
    const nome = 'CAM · ' + (seguida ? 'MALA ' + seguida : camaraDe(selecao).nome);
    if ($('sh-cam-nome').textContent !== nome) $('sh-cam-nome').textContent = nome;
    const hora = dados ? hhmm(Math.min(t, dados.fim)) : '--:--'; if ($('sh-cam-hora').textContent !== hora) $('sh-cam-hora').textContent = hora;
}
export function modo(nome) {                      // 'scada' ou '3d'
    if (!renderer) return;
    modoScada = nome === 'scada';
    sala.classList.toggle('scada', modoScada);
    $('sh-modo').textContent = modoScada ? 'Vista 3D' : 'SCADA'; $('sh-modo').classList.toggle('ativo', modoScada);
    const el = renderer.domElement;
    if (!modoScada) { delete el.dataset.cctv; for (const prop of ['position', 'zIndex', 'display', 'left', 'top', 'width', 'height', 'borderRadius']) el.style[prop] = ''; rectCctv = null; ajustar(); if (!seguida) vista($('sh-vista').value); }
    else { desenharPainel(contagem ?? contar0()); if (!seguida) { const c = camaraDe(selecao); voo = null; camera.position.set(...c.pos); controls.target.set(...c.alvo); controls.update(); } }
}
const contar0 = () => ({ saidas: {}, erradas: {}, em_tapete: 0, inspecao: 0, errada: 0, recirculacoes: 0, triada: 0, no_checkin: 0 });

function desenharFixos(tt) {                      // equipamento: tapetes, faróis, rotas, desviadores, ecrãs
    const pulso = 0.5 + 0.5 * Math.sin(performance.now() / 160), carga = {};
    let avaria = null;
    modelo.matAvaria.color.setRGB(1, 0.05 + 0.3 * pulso, 0.04);
    for (const [codigo, tm] of Object.entries(modelo.trocos)) {
        const tr = dados?.trocos[codigo], mau = !!tr && avariado(tr, tt), v = tm.comp / (tr?.tempo ?? 1);
        tm.tex.offset.y = -((v * (tr ? ativo(tr, tt) : tt) * 0.5) % 1);
        tm.mat.color.set(mau ? '#ff9a8c' : '#ffffff'); tm.avaria.visible = mau;
        tm.farol.material.emissive.set(mau ? '#ff2a1a' : '#27c152'); tm.farol.material.emissiveIntensity = mau ? 0.5 + 3 * pulso : 1.1;
        if (mau && !avaria) avaria = tm;
        for (const s of SAIDAS) tm.fitasRota[s].visible = false;
    }
    if (dados) {
        for (const s of SAIDAS) { const rota = rotaAtual(dados, s, tt); if (rota) for (let i = 0; i < rota.length - 1; i++) { const f = modelo.trocos[rota[i] + '>' + rota[i + 1]]?.fitasRota[s]; if (f) f.visible = true; } }
        for (const tr of Object.values(dados.trocos)) { let c = 0; for (const p of tr.passos) { if (p.tIn > tt) break; if (p.tOut > tt) c++; } carga[tr.codigo] = c; }
    }
    for (const [codigo, no] of Object.entries(modelo.nos)) {
        if (!no.braco) continue;
        let k = 0;
        for (const tau of dados?.desvios[codigo] ?? []) { if (tau > tt + 0.05) break; k = Math.max(k, 1 - Math.abs(tt - tau) / 0.05); }
        no.braco.rotation.y = -Math.PI / 2 * suave(k * 1.6);
    }
    modelo.tecnico.visible = modelo.caixaFerramentas.visible = !!avaria;
    if (avaria) { const [x, z] = avaria.pedestal; modelo.tecnico.position.set(x + 0.55, 0, z + 0.35); modelo.tecnico.rotation.y = -Math.PI / 2; modelo.caixaFerramentas.position.set(x + 0.2, 0, z + 0.8); }
    const n = dados ? contar(dados, tt) : contar0();
    cargaAtual = carga; contagem = n;
    modelo.alarme.material.emissiveIntensity = avaria ? 0.4 + 3.2 * pulso : 0;
    for (const s of SAIDAS) desenharEcraSaida(s, n.saidas[s] ?? 0, n.erradas[s] ?? 0, tt);
    desenharLeitor(tt); desenharSinotico(tt, carga, n);
    return n;
}

function desenhar() {
    modelo.teto.visible = camera.position.y < T.ALTURA - 0.3;
    atualizarComboios(t);
    if (dados) atualizarTapetes(t);
    const n = desenharFixos(t);
    if (modoScada) desenharPainel(n);
    if (!dados) return;
    for (const mala of dados.malas) { const malha = malhasMala.get(mala.codigo); malha.visible = colocarMala(mala, malha, t); }
    if (seguida) {
        const mala = dados.malas.find(m => m.codigo === seguida), malha = malhasMala.get(seguida);
        marcador.visible = malha.visible;
        if (malha.visible) {
            marcador.position.set(malha.position.x, malha.position.y + 0.75, malha.position.z);
            if (aproximar) { aproximar = false; controls.target.copy(malha.position); camera.position.set(malha.position.x - 5.5, malha.position.y + 6, malha.position.z + 8.5); }
            const passo = malha.position.clone().sub(controls.target).multiplyScalar(0.08);
            controls.target.add(passo); camera.position.add(passo);
        }
        const e = estadoMala(mala, t), feitos = mala.passos.filter(p => p.tIn <= t), chave = seguida + '|' + feitos.length + '|' + e.estado;
        if ($('sh-seguir').dataset.chave !== chave) {
            $('sh-seguir').dataset.chave = chave;
            const lido = mala.leituras.filter(l => l.t <= t).at(-1), onde = e.estado === 'em_tapete' ? ` (${e.passo.troco.origem} → ${e.passo.troco.destino})` : e.saida && e.estado !== 'inspecao' ? ` (${e.saida})` : '';
            $('sh-seguir').innerHTML = `<b>MALA ${limpo(seguida)}</b><div>${mala.legivel ? 'Voo ' + limpo(mala.voo) + (dados.voos[mala.voo] ? '' : ' (sem partida conhecida)') : 'Etiqueta ilegível'} · ${NOMES_ESTADO[e.estado]}${onde}</div>` +
                (lido ? `<div>Leitor: ${lido.destino === 'INSPECAO' ? 'inspeção' : 'saída ' + lido.destino}${lido.vez > 1 ? ` · ${lido.vez}.ª leitura` : ''}</div>` : '') +
                '<ol>' + feitos.map(p => `<li>${hhmm(p.tIn)} · ${p.troco.origem} → ${p.troco.destino}</li>`).join('') + (mala.fim && t >= mala.fim.t ? `<li>${hhmm(mala.fim.t)} · ${NOMES_ESTADO[mala.fim.estado]}</li>` : '') +
                '</ol><button id="sh-largar">Deixar de seguir</button>';
            $('sh-largar').onclick = () => seguir(null);
        }
    }
    const quadro = [['Na saída certa', n.triada], ['Em tapete', n.em_tapete], ['No check-in', n.no_checkin], ['Inspeção', n.inspecao], ['Saída errada', n.errada], ['Recirculações', n.recirculacoes]]
        .map(([r, v]) => `<div><span>${r}</span>${v}</div>`).join('');
    if ($('sh-contadores').dataset.chave !== quadro) { $('sh-contadores').dataset.chave = quadro; $('sh-contadores').innerHTML = quadro; }
    const hora = hhmm(Math.min(t, dados.fim)); if ($('sh-hora').textContent !== hora) $('sh-hora').textContent = hora;
    $('sh-tempo').value = t;
}

function animar(agora) {
    ciclo = requestAnimationFrame(animar);
    const dt = Math.min(0.25, (agora - (ultimo || agora)) / 1000); ultimo = agora;
    if (dados && aReproduzir) {
        t = Math.min(fimVisual, t + dt * Number($('sh-velocidade').value));
        if (t >= fimVisual) aReproduzir = false;
    }
    $('sh-play').textContent = aReproduzir ? 'Ⅱ' : '▶';
    $('sh-checkin').hidden = !window.checkinHall?.dados?.();
    if (voo) { voo.k = Math.min(1, voo.k + dt / 0.9); const e = suave(voo.k); camera.position.lerpVectors(voo.p0, voo.p1, e); controls.target.lerpVectors(voo.a0, voo.a1, e); if (voo.k >= 1) voo = null; }
    controls.update();
    desenhar();
    if (!modoScada || rectCctv) renderer.render(scene, camera);
}

export function seguir(codigo) {
    seguida = codigo && malhasMala.has(codigo) ? codigo : null;
    aproximar = !!seguida && (modoScada || camera.position.distanceTo(controls.target) > 30);      // de longe, a câmara aproxima-se da mala
    if (seguida) { selecao = { tipo: 'mala', id: seguida }; voo = null; } else if (selecao?.tipo === 'mala') selecao = null;
    if (marcador) marcador.visible = false;
    $('sh-seguir').hidden = !seguida;
    $('sh-seguir').dataset.chave = '';
    $('sh-ocorrencias').style.visibility = seguida ? 'hidden' : '';
}

export function abrir() {
    if (!renderer) construir();
    window.dispatchEvent(new CustomEvent('hall-open', { detail: 'sorting' }));
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
$('sh-fechar').onclick = fechar;
$('sh-play').onclick = () => { if (!dados) return; if (t >= fimVisual) t = dados.inicio; aReproduzir = !aReproduzir; };
$('sh-tempo').oninput = e => { t = Number(e.target.value); aReproduzir = false; };
$('sh-vista').onchange = e => { seguir(null); selecao = null; vista(e.target.value); };
$('sh-checkin').onclick = () => window.checkinHall?.abrir();
$('sh-modo').onclick = () => { if (!renderer) construir(); modo(modoScada ? '3d' : 'scada'); };
{
    const tela = $('sh-scada'), em = e => { const c = tela.getBoundingClientRect(); return zonaEm(zonasScada, e.clientX - c.left, e.clientY - c.top); };
    tela.addEventListener('pointermove', e => { tela.style.cursor = em(e) ? 'pointer' : 'default'; });
    tela.addEventListener('click', e => { const z = em(e); selecionar(z ? { tipo: z.tipo, id: z.id } : null); });
}

window.addEventListener('sorting-run', e => { abrir(); carregar(e.detail); });
window.addEventListener('hall-open', e => { if (e.detail !== 'sorting' && sala.classList.contains('aberta')) fechar(); });
window.sortingHall = { abrir, fechar, seguir, vista, modo, selecionar, zonas: () => zonasScada, info: () => renderer && { ...renderer.info.render, geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures }, dados: () => dados };
