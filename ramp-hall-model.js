// Bloco 2 · Bagagens, Fase 4: geometria da placa de estacionamento.
// Maquete didática de quatro lugares de estacionamento com manga: avião de corredor único com dois
// porões e porão a granel, portas de carga a estibordo, tapetes de carregamento, comboios de reboques
// que saem da central de triagem, fachada do terminal e caminho de circulação. Medidas em metros, à
// escala de um avião real, mas sem reproduzir nenhum aeroporto nem nenhuma companhia em concreto.
import * as THREE from 'three';
import { fundir, geometriaPessoa } from './baggage-hall-model.js?v=pessoas-1';
import { criarCaminho } from './sorting-hall-model.js?v=relatorio-1';

// Avião: s é a distância ao nariz, x é positivo para estibordo (o lado das portas de carga).
export const A = {
    COMP: 37.57, R: 1.975, YC: 3.78, S_NARIZ: 5.4, S_CONE: 26.5, Y_PISO: 3.35, S_TREM: 17.71, S_RODA: 5.07,
    PORTAS: { DIANTEIRO: [8.1, 9.9], TRASEIRO: [23.6, 25.4] },
    POROES: {
        DIANTEIRO: { s0: 8.0, s1: 13.4, chao: 2.05, de: 13.4, sentido: -1, porta: 'DIANTEIRO' },
        TRASEIRO: { s0: 20.6, s1: 26.6, chao: 2.05, de: 20.6, sentido: 1, porta: 'TRASEIRO' },
        GRANEL: { s0: 27.0, s1: 29.6, chao: 2.5, de: 29.6, sentido: -1, porta: 'TRASEIRO' },
    },
};
export const P = {
    LUGARES: { P21: -66, P22: -22, P23: 22, P24: 66 }, Z_NARIZ: 18, Z_TAXI: 92,
    FAIXA_ENTRADA: 22, FAIXA: 11,                  // faixas dos reboques, medidas a partir do eixo do lugar
    PE_TAPETE: 9.0, Y_PE: 0.98, COMP_TAPETE: 7.9, INCLINACAO: 0.1448,
    RECUO_TRATOR: 5.45, RECUOS: [3.6, 7.3],          // posição dos reboques atrás do trator
    V_REBOQUE: 85,                                   // metros por minuto simulado
};
const PASSO_FILA = 0.78, PASSO_COLUNA = 0.56, PASSO_CAMADA = 0.31;

// Posição (x, y, s) da mala número p de um porão: enche-se de três em três, do fundo para a porta.
export function lugarNoPorao(porao, p, alvo = {}) {
    const h = A.POROES[porao], filas = Math.floor((h.s1 - h.s0 - 0.06) / PASSO_FILA), f = Math.floor(p / 9), c = p % 9;
    alvo.x = (c % 3 - 1) * PASSO_COLUNA; alvo.y = h.chao + 0.02 + (Math.floor(c / 3) + 3 * Math.floor(f / filas)) * PASSO_CAMADA; alvo.s = h.de + h.sentido * (0.42 + (f % filas) * PASSO_FILA);
    return alvo;
}
// Posição (x, y, z) da mala número j num reboque (0 é a primeira a sair, por isso vai por cima).
export function lugarNoReboque(j, total, alvo = {}) {
    const r = total - 1 - j, c = r % 10;
    alvo.x = (c % 2 ? 0.37 : -0.37); alvo.z = (Math.floor(c / 2) - 2) * 0.57; alvo.y = 0.565 + Math.floor(r / 10) * PASSO_CAMADA;
    return alvo;
}

// Circuito dos reboques de um lugar: portão da triagem, caminho de circulação, volta por trás da asa e regresso.
export function rotaReboques(xc) {
    const a = xc + P.FAIXA_ENTRADA, b = xc + P.FAIXA, pts = [[-1.7, 0, -9]];
    if (Math.abs(a + 1.7) < 3) pts.push([-1.7, 0, 50.5]);
    else { const z = a > 0 ? 9.2 : 5.8; pts.push([-1.7, 0, z], [a, 0, z], [a, 0, 50.5]); }
    const zv = b > 1.7 ? 5.8 : 9.2;
    pts.push([b, 0, 50.5], [b, 0, zv], [1.7, 0, zv], [1.7, 0, -9]);
    const cam = criarCaminho(pts, 4), o = {}, paragem = {};
    for (const [tapete, s] of [['tras', 24.5], ['frente', 9.0]]) {
        const zAlvo = P.Z_NARIZ + s - P.RECUO_TRATOR;
        for (let d = 0; d < cam.comp; d += 0.05) { cam.em(d, o); if (o.tz < -0.99 && Math.abs(o.x - b) < 0.05 && o.z <= zAlvo) { paragem[tapete] = d; break; } }
    }
    return { cam, paragem };
}
// Recuo com trator (push-back): o trem principal recua a direito e roda para a via de circulação.
export function rotaRecuo(xc) { return criarCaminho([[xc, 0, P.Z_NARIZ + A.S_TREM], [xc, 0, P.Z_TAXI], [xc - 40, 0, P.Z_TAXI]], 18); }

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
const roda = (r, larg, x, z) => peca(cil(r, r, larg, 16), '#1b1c1e', x, r, z, 0, 0, Math.PI / 2);
function caixaRedonda(comp, alt, larg, raio) {
    const b = Math.min(raio, alt / 2 - 0.01), w = comp - 2 * b, d = larg - 2 * b, r = Math.min(raio, w / 2, d / 2), s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -d / 2); s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r); s.lineTo(w / 2, d / 2 - r); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    s.lineTo(-w / 2 + r, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); s.lineTo(-w / 2, -d / 2 + r); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: alt - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 2, curveSegments: 4 });
    g.rotateX(-Math.PI / 2); g.translate(0, b, 0); return g;
}

// --- Fuselagem: secção circular com o nariz descaído e o cone de cauda a subir ---------------------
function perfil(s) {                              // devolve [raio, altura do centro]
    if (s < A.S_NARIZ) { const k = 1 - s / A.S_NARIZ; return [A.R * Math.pow(Math.max(0, 1 - k * k), 0.55), A.YC - 0.5 * k * k]; }
    if (s > A.S_CONE) { const k = (s - A.S_CONE) / (A.COMP - A.S_CONE), r = A.R - (A.R - 0.3) * Math.pow(k, 1.5); return [r, A.YC + A.R - 0.3 * k * k - r]; }
    return [A.R, A.YC];
}
// Pedaço de pele entre s0 e s1 e entre os ângulos t0 e t1 (0 é estibordo, 90° é o cimo); dr encolhe o raio (forro).
function pele(s0, s1, t0, t1, ns, nt, dr = 0, nariz = false) {
    const pos = [], nor = [], uv = [], ids = [], e = 0.004;
    for (let i = 0; i <= ns; i++) {
        const f = i / ns, s = s0 + (s1 - s0) * (nariz ? f * f : f), [r, yc] = perfil(s), [ra, ya] = perfil(Math.max(0, s - e)), [rb, yb] = perfil(Math.min(A.COMP, s + e));
        const passo = Math.min(A.COMP, s + e) - Math.max(0, s - e), drs = (rb - ra) / passo, dys = (yb - ya) / passo;
        for (let j = 0; j <= nt; j++) {
            const t = t0 + (t1 - t0) * j / nt, c = Math.cos(t), sn = Math.sin(t), nz = -(dys * sn + drs), n = Math.hypot(1, nz);
            pos.push((r + dr) * c, yc + (r + dr) * sn, s); nor.push(c / n, sn / n, nz / n); uv.push(s / A.COMP, (t + Math.PI / 2) / (2 * Math.PI));
            if (i < ns && j < nt) { const a = i * (nt + 1) + j, b = a + nt + 1; ids.push(a, a + 1, b, b, a + 1, b + 1); }
        }
    }
    return { pos, nor, uv, ids };
}
function juntar(pedacos) {
    const pos = [], nor = [], uv = [], ids = [];
    for (const p of pedacos) { const base = pos.length / 3; for (const v of p.pos) pos.push(v); for (const v of p.nor) nor.push(v); for (const v of p.uv) uv.push(v); for (const i of p.ids) ids.push(i + base); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ids);
    return g;
}

// --- Asas e empenagens: secções de perfil unidas por uma superfície ---------------------------------
const PERFIL = [1, 0.82, 0.6, 0.38, 0.2, 0.08, 0.02, 0, 0.02, 0.08, 0.2, 0.38, 0.6, 0.82];
function secao(x, y, s, corda, esp, nx = 0, ny = 1) {
    return PERFIL.map((u, i) => { const yt = 5 * esp * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4) * corda * (i <= 7 ? 1 : -0.7); return [x + nx * yt, y + ny * yt, s + u * corda]; });
}
function superficie(secoes) {
    const n = PERFIL.length, pos = [], ids = [];
    for (const sec of secoes) for (const p of sec) pos.push(...p);
    for (let k = 0; k < secoes.length - 1; k++) for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + (i + 1) % n, c = a + n, d = b + n; ids.push(a, b, c, c, b, d); }
    const ult = (secoes.length - 1) * n; for (let i = 1; i < n - 1; i++) ids.push(ult, ult + i, ult + i + 1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(ids); g.computeVertexNormals(); return g;
}
const espelho = geo => { const g = geo.clone(); g.scale(-1, 1, 1); g.computeVertexNormals(); return g; };

// Pintura da fuselagem numa só tela: a horizontal é o comprimento, a vertical é a volta à secção.
function pintura() {
    const W = 4096, H = 1024, kx = W / A.COMP, ky = H / (2 * Math.PI * A.R);
    return tela(W, H, (g) => {
        g.fillStyle = '#f3f4f2'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#c4c9ce'; g.fillRect(0, 0, W, H * 0.105); g.fillRect(0, H * 0.895, W, H * 0.105);                       // barriga cinzenta
        g.fillStyle = '#16365f'; g.beginPath(); g.moveTo(26.2 * kx, 0); g.lineTo(31 * kx, H / 2); g.lineTo(26.2 * kx, H); g.lineTo(W, H); g.lineTo(W, 0); g.fill();   // cauda na cor da casa
        g.strokeStyle = '#e4572e'; g.lineWidth = 46; g.beginPath(); g.moveTo(25.2 * kx, -20); g.lineTo(30 * kx, H / 2); g.lineTo(25.2 * kx, H + 20); g.stroke();
        g.strokeStyle = 'rgba(40,50,60,0.07)'; g.lineWidth = 2; for (let s = 5.4; s < 27; s += 1.6) { g.beginPath(); g.moveTo(s * kx, 0); g.lineTo(s * kx, H); g.stroke(); }
        // desenha num dos lados, em centímetros, com x para a direita de quem olha de fora e y para baixo
        const lado = (bordo, s, alt, desenhar) => { g.save(); if (bordo > 0) { g.translate(s * kx, 0.75 * H - alt * ky); g.scale(-kx / 100, ky / 100); } else { g.translate(s * kx, 0.25 * H + alt * ky); g.scale(kx / 100, -ky / 100); } desenhar(); g.restore(); };
        const arred = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
        for (const b of [1, -1]) {
            const d = b > 0 ? -1 : 1;                 // sentido em que s cresce no desenho deste lado
            for (let s = 6.6; s < 30.4; s += 0.533) {                                           // janelas da cabine
                if (Math.abs(s - 15.9) < 0.2 || Math.abs(s - 16.75) < 0.2) continue;
                lado(b, s, 0.72, () => { g.fillStyle = 'rgba(150,158,165,0.45)'; arred(-14, -2.5, 28, 38, 12); g.fill(); g.fillStyle = '#18222c'; arred(-11.5, 0, 23, 33, 10); g.fill(); });
            }
            for (const s of [5.35, 31.3]) lado(b, s, 1.3, () => { g.strokeStyle = '#8c949b'; g.lineWidth = 3; arred(-42, 0, 84, 186, 14); g.stroke(); g.fillStyle = '#18222c'; arred(-9, 46, 18, 26, 7); g.fill(); g.fillStyle = '#b3261e'; g.fillRect(-26, 96, 52, 3); });
            for (const s of [15.9, 16.75]) lado(b, s, 1.05, () => { g.strokeStyle = '#8c949b'; g.lineWidth = 2.5; arred(-25, 0, 50, 102, 10); g.stroke(); g.fillStyle = '#18222c'; arred(-11.5, 33, 23, 33, 10); g.fill(); });
            lado(b, 2.9, 0, () => {                                                            // janelas do cockpit
                g.fillStyle = '#131b23';
                g.beginPath(); g.moveTo(d * -52, -136); g.lineTo(d * 34, -124); g.lineTo(d * 56, -80); g.lineTo(d * -30, -74); g.fill();
                g.beginPath(); g.moveTo(d * -61, -138); g.lineTo(d * -132, -100); g.lineTo(d * -128, -196); g.lineTo(d * -72, -226); g.fill();
                g.strokeStyle = '#8c949b'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(d * -30, -74); g.lineTo(d * 56, -80); g.lineTo(d * 34, -124); g.lineTo(d * -52, -136); g.lineTo(d * -72, -226); g.stroke();
            });
            lado(b, b > 0 ? 17.2 : 8.0, 2.08, () => { g.fillStyle = '#16365f'; g.font = 'italic 800 96px Arial, sans-serif'; g.textBaseline = 'top'; g.fillText('PORTO', 0, 0); const w = g.measureText('PORTO ').width; g.fillStyle = '#e4572e'; g.fillText('EXPRESS', w, 0); });
            lado(b, b > 0 ? 22.9 : 20.7, -0.25, () => { g.fillStyle = '#16365f'; g.font = '700 30px Arial, sans-serif'; g.textBaseline = 'top'; g.fillText('TORRE PYTHON', 0, 0); });
        }
        // contorno das portas de carga (a estibordo) e avisos junto à soleira
        for (const [s0, s1] of Object.values(A.PORTAS)) lado(1, s1, -0.434, () => { g.strokeStyle = '#7d868d'; g.lineWidth = 3; g.strokeRect(0, 0, (s1 - s0) * 100, 170); g.fillStyle = '#b3261e'; g.fillRect(8, 158, (s1 - s0) * 100 - 16, 3); });
    });
}

function geometriasAviao() {
    const TH = Math.asin((A.Y_PISO - A.YC) / A.R), TD = -62 * Math.PI / 180, BAIXO = -Math.PI / 2, CIMA = 1.5 * Math.PI, ZONAS = [[7.9, 13.5], [20.5, 29.7]];
    const opaca = [pele(0, 7.9, BAIXO, CIMA, 28, 48, 0, true), pele(7.9, 29.7, TH, Math.PI - TH, 28, 26), pele(29.7, A.COMP, BAIXO, CIMA, 12, 48), pele(13.5, 20.5, BAIXO, TH, 6, 10), pele(13.5, 20.5, Math.PI - TH, CIMA, 6, 10)];
    const exterior = [], forro = [];
    for (const [a, b] of ZONAS) for (const dr of [0, -0.05]) {
        const alvo = dr ? forro : exterior, n = Math.ceil((b - a) / 0.7);
        alvo.push(pele(a, b, Math.PI - TH, CIMA, n, 10, dr), pele(a, b, BAIXO, TD, n, 4, dr));
        let s = a;
        for (const [p0, p1] of Object.values(A.PORTAS)) if (p0 > a && p0 < b) { alvo.push(pele(s, p0, TD, TH, Math.max(1, Math.ceil((p0 - s) / 0.7)), 7, dr)); s = p1; }
        alvo.push(pele(s, b, TD, TH, Math.ceil((b - s) / 0.7), 7, dr));
    }
    const portas = {};
    for (const [nome, [p0, p1]] of Object.entries(A.PORTAS)) { portas[nome] = juntar([pele(p0, p1, TD, TH, 3, 7)]); portas[nome].translate(-A.R * Math.cos(TH), -A.Y_PISO, 0); }

    // interior dos porões: pavimento, teto e anteparas
    const dentro = [], CINZA = '#9aa1a7';
    dentro.push(peca(cx(1.9, 0.04, 5.5), CINZA, 0, 2.03, 10.7), peca(cx(1.9, 0.04, 6.1), CINZA, 0, 2.03, 23.6), peca(cx(1.72, 0.04, 2.7), CINZA, 0, 2.48, 28.3), peca(cx(1.72, 0.47, 0.04), CINZA, 0, 2.26, 26.95));
    dentro.push(peca(cx(3.84, 0.05, 5.6), '#c3c8cc', 0, 3.375, 10.7), peca(cx(3.84, 0.05, 6.0), '#c3c8cc', 0, 3.375, 23.5), peca(cx(3.2, 0.05, 3.2), '#c3c8cc', 0, 3.375, 28.1));
    for (const s of [7.95, 13.45, 20.55, 29.65]) { const [r, yc] = perfil(s), t = Math.asin((A.Y_PISO - yc) / r), f = new THREE.Shape(); f.absarc(0, yc, r - 0.03, t, Math.PI - t, true); f.closePath(); dentro.push(peca(new THREE.ShapeGeometry(f, 20), '#b4babf', 0, 0, s)); }
    for (const x of [-0.9, 0.9]) dentro.push(peca(cx(0.03, 0.03, 5.3), '#f2c40f', x, 2.06, 10.7), peca(cx(0.03, 0.03, 5.9), '#f2c40f', x, 2.06, 23.6));

    // asas com dispositivos de ponta, empenagem horizontal, motores, trem e carenagens
    const partes = [], ASA = '#d6dadd', MOTOR = '#16365f';
    const asa = superficie([secao(1.5, 2.72, 11.9, 7.2, 0.14), secao(6.4, 3.05, 14.8, 3.9, 0.12), secao(17.05, 3.95, 19.75, 1.55, 0.1), secao(17.45, 4.35, 20.25, 1.15, 0.1, -0.5, 0.86), secao(17.8, 6.2, 21.35, 0.5, 0.09, -1, 0.1)]);
    const estab = superficie([secao(0.5, 5.0, 31.4, 3.7, 0.1), secao(6.2, 5.6, 35.5, 1.3, 0.09)]);
    for (const g of [asa, espelho(asa), estab, espelho(estab)]) partes.push([g, ASA]);
    for (const k of [-1, 1]) {
        const contorno = [[0.84, 0], [1.0, 0.06], [1.12, 0.45], [1.17, 1.3], [1.13, 2.3], [1.0, 3.1], [0.82, 3.55], [0.64, 3.58], [0.56, 4.2], [0.4, 4.8], [0.1, 5.25]].map(([r, y]) => new THREE.Vector2(r, y));
        partes.push(peca(new THREE.LatheGeometry(contorno, 28), MOTOR, k * 5.75, 1.85, 10.45, Math.PI / 2));
        partes.push(peca(cil(0.87, 0.87, 0.04, 28), '#101316', k * 5.75, 1.85, 10.85, Math.PI / 2), peca(new THREE.ConeGeometry(0.3, 0.55, 16), '#e9ecee', k * 5.75, 1.85, 10.62, -Math.PI / 2));
        partes.push(peca(new THREE.TorusGeometry(0.93, 0.085, 8, 28), '#c9ced2', k * 5.75, 1.85, 10.5));
        partes.push(peca(cx(0.32, 0.8, 3.9), ASA, k * 5.75, 2.82, 13.7));                                                          // pilone
        for (const [x, s, comp] of [[4.0, 16.9, 2.6], [8.6, 18.0, 2.2], [12.6, 19.5, 1.8]]) { const c = new THREE.CapsuleGeometry(0.17, comp, 4, 8); partes.push(peca(c, ASA, k * x, 2.7 + (x - 1.5) * 0.085 - 0.3, s, Math.PI / 2)); }
        // trem principal
        partes.push(peca(cil(0.11, 0.11, 2.2, 10), '#c9ced2', k * 3.8, 1.6, A.S_TREM), peca(cx(0.9, 0.12, 0.12), '#8c949b', k * 3.8, 0.57, A.S_TREM));
        for (const dx of [-0.43, 0.43]) partes.push(roda(0.57, 0.36, k * 3.8 + dx, A.S_TREM));
    }
    partes.push(peca(cil(0.08, 0.08, 1.7, 10), '#c9ced2', 0, 1.2, A.S_RODA), roda(0.38, 0.2, -0.25, A.S_RODA), roda(0.38, 0.2, 0.25, A.S_RODA));
    partes.push(peca(caixaRedonda(3.5, 0.95, 7.0, 0.42), '#c4c9ce', 0, 1.6, 17.0));                                               // carenagem da barriga
    partes.push(peca(cil(0.3, 0.27, 0.12, 16), '#2a2d31', 0, perfil(A.COMP)[1], A.COMP, Math.PI / 2));
    partes.push(peca(cil(0.09, 0.11, 0.14, 10), '#c0281f', 0, A.YC + A.R + 0.05, 14.5));                                                   // luz anticolisão
    const deriva = superficie([secao(0, 5.35, 29.3, 6.6, 0.1, 1, 0), secao(0, 11.76, 35.3, 2.0, 0.09, 1, 0)]);

    // trator de reboque (push-back) com a barra presa ao trem de nariz
    const trator = [peca(caixaRedonda(2.4, 0.95, 4.6, 0.18), '#e8b90f', 0, 0.22, -2.5), peca(cx(1.7, 0.75, 1.3), '#22303c', 0, 1.5, -3.6), peca(cx(1.8, 0.06, 1.4), '#e8b90f', 0, 1.9, -3.6), peca(cx(0.12, 0.12, 5.2), '#8c949b', 0, 0.45, 2.4)];
    for (const [x, z] of [[-1.05, -1.1], [1.05, -1.1], [-1.05, -3.9], [1.05, -3.9]]) trator.push(roda(0.45, 0.4, x, z));
    trator.push(peca(cil(0.09, 0.09, 0.16, 10), '#ff8a1c', 0, 2.0, -3.6));
    return { fuselagem: juntar(opaca), exterior: juntar(exterior), forro: juntar(forro), portas, dentro: fundir(dentro), partes: fundir(partes), deriva, trator: fundir(trator), dobradica: [A.R * Math.cos(TH), A.Y_PISO] };
}

// Veículos (a frente é +z): trator de bagagem, reboque e tapete de carregamento.
function geometriaTrator() {
    const p = [peca(caixaRedonda(1.3, 0.5, 2.7, 0.1), '#f1f2ee', 0, 0.3, 0), peca(cx(1.22, 0.32, 0.95), '#f1f2ee', 0, 0.94, 0.78), peca(cx(1.32, 0.1, 2.72), '#e4572e', 0, 0.56, 0), peca(cx(0.55, 0.12, 0.5), '#22262a', 0, 0.86, -0.5), peca(cx(0.55, 0.5, 0.1), '#22262a', 0, 1.1, -0.78)];
    p.push(peca(cx(1.34, 0.06, 1.55), '#f1f2ee', 0, 2.0, -0.35), peca(cil(0.07, 0.07, 0.14, 10), '#ff8a1c', 0, 2.1, -0.35), peca(cil(0.03, 0.03, 0.5, 6), '#22262a', 0, 1.3, 0.25, -0.5), peca(new THREE.TorusGeometry(0.16, 0.022, 6, 14), '#22262a', 0, 1.5, 0.14, -0.5));
    for (const [x, z] of [[-0.62, 0.38], [0.62, 0.38], [-0.62, -1.08], [0.62, -1.08]]) p.push(peca(cx(0.05, 1.22, 0.05), '#3a4148', x, 1.4, z));
    for (const [x, z] of [[-0.6, 0.85], [0.6, 0.85], [-0.6, -0.85], [0.6, -0.85]]) p.push(roda(0.32, 0.24, x, z));
    p.push(peca(cx(0.1, 0.1, 0.3), '#3a4148', 0, 0.4, -1.45));
    return fundir(p);
}
function geometriaReboque() {
    const p = [peca(cx(1.5, 0.07, 3.1), '#9aa1a7', 0, 0.525, 0), peca(cx(1.3, 0.14, 2.9), '#3a4148', 0, 0.42, 0), peca(cx(0.08, 0.08, 0.75), '#3a4148', 0, 0.4, 1.9)];
    for (const z of [-1.52, 1.52]) p.push(peca(cx(1.5, 0.95, 0.045), '#2a6fb0', 0, 1.04, z), peca(cx(1.56, 0.06, 0.08), '#dfe3e6', 0, 1.54, z));
    for (const x of [-0.74, 0.74]) p.push(peca(cx(0.03, 0.1, 3.1), '#dfe3e6', x, 0.61, 0));
    for (const [x, z] of [[-0.62, 1.05], [0.62, 1.05], [-0.62, -1.05], [0.62, -1.05]]) p.push(roda(0.22, 0.16, x, z));
    return fundir(p);
}
function geometriasTapete() {
    const base = [peca(caixaRedonda(5.4, 0.5, 1.5, 0.08), '#eceeed', 5.5, 0.32, 0), peca(cx(5.42, 0.09, 1.52), '#e4572e', 5.5, 0.5, 0), peca(cx(1.5, 0.12, 0.7), '#eceeed', 7.2, 0.72, -1.0), peca(cx(0.55, 0.12, 0.5), '#22262a', 7.4, 0.84, -1.05), peca(cx(0.1, 0.55, 0.5), '#22262a', 7.72, 1.1, -1.05), peca(cil(0.03, 0.03, 0.6, 6), '#22262a', 6.85, 1.05, -1.05, 0, 0, 0.5), peca(new THREE.TorusGeometry(0.15, 0.02, 6, 14), '#22262a', 6.7, 1.33, -1.05, 0, Math.PI / 2, 0.5)];
    for (const [x, z] of [[3.7, -0.7], [3.7, 0.7], [7.4, -0.7], [7.4, 0.7]]) base.push(roda(0.33, 0.26, x, z));
    base.push(peca(cil(0.03, 0.03, 0.9, 6), '#3a4148', 7.95, 1.2, -1.3), peca(cil(0.07, 0.07, 0.12, 10), '#ff8a1c', 7.95, 1.7, -1.3));
    const lanca = [peca(cx(P.COMP_TAPETE, 0.16, 0.86), '#2b3138', -P.COMP_TAPETE / 2, -0.1, 0), peca(cil(0.09, 0.09, 0.86, 12), '#1b1c1e', -P.COMP_TAPETE, -0.06, 0, Math.PI / 2), peca(cil(0.09, 0.09, 0.86, 12), '#1b1c1e', 0, -0.06, 0, Math.PI / 2), peca(cx(0.3, 0.2, 0.9), '#1b1c1e', -P.COMP_TAPETE - 0.12, -0.08, 0)];
    for (const z of [-0.45, 0.45]) lanca.push(peca(cx(P.COMP_TAPETE, 0.1, 0.05), '#f2c40f', -P.COMP_TAPETE / 2, 0.05, z));
    for (let x = -0.6; x > -P.COMP_TAPETE + 1.5; x -= 1.3) lanca.push(peca(cx(0.04, 0.6, 0.04), '#f2c40f', x, 0.38, 0.47));
    lanca.push(peca(cx(P.COMP_TAPETE - 2.2, 0.04, 0.04), '#f2c40f', -P.COMP_TAPETE / 2 + 0.45, 0.68, 0.47));
    for (const x of [-2.6, -4.6]) for (const z of [-0.36, 0.36]) lanca.push(peca(cil(0.05, 0.05, 1.0, 8), '#c9ced2', x, -0.62, z, 0, 0, -0.25));
    return { base: fundir(base), lanca: fundir(lanca) };
}

// Aviões estacionados com a manga encostada, para as cenas que os mostram de fora da placa
// (a sala de embarque vê-os pelos vidros). Devolve { P21: { xc, aviao, deriva }, ... }.
export function construirEstacionados(pai) {
    const M = (cor, rug = 0.8, met = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: rug, metalness: met, ...extra });
    const add = (geo, mat, x, y, z, grupo) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; grupo.add(m); return m; };
    const geo = geometriasAviao(), tex = pintura();
    const matFuselagem = M('#ffffff', 0.36, 0.08, { map: tex, envMapIntensity: 1.1 }), matPele = M('#ffffff', 0.36, 0.08, { map: tex, envMapIntensity: 1.1, side: THREE.DoubleSide });
    const matPartes = M('#ffffff', 0.4, 0.25, { vertexColors: true, side: THREE.DoubleSide }), matVeiculos = M('#ffffff', 0.5, 0.15, { vertexColors: true });
    const lugares = {}, fixos = [];
    for (const [codigo, xc] of Object.entries(P.LUGARES)) {
        const aviao = new THREE.Group(); aviao.position.set(xc, 0, P.Z_NARIZ); pai.add(aviao);
        add(geo.fuselagem, matFuselagem, 0, 0, 0, aviao); add(geo.exterior, matPele, 0, 0, 0, aviao); add(geo.partes, matPartes, 0, 0, 0, aviao);
        const deriva = M('#16365f', 0.4, 0.1, { side: THREE.DoubleSide }); add(geo.deriva, deriva, 0, 0, 0, aviao);
        for (const nome of Object.keys(A.PORTAS)) add(geo.portas[nome], matPele, geo.dobradica[0], geo.dobradica[1], 0, aviao);
        const rx = xc - 16, rz = 3.6, px = xc - 4.15, pz = P.Z_NARIZ + 5.35, dir = Math.atan2(px - rx, pz - rz), comp = Math.hypot(px - rx, pz - rz);
        fixos.push(peca(cil(0.55, 0.65, 3.5, 14), '#c9ced2', rx, 1.75, rz), peca(cil(2.3, 2.3, 3.0, 24), '#e9eae6', rx, 4.95, rz), peca(cil(2.42, 2.42, 0.25, 24), '#8c949b', rx, 6.5, rz), peca(cil(2.33, 2.33, 0.9, 24), '#27465f', rx, 5.2, rz), peca(cx(2.6, 3.0, 3.8), '#e9eae6', rx, 4.95, 1.4));
        for (const k of [-1, 1]) for (const dz of [-0.72, 0.72]) fixos.push(peca(cx(0.5, 0.2, 0.25), '#f2c40f', xc + k * 3.8, 0.1, P.Z_NARIZ + A.S_TREM + dz));
        const manga = new THREE.Group(); manga.position.set(rx, 0, rz); manga.rotation.y = dir; pai.add(manga);
        const zb = comp - 4.6, tunel = [peca(cx(2.5, 2.9, 12.5), '#e9eae6', 0, 4.95, 7.6), peca(cx(2.56, 0.9, 12), '#27465f', 0, 5.15, 7.6), peca(cx(2.62, 0.14, 12.6), '#8c949b', 0, 6.47, 7.6),
            peca(cx(2.2, 2.6, comp - 10.5), '#e9eae6', 0, 4.9, 9 + (comp - 10.5) / 2), peca(cx(2.26, 0.8, comp - 11), '#27465f', 0, 5.1, 9 + (comp - 10.5) / 2), peca(cx(2.3, 0.12, comp - 10.4), '#8c949b', 0, 6.26, 9 + (comp - 10.5) / 2),
            peca(cx(0.22, 3.4, 0.22), '#8c949b', -0.95, 1.9, zb), peca(cx(0.22, 3.4, 0.22), '#8c949b', 0.95, 1.9, zb), peca(cx(3.0, 0.3, 0.5), '#3a4148', 0, 0.55, zb), roda(0.42, 0.32, -1.35, zb), roda(0.42, 0.32, 1.35, zb)];
        add(fundir(tunel), matVeiculos, 0, 0, 0, manga);
        const cab = new THREE.Group(); cab.position.set(0, 0, comp); cab.rotation.y = -dir; manga.add(cab);
        add(fundir([peca(cil(1.75, 1.75, 2.9, 20), '#e9eae6', 0, 4.9, 0), peca(cil(1.84, 1.84, 0.2, 20), '#8c949b', 0, 6.4, 0), peca(cx(1.7, 2.5, 2.3), '#30363c', 1.35, 4.75, 0), peca(cx(0.25, 2.7, 2.5), '#1b1c1e', 2.1, 4.75, 0)]), matVeiculos, 0, 0, 0, cab);
        lugares[codigo] = { xc, aviao, deriva, manga, dir };
    }
    add(fundir(fixos), matVeiculos, 0, 0, 0, pai);
    return lugares;
}

// ---------------------------------------------------------------------------
export function construirPlaca(scene, renderer) {
    const placa = new THREE.Group(); placa.name = 'Placa de estacionamento — maquete didática'; scene.add(placa);
    const M = (cor, rug = 0.8, met = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: rug, metalness: met, ...extra });
    const amb = tela(512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7fb0dc'); gr.addColorStop(0.42, '#d6e6f1'); gr.addColorStop(0.5, '#eef2f2'); gr.addColorStop(0.53, '#a9a8a2'); gr.addColorStop(1, '#8a8983'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff8e6'; g.beginPath(); g.arc(330, 60, 16, 0, 7); g.fill(); });
    amb.mapping = THREE.EquirectangularReflectionMapping; const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(amb).texture; scene.environmentIntensity = 0.6; amb.dispose(); pm.dispose();
    const add = (geo, mat, x = 0, y = 0, z = 0, pai = placa, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; pai.add(m); return m; };
    const plano = (w, h, mat, x, y, z, ry = 0, pai = placa) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; pai.add(m); return m; };
    const horizontal = (w, d, mat, x, y, z, pai = placa) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; pai.add(m); return m; };
    const basico = (tex, extra = {}) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, ...extra });
    const letreiro = (texto, w, h, fundo, cor, x, y, z, ry = 0, pai = placa, fonte = 0.62) => plano(w, h, basico(tela(Math.round(256 * w / h), 256, (g, W, H) => {
        g.fillStyle = fundo; g.fillRect(0, 0, W, H); g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle';
        let tam = H * fonte; g.font = `700 ${tam}px Arial, sans-serif`; const larg = g.measureText(texto).width; if (larg > W * 0.92) { tam *= W * 0.92 / larg; g.font = `700 ${tam}px Arial, sans-serif`; }
        g.fillText(texto, W / 2, H * 0.54);
    })), x, y, z, ry, pai);
    const AZUL = '#16365f', LARANJA = '#e4572e', AMARELO = '#f2c40f', GRAFITE = '#262b31', INOX = '#b9bfc3';
    const objetos = [], marcas = [];
    const matPessoas = M('#ffffff', 0.8, 0, { vertexColors: true }), matVeiculos = M('#ffffff', 0.5, 0.15, { vertexColors: true });
    const linha = (x0, z0, x1, z1, larg, cor, y = 0.014) => { const dx = x1 - x0, dz = z1 - z0; marcas.push(peca(cx(larg, 0.004, Math.hypot(dx, dz)), cor, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, Math.atan2(dx, dz))); };
    const tracejado = (x0, z0, x1, z1, larg, cor, cheio = 1.6, vazio = 2.4) => { const comp = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / comp, uz = (z1 - z0) / comp; for (let d = 0; d < comp; d += cheio + vazio) { const f = Math.min(comp, d + cheio); linha(x0 + ux * d, z0 + uz * d, x0 + ux * f, z0 + uz * f, larg, cor); } };

    // --- Céu, placa de betão, via de circulação e relva -------------------------------------------
    const ceu = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: tela(32, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#4f8fd0'); gr.addColorStop(0.36, '#9cc4e6'); gr.addColorStop(0.5, '#dfeaf0'); gr.addColorStop(1, '#dfeaf0'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) }));
    placa.add(ceu);
    const betao = tela(1024, 1024, (g, w) => {
        g.fillStyle = '#b3b1aa'; g.fillRect(0, 0, w, w); ruido(g, w, w, 26000, ['#a5a39c', '#bfbdb6', '#9b9992', '#c8c6bf'], 1.7);
        const r = aleatorio(77); for (let i = 0; i < 46; i++) { g.fillStyle = `rgba(70,68,64,${0.012 + r() * 0.022})`; g.beginPath(); g.ellipse(r() * w, r() * w, 30 + r() * 90, 14 + r() * 40, r() * 3, 0, 7); g.fill(); }
        g.strokeStyle = '#8a8882'; g.lineWidth = 5; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 512, 0); g.lineTo(i * 512, w); g.moveTo(0, i * 512); g.lineTo(w, i * 512); g.stroke(); }
        g.strokeStyle = 'rgba(40,40,40,0.25)'; g.lineWidth = 1.5; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(i * 512 + 2, 0); g.lineTo(i * 512 + 2, w); g.moveTo(0, i * 512 + 2); g.lineTo(w, i * 512 + 2); g.stroke(); }
    });
    horizontal(520, 96, M('#ffffff', 0.93, 0, { map: repetir(betao, 520 / 15, 96 / 15) }), 0, 0, 30);
    const asfalto = tela(512, 512, (g, w) => { g.fillStyle = '#55585b'; g.fillRect(0, 0, w, w); ruido(g, w, w, 9000, ['#4a4d50', '#606366', '#3f4245', '#6a6d70'], 1.5); });
    horizontal(520, 34, M('#ffffff', 0.95, 0, { map: repetir(asfalto, 52, 3.4) }), 0, -0.004, 95);
    const relva = tela(512, 512, (g, w) => { g.fillStyle = '#6e8f52'; g.fillRect(0, 0, w, w); ruido(g, w, w, 9000, ['#5f8046', '#7c9c5e', '#688a4c', '#88a468'], 2.2); });
    horizontal(2400, 2400, M('#ffffff', 1, 0, { map: repetir(relva, 160, 160) }), 0, -0.06, 200);
    horizontal(900, 300, M('#8d8c86', 1), 0, -0.03, -160);
    horizontal(240, 8.6, new THREE.MeshBasicMaterial({ color: '#2a2c2e', transparent: true, opacity: 0.22 }), 0, 0.006, 7.5);       // caminho de circulação
    linha(-120, 3.2, 120, 3.2, 0.15, '#f4f4f0'); linha(-120, 11.8, 120, 11.8, 0.15, '#f4f4f0'); tracejado(-120, 7.5, 120, 7.5, 0.12, '#f4f4f0');
    linha(-260, P.Z_TAXI, 260, P.Z_TAXI, 0.3, AMARELO); linha(-260, 78.6, 260, 78.6, 0.15, AMARELO); linha(-260, 78.2, 260, 78.2, 0.15, AMARELO);
    const medir = document.createElement('canvas').getContext('2d'); medir.font = 'bold 84px Arial, sans-serif';
    const chao = (texto, x, z, alturaLetra, cor = '#f2c40f') => {
        const larg = Math.ceil(medir.measureText(texto).width) + 48, h = alturaLetra * 128 / 84;
        return horizontal(h * larg / 128, h, new THREE.MeshBasicMaterial({ map: tela(larg, 128, (g) => { g.fillStyle = cor; g.font = 'bold 84px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texto, larg / 2, 68); }), transparent: true, opacity: 0.92 }), x, 0.016, z);
    };

    // --- Terminal: piso técnico, sala de embarque envidraçada e portão da central de triagem ------
    const ALT = 13.2, FUNDO = 18, LARG = 236;
    const muro = tela(1024, 512, (g, w, h) => {
        g.fillStyle = '#cdcbc3'; g.fillRect(0, 0, w, h); ruido(g, w, h, 5000, ['#c2c0b8', '#d6d4cc', '#b9b7af'], 1.4);
        g.strokeStyle = '#aeaca4'; g.lineWidth = 3; for (let x = 0; x <= w; x += 256) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
        g.fillStyle = '#7d858c'; g.fillRect(600, 150, 150, 362); g.fillStyle = '#5b6269'; g.fillRect(606, 156, 138, 356); g.fillStyle = '#f2c40f'; g.fillRect(600, 140, 150, 10);
        g.fillStyle = '#8f969c'; g.fillRect(0, 60, w, 14); g.fillRect(0, 84, w, 8);
    });
    plano(LARG, 4.4, M('#ffffff', 0.9, 0, { map: repetir(muro, LARG / 16, 1) }), 0, 2.2, 0);
    const vidro = tela(512, 512, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6f9cc0'); gr.addColorStop(0.55, '#9dbdd3'); gr.addColorStop(1, '#5d7f99'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        const r = aleatorio(5); for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) if (r() < 0.45) { g.fillStyle = `rgba(255,236,190,${0.1 + r() * 0.18})`; g.fillRect(i * 128 + 6, j * 256 + 8, 116, 240); }
        g.fillStyle = '#39424a'; for (let x = 0; x <= w; x += 128) g.fillRect(x - 3, 0, 6, h); for (let y = 0; y <= h; y += 256) g.fillRect(0, y - 4, w, 8);
    });
    plano(LARG, ALT - 5.2, M('#ffffff', 0.12, 0.55, { map: repetir(vidro, LARG / 8, 1), envMapIntensity: 1.3 }), 0, (ALT + 4.4) / 2 - 0.4, 0.02);
    objetos.push(peca(cx(LARG, 0.5, 0.5), '#e9eae6', 0, 4.4, 0.1), peca(cx(LARG + 4, 0.8, FUNDO + 5), '#e3e4e0', 0, ALT + 0.2, -FUNDO / 2 + 2.2), peca(cx(LARG, ALT, FUNDO), '#bfc2c1', 0, ALT / 2, -FUNDO / 2 - 0.02));
    for (const x of [-96, -40, 30, 84]) objetos.push(peca(cx(9, 2.4, 6), '#aeb3b6', x, ALT + 1.8, -9), peca(cil(0.9, 0.9, 1.6, 14), '#c9ced2', x + 6.5, ALT + 1.4, -8));
    plano(8.4, 4.0, new THREE.MeshBasicMaterial({ color: '#0c0e10' }), 0, 2.0, 0.04);
    for (const s of [-1, 1]) for (let k = 0; k < 9; k++) objetos.push(peca(cx(0.5, 0.46, 0.3), k % 2 ? '#1b1c1e' : AMARELO, s * 4.45, 0.23 + k * 0.46, 0.15));
    for (let k = 0; k < 19; k++) objetos.push(peca(cx(0.5, 0.5, 0.3), k % 2 ? '#1b1c1e' : AMARELO, -4.5 + k * 0.5, 4.25, 0.15));
    for (let k = 0; k < 20; k++) objetos.push(peca(cx(0.36, 1.5, 0.03), '#3c444b', -3.8 + k * 0.4, 3.25, 0.1));                 // cortina de lamelas
    letreiro('CENTRAL DE TRIAGEM  ·  SAÍDAS S01–S04', 11.4, 0.95, AZUL, '#ffffff', -2.6, 5.45, 0.36);
    chao('TRIAGEM', 0, 1.7, 0.9, '#f4f4f0');
    for (const x of [-110, -44, 44, 110]) {                                                     // torres de iluminação da placa
        objetos.push(peca(cil(0.22, 0.34, 27, 10), '#9aa1a7', x, 13.5, -1.2), peca(cx(4.2, 1.2, 0.5), '#3a4148', x, 26.6, -0.9, 0.35));
        for (let k = 0; k < 4; k++) objetos.push(peca(cx(0.8, 0.8, 0.12), '#fff6d8', x - 1.5 + k, 26.6, -0.62, 0.35));
    }

    // --- Avião (a mesma geometria nos quatro lugares) ---------------------------------------------
    const geo = geometriasAviao(), tex = pintura();
    const matFuselagem = M('#ffffff', 0.36, 0.08, { map: tex, envMapIntensity: 1.1 });
    const matPele = M('#ffffff', 0.36, 0.08, { map: tex, envMapIntensity: 1.1, side: THREE.DoubleSide });
    const matForro = M('#767e85', 0.9, 0, { side: THREE.DoubleSide, emissive: '#1b1e21' });
    const matDentro = M('#ffffff', 0.8, 0, { vertexColors: true, side: THREE.DoubleSide, emissive: '#2a2d30' });
    const matPartes = M('#ffffff', 0.4, 0.25, { vertexColors: true, side: THREE.DoubleSide });
    const forros = [];
    const gTrator = geometriaTrator(), gReboque = geometriaReboque(), gTapete = geometriasTapete(), gCondutor = geometriaPessoa(71, true); gCondutor.userData = { papel: 'placa', semente: 71, sentado: true, assento: 0.95 };
    const lonaTex = tela(64, 256, (g) => { g.fillStyle = '#1c1d1f'; g.fillRect(0, 0, 64, 256); ruido(g, 64, 256, 500, ['#141516', '#2a2c2e'], 1.2); g.fillStyle = '#3a3d40'; for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 64, 3); });
    const lugares = {};

    Object.entries(P.LUGARES).forEach(([codigo, xc], i) => {
        // avião
        const aviao = new THREE.Group(); aviao.position.set(xc, 0, P.Z_NARIZ); placa.add(aviao);
        const casco = add(geo.fuselagem, matFuselagem, 0, 0, 0, aviao); casco.userData.lugar = codigo;
        add(geo.exterior, matPele, 0, 0, 0, aviao).userData.lugar = codigo;
        forros.push(add(geo.forro, matForro, 0, 0, 0, aviao, false));
        add(geo.dentro, matDentro, 0, 0, 0, aviao, false);
        add(geo.partes, matPartes, 0, 0, 0, aviao).userData.lugar = codigo;
        const matDeriva = M(AZUL, 0.4, 0.1, { side: THREE.DoubleSide }), deriva = add(geo.deriva, matDeriva, 0, 0, 0, aviao);
        const portas = {};
        for (const nome of Object.keys(A.PORTAS)) { const p = add(geo.portas[nome], matPele, geo.dobradica[0], geo.dobradica[1], 0, aviao); portas[nome] = p; }
        const trator = add(geo.trator, matVeiculos, 0, 0, 0, aviao); trator.visible = false;

        // marcas do lugar: linha de entrada, barra de paragem, limite de segurança e número
        linha(xc, P.Z_TAXI, xc, P.Z_NARIZ + A.S_RODA, 0.22, AMARELO); linha(xc - 1.6, P.Z_NARIZ + A.S_RODA, xc + 1.6, P.Z_NARIZ + A.S_RODA, 0.3, AMARELO);
        for (const [x0, z0, x1, z1] of [[-19.6, 14, 19.6, 14], [-19.6, 14, -19.6, 60], [19.6, 14, 19.6, 60]]) { linha(xc + x0, z0, xc + x1, z1, 0.2, '#c0392b'); }
        tracejado(xc + P.FAIXA_ENTRADA - 1.4, 12, xc + P.FAIXA_ENTRADA - 1.4, 50, 0.1, '#f4f4f0', 1, 2); tracejado(xc + P.FAIXA_ENTRADA + 1.4, 12, xc + P.FAIXA_ENTRADA + 1.4, 50, 0.1, '#f4f4f0', 1, 2);
        chao(codigo, xc, 70, 3.2); chao(codigo, xc + 6.5, 15.4, 1.1);
        for (const k of [-1, 1]) for (const dz of [-0.72, 0.72]) objetos.push(peca(cx(0.5, 0.2, 0.25), AMARELO, xc + k * 3.8, 0.1, P.Z_NARIZ + A.S_TREM + dz));           // calços
        objetos.push(peca(cx(6.5, 0.012, 3), '#d9d9d2', xc - 12.5, 0.008, 15.8));                                                 // zona de equipamento
        for (const [dx, dz] of [[18.3, 39.5], [-18.3, 39.5], [0, 57.4], [-5.75, 27.2], [-7.6, 27.4]]) objetos.push(peca(new THREE.ConeGeometry(0.17, 0.5, 10), '#ff6a13', xc + dx, 0.25, P.Z_NARIZ + dz - 18), peca(cx(0.36, 0.03, 0.36), '#ff6a13', xc + dx, 0.015, P.Z_NARIZ + dz - 18));
        // grupo de energia de terra, com o cabo ligado junto ao nariz
        objetos.push(peca(caixaRedonda(1.3, 1.1, 2.4, 0.08), AMARELO, xc - 4.6, 0.3, 21.5), roda(0.25, 0.2, xc - 5.25, 20.8), roda(0.25, 0.2, xc - 3.95, 20.8), roda(0.25, 0.2, xc - 5.25, 22.2), roda(0.25, 0.2, xc - 3.95, 22.2), peca(cx(0.07, 0.07, 3.6), '#1b1c1e', xc - 2.6, 0.04, 22.6, 0, 1.0));

        // manga: rotunda junto ao terminal, túnel telescópico e cabeça encostada à porta dianteira esquerda
        const rx = xc - 16, rz = 3.6, px = xc - 4.15, pz = P.Z_NARIZ + 5.35, dir = Math.atan2(px - rx, pz - rz), compManga = Math.hypot(px - rx, pz - rz);
        objetos.push(peca(cil(0.55, 0.65, 3.5, 14), '#c9ced2', rx, 1.75, rz), peca(cil(2.3, 2.3, 3.0, 24), '#e9eae6', rx, 4.95, rz), peca(cil(2.42, 2.42, 0.25, 24), '#8c949b', rx, 6.5, rz), peca(cil(2.33, 2.33, 0.9, 24), '#27465f', rx, 5.2, rz), peca(cx(2.6, 3.0, 3.8), '#e9eae6', rx, 4.95, 1.4));
        letreiro(codigo.slice(1), 2.4, 1.5, AZUL, '#ffffff', rx, 8.2, 0.34);
        const manga = new THREE.Group(); manga.position.set(rx, 0, rz); manga.rotation.y = dir; placa.add(manga);
        const fixo = [peca(cx(2.5, 2.9, 12.5), '#e9eae6', 0, 4.95, 7.6), peca(cx(2.56, 0.9, 12), '#27465f', 0, 5.15, 7.6), peca(cx(2.62, 0.14, 12.6), '#8c949b', 0, 6.47, 7.6)];
        add(fundir(fixo), matVeiculos, 0, 0, 0, manga);
        const movel = new THREE.Group(); manga.add(movel);
        const m2 = [peca(cx(2.2, 2.6, compManga - 10.5), '#e9eae6', 0, 4.9, 9 + (compManga - 10.5) / 2), peca(cx(2.26, 0.8, compManga - 11), '#27465f', 0, 5.1, 9 + (compManga - 10.5) / 2), peca(cx(2.3, 0.12, compManga - 10.4), '#8c949b', 0, 6.26, 9 + (compManga - 10.5) / 2)];
        const zb = compManga - 4.6;                                                              // apoio motorizado
        m2.push(peca(cx(0.22, 3.4, 0.22), '#8c949b', -0.95, 1.9, zb), peca(cx(0.22, 3.4, 0.22), '#8c949b', 0.95, 1.9, zb), peca(cx(3.0, 0.3, 0.5), '#3a4148', 0, 0.55, zb), roda(0.42, 0.32, -1.35, zb), roda(0.42, 0.32, 1.35, zb));
        add(fundir(m2), matVeiculos, 0, 0, 0, movel);
        const cab = new THREE.Group(); cab.position.set(0, 0, compManga); cab.rotation.y = -dir; movel.add(cab);
        add(fundir([peca(cil(1.75, 1.75, 2.9, 20), '#e9eae6', 0, 4.9, 0), peca(cil(1.84, 1.84, 0.2, 20), '#8c949b', 0, 6.4, 0), peca(cx(1.7, 2.5, 2.3), '#30363c', 1.35, 4.75, 0), peca(cx(0.25, 2.7, 2.5), '#1b1c1e', 2.1, 4.75, 0)]), matVeiculos, 0, 0, 0, cab);
        letreiro(codigo.slice(1), 1.5, 1.0, AZUL, '#ffffff', 0.4, 5.4, 1.78, 0, cab);

        // quadro de informação do lugar, na fachada
        const cnv = document.createElement('canvas'); cnv.width = 1024; cnv.height = 400; const texQ = new THREE.CanvasTexture(cnv); texQ.colorSpace = THREE.SRGBColorSpace; texQ.anisotropy = 8;
        plano(8.4, 3.28, basico(texQ), xc + 8.5, 8.7, 0.3);
        objetos.push(peca(cx(8.8, 3.7, 0.22), GRAFITE, xc + 8.5, 8.7, 0.16));

        // tapetes de carregamento, um por porta de carga
        const tapetes = {};
        for (const [nome, s] of [['frente', 9.0], ['tras', 24.5]]) {
            const g = new THREE.Group(); g.position.set(xc, 0, P.Z_NARIZ + s); placa.add(g);
            add(gTapete.base, matVeiculos, 0, 0, 0, g);
            const lanca = new THREE.Group(); lanca.position.set(P.PE_TAPETE, P.Y_PE, 0); lanca.rotation.z = -P.INCLINACAO; g.add(lanca);
            add(gTapete.lanca, matVeiculos, 0, 0, 0, lanca);
            const lona = repetir(lonaTex.clone(), 1, 6), fitaM = new THREE.Mesh(new THREE.PlaneGeometry(0.76, P.COMP_TAPETE - 0.1), M('#ffffff', 0.9, 0, { map: lona }));
            fitaM.rotation.set(-Math.PI / 2, 0, Math.PI / 2); fitaM.position.set(-P.COMP_TAPETE / 2, 0.012, 0); fitaM.receiveShadow = true; lanca.add(fitaM);
            const equipa = new THREE.Group(); placa.add(equipa);
            add(geometriaPessoa(80 + i * 4 + (nome === 'tras' ? 2 : 0), true), matPessoas, xc + P.PE_TAPETE + 0.75, 0, P.Z_NARIZ + s - 0.95, equipa).rotation.y = -0.4;
            add(geometriaPessoa(81 + i * 4 + (nome === 'tras' ? 2 : 0), true), matPessoas, xc + 2.5, 0, P.Z_NARIZ + s + 1.25, equipa).rotation.y = -2.2;
            tapetes[nome] = { grupo: g, lanca, lona, equipa, z: P.Z_NARIZ + s };
        }
        add(geometriaPessoa(90 + i, true), matPessoas, xc + 6.2, 0, 20.4).rotation.y = 2.4;                                          // coordenador da placa

        // comboios de reboques: trator com condutor e dois reboques
        const rota = rotaReboques(xc), comboios = {};
        for (const nome of ['frente', 'tras']) {
            const unidades = [0, 1, 2].map(k => { const u = new THREE.Group(); add(k ? gReboque : gTrator, matVeiculos, 0, 0, 0, u); if (!k) add(gCondutor, matPessoas, 0, 0.02, -0.5, u).scale.set(1, 0.78, 1); u.visible = false; placa.add(u); return u; });
            comboios[nome] = unidades;
        }
        lugares[codigo] = { codigo, xc, aviao, deriva: matDeriva, portas, trator, manga: movel, tapetes, comboios, rota, recuo: rotaRecuo(xc), quadro: { canvas: cnv, tex: texQ, chave: '' } };
    });

    add(fundir(objetos), M('#ffffff', 0.6, 0.1, { vertexColors: true }));
    const mMarcas = add(fundir(marcas), M('#ffffff', 0.85, 0, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 0, 0, 0, placa, false); mMarcas.receiveShadow = true;

    // --- Luz: sol alto do lado de estibordo, para iluminar as portas de carga ---------------------
    scene.add(new THREE.HemisphereLight('#dcebf7', '#9c9a92', 0.95));
    const sol = new THREE.DirectionalLight('#fff3dc', 2.6); sol.position.set(95, 120, 120); sol.target.position.set(0, 0, 36); sol.castShadow = true; sol.shadow.mapSize.set(4096, 4096);
    Object.assign(sol.shadow.camera, { left: -135, right: 135, top: 75, bottom: -75, near: 20, far: 420 }); sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.08; scene.add(sol); scene.add(sol.target);

    return { placa, lugares, matPele, matPartes, forros, matPessoas, matMalas: M('#ffffff', 0.55, 0.05, { vertexColors: true }) };
}
