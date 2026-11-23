// Bloco 4 · Relatório do dia, Fase 6: centro de operações em 3D.
// Não simula nada: mostra o registo devolvido pelo motor Python (relatorio.py). A parede de
// ecrãs e a mesa do dia reproduzem a manhã minuto a minuto, a partir das curvas acumuladas do
// registo, e o painel da direita mostra o relatório que o programa do aluno entregou, com a
// indicação dos indicadores que conferem com os dados do dia.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { melhorarCamara } from './camara-salas.js?v=camara-1';
import { C, construirCentro } from './ops-hall-model.js?v=operacoes-claro-2';

const CORES_VOO = ['#e4572e', '#2e86de', '#f2b705', '#3fa34d', '#9b5de5'];
const ZONAS = [['checkin', 'Check-in'], ['triagem', 'Triagem'], ['embarque', 'Embarque'], ['placa', 'Placa'], ['relatorio', 'Relatório']];
const ABERTURA = 40, FECHO = 15;                    // a porta abre 40 minutos antes da partida e fecha 15 minutos antes
const hhmm = m => { m = Math.floor(m); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const pt = (n, casas = 1) => Number(n).toLocaleString('pt-PT', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const limpo = s => String(s).replace(/[<&"]/g, c => c === '<' ? '&lt;' : c === '"' ? '&quot;' : '&amp;');

// ---------------------------------------------------------------------------
// Leitura do registo (funções puras)
export function prepararDia(reg) {
    const voos = reg.voos.map((v, i) => ({ ...v, cor: CORES_VOO[i % CORES_VOO.length], curvas: reg.curvas.voos[v.voo] }));
    const maximo = Math.max(1, ...voos.flatMap(v => C.SERIES.map(s => Math.max(...v.curvas[s]))));
    const total = Object.fromEntries(C.SERIES.map(s => [s, reg.curvas.voos[voos[0].voo][s].map((_, k) => voos.reduce((a, v) => a + v.curvas[s][k], 0))]));
    return { inicio: reg.curvas.inicio, fim: reg.curvas.fim, voos, total, maximo, maximoTotal: Math.max(1, ...C.SERIES.map(s => Math.max(...total[s]))),
        ocorrencias: reg.ocorrencias, indicadores: reg.indicadores, entregue: reg.entregue, passageiros: reg.passageiros, malas: reg.malas, esperas: reg.esperas, resumo: reg.resumo };
}
// Valor de uma curva num instante com frações de minuto (interpolação linear entre os dois minutos vizinhos).
export function valor(dados, serie, t) {
    const k = Math.max(0, Math.min(serie.length - 1, t - dados.inicio)), a = Math.floor(k), b = Math.min(serie.length - 1, a + 1);
    return serie[a] + (serie[b] - serie[a]) * (k - a);
}
export function estadoDoVoo(v, t) {
    if (v.partida !== null && t >= v.partida) return { texto: 'PARTIU ' + hhmm(v.partida) + (v.atraso ? ` (+${v.atraso})` : ''), cor: v.atraso ? '#ff8a7a' : '#3ddc84', fase: 'partiu' };
    if (t >= v.hora) return { texto: 'ATRASADO', cor: '#ff6b5a', fase: 'atrasado' };
    if (t >= v.hora - FECHO) return { texto: 'PORTA FECHADA', cor: '#f2b705', fase: 'fechada' };
    if (t >= v.hora - ABERTURA) return { texto: 'EMBARQUE', cor: '#3d9be9', fase: 'embarque' };
    return { texto: 'CHECK-IN', cor: '#9fb3c2', fase: 'checkin' };
}
// Texto de um indicador entregue, tal como aparece no painel; aceita qualquer valor que o programa tenha mandado.
export function textoIndicador(chave, v) {
    try {
        if (v === null || v === undefined) return '—';
        if (chave === 'pontualidade' && typeof v === 'number') return pt(v, Number.isInteger(v) ? 0 : 1) + ' % dos voos saíram à hora';
        if (chave === 'taxa_embarque' && typeof v === 'number') return pt(v, 1) + ' % dos aceites embarcaram';
        if (chave === 'atrasados' && Array.isArray(v)) return v.length ? v.join(', ') : 'nenhum';
        if (chave === 'faltas' && typeof v === 'object' && !Array.isArray(v)) return Object.entries(v).map(([k, n]) => `${k}: ${n}`).join('   ') || 'sem voos';
        if (chave === 'peso' && typeof v === 'object' && !Array.isArray(v)) return Object.entries(v).map(([k, n]) => `${k}: ${typeof n === 'number' ? pt(n, 1) + ' kg' : n}`).join('   ') || 'sem voos';
        if (chave === 'esperas' && Array.isArray(v)) return v.map(x => Array.isArray(x) ? `${x[0]} ${x[1]} min` : String(x)).join('   ') || 'ninguém';
        return typeof v === 'string' ? v : JSON.stringify(v);
    } catch { return String(v); }
}

// ---------------------------------------------------------------------------
// Interface
const estilo = document.createElement('style');
estilo.textContent = `
.ops-hall{position:absolute;inset:0;z-index:6;background:#0b1118;display:none;container-type:size}
.ops-hall.aberta{display:block}
.ops-hall canvas{display:block;width:100%;height:100%}
.op-topo{position:absolute;top:12px;left:14px;right:14px;display:flex;gap:10px;align-items:flex-start;justify-content:space-between;pointer-events:none;font:13px/1.35 system-ui,sans-serif}
.op-cartao{pointer-events:auto;background:#14273ae8;color:#e8eef2;border-radius:6px;padding:9px 12px;backdrop-filter:blur(8px)}
.op-cartao b{font-size:12px;letter-spacing:1.5px;font-weight:650}
.op-topo .op-principal{max-width:520px}
.op-contadores{display:grid;grid-template-columns:repeat(3,auto);gap:4px 16px;margin-top:6px;font-variant-numeric:tabular-nums}
.op-contadores span{color:#9fb3c2;font-size:11px;display:block}
.op-contadores .op-mau{color:#ffb4a8}
.op-relatorio{max-width:360px;font-size:12px}
.op-relatorio ul{list-style:none;margin:6px 0 0;padding:0}
.op-relatorio li{display:grid;grid-template-columns:18px 1fr;gap:2px 6px;margin-top:4px}
.op-relatorio li span{color:#9fb3c2;grid-column:2;overflow-wrap:anywhere}
.op-sim{color:#3ddc84}.op-nao{color:#ff8a7a}.op-falta{color:#7f93a5}
.op-controlos{position:absolute;left:14px;right:14px;bottom:14px;display:flex;gap:8px;align-items:center;background:#14273ae8;color:#e8eef2;border-radius:6px;padding:8px 10px;font:13px system-ui,sans-serif}
.op-controlos input[type=range]{flex:1;min-width:60px}
.op-controlos button,.op-controlos select{background:#2d4b63;color:#fff;border:1px solid #ffffff33;border-radius:4px;padding:4px 9px;font:inherit;cursor:pointer}
.op-controlos button{white-space:nowrap}
.op-controlos select[hidden]{display:none}
.op-hora{font-variant-numeric:tabular-nums;min-width:44px;text-align:center;font-weight:650}
.op-legenda{display:block;margin-top:4px}
.op-legenda i{display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 4px 0 0;vertical-align:-1px}
.op-legenda span{margin-right:10px;white-space:nowrap}
.op-dica{font-size:11px;color:#9fb3c2;margin-top:6px;max-width:480px}
.op-abrir{position:absolute;right:12px;bottom:222px;z-index:5;background:#14273ae8;color:#e8eef2;border:1px solid #ffffff33;border-radius:4px;padding:6px 11px;font:13px system-ui,sans-serif;cursor:pointer}
.op-vazio[hidden]{display:none}
.op-vazio{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);background:#14273ae8;color:#e8eef2;border-radius:6px;padding:8px 14px;font:13px system-ui,sans-serif;text-align:center;pointer-events:none;max-width:80%}
@container (max-width: 820px){
.op-topo{top:8px;left:8px;right:8px;font-size:12px;gap:6px}
.op-cartao{padding:6px 9px}
.op-dica,.op-legenda{display:none}
.op-contadores{grid-template-columns:repeat(3,auto);gap:1px 9px;margin-top:3px}
.op-cartao b{font-size:10px;letter-spacing:.6px}
.op-contadores span{font-size:10px}
.op-relatorio{font-size:0;white-space:nowrap}
.op-relatorio b{font-size:10px;letter-spacing:.6px}
.op-relatorio ul{margin-top:2px}
.op-relatorio li{display:inline-block;margin:0 5px 0 0;font-size:0}
.op-relatorio li i{font-size:14px}
.op-controlos{left:8px;right:8px;bottom:8px;gap:5px;padding:6px 7px;font-size:12px}
.op-controlos button,.op-controlos select{padding:3px 5px}
.op-controlos select{max-width:104px}
.op-longo{display:none}
}
`;
document.head.append(estilo);

const viewport = document.querySelector('.workspace-viewport') ?? document.getElementById('scene')?.parentElement ?? document.body;
const sala = document.createElement('div');
sala.className = 'ops-hall';
sala.innerHTML = `
<div class="op-topo">
  <div class="op-cartao op-principal"><b>CENTRO DE OPERAÇÕES · RELATÓRIO DO DIA</b><span class="op-legenda" id="op-legenda"></span><div class="op-contadores" id="op-contadores"></div></div>
  <div class="op-cartao op-relatorio" id="op-relatorio"></div>
</div>
<div class="op-vazio" id="op-vazio">Executa um programa do relatório (níveis 35 a 37) para ver aqui o dia de operação.</div>
<div class="op-controlos">
  <button id="op-play" title="Reproduzir ou pausar">▶</button>
  <span class="op-hora" id="op-hora">--:--</span>
  <input type="range" id="op-tempo" min="0" max="1" step="0.01" value="0" aria-label="Hora simulada">
  <select id="op-velocidade" aria-label="Velocidade"><option value="1">1 min/s</option><option value="2">2 min/s</option><option value="4">4 min/s</option><option value="8" selected>8 min/s</option><option value="16">16 min/s</option></select>
  <select id="op-vista" aria-label="Vista"><option value="geral">Vista geral</option><option value="parede">Parede de ecrãs</option><option value="numeros">O dia em números</option><option value="curvas">A manhã, minuto a minuto</option><option value="relatorio">Relatório entregue</option><option value="mesa">Mesa do dia</option><option value="consolas">Consolas</option></select>
  <select id="op-ir" aria-label="Ir para outra cena" hidden></select>
  <button id="op-fechar" title="Voltar à maquete do aeroporto"><span class="op-longo">Aeroporto </span>✕</button>
</div>`;
viewport.append(sala);
const botaoAbrir = document.createElement('button');
botaoAbrir.className = 'op-abrir';
botaoAbrir.textContent = '📊 Operações';
viewport.append(botaoAbrir);
const $ = id => sala.querySelector('#' + id);

// ---------------------------------------------------------------------------
// Cena
let renderer = null, scene, camera, controls, modelo, pessoasGlb = null;
let dados = null, t = 0, aReproduzir = false, ultimo = 0, ciclo = null;

function construir() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    sala.prepend(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1118');
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.minDistance = 0.8; controls.maxDistance = 60;
    modelo = construirCentro(scene, renderer);
    melhorarCamara({ controls, camera, scene, sala, barra: sala.querySelector('.op-controlos'), antesDe: sala.querySelector('#op-fechar') });
    import('./ops-hall-pessoas.js?v=pessoas-1').then(m => m.carregarPessoas(scene, modelo)).then(r => { pessoasGlb = r; }).catch(e => console.warn('Operações: modelos .glb não carregados', e));   // opcional
    new ResizeObserver(ajustar).observe(sala);
    ajustar(); vista('geral'); pintarTudo();
}

function ajustar() {
    if (!renderer) return;
    const w = Math.max(1, renderer.domElement.clientWidth), h = Math.max(1, renderer.domElement.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

const LP = C.LARG_PAINEL + C.FOLGA;
const VISTAS = {
    geral: [[0, 7.4, 13.2], [0, 2.3, -6]], parede: [[0, 3.5, 4.6], [0, 3.35, -8.7]], numeros: [[-LP, 3.75, -1.6], [-LP, C.Y_PAINEL + 0.3, -8.7]], curvas: [[0, 3.75, -1.6], [0, C.Y_PAINEL + 0.3, -8.7]],
    relatorio: [[LP, 3.75, -1.6], [LP, C.Y_PAINEL + 0.3, -8.7]], mesa: [[0, 5.9, 1.3], [0, 0.9, -4.4]], consolas: [[-10.4, 3.3, 8.6], [1.5, 1.2, 1.2]],
};
export function vista(nome) {
    if (!camera) return;
    const v = Array.isArray(nome) ? nome : VISTAS[nome];
    if (!v) return;
    const largas = ['geral', 'parede', 'mesa'].includes(nome) ? 1.9 : ['numeros', 'curvas', 'relatorio'].includes(nome) ? 1.42 : 0;
    const f = largas ? Math.max(1, largas / camera.aspect) : 1;                        // num visor estreito, a câmara recua para caber tudo
    controls.target.set(...v[1]); camera.position.set(...v[0]).sub(controls.target).multiplyScalar(f).add(controls.target); controls.update();
    if (!Array.isArray(nome)) $('op-vista').value = nome;
}

// --- Pintura dos painéis ------------------------------------------------------------------------------
function texto(g, s, x, y, tam, cor, peso = 600, alinhar = 'left', larguraMax = 0) {
    g.fillStyle = cor; g.textAlign = alinhar; g.textBaseline = 'middle'; g.font = `${peso} ${tam}px Arial, sans-serif`;
    if (larguraMax) { const w = g.measureText(s).width; if (w > larguraMax) g.font = `${peso} ${tam * larguraMax / w}px Arial, sans-serif`; }
    g.fillText(s, x, y);
}
function linhas(g, s, larguraMax, tam, peso = 500) {                                 // parte um texto em linhas que cabem na largura
    g.font = `${peso} ${tam}px Arial, sans-serif`;
    const out = []; let atual = '';
    const itens = /\s{2,}/.test(s), sep = itens ? '   ' : ' ';                         // listas partem-se por item, frases por palavra
    for (const palavra of String(s).split(itens ? /\s{2,}/ : / /).filter(x => x.trim())) {
        const tentativa = atual ? atual + sep + palavra : palavra;
        if (atual && g.measureText(tentativa).width > larguraMax) { out.push(atual); atual = palavra; } else atual = tentativa;
    }
    if (atual) out.push(atual);
    return out;
}
function cabecalho(g, W, titulo, direita, corDireita = '#ffd166') {
    g.fillStyle = '#081320'; g.fillRect(0, 0, W, 1024); g.fillStyle = '#16365f'; g.fillRect(0, 0, W, 104);
    texto(g, titulo, 44, 56, 44, '#ffffff', 700, 'left', W - 420);
    if (direita) texto(g, direita, W - 44, 56, 56, corDireita, 700, 'right', 340);
}

function pintarNumeros(tt) {
    const p = modelo.paineis.numeros, chave = dados ? String(Math.floor(tt)) : 'vazio';
    if (p.chave === chave) return;
    p.chave = chave;
    const g = p.canvas.getContext('2d'), W = 1536;
    cabecalho(g, W, 'O DIA EM NÚMEROS', dados ? hhmm(tt) : '--:--');
    if (!dados) { texto(g, 'SEM DADOS DO DIA', W / 2, 520, 64, '#40566b', 700, 'center'); p.tex.needsUpdate = true; return; }
    const agora = s => Math.round(valor(dados, dados.total[s], Math.floor(tt)));
    const partidos = dados.voos.filter(v => v.partida !== null && tt >= v.partida);
    const atraso = partidos.reduce((a, v) => a + v.atraso, 0) + dados.voos.filter(v => !partidos.includes(v) && tt > v.hora).reduce((a, v) => a + Math.floor(tt - v.hora), 0);
    const quadros = [['ACEITES NO CHECK-IN', agora('aceites'), C.COR_SERIE.aceites], ['EMBARCADOS', agora('embarcados'), C.COR_SERIE.embarcados],
        ['MALAS NO PORÃO', agora('carregadas'), C.COR_SERIE.carregadas], ['ATRASO ACUMULADO', atraso + ' min', atraso ? '#ff6b5a' : '#3ddc84']];
    quadros.forEach(([rotulo, n, cor], i) => {
        const x = 44 + i * 366; g.fillStyle = '#0d2238'; g.fillRect(x, 136, 346, 196); g.fillStyle = cor; g.fillRect(x, 136, 10, 196);
        texto(g, rotulo, x + 30, 176, 26, '#9fb3c2', 600, 'left', 300); texto(g, String(n), x + 30, 262, 96, '#ffffff', 700, 'left', 300);
    });
    const COL = [[44, 'VOO'], [250, 'DESTINO'], [500, 'PORTA'], [620, 'LUGAR'], [740, 'HORA'], [870, 'ESTADO'], [1310, 'A BORDO'], [1492, 'MALAS']];
    COL.forEach(([x, nome], i) => texto(g, nome, x, 392, 26, '#7f9bb5', 600, i >= 6 ? 'right' : 'left'));
    dados.voos.forEach((v, i) => {
        const y = 468 + i * 104, e = estadoDoVoo(v, tt);
        g.fillStyle = i % 2 ? '#0a1a2c' : '#0d2238'; g.fillRect(24, y - 46, W - 48, 92);
        g.fillStyle = v.cor; g.beginPath(); g.arc(210, y, 13, 0, 7); g.fill();
        texto(g, v.voo, 44, y, 50, '#ffffff', 700); texto(g, v.destino.toUpperCase(), 250, y, 44, '#ffffff', 700, 'left', 230);
        texto(g, v.porta ?? '—', 500, y, 40, '#ffffff', 700); texto(g, v.lugar ?? '—', 620, y, 40, '#ffffff', 700); texto(g, hhmm(v.hora), 740, y, 40, '#ffd166', 700);
        texto(g, e.texto, 870, y, 36, e.cor, 700, 'left', 275);
        texto(g, `${Math.round(valor(dados, v.curvas.embarcados, Math.floor(tt)))}/${v.aceites}`, 1310, y, 44, '#ffffff', 700, 'right');
        texto(g, `${Math.round(valor(dados, v.curvas.carregadas, Math.floor(tt)))}/${v.malas}`, 1492, y, 44, '#ffffff', 700, 'right');
    });
    g.fillStyle = '#0d2238'; g.fillRect(24, 872, W - 48, 120);
    const fim = tt >= dados.fim, ps = dados.passageiros, ml = dados.malas;
    texto(g, fim ? 'FIM DO DIA' : 'NO FIM DO DIA', 44, 908, 26, '#7f9bb5', 600);
    texto(g, `Passageiros: ${ps.embarcou} embarcaram, ${ps.faltou} faltaram, ${ps.recusado} recusados   ·   Malas: ${ml.carregada} no porão, ${ml.retirada} retiradas, ${ml.em_terra} em terra`, 44, 952, 30, fim ? '#ffffff' : '#5d7389', 600, 'left', W - 88);
    p.tex.needsUpdate = true;
}

function pintarCurvas(tt) {
    const p = modelo.paineis.curvas, chave = dados ? String(Math.floor(tt)) : 'vazio';
    if (p.chave === chave) return;
    p.chave = chave;
    const g = p.canvas.getContext('2d'), W = 1536;
    cabecalho(g, W, 'A MANHÃ, MINUTO A MINUTO', dados ? hhmm(tt) : '--:--');
    if (!dados) { texto(g, 'SEM DADOS DO DIA', W / 2, 520, 64, '#40566b', 700, 'center'); p.tex.needsUpdate = true; return; }
    const X0 = 130, X1 = W - 60, Y0 = 640, Y1 = 236, m = Math.floor(tt);
    const escala = Math.ceil(dados.maximoTotal / 50) * 50;
    const px = minuto => X0 + (minuto - dados.inicio) / (dados.fim - dados.inicio) * (X1 - X0), py = n => Y0 - n / escala * (Y0 - Y1);
    g.strokeStyle = '#1c3a57'; g.lineWidth = 2;
    for (let n = 0; n <= escala; n += 50) { g.beginPath(); g.moveTo(X0, py(n)); g.lineTo(X1, py(n)); g.stroke(); texto(g, String(n), X0 - 16, py(n), 26, '#7f9bb5', 600, 'right'); }
    for (let minuto = Math.ceil(dados.inicio / 30) * 30; minuto <= dados.fim; minuto += 30) { g.beginPath(); g.moveTo(px(minuto), Y0); g.lineTo(px(minuto), Y0 + 12); g.stroke(); texto(g, hhmm(minuto), px(minuto), Y0 + 36, 26, '#7f9bb5', 600, 'center'); }
    for (const [iv, v] of dados.voos.entries()) {                                    // hora marcada de cada voo e, se já partiu, a saída
        g.strokeStyle = v.cor; g.lineWidth = 2; g.setLineDash([10, 10]); g.beginPath(); g.moveTo(px(v.hora), Y0); g.lineTo(px(v.hora), Y1 - 14); g.stroke(); g.setLineDash([]);
        texto(g, v.voo, px(v.hora), Y1 - (iv % 2 ? 56 : 30), 24, v.cor, 700, 'center');
        if (v.partida !== null && tt >= v.partida) { g.fillStyle = v.cor; g.beginPath(); g.moveTo(px(v.partida), Y0 - 4); g.lineTo(px(v.partida) - 13, Y0 - 30); g.lineTo(px(v.partida) + 13, Y0 - 30); g.fill(); }
    }
    for (const s of C.SERIES) {
        g.strokeStyle = C.COR_SERIE[s]; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath();
        for (let minuto = dados.inicio; minuto <= Math.min(m, dados.fim); minuto++) g.lineTo(px(minuto), py(dados.total[s][minuto - dados.inicio]));
        g.stroke();
    }
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(px(Math.min(tt, dados.fim)), Y0); g.lineTo(px(Math.min(tt, dados.fim)), Y1); g.stroke();
    C.SERIES.forEach((s, i) => { const x = X0 + i * 340; g.fillStyle = C.COR_SERIE[s]; g.fillRect(x, 134, 34, 14); texto(g, `${C.NOME_SERIE[s]}: ${dados.total[s][Math.min(m, dados.fim) - dados.inicio]}`, x + 46, 142, 26, '#d7e3ee', 600, 'left', 280); });
    // Ocorrências por zona, à medida que acontecem
    texto(g, 'OCORRÊNCIAS', 44, 728, 26, '#7f9bb5', 600);
    const ate = dados.ocorrencias.filter(o => o.minuto <= tt);
    ZONAS.slice(0, 4).forEach(([zona, nome], i) => {
        const y = 778 + i * 44, dela = ate.filter(o => o.zona === zona);
        g.fillStyle = '#0d2238'; g.fillRect(X0, y - 16, X1 - X0, 32); texto(g, nome, X0 - 16, y, 24, '#9fb3c2', 600, 'right');
        g.fillStyle = '#ff6b5a'; for (const o of dela) g.fillRect(px(Math.min(o.minuto, dados.fim)) - 2, y - 14, 4, 28);
        texto(g, String(dela.length), X1 + 12, y, 24, dela.length ? '#ffb4a8' : '#5d7389', 700);
    });
    const ultima = ate[ate.length - 1];
    texto(g, ultima ? `${hhmm(ultima.minuto)} · ${ultima.texto}` : 'Sem ocorrências até agora', 44, 984, 26, ultima ? '#ffd166' : '#5d7389', 600, 'left', W - 88);
    p.tex.needsUpdate = true;
}

function pintarRelatorio() {
    const p = modelo.paineis.relatorio, chave = dados ? JSON.stringify(dados.indicadores) : 'vazio';
    if (p.chave === chave) return;
    p.chave = chave;
    const g = p.canvas.getContext('2d'), W = 1536;
    if (!dados) { cabecalho(g, W, 'RELATÓRIO DO DIA', ''); texto(g, 'SEM RELATÓRIO', W / 2, 520, 64, '#40566b', 700, 'center'); p.tex.needsUpdate = true; return; }
    const entregues = dados.indicadores.filter(i => i.entregue), certos = entregues.filter(i => i.confere).length;
    cabecalho(g, W, 'RELATÓRIO DO DIA', !dados.entregue ? 'POR ENTREGAR' : `${certos} de ${entregues.length} conferem`, !dados.entregue ? '#9fb3c2' : certos === entregues.length ? '#3ddc84' : '#ff8a7a');
    dados.indicadores.forEach((ind, i) => {
        const y = 124 + i * 148, cor = !ind.entregue ? '#5d7389' : ind.confere ? '#3ddc84' : '#ff6b5a';
        g.fillStyle = i % 2 ? '#0a1a2c' : '#0d2238'; g.fillRect(24, y, W - 48, 138); g.fillStyle = cor; g.fillRect(24, y, 10, 138);
        texto(g, ind.titulo.toUpperCase(), 60, y + 34, 30, '#9fb3c2', 700);
        texto(g, !ind.entregue ? 'por entregar' : ind.confere ? '✓ confere' : '✗ não confere', W - 48, y + 34, 30, cor, 700, 'right');
        if (!ind.entregue) { texto(g, '—', 60, y + 92, 44, '#40566b', 700); return; }
        let tam = 44, partes = linhas(g, textoIndicador(ind.chave, ind.valor), W - 130, tam, 700);
        if (partes.length > 1) { tam = 32; partes = linhas(g, textoIndicador(ind.chave, ind.valor), W - 130, tam, 700).slice(0, 2); }
        partes.forEach((l, k) => texto(g, l, 60, y + (partes.length > 1 ? 78 + k * 38 : 92), tam, '#ffffff', 700, 'left', W - 120));
    });
    p.tex.needsUpdate = true;
}

function pintarMesa(tt) {
    modelo.voos.forEach((mv, i) => {
        const v = dados?.voos[i];
        mv.grupo.visible = !!v || !dados;
        if (!v) { for (const b of Object.values(mv.barras)) b.scale.y = 0.001; mv.aviao.position.z = -0.45; mv.aviao.visible = true; mv.lampada.material.color.set('#39424a'); pintarEtiqueta(mv, null, tt); return; }
        mv.deriva.color.set(v.cor);
        for (const s of C.SERIES) mv.barras[s].scale.y = Math.max(0.001, valor(dados, v.curvas[s], tt) * C.ESCALA_BARRA);
        const e = estadoDoVoo(v, tt);
        const depois = v.partida === null ? 0 : Math.max(0, tt - v.partida);            // à hora da partida, a miniatura recua e sai da mesa
        mv.aviao.position.z = -0.45 - Math.min(1, depois / 4) * 0.7 - Math.max(0, depois - 4) * 0.5; mv.aviao.position.y = 0.11 + Math.max(0, depois - 4) * 0.3; mv.aviao.visible = depois < 9;
        mv.lampada.material.color.set(e.fase === 'partiu' ? (v.atraso ? '#ff6b5a' : '#3ddc84') : e.fase === 'atrasado' ? '#ff6b5a' : '#39424a');
        pintarEtiqueta(mv, v, tt, e);
    });
}
function pintarEtiqueta(mv, v, tt, e) {
    const m = Math.floor(tt), n = s => Math.round(valor(dados, v.curvas[s], m));
    const chave = v ? [v.voo, e.texto, ...C.SERIES.map(n)].join('|') : 'vazio';
    if (mv.etiqueta.chave === chave) return;
    mv.etiqueta.chave = chave;
    const g = mv.etiqueta.canvas.getContext('2d'), W = 512, H = 160;
    g.fillStyle = '#081320'; g.fillRect(0, 0, W, H);
    if (v) {
        g.fillStyle = v.cor; g.fillRect(0, 0, 14, H);
        texto(g, v.voo, 30, 36, 44, '#ffffff', 700); texto(g, v.destino.toUpperCase(), 190, 36, 34, '#ffffff', 700, 'left', 190); texto(g, hhmm(v.hora), W - 14, 36, 34, '#ffd166', 700, 'right');
        texto(g, e.texto, 30, 84, 30, e.cor, 700, 'left', W - 50);
        C.SERIES.forEach((s, k) => { g.fillStyle = C.COR_SERIE[s]; g.fillRect(30 + k * 120, 116, 18, 26); texto(g, String(n(s)), 56 + k * 120, 130, 30, '#ffffff', 700); });
    } else texto(g, '—', W / 2, H / 2, 44, '#40566b', 700, 'center');
    mv.etiqueta.tex.needsUpdate = true;
}
function pintarTudo() { pintarNumeros(t); pintarCurvas(t); pintarRelatorio(); pintarMesa(t); }

function cartoes() {
    const c = $('op-contadores');
    if (!dados) { c.innerHTML = ''; $('op-relatorio').innerHTML = '<b>RELATÓRIO</b><ul><li><i class="op-falta">○</i>sem dados do dia</li></ul>'; return; }
    const m = Math.min(Math.floor(t), dados.fim), n = s => dados.total[s][m - dados.inicio];
    const partidos = dados.voos.filter(v => v.partida !== null && t >= v.partida), atraso = partidos.reduce((a, v) => a + v.atraso, 0);
    const html = `<div><span>Aceites no check-in</span>${n('aceites')}</div><div><span>Embarcados</span>${n('embarcados')}</div><div><span>Malas no porão</span>${n('carregadas')}</div>` +
        `<div><span>Voos que já saíram</span>${partidos.length} de ${dados.voos.length}</div><div><span>Atraso dos que saíram</span><i class="${atraso ? 'op-mau' : ''}" style="font-style:normal">${atraso} min</i></div><div><span>Ocorrências</span>${dados.ocorrencias.filter(o => o.minuto <= t).length}</div>`;
    if (c.dataset.html !== html) { c.dataset.html = html; c.innerHTML = html; }
}
function cartaoRelatorio() {
    const entregues = dados.indicadores.filter(i => i.entregue), certos = entregues.filter(i => i.confere).length;
    $('op-relatorio').innerHTML = `<b>RELATÓRIO ${dados.entregue ? `· ${certos} DE ${entregues.length} CONFEREM` : 'POR ENTREGAR'}</b><ul>` + dados.indicadores.map(i =>
        `<li title="${limpo(i.titulo)}${i.entregue ? ': ' + limpo(textoIndicador(i.chave, i.valor)) : ''}"><i class="${!i.entregue ? 'op-falta' : i.confere ? 'op-sim' : 'op-nao'}" style="font-style:normal">${!i.entregue ? '○' : i.confere ? '✓' : '✗'}</i>${limpo(i.titulo)}` +
        '</li>').join('') + '</ul>';
}

function carregar(registo) {
    dados = prepararDia(registo);
    for (const p of Object.values(modelo.paineis)) p.chave = null;
    for (const mv of modelo.voos) mv.etiqueta.chave = null;
    $('op-vazio').hidden = true;
    $('op-legenda').innerHTML = dados.voos.map(v => `<span><i style="background:${v.cor}"></i>${limpo(v.voo)} ${limpo(v.destino)} · ${hhmm(v.hora)}</span>`).join('');
    $('op-tempo').min = dados.inicio; $('op-tempo').max = dados.fim;
    cartaoRelatorio();
    t = dados.inicio; aReproduzir = true;
    vista(dados.entregue ? 'geral' : 'geral');
}

function animar(agora) {
    ciclo = requestAnimationFrame(animar);
    const dt = Math.min(0.25, (agora - (ultimo || agora)) / 1000); ultimo = agora;
    if (dados && aReproduzir) {
        t = Math.min(dados.fim, t + dt * Number($('op-velocidade').value));
        if (t >= dados.fim) aReproduzir = false;
    }
    $('op-play').textContent = aReproduzir ? 'Ⅱ' : '▶';
    if (dados) { $('op-tempo').value = t; const h = hhmm(t); if ($('op-hora').textContent !== h) $('op-hora').textContent = h; }
    const outras = [['checkinHall', 'Check-in'], ['sortingHall', 'Triagem'], ['boardingHall', 'Embarque'], ['rampHall', 'Placa']].filter(([n]) => window[n]?.dados?.());
    const chave = outras.map(o => o[0]).join();
    if ($('op-ir').dataset.chave !== chave) { $('op-ir').dataset.chave = chave; $('op-ir').hidden = !outras.length; $('op-ir').innerHTML = '<option value="">Ir para…</option>' + outras.map(([n, nome]) => `<option value="${n}">${nome}</option>`).join(''); }
    modelo.teto.visible = camera.position.y < C.ALTURA - 0.2;
    modelo.tras.visible = camera.position.z < C.Z1 - 0.2;
    controls.update();
    pessoasGlb?.atualizar(dt);
    pintarTudo(); cartoes();
    renderer.render(scene, camera);
}

export function abrir() {
    if (!renderer) construir();
    window.dispatchEvent(new CustomEvent('hall-open', { detail: 'ops' }));
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
$('op-fechar').onclick = fechar;
$('op-play').onclick = () => { if (!dados) return; if (t >= dados.fim) t = dados.inicio; aReproduzir = !aReproduzir; };
$('op-tempo').oninput = e => { t = Number(e.target.value); aReproduzir = false; };
$('op-vista').onchange = e => vista(e.target.value);
$('op-ir').onchange = e => { const alvo = e.target.value; e.target.value = ''; if (alvo) window[alvo]?.abrir(); };

window.addEventListener('report-run', e => { abrir(); carregar(e.detail); });
window.addEventListener('hall-open', e => { if (e.detail !== 'ops' && sala.classList.contains('aberta')) fechar(); });
window.opsHall = { abrir, fechar, vista, tempo: () => t, irPara: m => { t = m; aReproduzir = false; }, info: () => renderer && { ...renderer.info.render, geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures }, dados: () => dados };
