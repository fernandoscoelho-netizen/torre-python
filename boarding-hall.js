// Bloco 3 · Passageiros, Fase 5: sala de embarque em 3D (controlo de segurança e portas).
// Não simula nada: reproduz o registo de eventos devolvido pelo motor Python (embarque.py),
// por isso o que se vê é exatamente o que os objetos do aluno decidiram. A cena só reparte,
// dentro de cada minuto, os passos de quem anda: avançar na fila, passar no pórtico, ir até à porta.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { criarCaminho } from './sorting-hall-model.js?v=relatorio-1';
import { K, FILAS, FILAS_PORTA, CADEIRAS, lugarEmTerra, lugarNaLoja, geometriaPassageiro, geometriaTabuleiro, construirEmbarque } from './boarding-hall-model.js?v=relatorio-1';

const CORES_VOO = ['#e4572e', '#2e86de', '#f2b705', '#3fa34d', '#9b5de5'];
const T_AVANCO = 0.25;                           // minutos que a fila demora a avançar um lugar
const acaso = (i, k = 0) => { let x = Math.imul(i + 1, 2654435761) ^ Math.imul(k + 7, 1597334677); x = Math.imul(x ^ (x >>> 15), 2246822519); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
const suave = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
const mistura = (a, b, k) => a + (b - a) * k;
const V = K.V_PESSOA, X_TABULEIRO = -106.2, X_RECOLHA = -99.2;

// ---------------------------------------------------------------------------
// Reconstrução do estado a partir do registo (funções puras)
export function prepararEmbarque(reg) {
    const voos = {}, portas = {}, linhas = {}, ocorrencias = [], contagens = [];
    reg.portas.forEach((g, i) => {
        voos[g.voo] = { ...g, cor: CORES_VOO[i % CORES_VOO.length], total: 0, contagem: null };
        portas[g.porta] = { ...g, x: K.PORTAS[g.porta], cor: voos[g.voo].cor, leituras: [], visitas: [], emTerra: 0 };
    });
    Object.values(voos).sort((a, b) => a.hora - b.hora).forEach((v, i) => { v.cor = CORES_VOO[i % CORES_VOO.length]; portas[v.porta].cor = v.cor; });
    for (const l of reg.linhas) linhas[l.codigo] = { ...l, z: K.LINHAS[l.codigo], atendimentos: [] };
    const passageiros = reg.passageiros.map((p, i) => ({
        ...p, i, cor: voos[p.voo]?.cor ?? null, linha: null, inicio: null, fimControlo: null, livre: null, destino1: null, chega1: null,
        visitas: [], repetida: null, perdeu: null, motivoPerdeu: null, embarcou: null, terraDesde: null, etapas: [],
    }));
    for (const p of passageiros) if (voos[p.voo]) voos[p.voo].total++;
    const por = new Map(passageiros.map(p => [p.reserva, p]));
    for (const e of reg.eventos) {
        const p = por.get(e.reserva);
        if (e.tipo === 'linha') { p.linha = e.linha; linhas[e.linha].atendimentos.push(p); }
        else if (e.tipo === 'controlo') { p.inicio = e.minuto; p.fimControlo = e.fim; }
        else if (e.tipo === 'livre') { p.livre = e.minuto; p.destino1 = e.porta; p.chega1 = e.chega; }
        else if (e.tipo === 'na_porta') { const v = { p, porta: e.porta, chega: e.minuto, leitura: null, aceite: null, motivo: null, certo: null, razoes: [], cadeira: null, tFila: e.minuto, idx: 0 }; p.visitas.push(v); portas[e.porta].visitas.push(v); }
        else if (e.tipo === 'leitura') {
            const tl = e.minuto + (e.ordem + 0.5) / reg.tempos.ritmo_porta, l = { t: tl, p, aceite: e.aceite, motivo: e.motivo, certo: e.certo, repetida: e.repetida, razoes: e.razoes };
            portas[e.porta].leituras.push(l);
            if (e.repetida) p.repetida = l;
            else { const v = p.visitas.findLast(x => x.porta === e.porta && x.leitura === null); if (v) Object.assign(v, { leitura: tl, aceite: e.aceite, motivo: e.motivo, certo: e.certo, razoes: e.razoes }); if (e.aceite) { p.embarcou = tl; p.embarcouEm = e.voo; } }
        }
        else if (e.tipo === 'perdeu') { p.perdeu = e.minuto; p.motivoPerdeu = e.motivo; }
        else if (e.tipo === 'contagem') { voos[e.voo].contagem = e; contagens.push(e); }
        else if (e.tipo === 'ocorrencia') ocorrencias.push(e);
    }
    // Ordem de atendimento em cada linha e ordem de leitura em cada porta
    for (const l of Object.values(linhas)) { l.atendimentos.sort((a, b) => (a.inicio ?? 1e9) - (b.inicio ?? 1e9) || a.chegada - b.chegada || a.i - b.i); l.atendimentos.forEach((p, k) => { p.idxLinha = k; }); }
    for (const g of Object.values(portas)) {
        g.visitas.sort((a, b) => (a.leitura ?? 1e9) - (b.leitura ?? 1e9) || a.chega - b.chega || a.p.i - b.p.i); g.visitas.forEach((v, k) => { v.idx = k; });
        const cedo = g.visitas.filter(v => v.chega < g.abertura - 3 && v.p.papel !== 'tarde').sort((a, b) => a.chega - b.chega || a.p.i - b.p.i);
        const livres = CADEIRAS[g.porta].map((c, k) => [acaso(k, g.x + 200), c]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
        cedo.forEach((v, k) => { if (k < livres.length) { v.cadeira = livres[k]; v.tFila = Math.max(v.chega, g.abertura - 0.2); } });
    }
    for (const p of passageiros) if (p.livre !== null) etapasDepoisDoControlo(p, portas);
    for (const p of passageiros) if (p.perdeu !== null) p.terraDesde = p.perdeu;
    return { inicio: reg.inicio, fim: reg.fim, origem: reg.origem, tempos: reg.tempos, voos, portas, linhas, passageiros, ocorrencias, contagens, resumo: reg.resumo };
}

// Percurso de um passageiro depois do controlo: corredor, cadeira ou fila da porta, leitor e manga.
function etapasDepoisDoControlo(p, portas) {
    const zl = K.LINHAS[p.linha], zc = K.Z_CORREDOR + (acaso(p.i, 7) - 0.5) * 3.2;
    let origem = [[X_RECOLHA, 0, zl], [K.X_SAIDA, 0, zl], [K.X_DIVISORIA + 2.2, 0, zl], [K.X_DIVISORIA + 6, 0, zc]], t0 = p.livre;
    if (p.papel === 'outro' || !p.destino1) { p.etapas.push({ tipo: 'rota', t0, cam: criarCaminho([...origem, [K.X_FIM, 0, zc]], 0.7), vel: V, some: true }); return; }
    let dest = p.destino1, chega = p.chega1;
    const paraFila = x => [[x + 0.6, 0, zc], [x + 0.6, 0, -10.5], [x + 1.5, 0, -10.5]];
    if (p.papel === 'tarde') {                                                        // distrai-se numa montra e só depois vai para a porta
        const loja = lugarNaLoja(p.i); if (Math.abs(loja.x - (portas[dest].x + 0.6)) < 1) loja.x += 2;
        const ida = criarCaminho([...origem, [loja.x, 0, zc], [loja.x, 0, loja.z]], 0.7);
        p.etapas.push({ tipo: 'rota', t0, cam: ida, vel: V, ry: Math.PI });
        origem = [[loja.x, 0, loja.z], [loja.x, 0, zc]];
        const falta = Math.abs(portas[dest].x - loja.x) + 12 + FILAS_PORTA[dest].comp;
        t0 = Math.max(t0 + ida.comp / V + 0.1, chega - falta / V - 0.1);
    }
    for (let n = 0; n < 4; n++) {
        const g = portas[dest], v = p.visitas.find(x => x.porta === dest && !x.usada && x.chega === chega);
        if (!v) {                                                                    // chegou depois da contagem: já não há fila
            const k = g.emTerra++, alvo = lugarEmTerra(dest, k), cam = criarCaminho([...origem, [g.x - 4.9, 0, zc], [g.x - 4.9, 0, alvo.z], [alvo.x, 0, alvo.z]], 0.6);
            p.etapas.push({ tipo: 'rota', t0, cam, vel: Math.max(V, cam.comp / Math.max(0.2, chega - t0)), ry: Math.PI / 2 }); return;
        }
        v.usada = true;
        const compQ = FILAS_PORTA[dest].comp;
        let direto = true;
        if (v.cadeira) {
            const [sx, sz, sry] = v.cadeira, coxia = sz < -5.4 ? -6.75 : -3.7;
            const ida = criarCaminho([...origem, [g.x + 22.6, 0, zc], [g.x + 22.6, 0, coxia], [sx, 0, coxia], [sx, 0, sz]], 0.5), tSenta = t0 + ida.comp / V;
            const volta = criarCaminho([[sx, 0, sz], [sx, 0, coxia], [g.x + 22.6, 0, coxia], [g.x + 22.6, 0, -12.3], [g.x + 0.6, 0, -12.3], [g.x + 0.6, 0, -10.5], [g.x + 1.5, 0, -10.5]], 0.5);
            const D = volta.comp + compQ, tLevanta = v.tFila - D / V - 0.05 - acaso(p.i, 9) * 0.5;
            if (tLevanta > tSenta + 0.3) {
                p.etapas.push({ tipo: 'rota', t0, cam: ida, vel: V }, { tipo: 'sentado', t0: tSenta, x: sx, z: sz, ry: sry }, { tipo: 'aprox', t0: tLevanta, cam: volta, vel: D / (v.tFila - tLevanta), v });
                direto = false;
            }
        }
        if (direto) { const cam = criarCaminho([...origem, ...paraFila(g.x)], 0.6), D = cam.comp + compQ; p.etapas.push({ tipo: 'aprox', t0, cam, vel: Math.max(V, D / Math.max(0.2, v.tFila - t0)), v }); }
        if (v.leitura === null) { if (p.perdeu !== null) p.etapas.push({ tipo: 'terra', t0: p.perdeu, porta: dest, k: g.emTerra++, v }); return; }
        if (v.aceite) { p.etapas.push({ tipo: 'rota', t0: v.leitura, cam: criarCaminho([[g.x, 0, K.Z_LEITOR], [g.x, 0, 0.4], [g.x, 0, 3]], 0.3), vel: V, some: true }); return; }
        if (v.razoes.includes('voo errado') && dest !== p.porta) {                       // enganou-se na porta: segue para a certa
            t0 = v.leitura; origem = [[g.x, 0, K.Z_LEITOR], [g.x - 1.3, 0, -4.8], [g.x - 1.3, 0, zc]]; dest = p.porta; chega = Math.floor(v.leitura) + 2; continue;
        }
        p.etapas.push({ tipo: 'terra', t0: v.leitura, porta: dest, k: g.emTerra++, de: [g.x, K.Z_LEITOR] }); return;
    }
}

export function contar(dados, t) {
    const n = { fila: 0, controlo: 0, caminho: 0, portas: 0, embarcados: 0, terra: 0, espera: 0, atraso: 0, erradas: 0 };
    for (const p of dados.passageiros) {
        if (p.chegada === null || t < p.chegada) { if (p.perdeu !== null && t >= p.perdeu) n.terra++; continue; }
        if (p.inicio === null || t < p.inicio) { n.fila++; if (p.papel !== 'outro') n.espera = Math.max(n.espera, t - p.chegada); continue; }
        if (p.papel !== 'outro') n.espera = Math.max(n.espera, p.inicio - p.chegada);
        if (t < p.fimControlo) { n.controlo++; continue; }
        if (p.papel === 'outro') continue;
        if (p.embarcou !== null && t >= p.embarcou) n.embarcados++;
        else if (p.perdeu !== null && t >= p.perdeu) n.terra++;
        else if (p.visitas.some(v => v.chega <= t && (v.leitura === null || t < v.leitura))) n.portas++;
        else n.caminho++;
    }
    for (const c of dados.contagens) if (t >= c.minuto) n.atraso += c.atraso;
    for (const g of Object.values(dados.portas)) for (const l of g.leituras) if (!l.certo && t >= l.t) n.erradas++;
    return n;
}

// Lugar na fila da linha de controlo (0 = cabeça) e na fila da porta. Quem é atendido sai aos poucos, para os de trás avançarem sem saltos.
function lugarNaLinha(dados, p, t) {
    const lista = dados.linhas[p.linha].atendimentos, ref = Math.max(t, p.chegada); let soma = 0;
    for (let k = 0; k < p.idxLinha; k++) { const q = lista[k]; if (q.chegada > ref) continue; soma += q.inicio === null || t < q.inicio ? 1 : 1 - suave((t - q.inicio) / T_AVANCO); }
    return soma;
}
function lugarNaPorta(dados, v, t) {
    const lista = dados.portas[v.porta].visitas; let soma = 0;
    for (let k = 0; k < v.idx; k++) { const w = lista[k]; if (w.leitura !== null) soma += t < w.leitura ? 1 : 1 - suave((t - w.leitura) / 0.1); else if (w.p.perdeu === null || t < w.p.perdeu) soma += 1; }
    return soma;
}

const _f = {};
function naFilaDaPorta(dados, e, t, o) {                                             // aproximação pela cauda e avanço na fila
    const v = e.v, fila = FILAS_PORTA[v.porta], s0 = Math.min(lugarNaPorta(dados, v, t) * K.ESPACO, fila.comp), D = e.cam.comp + fila.comp - s0, resto = D - (t - e.t0) * e.vel;
    if (resto <= 0) { fila.em(s0, _f); o.x = _f.x; o.z = _f.z; o.ry = Math.atan2(-_f.tx, -_f.tz); return; }
    o.anda = true;
    if (resto <= fila.comp - s0) { fila.em(s0 + resto, _f); o.x = _f.x; o.z = _f.z; o.ry = Math.atan2(-_f.tx, -_f.tz); return; }
    e.cam.em(e.cam.comp - (resto - (fila.comp - s0)), _f); o.x = _f.x; o.z = _f.z; o.ry = Math.atan2(_f.tx, _f.tz);
}

// Posição de um passageiro no instante t: { v (visível), x, z, ry, anda, sentado, k (fase do controlo, ou -1) }.
export function posePassageiro(dados, p, t, o = {}) {
    o.v = true; o.anda = false; o.sentado = false; o.k = -1;
    if (p.chegada === null || p.linha === null) { o.v = false; return o; }
    if (p.inicio === null || t < p.inicio) {                                         // a chegar do check-in ou na fila da linha
        const fila = FILAS[p.linha], s = lugarNaLinha(dados, p, t) * K.ESPACO + Math.max(0, p.chegada - t) * V;
        if (s > fila.comp) { o.v = false; return o; }
        fila.em(s, _f); o.x = _f.x; o.z = _f.z; o.ry = Math.atan2(-_f.tx, -_f.tz); o.anda = t < p.chegada; return o;
    }
    const zl = K.LINHAS[p.linha];
    if (t < p.fimControlo) {                                                         // tabuleiro, pórtico e recolha
        const k = (t - p.inicio) / (p.fimControlo - p.inicio); o.k = k; o.z = zl;
        if (k < 0.2) { o.x = mistura(K.X_CABECA, X_TABULEIRO, suave(k / 0.2)); o.ry = Math.PI / 2; o.anda = true; }
        else if (k < 0.45) { o.x = X_TABULEIRO; o.ry = Math.PI; }
        else if (k < 0.75) { o.x = mistura(X_TABULEIRO, X_RECOLHA, suave((k - 0.45) / 0.3)); o.ry = Math.PI / 2; o.anda = true; }
        else { o.x = X_RECOLHA; o.ry = Math.PI; }
        return o;
    }
    let e = null;
    for (const x of p.etapas) { if (x.t0 <= t) e = x; else break; }
    if (!e) { o.x = X_RECOLHA; o.z = zl; o.ry = Math.PI / 2; return o; }
    if (e.tipo === 'rota') {
        const d = (t - e.t0) * e.vel;
        if (d >= e.cam.comp) { if (e.some) { o.v = false; return o; } e.cam.em(e.cam.comp, _f); o.x = _f.x; o.z = _f.z; o.ry = e.ry ?? Math.atan2(_f.tx, _f.tz); return o; }
        e.cam.em(d, _f); o.x = _f.x; o.z = _f.z; o.ry = Math.atan2(_f.tx, _f.tz); o.anda = true; return o;
    }
    if (e.tipo === 'sentado') { o.x = e.x; o.z = e.z; o.ry = e.ry; o.sentado = true; return o; }
    if (e.tipo === 'aprox') { naFilaDaPorta(dados, e, t, o); return o; }
    // em terra: afasta-se da fila e fica ao lado da porta
    const alvo = lugarEmTerra(e.porta, e.k, _f), ax = alvo.x, az = alvo.z;
    let dx, dz;
    if (e.de) [dx, dz] = e.de; else { const fila = FILAS_PORTA[e.v.porta]; fila.em(Math.min(lugarNaPorta(dados, e.v, e.t0 - 0.001) * K.ESPACO, fila.comp), _f); dx = _f.x; dz = _f.z; }
    const k = suave((t - e.t0) / 0.5);
    o.x = mistura(dx, ax, k); o.z = mistura(dz, az, k); o.anda = k < 1; o.ry = k < 1 ? Math.atan2(ax - dx, az - dz) : Math.PI / 2;
    return o;
}

// ---------------------------------------------------------------------------
// Interface
const estilo = document.createElement('style');
estilo.textContent = `
.boarding-hall{position:absolute;inset:0;z-index:6;background:#cfd8de;display:none;container-type:size}
.boarding-hall.aberta{display:block}
.boarding-hall canvas{display:block;width:100%;height:100%}
.bd-topo{position:absolute;top:12px;left:14px;right:14px;display:flex;gap:10px;align-items:flex-start;justify-content:space-between;pointer-events:none;font:13px/1.35 system-ui,sans-serif}
.bd-cartao{pointer-events:auto;background:#14273ae8;color:#e8eef2;border-radius:6px;padding:9px 12px;backdrop-filter:blur(8px)}
.bd-cartao b{font-size:12px;letter-spacing:1.5px;font-weight:650}
.bd-topo .bd-principal{max-width:560px}
.bd-contadores{display:grid;grid-template-columns:repeat(4,auto);gap:4px 14px;margin-top:6px;font-variant-numeric:tabular-nums}
.bd-contadores span{color:#9fb3c2;font-size:11px;display:block}
.bd-contadores .bd-mau{color:#ffb4a8}
.bd-ocorrencias{max-width:330px;max-height:132px;overflow:auto;font-size:12px}
.bd-ocorrencias li{margin-left:16px}
.bd-controlos{position:absolute;left:14px;right:14px;bottom:14px;display:flex;gap:8px;align-items:center;background:#14273ae8;color:#e8eef2;border-radius:6px;padding:8px 10px;font:13px system-ui,sans-serif}
.bd-controlos input[type=range]{flex:1;min-width:60px}
.bd-controlos button,.bd-controlos select{background:#2d4b63;color:#fff;border:1px solid #ffffff33;border-radius:4px;padding:4px 9px;font:inherit;cursor:pointer}
.bd-controlos button{white-space:nowrap}
.bd-controlos button[hidden]{display:none}
.bd-hora{font-variant-numeric:tabular-nums;min-width:44px;text-align:center;font-weight:650}
.bd-seguir{position:absolute;right:14px;top:12px;max-width:310px;font-size:12px}
.bd-seguir ol{margin:6px 0 0 18px;padding:0;max-height:190px;overflow:auto}
.bd-seguir button{margin-top:6px;background:#2d4b63;color:#fff;border:1px solid #ffffff33;border-radius:4px;padding:3px 8px;cursor:pointer}
.bd-legenda{display:block;margin-top:4px}
.bd-legenda i{display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 4px 0 0;vertical-align:-1px}
.bd-legenda span{margin-right:10px;white-space:nowrap}
.bd-dica{font-size:11px;color:#9fb3c2;margin-top:6px;max-width:500px}
.bd-abrir{position:absolute;right:12px;bottom:184px;z-index:5;background:#14273ae8;color:#e8eef2;border:1px solid #ffffff33;border-radius:4px;padding:6px 11px;font:13px system-ui,sans-serif;cursor:pointer}
.bd-vazio[hidden],.bd-cartao[hidden]{display:none}
.bd-vazio{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);background:#14273ae8;color:#e8eef2;border-radius:6px;padding:8px 14px;font:13px system-ui,sans-serif;text-align:center;pointer-events:none;max-width:80%}
@container (max-width: 820px){
.bd-topo .bd-principal{max-width:none}
.bd-topo{top:8px;left:8px;right:8px;font-size:12px}
.bd-cartao{padding:6px 9px}
.bd-dica,.bd-topo .bd-ocorrencias{display:none}
.bd-legenda span{margin-right:8px;font-size:11px}
.bd-contadores{grid-template-columns:repeat(8,auto);gap:2px 9px;margin-top:4px}
.bd-contadores span{font-size:10px}
.bd-controlos{left:8px;right:8px;bottom:8px;gap:5px;padding:6px 7px;font-size:12px}
.bd-controlos button,.bd-controlos select{padding:3px 5px}
.bd-controlos select{max-width:104px}
.bd-longo{display:none}
.bd-seguir{right:8px;top:auto;bottom:52px;max-width:250px}
.bd-seguir ol{max-height:84px}
}
`;
document.head.append(estilo);

const viewport = document.querySelector('.workspace-viewport') ?? document.getElementById('scene')?.parentElement ?? document.body;
const sala = document.createElement('div');
sala.className = 'boarding-hall';
sala.innerHTML = `
<div class="bd-topo">
  <div class="bd-cartao bd-principal"><b>EMBARQUE · SEGURANÇA E PORTAS</b><span class="bd-legenda" id="bd-legenda"></span><div class="bd-contadores" id="bd-contadores"></div><div class="bd-dica">A bola por cima de cada passageiro tem a cor do voo; os passageiros sem bola são de outros voos. O anel vermelho marca quem ficou em terra. Clica num passageiro para o seguir.</div></div>
  <div class="bd-cartao bd-ocorrencias" id="bd-ocorrencias" hidden></div>
</div>
<div class="bd-cartao bd-seguir" id="bd-seguir" hidden></div>
<div class="bd-vazio" id="bd-vazio">Executa um programa do embarque (níveis 32 a 34) para ver aqui os passageiros na segurança e nas portas.</div>
<div class="bd-controlos">
  <button id="bd-play" title="Reproduzir ou pausar">▶</button>
  <span class="bd-hora" id="bd-hora">--:--</span>
  <input type="range" id="bd-tempo" min="0" max="1" step="0.002" value="0" aria-label="Hora simulada">
  <select id="bd-velocidade" aria-label="Velocidade"><option value="0.25">0,25 min/s</option><option value="0.5">0,5 min/s</option><option value="1" selected>1 min/s</option><option value="2">2 min/s</option><option value="4">4 min/s</option><option value="8">8 min/s</option></select>
  <select id="bd-vista" aria-label="Vista"><option value="geral">Vista geral</option><option value="seguranca">Controlo de segurança</option><option value="raiox">Raios X e pórtico</option><option value="corredor">Corredor</option><option value="G21">Porta G21</option><option value="G22">Porta G22</option><option value="G23">Porta G23</option><option value="G24">Porta G24</option><option value="leitor">Leitor de cartões</option><option value="exterior">Aviões e mangas</option></select>
  <button id="bd-checkin" title="Voltar aos balcões de check-in" hidden>⬅<span class="bd-longo"> Check-in</span></button>
  <button id="bd-placa" title="Seguir as malas no carregamento do avião" hidden><span class="bd-longo">Placa </span>➜</button>
  <button id="bd-operacoes" title="Ver o relatório do dia no centro de operações" hidden>📊<span class="bd-longo"> Operações</span></button>
  <button id="bd-fechar" title="Voltar à maquete do aeroporto"><span class="bd-longo">Aeroporto </span>✕</button>
</div>`;
viewport.append(sala);
const botaoAbrir = document.createElement('button');
botaoAbrir.className = 'bd-abrir';
botaoAbrir.textContent = '🛂 Embarque';
viewport.append(botaoAbrir);
const $ = id => sala.querySelector('#' + id);
function hhmm(m) { m = Math.floor(m); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
const limpo = s => String(s).replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;');

// ---------------------------------------------------------------------------
// Cena
let renderer = null, scene, camera, controls, modelo, marcador, bolas = null, aneis = null;
let dados = null, t = 0, fimVisual = 0, aReproduzir = false, ultimo = 0, ciclo = null, seguido = null, aproximar = false, portaVista = 'G21';
let malhasPessoa = [], objetos = [], poses = [], tabuleiros = {};
const geoPessoas = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

function construir() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
    sala.prepend(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#cfd8de');
    camera = new THREE.PerspectiveCamera(45, 1, 0.25, 2000);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.minDistance = 1.5; controls.maxDistance = 330;
    modelo = construirEmbarque(scene, renderer);
    for (const codigo of Object.keys(K.LINHAS)) { const m = new THREE.Mesh(geometriaTabuleiro(Object.keys(tabuleiros).length + 1), modelo.matTabuleiro); m.castShadow = true; m.visible = false; scene.add(m); tabuleiros[codigo] = m; }
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
    ajustar(); vista('geral'); desenharFixos(0, null);
}

function ajustar() {
    if (!renderer) return;
    const w = Math.max(1, renderer.domElement.clientWidth), h = Math.max(1, renderer.domElement.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

const VISTAS = {
    geral: [[-15, 118, 112], [-15, 0, 2]], seguranca: [[-109, 27, 13], [-106, 0, -10.5]], raiox: [[-106.6, 2.7, -9.7], [-101, 1.1, -12.8]], corredor: [[-84, 3.4, -14.2], [-30, 1.5, -8]],
};
const vistaDaPorta = g => { const x = K.PORTAS[g]; return [[x - 3, 6.6, -14.6], [x + 7.5, 1, -3]]; };
export function vista(nome) {
    if (!camera) return;
    if (K.PORTAS[nome] !== undefined) portaVista = nome;
    const x = K.PORTAS[portaVista];
    const v = Array.isArray(nome) ? nome : VISTAS[nome] ?? (K.PORTAS[nome] !== undefined ? vistaDaPorta(nome) : nome === 'leitor' ? [[x + 4.6, 2.5, -8.2], [x + 0.4, 1.2, -1.6]] : nome === 'exterior' ? [[x - 16, 8, 46], [x + 18, 1.5, 10]] : null);
    if (!v) return;
    const f = nome === 'geral' ? Math.max(1, 1.62 / camera.aspect) : 1;            // num visor estreito, a vista geral recua para caber a sala toda
    controls.target.set(...v[1]); camera.position.set(...v[0]).sub(controls.target).multiplyScalar(f).add(controls.target); controls.update();
    if (!Array.isArray(nome)) $('bd-vista').value = nome;
}

function carregar(registo) {
    for (const o of objetos) scene.remove(o);
    objetos = []; malhasPessoa = []; poses = [];
    for (const o of [bolas, aneis]) if (o) { scene.remove(o); o.dispose(); }
    dados = prepararEmbarque(registo);
    for (const p of dados.passageiros) {
        const k = p.i % 30;
        if (!geoPessoas[k]) geoPessoas[k] = { pe: geometriaPassageiro(k + 1), sentado: geometriaPassageiro(k + 1, true) };
        const malha = new THREE.Mesh(geoPessoas[k].pe, modelo.matPessoas);
        malha.castShadow = true; malha.visible = false; malha.userData.reserva = p.reserva; malha.userData.geos = geoPessoas[k]; scene.add(malha); objetos.push(malha); malhasPessoa.push(malha);
    }
    const n = dados.passageiros.length;
    bolas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), n); bolas.frustumCulled = false; scene.add(bolas);
    aneis = new THREE.InstancedMesh(new THREE.TorusGeometry(0.36, 0.035, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3b30', toneMapped: false }), n); aneis.frustumCulled = false; scene.add(aneis);
    dados.passageiros.forEach(p => bolas.setColorAt(p.i, _c.set(p.cor ?? '#8a8f96')));
    bolas.instanceColor.needsUpdate = true;
    for (const [codigo, l] of Object.entries(modelo.linhas)) { const aberta = dados.linhas[codigo]?.aberta !== false; l.aberto.visible = aberta; l.fechado.visible = !aberta; l.sinal.chave = null; }
    for (const g of Object.values(dados.portas)) { modelo.estacionados[modelo.portas[g.porta].lugar].deriva.color.set(g.cor); modelo.portas[g.porta].ecra.chave = null; }
    for (const [codigo, g] of Object.entries(modelo.portas)) if (!dados.portas[codigo]) modelo.estacionados[g.lugar].aviao.visible = false; else modelo.estacionados[g.lugar].aviao.visible = true;
    $('bd-vazio').hidden = true;
    seguir(null);
    $('bd-legenda').innerHTML = Object.values(dados.voos).sort((a, b) => a.hora - b.hora).map(v => `<span><i style="background:${v.cor}"></i>${limpo(v.voo)} ${limpo(v.destino)} · ${limpo(v.porta)} · fecha ${hhmm(v.fecho)}</span>`).join('');
    fimVisual = Math.max(dados.fim + 0.6, ...Object.values(dados.voos).filter(v => v.contagem).map(v => v.hora + v.contagem.atraso + 7));   // até o último avião sair do lugar
    const primeira = Math.min(...dados.passageiros.filter(p => p.chegada !== null).map(p => p.chegada), dados.fim);
    $('bd-tempo').min = dados.inicio - 1; $('bd-tempo').max = fimVisual;
    $('bd-ocorrencias').dataset.n = '';
    t = Math.max(dados.inicio - 1, primeira - 0.8); aReproduzir = true;
    vista('seguranca');
}

// --- Sinais das linhas, quadro do controlo, painel de partidas e ecrãs das portas -----------------
function texto(g, s, x, y, tam, cor, peso = 600, alinhar = 'left', larguraMax = 0) {
    g.fillStyle = cor; g.textAlign = alinhar; g.textBaseline = 'middle'; g.font = `${peso} ${tam}px Arial, sans-serif`;
    if (larguraMax) { const w = g.measureText(s).width; if (w > larguraMax) g.font = `${peso} ${tam * larguraMax / w}px Arial, sans-serif`; }
    g.fillText(s, x, y);
}
function estadoDaPorta(g, tt) {
    const voo = dados.voos[g.voo], c = voo.contagem;
    if (c && tt >= c.minuto) return ['fechada', c.atraso ? `PORTA FECHADA · ATRASO ${c.atraso} MIN` : 'PORTA FECHADA', '#ff5a4d'];
    if (tt >= g.fecho) return ['fechada', 'PORTA FECHADA', '#ff5a4d'];
    if (tt >= g.fecho - 5) return ['ultima', 'ÚLTIMA CHAMADA', '#f2b705'];
    if (tt >= g.abertura) return ['aberta', 'EMBARQUE', '#3ddc84'];
    return ['espera', `ABRE ÀS ${hhmm(g.abertura)}`, '#9fb3c2'];
}
const P_Z_NARIZ = 18;                                                              // cota do nariz dos aviões estacionados (igual à da placa)
function desenharFixos(tt, n) {
    const filas = {}, embarcados = {};
    if (dados) {
        for (const p of dados.passageiros) if (p.linha && p.chegada <= tt && (p.inicio === null || tt < p.inicio)) filas[p.linha] = (filas[p.linha] ?? 0) + 1;
        for (const g of Object.values(dados.portas)) embarcados[g.porta] = g.leituras.filter(l => l.aceite && !l.repetida && l.t <= tt).length;
    }
    const hora = dados ? hhmm(Math.min(tt, fimVisual)) : '--:--';
    for (const [codigo, m] of Object.entries(modelo.linhas)) {
        const l = dados?.linhas[codigo], aberta = !l || l.aberta, fila = filas[codigo] ?? 0, chave = [aberta, fila, l?.tempo].join('|');
        if (m.sinal.chave === chave) continue;
        m.sinal.chave = chave;
        const g = m.sinal.canvas.getContext('2d'), W = 512, H = 192;
        g.fillStyle = '#0b1726'; g.fillRect(0, 0, W, H); g.fillStyle = aberta ? '#1f5fa8' : '#3a4350'; g.fillRect(0, 0, 168, H);
        texto(g, codigo, 84, 100, 92, '#ffffff', 700, 'center');
        if (!aberta) texto(g, 'FECHADA', 340, 100, 60, '#ff5a4d', 700, 'center');
        else { texto(g, l ? `${l.tempo} min / passageiro` : 'ABERTA', 340, 62, 34, '#3ddc84', 700, 'center', 320); texto(g, l ? `Fila: ${fila}` : '', 340, 132, 52, '#ffffff', 700, 'center'); }
        m.sinal.tex.needsUpdate = true;
    }
    const chaveQ = hora + '|' + Object.keys(K.LINHAS).map(c => filas[c] ?? 0).join(',') + '|' + (dados ? 1 : 0);
    if (modelo.quadro.chave !== chaveQ) {
        modelo.quadro.chave = chaveQ;
        const g = modelo.quadro.canvas.getContext('2d'), W = 1024, H = 512;
        g.fillStyle = '#081320'; g.fillRect(0, 0, W, H); g.fillStyle = '#16365f'; g.fillRect(0, 0, W, 88);
        texto(g, 'CONTROLO DE SEGURANÇA', 30, 46, 46, '#ffffff', 700); texto(g, hora, W - 30, 46, 50, '#ffd75a', 700, 'right');
        for (const [x, nome] of [[40, 'LINHA'], [250, 'ESTADO'], [560, 'NA FILA'], [770, 'ESPERA']]) texto(g, nome, x, 118, 26, '#7f95a8', 600);
        Object.keys(K.LINHAS).forEach((c, i) => {
            const l = dados?.linhas[c], y = 176 + i * 84, aberta = !l || l.aberta, fila = filas[c] ?? 0;
            if (i % 2 === 0) { g.fillStyle = '#0d1b2c'; g.fillRect(0, y - 40, W, 80); }
            texto(g, c, 40, y, 58, '#ffffff', 700); texto(g, aberta ? 'ABERTA' : 'FECHADA', 250, y, 46, aberta ? '#3ddc84' : '#ff5a4d', 700);
            if (aberta && l) { texto(g, String(fila), 560, y, 56, '#ffffff', 700); const e = (fila + 1) * l.tempo; texto(g, `${e} min`, 770, y, 50, e > 15 ? '#ff5a4d' : e > 8 ? '#f2b705' : '#ffffff', 700); }
        });
        modelo.quadro.tex.needsUpdate = true;
    }
    const lista = dados ? Object.values(dados.portas).sort((a, b) => a.hora - b.hora) : [], pisca = Math.floor(performance.now() / 600) % 2;
    const estados = lista.map(g => estadoDaPorta(g, tt));
    const chaveP = hora + '|' + lista.map((g, i) => [estados[i][1], embarcados[g.porta], estados[i][0] === 'ultima' ? pisca : 0]).join(';');
    if (modelo.painel.chave !== chaveP) {
        modelo.painel.chave = chaveP;
        const g = modelo.painel.canvas.getContext('2d'), W = 2048, H = 832;
        g.fillStyle = '#081320'; g.fillRect(0, 0, W, H); g.fillStyle = '#16365f'; g.fillRect(0, 0, W, 120);
        texto(g, 'PARTIDAS  ·  PORTAS DE EMBARQUE', 44, 62, 62, '#ffffff', 700); texto(g, hora, W - 44, 62, 70, '#ffd75a', 700, 'right');
        for (const [x, nome] of [[44, 'HORA'], [270, 'VOO'], [560, 'DESTINO'], [980, 'PORTA'], [1200, 'ESTADO'], [1830, 'A BORDO']]) texto(g, nome, x, 164, 32, '#7f95a8', 600);
        if (!dados) texto(g, 'Sem voos em embarque', W / 2, 460, 72, '#51667a', 600, 'center');
        lista.forEach((p, i) => {
            const y = 262 + i * 132, [fase, rotulo, cor] = estados[i];
            if (i % 2 === 0) { g.fillStyle = '#0d1b2c'; g.fillRect(0, y - 62, W, 124); }
            g.fillStyle = p.cor; g.beginPath(); g.arc(232, y, 18, 0, 7); g.fill();
            texto(g, hhmm(p.hora), 44, y, 68, '#ffd75a', 700); texto(g, p.voo, 270, y, 68, '#ffffff', 700); texto(g, String(p.destino).toUpperCase(), 560, y, 68, '#ffffff', 600, 'left', 400);
            texto(g, p.porta, 980, y, 68, '#ffffff', 700); texto(g, rotulo, 1200, y, 54, fase === 'ultima' && !pisca ? '#8a6a05' : cor, 700, 'left', 600);
            texto(g, `${embarcados[p.porta]}/${dados.voos[p.voo].total}`, 1830, y, 62, '#ffffff', 700);
        });
        modelo.painel.tex.needsUpdate = true;
    }
    for (const [codigo, m] of Object.entries(modelo.portas)) {
        const p = dados?.portas[codigo], [fase, rotulo, cor] = p ? estadoDaPorta(p, tt) : ['vazia', '', '#51667a'], voo = p ? dados.voos[p.voo] : null;
        const faltam = voo?.contagem && tt >= voo.contagem.minuto ? voo.contagem.faltas.length : null;
        const chave = [fase, rotulo, p ? embarcados[codigo] : '', faltam, fase === 'ultima' ? pisca : 0].join('|');
        if (m.ecra.chave !== chave) {
            m.ecra.chave = chave;
            const g = m.ecra.canvas.getContext('2d'), W = 1024, H = 432;
            g.fillStyle = '#0b1726'; g.fillRect(0, 0, W, H); g.fillStyle = p ? p.cor : '#3a4350'; g.fillRect(0, 0, 250, H);
            texto(g, codigo, 125, 190, 110, '#ffffff', 700, 'center'); texto(g, 'PORTA', 125, 300, 40, '#ffffff', 600, 'center');
            if (!p) texto(g, 'SEM VOO', 636, 216, 80, '#51667a', 700, 'center');
            else {
                texto(g, `${p.voo}  ${String(p.destino).toUpperCase()}`, 280, 74, 72, '#ffffff', 700, 'left', 520); texto(g, hhmm(p.hora), W - 30, 74, 76, '#ffd75a', 700, 'right');
                g.fillStyle = fase === 'ultima' && !pisca ? '#8a6a05' : cor; g.fillRect(250, 140, W - 250, 130); texto(g, rotulo, 636, 208, 72, '#0b1726', 700, 'center', 730);
                texto(g, faltam === null ? `A bordo: ${embarcados[codigo]} de ${voo.total}  ·  fecha às ${hhmm(p.fecho)}` : `A bordo: ${embarcados[codigo]} de ${voo.total}  ·  faltaram ${faltam}`, 280, 352, 46, '#cfe1f5', 600, 'left', 720);
            }
            m.ecra.tex.needsUpdate = true;
        }
        const aberta = p && tt >= p.abertura - 0.3 && tt < p.fecho + 0.4, k = aberta ? suave((tt - (p.abertura - 0.3)) / 0.3) * (1 - suave((tt - p.fecho) / 0.4)) : 0;
        for (const f of m.folhas) f.position.x = f.userData.x0 + f.userData.k * 0.98 * k;
        let luz = '#39424a';
        if (p) for (let i = p.leituras.length - 1; i >= 0; i--) { const l = p.leituras[i]; if (l.t <= tt) { if (tt - l.t < 0.12) luz = l.aceite ? '#3dff8a' : '#ff3b30'; break; } }
        m.lampada.material.color.set(luz); m.lampada.scale.setScalar(luz === '#39424a' ? 1 : 1.7);
    }
    return n;
}

function desenhar() {
    modelo.teto.visible = camera.position.y < K.ALTURA - 0.3;
    modelo.fundo.visible = camera.position.z > K.Z0 + 0.4;
    modelo.focar(controls.target.x, controls.target.z);
    const n = dados ? contar(dados, t) : null;
    desenharFixos(t, n);
    for (const m of Object.values(tabuleiros)) m.visible = false;
    if (!dados) return;
    for (const g of Object.values(dados.portas)) {                                  // a manga recolhe e o avião sai do lugar à hora da partida
        const e = modelo.estacionados[modelo.portas[g.porta].lugar], c = dados.voos[g.voo].contagem, parte = c ? g.hora + c.atraso : Infinity;
        const k = Math.max(0, Math.min(1, (t - (parte - 2.5)) / 1.5)), s = Math.max(0, t - parte);
        e.manga.rotation.y = e.dir - 0.42 * k * k * (3 - 2 * k);
        e.aviao.position.z = P_Z_NARIZ + Math.min(110, 14 * s * Math.min(1, s / 1.5));
    }
    for (const p of dados.passageiros) {
        const o = poses[p.i] = posePassageiro(dados, p, t, poses[p.i] ?? {}), malha = malhasPessoa[p.i];
        malha.visible = o.v;
        let anel = 0, bola = 0, altura = 0;
        if (o.v) {
            const geo = o.sentado ? malha.userData.geos.sentado : malha.userData.geos.pe; if (malha.geometry !== geo) malha.geometry = geo;
            o.y = o.anda ? Math.abs(Math.sin((o.x + o.z) * 3.3)) * 0.035 : 0;
            malha.position.set(o.x, o.y, o.z); malha.rotation.y = o.ry;
            altura = o.sentado ? 1.56 : 1.98; bola = p.cor ? 1 : 0;
            anel = p.terraDesde !== null && t >= p.terraDesde && !o.anda ? 1 : 0;
            if (o.k >= 0.12 && o.k < 0.93) {                                         // o tabuleiro atravessa o raios X
                const tab = tabuleiros[p.linha]; tab.visible = true;
                tab.position.set(mistura(X_TABULEIRO - 0.4, X_RECOLHA + 0.2, Math.max(0, Math.min(1, (o.k - 0.2) / 0.55))), 0.83, K.LINHAS[p.linha] + K.DZ_TAPETE);
            }
        }
        _m.compose(_v.set(o.x ?? 0, altura, o.z ?? 0), _q.identity(), _s.setScalar(bola)); bolas.setMatrixAt(p.i, _m);
        _m.compose(_v.set(o.x ?? 0, 0.03, o.z ?? 0), _q.identity(), _s.setScalar(anel)); aneis.setMatrixAt(p.i, _m);
    }
    bolas.instanceMatrix.needsUpdate = aneis.instanceMatrix.needsUpdate = true;
    if (seguido) {
        const p = seguido, o = poses[p.i];
        marcador.visible = o.v;
        if (o.v) {
            marcador.position.set(o.x, 2.3, o.z);
            _v.set(o.x, 1, o.z);
            if (aproximar) { aproximar = false; controls.target.copy(_v); camera.position.set(o.x + 3, 6.5, o.z + 9); }
            const passo = _v.sub(controls.target).multiplyScalar(0.08);
            controls.target.add(passo); camera.position.add(passo);
        }
        const passos = [];
        if (p.chegada !== null && t >= p.chegada) passos.push(`${hhmm(p.chegada)} · entrou na fila da linha ${p.linha}`);
        if (p.inicio !== null && t >= p.inicio) passos.push(`${hhmm(p.inicio)} · controlo na linha ${p.linha} (esperou ${p.inicio - p.chegada} min)`);
        if (p.livre !== null && t >= p.livre) passos.push(`${hhmm(p.livre)} · passou a segurança` + (p.destino1 ? ` e seguiu para a porta ${p.destino1}` + (p.destino1 !== p.porta ? ' (enganou-se: a sua é a ' + p.porta + ')' : '') : ''));
        for (const v of p.visitas) {
            if (t >= v.chega) passos.push(`${hhmm(v.chega)} · na fila da porta ${v.porta}`);
            if (v.leitura !== null && t >= v.leitura) passos.push(`${hhmm(v.leitura)} · cartão ${v.aceite ? 'aceite' : 'recusado (' + limpo(v.motivo) + ')'}` + (v.certo === false ? ` · <em style="color:#ffd400;font-style:normal">decisão errada${v.razoes.length ? ': ' + limpo(v.razoes.join(', ')) : ': estava em ordem'}</em>` : ''));
        }
        if (p.repetida && t >= p.repetida.t) passos.push(`${hhmm(p.repetida.t)} · passou o cartão outra vez: ${p.repetida.aceite ? '<em style="color:#ffd400;font-style:normal">aceite por engano</em>' : 'recusado'}`);
        if (p.perdeu !== null && t >= p.perdeu) passos.push(`${hhmm(p.perdeu)} · ficou em terra (${limpo({ atraso: 'chegou depois do fecho', tarde: 'chegou tarde das lojas', ausente: 'nunca apareceu', recusado: 'recusado na porta', 'noutro voo': 'entrou no avião errado' }[p.motivoPerdeu] ?? p.motivoPerdeu)})`);
        const chave = p.reserva + '|' + passos.length;
        if ($('bd-seguir').dataset.chave !== chave) {
            $('bd-seguir').dataset.chave = chave;
            const v = dados.voos[p.voo];
            $('bd-seguir').innerHTML = `<b>${limpo(p.nome).toUpperCase()}</b><div>Reserva ${limpo(p.reserva)} · voo ${limpo(p.voo)}${v ? ' para ' + limpo(v.destino) + ' · porta ' + limpo(p.porta) + ' · lugar ' + limpo(p.lugar) : ' (outro voo)'}</div>` +
                '<ol>' + passos.map(x => `<li>${x}</li>`).join('') + '</ol><button id="bd-largar">Deixar de seguir</button>';
            $('bd-largar').onclick = () => seguir(null);
        }
    }
    const quadro = [['Na fila da segurança', n.fila], ['No controlo', n.controlo], ['A caminho da porta', n.caminho], ['Nas portas', n.portas], ['Embarcados', n.embarcados], ['Em terra', n.terra, n.terra > dados.contagens.length * 0], ['Espera máxima', n.espera + ' min', n.espera > 20], ['Atraso nas portas', n.atraso + ' min', n.atraso]]
        .map(([r, v, mau]) => `<div${mau ? ' class="bd-mau"' : ''}><span>${r}</span>${v}</div>`).join('');
    if ($('bd-contadores').dataset.chave !== quadro) { $('bd-contadores').dataset.chave = quadro; $('bd-contadores').innerHTML = quadro; }
    const lista = dados.ocorrencias.filter(o => o.minuto <= t);                  // só o que já aconteceu, com o mais recente em cima
    if ($('bd-ocorrencias').dataset.n !== String(lista.length)) {
        $('bd-ocorrencias').dataset.n = lista.length; $('bd-ocorrencias').hidden = !lista.length;
        $('bd-ocorrencias').innerHTML = `<b>OCORRÊNCIAS · ${lista.length}</b><ul>` + lista.slice(-30).reverse().map(o => `<li>${hhmm(o.minuto)} · ${limpo(o.texto)}</li>`).join('') + (lista.length > 30 ? `<li>… e mais ${lista.length - 30} antes</li>` : '') + '</ul>';
    }
    const hora = hhmm(Math.min(t, fimVisual)); if ($('bd-hora').textContent !== hora) $('bd-hora').textContent = hora;
    $('bd-tempo').value = t;
}

function animar(agora) {
    ciclo = requestAnimationFrame(animar);
    const dt = Math.min(0.25, (agora - (ultimo || agora)) / 1000); ultimo = agora;
    if (dados && aReproduzir) {
        t = Math.min(fimVisual, t + dt * Number($('bd-velocidade').value));
        if (t >= fimVisual) aReproduzir = false;
    }
    $('bd-play').textContent = aReproduzir ? 'Ⅱ' : '▶';
    $('bd-checkin').hidden = !(dados?.origem === 'checkin' && window.checkinHall?.dados?.());
    $('bd-placa').hidden = !window.rampHall?.dados?.();
    $('bd-operacoes').hidden = !window.opsHall?.dados?.();
    controls.update();
    desenhar();
    renderer.render(scene, camera);
}

export function seguir(reserva) {
    seguido = reserva && dados ? dados.passageiros.find(p => p.reserva === reserva) ?? null : null;
    aproximar = !!seguido && camera.position.distanceTo(controls.target) > 24;      // de longe, a câmara aproxima-se do passageiro
    if (marcador) marcador.visible = false;
    $('bd-seguir').hidden = !seguido;
    $('bd-seguir').dataset.chave = '';
    $('bd-ocorrencias').style.visibility = seguido ? 'hidden' : '';
}

export function abrir() {
    if (!renderer) construir();
    window.dispatchEvent(new CustomEvent('hall-open', { detail: 'boarding' }));
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
$('bd-fechar').onclick = fechar;
$('bd-play').onclick = () => { if (!dados) return; if (t >= fimVisual) t = dados.inicio; aReproduzir = !aReproduzir; };
$('bd-tempo').oninput = e => { t = Number(e.target.value); aReproduzir = false; };
$('bd-vista').onchange = e => { seguir(null); vista(e.target.value); };
$('bd-checkin').onclick = () => window.checkinHall?.abrir();
$('bd-placa').onclick = () => window.rampHall?.abrir();
$('bd-operacoes').onclick = () => window.opsHall?.abrir();

window.addEventListener('boarding-run', e => { abrir(); carregar(e.detail); });
window.addEventListener('hall-open', e => { if (e.detail !== 'boarding' && sala.classList.contains('aberta')) fechar(); });
window.boardingHall = { abrir, fechar, seguir, vista, tempo: () => t, irPara: m => { t = m; aReproduzir = false; }, info: () => renderer && { ...renderer.info.render, geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures }, dados: () => dados };
