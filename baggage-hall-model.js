// Bloco 2 · Bagagens: modelo 3D da sala de recolha (maquete didática).
// Interpretação de fotografias da sala de recolha de bagagens do Aeroporto Francisco Sá Carneiro:
// carrosséis de placas inclinadas com rodapé azul e frente em inox, placas numeradas em escudo
// azul-escuro, colunas redondas brancas, teto branco com vigas e painéis de luz, pavimento claro
// com faixas cinzento-azuladas. A zona técnica atrás da parede é didática. 1 unidade = 1 metro.
// Não é um levantamento arquitetónico nem reproduz as instalações técnicas reais.
import * as THREE from 'three';

export const G = {
    RETA: 12, MEIO: 6, ZC: 4,                    // carrossel: retas de 12 m, centro em z = 4
    R_FASCIA: 3.25, R_EXT: 3.05, R_INT: 1.5, R_MALA: 2.28,
    Y_EXT: 0.56, Y_INT: 1.0,                     // as placas descem do centro para fora
    XS: [-30, -10, 10, 30],
    Z_PAREDE: -16, Z_SAIDA: 27, Z_PLACA: -36, X_LADO: 46, ALTURA: 5.6,
    S_QUEDA: 2,                                  // ponto da reta esquerda onde as malas caem no carrossel
};
G.PERIMETRO = 2 * G.RETA + 2 * Math.PI * G.R_MALA;
G.INCLINACAO = Math.atan2(G.Y_INT - G.Y_EXT, G.R_EXT - G.R_INT);

// Ponto do circuito do carrossel a s metros do início da reta esquerda (coordenadas locais ao carrossel).
export function pontoCircuito(s, r = G.R_MALA) {
    s = ((s % G.PERIMETRO) + G.PERIMETRO) % G.PERIMETRO;
    const arco = Math.PI * G.R_MALA, M = G.MEIO;
    let x, z, tx, tz, rx, rz;
    if (s < G.RETA) { rx = -1; rz = 0; x = -r; z = -M + s; tx = 0; tz = 1; }
    else if ((s -= G.RETA) < arco) { const a = Math.PI - s / G.R_MALA; rx = Math.cos(a); rz = Math.sin(a); x = r * rx; z = M + r * rz; tx = Math.sin(a); tz = -Math.cos(a); }
    else if ((s -= arco) < G.RETA) { rx = 1; rz = 0; x = r; z = M - s; tx = 0; tz = -1; }
    else { const a = (s - G.RETA) / G.R_MALA; rx = Math.cos(a); rz = -Math.sin(a); x = r * rx; z = -M + r * rz; tx = -Math.sin(a); tz = -Math.cos(a); }
    const y = G.Y_INT + (G.Y_EXT - G.Y_INT) * (r - G.R_INT) / (G.R_EXT - G.R_INT);
    return { x, y, z: z + G.ZC, tx, tz, rx, rz };
}

// Tapete de alimentação: do cais da zona técnica até ao carrossel. d = metros a montante da queda.
const TROCOS = [                                  // [x, y, z] locais ao carrossel; o último troço fica dentro da caixa
    [-G.R_MALA, 0.9, G.ZC - G.MEIO + G.S_QUEDA], [-1.02, 1.42, G.ZC - G.MEIO + G.S_QUEDA],
    [0, 1.86, -3.0], [0, 1.86, -9], [0, 0.92, -17.5], [0, 0.92, -28],
];
const COMP = TROCOS.slice(1).map((p, i) => Math.hypot(p[0] - TROCOS[i][0], p[1] - TROCOS[i][1], p[2] - TROCOS[i][2]));
export const COMPRIMENTO_ALIMENTACAO = COMP.reduce((a, b) => a + b, 0);
export function pontoAlimentacao(d) {
    let i = 0;
    while (i < COMP.length - 1 && d > COMP[i]) d -= COMP[i++];
    const a = TROCOS[i], b = TROCOS[i + 1], k = Math.min(1, d / COMP[i]);
    return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, z: a[2] + (b[2] - a[2]) * k, oculto: i === 1 && k > 0.12 && k < 0.97, troco: i,
        angulo: Math.atan2(b[0] - a[0], b[2] - a[2]), declive: Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2])) };
}

// ---------------------------------------------------------------------------
// Utilitários de geometria e textura
function aleatorio(semente) { let s = semente >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function tela(w, h, pintar) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); pintar(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function repetir(t, x, y) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(x, y); return t; }
function ruido(g, w, h, n, cores, raio = 1.4) { const r = aleatorio(w * 31 + n); for (let i = 0; i < n; i++) { g.fillStyle = cores[Math.floor(r() * cores.length)]; g.globalAlpha = 0.25 + r() * 0.5; g.beginPath(); g.arc(r() * w, r() * h, r() * raio + 0.3, 0, 7); g.fill(); } g.globalAlpha = 1; }

// Funde peças numa só geometria com cor por vértice: uma malha por objeto, em vez de dezenas.
export function fundir(pecas) {
    let n = 0;
    const prontas = pecas.map(([geo, cor]) => { const g = geo.index ? geo.toNonIndexed() : geo; n += g.attributes.position.count; return [g, new THREE.Color(cor)]; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const [g, c] of prontas) {
        pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
        for (let i = 0; i < g.attributes.position.count; i++) col.set([c.r, c.g, c.b], (o + i) * 3);
        o += g.attributes.position.count;
    }
    const f = new THREE.BufferGeometry();
    f.setAttribute('position', new THREE.BufferAttribute(pos, 3)); f.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); f.setAttribute('color', new THREE.BufferAttribute(col, 3));
    f.setAttribute('uv', new THREE.BufferAttribute(uvCaixa(pos, nor), 2)); f.userData.uvMundo = true;      // para as texturas de acabamento (acabamentos.js)
    return f;
}
// Coordenadas de textura projetadas pela normal (mapeamento em caixa), 1 unidade = 1 metro.
export function uvCaixa(pos, nor) {
    const n = pos.length / 3, uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
        const ax = Math.abs(nor[i * 3]), ay = Math.abs(nor[i * 3 + 1]), az = Math.abs(nor[i * 3 + 2]);
        if (ax >= ay && ax >= az) { uv[i * 2] = pos[i * 3 + 2]; uv[i * 2 + 1] = pos[i * 3 + 1]; }
        else if (ay >= az) { uv[i * 2] = pos[i * 3]; uv[i * 2 + 1] = pos[i * 3 + 2]; }
        else { uv[i * 2] = pos[i * 3]; uv[i * 2 + 1] = pos[i * 3 + 1]; }
    }
    return uv;
}
const peca = (geo, cor, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { if (rx || ry || rz) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))); geo.translate(x, y, z); return [geo, cor]; };
const cx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cil = (r1, r2, h, n = 12) => new THREE.CylinderGeometry(r1, r2, h, n);

function caixaRedonda(comp, alt, larg, raio) {    // caixa com cantos arredondados, assente em y = 0
    const b = Math.min(raio, alt / 2 - 0.01), w = comp - 2 * b, d = larg - 2 * b, r = Math.min(raio, w / 2, d / 2), s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -d / 2); s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r); s.lineTo(w / 2, d / 2 - r); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    s.lineTo(-w / 2 + r, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); s.lineTo(-w / 2, -d / 2 + r); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: alt - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 2, curveSegments: 4 });
    g.rotateX(-Math.PI / 2); g.translate(0, b, 0); return g;
}

function estadio(r) {                             // contorno do carrossel (duas retas e dois semicírculos)
    const s = new THREE.Shape(), M = G.MEIO;
    s.moveTo(-r, -M); s.lineTo(-r, M); s.absarc(0, M, r, Math.PI, 0, true); s.lineTo(r, -M); s.absarc(0, -M, r, 0, Math.PI, true); return s;
}
function furoEstadio(r) {
    const p = new THREE.Path(), M = G.MEIO;
    p.moveTo(-r, -M); p.absarc(0, -M, r, Math.PI, 0, false); p.lineTo(r, M); p.absarc(0, M, r, 0, Math.PI, false); p.lineTo(-r, -M); return p;
}
function anel(rExt, rInt, altura) { const s = estadio(rExt); s.holes.push(furoEstadio(rInt)); const g = new THREE.ExtrudeGeometry(s, { depth: altura, bevelEnabled: false, curveSegments: 24 }); g.rotateX(-Math.PI / 2); return g; }
function macico(r, altura) { const g = new THREE.ExtrudeGeometry(estadio(r), { depth: altura, bevelEnabled: false, curveSegments: 24 }); g.rotateX(-Math.PI / 2); return g; }

// ---------------------------------------------------------------------------
// Malas e pessoas
const CORES_MALA = ['#1f2a37', '#2b2b2e', '#3b3f46', '#5a1f24', '#8c2f39', '#1e4d6b', '#2f6f8f', '#3e5c3a', '#6b6f76', '#b8b9b4', '#c9a227', '#6a3d7c', '#b5532a', '#234a4a', '#7a6a55', '#d4d0c8'];
export function geometriaMala(indice, corVoo) {
    const r = aleatorio(indice * 7919 + 17), cor = CORES_MALA[Math.floor(r() * CORES_MALA.length)], tipo = Math.floor(r() * 10);
    const escuro = new THREE.Color(cor).multiplyScalar(0.55).getStyle(), p = [];
    let L, H, W;
    if (tipo < 5) {                               // mala rígida de porão, deitada
        L = 0.66 + r() * 0.14; H = 0.26 + r() * 0.05; W = 0.44 + r() * 0.06;
        p.push(peca(caixaRedonda(L, H, W, 0.06), cor));
        for (const k of [-0.3, -0.1, 0.1, 0.3]) p.push(peca(cx(0.025, 0.012, W * 0.82), escuro, k * L, H, 0));
        p.push(peca(cx(0.16, 0.035, 0.05), '#191a1c', 0, H + 0.012, W * 0.33));
        p.push(peca(cx(0.05, 0.05, 0.22), '#191a1c', L / 2 + 0.02, H * 0.55, 0));
        for (const k of [-1, 1]) p.push(peca(cil(0.035, 0.035, 0.04, 8), '#111', -L / 2 - 0.015, 0.05, k * W * 0.36, Math.PI / 2));
    } else if (tipo < 8) {                        // mala de tecido com bolso
        L = 0.6 + r() * 0.12; H = 0.27 + r() * 0.06; W = 0.4 + r() * 0.06;
        p.push(peca(caixaRedonda(L, H, W, 0.035), cor));
        p.push(peca(caixaRedonda(L * 0.62, 0.035, W * 0.7, 0.012), escuro, -L * 0.1, H - 0.004, 0));
        p.push(peca(cx(L * 0.98, 0.02, 0.012), escuro, 0, H * 0.5, W / 2 + 0.002)); p.push(peca(cx(L * 0.98, 0.02, 0.012), escuro, 0, H * 0.5, -W / 2 - 0.002));
        p.push(peca(cx(0.05, 0.045, 0.2), '#191a1c', L / 2 + 0.02, H * 0.55, 0));
    } else if (tipo < 9) {                        // saco de desporto
        L = 0.62 + r() * 0.1; H = 0.3; W = 0.32;
        const corpo = new THREE.CapsuleGeometry(0.155, L - 0.31, 4, 10); corpo.rotateZ(Math.PI / 2); corpo.translate(0, 0.155, 0); p.push([corpo, cor]);
        for (const k of [-0.16, 0.16]) p.push(peca(new THREE.TorusGeometry(0.16, 0.014, 4, 14), '#191a1c', k, 0.155, 0, 0, Math.PI / 2));
        p.push(peca(cx(0.3, 0.02, 0.03), '#191a1c', 0, 0.33, 0));
    } else {                                      // mochila ou mala de cabina
        L = 0.5; H = 0.24; W = 0.34;
        p.push(peca(caixaRedonda(L, H, W, 0.07), cor)); p.push(peca(caixaRedonda(L * 0.55, 0.05, W * 0.75, 0.02), escuro, -0.06, H - 0.01, 0));
    }
    p.push(peca(cx(0.05, H + 0.012, W + 0.012), corVoo, L * 0.18, H / 2, 0));        // cinta com a cor do voo
    p.push(peca(cx(0.1, 0.004, 0.045), '#f4f4ee', L * 0.36, H + 0.004, -W * 0.2, 0, 0.5));  // etiqueta de bagagem
    const g = fundir(p); g.userData = { L, H, W }; return g;
}

const PELE = ['#e8c4a0', '#d9a77f', '#c68b5e', '#9a6843', '#6f4a2f', '#f0d0b4'], CABELO = ['#1d1a17', '#3a2a1c', '#6b4a2b', '#a9843f', '#c9c9c6', '#7b2f1e'];
const ROUPA = ['#2f4a6b', '#7a2e2e', '#3d5a3a', '#c8b68a', '#252a33', '#8a8f96', '#b5532a', '#4b3b63', '#d7d2c4', '#1f5f6b', '#a23b4a', '#5b6f8c'], CALCA = ['#22262d', '#2c3e58', '#4a4033', '#3a3a3a', '#5b5f66', '#1d2a3a', '#6b5a44'];
export function geometriaPessoa(semente, colete = false) {
    const r = aleatorio(semente * 2654435 + 99), e = 0.93 + r() * 0.13, lg = 0.92 + r() * 0.22, p = [];
    const pele = PELE[Math.floor(r() * PELE.length)], cabelo = CABELO[Math.floor(r() * CABELO.length)], roupa = colete ? '#f08a1c' : ROUPA[Math.floor(r() * ROUPA.length)], calca = colete ? '#1d2a3a' : CALCA[Math.floor(r() * CALCA.length)];
    for (const k of [-1, 1]) {
        p.push(peca(cx(0.13 * lg, 0.8, 0.15), calca, k * 0.09 * lg, 0.48, 0)); p.push(peca(cx(0.12, 0.08, 0.25), '#1b1b1d', k * 0.09 * lg, 0.04, 0.04));
        p.push(peca(cil(0.05, 0.042, 0.6, 6), roupa, k * 0.25 * lg, 1.15, 0, 0, 0, k * 0.08)); p.push(peca(new THREE.SphereGeometry(0.045, 6, 5), pele, k * 0.275 * lg, 0.83, 0));
    }
    const tronco = cil(0.2 * lg, 0.17 * lg, 0.6, 10); tronco.scale(1, 1, 0.62); p.push(peca(tronco, roupa, 0, 1.17, 0));
    p.push(peca(cil(0.05, 0.055, 0.08, 8), pele, 0, 1.5, 0)); p.push(peca(new THREE.SphereGeometry(0.105, 12, 10), pele, 0, 1.63, 0));
    const cab = new THREE.SphereGeometry(0.112, 12, 8, 0, Math.PI * 2, 0, Math.PI * (r() < 0.45 ? 0.62 : 0.48)); p.push(peca(cab, cabelo, 0, 1.64, -0.012));
    if (colete) { const f = cil(0.205 * lg, 0.185 * lg, 0.06, 10); f.scale(1, 1, 0.64); p.push(peca(f, '#e9f0c2', 0, 1.12, 0)); const f2 = cil(0.2 * lg, 0.19 * lg, 0.06, 10); f2.scale(1, 1, 0.64); p.push(peca(f2, '#e9f0c2', 0, 1.28, 0)); }
    else if (r() < 0.3) p.push(peca(caixaRedonda(0.3, 0.42, 0.16, 0.05), ROUPA[Math.floor(r() * ROUPA.length)], 0, 0.95, -0.2));   // mochila
    const g = fundir(p); g.scale(e, e, e); g.userData = { papel: colete ? 'placa' : 'passageiro', semente }; return g;
}

// ---------------------------------------------------------------------------
export function construirSala(scene, renderer) {
    const sala = new THREE.Group(), teto = new THREE.Group(); sala.name = 'Sala de recolha de bagagens — maquete didática'; scene.add(sala); sala.add(teto);
    const M = (cor, rug = 0.8, met = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: rug, metalness: met, ...extra });
    // Ambiente para reflexos em inox, vidro e pedra polida (mesma técnica da maquete exterior).
    const amb = tela(512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#eef1f2'); gr.addColorStop(0.5, '#cfd6da'); gr.addColorStop(0.56, '#9a9c98'); gr.addColorStop(1, '#6f6a60'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; for (let i = 0; i < 12; i++) g.fillRect(i * 44 + 8, 18, 24, 34); });
    amb.mapping = THREE.EquirectangularReflectionMapping; const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(amb).texture; scene.environmentIntensity = 0.55; amb.dispose(); pm.dispose();

    const inox = M('#c6cacc', 0.3, 0.92), inoxEscovado = M('#b4b9bc', 0.42, 0.85), preto = M('#17181a', 0.75), borracha = M('#1d1e20', 0.9), branco = M('#f1f1ec', 0.7), cinza = M('#8d9499', 0.6, 0.3);
    const azulOPO = M('#1e4fa0', 0.45, 0.2), totemMat = M('#2a3742', 0.5, 0.35), amarelo = M('#e8b90f', 0.6);
    const add = (geo, mat, x = 0, y = 0, z = 0, pai = sala, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; pai.add(m); return m; };
    const plano = (w, h, mat, x, y, z, ry = 0, pai = sala) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; pai.add(m); return m; };
    const horizontal = (w, d, mat, x, y, z, pai = sala) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; pai.add(m); return m; };

    // --- Pavimentos ---------------------------------------------------------
    const pedra = tela(1024, 1024, (g, w) => {   // granito claro em lajes de 0,9 m com cabochões escuros
        g.fillStyle = '#d9d3c4'; g.fillRect(0, 0, w, w); ruido(g, w, w, 9000, ['#c9c1b0', '#e6e1d4', '#b9b2a3', '#efeadf'], 1.6);
        const n = 8, t = w / n; g.strokeStyle = '#a9a394'; g.lineWidth = 2;
        for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, w); g.moveTo(0, i * t); g.lineTo(w, i * t); g.stroke(); }
        g.fillStyle = '#4f5a63'; for (let i = 0; i < n; i += 2) for (let j = 0; j < n; j += 2) { g.save(); g.translate(i * t, j * t); g.rotate(Math.PI / 4); g.fillRect(-13, -13, 26, 26); g.restore(); }
    });
    const larguraSala = 2 * G.X_LADO, fundoSala = G.Z_SAIDA - G.Z_PAREDE, zMeioSala = (G.Z_SAIDA + G.Z_PAREDE) / 2;
    horizontal(larguraSala, fundoSala, M('#f1ece2', 0.24, 0.05, { map: repetir(pedra, larguraSala / 7.2, fundoSala / 7.2) }), 0, 0, zMeioSala);
    horizontal(larguraSala, 7, M('#ffffff', 0.3, 0.05, { map: repetir(pedra.clone(), larguraSala / 7.2, 1) }), 0, -0.002, G.Z_SAIDA + 3.5);   // átrio das chegadas
    const faixa = tela(256, 256, (g, w) => { g.fillStyle = '#6f7f8c'; g.fillRect(0, 0, w, w); ruido(g, w, w, 1800, ['#5f6f7c', '#8493a0', '#55646f'], 1.5); g.strokeStyle = '#4c5a66'; g.lineWidth = 2; g.strokeRect(0, 0, w, w); });
    const matFaixa = (rx, ry) => M('#ffffff', 0.2, 0.08, { map: repetir(faixa.clone(), rx, ry) });
    horizontal(larguraSala - 4, 3.6, matFaixa((larguraSala - 4) / 0.9, 4), 0, 0.006, 19.2);          // corredor principal em frente aos carrosséis
    for (const x of [-20, 0, 20]) horizontal(1.8, 22, matFaixa(2, 24), x, 0.006, 6.4);              // travessas entre carrosséis
    const betao = tela(512, 512, (g, w) => { g.fillStyle = '#8b8d88'; g.fillRect(0, 0, w, w); ruido(g, w, w, 6000, ['#7c7e7a', '#9a9c97', '#6f716d', '#a5a7a1'], 2.2); g.strokeStyle = '#6c6e6a'; g.lineWidth = 3; g.strokeRect(0, 0, w, w); });
    const fundoTec = G.Z_PAREDE - G.Z_PLACA;
    horizontal(larguraSala, fundoTec, M('#ffffff', 0.92, 0, { map: repetir(betao, larguraSala / 5, fundoTec / 5) }), 0, 0, (G.Z_PAREDE + G.Z_PLACA) / 2);
    for (const s of [-1, 1]) horizontal(16, fundoTec, M('#ffffff', 0.95, 0, { map: repetir(betao.clone(), 3, fundoTec / 5), color: '#b9bab5' }), s * (G.X_LADO + 8), -0.002, (G.Z_PAREDE + G.Z_PLACA) / 2);   // placa
    for (const z of [-30.2, -33.4]) horizontal(larguraSala - 6, 0.14, amarelo, 0, 0.008, z);          // via de circulação dos tratores
    for (let x = -42; x < 42; x += 3) horizontal(1.4, 0.12, M('#eeeeea', 0.8), x + 0.7, 0.008, -31.8);
    for (const x of G.XS) { const zebra = tela(128, 128, (g) => { g.fillStyle = '#e8b90f'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#1b1b1b'; for (let i = -128; i < 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 - 128, 128); g.lineTo(i - 128, 128); g.fill(); } }); horizontal(9.2, 0.35, M('#fff', 0.8, 0, { map: repetir(zebra, 20, 1) }), x + 3.4, 0.009, -29.3); }

    // --- Paredes --------------------------------------------------------------
    const painel = tela(512, 512, (g, w) => { g.fillStyle = '#ecece7'; g.fillRect(0, 0, w, w); ruido(g, w, w, 1500, ['#e4e4de', '#f4f4f0'], 2); g.strokeStyle = '#c9cac4'; g.lineWidth = 3; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(0, i * 256); g.lineTo(w, i * 256); g.stroke(); } g.beginPath(); g.moveTo(0, 0); g.lineTo(0, w); g.stroke(); g.fillStyle = '#b9bcb8'; g.fillRect(0, w - 26, w, 26); });
    const matParede = (larg) => M('#ffffff', 0.85, 0, { map: repetir(painel.clone(), larg / 2.8, 1) });
    const zP = G.Z_PAREDE, A = G.ALTURA, vao = 0.95;   // parede entre a sala e a zona técnica, com um vão por tapete
    let xa = -G.X_LADO;
    for (const x of [...G.XS, null]) { const xb = x === null ? G.X_LADO : x - vao; add(cx(xb - xa, A, 0.35), matParede(xb - xa), (xa + xb) / 2, A / 2, zP); if (x !== null) { add(cx(2 * vao, A - 2.25, 0.35), matParede(2), x, (A + 2.25) / 2, zP); add(cx(2 * vao, 0.42, 0.35), cinza, x, 0.21, zP); xa = x + vao; } }
    for (const x of G.XS) {                        // aro em inox e cortina de lamelas em cada vão
        for (const k of [-1, 1]) add(cx(0.08, 1.9, 0.42), inox, x + k * vao, 1.33, zP); add(cx(2 * vao + 0.08, 0.08, 0.42), inox, x, 2.27, zP);
        const lamela = M('#22262a', 0.6, 0, { transparent: true, opacity: 0.82, side: THREE.DoubleSide });
        for (let i = 0; i < 9; i++) plano(0.19, 0.95, lamela, x - vao + 0.12 + i * 0.207, 1.76, zP + 0.02 * (i % 2 ? 1 : -1), 0);
    }
    plano(fundoSala, A, matParede(fundoSala), -G.X_LADO, A / 2, zMeioSala, Math.PI / 2); plano(fundoSala, A, matParede(fundoSala), G.X_LADO, A / 2, zMeioSala, -Math.PI / 2);
    // Parede da saída: frente envidraçada com alfândega (canais verde e vermelho)
    const vidro = M('#9fc4cf', 0.08, 0.1, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, envMapIntensity: 1.4 });
    plano(larguraSala, A, vidro, 0, A / 2, G.Z_SAIDA, Math.PI); for (let x = -G.X_LADO; x <= G.X_LADO; x += 4) add(cx(0.09, A, 0.12), inoxEscovado, x, A / 2, G.Z_SAIDA - 0.05, sala, false);
    add(cx(larguraSala, 0.12, 0.14), inoxEscovado, 0, 2.6, G.Z_SAIDA - 0.05, sala, false); add(cx(larguraSala, 0.5, 0.2), branco, 0, A - 0.25, G.Z_SAIDA - 0.05, sala, false);

    // --- Colunas e teto -------------------------------------------------------
    const canelado = tela(256, 64, (g, w, h) => { for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#8f969b'); gr.addColorStop(0.5, '#e1e5e7'); gr.addColorStop(1, '#8f969b'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); } });
    const matCanelado = (rep) => M('#ffffff', 0.38, 0.75, { map: repetir(canelado.clone(), rep, 1) });
    const colunas = [];
    for (const x of [-40, -20, 0, 20, 40]) for (const z of [-9.5, 21.5]) {
        add(cil(0.42, 0.42, A, 24), branco, x, A / 2, z); add(cil(0.47, 0.47, 0.28, 24), inoxEscovado, x, 0.14, z); add(cil(0.56, 0.42, 0.3, 24), branco, x, A - 0.15, z); colunas.push([x, z]);
    }
    const matTeto = M('#dfe0db', 0.95); horizontal(larguraSala, fundoSala, matTeto, 0, A, zMeioSala, teto).rotation.x = Math.PI / 2;
    for (const z of [-9.5, 6, 21.5]) add(cx(larguraSala, 0.55, 0.7), branco, 0, A - 0.275, z, teto, false);
    for (const x of [-40, -20, 0, 20, 40]) add(cx(0.7, 0.55, fundoSala), branco, x, A - 0.275, zMeioSala, teto, false);
    const luzMat = new THREE.MeshBasicMaterial({ color: '#fffdf2' }), sombraMat = M('#2c2f31', 0.9);
    for (const x of G.XS) for (const z of [-2, 13.5]) { const l = horizontal(7.2, 2.2, luzMat, x, A - 0.03, z, teto); l.rotation.x = Math.PI / 2; add(cx(7.6, 0.06, 2.6), branco, x, A - 0.01, z, teto, false); }
    for (const x of G.XS) for (const z of [-13, 5.6, 24]) { const s = horizontal(11, 0.5, sombraMat, x, A - 0.02, z, teto); s.rotation.x = Math.PI / 2; }
    for (const x of [-30, -10, 10, 30]) for (const z of [-6, 2, 10, 18]) add(cil(0.09, 0.09, 0.05, 10), cinza, x + 6.5, A - 0.03, z, teto, false);

    // --- Carrosséis -----------------------------------------------------------
    const placas = tela(256, 256, (g, w, h) => {  // placas de borracha sobrepostas em crescente
        g.fillStyle = '#2a2c2f'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 2; i++) { const x = i * 128, gr = g.createLinearGradient(x, 0, x + 128, 0); gr.addColorStop(0, '#16171a'); gr.addColorStop(0.08, '#4a4d52'); gr.addColorStop(0.3, '#33363a'); gr.addColorStop(1, '#232528'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 26, h / 2, x, h); g.lineTo(x + 128, h); g.quadraticCurveTo(x + 154, h / 2, x + 128, 0); g.fill(); }
        g.strokeStyle = '#0d0e10'; g.lineWidth = 3; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.quadraticCurveTo(i * 128 + 26, h / 2, i * 128, h); g.stroke(); }
    });
    const tapeteTex = tela(128, 128, (g) => { g.fillStyle = '#26282b'; g.fillRect(0, 0, 128, 128); ruido(g, 128, 128, 500, ['#1c1d20', '#33363a'], 1.2); g.fillStyle = '#17181a'; g.fillRect(0, 60, 128, 5); });
    const escudo = (numero) => tela(256, 360, (g) => {   // placa em escudo azul-escuro com número e pictograma
        g.fillStyle = '#1b2c4b'; g.beginPath(); g.moveTo(34, 8); g.lineTo(222, 8); g.quadraticCurveTo(248, 8, 248, 34); g.lineTo(248, 190); g.bezierCurveTo(248, 290, 170, 352, 128, 352); g.bezierCurveTo(86, 352, 8, 290, 8, 190); g.lineTo(8, 34); g.quadraticCurveTo(8, 8, 34, 8); g.fill();
        g.fillStyle = '#ffffff'; g.font = 'bold 150px Arial, sans-serif'; g.textAlign = 'center'; g.fillText(String(numero), 128, 152);
        g.fillRect(84, 186, 88, 88); g.fillStyle = '#1b2c4b'; g.fillRect(102, 218, 52, 40); g.fillRect(118, 204, 20, 8); g.fillRect(114, 204, 5, 16); g.fillRect(137, 204, 5, 16); g.fillStyle = '#ffffff'; g.fillRect(102, 232, 52, 4);
    });
    const friso = tela(2048, 216, (g, W, H) => { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#0d3b6e'); gr.addColorStop(0.55, '#1c6aa3'); gr.addColorStop(1, '#e8a13a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.strokeStyle = '#ffffff55'; g.lineWidth = 6; g.beginPath(); g.moveTo(1180, 170); g.quadraticCurveTo(1500, -60, 1820, 170); g.stroke(); g.lineWidth = 3; for (let x = 1220; x < 1800; x += 46) { const y = 170 - Math.sin((x - 1180) / 640 * Math.PI) * 112; g.beginPath(); g.moveTo(x, y); g.lineTo(x, 122); g.stroke(); } g.lineWidth = 5; g.beginPath(); g.moveTo(1120, 122); g.lineTo(1900, 122); g.stroke();
        g.fillStyle = '#fff'; g.font = 'bold 96px Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText('Bem-vindo ao Porto', 60, 84); g.font = '44px Arial, sans-serif'; g.fillStyle = '#d7e6f5'; g.fillText('Welcome · Bienvenue · Bienvenido · Willkommen', 64, 168); });
    const carrosseis = {};
    G.XS.forEach((x0, i) => {
        const codigo = 'T0' + (i + 1), c = new THREE.Group(); c.position.set(x0, 0, G.ZC); sala.add(c);
        const addC = (geo, mat, x = 0, y = 0, z = 0, sombra = true) => add(geo, mat, x, y, z, c, sombra);
        addC(anel(G.R_FASCIA, G.R_EXT - 0.02, 0.6), inox); addC(anel(G.R_FASCIA + 0.025, G.R_FASCIA - 0.01, 0.15), azulOPO);          // frente em inox com rodapé azul
        addC(anel(G.R_FASCIA + 0.03, G.R_EXT - 0.05, 0.05), borracha, 0, 0.6, 0);                                                    // para-choques
        addC(macico(G.R_INT + 0.02, G.Y_INT + 0.02), [inoxEscovado, matCanelado(40)]);                                               // ilha central
        addC(anel(G.R_INT + 0.06, G.R_INT - 0.2, 0.05), inox, 0, G.Y_INT + 0.02, 0);
        // superfície das placas inclinadas (a textura desliza quando o motor está ligado)
        const N = 200, v = [], uv = [], ids = [];
        for (let k = 0; k <= N; k++) { const s = k / N * G.PERIMETRO, a = pontoCircuito(s, G.R_INT), b = pontoCircuito(s, G.R_EXT); v.push(a.x, a.y, a.z - G.ZC, b.x, b.y, b.z - G.ZC); uv.push(s / 0.56, 0, s / 0.56, 1); if (k < N) { const n = k * 2; ids.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); } }
        const gp = new THREE.BufferGeometry(); gp.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); gp.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gp.setIndex(ids); gp.computeVertexNormals();
        const texPlacas = repetir(placas.clone(), 1, 1), matPlacas = M('#ffffff', 0.62, 0.1, { map: texPlacas, side: THREE.DoubleSide }), superficie = addC(gp, matPlacas, 0, 0, 0, false);
        // caixa de entrega revestida a alumínio canelado, onde chega o tapete de alimentação
        const zCx = -G.MEIO + 0.2;
        addC(cx(2.04, 1.7, 3.6), matCanelado(18), 0, G.Y_INT + 0.87, zCx); addC(cx(2.16, 0.1, 3.72), inox, 0, G.Y_INT + 1.77, zCx);
        addC(cx(0.06, 0.62, 0.95), preto, -1.03, 1.42, -G.MEIO + G.S_QUEDA, false);                                                 // boca de saída das malas
        const rampa = addC(cx(1.5, 0.05, 1.0), inox, -1.66, 1.14, -G.MEIO + G.S_QUEDA); rampa.rotation.z = 0.37;
        for (const k of [-1, 1]) { const g2 = addC(cx(1.5, 0.16, 0.04), inox, -1.66, 1.22, -G.MEIO + G.S_QUEDA + k * 0.5); g2.rotation.z = 0.37; }
        // tapete de alimentação: ponte, rampa e cais de carga na zona técnica
        const texAl = repetir(tapeteTex.clone(), 1, 14), matAl = M('#ffffff', 0.85, 0, { map: texAl });
        const troco = (z1, y1, z2, y2) => { const L = Math.hypot(z2 - z1, y2 - y1), inc = Math.atan2(y2 - y1, z2 - z1), zm = (z1 + z2) / 2 - G.ZC, ym = (y1 + y2) / 2;
            const b = addC(cx(1.0, 0.1, L), matAl, 0, ym - 0.06, zm); b.rotation.x = -inc; for (const k of [-1, 1]) { const g2 = addC(cx(0.06, 0.34, L), inox, k * 0.55, ym + 0.02, zm); g2.rotation.x = -inc; }
            for (let z = z1 + 0.6; z > z2 - 0.1; z -= 2.2) { const y = y1 + (y2 - y1) * (z - z1) / (z2 - z1); for (const k of [-1, 1]) addC(cx(0.07, y - 0.12, 0.07), cinza, k * 0.5, (y - 0.12) / 2, z - G.ZC); addC(cx(1.0, 0.05, 0.05), cinza, 0, 0.25, z - G.ZC); } };
        troco(-3.0, 1.86, -9, 1.86); troco(-9, 1.86, -17.5, 0.92); troco(-17.5, 0.92, -28, 0.92);
        addC(cx(1.3, 0.9, 0.5), totemMat, 0, 0.45, -28.3 - G.ZC); addC(cx(0.26, 0.34, 0.2), amarelo, 0.82, 0.98, -27.4 - G.ZC);          // motor e comando do tapete
        // placa numerada em escudo, num poste (duas faces, como na sala real)
        const zPoste = G.MEIO + 0.5; addC(cil(0.055, 0.055, 3.2, 10), inoxEscovado, 0, G.Y_INT + 1.6, zPoste);
        const texEscudo = escudo(i + 1); for (const ry of [Math.PI / 2, -Math.PI / 2]) { const e = plano(1.25, 1.76, new THREE.MeshBasicMaterial({ map: texEscudo, transparent: true, alphaTest: 0.5 }), 0.02 * Math.sign(ry), G.Y_INT + 3.3, zPoste, ry, c); e.castShadow = true; }
        addC(cx(0.1, 0.85, 7.0), totemMat, 0, G.Y_INT + 0.47, 0.4); for (const k of [-1, 1]) plano(6.8, 0.72, new THREE.MeshBasicMaterial({ map: friso }), k * 0.052, G.Y_INT + 0.47, 0.4, k * Math.PI / 2, c);
        for (const z of [-2.9, 3.7]) addC(cx(0.16, 0.9, 0.16), inoxEscovado, 0, G.Y_INT + 0.45, z);
        // totem de informação com dois ecrãs e torre luminosa
        const tx = G.R_FASCIA + 1.5, tz = G.MEIO + 2.2, totem = new THREE.Group(); totem.position.set(tx, 0, tz); totem.rotation.y = -0.35; c.add(totem);
        add(caixaRedonda(1.1, 2.5, 0.38, 0.08), totemMat, 0, 0, 0, totem); add(cx(1.16, 0.1, 0.44), inoxEscovado, 0, 0.05, 0, totem);
        const ecraCanvas = document.createElement('canvas'); ecraCanvas.width = 512; ecraCanvas.height = 384; const ecraTex = new THREE.CanvasTexture(ecraCanvas); ecraTex.colorSpace = THREE.SRGBColorSpace;
        plano(0.92, 0.69, new THREE.MeshBasicMaterial({ map: ecraTex }), 0, 1.42, 0.2, 0, totem);
        const pub = tela(256, 160, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0d4f8b'); gr.addColorStop(1, '#27a3b8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffffffcc'; g.lineWidth = 5; g.beginPath(); g.arc(128, 190, 110, Math.PI * 1.18, Math.PI * 1.82); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(10, 118); g.lineTo(246, 118); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.fillText('Bem-vindo ao Porto', 128, 42); g.font = '15px Arial'; g.fillText('Welcome · Bienvenue · Willkommen', 128, 148); });
        plano(0.92, 0.56, new THREE.MeshBasicMaterial({ map: pub }), 0, 2.12, 0.2, 0, totem);
        add(cil(0.03, 0.03, 0.35, 8), cinza, 0.38, 2.67, 0, totem);
        const luzes = ['#d23c2c', '#e0a526', '#33b24a'].map((cor, k) => add(cil(0.075, 0.075, 0.13, 14), M('#555a5e', 0.4, 0, { emissive: cor, emissiveIntensity: 0 }), 0.38, 3.18 - k * 0.14, 0, totem, false));
        // ecrã suspenso sobre a ilha, virado para o corredor
        const zEc = G.MEIO - 1.2; addC(cil(0.03, 0.03, 1.5, 6), cinza, 0, G.Y_INT + 0.75, zEc); const sus = plano(2.2, 1.65, new THREE.MeshBasicMaterial({ map: ecraTex }), 0, G.Y_INT + 2.1, zEc + 0.06, 0, c); sus.rotation.x = -0.3; addC(cx(2.3, 1.75, 0.08), totemMat, 0, G.Y_INT + 2.1, zEc).rotation.x = -0.3;
        // paragem de emergência na frente do carrossel
        addC(cx(0.16, 0.2, 0.08), amarelo, -1.2, 0.42, G.MEIO + G.R_FASCIA + 0.02); addC(cil(0.045, 0.045, 0.05, 12), M('#d01f1f', 0.4), -1.2, 0.44, G.MEIO + G.R_FASCIA + 0.08).rotation.x = Math.PI / 2;
        carrosseis[codigo] = { x: x0, numero: i + 1, texPlacas, texAl, matPlacas, luzes, ecraCanvas, ecraTex, chave: '', inoxFrente: c.children[0] };
    });

    // --- Sinalética suspensa --------------------------------------------------
    const sinal = (linhas, w, cor = '#1f2937') => tela(1024, 256, (g, W, H) => { g.fillStyle = cor; g.fillRect(0, 0, W, H); g.fillStyle = '#ffd21f'; g.font = 'bold 84px Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText(linhas[0], 44, 86); g.fillStyle = '#ffffff'; g.font = '58px Arial, sans-serif'; g.fillText(linhas[1], 44, 186); });
    const suspenso = (linhas, x, z, w = 7, ry = 0, cor) => { const tex = sinal(linhas, w, cor), g2 = new THREE.Group(); g2.position.set(x, 3.75, z); g2.rotation.y = ry; sala.add(g2);
        add(cx(w, 1.0, 0.12), totemMat, 0, 0, 0, g2, false); for (const k of [1, -1]) plano(w - 0.1, 0.9, new THREE.MeshBasicMaterial({ map: tex }), 0, 0, k * 0.065, k > 0 ? 0 : Math.PI, g2); for (const k of [-1, 1]) add(cil(0.025, 0.025, A - 4.25, 6), cinza, k * (w / 2 - 0.4), (A - 4.25) / 2 + 0.5, 0, g2, false); };
    suspenso(['Recolha de bagagens  1 – 4', 'Baggage reclaim'], 0, 17.2, 9);
    suspenso(['Saída  ↓', 'Exit · Sortie · Salida'], -22, 23.5, 6.4, 0, '#1f5d3a'); suspenso(['Saída  ↓', 'Exit · Sortie · Salida'], 22, 23.5, 6.4, 0, '#1f5d3a');
    suspenso(['Bagagem não reclamada', 'Lost & Found  →'], 33, 17.2, 7.6);
    // Alfândega: canal verde e canal vermelho na frente envidraçada
    const portal = (x, cor, linhas) => { const tex = tela(512, 128, (g, W, H) => { g.fillStyle = cor; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = 'bold 44px Arial'; g.textAlign = 'center'; g.fillText(linhas[0], W / 2, 52); g.font = '30px Arial'; g.fillText(linhas[1], W / 2, 100); });
        for (const k of [-1, 1]) add(cx(0.3, 3.0, 0.5), M(cor, 0.5, 0.1), x + k * 2.2, 1.5, G.Z_SAIDA - 0.3); add(cx(4.7, 0.9, 0.5), M(cor, 0.5, 0.1), x, 3.2, G.Z_SAIDA - 0.3); plano(4.4, 0.8, new THREE.MeshBasicMaterial({ map: tex }), x, 3.2, G.Z_SAIDA - 0.56, Math.PI);
        for (const k of [-1, 1]) plano(1.9, 2.7, M('#bfe0e6', 0.05, 0.1, { transparent: true, opacity: 0.4, side: THREE.DoubleSide }), x + k * 1.05, 1.35, G.Z_SAIDA - 0.2, Math.PI); };
    portal(-4, '#1f8a4c', ['Nada a declarar', 'Nothing to declare']); portal(4, '#c0392b', ['Bens a declarar', 'Goods to declare']);

    // --- Mobiliário ------------------------------------------------------------
    const tubo = M('#b9bec2', 0.35, 0.85), malhaObjeto = (pecas, x, z, ry = 0) => { const m = add(fundir(pecas), M('#ffffff', 0.5, 0.3, { vertexColors: true }), x, 0, z); m.rotation.y = ry; return m; };
    const carrinhos = (x, z, n, ry = 0) => { const p = []; for (let k = 0; k < n; k++) { const o = k * 0.36;
        p.push(peca(cx(0.52, 0.03, 0.8), '#aeb4b8', 0, 0.2, o)); for (const s of [-1, 1]) { p.push(peca(cx(0.03, 0.03, 0.95), '#c9ced2', s * 0.26, 0.2, o + 0.02)); p.push(peca(cx(0.03, 0.9, 0.03), '#c9ced2', s * 0.26, 0.62, o + 0.46)); p.push(peca(cil(0.05, 0.05, 0.03, 8), '#1b1b1d', s * 0.27, 0.05, o + 0.42, 0, 0, Math.PI / 2)); }
        p.push(peca(cx(0.56, 0.035, 0.035), '#1e4fa0', 0, 1.06, o + 0.46)); p.push(peca(cx(0.5, 0.26, 0.02), '#d9dde0', 0, 0.82, o + 0.44)); p.push(peca(cx(0.5, 0.02, 0.2), '#aeb4b8', 0, 0.7, o + 0.34)); p.push(peca(cil(0.045, 0.045, 0.03, 8), '#1b1b1d', 0, 0.045, o - 0.36, 0, 0, Math.PI / 2)); }
        return malhaObjeto(p, x, z, ry); };
    carrinhos(-44.6, 8, 14); carrinhos(-43.6, 8, 14); carrinhos(44.6, 13, 12, Math.PI); carrinhos(-15.5, 24.6, 10, Math.PI / 2); carrinhos(10, 24.6, 10, Math.PI / 2);
    const banco = (x, z, ry = 0) => { const p = [peca(cx(2.5, 0.08, 0.1), '#9aa0a5', 0, 0.36, 0)]; for (const s of [-1, 1]) { p.push(peca(cx(0.06, 0.36, 0.06), '#9aa0a5', s * 1.05, 0.18, 0)); p.push(peca(cx(0.08, 0.04, 0.6), '#9aa0a5', s * 1.05, 0.02, 0)); }
        for (let k = 0; k < 4; k++) { const xs = -0.93 + k * 0.62; p.push(peca(caixaRedonda(0.54, 0.06, 0.5, 0.025), '#33414f', xs, 0.4, 0.02)); p.push(peca(caixaRedonda(0.54, 0.46, 0.06, 0.025), '#33414f', xs, 0.48, -0.25, -0.18)); } return malhaObjeto(p, x, z, ry); };
    for (const x of [-20, 0, 20]) { banco(x - 0.5, 23.2, Math.PI); banco(x - 0.9, 12.2, Math.PI / 2); banco(x + 0.9, 12.2, -Math.PI / 2); }
    for (const [x, z] of [[-39, 20.6], [-19, 20.6], [1, 20.6], [21, 20.6], [41, 20.6], [-19, -8], [21, -8]]) { add(cil(0.3, 0.3, 0.95, 20), branco, x, 0.475, z); add(cil(0.31, 0.31, 0.06, 20), preto, x, 0.98, z); add(cil(0.17, 0.17, 0.02, 16), preto, x, 1.012, z); }
    // Balcão de bagagem não reclamada (Lost & Found)
    const bx = 39.5, bz = 22.5; add(cx(6, 1.08, 0.9), branco, bx, 0.54, bz); add(cx(6.2, 0.05, 1.05), inox, bx, 1.1, bz); add(cx(6, 0.16, 0.92), azulOPO, bx, 0.08, bz); add(cx(6.4, 3.2, 0.25), M('#e7e8e3', 0.8), bx, 1.6, bz + 2.2);
    plano(5.6, 0.9, new THREE.MeshBasicMaterial({ map: sinal(['Bagagem não reclamada', 'Lost & Found · Objets trouvés'], 6) }), bx, 2.55, bz + 2.07, Math.PI);
    for (const k of [-1.6, 1.4]) { add(cx(0.5, 0.36, 0.05), preto, bx + k, 1.34, bz + 0.2); add(cx(0.08, 0.14, 0.08), preto, bx + k, 1.17, bz + 0.2); }
    add(cx(0.12, 3.0, 4.4), M('#101418', 0.9), -G.X_LADO + 0.05, 1.5, 19.2, sala, false); for (const k of [-2.2, 2.2]) add(cx(0.2, 3.0, 0.14), inox, -G.X_LADO + 0.1, 1.5, 19.2 + k); add(cx(0.2, 0.14, 4.54), inox, -G.X_LADO + 0.1, 3.02, 19.2);
    plano(4.2, 0.8, new THREE.MeshBasicMaterial({ map: sinal(['Chegadas', 'Arrivals · Arrivées · Llegadas'], 4.2) }), -G.X_LADO + 0.2, 3.6, 19.2, Math.PI / 2);
    // Painéis de azulejo retroiluminados nas paredes laterais
    const azulejo = tela(512, 512, (g, w) => { g.fillStyle = '#f3f1e7'; g.fillRect(0, 0, w, w); const t = 128; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = i * t + 64, y = j * t + 64; g.strokeStyle = '#1f4f9a'; g.fillStyle = '#2a63b3'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, 40, 0, 7); g.stroke(); for (let k = 0; k < 4; k++) { g.save(); g.translate(x, y); g.rotate(k * Math.PI / 2 + Math.PI / 4); g.beginPath(); g.ellipse(0, -30, 12, 26, 0, 0, 7); g.fill(); g.restore(); } g.fillStyle = '#e2b53a'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.strokeStyle = '#1f4f9a'; g.lineWidth = 3; g.strokeRect(i * t + 3, j * t + 3, t - 6, t - 6); for (const [dx, dy] of [[0, 0], [t, 0], [0, t], [t, t]]) { g.fillStyle = '#2a63b3'; g.beginPath(); g.arc(i * t + dx, j * t + dy, 18, 0, 7); g.fill(); } } });
    for (const s of [-1, 1]) for (const z of [-4, 12]) { plano(9, 3, new THREE.MeshBasicMaterial({ map: repetir(azulejo.clone(), 3, 1) }), s * (G.X_LADO - 0.09), 2.3, z, s > 0 ? -Math.PI / 2 : Math.PI / 2); add(cx(0.1, 3.16, 9.16), inoxEscovado, s * (G.X_LADO - 0.02), 2.3, z, sala, false); }

    // --- Zona técnica: inspeção, portão da placa, reboques e trator ------------
    const ix = 38, iz = -22.5;                      // posto de inspeção com raios X e mesa de rolos
    add(cx(2.3, 1.45, 1.25), M('#dfe2e4', 0.5, 0.2), ix, 1.0, iz); add(cx(2.34, 0.5, 0.82), preto, ix, 1.05, iz, sala, false); add(cx(2.3, 0.3, 1.25), totemMat, ix, 0.15, iz);
    for (const k of [-1, 1]) { add(cx(3.2, 0.06, 0.9), inox, ix + k * 2.75, 0.84, iz); for (let r2 = 0; r2 < 9; r2++) add(cil(0.035, 0.035, 0.84, 8), inoxEscovado, ix + k * 2.75 - 1.4 + r2 * 0.35, 0.89, iz, sala, false).rotation.x = Math.PI / 2; for (const q of [-1.4, 1.4]) for (const w2 of [-0.4, 0.4]) add(cx(0.06, 0.82, 0.06), cinza, ix + k * 2.75 + q, 0.41, iz + w2); }
    add(cx(0.7, 0.5, 0.06), preto, ix, 2.15, iz + 0.4); add(cx(0.06, 0.4, 0.06), cinza, ix, 1.85, iz + 0.4);
    plano(4.2, 0.7, new THREE.MeshBasicMaterial({ map: sinal(['Inspeção de bagagem', 'Etiquetas ilegíveis · Baggage check'], 4.2, '#7a5c00') }), ix, 3.3, zP - 0.2, Math.PI);
    for (const s of [-1, 1]) { add(cx(0.5, A, 0.5), M('#7f8387', 0.9), s * (G.X_LADO - 0.25), A / 2, -32); add(cx(0.5, A, 0.5), M('#7f8387', 0.9), s * (G.X_LADO - 0.25), A / 2, -20); add(cx(0.5, 1.2, 12.5), amarelo, s * (G.X_LADO - 0.25), A - 0.6, -26); add(cx(0.35, A, 4), M('#d9dad5', 0.9), s * (G.X_LADO - 0.18), A / 2, -18); add(cx(0.35, A, 4), M('#d9dad5', 0.9), s * (G.X_LADO - 0.18), A / 2, -34); }
    plano(8, 0.75, new THREE.MeshBasicMaterial({ map: sinal(['← Placa', 'Apron · Descarga dos aviões'], 8, '#30363b') }), -39, 3.3, zP - 0.2, Math.PI);
    plano(8, 0.75, new THREE.MeshBasicMaterial({ map: sinal(['Regresso à placa →', 'Apron · Reboques vazios'], 8, '#30363b') }), 26, 4.4, zP - 0.2, Math.PI);
    plano(9, 0.75, new THREE.MeshBasicMaterial({ map: sinal(['Zona técnica · Tapetes de alimentação', 'Acesso reservado · Staff only'], 9, '#30363b') }), 0, 4.4, zP - 0.2, Math.PI);
    const geoReboque = fundir([peca(cx(3.0, 0.1, 1.5), '#8b9196', 0, 0.56, 0), peca(cx(2.9, 0.06, 0.08), '#5d6266', 0, 0.48, 0.6), peca(cx(2.9, 0.06, 0.08), '#5d6266', 0, 0.48, -0.6),
        ...[-1.47, 1.47].flatMap(x => [peca(cx(0.05, 0.9, 1.5), '#e8b90f', x, 1.05, 0), peca(cx(0.05, 0.05, 1.5), '#e8b90f', x, 1.5, 0)]), peca(cx(3.0, 0.05, 0.05), '#e8b90f', 0, 1.5, -0.74),
        ...[[-1.05, 0.62], [1.05, 0.62], [-1.05, -0.62], [1.05, -0.62]].map(([x, z]) => peca(cil(0.2, 0.2, 0.14, 12), '#151515', x, 0.2, z, Math.PI / 2)), peca(cx(0.7, 0.05, 0.06), '#5d6266', 1.85, 0.42, 0)]);
    const matVertice = M('#ffffff', 0.6, 0.2, { vertexColors: true });
    const geoTrator = fundir([peca(caixaRedonda(2.1, 0.62, 1.15, 0.1), '#f2f2ee', 0, 0.28, 0), peca(caixaRedonda(0.9, 0.5, 1.0, 0.08), '#f2f2ee', 0.55, 0.88, 0), peca(cx(0.05, 0.85, 1.0), '#22262a', -0.3, 1.3, 0), peca(cx(1.0, 0.05, 1.1), '#f2f2ee', -0.05, 1.74, 0),
        ...[-0.5, 0.5].map(z => peca(cx(0.05, 0.85, 0.05), '#22262a', 0.2, 1.3, z)), peca(caixaRedonda(0.5, 0.4, 0.8, 0.06), '#33414f', -0.4, 0.88, 0), peca(cil(0.07, 0.07, 0.1, 10), '#f39c12', -0.05, 1.82, 0),
        peca(cx(2.14, 0.12, 0.3), '#e8b90f', 0, 0.36, 0.44), peca(cx(2.14, 0.12, 0.3), '#e8b90f', 0, 0.36, -0.44), ...[[-0.68, 0.58], [0.68, 0.58], [-0.68, -0.58], [0.68, -0.58]].map(([x, z]) => peca(cil(0.27, 0.27, 0.2, 14), '#151515', x, 0.27, z, Math.PI / 2))]);
    const novoReboque = () => { const m = add(geoReboque, matVertice, 0, 0, 0); m.visible = false; return m; }, novoTrator = () => { const m = add(geoTrator, matVertice, 0, 0, 0); m.visible = false; return m; };

    // --- Luz -------------------------------------------------------------------
    scene.add(new THREE.HemisphereLight('#ffffff', '#a9a294', 1.25));
    const luz = new THREE.DirectionalLight('#fff4e2', 1.7); luz.position.set(-18, 46, 22); luz.target.position.set(0, 0, -2); luz.castShadow = true; luz.shadow.mapSize.set(4096, 4096);
    Object.assign(luz.shadow.camera, { left: -60, right: 60, top: 46, bottom: -46, near: 5, far: 120 }); luz.shadow.bias = -0.0004; luz.shadow.normalBias = 0.04; scene.add(luz); scene.add(luz.target);

    return { sala, teto, carrosseis, colunas, novoReboque, novoTrator, matMalas: M('#ffffff', 0.55, 0.05, { vertexColors: true }), matPessoas: M('#ffffff', 0.8, 0, { vertexColors: true }) };
}
