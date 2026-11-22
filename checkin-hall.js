// Bloco 2 · Bagagens, Fase 3: zona de check-in em 3D.
// Não simula nada: reproduz o registo de eventos devolvido pelo motor Python (checkin.py),
// por isso o que se vê é exatamente o que os programas do aluno decidiram. A cena só reparte,
// dentro de cada minuto, os passos de quem anda: entrar no átrio, avançar na fila, ir ao balcão.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { geometriaMala, geometriaPessoa } from './baggage-hall-model.js?v=bagagens-3';
import { criarCaminho } from './sorting-hall-model.js?v=checkin-1';
import { K, CAMINHOS_MALA, D_BALANCA, FILA, COMP_BAIAS, construirCheckin } from './checkin-hall-model.js?v=checkin-1';

const CORES_VOO = ['#e4572e', '#2e86de', '#f2b705', '#3fa34d', '#9b5de5'];
const COR_SEM_VOO = '#8a8f96', COR_ILEGIVEL = '#f4f4ee';
const T_CHAMADA = 0.3;                           // minutos que quem é chamado demora a sair da fila (os de trás avançam)
const acaso = (i, k = 0) => { let x = Math.imul(i + 1, 2654435761) ^ Math.imul(k + 7, 1597334677); x = Math.imul(x ^ (x >>> 15), 2246822519); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
const suave = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------------
// Reconstrução do estado a partir do registo (funções puras)
export function prepararCheckin(reg) {
    const voos = {}, balcoes = {}, malas = [], ocorrencias = [];
    reg.partidas.forEach((p, i) => { voos[p.voo] = { ...p, cor: CORES_VOO[i % CORES_VOO.length] }; });
    for (const b of reg.balcoes) balcoes[b.codigo] = { ...b, atendimentos: [] };
    const passageiros = reg.passageiros.map((p, i) => ({
        ...p, i, cor: voos[p.voo]?.cor ?? COR_SEM_VOO, urgenteDe: voos[p.voo] ? voos[p.voo].fecho - reg.urgencia : Infinity, porta: K.PORTAS[Math.floor(acaso(i, 3) * K.PORTAS.length)] + (acaso(i, 4) - 0.5) * 1.6,
        chamada: null, balcao: null, aceite: null, motivo: null, certo: null, perdeu: false, problemas: [], fim: null, rankChamada: 0, rota: null,
    }));
    for (const p of passageiros) { p.malas = Array.from({ length: p.malas }, (_, k) => ({ k, dono: p, indice: malas.length + k, t: null, codigo: null, etiqueta: null, peso: null, legivel: false, certa: false, balcao: null })); malas.push(...p.malas); }
    const por = new Map(passageiros.map(p => [p.reserva, p]));
    for (const e of reg.eventos) {
        const p = por.get(e.reserva);
        if (e.tipo === 'chamada') { p.chamada = e.minuto; p.balcao = e.balcao; p.posicao = e.posicao; p.eraUrgente = e.urgente; balcoes[e.balcao].atendimentos.push(p); }
        else if (e.tipo === 'decisao') Object.assign(p, { aceite: e.aceite, motivo: e.motivo, certo: e.certo, perdeu: e.perdeu, problemas: e.problemas });
        else if (e.tipo === 'mala') Object.assign(p.malas[e.indice], { t: e.minuto, codigo: e.mala, etiqueta: e.etiqueta, peso: e.peso, legivel: e.legivel, certa: e.certa, balcao: e.balcao });
        else if (e.tipo === 'saida') p.fim = e.minuto;
        else if (e.tipo === 'ocorrencia') ocorrencias.push(e);
    }
    // Lugar na fila no momento da chamada e caminho de saída do balcão (segurança ou apoio ao cliente)
    let recusados = 0;
    for (const p of [...passageiros].filter(p => p.fim !== null).sort((a, b) => a.fim - b.fim || a.i - b.i)) {
        const x = balcoes[p.balcao] ? K.BALCOES[p.balcao] + K.DX_SECRETARIA : 0, dz = (acaso(p.i, 5) - 0.5) * 1.3;
        if (p.aceite) p.rota = criarCaminho([[x, 0, K.Z_PASSAGEIRO], [x, 0, -2.4 + dz], [22.5, 0, -2.4 + dz], [K.SEGURANCA[0] - 3.2, 0, K.SEGURANCA[1] + dz * 1.6], [K.SEGURANCA[0] + 0.9, 0, K.SEGURANCA[1] + dz * 1.6]], 0.7);
        else { const k = recusados++; p.rota = criarCaminho([[x, 0, K.Z_PASSAGEIRO], [x, 0, -2.4 + dz], [-20, 0, -2.4 + dz], [K.APOIO[0] + (k % 4) * 0.85, 0, K.APOIO[1] - 2.6 + (Math.floor(k / 4) % 12) * 0.85]], 0.7); }
    }
    for (const p of passageiros) if (p.chamada !== null) p.rankChamada = passageiros.reduce((n, q) => n + (q.i < p.i && (q.chamada === null || q.chamada >= p.chamada) ? 1 : 0), 0);
    return { inicio: reg.inicio, fim: reg.fim, urgencia: reg.urgencia, voos, balcoes, passageiros, malas, ocorrencias, resumo: reg.resumo };
}

export function contar(dados, t) {
    const n = { a_chegar: 0, na_fila: 0, no_balcao: 0, aceite: 0, recusado: 0, malas: 0, erros: 0, perderam: 0, espera: 0, urgentes: 0 };
    for (const p of dados.passageiros) {
        if (t < p.chegada) n.a_chegar++;
        else if (p.chamada === null || t < p.chamada) { n.na_fila++; n.espera = Math.max(n.espera, t - p.chegada); if (t >= p.urgenteDe) n.urgentes++; }
        else if (p.fim === null || t < p.fim) n.no_balcao++;
        else if (p.aceite) n.aceite++; else n.recusado++;
        if (p.chamada !== null && t >= p.chamada + 0.5) { if (p.certo === false) n.erros++; if (p.perdeu) n.perderam++; }
    }
    for (const m of dados.malas) if (m.t !== null && t >= m.t) n.malas++;
    return n;
}

// Lugar de cada passageiro na fila (0 = cabeça). Quem é chamado sai aos poucos, para os de trás avançarem sem saltos.
export function lugares(dados, t, alvo = []) {
    let soma = 0;
    for (const p of dados.passageiros) { alvo[p.i] = soma; soma += p.chamada === null || t < p.chamada ? 1 : 1 - suave((t - p.chamada) / T_CHAMADA); }
    return alvo;
}

const _f = {}, _g = {};
// Posição de um passageiro no instante t: { v (visível), x, z, ry, anda }.
export function posePassageiro(dados, p, t, lugar, o = {}) {
    o.v = true; o.anda = false;
    if (p.chamada === null || t < p.chamada) {                                   // a chegar ou na fila
        const s0 = lugar * K.ESPACO, u = Math.max(0, p.chegada - t) * K.V_PESSOA;
        if (u === 0 || s0 + u <= COMP_BAIAS) { FILA.em(s0 + u, _f); o.x = _f.x; o.z = _f.z; o.ry = Math.atan2(-_f.tx, -_f.tz); o.anda = u > 0; return o; }
        const sj = Math.max(s0, COMP_BAIAS), v = s0 + u - sj;
        FILA.em(sj, _f);
        const dx = p.porta - _f.x, dz = K.Z1 + 1.5 - _f.z, dist = Math.hypot(dx, dz);
        if (v > dist) { o.v = false; return o; }
        o.x = _f.x + dx * v / dist; o.z = _f.z + dz * v / dist; o.ry = Math.atan2(-dx, -dz); o.anda = true; return o;
    }
    const x = K.BALCOES[p.balcao] + K.DX_SECRETARIA;
    if (p.fim === null || t < p.fim) {                                           // a caminho do balcão ou a ser atendido
        FILA.em(p.rankChamada * K.ESPACO, _f);
        const dist = Math.hypot(x - _f.x, K.Z_PASSAGEIRO - _f.z), k = (t - p.chamada) / limitar(dist / K.V_PESSOA, 0.12, 0.5), e = suave(k);
        o.x = _f.x + (x - _f.x) * e; o.z = _f.z + (K.Z_PASSAGEIRO - _f.z) * e; o.anda = k < 1;
        o.ry = k < 1 ? Math.atan2(x - _f.x, K.Z_PASSAGEIRO - _f.z) : Math.PI; return o;
    }
    const d = (t - p.fim) * K.V_PESSOA;                                           // saiu do balcão
    if (d >= p.rota.comp) {
        if (p.aceite) { o.v = false; return o; }
        p.rota.em(p.rota.comp, _f); o.x = _f.x; o.z = _f.z; o.ry = -Math.PI / 2; return o;
    }
    p.rota.em(d, _f); o.x = _f.x; o.z = _f.z; o.ry = Math.atan2(_f.tx, _f.tz); o.anda = true; return o;
}

// ---------------------------------------------------------------------------
// Interface
const estilo = document.createElement('style');
estilo.textContent = `
.checkin-hall{position:absolute;inset:0;z-index:6;background:#cfd8de;display:none;container-type:size}
.checkin-hall.aberta{display:block}
.checkin-hall canvas{display:block;width:100%;height:100%}
.ck-topo{position:absolute;top:12px;left:14px;right:14px;display:flex;gap:10px;align-items:flex-start;justify-content:space-between;pointer-events:none;font:13px/1.35 system-ui,sans-serif}
.ck-cartao{pointer-events:auto;background:#14273ae8;color:#e8eef2;border-radius:6px;padding:9px 12px;backdrop-filter:blur(8px)}
.ck-cartao b{font-size:12px;letter-spacing:1.5px;font-weight:650}
.ck-topo .ck-principal{max-width:520px}
.ck-contadores{display:grid;grid-template-columns:repeat(4,auto);gap:4px 14px;margin-top:6px;font-variant-numeric:tabular-nums}
.ck-contadores span{color:#9fb3c2;font-size:11px;display:block}
.ck-contadores .ck-mau{color:#ffb4a8}
.ck-ocorrencias{max-width:310px;max-height:132px;overflow:auto;font-size:12px}
.ck-ocorrencias li{margin-left:16px}
.ck-controlos{position:absolute;left:14px;right:14px;bottom:14px;display:flex;gap:8px;align-items:center;background:#14273ae8;color:#e8eef2;border-radius:6px;padding:8px 10px;font:13px system-ui,sans-serif}
.ck-controlos input[type=range]{flex:1;min-width:60px}
.ck-controlos button,.ck-controlos select{background:#2d4b63;color:#fff;border:1px solid #ffffff33;border-radius:4px;padding:4px 9px;font:inherit;cursor:pointer}
.ck-controlos button{white-space:nowrap}
.ck-controlos button[hidden]{display:none}
.ck-hora{font-variant-numeric:tabular-nums;min-width:44px;text-align:center;font-weight:650}
.ck-seguir{position:absolute;right:14px;top:12px;max-width:300px;font-size:12px}
.ck-seguir ol{margin:6px 0 0 18px;padding:0;max-height:180px;overflow:auto}
.ck-seguir button{margin-top:6px;background:#2d4b63;color:#fff;border:1px solid #ffffff33;border-radius:4px;padding:3px 8px;cursor:pointer}
.ck-legenda{display:block;margin-top:4px}
.ck-legenda i{display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 4px 0 0;vertical-align:-1px}
.ck-legenda span{margin-right:10px;white-space:nowrap}
.ck-dica{font-size:11px;color:#9fb3c2;margin-top:6px;max-width:470px}
.ck-abrir{position:absolute;right:12px;bottom:108px;z-index:5;background:#14273ae8;color:#e8eef2;border:1px solid #ffffff33;border-radius:4px;padding:6px 11px;font:13px system-ui,sans-serif;cursor:pointer}
.ck-vazio[hidden],.ck-cartao[hidden]{display:none}
.ck-vazio{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);background:#14273ae8;color:#e8eef2;border-radius:6px;padding:8px 14px;font:13px system-ui,sans-serif;text-align:center;pointer-events:none;max-width:80%}
@container (max-width: 820px){
.ck-topo .ck-principal{max-width:none}
.ck-topo{top:8px;left:8px;right:8px;font-size:12px}
.ck-cartao{padding:6px 9px}
.ck-dica,.ck-topo .ck-ocorrencias{display:none}
.ck-legenda span{margin-right:8px;font-size:11px}
.ck-contadores{grid-template-columns:repeat(8,auto);gap:2px 9px;margin-top:4px}
.ck-contadores span{font-size:10px}
.ck-controlos{left:8px;right:8px;bottom:8px;gap:5px;padding:6px 7px;font-size:12px}
.ck-controlos button,.ck-controlos select{padding:3px 5px}
.ck-controlos select{max-width:104px}
.ck-longo{display:none}
.ck-seguir{right:8px;top:auto;bottom:52px;max-width:240px}
.ck-seguir ol{max-height:84px}
}
`;
document.head.append(estilo);

const viewport = document.querySelector('.workspace-viewport') ?? document.getElementById('scene')?.parentElement ?? document.body;
const sala = document.createElement('div');
sala.className = 'checkin-hall';
sala.innerHTML = `
<div class="ck-topo">
  <div class="ck-cartao ck-principal"><b>CHECK-IN · PARTIDAS</b><span class="ck-legenda" id="ck-legenda"></span><div class="ck-contadores" id="ck-contadores"></div><div class="ck-dica">A bola por cima de cada passageiro tem a cor do voo; o anel laranja marca quem está urgente (faltam 15 minutos ou menos para o fecho). Clica num passageiro para o seguir.</div></div>
  <div class="ck-cartao ck-ocorrencias" id="ck-ocorrencias" hidden></div>
</div>
<div class="ck-cartao ck-seguir" id="ck-seguir" hidden></div>
<div class="ck-vazio" id="ck-vazio">Executa um programa do check-in (níveis 26 a 28) para ver aqui os passageiros e as malas.</div>
<div class="ck-controlos">
  <button id="ck-play" title="Reproduzir ou pausar">▶</button>
  <span class="ck-hora" id="ck-hora">--:--</span>
  <input type="range" id="ck-tempo" min="0" max="1" step="0.002" value="0" aria-label="Hora simulada">
  <select id="ck-velocidade" aria-label="Velocidade"><option value="0.25">0,25 min/s</option><option value="0.5">0,5 min/s</option><option value="1" selected>1 min/s</option><option value="2">2 min/s</option><option value="4">4 min/s</option><option value="8">8 min/s</option></select>
  <select id="ck-vista" aria-label="Vista"><option value="geral">Vista geral</option><option value="balcoes">Balcões</option><option value="fila">Fila única</option><option value="coletor">Tapete coletor</option><option value="entrada">Entrada do átrio</option><option value="apoio">Apoio ao cliente</option></select>
  <button id="ck-triagem" title="Seguir as malas na central de triagem" hidden><span class="ck-longo">Triagem </span>➜</button>
  <button id="ck-fechar" title="Voltar à maquete do aeroporto"><span class="ck-longo">Aeroporto </span>✕</button>
</div>`;
viewport.append(sala);
const botaoAbrir = document.createElement('button');
botaoAbrir.className = 'ck-abrir';
botaoAbrir.textContent = '🧳 Check-in';
viewport.append(botaoAbrir);
const $ = id => sala.querySelector('#' + id);
function hhmm(m) { m = Math.floor(m); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
const limpo = s => String(s).replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;');

// ---------------------------------------------------------------------------
// Cena
let renderer = null, scene, camera, controls, modelo, marcador, bolas = null, aneis = null;
let dados = null, t = 0, fimVisual = 0, aReproduzir = false, ultimo = 0, ciclo = null, seguido = null, aproximar = false;
let malhasPessoa = [], malhasMala = [], objetos = [], poses = [], lugar = [];
const geoMalas = new Map(), geoPessoas = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

function construir() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
    sala.prepend(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#cfd8de');
    camera = new THREE.PerspectiveCamera(45, 1, 0.25, 500);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.minDistance = 1.5; controls.maxDistance = 150;
    modelo = construirCheckin(scene, renderer);
    marcador = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 36), new THREE.MeshBasicMaterial({ color: '#ffd400', depthTest: false, transparent: true }));
    marcador.rotation.x = Math.PI / 2; marcador.renderOrder = 5; marcador.visible = false; scene.add(marcador);
    const raio = new THREE.Raycaster(), ponteiro = new THREE.Vector2();
    let inicioClique = null;
    renderer.domElement.addEventListener('pointerdown', e => { inicioClique = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', e => {
        if (!inicioClique || Math.hypot(e.clientX - inicioClique[0], e.clientY - inicioClique[1]) > 5 || !dados) return;
        const caixa = renderer.domElement.getBoundingClientRect();
        ponteiro.set((e.clientX - caixa.left) / caixa.width * 2 - 1, -(e.clientY - caixa.top) / caixa.height * 2 + 1);
        raio.setFromCamera(ponteiro, camera);
        const alvo = raio.intersectObjects(malhasPessoa.filter(m => m.visible))[0]?.object;
        seguir(alvo ? alvo.userData.reserva : null);
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
    geral: [[0, 32, 45], [0, 0, 3.5]], balcoes: [[0, 7.5, 6], [0, 1.6, -6.5]], fila: [[-19, 12, 17], [0, 0.6, 3.5]],
    coletor: [[-22, 6.5, -3.4], [-9, 0.6, -10.4]], entrada: [[19, 6, 9], [3, 1.4, 21]], apoio: [[-11, 6.5, 5.5], [-25, 0.8, -5]],
};
export function vista(nome) {
    if (!camera) return;
    const v = Array.isArray(nome) ? nome : VISTAS[nome] ?? null;
    if (!v) return;
    const f = nome === 'geral' ? Math.max(1, 1.62 / camera.aspect) : 1;            // num visor estreito, a vista geral recua para caber o átrio todo
    controls.target.set(...v[1]); camera.position.set(...v[0]).sub(controls.target).multiplyScalar(f).add(controls.target); controls.update();
    if (!Array.isArray(nome)) $('ck-vista').value = nome;
}

function geosMala(tipo, cor) {                    // a mesma mala com e sem cinta e etiqueta (as duas últimas peças da geometria)
    const chave = cor + tipo;
    if (!geoMalas.has(chave)) {
        const com = geometriaMala(tipo, cor), sem = new THREE.BufferGeometry();
        for (const nome of ['position', 'normal', 'color']) sem.setAttribute(nome, com.attributes[nome]);
        sem.setDrawRange(0, com.attributes.position.count - 72); sem.userData = com.userData;
        geoMalas.set(chave, { com, sem });
    }
    return geoMalas.get(chave);
}

function carregar(registo) {
    for (const o of objetos) scene.remove(o);
    objetos = []; malhasPessoa = []; malhasMala = [];
    for (const o of [bolas, aneis]) if (o) { scene.remove(o); o.dispose(); }
    dados = prepararCheckin(registo);
    for (const p of dados.passageiros) {
        if (!geoPessoas[p.i % 28]) geoPessoas[p.i % 28] = geometriaPessoa(p.i % 28 + 1);
        const malha = new THREE.Mesh(geoPessoas[p.i % 28], modelo.matPessoas);
        malha.castShadow = true; malha.visible = false; malha.userData.reserva = p.reserva; scene.add(malha); objetos.push(malha); malhasPessoa.push(malha);
    }
    for (const mala of dados.malas) {
        const cor = mala.t === null ? COR_SEM_VOO : !mala.legivel ? COR_ILEGIVEL : mala.dono.cor, g = geosMala(Math.floor(acaso(mala.indice, 14) * 24), cor);
        const malha = new THREE.Mesh(g.sem, modelo.matMalas);
        malha.castShadow = true; malha.visible = false; malha.userData.geos = g; scene.add(malha); objetos.push(malha); malhasMala.push(malha);
    }
    const n = dados.passageiros.length;
    bolas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), n); bolas.frustumCulled = false; scene.add(bolas);
    aneis = new THREE.InstancedMesh(new THREE.TorusGeometry(0.36, 0.035, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff8a1c', toneMapped: false }), n); aneis.frustumCulled = false; scene.add(aneis);
    dados.passageiros.forEach(p => bolas.setColorAt(p.i, _c.set(p.cor)));
    bolas.instanceColor.needsUpdate = true;
    for (const [codigo, b] of Object.entries(modelo.balcoes)) { const aberto = dados.balcoes[codigo]?.aberto !== false; b.agente.visible = aberto; b.fechado.visible = !aberto; }
    $('ck-vazio').hidden = true;
    seguir(null);
    $('ck-legenda').innerHTML = Object.values(dados.voos).map(v => `<span><i style="background:${v.cor}"></i>${limpo(v.voo)} ${limpo(v.destino)} · fecha ${hhmm(v.fecho)}</span>`).join('') + (dados.passageiros.some(p => !dados.voos[p.voo]) ? `<span><i style="background:${COR_SEM_VOO}"></i>voo desconhecido</span>` : '');
    const tempos = [dados.fim, ...dados.malas.filter(m => m.t !== null).map(m => m.t + 2.1), ...dados.passageiros.filter(p => p.fim !== null).map(p => p.fim + 1)];
    fimVisual = Math.max(...tempos);
    const primeira = Math.min(...dados.passageiros.map(p => p.chegada), dados.fim);
    $('ck-tempo').min = dados.inicio; $('ck-tempo').max = fimVisual;
    $('ck-ocorrencias').dataset.n = '';
    t = Math.max(dados.inicio, primeira - 2.5); aReproduzir = true;
    vista('geral');
}

// --- Ecrãs dos balcões, balanças e painel de partidas ---------------------------------
function texto(g, s, x, y, tam, cor, peso = 600, alinhar = 'left', larguraMax = 0) {
    g.fillStyle = cor; g.textAlign = alinhar; g.textBaseline = 'middle'; g.font = `${peso} ${tam}px Arial, sans-serif`;
    if (larguraMax) { const w = g.measureText(s).width; if (w > larguraMax) g.font = `${peso} ${tam * larguraMax / w}px Arial, sans-serif`; }
    g.fillText(s, x, y);
}
function desenharBalcao(codigo, tt) {
    const m = modelo.balcoes[codigo], b = dados?.balcoes[codigo];
    let p = null;
    if (b) for (const q of b.atendimentos) { if (q.chamada <= tt) p = q; else break; }
    const ativo = p && (p.fim === null || tt < p.fim), aberto = !b || b.aberto;
    const fase = !aberto ? 'fechado' : !ativo ? 'livre' : tt < p.chamada + 0.5 ? 'chamada' : p.aceite ? 'aceite' : 'recusado';
    const atendidos = b ? b.atendimentos.filter(q => q.fim !== null && q.fim <= tt).length : 0;
    const mala = ativo ? p.malas.find(k => k.t !== null && tt >= k.t - 0.35 && tt < k.t + 0.7) : null, etiquetada = mala && tt >= mala.t;
    const chave = [fase, p?.reserva, atendidos].join('|'), chaveB = [mala?.indice, etiquetada, aberto].join('|');
    if (m.ecra.chave !== chave) {
        m.ecra.chave = chave;
        const g = m.ecra.canvas.getContext('2d'), W = 768, H = 256;
        g.fillStyle = '#0b1726'; g.fillRect(0, 0, W, H);
        g.fillStyle = fase === 'fechado' ? '#3a4350' : '#1f5fa8'; g.fillRect(0, 0, 196, H);
        texto(g, codigo, 98, 106, 92, '#ffffff', 700, 'center'); texto(g, 'CHECK-IN', 98, 196, 30, '#cfe1f5', 600, 'center');
        if (fase === 'fechado') texto(g, 'FECHADO', 482, 128, 84, '#7d8894', 700, 'center');
        else if (fase === 'livre') { texto(g, 'LIVRE', 482, 104, 92, '#3ddc84', 700, 'center'); texto(g, dados ? `Atendidos: ${atendidos}` : 'Bem-vindo', 482, 196, 36, '#9fb3c2', 500, 'center'); }
        else {
            const cor = { chamada: '#f2b705', aceite: '#3ddc84', recusado: '#ff5a4d' }[fase], titulo = { chamada: 'A CHAMAR', aceite: '✔ ACEITE', recusado: '✖ RECUSADO' }[fase];
            g.fillStyle = cor; g.fillRect(196, 0, W - 196, 84); texto(g, titulo, 482, 44, 56, '#0b1726', 700, 'center');
            texto(g, p.nome, 216, 126, 50, '#ffffff', 600, 'left', 530);
            const linha = fase === 'recusado' ? p.motivo : `${p.voo} ${dados.voos[p.voo]?.destino ?? ''} · ${p.malas.length} ${p.malas.length === 1 ? 'mala' : 'malas'}`;
            texto(g, linha, 216, 190, 42, fase === 'recusado' ? '#ffb4a8' : '#cfe1f5', 500, 'left', 530);
            if (fase !== 'chamada' && p.certo === false) { g.fillStyle = '#ffd400'; g.fillRect(196, 226, W - 196, 30); texto(g, '⚠ DECISÃO ERRADA', 482, 242, 24, '#1b1b1b', 700, 'center'); }
        }
        m.ecra.tex.needsUpdate = true;
    }
    if (m.balanca.chave !== chaveB) {
        m.balanca.chave = chaveB;
        const g = m.balanca.canvas.getContext('2d');
        g.fillStyle = '#050a08'; g.fillRect(0, 0, 320, 128);
        texto(g, mala ? `${Number(mala.peso).toFixed(1)} kg` : aberto ? '0.0 kg' : '— —', 160, mala ? 44 : 64, mala ? 60 : 56, mala && mala.peso > 23 ? '#ffb020' : '#3ddc84', 700, 'center');
        if (mala) texto(g, etiquetada ? (mala.legivel ? mala.etiqueta : mala.etiqueta ? `✖ ${mala.etiqueta}` : 'SEM ETIQUETA') : 'a pesar…', 160, 100, 32, etiquetada && !mala.legivel ? '#ff5a4d' : '#e8eef2', 600, 'center', 300);
        m.balanca.tex.needsUpdate = true;
    }
    return ativo && p.malas.some(k => k.t !== null && tt >= k.t && tt < k.t + 0.45);      // o tapete do balcão está a andar?
}
function desenharPainel(tt, n) {
    const voos = dados ? Object.values(dados.voos) : [], linhas = voos.map(v => {
        const aceites = dados.passageiros.filter(p => p.voo === v.voo && p.aceite && p.chamada + 0.5 <= tt).length, malas = dados.malas.filter(m => m.dono.voo === v.voo && m.t !== null && m.t <= tt).length;
        const estado = tt >= v.fecho ? 2 : tt >= v.fecho - dados.urgencia ? 1 : 0;
        return { v, aceites, malas, estado };
    });
    const pisca = Math.floor(performance.now() / 600) % 2, chave = (dados ? hhmm(Math.min(tt, dados.fim)) : '') + '|' + linhas.map(l => [l.aceites, l.malas, l.estado, l.estado === 1 ? pisca : 0]).join(';') + '|' + (n ? n.na_fila : '');
    if (modelo.painel.chave === chave) return;
    modelo.painel.chave = chave;
    const g = modelo.painel.canvas.getContext('2d'), W = 2048, H = 512;
    g.fillStyle = '#081320'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#16365f'; g.fillRect(0, 0, W, 92);
    texto(g, 'PARTIDAS  ·  CHECK-IN', 40, 48, 54, '#ffffff', 700); texto(g, dados ? hhmm(Math.min(tt, dados.fim)) : '--:--', W - 40, 48, 58, '#ffd75a', 700, 'right');
    if (n) texto(g, `Na fila: ${n.na_fila}`, W - 300, 48, 40, '#cfe1f5', 500, 'right');
    const colunas = [[40, 'HORA'], [250, 'VOO'], [520, 'DESTINO'], [930, 'CHECK-IN'], [1560, 'ACEITES'], [1840, 'MALAS']];
    for (const [x, nome] of colunas) texto(g, nome, x, 124, 28, '#7f95a8', 600);
    if (!dados) { texto(g, 'Sem voos em check-in', W / 2, 300, 60, '#51667a', 600, 'center'); modelo.painel.tex.needsUpdate = true; return; }
    linhas.forEach((l, i) => {
        const y = 186 + i * 84, v = l.v;
        if (i % 2 === 0) { g.fillStyle = '#0d1b2c'; g.fillRect(0, y - 40, W, 80); }
        g.fillStyle = v.cor; g.beginPath(); g.arc(214, y, 15, 0, 7); g.fill();
        texto(g, hhmm(v.hora), 40, y, 56, '#ffd75a', 700); texto(g, v.voo, 250, y, 56, '#ffffff', 700); texto(g, String(v.destino).toUpperCase(), 520, y, 56, '#ffffff', 600, 'left', 380);
        const [cor, rotulo] = l.estado === 2 ? ['#ff5a4d', 'FECHADO'] : l.estado === 1 ? [pisca ? '#f2b705' : '#8a6a05', `ÚLTIMA CHAMADA · fecha ${hhmm(v.fecho)}`] : ['#3ddc84', `ABERTO · fecha ${hhmm(v.fecho)}`];
        texto(g, rotulo, 930, y, 46, cor, 700, 'left', 590);
        texto(g, String(l.aceites), 1560, y, 56, '#ffffff', 700); texto(g, String(l.malas), 1840, y, 56, '#ffffff', 700);
    });
    modelo.painel.tex.needsUpdate = true;
}
function desenharFixos(tt) {
    const n = dados ? contar(dados, tt) : null, corre = (tt * K.V_TAPETE * 0.5) % 1;
    for (const codigo of Object.keys(modelo.balcoes)) { const anda = desenharBalcao(codigo, tt); if (anda) modelo.tapetes[codigo].tex.offset.y = -corre; }
    modelo.tapetes.C1.tex.offset.y = modelo.tapetes.C2.tex.offset.y = -corre;
    desenharPainel(tt, n);
    return n;
}

// --- Passageiros e malas -----------------------------------------------------------------
function colocarMala(mala, malha, tt) {
    const p = mala.dono, pose = poses[p.i], L = malha.userData.geos.com.userData.L;
    malha.geometry = mala.t !== null && tt >= mala.t ? malha.userData.geos.com : malha.userData.geos.sem;
    const lado = mala.k % 2 ? -0.44 : 0.44;
    const junto = () => { const c = Math.cos(pose.ry), s = Math.sin(pose.ry); malha.position.set(pose.x + c * lado - s * 0.12, L / 2 + (pose.y ?? 0) * 0.3, pose.z - s * lado - c * 0.12); malha.rotation.set(0, pose.ry, Math.PI / 2); };
    if (mala.t === null || tt < mala.t - 0.6) { if (!pose.v) return false; junto(); return true; }
    const cam = CAMINHOS_MALA[mala.balcao];
    if (tt < mala.t - 0.35) {                    // o passageiro põe a mala na balança
        junto(); cam.em(D_BALANCA, _g);
        const k = suave((tt - (mala.t - 0.6)) / 0.25);
        malha.position.set(malha.position.x + (_g.x - malha.position.x) * k, malha.position.y + (_g.y + 0.01 - malha.position.y) * k + Math.sin(k * Math.PI) * 0.3, malha.position.z + (_g.z - malha.position.z) * k);
        if (k > 0.5) malha.rotation.set(0, Math.PI / 2, 0);
        return true;
    }
    const d = D_BALANCA + Math.max(0, tt - mala.t) * K.V_TAPETE;
    if (d >= cam.comp) return false;
    cam.em(d, _g);
    if (_g.z < K.Z0 - 0.45) return false;
    const desvio = ((Object.keys(K.BALCOES).indexOf(mala.balcao) % 3) - 1) * 0.16 * suave((d - 5.2) / 1.5);      // no coletor, cada balcão usa a sua faixa
    const hz = Math.hypot(_g.tx, _g.tz) || 1;
    malha.position.set(_g.x - _g.tz / hz * desvio, _g.y + 0.01, _g.z + _g.tx / hz * desvio); malha.rotation.set(0, Math.atan2(-_g.tz, _g.tx), 0);
    return true;
}

function desenhar() {
    modelo.teto.visible = camera.position.y < K.ALTURA - 0.3;
    modelo.fachada.visible = camera.position.z < K.Z1 - 0.4;
    const n = desenharFixos(t);
    if (!dados) return;
    lugares(dados, t, lugar);
    for (const p of dados.passageiros) {
        const o = poses[p.i] = posePassageiro(dados, p, t, lugar[p.i], poses[p.i] ?? {}), malha = malhasPessoa[p.i];
        malha.visible = o.v;
        let anel = 0, altura = 0;
        if (o.v) {
            o.y = o.anda ? Math.abs(Math.sin((o.x + o.z) * 3.3)) * 0.035 : 0;
            malha.position.set(o.x, o.y, o.z); malha.rotation.y = o.ry;
            altura = 1.98; anel = t >= p.urgenteDe && t >= p.chegada && (p.chamada === null || t < p.chamada) ? 1 + Math.sin(performance.now() / 180 + p.i) * 0.1 : 0;
        }
        _m.compose(_v.set(o.x ?? 0, altura, o.z ?? 0), _q.identity(), _s.setScalar(o.v ? 1 : 0)); bolas.setMatrixAt(p.i, _m);
        _m.compose(_v.set(o.x ?? 0, 0.03, o.z ?? 0), _q.identity(), _s.setScalar(anel)); aneis.setMatrixAt(p.i, _m);
    }
    bolas.instanceMatrix.needsUpdate = aneis.instanceMatrix.needsUpdate = true;
    dados.malas.forEach((mala, i) => { malhasMala[i].visible = colocarMala(mala, malhasMala[i], t); });
    if (seguido) {
        const p = seguido, o = poses[p.i];
        marcador.visible = o.v;
        if (o.v) {
            marcador.position.set(o.x, 2.3, o.z);
            _v.set(o.x, 1, o.z);
            if (aproximar) { aproximar = false; controls.target.copy(_v); camera.position.set(o.x + 3, 6, o.z + 9); }
            const passo = _v.sub(controls.target).multiplyScalar(0.08);
            controls.target.add(passo); camera.position.add(passo);
        }
        const fase = t < p.chegada ? 0 : p.chamada === null || t < p.chamada ? 1 : t < p.chamada + 0.5 ? 2 : p.fim === null || t < p.fim ? 3 : 4, etiquetas = p.malas.filter(m => m.t !== null && m.t <= t).length;
        const chave = p.reserva + '|' + fase + '|' + etiquetas;
        if ($('ck-seguir').dataset.chave !== chave) {
            $('ck-seguir').dataset.chave = chave;
            const v = dados.voos[p.voo], passos = [];
            if (fase >= 1) passos.push(`${hhmm(p.chegada)} · entrou na fila`);
            if (fase >= 2) passos.push(`${hhmm(p.chamada)} · chamado ao balcão ${p.balcao} (esperou ${p.chamada - p.chegada} min${p.eraUrgente ? ', urgente' : ''})`);
            if (fase >= 3) passos.push(`${hhmm(p.chamada)} · ${p.aceite ? 'aceite' : 'recusado: ' + limpo(p.motivo)}` + (p.certo === false ? ` · <em style="color:#ffd400;font-style:normal">decisão errada: ${p.problemas.length ? 'o problema era ' + limpo(p.problemas[0]) : 'estava tudo em ordem'}</em>` : ''));
            for (const m of p.malas) if (m.t !== null && m.t <= t) passos.push(`${hhmm(m.t)} · mala de ${Number(m.peso).toFixed(1)} kg: ${m.etiqueta ? limpo(m.etiqueta) : 'sem etiqueta'}${m.legivel ? '' : ' (ilegível)'}`);
            if (fase >= 4) passos.push(`${hhmm(p.fim)} · ${p.aceite ? 'seguiu para o controlo de segurança' : 'foi para o apoio ao cliente'}`);
            $('ck-seguir').innerHTML = `<b>${limpo(p.nome).toUpperCase()}</b><div>Reserva ${limpo(p.reserva)} · voo ${limpo(p.voo)}${v ? ' para ' + limpo(v.destino) : ' (desconhecido)'} · ${p.malas.length} ${p.malas.length === 1 ? 'mala' : 'malas'}</div>` +
                (fase === 0 ? `<div>Chega às ${hhmm(p.chegada)}</div>` : '') + '<ol>' + passos.map(x => `<li>${x}</li>`).join('') + '</ol><button id="ck-largar">Deixar de seguir</button>';
            $('ck-largar').onclick = () => seguir(null);
        }
    }
    const quadro = [['Na fila', n.na_fila], ['Nos balcões', n.no_balcao], ['Aceites', n.aceite], ['Recusados', n.recusado], ['Malas etiquetadas', n.malas], ['Urgentes na fila', n.urgentes], ['Decisões erradas', n.erros, n.erros], ['Perderam o voo', n.perderam, n.perderam]]
        .map(([r, v, mau]) => `<div${mau ? ' class="ck-mau"' : ''}><span>${r}</span>${v}</div>`).join('');
    if ($('ck-contadores').dataset.chave !== quadro) { $('ck-contadores').dataset.chave = quadro; $('ck-contadores').innerHTML = quadro; }
    const lista = dados.ocorrencias.filter(o => o.minuto <= t);                  // só o que já aconteceu, com o mais recente em cima
    if ($('ck-ocorrencias').dataset.n !== String(lista.length)) {
        $('ck-ocorrencias').dataset.n = lista.length; $('ck-ocorrencias').hidden = !lista.length;
        $('ck-ocorrencias').innerHTML = `<b>OCORRÊNCIAS · ${lista.length}</b><ul>` + lista.slice(-30).reverse().map(o => `<li>${hhmm(o.minuto)} · ${limpo(o.texto)}</li>`).join('') + (lista.length > 30 ? `<li>… e mais ${lista.length - 30} antes</li>` : '') + '</ul>';
    }
    const hora = hhmm(Math.min(t, dados.fim)); if ($('ck-hora').textContent !== hora) $('ck-hora').textContent = hora;
    $('ck-tempo').value = t;
}

function animar(agora) {
    ciclo = requestAnimationFrame(animar);
    const dt = Math.min(0.25, (agora - (ultimo || agora)) / 1000); ultimo = agora;
    if (dados && aReproduzir) {
        t = Math.min(fimVisual, t + dt * Number($('ck-velocidade').value));
        if (t >= fimVisual) aReproduzir = false;
    }
    $('ck-play').textContent = aReproduzir ? 'Ⅱ' : '▶';
    $('ck-triagem').hidden = !window.sortingHall?.dados?.();
    controls.update();
    desenhar();
    renderer.render(scene, camera);
}

export function seguir(reserva) {
    seguido = reserva && dados ? dados.passageiros.find(p => p.reserva === reserva) ?? null : null;
    aproximar = !!seguido && camera.position.distanceTo(controls.target) > 22;      // de longe, a câmara aproxima-se do passageiro
    if (marcador) marcador.visible = false;
    $('ck-seguir').hidden = !seguido;
    $('ck-seguir').dataset.chave = '';
    $('ck-ocorrencias').style.visibility = seguido ? 'hidden' : '';
}

export function abrir() {
    if (!renderer) construir();
    window.dispatchEvent(new CustomEvent('hall-open', { detail: 'checkin' }));
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
$('ck-fechar').onclick = fechar;
$('ck-play').onclick = () => { if (!dados) return; if (t >= fimVisual) t = dados.inicio; aReproduzir = !aReproduzir; };
$('ck-tempo').oninput = e => { t = Number(e.target.value); aReproduzir = false; };
$('ck-vista').onchange = e => { seguir(null); vista(e.target.value); };
$('ck-triagem').onclick = () => window.sortingHall?.abrir();

window.addEventListener('checkin-run', e => { abrir(); carregar(e.detail); });
window.addEventListener('hall-open', e => { if (e.detail !== 'checkin' && sala.classList.contains('aberta')) fechar(); });
window.checkinHall = { abrir, fechar, seguir, vista, tempo: () => t, info: () => renderer && { ...renderer.info.render, geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures }, dados: () => dados };
