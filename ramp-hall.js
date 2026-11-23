// Bloco 2 · Bagagens, Fase 4: placa de estacionamento em 3D.
// Não simula nada: reproduz o registo de eventos devolvido pelo motor Python (carregamento.py),
// por isso o que se vê é exatamente o que os programas do aluno decidiram. A cena só reparte,
// dentro de cada minuto, o movimento dos reboques, dos tapetes e de cada mala até ao seu lugar no porão.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { melhorarCamara } from './camara-salas.js?v=camara-1';
import { carregarElenco, vestir } from './pessoas-glb.js?v=pessoas-1';
import { aplicarAcabamentos } from './acabamentos.js?v=acabamentos-1';
import { geometriaMala } from './baggage-hall-model.js?v=pessoas-1';
import { A, P, lugarNoPorao, lugarNoReboque, construirPlaca } from './ramp-hall-model.js?v=pessoas-1';

const CORES_VOO = ['#e4572e', '#2e86de', '#f2b705', '#3fa34d', '#9b5de5'];
const T_CARGA = 0.36, T_DESCARGA = 0.5;             // minutos que uma mala demora do reboque ao porão e do porão ao reboque
const T_RECUO = 1.6, T_PAUSA = 0.5, V_TAXI = 260;   // push-back, desengate do trator e rolagem (metros por minuto)
const PORTA_ABERTA = 2.55, RECUO_TAPETE = 7, RECUO_MANGA = 5;
const acaso = (i, k = 0) => { let x = Math.imul(i + 1, 2654435761) ^ Math.imul(k + 7, 1597334677); x = Math.imul(x ^ (x >>> 15), 2246822519); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
const suave = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
const rampa = (t, a, b) => suave((t - a) / (b - a));
const mistura = (a, b, k) => a + (b - a) * k;

// ---------------------------------------------------------------------------
// Reconstrução do estado a partir do registo (funções puras)
export function prepararPlaca(reg) {
    const voos = {}, malas = [], ocorrencias = [], por = new Map(), usados = new Set();
    reg.voos.forEach((v, i) => {
        const visivel = v.lugar in P.LUGARES && !usados.has(v.lugar); usados.add(v.lugar);
        voos[v.voo] = { ...v, i, cor: CORES_VOO[i % CORES_VOO.length], xc: P.LUGARES[v.lugar] ?? 0, visivel, malas: [], filas: { frente: [], tras: [] },
            plano: null, fimCarga: null, embarque: null, fecho: null, atraso: 0, tPlano: Infinity, tParte: Infinity, tChega: Infinity, tFimCarga: Infinity, tEmbarque: Infinity, tFecho: Infinity, tPartida: Infinity, tSaida: Infinity };
    });
    for (const m of reg.malas) {
        const o = { ...m, i: malas.length, v: voos[m.voo], porao: null, tapete: null, reboque: 0, jr: 0, nr: 1, carga: null, posicao: 0, recusa: null, descarga: null, certa: true, manual: false, fora: false };
        malas.push(o); por.set(m.etiqueta, o); o.v?.malas.push(o);
    }
    const vez = {};
    for (const e of reg.eventos) {
        const v = voos[e.voo], m = por.get(e.mala);
        if (e.tipo === 'ocorrencia') { ocorrencias.push(e); continue; }
        if (!v) continue;
        if (e.tipo === 'plano') {
            v.plano = e; v.tPlano = e.minuto;
            for (const [porao, lista] of Object.entries(e.plano)) for (const etiqueta of lista) { const x = por.get(etiqueta); if (!x) continue; x.porao = porao; x.tapete = reg.tapete[porao]; v.filas[x.tapete].push(x); }
            for (const etiqueta of e.fora ?? []) { const x = por.get(etiqueta); if (x) x.fora = true; }
        }
        else if (e.tipo === 'reboques') { v.tParte = e.parte; v.tChega = e.chega; }
        else if (e.tipo === 'carga' && m) { m.carga = e.minuto + e.ordem / 4; m.posicao = e.posicao; m.porao = e.porao; }
        else if (e.tipo === 'recusa' && m) m.recusa = e.minuto + e.ordem / 4;
        else if (e.tipo === 'fim_carga') { v.fimCarga = e; v.tFimCarga = e.minuto; }
        else if (e.tipo === 'embarque') { v.embarque = e; v.tEmbarque = e.minuto; }
        else if (e.tipo === 'descarga' && m) { const chave = e.voo + e.minuto + e.tapete, k = vez[chave] = (vez[chave] ?? -1) + 1; m.descarga = e.minuto + k * 0.3; m.certa = e.certa; m.manual = e.manual; }
        else if (e.tipo === 'fecho') { v.fecho = e; v.tFecho = e.minuto; v.atraso = e.atraso; }
        else if (e.tipo === 'partida') { v.tPartida = e.minuto; v.atraso = e.atraso; }
    }
    for (const v of Object.values(voos)) {
        for (const fila of Object.values(v.filas)) { const n0 = Math.ceil(fila.length / 2); fila.forEach((m, k) => { m.reboque = k < n0 ? 0 : 1; m.jr = k < n0 ? k : k - n0; m.nr = k < n0 ? n0 : fila.length - n0; }); }
        const ultima = Math.max(-Infinity, ...v.malas.filter(m => m.descarga !== null).map(m => m.descarga + T_DESCARGA));
        v.tSaida = Math.max(v.tFecho + 0.1, ultima + 0.05);
    }
    return { inicio: reg.inicio, fim: reg.fim, origem: reg.origem, modo: reg.modo, corda: reg.corda, poroes: reg.poroes, voos, lista: Object.values(voos), malas, ocorrencias, resumo: reg.resumo };
}

// Estado de uma mala no instante t: na_saida, em_reboque, a_carregar, carregada, a_retirar, retirada ou em_terra.
export function estadoMala(m, t) {
    const v = m.v;
    if (!v || m.tapete === null) return m.fora && v && t >= v.tPlano ? 'em_terra' : 'na_saida';
    if (m.carga !== null && t >= m.carga) {
        if (m.descarga !== null && t >= m.descarga) return t < m.descarga + T_DESCARGA ? 'a_retirar' : 'retirada';
        return t < m.carga + T_CARGA ? 'a_carregar' : 'carregada';
    }
    if (m.recusa !== null && t >= m.recusa) return 'em_terra';
    return t >= v.tParte ? 'em_reboque' : 'na_saida';
}
export function contar(dados, t) {
    const n = { na_saida: 0, em_reboque: 0, a_carregar: 0, carregada: 0, a_retirar: 0, retirada: 0, em_terra: 0, atraso: 0, fechados: 0 };
    for (const m of dados.malas) n[estadoMala(m, t)]++;
    for (const v of dados.lista) { if (t >= v.tFecho) { n.fechados++; n.atraso += v.fecho.atraso; } }
    return n;
}
// Peso das malas em cada porão e centro de gravidade no instante t (as mesmas contas do motor).
export function centragem(dados, v, t) {
    const pesos = Object.fromEntries(dados.poroes.map(p => [p, 0]));
    for (const m of v.malas) if (m.carga !== null && t >= m.carga + T_CARGA && !(m.descarga !== null && t >= m.descarga)) pesos[m.porao] += m.peso;
    let momento = 0, total = 0;
    for (const x of v.aviao.massas) { momento += x.peso * x.braco; total += x.peso; }
    for (const p of dados.poroes) { momento += pesos[p] * v.aviao.poroes[p].braco; total += pesos[p]; }
    const cg = momento / total;
    return { pesos, cg, dentro: cg >= v.aviao.limite_frente && cg <= v.aviao.limite_tras, corda: (cg - dados.corda.inicio) / dados.corda.comprimento * 100 };
}
export function estadoVoo(v, t) {
    if (t >= v.tPartida) return [v.atraso ? `PARTIU COM ${v.atraso} MIN DE ATRASO` : 'PARTIU À HORA', v.atraso ? '#ffb020' : '#9fb3c2'];
    if (t >= v.tFecho) return v.fecho.atraso ? [`PORÕES FECHADOS · ATRASO DE ${v.fecho.atraso} MIN`, '#ffb020'] : ['PORÕES FECHADOS · PRONTO A SAIR', '#3ddc84'];
    if (t >= v.tEmbarque) {
        const n = v.embarque.retirar.length, f = v.embarque.faltas.length;
        return n ? [`RECONCILIAÇÃO · ${n} ${n === 1 ? 'MALA' : 'MALAS'} A RETIRAR`, '#f2b705'] : f ? [`EMBARQUE FECHADO · ${f} ${f === 1 ? 'FALTA' : 'FALTAS'}`, '#ffb020'] : ['EMBARQUE FECHADO · TODOS A BORDO', '#3ddc84'];
    }
    if (t >= v.tFimCarga) return v.fimCarga.dentro === false ? ['CENTRAGEM FORA DOS LIMITES', '#ff5a4d'] : v.fimCarga.dentro === null ? ['NENHUMA MALA CARREGADA', '#ff5a4d'] : ['CARGA COMPLETA', '#3ddc84'];
    if (t >= v.tChega) return ['A CARREGAR', '#f2b705'];
    if (t >= v.tParte) return ['REBOQUES A CAMINHO', '#7fc4ff'];
    if (t >= v.tPlano) return ['PLANO DE CARGA PRONTO', '#7fc4ff'];
    return ['À ESPERA DO PLANO DE CARGA', '#9fb3c2'];
}

// ---------------------------------------------------------------------------
// Interface
const estilo = document.createElement('style');
estilo.textContent = `
.ramp-hall{position:absolute;inset:0;z-index:6;background:#cfd8de;display:none;container-type:size}
.ramp-hall.aberta{display:block}
.ramp-hall canvas{display:block;width:100%;height:100%}
.rp-topo{position:absolute;top:12px;left:14px;right:14px;display:flex;gap:10px;align-items:flex-start;justify-content:space-between;pointer-events:none;font:13px/1.35 system-ui,sans-serif}
.rp-coluna{display:flex;flex-direction:column;gap:8px;align-items:flex-start;min-width:0}
.rp-cartao{pointer-events:auto;background:#14273ae8;color:#e8eef2;border-radius:6px;padding:9px 12px;backdrop-filter:blur(8px)}
.rp-cartao b{font-size:12px;letter-spacing:1.5px;font-weight:650}
.rp-principal{max-width:500px}
.rp-contadores{display:grid;grid-template-columns:repeat(4,auto);gap:4px 16px;margin-top:6px;font-variant-numeric:tabular-nums}
.rp-contadores span{color:#9fb3c2;font-size:11px;display:block}
.rp-contadores .rp-mau{color:#ffb4a8}
.rp-ocorrencias{max-width:420px;max-height:118px;overflow:auto;font-size:12px}
.rp-ocorrencias li{margin-left:16px}
.rp-ficha{width:292px;font-size:12px;flex:none}
.rp-ficha h4{margin:0;font-size:14px;font-weight:650}
.rp-estado{display:inline-block;margin:5px 0 2px;padding:2px 7px;border-radius:3px;background:#0b1726;font-weight:650;font-size:11px;letter-spacing:.4px}
.rp-porao{display:grid;grid-template-columns:74px 1fr;gap:2px 8px;align-items:center;margin-top:5px;font-variant-numeric:tabular-nums}
.rp-barra{height:9px;background:#0b1726;border-radius:3px;overflow:hidden;position:relative}
.rp-barra i{position:absolute;inset:0 auto 0 0;background:#3ddc84;border-radius:3px}
.rp-barra u{position:absolute;top:0;bottom:0;width:2px;background:#e8eef2aa}
.rp-porao small{grid-column:2;color:#9fb3c2}
.rp-cg{margin-top:9px}
.rp-regua{position:relative;height:16px;margin:4px 0 2px;background:#5a2020;border-radius:3px}
.rp-regua .rp-verde{position:absolute;top:0;bottom:0;background:#1f7a48}
.rp-regua .rp-agulha{position:absolute;top:-3px;bottom:-3px;width:3px;margin-left:-1.5px;background:#fff;border-radius:2px;box-shadow:0 0 0 1px #0b1726}
.rp-regua .rp-previsto{position:absolute;top:2px;bottom:2px;width:2px;margin-left:-1px;background:#7fc4ff}
.rp-limites{display:flex;justify-content:space-between;color:#9fb3c2;font-size:11px}
.rp-ficha p{margin:6px 0 0}
.rp-nota{color:#9fb3c2}
.rp-controlos{position:absolute;left:14px;right:14px;bottom:14px;display:flex;gap:8px;align-items:center;background:#14273ae8;color:#e8eef2;border-radius:6px;padding:8px 10px;font:13px system-ui,sans-serif}
.rp-controlos input[type=range]{flex:1;min-width:60px}
.rp-controlos button,.rp-controlos select{background:#2d4b63;color:#fff;border:1px solid #ffffff33;border-radius:4px;padding:4px 9px;font:inherit;cursor:pointer}
.rp-controlos button{white-space:nowrap}
.rp-controlos button[hidden]{display:none}
.rp-controlos button.ativo{background:#e4572e;border-color:#ffffff66}
.rp-hora{font-variant-numeric:tabular-nums;min-width:44px;text-align:center;font-weight:650}
.rp-legenda{display:block;margin-top:4px}
.rp-legenda i{display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 4px 0 0;vertical-align:-1px}
.rp-legenda span{margin-right:10px;white-space:nowrap}
.rp-dica{font-size:11px;color:#9fb3c2;margin-top:6px;max-width:470px}
.rp-abrir{position:absolute;right:12px;bottom:146px;z-index:5;background:#14273ae8;color:#e8eef2;border:1px solid #ffffff33;border-radius:4px;padding:6px 11px;font:13px system-ui,sans-serif;cursor:pointer}
.rp-vazio[hidden],.rp-cartao[hidden]{display:none}
.rp-vazio{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);background:#14273ae8;color:#e8eef2;border-radius:6px;padding:8px 14px;font:13px system-ui,sans-serif;text-align:center;pointer-events:none;max-width:80%}
@container (max-width: 820px){
.rp-topo{top:8px;left:8px;right:8px;font-size:12px;gap:6px}
.rp-cartao{padding:6px 9px}
.rp-dica,.rp-ocorrencias,.rp-nota,.rp-principal .rp-legenda{display:none}
.rp-legenda span{margin-right:8px;font-size:11px}
.rp-contadores{grid-template-columns:repeat(4,auto);gap:2px 9px;margin-top:4px}
.rp-contadores span{font-size:10px}
.rp-ficha{width:204px;font-size:11px}
.rp-ficha h4{font-size:12px}
.rp-porao{grid-template-columns:58px 1fr;margin-top:3px}
.rp-porao small,.rp-limites{display:none}
.rp-ficha p{margin-top:3px}
.rp-controlos{left:8px;right:8px;bottom:8px;gap:5px;padding:6px 7px;font-size:12px;flex-wrap:wrap}
.rp-controlos button,.rp-controlos select{padding:3px 5px}
.rp-controlos select{max-width:96px}
.rp-longo{display:none}
}
@container (max-width: 560px){
.rp-ficha{width:176px}
}
`;
document.head.append(estilo);

const viewport = document.querySelector('.workspace-viewport') ?? document.getElementById('scene')?.parentElement ?? document.body;
const sala = document.createElement('div');
sala.className = 'ramp-hall';
sala.innerHTML = `
<div class="rp-topo">
  <div class="rp-coluna">
    <div class="rp-cartao rp-principal"><b>PLACA · CARREGAMENTO DOS AVIÕES</b><span class="rp-legenda" id="rp-legenda"></span><div class="rp-contadores" id="rp-contadores"></div><div class="rp-dica">A cinta de cada mala tem a cor do voo. Clica num avião para ver a sua ficha de carga; o botão Raio X deixa ver as malas arrumadas nos porões.</div></div>
    <div class="rp-cartao rp-ocorrencias" id="rp-ocorrencias" hidden></div>
  </div>
  <div class="rp-cartao rp-ficha" id="rp-ficha" hidden></div>
</div>
<div class="rp-vazio" id="rp-vazio">Executa um programa do carregamento (níveis 29 a 31) para ver aqui os reboques, os porões e a centragem.</div>
<div class="rp-controlos">
  <button id="rp-play" title="Reproduzir ou pausar">▶</button>
  <span class="rp-hora" id="rp-hora">--:--</span>
  <input type="range" id="rp-tempo" min="0" max="1" step="0.002" value="0" aria-label="Hora simulada">
  <select id="rp-velocidade" aria-label="Velocidade"><option value="0.1">0,1 min/s</option><option value="0.25">0,25 min/s</option><option value="0.5" selected>0,5 min/s</option><option value="1">1 min/s</option><option value="2">2 min/s</option><option value="4">4 min/s</option></select>
  <select id="rp-voo" aria-label="Voo"><option value="">Voo: automático</option></select>
  <select id="rp-vista" aria-label="Vista"><option value="geral">Vista geral</option><option value="aviao">Avião</option><option value="frente">Porão dianteiro</option><option value="tras">Porão traseiro</option><option value="corte">Corte dos porões</option><option value="triagem">Saída da triagem</option><option value="recuo">Saída do lugar</option></select>
  <button id="rp-raiox" title="Ver as malas dentro dos porões">Raio X</button>
  <button id="rp-triagem" title="Voltar à central de triagem" hidden>⬅<span class="rp-longo"> Triagem</span></button>
  <button id="rp-embarque" title="Ver os passageiros na porta de embarque" hidden>⬅<span class="rp-longo"> Embarque</span></button>
  <button id="rp-operacoes" title="Ver o relatório do dia no centro de operações" hidden>📊<span class="rp-longo"> Operações</span></button>
  <button id="rp-fechar" title="Voltar à maquete do aeroporto"><span class="rp-longo">Aeroporto </span>✕</button>
</div>`;
viewport.append(sala);
const botaoAbrir = document.createElement('button');
botaoAbrir.className = 'rp-abrir';
botaoAbrir.textContent = '✈ Placa';
viewport.append(botaoAbrir);
const $ = id => sala.querySelector('#' + id);
function hhmm(m) { m = Math.floor(m); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
const limpo = s => String(s).replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;');
const num = (v, casas = 1) => Number(v).toFixed(casas).replace('.', ',');

// ---------------------------------------------------------------------------
// Cena
let elenco = null;
let renderer = null, scene, camera, controls, modelo, marcador;
let dados = null, t = 0, fimVisual = 0, aReproduzir = false, ultimo = 0, ciclo = null, escolhido = '', atual = null, vistaAtual = 'geral', raioX = false;
let malhasMala = [];
const geoMalas = new Map(), poses = {};
const _a = {}, _b = {}, _u = {};

function construir() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
    sala.prepend(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#dfeaf0');
    camera = new THREE.PerspectiveCamera(42, 1, 0.3, 2400);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - 0.015; controls.minDistance = 2; controls.maxDistance = 420;
    modelo = construirPlaca(scene, renderer);
    melhorarCamara({ controls, camera, scene, sala, barra: sala.querySelector('.rp-controlos'), antesDe: sala.querySelector('#rp-fechar') });
    aplicarAcabamentos(scene, { excluir: [modelo.matPessoas, modelo.matMalas] });          // textura e relevo fino no mobiliário
    carregarElenco().then(e => { elenco = e; vestir(e, scene, modelo.matPessoas); });     // pessoas .glb, se existirem (opcional)
    marcador = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 4), new THREE.MeshBasicMaterial({ color: '#ffd400', toneMapped: false }));
    marcador.rotation.x = Math.PI; marcador.visible = false; scene.add(marcador);
    const raio = new THREE.Raycaster(), ponteiro = new THREE.Vector2();
    let inicioClique = null;
    renderer.domElement.addEventListener('pointerdown', e => { inicioClique = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', e => {
        if (!inicioClique || Math.hypot(e.clientX - inicioClique[0], e.clientY - inicioClique[1]) > 5 || !dados) return;
        const caixa = renderer.domElement.getBoundingClientRect();
        ponteiro.set((e.clientX - caixa.left) / caixa.width * 2 - 1, -(e.clientY - caixa.top) / caixa.height * 2 + 1);
        raio.setFromCamera(ponteiro, camera);
        const alvos = []; for (const lg of Object.values(modelo.lugares)) if (lg.aviao.visible) alvos.push(...lg.aviao.children.filter(c => c.userData.lugar));
        const lugar = raio.intersectObjects(alvos)[0]?.object.userData.lugar, v = lugar && dados.lista.find(x => x.visivel && x.lugar === lugar);
        if (v) selecionar(v.voo);
    });
    new ResizeObserver(ajustar).observe(sala);
    ajustar(); vista('geral'); desenhar();
}

function ajustar() {
    if (!renderer) return;
    const w = Math.max(1, renderer.domElement.clientWidth), h = Math.max(1, renderer.domElement.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

// As vistas que não são fixas medem-se a partir do eixo do lugar do voo escolhido.
const VISTAS = {
    geral: { pos: [0, 98, 138], alvo: [0, 0, 31], fixa: true }, aviao: { pos: [42, 17, 66], alvo: [2, 2.6, 35] },
    frente: { pos: [15.5, 4.6, 20.6], alvo: [3.2, 2.2, 27.4] }, tras: { pos: [16.5, 4.8, 50.5], alvo: [3.2, 2.2, 42.6] },
    corte: { pos: [31, 3.1, 36.6], alvo: [0, 2.9, 36.6], raioX: true }, triagem: { pos: [-12, 8, 31], alvo: [2, 1.6, 2], fixa: true }, recuo: { pos: [58, 30, 122], alvo: [-8, 2, 62] },
};
export function vista(nome) {
    if (!camera) return;
    const v = Array.isArray(nome) ? { pos: nome[0], alvo: nome[1], fixa: true } : VISTAS[nome] ?? null;
    if (!v) return;
    const xc = v.fixa ? 0 : atual?.xc ?? P.LUGARES.P22, f = nome === 'geral' ? Math.max(1, 1.7 / camera.aspect) : 1;       // num visor estreito, a vista geral recua
    controls.target.set(v.alvo[0] + xc, v.alvo[1], v.alvo[2]); camera.position.set(v.pos[0] + xc, v.pos[1], v.pos[2]).sub(controls.target).multiplyScalar(f).add(controls.target); controls.update();
    if (!Array.isArray(nome)) { vistaAtual = nome; $('rp-vista').value = nome; if (v.raioX) verRaioX(true); }
}
export function verRaioX(ligado) {
    raioX = !!ligado;
    if (modelo) { for (const [m, o] of [[modelo.matPele, 0.13], [modelo.matPartes, 0.22]]) { Object.assign(m, { transparent: raioX, opacity: raioX ? o : 1, depthWrite: !raioX }); m.needsUpdate = true; } for (const f of modelo.forros) f.visible = !raioX; }
    $('rp-raiox').classList.toggle('ativo', raioX);
}
export function selecionar(voo) {
    escolhido = voo && dados?.voos[voo] ? voo : '';
    $('rp-voo').value = escolhido;
    $('rp-ficha').dataset.chave = '';
}
// Sem escolha do utilizador, a ficha acompanha o primeiro voo que ainda está no lugar.
function vooAtual() {
    if (!dados) return null;
    if (escolhido) return dados.voos[escolhido];
    return dados.lista.find(v => v.visivel && t < v.tPartida + T_RECUO + 1.2) ?? dados.lista.filter(v => v.visivel).at(-1) ?? dados.lista[0] ?? null;
}

function geoMala(tipo, cor) { const chave = cor + tipo; if (!geoMalas.has(chave)) geoMalas.set(chave, geometriaMala(tipo, cor)); return geoMalas.get(chave); }

function carregar(registo) {
    for (const o of malhasMala) scene.remove(o);
    malhasMala = [];
    dados = prepararPlaca(registo);
    for (const m of dados.malas) {
        const malha = new THREE.Mesh(geoMala(Math.floor(acaso(m.i, 14) * 24), m.v?.cor ?? '#8a8f96'), modelo.matMalas);
        malha.castShadow = true; malha.visible = false; scene.add(malha); malhasMala.push(malha);
    }
    for (const lg of Object.values(modelo.lugares)) { lg.voo = dados.lista.find(v => v.visivel && v.lugar === lg.codigo) ?? null; lg.deriva.color.set(lg.voo?.cor ?? '#16365f'); lg.quadro.chave = ''; }
    $('rp-vazio').hidden = true;
    $('rp-legenda').innerHTML = dados.lista.map(v => `<span><i style="background:${v.cor}"></i>${limpo(v.voo)} ${limpo(v.destino)} · ${hhmm(v.hora)} · ${limpo(v.lugar)}</span>`).join('');
    $('rp-voo').innerHTML = '<option value="">Voo: automático</option>' + dados.lista.map(v => `<option value="${limpo(v.voo)}">${limpo(v.voo)} · ${limpo(v.lugar)}</option>`).join('');
    escolhido = ''; atual = null;
    const partidas = dados.lista.map(v => v.tPartida).filter(Number.isFinite);
    fimVisual = Math.max(dados.fim, ...partidas.map(p => p + T_RECUO + T_PAUSA + 1.6));
    const primeiro = Math.min(...dados.lista.map(v => v.tPlano), dados.fim);
    $('rp-tempo').min = dados.inicio; $('rp-tempo').max = fimVisual;
    $('rp-ocorrencias').dataset.n = ''; $('rp-ficha').dataset.chave = '';
    t = Math.max(dados.inicio, primeiro - 0.6); aReproduzir = true;
    vista('geral');
}

// --- Quadro de informação do lugar (na fachada) --------------------------------------------
function texto(g, s, x, y, tam, cor, peso = 600, alinhar = 'left', larguraMax = 0) {
    g.fillStyle = cor; g.textAlign = alinhar; g.textBaseline = 'middle'; g.font = `${peso} ${tam}px Arial, sans-serif`;
    if (larguraMax) { const w = g.measureText(s).width; if (w > larguraMax) g.font = `${peso} ${tam * larguraMax / w}px Arial, sans-serif`; }
    g.fillText(s, x, y);
}
function desenharQuadro(lg, v, c) {
    const est = v ? estadoVoo(v, t) : null, chave = v ? [est[0], dados.poroes.map(p => Math.round(c.pesos[p])).join(','), c.cg.toFixed(2), t >= v.tPlano].join('|') : '-';
    if (lg.quadro.chave === chave) return;
    lg.quadro.chave = chave;
    const g = lg.quadro.canvas.getContext('2d'), W = 1024, H = 400;
    g.fillStyle = '#081320'; g.fillRect(0, 0, W, H);
    g.fillStyle = v ? v.cor : '#3a4350'; g.fillRect(0, 0, W, 96);
    texto(g, lg.codigo, 28, 50, 70, '#ffffff', 800);
    if (!v) { texto(g, 'SEM VOO ATRIBUÍDO', W / 2, 240, 60, '#51667a', 700, 'center'); lg.quadro.tex.needsUpdate = true; return; }
    texto(g, `${v.voo}  ${String(v.destino).toUpperCase()}`, 190, 50, 62, '#ffffff', 700, 'left', 600); texto(g, hhmm(v.hora), W - 28, 50, 70, '#ffffff', 800, 'right');
    texto(g, est[0], 28, 142, 46, est[1], 700, 'left', W - 56);
    dados.poroes.forEach((p, k) => {
        const y = 200 + k * 46, livre = v.aviao.poroes[p].livre, f = Math.min(1, c.pesos[p] / livre);
        texto(g, p, 28, y, 30, '#cfe1f5', 600); g.fillStyle = '#16283b'; g.fillRect(230, y - 13, 470, 26); g.fillStyle = f > 0.999 ? '#f2b705' : '#3ddc84'; g.fillRect(230, y - 13, 470 * f, 26);
        texto(g, `${Math.round(c.pesos[p])} / ${livre} kg`, W - 28, y, 30, '#ffffff', 600, 'right');
    });
    const y = 356, x0 = 230, x1 = 700, a = v.aviao.limite_frente - 0.25, b = v.aviao.limite_tras + 0.25, px = cg => x0 + (x1 - x0) * Math.max(0, Math.min(1, (cg - a) / (b - a)));
    texto(g, 'CENTRAGEM', 28, y, 30, '#cfe1f5', 600); g.fillStyle = '#5a2020'; g.fillRect(x0, y - 13, x1 - x0, 26); g.fillStyle = '#1f7a48'; g.fillRect(px(v.aviao.limite_frente), y - 13, px(v.aviao.limite_tras) - px(v.aviao.limite_frente), 26);
    g.fillStyle = '#ffffff'; g.fillRect(px(c.cg) - 4, y - 20, 8, 40);
    texto(g, `${num(c.cg, 2)} m`, W - 28, y, 30, c.dentro ? '#3ddc84' : '#ff5a4d', 700, 'right');
    lg.quadro.tex.needsUpdate = true;
}

// --- Movimento: avião, portas, manga, tapetes e comboios -----------------------------------
function poseAviao(v, lg, o) {
    const tau = t - v.tPartida;
    o.v = true; o.x = v.xc; o.z = P.Z_NARIZ; o.ry = 0; o.fase = tau < 0 ? 0 : tau < T_RECUO + T_PAUSA ? 1 : 2;
    if (tau <= 0) return o;
    const cam = lg.recuo, comp = cam.comp - 16;
    cam.em(comp * suave(tau / T_RECUO), _a);
    let gx = _a.x; const ry = Math.atan2(_a.tx, _a.tz);
    if (tau > T_RECUO + T_PAUSA) { const k = tau - T_RECUO - T_PAUSA; gx += V_TAXI * (k - 0.2 * (1 - Math.exp(-k / 0.2))); if (gx > 300) { o.v = false; return o; } }
    o.x = gx - A.S_TREM * Math.sin(ry); o.z = _a.z - A.S_TREM * Math.cos(ry); o.ry = ry;
    return o;
}
function distanciaComboio(v, lg, nome) {
    const fim = lg.rota.paragem[nome];
    if (t <= v.tChega) return fim - P.V_REBOQUE * (v.tChega - t);
    return t < v.tSaida ? fim : fim + P.V_REBOQUE * (t - v.tSaida);
}
function moverLugar(lg) {
    const v = lg.voo, pose = poses[lg.codigo] ??= { aviao: {}, frente: [{}, {}, {}], tras: [{}, {}, {}], ativo: {} };
    pose.ativo.frente = pose.ativo.tras = 0;
    if (!v) {
        lg.aviao.visible = true; lg.aviao.position.set(lg.xc, 0, P.Z_NARIZ); lg.aviao.rotation.y = 0; lg.trator.visible = false; lg.manga.position.z = 0;
        for (const p of Object.values(lg.portas)) p.rotation.z = 0;
        for (const tp of Object.values(lg.tapetes)) { tp.grupo.position.x = lg.xc + RECUO_TAPETE; tp.lanca.rotation.z = -0.03; tp.equipa.visible = false; }
        for (const c of Object.values(lg.comboios)) for (const u of c) u.visible = false;
        return;
    }
    const a = poseAviao(v, lg, pose.aviao);
    lg.aviao.visible = a.v; lg.aviao.position.set(a.x, 0, a.z); lg.aviao.rotation.y = a.ry;
    lg.trator.visible = t >= v.tPartida - 1.5 && t < v.tPartida + T_RECUO + T_PAUSA - 0.1;
    lg.manga.position.z = -RECUO_MANGA * rampa(t, v.tPartida - 2.2, v.tPartida - 1.3);
    const porta = PORTA_ABERTA * (rampa(t, v.tChega - 2.3, v.tChega - 1.7) - rampa(t, v.tSaida + 1.2, v.tSaida + 1.8));
    for (const p of Object.values(lg.portas)) p.rotation.z = porta;
    const recolhido = 1 - rampa(t, v.tChega - 1.6, v.tChega - 0.8) + rampa(t, v.tSaida + 0.5, v.tSaida + 1.2);
    for (const tp of Object.values(lg.tapetes)) { tp.grupo.position.x = lg.xc + RECUO_TAPETE * recolhido; tp.lanca.rotation.z = -mistura(P.INCLINACAO, 0.03, recolhido); tp.equipa.visible = recolhido < 0.5; }
    for (const nome of ['frente', 'tras']) {
        const d = distanciaComboio(v, lg, nome);
        lg.comboios[nome].forEach((u, k) => {
            const dk = d - (k ? P.RECUOS[k - 1] : 0), o = pose[nome][k];
            lg.rota.cam.em(dk, _a); o.x = _a.x; o.z = _a.z; o.ry = Math.atan2(_a.tx, _a.tz); o.v = dk > 1 && dk < lg.rota.cam.comp - 1;
            u.visible = o.v; u.position.set(o.x, 0, o.z); u.rotation.y = o.ry;
        });
    }
}

// Ponto do tapete a q metros do pé (o tapete sobe em direção à porta de carga).
function noTapete(v, tp, q, o) { o.x = v.xc + P.PE_TAPETE - q * Math.cos(P.INCLINACAO); o.y = P.Y_PE + q * Math.sin(P.INCLINACAO) + 0.03; o.z = tp.z; return o; }
function noReboque(m, pose, o) {
    const u = pose[m.tapete][1 + m.reboque]; lugarNoReboque(m.jr, m.nr, _u);
    const c = Math.cos(u.ry), s = Math.sin(u.ry);
    o.x = u.x + _u.x * c + _u.z * s; o.y = _u.y; o.z = u.z - _u.x * s + _u.z * c; o.ry = u.ry; o.v = u.v; return o;
}
function colocarMala(m, malha) {
    const v = m.v, est = estadoMala(m, t);
    if (!v || !v.visivel || est === 'na_saida' || m.tapete === null) return false;
    const lg = modelo.lugares[v.lugar], pose = poses[v.lugar], tp = lg.tapetes[m.tapete], L = malha.geometry.userData.L;
    if (est === 'em_reboque' || est === 'em_terra' || est === 'retirada') {
        noReboque(m, pose, _a); if (!_a.v) return false;
        malha.position.set(_a.x, _a.y, _a.z); malha.rotation.set(0, _a.ry, 0); return true;
    }
    if (est === 'carregada') {
        const a = pose.aviao; if (!a.v) return false;
        lugarNoPorao(m.porao, m.posicao, _u);
        const c = Math.cos(a.ry), s = Math.sin(a.ry);
        malha.position.set(a.x + _u.x * c + _u.s * s, _u.y, a.z - _u.x * s + _u.s * c); malha.rotation.set(0, a.ry + Math.PI / 2, 0); return true;
    }
    // em movimento entre o reboque e o porão: k vai de 0 (reboque) a 1 (arrumada)
    const k = est === 'a_carregar' ? (t - m.carga) / T_CARGA : 1 - (t - m.descarga) / T_DESCARGA;
    pose.ativo[m.tapete] = est === 'a_carregar' ? 1 : -1;
    const zPorta = tp.z, yPorta = A.POROES[A.POROES[m.porao].porta].chao + 0.02;
    if (k < 0.18) {                               // do reboque para o pé do tapete, pela mão do operador
        noReboque(m, pose, _a); noTapete(v, tp, 0.45, _b);
        const e = suave(k / 0.18);
        malha.position.set(mistura(_a.x, _b.x, e), mistura(_a.y, _b.y, e) + Math.sin(e * Math.PI) * 0.35, mistura(_a.z, _b.z, e)); malha.rotation.set(0, mistura(_a.ry, 0, e), -P.INCLINACAO * e);
    } else if (k < 0.62) {                        // a subir no tapete
        noTapete(v, tp, mistura(0.45, P.COMP_TAPETE - 0.25, (k - 0.18) / 0.44), _b);
        malha.position.set(_b.x, _b.y, _b.z); malha.rotation.set(0, 0, -P.INCLINACAO);
    } else {                                      // da soleira para o seu lugar no porão
        noTapete(v, tp, P.COMP_TAPETE - 0.25, _b); lugarNoPorao(m.porao, m.posicao, _u);
        const dentro = v.xc + 0.25;
        if (k < 0.74) { const e = (k - 0.62) / 0.12; malha.position.set(mistura(_b.x, dentro, e), mistura(_b.y, yPorta, e), zPorta); malha.rotation.set(0, 0, -P.INCLINACAO * (1 - e)); }
        else { const e = suave((k - 0.74) / 0.26); malha.position.set(mistura(dentro, v.xc + _u.x, e), mistura(yPorta, _u.y, e) + Math.sin(e * Math.PI) * 0.06, mistura(zPorta, P.Z_NARIZ + _u.s, e)); malha.rotation.set(0, Math.PI / 2 * suave(e * 2), 0); }
    }
    void L;
    return true;
}

function desenharFicha(v, c) {
    const est = estadoVoo(v, t), n = { total: v.malas.length, dentro: 0, terra: 0, fora: 0 };
    for (const m of v.malas) { const e = estadoMala(m, t); if (e === 'carregada') n.dentro++; else if (e === 'em_terra') n.terra++; else if (e === 'retirada' || e === 'a_retirar') n.fora++; }
    const fase = t >= v.tPartida ? 5 : t >= v.tFecho ? 4 : t >= v.tEmbarque ? 3 : t >= v.tFimCarga ? 2 : t >= v.tPlano ? 1 : 0;
    const chave = [v.voo, est[0], dados.poroes.map(p => c.pesos[p].toFixed(1)).join(','), n.dentro, n.terra, n.fora, fase].join('|');
    if ($('rp-ficha').dataset.chave === chave) return;
    $('rp-ficha').dataset.chave = chave; $('rp-ficha').hidden = false;
    const av = v.aviao, a = av.limite_frente - 0.25, b = av.limite_tras + 0.25, pc = cg => (Math.max(0, Math.min(1, (cg - a) / (b - a))) * 100).toFixed(1);
    const poroes = dados.poroes.map(p => {
        const livre = av.poroes[p].livre, previsto = fase >= 1 ? v.plano.pesos[p] : null;
        return `<div>${p[0] + p.slice(1).toLowerCase()}</div><div class="rp-barra"><i style="width:${Math.min(100, c.pesos[p] / livre * 100).toFixed(1)}%"></i>${previsto !== null ? `<u style="left:${Math.min(99, previsto / livre * 100).toFixed(1)}%"${previsto > livre + 1e-9 ? ' title="O plano pede mais do que cabe"' : ''}></u>` : ''}</div>` +
            `<small>${num(c.pesos[p])} de ${livre} kg livres${previsto !== null ? ` · plano ${num(previsto)}${previsto > livre + 1e-9 ? ' ⚠' : ''}` : ''}</small>`;
    }).join('');
    const linhas = [`Malas: <strong>${n.dentro}</strong> de ${n.total} nos porões` + (n.terra ? ` · <span style="color:#ffb4a8">${n.terra} em terra</span>` : '') + (n.fora ? ` · ${n.fora} ${n.fora === 1 ? 'retirada' : 'retiradas'}` : '')];
    if (fase >= 3) linhas.push(`Embarque: ${v.embarque.embarcados} de ${v.passageiros} passageiros` + (v.embarque.faltas.length ? ` · ${v.embarque.faltas.length} ${v.embarque.faltas.length === 1 ? 'falta' : 'faltas'}` : ''));
    if (fase >= 4 && v.fecho.atraso) linhas.push(`<span style="color:#ffb020">Atraso: ${v.fecho.atraso} minutos · sai às ${hhmm(v.fecho.partida)}</span>`);
    $('rp-ficha').innerHTML = `<b>FICHA DE CARGA</b><h4><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${v.cor};margin-right:6px"></i>${limpo(v.voo)} · ${limpo(v.destino)} · ${hhmm(v.hora)}</h4>` +
        `<div class="rp-nota">Lugar ${limpo(v.lugar)} · ${limpo(av.tipo)}</div><span class="rp-estado" style="color:${est[1]}">${limpo(est[0])}</span>` +
        `<div class="rp-porao">${poroes}</div>` +
        `<div class="rp-cg">Centragem: <strong style="color:${c.dentro ? '#3ddc84' : '#ff5a4d'}">${num(c.cg, 2)} m</strong> · ${num(c.corda)} % da corda` +
        `<div class="rp-regua"><div class="rp-verde" style="left:${pc(av.limite_frente)}%;width:${(pc(av.limite_tras) - pc(av.limite_frente)).toFixed(1)}%"></div>${fase >= 1 ? `<div class="rp-previsto" style="left:${pc(v.plano.cg)}%" title="Centragem prevista pelo plano"></div>` : ''}<div class="rp-agulha" style="left:${pc(c.cg)}%"></div></div>` +
        `<div class="rp-limites"><span>◀ nariz · ${num(av.limite_frente, 2)}</span><span>${num(av.limite_tras, 2)} · cauda ▶</span></div></div>` +
        linhas.map(x => `<p>${x}</p>`).join('');
}

function desenhar() {
    for (const lg of Object.values(modelo.lugares)) moverLugar(lg);
    const novo = vooAtual();
    if (novo !== atual) {                         // a câmara acompanha o voo quando a vista é relativa ao lugar
        if (atual && novo && novo.visivel && !VISTAS[vistaAtual]?.fixa) { const dx = novo.xc - atual.xc; camera.position.x += dx; controls.target.x += dx; }
        atual = novo; $('rp-ficha').dataset.chave = '';
    }
    for (const lg of Object.values(modelo.lugares)) {
        const v = lg.voo, c = v ? centragem(dados, v, t) : null;
        desenharQuadro(lg, v, c);
        if (v && v === atual) desenharFicha(v, c);
    }
    if (!dados) { marcador.visible = false; return; }
    if (atual && !atual.visivel) desenharFicha(atual, centragem(dados, atual, t));
    dados.malas.forEach((m, i) => { malhasMala[i].visible = colocarMala(m, malhasMala[i]); });
    for (const lg of Object.values(modelo.lugares)) { const p = poses[lg.codigo]; for (const nome of ['frente', 'tras']) if (p.ativo[nome]) lg.tapetes[nome].lona.offset.y = (p.ativo[nome] * t * 14) % 1; }
    const pa = atual?.visivel ? poses[atual.lugar].aviao : null;
    marcador.visible = !!pa?.v && camera.position.distanceTo(controls.target) > 60;
    if (marcador.visible) { const c = Math.cos(pa.ry), s = Math.sin(pa.ry); marcador.position.set(pa.x + 17 * s, 9.6 + Math.sin(performance.now() / 320) * 0.35, pa.z + 17 * c); marcador.rotation.y = performance.now() / 900; }
    const n = contar(dados, t);
    const quadro = [['Na triagem', n.na_saida], ['Nos reboques', n.em_reboque], ['Nos tapetes', n.a_carregar + n.a_retirar], ['Nos porões', n.carregada], ['Retiradas', n.retirada], ['Em terra', n.em_terra, n.em_terra], ['Voos fechados', `${n.fechados} de ${dados.lista.length}`], ['Atraso total', `${n.atraso} min`, n.atraso]]
        .map(([r, x, mau]) => `<div${mau ? ' class="rp-mau"' : ''}><span>${r}</span>${x}</div>`).join('');
    if ($('rp-contadores').dataset.chave !== quadro) { $('rp-contadores').dataset.chave = quadro; $('rp-contadores').innerHTML = quadro; }
    const lista = dados.ocorrencias.filter(o => o.minuto <= t);                  // só o que já aconteceu, com o mais recente em cima
    if ($('rp-ocorrencias').dataset.n !== String(lista.length)) {
        $('rp-ocorrencias').dataset.n = lista.length; $('rp-ocorrencias').hidden = !lista.length;
        $('rp-ocorrencias').innerHTML = `<b>OCORRÊNCIAS · ${lista.length}</b><ul>` + lista.slice(-30).reverse().map(o => `<li>${hhmm(o.minuto)} · ${limpo(o.texto)}</li>`).join('') + (lista.length > 30 ? `<li>… e mais ${lista.length - 30} antes</li>` : '') + '</ul>';
    }
    const hora = hhmm(Math.min(t, fimVisual)); if ($('rp-hora').textContent !== hora) $('rp-hora').textContent = hora;
    $('rp-tempo').value = t;
}

function animar(agora) {
    ciclo = requestAnimationFrame(animar);
    const dt = Math.min(0.25, (agora - (ultimo || agora)) / 1000); ultimo = agora;
    if (dados && aReproduzir) {
        t = Math.min(fimVisual, t + dt * Number($('rp-velocidade').value));
        if (t >= fimVisual) aReproduzir = false;
    }
    $('rp-play').textContent = aReproduzir ? 'Ⅱ' : '▶';
    $('rp-triagem').hidden = !(dados?.origem === 'triagem' && window.sortingHall?.dados?.());
    $('rp-embarque').hidden = !(dados?.origem === 'triagem' && window.boardingHall?.dados?.());
    $('rp-operacoes').hidden = !window.opsHall?.dados?.();
    controls.update();
    desenhar();
    renderer.render(scene, camera);
}

export function abrir() {
    if (!renderer) construir();
    window.dispatchEvent(new CustomEvent('hall-open', { detail: 'ramp' }));
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
$('rp-fechar').onclick = fechar;
$('rp-play').onclick = () => { if (!dados) return; if (t >= fimVisual) t = dados.inicio; aReproduzir = !aReproduzir; };
$('rp-tempo').oninput = e => { t = Number(e.target.value); aReproduzir = false; };
$('rp-vista').onchange = e => vista(e.target.value);
$('rp-voo').onchange = e => { selecionar(e.target.value); };
$('rp-raiox').onclick = () => verRaioX(!raioX);
$('rp-triagem').onclick = () => window.sortingHall?.abrir();
$('rp-embarque').onclick = () => window.boardingHall?.abrir();
$('rp-operacoes').onclick = () => window.opsHall?.abrir();

window.addEventListener('loading-run', e => { abrir(); carregar(e.detail); });
window.addEventListener('hall-open', e => { if (e.detail !== 'ramp' && sala.classList.contains('aberta')) fechar(); });
window.rampHall = { abrir, fechar, vista, selecionar, raioX: verRaioX, tempo: () => t, info: () => renderer && { ...renderer.info.render, geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures }, dados: () => dados };
