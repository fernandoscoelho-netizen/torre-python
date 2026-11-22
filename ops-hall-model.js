// Bloco 4 · Relatório do dia, Fase 6: geometria do centro de operações.
// Maquete didática de uma sala de controlo: parede de ecrãs com três painéis, mesa do dia com
// os quatro voos em miniatura e colunas que crescem com a manhã, e três filas de consolas com
// operadores, em degraus, viradas para a parede. Medidas em metros. Não reproduz nenhum
// centro de operações em concreto.
import * as THREE from 'three';
import { fundir } from './baggage-hall-model.js?v=bagagens-3';
import { geometriaAgente } from './checkin-hall-model.js?v=relatorio-1';
import { geometriaPassageiro } from './boarding-hall-model.js?v=relatorio-1';

export const C = {
    X0: -13, X1: 13, Z0: -9, Z1: 9.5, ALTURA: 6.4,
    Z_PAREDE: -8.72, Y_PAINEL: 3.42, LARG_PAINEL: 6.5, ALT_PAINEL: 4.3333, FOLGA: 0.16,
    MESA: { x: 0, z: -4.3, larg: 10.4, fundo: 2.7, alt: 0.92 },
    X_VOO: [-3.9, -1.3, 1.3, 3.9],                      // posição de cada voo na mesa do dia
    ESCALA_BARRA: 0.022,                               // metros de coluna por passageiro ou mala
    SERIES: ['aceites', 'embarcados', 'triadas', 'carregadas'],
    COR_SERIE: { aceites: '#3d9be9', embarcados: '#3ddc84', triadas: '#f2b705', carregadas: '#ff7a3d' },
    NOME_SERIE: { aceites: 'aceites no check-in', embarcados: 'embarcados', triadas: 'malas triadas', carregadas: 'malas no porão' },
};

// ---------------------------------------------------------------------------
function aleatorio(semente) { let s = semente >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function tela(w, h, pintar) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); pintar(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function repetir(t, x, y) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(x, y); return t; }
function ruido(g, w, h, n, cores, raio = 1.4) { const r = aleatorio(w * 31 + n); for (let i = 0; i < n; i++) { g.fillStyle = cores[Math.floor(r() * cores.length)]; g.globalAlpha = 0.25 + r() * 0.5; g.beginPath(); g.arc(r() * w, r() * h, r() * raio + 0.3, 0, 7); g.fill(); } g.globalAlpha = 1; }
const peca = (geo, cor, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { if (rx || ry || rz) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))); geo.translate(x, y, z); return [geo, cor]; };
const cx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cil = (r1, r2, h, n = 12) => new THREE.CylinderGeometry(r1, r2, h, n);

// Imagem parada de um monitor de consola: cada posto tem os seus quadros.
function monitor(tipo, semente) {
    return tela(256, 144, (g, w, h) => {
        const r = aleatorio(semente * 97 + tipo * 13 + 5);
        g.fillStyle = '#07121f'; g.fillRect(0, 0, w, h); g.fillStyle = '#12314f'; g.fillRect(0, 0, w, 16);
        g.fillStyle = '#9fc4e6'; g.fillRect(6, 5, 50 + r() * 60, 6);
        if (tipo === 0) {                                                           // lista de voos
            for (let y = 26; y < h - 6; y += 13) { g.fillStyle = y % 26 ? '#0d2238' : '#0a1a2c'; g.fillRect(4, y - 2, w - 8, 12); g.fillStyle = '#d7e3ee'; g.fillRect(8, y + 1, 26, 5); g.fillRect(44, y + 1, 50 + r() * 40, 5); g.fillStyle = r() < 0.25 ? '#ff6b5a' : '#3ddc84'; g.fillRect(w - 60, y + 1, 30 + r() * 18, 5); }
        } else if (tipo === 1) {                                                    // curvas
            g.strokeStyle = '#1c3a57'; g.lineWidth = 1; for (let y = 30; y < h; y += 22) { g.beginPath(); g.moveTo(8, y); g.lineTo(w - 8, y); g.stroke(); }
            for (const cor of ['#3d9be9', '#3ddc84', '#f2b705']) { g.strokeStyle = cor; g.lineWidth = 2; g.beginPath(); let y = h - 14; for (let x = 8; x < w - 8; x += 8) { y = Math.max(24, y - r() * 7); g.lineTo(x, y + r() * 5); } g.stroke(); }
        } else if (tipo === 2) {                                                    // planta com tapetes
            g.strokeStyle = '#3d9be9'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { const y = 34 + i * 26; g.beginPath(); g.moveTo(14, y); g.lineTo(w - 60 - r() * 40, y); g.lineTo(w - 30, y + (r() - 0.5) * 30); g.stroke(); }
            for (let i = 0; i < 26; i++) { g.fillStyle = r() < 0.12 ? '#ff6b5a' : '#f2b705'; g.fillRect(14 + r() * (w - 60), 30 + Math.floor(r() * 4) * 26, 5, 5); }
        } else if (tipo === 3) {                                                    // barras
            for (let i = 0; i < 9; i++) { const a = 20 + r() * (h - 50); g.fillStyle = ['#3d9be9', '#3ddc84', '#ff7a3d'][i % 3]; g.fillRect(14 + i * 26, h - 10 - a, 18, a); }
        } else if (tipo === 4) {                                                    // placa com quatro lugares
            g.strokeStyle = '#c0392b'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.strokeRect(12 + i * 60, 28, 50, 100); g.fillStyle = '#e8eef2'; g.fillRect(34 + i * 60, 44, 6, 62); g.fillRect(18 + i * 60, 70, 38, 6); }
        } else {                                                                    // mensagens
            for (let y = 26; y < h - 6; y += 11) { g.fillStyle = r() < 0.2 ? '#ffb4a8' : '#7f9bb5'; g.fillRect(8, y, 60 + r() * (w - 90), 4); }
        }
    });
}

// Avião em miniatura para a mesa do dia (nariz para -z); a deriva é uma peça à parte, com a cor do voo.
function miniatura() {
    const p = [];
    const fus = cil(0.062, 0.062, 0.84, 14); p.push(peca(fus, '#f2f3f1', 0, 0, 0, Math.PI / 2));
    const nariz = new THREE.SphereGeometry(0.062, 14, 10); nariz.scale(1, 1, 1.9); p.push(peca(nariz, '#f2f3f1', 0, 0, -0.42));
    const cauda = cil(0.062, 0.02, 0.26, 14); p.push(peca(cauda, '#f2f3f1', 0, 0.018, 0.55, Math.PI / 2));
    for (const k of [-1, 1]) {
        p.push(peca(cx(0.5, 0.014, 0.17), '#dfe2e2', k * 0.27, -0.02, 0.03, 0, -k * 0.42, k * 0.06));
        p.push(peca(cil(0.03, 0.03, 0.13, 10), '#16365f', k * 0.2, -0.062, -0.04, Math.PI / 2));
        p.push(peca(cx(0.19, 0.01, 0.08), '#dfe2e2', k * 0.11, 0.03, 0.6, 0, -k * 0.4, 0));
    }
    p.push(peca(cx(0.5, 0.012, 0.03), '#16365f', 0, 0.0, 0, 0, Math.PI / 2));           // faixa das janelas, só para dar leitura
    const deriva = new THREE.BufferGeometry();
    deriva.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.04, 0.42, 0, 0.04, 0.66, 0, 0.24, 0.68, 0, 0.04, 0.42, 0, 0.24, 0.68, 0, 0.24, 0.58]), 3));
    deriva.computeVertexNormals();
    return { corpo: fundir(p), deriva };
}

// ---------------------------------------------------------------------------
export function construirCentro(scene, renderer) {
    const sala = new THREE.Group(), teto = new THREE.Group(), tras = new THREE.Group();
    sala.name = 'Centro de operações — maquete didática'; scene.add(sala); sala.add(teto, tras);
    const M = (cor, rug = 0.8, met = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: rug, metalness: met, ...extra });
    const amb = tela(256, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#31465c'); gr.addColorStop(0.45, '#1b2a3b'); gr.addColorStop(0.55, '#3a5878'); gr.addColorStop(1, '#0d1620'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#bfe0ff'; g.fillRect(40, 54, 176, 14); });
    amb.mapping = THREE.EquirectangularReflectionMapping; const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(amb).texture; scene.environmentIntensity = 0.75; amb.dispose(); pm.dispose();

    const add = (geo, mat, x = 0, y = 0, z = 0, pai = sala, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; pai.add(m); return m; };
    const plano = (w, h, mat, x, y, z, ry = 0, pai = sala) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; pai.add(m); return m; };
    const horizontal = (w, d, mat, x, y, z, pai = sala) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; pai.add(m); return m; };
    const basico = (tex, extra = {}) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, ...extra });
    const letreiro = (texto, w, h, fundoCor, cor, x, y, z, ry = 0, pai = sala, fonte = 0.6) => plano(w, h, basico(tela(Math.round(256 * w / h), 256, (g, W, H) => {
        g.fillStyle = fundoCor; g.fillRect(0, 0, W, H); g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle';
        let tam = H * fonte; g.font = `700 ${tam}px Arial, sans-serif`; const larg = g.measureText(texto).width; if (larg > W * 0.92) { tam *= W * 0.92 / larg; g.font = `700 ${tam}px Arial, sans-serif`; }
        g.fillText(texto, W / 2, H * 0.54);
    })), x, y, z, ry, pai);
    const ecra = (w, h, pxW, pxH, x, y, z, pai = sala) => { const canvas = document.createElement('canvas'); canvas.width = pxW; canvas.height = pxH; const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; const malha = plano(w, h, basico(tex), x, y, z, 0, pai); return { canvas, tex, malha, chave: null }; };

    const LARG = C.X1 - C.X0, FUNDO = C.Z1 - C.Z0, ZM = (C.Z0 + C.Z1) / 2, A = C.ALTURA;
    const GRAFITE = '#1c2128', ANTRACITE = '#2a3038', INOX = '#8e969c', AZUL = '#16365f', LED = '#58b7ff';
    const objetos = [], metal = [], luzes = [];
    const matPessoas = M('#ffffff', 0.8, 0, { vertexColors: true });

    // --- Pavimento em degraus, paredes e teto -------------------------------------------------------
    const alcatifa = tela(512, 512, (g, w) => { g.fillStyle = '#27323f'; g.fillRect(0, 0, w, w); ruido(g, w, w, 14000, ['#222c38', '#2d3947', '#1e2732', '#344252'], 1.3); g.strokeStyle = '#1b232d'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, w); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); } });
    const matChao = M('#ffffff', 0.95, 0, { map: repetir(alcatifa, LARG / 2.4, FUNDO / 2.4) });
    horizontal(LARG, FUNDO, matChao, 0, 0, ZM);
    const DEGRAUS = [[3.1, 0.34], [6.1, 0.68]];                                    // [z onde começa, altura]
    for (const [z, h] of DEGRAUS) {
        add(cx(LARG, h, C.Z1 - z), M('#ffffff', 0.95, 0, { map: repetir(alcatifa.clone(), LARG / 2.4, (C.Z1 - z) / 2.4) }), 0, h / 2, (z + C.Z1) / 2);
        luzes.push(peca(cx(LARG - 0.6, 0.035, 0.03), LED, 0, h - 0.06, z - 0.012));                    // fita de luz no espelho do degrau
    }
    const parede = M('#222a34', 0.92), painelParede = tela(256, 256, (g, w) => { g.fillStyle = '#28313c'; g.fillRect(0, 0, w, w); g.fillStyle = '#1f2730'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 3, w); });
    const matLateral = M('#ffffff', 0.9, 0, { map: repetir(painelParede, FUNDO / 2, 1) });
    plano(LARG, A, parede, 0, A / 2, C.Z0);                                                              // parede dos ecrãs
    plano(FUNDO, A, matLateral, C.X0, A / 2, ZM, Math.PI / 2); plano(FUNDO, A, matLateral, C.X1, A / 2, ZM, -Math.PI / 2);
    plano(LARG, A, parede, 0, A / 2, C.Z1, Math.PI, tras);
    for (const s of [-1, 1]) {
        luzes.push(peca(cx(0.03, 0.05, FUNDO - 1), LED, s * (C.X1 - 0.03), 2.75, ZM));
        letreiro(s < 0 ? 'OPERAÇÕES' : 'PORTO · TORRE PYTHON', 5.4, 0.5, '#222a34', '#6f8296', s * (C.X1 - 0.04), 4.6, 1.5, -s * Math.PI / 2);
    }
    const tetoTex = tela(256, 256, (g, w) => { g.fillStyle = '#161b22'; g.fillRect(0, 0, w, w); g.strokeStyle = '#232a33'; g.lineWidth = 3; g.strokeRect(0, 0, w, w); g.fillStyle = '#dfeeff'; g.fillRect(98, 110, 60, 36); });
    const mTeto = new THREE.Mesh(new THREE.PlaneGeometry(LARG, FUNDO), new THREE.MeshBasicMaterial({ map: repetir(tetoTex, LARG / 2, FUNDO / 2) })); mTeto.rotation.x = Math.PI / 2; mTeto.position.set(0, A, ZM); teto.add(mTeto);

    // --- Parede de ecrãs --------------------------------------------------------------------------
    const LP = C.LARG_PAINEL, AP = C.ALT_PAINEL, passo = LP + C.FOLGA, larguraTotal = 3 * LP + 2 * C.FOLGA;
    objetos.push(peca(cx(larguraTotal + 0.5, AP + 0.5, 0.24), '#0c1016', 0, C.Y_PAINEL, C.Z_PAREDE - 0.14));
    objetos.push(peca(cx(larguraTotal + 1.4, 0.9, 0.5), ANTRACITE, 0, 0.45, C.Z_PAREDE - 0.02));            // móvel técnico por baixo
    luzes.push(peca(cx(larguraTotal + 0.5, 0.04, 0.03), LED, 0, C.Y_PAINEL - AP / 2 - 0.3, C.Z_PAREDE + 0.02));
    const paineis = {};
    ['numeros', 'curvas', 'relatorio'].forEach((nome, i) => {
        const x = (i - 1) * passo;
        paineis[nome] = ecra(LP, AP, 1536, 1024, x, C.Y_PAINEL, C.Z_PAREDE, sala);
        paineis[nome].x = x;
    });
    letreiro('CENTRO DE OPERAÇÕES', 7.2, 0.46, '#222a34', '#9fb3c2', 0, C.Y_PAINEL + AP / 2 + 0.52, C.Z0 + 0.03);

    // --- Mesa do dia: os quatro voos em miniatura e as colunas que crescem com a manhã ----------------
    const ms = C.MESA, topo = ms.alt;
    objetos.push(peca(cx(ms.larg, 0.1, ms.fundo), '#0e141b', ms.x, topo - 0.05, ms.z), peca(cx(ms.larg - 0.5, topo - 0.2, ms.fundo - 0.6), ANTRACITE, ms.x, (topo - 0.2) / 2 + 0.1, ms.z), peca(cx(ms.larg - 0.3, 0.1, ms.fundo - 0.4), '#11161d', ms.x, 0.05, ms.z));
    luzes.push(peca(cx(ms.larg - 0.52, 0.03, 0.02), LED, ms.x, 0.16, ms.z + (ms.fundo - 0.6) / 2 + 0.012));
    const tampo = tela(2048, 532, (g, w, h) => {
        g.fillStyle = '#101923'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#1c2c3d'; g.lineWidth = 2; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        const px = x => (x - (ms.x - ms.larg / 2)) / ms.larg * w;
        for (const x of C.X_VOO) { g.strokeStyle = '#c0392b'; g.lineWidth = 5; g.strokeRect(px(x) - 150, 26, 300, 250); g.strokeStyle = '#f2c40f'; g.lineWidth = 4; g.beginPath(); g.moveTo(px(x), 40); g.lineTo(px(x), 264); g.stroke(); }
        g.fillStyle = '#58b7ff'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
    });
    horizontal(ms.larg - 0.12, ms.fundo - 0.12, M('#ffffff', 0.7, 0.0, { map: tampo, envMapIntensity: 0.5 }), ms.x, topo + 0.002, ms.z);
    const mini = miniatura(), matMini = M('#ffffff', 0.35, 0.2, { vertexColors: true });
    const voos = C.X_VOO.map((x, i) => {
        const grupo = new THREE.Group(); grupo.position.set(x, topo, ms.z); sala.add(grupo);
        const aviao = new THREE.Group(); aviao.position.set(0, 0.11, -0.45); grupo.add(aviao);
        add(mini.corpo, matMini, 0, 0, 0, aviao);
        const deriva = M('#16365f', 0.5, 0.1, { side: THREE.DoubleSide }); add(mini.deriva, deriva, 0, 0, 0, aviao);
        const barras = {};
        C.SERIES.forEach((serie, k) => {
            const geo = cx(0.19, 1, 0.19); geo.translate(0, 0.5, 0);
            const m = add(geo, M(C.COR_SERIE[serie], 0.35, 0.1, { emissive: C.COR_SERIE[serie], emissiveIntensity: 0.35 }), (k - 1.5) * 0.3, 0.004, 0.52, grupo);
            m.scale.y = 0.001; barras[serie] = m;
            add(cx(0.23, 0.012, 0.23), M('#05080c', 0.5), (k - 1.5) * 0.3, 0.006, 0.52, grupo, false);
        });
        const etiqueta = (() => { const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160; const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.47), basico(tex)); m.position.set(0, 0.2, 1.05); m.rotation.x = -0.95; grupo.add(m); return { canvas, tex, chave: null }; })();
        add(cx(1.56, 0.53, 0.03).rotateX(-0.95), M('#05080c', 0.5), 0, 0.184, 1.038, grupo, false);
        const lampada = add(new THREE.SphereGeometry(0.055, 14, 10), new THREE.MeshBasicMaterial({ color: '#39424a', toneMapped: false }), 0.86, 0.06, 0.52, grupo, false);
        return { grupo, aviao, deriva, barras, etiqueta, lampada, x };
    });
    letreiro('■ aceites no check-in   ■ embarcados   ■ malas triadas   ■ malas no porão', 6.2, 0.2, '#0e141b', '#9fb3c2', ms.x, topo - 0.32, ms.z + (ms.fundo - 0.6) / 2 + 0.014);

    // --- Consolas: três filas em degraus, com monitores, cadeiras e operadores -------------------------
    const POSTOS = ['CHECK-IN', 'TRIAGEM', 'SEGURANÇA', 'EMBARQUE', 'PLACA', 'PISTA', 'METEO', 'MANUTENÇÃO', 'SUPERVISÃO', 'CHEFE DE TURNO', 'COMUNICAÇÕES'];
    const FILAS = [[1.3, 0, [-6.6, -2.2, 2.2, 6.6]], [4.4, 0.34, [-6.6, -2.2, 2.2, 6.6]], [7.3, 0.68, [-4.6, 0, 4.6]]];
    const ecras = [];
    let posto = 0;
    for (const [z, y, xs] of FILAS) for (const x of xs) {
        const larg = 3.6, ry = -x * 0.022;                                           // a consola roda um pouco para o centro da parede
        const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; sala.add(g);
        const p = [], mt = [];
        p.push(peca(cx(larg, 0.05, 1.0), '#3a4450', 0, 0.75, 0), peca(cx(larg, 0.62, 0.05), ANTRACITE, 0, 0.41, -0.46), peca(cx(larg, 0.3, 0.26), ANTRACITE, 0, 0.92, -0.37));
        for (const k of [-1, 1]) p.push(peca(cx(0.05, 0.73, 0.95), ANTRACITE, k * (larg / 2 - 0.025), 0.365, 0));
        p.push(peca(cx(larg - 0.3, 0.02, 0.02), LED, 0, 0.71, 0.47));
        for (let m = 0; m < 4; m++) {
            const xm = (m - 1.5) * 0.82;
            p.push(peca(cx(0.74, 0.44, 0.035), GRAFITE, xm, 1.36, -0.2, 0.1, -(m - 1.5) * 0.16), peca(cx(0.06, 0.2, 0.05), GRAFITE, xm, 1.12, -0.24), peca(cx(0.22, 0.015, 0.16), GRAFITE, xm, 1.075, -0.24));
            const e = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), basico(monitor((posto + m * 2) % 6, posto * 4 + m))); e.position.set(xm + Math.sin((m - 1.5) * 0.16) * -0.02, 1.36, -0.18); e.rotation.set(0.1, -(m - 1.5) * 0.16, 0, 'YXZ'); g.add(e); ecras.push(e);
        }
        for (const xo of [-0.9, 0.9]) {
            p.push(peca(cx(0.44, 0.02, 0.15), '#0f1318', xo, 0.785, 0.2), peca(cx(0.06, 0.03, 0.1), '#0f1318', xo + 0.34, 0.79, 0.22));                 // teclado e rato
            // cadeira
            p.push(peca(cx(0.5, 0.08, 0.48), '#11161c', xo, 0.47, 0.82), peca(cx(0.46, 0.6, 0.07), '#11161c', xo, 0.82, 1.06, -0.12), peca(cil(0.035, 0.035, 0.32, 8), INOX, xo, 0.28, 0.82));
            for (let b = 0; b < 5; b++) mt.push(peca(cx(0.05, 0.035, 0.3), INOX, xo + Math.sin(b * 1.2566) * 0.15, 0.09, 0.82 + Math.cos(b * 1.2566) * 0.15, 0, b * 1.2566));
            for (const k of [-1, 1]) p.push(peca(cx(0.05, 0.04, 0.3), '#11161c', xo + k * 0.27, 0.66, 0.84));
            if (aleatorio(posto * 7 + (xo > 0 ? 3 : 1))() < 0.8) { const op = add(geometriaPassageiro(900 + posto * 2 + (xo > 0 ? 1 : 0), true), matPessoas, xo, 0.05, 0.9, g); op.rotation.y = Math.PI; }
        }
        p.push(peca(cx(0.16, 0.06, 0.2), '#0f1318', 0, 0.8, 0.12), peca(cil(0.04, 0.035, 0.1, 10), '#e9e5da', 1.5, 0.83, 0.25));                         // telefone e caneca
        add(fundir(p), M('#ffffff', 0.6, 0.1, { vertexColors: true }), 0, 0, 0, g);
        add(fundir(mt), M('#ffffff', 0.35, 0.6, { vertexColors: true }), 0, 0, 0, g);
        const nome = POSTOS[posto % POSTOS.length];
        letreiro(nome, 1.1, 0.16, AZUL, '#ffffff', 0, 0.93, -0.235, 0, g);                                 // placa virada para os operadores
        letreiro(nome, 1.4, 0.2, AZUL, '#ffffff', 0, 0.5, -0.489, Math.PI, g);                             // e outra virada para a parede
        posto++;
    }
    // Chefe de turno de pé, junto à mesa do dia, e um colega a meio da sala
    add(geometriaAgente(31), matPessoas, ms.x + ms.larg / 2 + 0.75, 0, ms.z + 0.3).rotation.y = -Math.PI / 2 - 0.4;
    add(geometriaAgente(47), matPessoas, -8.4, 0, -1.6).rotation.y = Math.PI * 0.82;

    // Guarda-corpos dos degraus e vasos nos cantos
    for (const [z, h] of DEGRAUS) for (const s of [-1, 1]) { metal.push(peca(cx(0.04, 0.9, 0.04), INOX, s * 11.9, h + 0.45, z + 0.1), peca(cx(0.04, 0.9, 0.04), INOX, s * 9.6, h + 0.45, z + 0.1), peca(cx(2.34, 0.04, 0.04), INOX, s * 10.75, h + 0.9, z + 0.1), peca(cx(2.34, 0.03, 0.03), INOX, s * 10.75, h + 0.5, z + 0.1)); }
    for (const s of [-1, 1]) {
        const r = aleatorio(s + 9);
        objetos.push(peca(cil(0.3, 0.24, 0.6, 14), '#3a424b', s * 11.9, 0.3, -7.6));
        for (let k = 0; k < 10; k++) objetos.push(peca(new THREE.ConeGeometry(0.15, 1.0 + r() * 0.7, 5), k % 2 ? '#2f6a3a' : '#44834d', s * 11.9 + (r() - 0.5) * 0.36, 1.0 + r() * 0.3, -7.6 + (r() - 0.5) * 0.36, (r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7));
    }

    add(fundir(objetos), M('#ffffff', 0.6, 0.1, { vertexColors: true }));
    add(fundir(metal), M('#ffffff', 0.35, 0.6, { vertexColors: true }));
    add(fundir(luzes), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), 0, 0, 0, sala, false);

    // --- Luz: sala em penumbra, com a claridade dos ecrãs e focos sobre as consolas -----------------
    scene.add(new THREE.HemisphereLight('#9fb6d0', '#1a2028', 0.9));
    const foco = new THREE.DirectionalLight('#dfeaff', 1.5); foco.position.set(5, 16, 9); foco.target.position.set(0, 0, 0); foco.castShadow = true; foco.shadow.mapSize.set(2048, 2048);
    Object.assign(foco.shadow.camera, { left: -17, right: 17, top: 15, bottom: -15, near: 2, far: 45 }); foco.shadow.bias = -0.0005; foco.shadow.normalBias = 0.05; scene.add(foco); scene.add(foco.target);
    const claridade = new THREE.PointLight('#7fb8ff', 60, 22, 1.6); claridade.position.set(0, 3.6, -6.4); scene.add(claridade);     // o que a parede de ecrãs devolve à sala
    const daMesa = new THREE.PointLight('#8fd0ff', 12, 7, 1.8); daMesa.position.set(0, 2.2, ms.z); scene.add(daMesa);

    return { sala, teto, tras, paineis, voos, matPessoas };
}
