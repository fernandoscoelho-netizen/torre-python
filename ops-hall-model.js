// Bloco 4 · Relatório do dia, Fase 6: geometria do centro de operações (versão clara).
// Maquete didática de uma sala de controlo: parede de ecrãs com três painéis, mesa do dia com
// os quatro voos em miniatura e colunas que crescem com a manhã, e três filas de consolas com
// operadores, em degraus, viradas para a parede. Sala clara, com janela para a placa, teto com
// painéis de luz, materiais PBR com texturas geradas no próprio código (não depende de ficheiros
// externos). Medidas em metros. Não reproduz nenhum centro de operações em concreto.
import * as THREE from 'three';

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
// Utilitários
function aleatorio(semente) { let s = semente >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function tela(w, h, pintar, cor = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); pintar(g, w, h);
    const t = new THREE.CanvasTexture(c); if (cor) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function repetir(t, x, y) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(x, y); return t; }
function ruido(g, w, h, n, cores, raio = 1.4, semente = 1, alfa = [0.25, 0.5]) { const r = aleatorio(w * 31 + n + semente); for (let i = 0; i < n; i++) { g.fillStyle = cores[Math.floor(r() * cores.length)]; g.globalAlpha = alfa[0] + r() * alfa[1]; g.beginPath(); g.arc(r() * w, r() * h, r() * raio + 0.3, 0, 7); g.fill(); } g.globalAlpha = 1; }
const peca = (geo, cor, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { if (rx || ry || rz) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))); geo.translate(x, y, z); return [geo, cor]; };
const cx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cil = (r1, r2, h, n = 14) => new THREE.CylinderGeometry(r1, r2, h, n);
const esf = (r, sx = 1, sy = 1, sz = 1, n = 10) => { const g = new THREE.SphereGeometry(r, n, Math.max(8, Math.round(n * 0.7))); g.scale(sx, sy, sz); return g; };
// Caixa de cantos arredondados (perfil arredondado extrudido em z), para tampos, monitores e almofadas.
function caixaRedonda(w, h, d, r = 0.02, seg = 3) {
    const b = Math.min(r * 0.6, d / 3), bs = b * 0.8;                                 // o chanfro alarga a forma: desconta-se
    w -= 2 * bs; h -= 2 * bs; r = Math.max(1e-3, Math.min(r - bs, w / 2 - 1e-3, h / 2 - 1e-3));
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: bs, bevelSegments: seg, curveSegments: seg });
    g.translate(0, 0, -(d - 2 * b) / 2); g.computeVertexNormals(); return g;
}
// Cilindro entre dois pontos (membros, braços de monitor, tubos).
const _y = new THREE.Vector3(0, 1, 0);
function membro(a, b, r1, r2 = r1, n = 8) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const g = cil(r2, r1, L, n); g.translate(0, L / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_y, d.normalize())); g.translate(A.x, A.y, A.z); return g;
}

// Junta peças [geometria, cor] numa só malha com cor por vértice. As coordenadas de textura são
// projetadas pela normal (mapeamento em caixa), com a mesma densidade em todas as peças: assim a
// mesma textura de madeira, tecido ou metal serve a peças de tamanhos diferentes sem esticar.
export function fundir(pecas, metrosPorTextura = 1) {
    let n = 0;
    const prontas = pecas.map(([geo, cor]) => { const g = geo.index ? geo.toNonIndexed() : geo; if (!g.attributes.normal) g.computeVertexNormals(); n += g.attributes.position.count; return [g, new THREE.Color(cor)]; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const [g, c] of prontas) {
        const P = g.attributes.position.array, N = g.attributes.normal.array;
        pos.set(P, o * 3); nor.set(N, o * 3);
        for (let i = 0; i < g.attributes.position.count; i++) {
            col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b;
            const ax = Math.abs(N[i * 3]), ay = Math.abs(N[i * 3 + 1]), az = Math.abs(N[i * 3 + 2]);
            const [u, v] = ax >= ay && ax >= az ? [P[i * 3 + 2], P[i * 3 + 1]] : ay >= az ? [P[i * 3], P[i * 3 + 2]] : [P[i * 3], P[i * 3 + 1]];
            uv[(o + i) * 2] = u / metrosPorTextura; uv[(o + i) * 2 + 1] = v / metrosPorTextura;
        }
        o += g.attributes.position.count;
    }
    const f = new THREE.BufferGeometry();
    f.setAttribute('position', new THREE.BufferAttribute(pos, 3)); f.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    f.setAttribute('color', new THREE.BufferAttribute(col, 3)); f.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return f;
}

// ---------------------------------------------------------------------------
// Texturas geradas (cor + relevo)
function texMadeira(clara = true) {
    return tela(512, 512, (g, w, h) => {
        const r = aleatorio(clara ? 11 : 12);
        g.fillStyle = clara ? '#c9a57c' : '#8a6544'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 26; i++) {                                                // tábuas com tons ligeiramente diferentes
            const y = i * h / 26; g.fillStyle = `hsla(${28 + r() * 8},${35 + r() * 15}%,${clara ? 58 + r() * 10 : 36 + r() * 8}%,0.55)`; g.fillRect(0, y, w, h / 26 + 1);
        }
        for (let i = 0; i < 420; i++) {                                               // veios
            const y0 = r() * h, amp = 2 + r() * 6, fase = r() * 6, comp = 0.006 + r() * 0.01;
            g.strokeStyle = `rgba(${clara ? '110,72,40' : '60,38,20'},${0.05 + r() * 0.14})`; g.lineWidth = 0.6 + r() * 1.4; g.beginPath();
            for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 + Math.sin(x * comp + fase) * amp); g.stroke();
        }
        ruido(g, w, h, 3000, ['#00000014', '#ffffff14'], 1, 3);
    });
}
function texAlcatifa() {
    return tela(512, 512, (g, w) => {
        const t = w / 4, r = aleatorio(5);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {                      // ladrilhos de alcatifa em quarto de volta
            g.fillStyle = (i + j) % 2 ? '#7a828c' : '#727a84'; g.fillRect(i * t, j * t, t, t);
            g.strokeStyle = 'rgba(60,66,74,0.18)'; g.lineWidth = 1;
            for (let k = 2; k < t; k += 4) { g.beginPath(); if ((i + j) % 2) { g.moveTo(i * t + k, j * t); g.lineTo(i * t + k, j * t + t); } else { g.moveTo(i * t, j * t + k); g.lineTo(i * t + t, j * t + k); } g.stroke(); }
        }
        ruido(g, w, w, 16000, ['#6e757d', '#a2a8ae', '#7a8088', '#5d6a7a'], 1.1, 7, [0.2, 0.4]);
        g.strokeStyle = 'rgba(50,55,62,0.35)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, w); g.moveTo(0, i * t); g.lineTo(w, i * t); g.stroke(); }
        void r;
    });
}
function texRipado() {                                                               // painel acústico de ripas de madeira sobre feltro escuro
    return tela(512, 512, (g, w, h) => {
        const r = aleatorio(21);
        g.fillStyle = '#3b3a38'; g.fillRect(0, 0, w, h);
        const n = 16, passo = w / n;
        for (let i = 0; i < n; i++) {
            const x = i * passo + passo * 0.18, lw = passo * 0.64;
            const gr = g.createLinearGradient(x, 0, x + lw, 0); const l = 60 + r() * 8;
            gr.addColorStop(0, `hsl(30,38%,${l - 10}%)`); gr.addColorStop(0.5, `hsl(31,40%,${l}%)`); gr.addColorStop(1, `hsl(30,38%,${l - 14}%)`);
            g.fillStyle = gr; g.fillRect(x, 0, lw, h);
            for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(110,70,40,${0.08 + r() * 0.12})`; g.lineWidth = 0.8; const xx = x + r() * lw; g.beginPath(); g.moveTo(xx, 0); g.bezierCurveTo(xx + 3, h * 0.3, xx - 3, h * 0.7, xx + (r() - 0.5) * 4, h); g.stroke(); }
        }
    });
}
function texTecido(base = '#4a5462') {
    return tela(256, 256, (g, w) => {
        g.fillStyle = base; g.fillRect(0, 0, w, w);
        for (let y = 0; y < w; y += 3) { g.fillStyle = y % 6 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; g.fillRect(0, y, w, 1.5); }
        for (let x = 0; x < w; x += 3) { g.fillStyle = x % 6 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)'; g.fillRect(x, 0, 1.5, w); }
        ruido(g, w, w, 2500, ['#00000020', '#ffffff18'], 0.8, 9);
    });
}
function texEscovado() {                                                             // metal escovado (cinzento neutro, a cor vem do vértice)
    return tela(256, 256, (g, w) => {
        g.fillStyle = '#d4d7da'; g.fillRect(0, 0, w, w); const r = aleatorio(4);
        for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '90,95,100'},${0.05 + r() * 0.12})`; g.fillRect(0, r() * w, w, 0.6 + r()); }
    });
}
function texEstuque() {
    return tela(256, 256, (g, w) => { g.fillStyle = '#eef0f1'; g.fillRect(0, 0, w, w); ruido(g, w, w, 5000, ['#dcdfe2', '#f8f9fa', '#e3e6e9'], 1.2, 13, [0.3, 0.5]); });
}
function texLaminado() {
    return tela(256, 256, (g, w) => { g.fillStyle = '#e8e8e6'; g.fillRect(0, 0, w, w); ruido(g, w, w, 4000, ['#d9d9d6', '#f4f4f2', '#cfd0cd'], 0.9, 17, [0.2, 0.4]); });
}

// Imagem parada de um monitor de consola: cada posto tem os seus quadros.
function monitor(tipo, semente) {
    return tela(256, 144, (g, w, h) => {
        const r = aleatorio(semente * 97 + tipo * 13 + 5);
        g.fillStyle = '#0b1a2b'; g.fillRect(0, 0, w, h); g.fillStyle = '#16406a'; g.fillRect(0, 0, w, 16);
        g.fillStyle = '#cfe4f7'; g.fillRect(6, 5, 50 + r() * 60, 6);
        if (tipo === 0) {                                                           // lista de voos
            for (let y = 26; y < h - 6; y += 13) { g.fillStyle = y % 26 ? '#112a44' : '#0d2238'; g.fillRect(4, y - 2, w - 8, 12); g.fillStyle = '#e3edf6'; g.fillRect(8, y + 1, 26, 5); g.fillRect(44, y + 1, 50 + r() * 40, 5); g.fillStyle = r() < 0.25 ? '#ff6b5a' : '#3ddc84'; g.fillRect(w - 60, y + 1, 30 + r() * 18, 5); }
        } else if (tipo === 1) {                                                    // curvas
            g.strokeStyle = '#23466a'; g.lineWidth = 1; for (let y = 30; y < h; y += 22) { g.beginPath(); g.moveTo(8, y); g.lineTo(w - 8, y); g.stroke(); }
            for (const cor of ['#3d9be9', '#3ddc84', '#f2b705']) { g.strokeStyle = cor; g.lineWidth = 2; g.beginPath(); let y = h - 14; for (let x = 8; x < w - 8; x += 8) { y = Math.max(24, y - r() * 7); g.lineTo(x, y + r() * 5); } g.stroke(); }
        } else if (tipo === 2) {                                                    // planta com tapetes
            g.strokeStyle = '#3d9be9'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { const y = 34 + i * 26; g.beginPath(); g.moveTo(14, y); g.lineTo(w - 60 - r() * 40, y); g.lineTo(w - 30, y + (r() - 0.5) * 30); g.stroke(); }
            for (let i = 0; i < 26; i++) { g.fillStyle = r() < 0.12 ? '#ff6b5a' : '#f2b705'; g.fillRect(14 + r() * (w - 60), 30 + Math.floor(r() * 4) * 26, 5, 5); }
        } else if (tipo === 3) {                                                    // barras
            for (let i = 0; i < 9; i++) { const a = 20 + r() * (h - 50); g.fillStyle = ['#3d9be9', '#3ddc84', '#ff7a3d'][i % 3]; g.fillRect(14 + i * 26, h - 10 - a, 18, a); }
        } else if (tipo === 4) {                                                    // placa com quatro lugares
            g.fillStyle = '#26323e'; g.fillRect(6, 22, w - 12, h - 28);
            g.strokeStyle = '#e8c547'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.strokeRect(14 + i * 60, 30, 50, 96); g.fillStyle = '#e8eef2'; g.fillRect(36 + i * 60, 46, 6, 62); g.fillRect(20 + i * 60, 70, 38, 6); }
        } else {                                                                    // mensagens
            for (let y = 26; y < h - 6; y += 11) { g.fillStyle = r() < 0.2 ? '#ffb4a8' : '#8fb0cf'; g.fillRect(8, y, 60 + r() * (w - 90), 4); }
        }
    });
}

// Vista pela janela: céu, terminal ao fundo, placa com aviões e pista.
function texJanela() {
    return tela(2048, 512, (g, w, h) => {
        const r = aleatorio(77);
        const ceu = g.createLinearGradient(0, 0, 0, h * 0.62); ceu.addColorStop(0, '#7fb2e5'); ceu.addColorStop(0.7, '#cfe3f4'); ceu.addColorStop(1, '#eef4f8'); g.fillStyle = ceu; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 18; i++) { const x = r() * w, y = 30 + r() * 140, s = 40 + r() * 120; g.fillStyle = 'rgba(255,255,255,0.55)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(x + (r() - 0.5) * s, y + (r() - 0.5) * s * 0.2, s * (0.3 + r() * 0.4), s * (0.1 + r() * 0.12), 0, 0, 7); g.fill(); } }
        const hz = h * 0.6;
        g.fillStyle = '#9aa7a0'; for (let x = 0; x < w; x += 40) { const a = 6 + r() * 18; g.fillRect(x, hz - a, 40, a); }          // colinas e arvoredo distantes
        g.fillStyle = '#b8bfc4'; g.fillRect(0, hz, w, h - hz);                                                                         // placa de betão
        g.fillStyle = '#6d757b'; g.fillRect(0, hz + 18, w, 26); g.fillStyle = '#f4f4f4'; for (let x = 0; x < w; x += 70) g.fillRect(x, hz + 30, 36, 2);   // pista com eixo
        g.fillStyle = '#d8dde1'; g.fillRect(260, hz - 70, 900, 70); g.fillStyle = '#7d93a8'; g.fillRect(260, hz - 62, 900, 26);      // terminal com fachada envidraçada
        g.fillStyle = '#aeb6bc'; g.fillRect(1500, hz - 120, 26, 120); g.fillStyle = '#cfd6db'; g.fillRect(1470, hz - 150, 86, 34); g.fillStyle = '#5f7f9c'; g.fillRect(1474, hz - 144, 78, 18);   // torre de controlo
        g.strokeStyle = '#e8c547'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(140 + i * 300, h); g.lineTo(220 + i * 300, hz + 50); g.stroke(); }
        const aviao = (x, y, s, cauda) => {                                                                                         // avião de lado, simplificado
            g.fillStyle = '#f5f6f7'; g.beginPath(); g.ellipse(x, y, 120 * s, 15 * s, 0, 0, 7); g.fill();
            g.beginPath(); g.moveTo(x + 90 * s, y - 8 * s); g.lineTo(x + 128 * s, y - 62 * s); g.lineTo(x + 140 * s, y - 62 * s); g.lineTo(x + 122 * s, y - 4 * s); g.fill();
            g.fillStyle = cauda; g.beginPath(); g.moveTo(x + 104 * s, y - 26 * s); g.lineTo(x + 128 * s, y - 62 * s); g.lineTo(x + 140 * s, y - 62 * s); g.lineTo(x + 124 * s, y - 20 * s); g.fill();
            g.fillStyle = '#c9ced3'; g.beginPath(); g.ellipse(x - 6 * s, y + 9 * s, 50 * s, 6 * s, 0, 0, 7); g.fill();
            g.fillStyle = '#7c8794'; g.beginPath(); g.ellipse(x - 20 * s, y + 16 * s, 16 * s, 7 * s, 0, 0, 7); g.fill();
            g.fillStyle = '#2a3440'; for (let k = -90; k < 80; k += 9) g.fillRect(x + k * s, y - 5 * s, 4 * s, 4 * s);
            g.fillStyle = '#333'; g.fillRect(x - 70 * s, y + 13 * s, 3 * s, 12 * s); g.fillRect(x + 10 * s, y + 13 * s, 3 * s, 12 * s);
        };
        aviao(560, hz + 92, 1.15, '#16365f'); aviao(1250, hz + 110, 1.35, '#c0392b'); aviao(1820, hz + 74, 0.8, '#2e86de');
        const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255,255,255,0.10)'); v.addColorStop(1, 'rgba(255,255,255,0.0)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
    });
}

// Avião em miniatura para a mesa do dia (nariz para -z); a deriva é uma peça à parte, com a cor do voo.
function miniatura() {
    const p = [];
    const fus = cil(0.062, 0.062, 0.84, 18); p.push(peca(fus, '#f4f5f4', 0, 0, 0, Math.PI / 2));
    p.push(peca(esf(0.062, 1, 1, 1.9, 18), '#f4f5f4', 0, 0, -0.42));
    p.push(peca(cil(0.062, 0.02, 0.26, 18), '#f4f5f4', 0, 0.018, 0.55, Math.PI / 2));
    for (const k of [-1, 1]) {
        p.push(peca(cx(0.5, 0.014, 0.17), '#dfe2e2', k * 0.27, -0.02, 0.03, 0, -k * 0.42, k * 0.06));
        p.push(peca(cil(0.03, 0.03, 0.13, 12), '#16365f', k * 0.2, -0.062, -0.04, Math.PI / 2));
        p.push(peca(cx(0.19, 0.01, 0.08), '#dfe2e2', k * 0.11, 0.03, 0.6, 0, -k * 0.4, 0));
    }
    p.push(peca(cx(0.5, 0.012, 0.03), '#16365f', 0, 0.0, 0, 0, Math.PI / 2));
    const deriva = new THREE.BufferGeometry();
    deriva.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.04, 0.42, 0, 0.04, 0.66, 0, 0.24, 0.68, 0, 0.04, 0.42, 0, 0.24, 0.68, 0, 0.24, 0.58]), 3));
    deriva.computeVertexNormals();
    return { corpo: fundir(p), deriva };
}

// ---------------------------------------------------------------------------
// Pessoas: operadores sentados com auscultadores e colegas de pé. Virados para -z.
const PELES = ['#f1c7a5', '#e0ac85', '#c68863', '#9c6644', '#6f4a33', '#f5d3b8'];
const CABELOS = ['#2b1d14', '#4a3222', '#1a1a1a', '#8a5a2b', '#b9925a', '#6b6b6b', '#d8c39a'];
const CAMISAS = ['#f4f6f8', '#dce9f5', '#ffffff', '#e8eef2', '#cfe0ef'];
const COLETES = ['#16365f', '#1f4e79', '#2a3a4c', '#16365f', '#f2c40f'];
const CALCAS = ['#1f2a38', '#2b3440', '#3a3f46', '#1a2230'];

export function geometriaOperador(semente, sentado = true) {
    const r = aleatorio(semente * 7919 + 3), p = [];
    const pele = PELES[Math.floor(r() * PELES.length)], cabelo = CABELOS[Math.floor(r() * CABELOS.length)];
    const camisa = CAMISAS[Math.floor(r() * CAMISAS.length)], colete = COLETES[Math.floor(r() * COLETES.length)], calca = CALCAS[Math.floor(r() * CALCAS.length)];
    const comColete = r() < 0.75, mulher = r() < 0.45, alt = 0.96 + r() * 0.08, larg = mulher ? 0.9 : 1;
    const S = v => v * alt;
    // Pernas
    const yAnca = sentado ? 0.5 : S(0.92), zAnca = 0;
    for (const k of [-1, 1]) {
        const xa = k * 0.09 * larg;
        if (sentado) {
            p.push([membro([xa, yAnca, zAnca], [xa * 1.05, yAnca + 0.02, -0.42], 0.068, 0.056), calca]);                  // coxa
            p.push([esf(0.058), calca].map((x, i) => i ? x : x.translate(xa * 1.05, yAnca + 0.02, -0.42)));
            p.push([membro([xa * 1.05, yAnca + 0.02, -0.42], [xa * 1.08, 0.08, -0.38], 0.05, 0.042), calca]);              // perna
            p.push(peca(caixaRedonda(0.09, 0.07, 0.24, 0.03), '#15181c', xa * 1.08, 0.04, -0.45));                       // sapato
        } else {
            p.push([membro([xa, yAnca, 0], [xa, S(0.5), 0.01], 0.07, 0.056), calca]);
            p.push([membro([xa, S(0.5), 0.01], [xa, 0.08, 0.02], 0.052, 0.042), calca]);
            p.push(peca(caixaRedonda(0.09, 0.07, 0.25, 0.03), '#15181c', xa, 0.04, -0.04));
        }
    }
    // Tronco: anca, cintura e peito
    const yOmbro = yAnca + S(0.5), incl = sentado ? -0.06 : 0;                                       // inclinação para a frente (z negativo)
    p.push(peca(esf(0.15, larg * 1.05, 0.55, 0.75), calca, 0, yAnca + 0.03, zAnca));
    const tronco = cil(0.17 * larg, 0.145 * larg, S(0.44), 12); tronco.scale(1, 1, 0.62);
    p.push(peca(tronco, camisa, 0, yAnca + S(0.25), zAnca + incl / 2, incl * 0.4));
    if (comColete) { const c = cil(0.177 * larg, 0.152 * larg, S(0.34), 16, 1); c.scale(1, 1, 0.66); p.push(peca(c, colete, 0, yAnca + S(0.24), zAnca + incl / 2, incl * 0.4)); }
    if (colete === '#f2c40f' && comColete) for (const yy of [0.16, 0.3]) { const f = cil(0.18 * larg, 0.16 * larg, 0.025, 16); f.scale(1, 1, 0.68); p.push(peca(f, '#d9dde0', 0, yAnca + S(yy), zAnca + incl / 2)); }
    p.push(peca(esf(0.1, larg * 1.75, 0.5, 0.9), comColete ? colete : camisa, 0, yOmbro - 0.03, zAnca + incl));          // ombros
    p.push(peca(cil(0.045, 0.05, 0.09), pele, 0, yOmbro + 0.04, zAnca + incl));                                         // pescoço
    p.push(peca(cx(0.13, 0.04, 0.02), camisa, 0, yOmbro + 0.0, zAnca + incl - 0.07, -0.3));                             // colarinho
    // Cabeça
    const yCab = yOmbro + 0.18, zCab = zAnca + incl * 1.5;
    p.push(peca(esf(0.095, 0.9, 1.12, 1.0, 16), pele, 0, yCab, zCab));
    p.push(peca(esf(0.03, 1, 1, 1, 8), pele, -0.088, yCab, zCab + 0.005), peca(esf(0.03, 1, 1, 1, 8), pele, 0.088, yCab, zCab + 0.005));   // orelhas
    p.push(peca(esf(0.022, 0.8, 1, 1.2, 8), pele, 0, yCab - 0.01, zCab - 0.094));                                     // nariz
    for (const k of [-1, 1]) p.push(peca(esf(0.011, 1, 1, 0.6, 8), '#22262b', k * 0.034, yCab + 0.022, zCab - 0.086));  // olhos
    // Cabelo: calote, e às vezes cabelo comprido ou apanhado
    const calote = new THREE.SphereGeometry(0.102, 14, 8, 0, Math.PI * 2, 0, Math.PI * (mulher ? 0.62 : 0.5)); calote.scale(0.93, 1.12, 1.04);
    p.push(peca(calote, cabelo, 0, yCab + 0.008, zCab + 0.012, -0.25));
    if (mulher) { if (r() < 0.5) p.push(peca(caixaRedonda(0.17, 0.2, 0.06, 0.03), cabelo, 0, yCab - 0.06, zCab + 0.075)); else p.push(peca(esf(0.045), cabelo, 0, yCab + 0.04, zCab + 0.105)); }
    // Braços: sentado, as mãos estão no teclado; de pé, um braço segura um tablet
    for (const k of [-1, 1]) {
        const om = [k * 0.2 * larg, yOmbro - 0.04, zAnca + incl];
        const manga = comColete && colete !== '#f2c40f' ? camisa : camisa;
        if (sentado) {
            const cot = [k * 0.23 * larg, yOmbro - 0.3, zAnca - 0.2], mao = [k * 0.14, 0.8, -0.6];
            p.push([membro(om, cot, 0.05, 0.043), manga], [esf(0.043).translate(...cot), manga], [membro(cot, mao, 0.04, 0.034), manga]);
            p.push(peca(esf(0.038, 1, 0.55, 1.3), pele, mao[0], mao[1] - 0.005, mao[2] - 0.04));
        } else if (k < 0) {
            p.push([membro(om, [k * 0.22, yOmbro - 0.31, 0.02], 0.05, 0.043), manga], [membro([k * 0.22, yOmbro - 0.31, 0.02], [k * 0.21, yOmbro - 0.57, -0.02], 0.04, 0.034), manga]);
            p.push(peca(esf(0.038, 1, 1.3, 0.7), pele, k * 0.21, yOmbro - 0.61, -0.02));
        } else {
            const cot = [k * 0.22, yOmbro - 0.3, -0.02], mao = [k * 0.08, yOmbro - 0.28, -0.3];
            p.push([membro(om, cot, 0.05, 0.043), manga], [esf(0.043).translate(...cot), manga], [membro(cot, mao, 0.04, 0.034), manga]);
            p.push(peca(esf(0.038, 1, 0.6, 1.2), pele, mao[0], mao[1], mao[2]));
            p.push(peca(caixaRedonda(0.24, 0.17, 0.012, 0.012), '#1d2228', 0.02, yOmbro - 0.25, -0.32, -1.0));             // tablet
        }
    }
    // Auscultadores com microfone (quase todos os operadores sentados)
    if (sentado && r() < 0.85) {
        const arco = new THREE.TorusGeometry(0.105, 0.008, 6, 20, Math.PI); p.push(peca(arco, '#2a2d31', 0, yCab + 0.005, zCab + 0.005));
        for (const k of [-1, 1]) p.push(peca(cil(0.035, 0.035, 0.025, 14), '#2a2d31', k * 0.1, yCab, zCab + 0.005, 0, 0, Math.PI / 2));
        p.push([membro([0.11, yCab - 0.01, zCab], [0.045, yCab - 0.075, zCab - 0.085], 0.0045), '#2a2d31'], peca(esf(0.012), '#2a2d31', 0.045, yCab - 0.075, zCab - 0.085));
    }
    // Crachá
    p.push(peca(cx(0.05, 0.07, 0.006), '#ffffff', 0.08 * larg, yOmbro - 0.15, zAnca + incl - 0.11 * larg));
    return fundir(p, 0.25);
}

// ---------------------------------------------------------------------------
export function construirCentro(scene, renderer) {
    const sala = new THREE.Group(), teto = new THREE.Group(), tras = new THREE.Group();
    sala.name = 'Centro de operações — maquete didática'; scene.add(sala); sala.add(teto, tras);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.background = new THREE.Color('#dfe5ea');

    // --- Reflexos do ambiente: uma sala de estúdio clara com painéis de luz, pré-filtrada (PMREM) -----
    {
        const amb = new THREE.Scene(), caixa = new THREE.BoxGeometry(1, 1, 1);
        const paredes = new THREE.Mesh(caixa, new THREE.MeshStandardMaterial({ color: '#c9ccd0', side: THREE.BackSide, roughness: 1 }));
        paredes.scale.set(26, 9, 20); paredes.position.y = 4.5; amb.add(paredes);
        const l = new THREE.PointLight('#ffffff', 900, 40, 2); l.position.set(0, 7, 0); amb.add(l);
        const painel = (w, d, x, y, z, i, cor = '#ffffff') => { const m = new THREE.Mesh(caixa, new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(i) })); m.scale.set(w, 0.05, d); m.position.set(x, y, z); amb.add(m); };
        for (const x of [-7, 0, 7]) for (const z of [-5, 0, 5]) painel(3, 1.4, x, 8.95, z, 6);
        const janela = new THREE.Mesh(caixa, new THREE.MeshBasicMaterial({ color: new THREE.Color('#dcecff').multiplyScalar(5) })); janela.scale.set(0.05, 3.6, 14); janela.position.set(12.95, 3.2, 1); amb.add(janela);
        const pm = new THREE.PMREMGenerator(renderer);
        scene.environment = pm.fromScene(amb, 0.035).texture; scene.environmentIntensity = 0.45;
        pm.dispose(); caixa.dispose(); paredes.material.dispose();
    }

    const add = (geo, mat, x = 0, y = 0, z = 0, pai = sala, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; pai.add(m); return m; };
    const plano = (w, h, mat, x, y, z, ry = 0, pai = sala) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; pai.add(m); return m; };
    const horizontal = (w, d, mat, x, y, z, pai = sala) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; pai.add(m); return m; };
    const basico = (tex, extra = {}) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, ...extra });
    const letreiro = (texto, w, h, fundoCor, cor, x, y, z, ry = 0, pai = sala, fonte = 0.6, emite = true) => plano(w, h, (emite ? basico : t => new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }))(tela(Math.round(256 * w / h), 256, (g, W, H) => {
        g.fillStyle = fundoCor; g.fillRect(0, 0, W, H); g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle';
        let tam = H * fonte; g.font = `700 ${tam}px Arial, sans-serif`; const larg = g.measureText(texto).width; if (larg > W * 0.92) { tam *= W * 0.92 / larg; g.font = `700 ${tam}px Arial, sans-serif`; }
        g.fillText(texto, W / 2, H * 0.54);
    })), x, y, z, ry, pai);
    const ecra = (w, h, pxW, pxH, x, y, z, pai = sala) => { const canvas = document.createElement('canvas'); canvas.width = pxW; canvas.height = pxH; const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; const malha = plano(w, h, basico(tex), x, y, z, 0, pai); return { canvas, tex, malha, chave: null }; };

    const LARG = C.X1 - C.X0, FUNDO = C.Z1 - C.Z0, ZM = (C.Z0 + C.Z1) / 2, A = C.ALTURA;
    const AZUL = '#16365f', LED = '#9fd4ff';
    const madeira = repetir(texMadeira(true), 1, 1), tecido = repetir(texTecido('#ffffff'), 1, 1), escovado = repetir(texEscovado(), 1, 1), laminado = repetir(texLaminado(), 1, 1);
    // Materiais partilhados (as peças juntas por material levam a cor no vértice)
    const matMovel = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.55, metalness: 0.0, map: laminado, bumpMap: laminado, bumpScale: 0.3 });
    const matMadeira = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.5, map: madeira, bumpMap: madeira, bumpScale: 0.6 });
    const matTecido = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.92, map: tecido, bumpMap: tecido, bumpScale: 1.2 });
    const matMetal = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.32, metalness: 0.85, map: escovado });
    const matPreto = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.38, metalness: 0.15 });
    const matPessoas = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.68 });
    const movel = [], pmadeira = [], ptecido = [], metal = [], preto = [], luzes = [];

    // --- Pavimento em degraus, paredes e teto -------------------------------------------------------
    const alcatifa = texAlcatifa();
    const matChao = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96, map: repetir(alcatifa, LARG / 2.4, FUNDO / 2.4), bumpMap: alcatifa, bumpScale: 0.8 });
    horizontal(LARG, FUNDO, matChao, 0, 0, ZM);
    const DEGRAUS = [[3.1, 0.34], [6.1, 0.68]];                                    // [z onde começa, altura]
    for (const [z, h] of DEGRAUS) {
        const tA = alcatifa.clone(); repetir(tA, LARG / 2.4, (C.Z1 - z) / 2.4);
        horizontal(LARG, C.Z1 - z, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96, map: tA, bumpMap: tA, bumpScale: 0.8 }), 0, h + 0.001, (z + C.Z1) / 2);
        pmadeira.push(peca(cx(LARG, h, 0.06), '#d9b48a', 0, h / 2, z + 0.03));                                       // espelho do degrau em madeira
        add(cx(LARG, h - 0.01, C.Z1 - z - 0.06), new THREE.MeshStandardMaterial({ color: '#8b9198', roughness: 1 }), 0, (h - 0.01) / 2, (z + 0.06 + C.Z1) / 2, sala, false);
        pmadeira.push(peca(cx(LARG, 0.03, 0.08), '#e2c29b', 0, h + 0.012, z + 0.03));                                // focinho do degrau
        luzes.push(peca(cx(LARG - 0.6, 0.02, 0.012), LED, 0, h - 0.05, z - 0.003));                                  // fita de luz no espelho
    }
    // Parede dos ecrãs: ripado de madeira à volta de um nicho escuro
    const ripado = texRipado();
    const matRipado = (w, h) => { const t = ripado.clone(); repetir(t, w / 2.4, 1); return new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62, map: t, bumpMap: t, bumpScale: 1.5 }); };
    const estuque = texEstuque();
    const matEstuque = (w, h) => { const t = estuque.clone(); repetir(t, w / 3, h / 3); return new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, map: t }); };
    plano(LARG, A, matRipado(LARG, A), 0, A / 2, C.Z0);
    // Parede esquerda: estuque claro com ripado a meio; parede direita: janela corrida para a placa
    plano(FUNDO, A, matEstuque(FUNDO, A), C.X0, A / 2, ZM, Math.PI / 2);
    plano(9, 3.6, matRipado(9, 3.6), C.X0 + 0.02, 2.6, -1.2, Math.PI / 2);
    letreiro('OPERAÇÕES', 4.6, 0.5, '#c79f74', '#2b2118', C.X0 + 0.04, 4.9, -1.2, Math.PI / 2, sala, 0.62, false);
    // Janela: peitoril, vidro com vista, caixilhos verticais e padieira
    const zJ0 = -7.6, zJ1 = 8.6, yJ0 = 1.05, yJ1 = 4.95, wJ = zJ1 - zJ0, hJ = yJ1 - yJ0;
    plano(FUNDO, yJ0, matEstuque(FUNDO, yJ0), C.X1, yJ0 / 2, ZM, -Math.PI / 2);
    plano(FUNDO, A - yJ1, matEstuque(FUNDO, A - yJ1), C.X1, (A + yJ1) / 2, ZM, -Math.PI / 2);
    plano(zJ0 - C.Z0, hJ, matEstuque(2, hJ), C.X1, (yJ0 + yJ1) / 2, (C.Z0 + zJ0) / 2, -Math.PI / 2);
    plano(C.Z1 - zJ1, hJ, matEstuque(2, hJ), C.X1, (yJ0 + yJ1) / 2, (C.Z1 + zJ1) / 2, -Math.PI / 2);
    const vista = texJanela();
    const vidro = plano(wJ, hJ, new THREE.MeshBasicMaterial({ map: vista, color: '#f2f6fa' }), C.X1 + 0.05, (yJ0 + yJ1) / 2, (zJ0 + zJ1) / 2, -Math.PI / 2); vidro.receiveShadow = false;
    for (let k = 0; k <= 6; k++) metal.push(peca(cx(0.08, hJ, 0.08), '#5d646b', C.X1 - 0.02, (yJ0 + yJ1) / 2, zJ0 + k * wJ / 6));
    metal.push(peca(cx(0.1, 0.08, wJ + 0.08), '#5d646b', C.X1 - 0.02, yJ0, (zJ0 + zJ1) / 2), peca(cx(0.1, 0.08, wJ + 0.08), '#5d646b', C.X1 - 0.02, yJ1, (zJ0 + zJ1) / 2));
    movel.push(peca(cx(0.3, 0.05, wJ + 0.1), '#f1f1ef', C.X1 - 0.15, yJ0 - 0.02, (zJ0 + zJ1) / 2));
    // Estores de lâminas, meio subidos, para dar escala à janela
    for (let k = 0; k < 6; k++) { const z = zJ0 + (k + 0.5) * wJ / 6; for (let s = 0; s < 9; s++) movel.push(peca(cx(0.05, 0.004, wJ / 6 - 0.12), '#f3f3f1', C.X1 - 0.12, yJ1 - 0.08 - s * 0.045, z, 0, 0, 0.6)); }
    // Parede de trás (com porta) e rodapés
    plano(LARG, A, matEstuque(LARG, A), 0, A / 2, C.Z1, Math.PI, tras);
    const porta = add(cx(1.8, 2.3, 0.06), matMadeira, -9, 0.68 + 1.15, C.Z1 - 0.03, tras); porta.castShadow = false;
    letreiro('SAÍDA', 0.5, 0.18, '#1e8e3e', '#ffffff', -9, 0.68 + 2.5, C.Z1 - 0.07, Math.PI, tras);
    for (const s of [-1, 1]) movel.push(peca(cx(0.02, 0.1, FUNDO), '#f7f7f5', s * (C.X1 - 0.01), 0.05, ZM));

    // Teto claro com painéis de luz em grelha e sanca com luz indireta
    const tEstuque = estuque.clone(); repetir(tEstuque, LARG / 3, FUNDO / 3);
    const mTeto = new THREE.Mesh(new THREE.PlaneGeometry(LARG, FUNDO), new THREE.MeshStandardMaterial({ color: '#f4f5f6', roughness: 0.95, map: tEstuque, side: THREE.DoubleSide })); mTeto.rotation.x = Math.PI / 2; mTeto.position.set(0, A, ZM); teto.add(mTeto);
    const paineisLuz = [];
    for (let x = -10; x <= 10; x += 4) for (let z = -6.2; z <= 8; z += 2.85) paineisLuz.push(peca(cx(2.4, 0.04, 0.6), '#ffffff', x, A - 0.02, z));
    const mLuz = new THREE.Mesh(fundir(paineisLuz), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fffaf2').multiplyScalar(1.6), toneMapped: true })); teto.add(mLuz);
    const molduras = []; for (const [g] of paineisLuz) { const b = new THREE.Box3().setFromBufferAttribute(g.attributes.position); molduras.push(peca(cx(2.5, 0.03, 0.7), '#d8dadc', (b.min.x + b.max.x) / 2, A - 0.012, (b.min.z + b.max.z) / 2)); }
    const mMold = new THREE.Mesh(fundir(molduras), matMetal); teto.add(mMold);

    // --- Parede de ecrãs --------------------------------------------------------------------------
    const LP = C.LARG_PAINEL, AP = C.ALT_PAINEL, passo = LP + C.FOLGA, larguraTotal = 3 * LP + 2 * C.FOLGA;
    preto.push(peca(cx(larguraTotal + 0.7, AP + 1.3, 0.3), '#2b3036', 0, C.Y_PAINEL + 0.3, C.Z_PAREDE - 0.16));                 // nicho escuro
    preto.push(peca(cx(larguraTotal + 0.3, AP + 0.12, 0.04), '#0b0d10', 0, C.Y_PAINEL, C.Z_PAREDE - 0.03));
    // Juntas entre os módulos do videowall (3 × 3 por painel)
    for (let i = 0; i < 3; i++) {
        const x0 = (i - 1) * passo;
        for (let k = 1; k < 3; k++) preto.push(peca(cx(0.006, AP, 0.004), '#0b0d10', x0 - LP / 2 + k * LP / 3, C.Y_PAINEL, C.Z_PAREDE + 0.004));
        for (let k = 1; k < 3; k++) preto.push(peca(cx(LP, 0.006, 0.004), '#0b0d10', x0, C.Y_PAINEL - AP / 2 + k * AP / 3, C.Z_PAREDE + 0.004));
    }
    movel.push(peca(caixaRedonda(larguraTotal + 1.4, 0.9, 0.55, 0.03), '#eceeef', 0, 0.45, C.Z_PAREDE + 0.0));            // móvel técnico por baixo
    pmadeira.push(peca(cx(larguraTotal + 1.44, 0.04, 0.58), '#d2ab80', 0, 0.92, C.Z_PAREDE));
    luzes.push(peca(cx(larguraTotal + 0.5, 0.02, 0.012), LED, 0, C.Y_PAINEL - AP / 2 - 0.36, C.Z_PAREDE + 0.12));
    const paineis = {};
    ['numeros', 'curvas', 'relatorio'].forEach((nome, i) => {
        const x = (i - 1) * passo;
        paineis[nome] = ecra(LP, AP, 1536, 1024, x, C.Y_PAINEL, C.Z_PAREDE, sala);
        paineis[nome].x = x;
    });
    letreiro('CENTRO DE OPERAÇÕES', 5.4, 0.34, '#2b3036', '#e8eef2', 0, C.Y_PAINEL + AP / 2 + 0.45, C.Z_PAREDE + 0.01);

    // --- Mesa do dia: os quatro voos em miniatura e as colunas que crescem com a manhã ----------------
    const ms = C.MESA, topo = ms.alt;
    movel.push(peca(caixaRedonda(ms.larg, 0.1, ms.fundo, 0.05), '#f2f2f0', ms.x, topo - 0.05, ms.z));
    pmadeira.push(peca(caixaRedonda(ms.larg - 0.5, topo - 0.2, ms.fundo - 0.6, 0.04), '#cfa679', ms.x, (topo - 0.2) / 2 + 0.1, ms.z));
    preto.push(peca(cx(ms.larg - 0.3, 0.1, ms.fundo - 0.4), '#3a3f45', ms.x, 0.05, ms.z));
    luzes.push(peca(cx(ms.larg - 0.52, 0.02, 0.012), LED, ms.x, 0.13, ms.z + (ms.fundo - 0.6) / 2 + 0.008));
    const tampo = tela(2048, 532, (g, w, h) => {
        g.fillStyle = '#132131'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#21374e'; g.lineWidth = 2; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        const px = x => (x - (ms.x - ms.larg / 2)) / ms.larg * w;
        for (const x of C.X_VOO) { g.strokeStyle = '#e8c547'; g.lineWidth = 5; g.strokeRect(px(x) - 150, 26, 300, 250); g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.moveTo(px(x), 40); g.lineTo(px(x), 264); g.stroke(); }
        g.fillStyle = '#58b7ff'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
    });
    horizontal(ms.larg - 0.3, ms.fundo - 0.3, new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: tampo, emissiveIntensity: 0.9, roughness: 0.08, metalness: 0, envMapIntensity: 0.6 }), ms.x, topo + 0.004, ms.z);
    const mini = miniatura(), matMini = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.3, metalness: 0.2 });
    const voos = C.X_VOO.map((x) => {
        const grupo = new THREE.Group(); grupo.position.set(x, topo, ms.z); sala.add(grupo);
        const aviao = new THREE.Group(); aviao.position.set(0, 0.11, -0.45); grupo.add(aviao);
        add(mini.corpo, matMini, 0, 0, 0, aviao);
        const deriva = new THREE.MeshStandardMaterial({ color: '#16365f', roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide }); add(mini.deriva, deriva, 0, 0, 0, aviao);
        const barras = {};
        C.SERIES.forEach((serie, k) => {
            const geo = caixaRedonda(0.19, 1, 0.19, 0.03); geo.translate(0, 0.5, 0);
            const m = add(geo, new THREE.MeshPhysicalMaterial({ color: C.COR_SERIE[serie], roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, emissive: C.COR_SERIE[serie], emissiveIntensity: 0.25 }), (k - 1.5) * 0.3, 0.004, 0.52, grupo);
            m.scale.y = 0.001; barras[serie] = m;
            add(cil(0.13, 0.13, 0.012, 20), new THREE.MeshStandardMaterial({ color: '#1b2026', roughness: 0.3, metalness: 0.6 }), (k - 1.5) * 0.3, 0.006, 0.52, grupo, false);
        });
        const etiqueta = (() => { const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160; const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.47), basico(tex)); m.position.set(0, 0.2, 1.05); m.rotation.x = -0.95; grupo.add(m); return { canvas, tex, chave: null }; })();
        add(caixaRedonda(1.58, 0.55, 0.03, 0.02).rotateX(-0.95), new THREE.MeshStandardMaterial({ color: '#1b2026', roughness: 0.35, metalness: 0.4 }), 0, 0.184, 1.038, grupo, false);
        const lampada = add(new THREE.SphereGeometry(0.055, 18, 12), new THREE.MeshBasicMaterial({ color: '#39424a', toneMapped: false }), 0.86, 0.06, 0.52, grupo, false);
        return { grupo, aviao, deriva, barras, etiqueta, lampada, x };
    });
    letreiro('■ aceites no check-in   ■ embarcados   ■ malas triadas   ■ malas no porão', 6.2, 0.2, '#2b3036', '#e8eef2', ms.x, topo - 0.34, ms.z + (ms.fundo - 0.6) / 2 + 0.012);

    // --- Consolas: três filas em degraus, com monitores em braços, cadeiras e operadores ---------------
    const POSTOS = ['CHECK-IN', 'TRIAGEM', 'SEGURANÇA', 'EMBARQUE', 'PLACA', 'PISTA', 'METEO', 'MANUTENÇÃO', 'SUPERVISÃO', 'CHEFE DE TURNO', 'COMUNICAÇÕES'];
    const FILAS = [[1.3, 0, [-6.6, -2.2, 2.2, 6.6]], [4.4, 0.34, [-6.6, -2.2, 2.2, 6.6]], [7.3, 0.68, [-4.6, 0, 4.6]]];
    const pessoas = [], lugares = [];                                               // lugares: onde estão as pessoas (para os modelos .glb)
    let posto = 0;
    const consolaLocal = [], madeiraLocal = [], tecidoLocal = [], metalLocal = [], pretoLocal = [];
    {   // uma consola, montada uma vez em coordenadas locais e depois copiada para cada posto
        const larg = 3.6;
        consolaLocal.push(peca(caixaRedonda(larg, 0.045, 1.0, 0.04), '#f3f3f1', 0, 0.75, 0));                                     // tampo
        madeiraLocal.push(peca(cx(larg - 0.04, 0.6, 0.04), '#c99f73', 0, 0.42, -0.46));                                          // painel frontal em madeira
        consolaLocal.push(peca(caixaRedonda(larg, 0.24, 0.3, 0.03), '#e9eaea', 0, 0.9, -0.37));                                   // calha técnica
        for (const k of [-1, 1]) consolaLocal.push(peca(caixaRedonda(0.05, 0.73, 0.95, 0.02), '#e4e5e5', k * (larg / 2 - 0.03), 0.365, 0, 0, 0, 0));
        consolaLocal.push(peca(caixaRedonda(0.5, 0.62, 0.6, 0.02), '#dfe0e0', -1.35, 0.33, -0.12));                              // bloco de gavetas
        for (let gv = 0; gv < 3; gv++) metalLocal.push(peca(cx(0.16, 0.015, 0.02), '#9aa1a8', -1.35, 0.2 + gv * 0.19, 0.19));
        for (let m = 0; m < 4; m++) {
            const xm = (m - 1.5) * 0.82, ang = -(m - 1.5) * 0.16;
            pretoLocal.push(peca(caixaRedonda(0.74, 0.45, 0.03, 0.012), '#1b1e22', xm, 1.36, -0.2, 0.08, ang));                   // monitor de moldura fina
            pretoLocal.push(peca(caixaRedonda(0.3, 0.2, 0.05, 0.02), '#25292e', xm, 1.36, -0.24, 0.08, ang));                     // costas do monitor
            metalLocal.push([membro([xm, 1.02, -0.32], [xm, 1.3, -0.28], 0.016), '#b9bec3']);                                       // braço do monitor
            metalLocal.push(peca(cil(0.05, 0.05, 0.015, 16), '#b9bec3', xm, 1.025, -0.32));
        }
        for (const xo of [-0.9, 0.9]) {
            pretoLocal.push(peca(caixaRedonda(0.44, 0.018, 0.15, 0.008), '#2a2e33', xo, 0.782, 0.2, 0.05), peca(esf(0.03, 1, 0.5, 1.6), '#2a2e33', xo + 0.34, 0.785, 0.22));   // teclado e rato
            for (let kx = 0; kx < 14; kx++) for (let kz = 0; kz < 4; kz++) consolaLocal.push(peca(cx(0.022, 0.006, 0.022), '#d9dcdf', xo - 0.19 + kx * 0.029, 0.795 - kz * 0.0015, 0.15 + kz * 0.03));  // teclas
            // cadeira ergonómica: assento e costas estofados, apoios de braços, coluna e base de cinco rodas
            tecidoLocal.push(peca(caixaRedonda(0.5, 0.08, 0.48, 0.04), '#3c4655', xo, 0.47, 0.82), peca(caixaRedonda(0.46, 0.62, 0.07, 0.05), '#3c4655', xo, 0.86, 1.08, -0.14));
            tecidoLocal.push(peca(caixaRedonda(0.3, 0.12, 0.08, 0.04), '#3c4655', xo, 0.72, 1.06, -0.1));                          // apoio lombar
            pretoLocal.push(peca(caixaRedonda(0.4, 0.04, 0.4, 0.02), '#22262b', xo, 0.42, 0.84));
            for (const k of [-1, 1]) { pretoLocal.push(peca(caixaRedonda(0.06, 0.035, 0.3, 0.015), '#22262b', xo + k * 0.28, 0.66, 0.84), [membro([xo + k * 0.27, 0.45, 0.9], [xo + k * 0.28, 0.65, 0.88], 0.014), '#22262b']); }
            metalLocal.push(peca(cil(0.03, 0.03, 0.32, 12), '#c3c8cc', xo, 0.26, 0.82));
            for (let b = 0; b < 5; b++) { const a = b * 1.2566, ex = xo + Math.sin(a) * 0.28, ez = 0.82 + Math.cos(a) * 0.28; metalLocal.push([membro([xo, 0.1, 0.82], [ex, 0.07, ez], 0.022, 0.016), '#c3c8cc']); pretoLocal.push(peca(esf(0.03, 0.8, 1, 1), '#1c1f23', ex, 0.032, ez)); }
        }
        pretoLocal.push(peca(caixaRedonda(0.16, 0.06, 0.2, 0.02), '#2a2e33', 0, 0.8, 0.12));                                 // telefone
        consolaLocal.push(peca(cil(0.04, 0.035, 0.1, 16), '#ffffff', 1.5, 0.82, 0.25), peca(new THREE.TorusGeometry(0.025, 0.007, 6, 12), '#ffffff', 1.54, 0.83, 0.25));   // caneca
        consolaLocal.push(peca(cx(0.21, 0.01, 0.297), '#fbfbf8', -0.4, 0.778, 0.1, 0, 0.2));                                  // folha de papel
    }
    const copia = (lista, m) => lista.map(([g, c]) => [g.clone().applyMatrix4(m), c]);
    for (const [z, y, xs] of FILAS) for (const x of xs) {
        const ry = -x * 0.022;                                                         // a consola roda um pouco para o centro da parede
        const mat = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
        movel.push(...copia(consolaLocal, mat)); pmadeira.push(...copia(madeiraLocal, mat)); ptecido.push(...copia(tecidoLocal, mat)); metal.push(...copia(metalLocal, mat)); preto.push(...copia(pretoLocal, mat));
        const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; sala.add(g);
        for (let m = 0; m < 4; m++) {
            const xm = (m - 1.5) * 0.82, ang = -(m - 1.5) * 0.16;
            const e = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), basico(monitor((posto + m * 2) % 6, posto * 4 + m), { color: '#e6e6e6' }));
            e.position.set(xm, 1.36, -0.2 + 0.016); e.rotation.set(0.08, ang, 0, 'YXZ'); e.position.x += Math.sin(ang) * 0.016; g.add(e);
        }
        for (const xo of [-0.9, 0.9]) {
            if (aleatorio(posto * 7 + (xo > 0 ? 3 : 1))() < 0.8) {
                const geo = geometriaOperador(900 + posto * 2 + (xo > 0 ? 1 : 0), true).applyMatrix4(new THREE.Matrix4().makeTranslation(xo, 0, 0.86)).applyMatrix4(mat);
                pessoas.push(geo);
                const pLugar = new THREE.Vector3(xo, 0, 0.86).applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1)));
                lugares.push({ semente: 900 + posto * 2 + (xo > 0 ? 1 : 0), sentado: true, x: pLugar.x, y, z: pLugar.z, ry });
            }
        }
        const nome = POSTOS[posto % POSTOS.length];
        letreiro(nome, 1.1, 0.16, AZUL, '#ffffff', 0, 0.93, -0.221, 0, g);                                 // placa virada para os operadores
        letreiro(nome, 1.4, 0.2, AZUL, '#ffffff', 0, 0.55, -0.49, Math.PI, g);                             // e outra virada para a parede
        posto++;
    }
    // Chefe de turno de pé, junto à mesa do dia, e um colega a meio da sala
    const dePe = (semente, x, z, ry) => lugares.push({ semente, sentado: false, x, y: 0, z, ry }) && pessoas.push(geometriaOperador(semente, false).applyMatrix4(new THREE.Matrix4().makeRotationY(ry)).applyMatrix4(new THREE.Matrix4().makeTranslation(x, 0, z)));
    dePe(31, ms.x + ms.larg / 2 + 0.75, ms.z + 0.3, -Math.PI / 2 - 0.4 + Math.PI);
    dePe(47, -8.4, -1.6, Math.PI * 0.82 + Math.PI);
    dePe(53, 9.6, -2.4, Math.PI * 1.35);

    // Guarda-corpos de vidro nos degraus, plantas, armário e bebedouro
    const matVidro = new THREE.MeshPhysicalMaterial({ color: '#e8f3f7', roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.28, envMapIntensity: 1.2, side: THREE.DoubleSide });
    for (const [z, h] of DEGRAUS) for (const s of [-1, 1]) {
        add(cx(2.3, 0.9, 0.015), matVidro, s * 10.75, h + 0.47, z + 0.12, sala, false);
        metal.push(peca(cx(2.36, 0.045, 0.06), '#c3c8cc', s * 10.75, h + 0.93, z + 0.12));
        for (const xx of [9.6, 11.9]) metal.push(peca(cx(0.05, 0.94, 0.05), '#c3c8cc', s * xx, h + 0.47, z + 0.12));
    }
    const vaso = (x, z, semente, alto = 1) => {
        const r = aleatorio(semente);
        movel.push(peca(cil(0.32, 0.25, 0.62, 24), '#f0efec', x, 0.31, z));
        preto.push(peca(cil(0.29, 0.29, 0.02, 24), '#3b2e24', x, 0.6, z));
        for (let k = 0; k < 26; k++) {                                                // folhas largas, inclinadas para fora
            const a = r() * Math.PI * 2, inc = 0.35 + r() * 0.6, L = (0.55 + r() * 0.5) * alto;
            const f = esf(0.5, 0.22, 1, 0.02, 10); f.translate(0, 0.5, 0); f.scale(L, L, L);
            f.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(inc, a, 0, 'YXZ')));
            const cauleY = 0.6 + r() * 0.5 * alto;
            ptecido.push(peca(f, r() < 0.5 ? '#3f7d45' : '#58965a', x + Math.sin(a) * 0.05, cauleY, z + Math.cos(a) * 0.05));
            metal.push([membro([x, 0.6, z], [x + Math.sin(a) * 0.05, cauleY, z + Math.cos(a) * 0.05], 0.008), '#4f6b3a']);
        }
    };
    vaso(-11.9, -7.6, 3, 1.2); vaso(11.9, -8.0, 4, 1.2); vaso(-12.2, 8.6, 5); vaso(12.2, 8.8, 6);
    movel.push(peca(caixaRedonda(2.2, 1.9, 0.5, 0.03), '#eceeef', -11.2, 0.68 + 0.95, 9.2));                                 // armário ao fundo
    for (let k = 0; k < 4; k++) metal.push(peca(cx(0.02, 0.18, 0.02), '#9aa1a8', -11.2 - 0.82 + k * 0.55 + 0.12, 0.68 + 1.0, 8.94));

    const merge = (lista, mat, sombra = true) => { if (lista.length) add(fundir(lista), mat, 0, 0, 0, sala, sombra); };
    merge(movel, matMovel); merge(pmadeira, matMadeira); merge(ptecido, matTecido); merge(metal, matMetal); merge(preto, matPreto);
    merge(luzes, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), false);
    let pessoasMalha = null;
    if (pessoas.length) {                                                              // todos os operadores numa só malha
        let n = 0; for (const g of pessoas) n += g.attributes.position.count;
        const f = new THREE.BufferGeometry();
        for (const nome of ['position', 'normal', 'color', 'uv']) { const tam = pessoas[0].attributes[nome].itemSize, arr = new Float32Array(n * tam); let o = 0; for (const g of pessoas) { arr.set(g.attributes[nome].array, o); o += g.attributes[nome].array.length; } f.setAttribute(nome, new THREE.BufferAttribute(arr, tam)); }
        f.computeVertexNormals();
        pessoasMalha = add(f, matPessoas);
    }

    // --- Luz: sala clara, com luz de teto difusa, luz do dia pela janela e o brilho dos ecrãs -------
    scene.add(new THREE.HemisphereLight('#f4f7fb', '#b9b2a8', 0.75));
    const sol = new THREE.DirectionalLight('#fff3e2', 2.4); sol.position.set(20, 14, 4); sol.target.position.set(0, 0, 0); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -16, right: 16, top: 14, bottom: -14, near: 2, far: 50 }); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.04; sol.shadow.radius = 4; scene.add(sol); scene.add(sol.target);
    const zenital = new THREE.DirectionalLight('#ffffff', 0.6); zenital.position.set(-3, 20, 2); scene.add(zenital);           // luz difusa dos painéis do teto (sem sombra)
    for (const x of [-7, 0, 7]) for (const z of [-3, 4]) { const p = new THREE.PointLight('#fff6ea', 9, 13, 1.6); p.position.set(x, A - 0.6, z); scene.add(p); }
    const claridade = new THREE.PointLight('#8fc4ff', 18, 10, 1.8); claridade.position.set(0, 3.4, -7.4); scene.add(claridade);     // o que a parede de ecrãs devolve à sala

    return { sala, teto, tras, paineis, voos, matPessoas, pessoasMalha, lugares };
}
