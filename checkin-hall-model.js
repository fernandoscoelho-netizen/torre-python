// Bloco 2 · Bagagens, Fase 3: geometria da zona de check-in.
// Maquete didática de um átrio de partidas: seis balcões com balança e tapete, fila única com
// baias, tapetes coletores que atravessam a parede para a central de triagem (linhas C1 e C2),
// painel de partidas, apoio ao cliente e acesso ao controlo de segurança. Medidas em metros,
// à escala de um átrio real, mas sem reproduzir nenhum aeroporto em concreto.
import * as THREE from 'three';
import { fundir, geometriaPessoa } from './baggage-hall-model.js?v=bagagens-3';
import { criarCaminho } from './sorting-hall-model.js?v=placa-1';

export const K = {
    X0: -30, X1: 30, Z0: -14, Z1: 26, ALTURA: 9,
    BALCOES: { B01: -10.5, B02: -6.3, B03: -2.1, B04: 2.1, B05: 6.3, B06: 10.5 },
    Z_BALCAO: -5.6, Z_PASSAGEIRO: -4.5, Z_AGENTE: -6.7, DX_SECRETARIA: -0.75, DX_TAPETE: 0.8,
    Z_COLETOR: -9.6, X_SAIDA: 16.5, Y_COLETOR: 0.55, Y_BALANCA: 0.36,
    PORTAS: [-9, 0, 9], SEGURANCA: [29.2, -1.5], APOIO: [-25.2, -3.4],
    V_TAPETE: 12.5,          // metros por minuto simulado: a mala mais distante demora 2 minutos até à parede
    V_PESSOA: 42,            // metros por minuto simulado (0,7 m/s)
    ESPACO: 0.8,             // distância entre passageiros na fila
};
const LADO = c => (K.BALCOES[c] < 0 ? -1 : 1);

// Percurso de uma mala: balança, tapete do balcão, coletor e passagem pela parede do fundo.
export const CAMINHOS_MALA = Object.fromEntries(Object.entries(K.BALCOES).map(([c, x]) => {
    const xb = x + K.DX_TAPETE, xs = LADO(c) * K.X_SAIDA;
    return [c, criarCaminho([[xb, K.Y_BALANCA, -4.7], [xb, K.Y_BALANCA, -6.5], [xb, K.Y_COLETOR, -8.3], [xb, K.Y_COLETOR, K.Z_COLETOR], [xs, K.Y_COLETOR, K.Z_COLETOR], [xs, K.Y_COLETOR, -15.8]], 0.55)];
}));
export const D_BALANCA = 0.75;          // distância, no percurso da mala, do centro da balança

// Fila única em serpentina: a cabeça fica ao centro, em frente aos balcões; depois das baias, a fila segue pelo átrio.
const BAIAS = [[0, 0, 0.2], [0, 0, 1.5], [9.5, 0, 1.5], [9.5, 0, 3], [-9.5, 0, 3], [-9.5, 0, 4.5], [9.5, 0, 4.5], [9.5, 0, 6], [-9.5, 0, 6], [-9.5, 0, 7.5], [9.5, 0, 7.5]];
export const FILA = criarCaminho([...BAIAS, [13, 0, 7.5], [13, 0, 20.5], [-24, 0, 20.5]], 0.5);
export const COMP_BAIAS = criarCaminho([...BAIAS, [13, 0, 7.5]], 0.5).comp - 3.5;
export const ENTRADA_FILA = [9.5, 7.5];

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
function caixaRedonda(comp, alt, larg, raio) {
    const b = Math.min(raio, alt / 2 - 0.01), w = comp - 2 * b, d = larg - 2 * b, r = Math.min(raio, w / 2, d / 2), s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -d / 2); s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r); s.lineTo(w / 2, d / 2 - r); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    s.lineTo(-w / 2 + r, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); s.lineTo(-w / 2, -d / 2 + r); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: alt - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 2, curveSegments: 4 });
    g.rotateX(-Math.PI / 2); g.translate(0, b, 0); return g;
}
// Fita ao longo de um caminho: une os pontos (lado a, alt a) e (lado b, alt b) medidos a partir do eixo.
function fita(cam, la, ya, lb, yb, uvPorMetro = 0) {
    const n = cam.pts.length, pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), ids = [], lado = new THREE.Vector3(), tg = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
        tg.copy(cam.pts[Math.min(n - 1, i + 1)]).sub(cam.pts[Math.max(0, i - 1)]); tg.y = 0; tg.normalize(); lado.set(-tg.z, 0, tg.x);
        const p = cam.pts[i];
        pos.set([p.x + lado.x * la, p.y + ya, p.z + lado.z * la, p.x + lado.x * lb, p.y + yb, p.z + lado.z * lb], i * 6);
        uv.set([0, cam.acum[i] * uvPorMetro, 1, cam.acum[i] * uvPorMetro], i * 4);
        if (i < n - 1) { const k = i * 2; ids.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(ids); g.computeVertexNormals(); return g;
}

// Pessoal de terra: farda azul-escura, lenço ou gravata na cor da casa.
const PELE = ['#e8c4a0', '#d9a77f', '#c68b5e', '#9a6843', '#6f4a2f', '#f0d0b4'], CABELO = ['#1d1a17', '#3a2a1c', '#6b4a2b', '#a9843f', '#7b2f1e'];
export function geometriaAgente(semente) {
    const r = aleatorio(semente * 7907 + 5), e = 0.94 + r() * 0.1, lg = 0.92 + r() * 0.16, p = [];
    const pele = PELE[Math.floor(r() * PELE.length)], cabelo = CABELO[Math.floor(r() * CABELO.length)], farda = '#1c2b4a', realce = '#e4572e';
    for (const k of [-1, 1]) {
        p.push(peca(cx(0.13 * lg, 0.8, 0.15), '#18233b', k * 0.09 * lg, 0.48, 0)); p.push(peca(cx(0.12, 0.08, 0.25), '#111', k * 0.09 * lg, 0.04, 0.04));
        p.push(peca(cil(0.05, 0.042, 0.42, 6), farda, k * 0.25 * lg, 1.24, 0.03, -0.25, 0, k * 0.08)); p.push(peca(cil(0.04, 0.038, 0.3, 6), farda, k * 0.2 * lg, 1.02, 0.2, -1.35, 0, k * 0.25));
        p.push(peca(new THREE.SphereGeometry(0.045, 6, 5), pele, k * 0.16 * lg, 1.0, 0.36));
    }
    const tronco = cil(0.2 * lg, 0.17 * lg, 0.6, 10); tronco.scale(1, 1, 0.62); p.push(peca(tronco, farda, 0, 1.17, 0));
    p.push(peca(cx(0.07, 0.22, 0.02), realce, 0, 1.3, 0.125 * lg), peca(cx(0.16, 0.05, 0.03), '#f2f2ee', 0, 1.44, 0.1 * lg));
    p.push(peca(cil(0.05, 0.055, 0.08, 8), pele, 0, 1.5, 0)); p.push(peca(new THREE.SphereGeometry(0.105, 12, 10), pele, 0, 1.63, 0));
    p.push(peca(new THREE.SphereGeometry(0.112, 12, 8, 0, Math.PI * 2, 0, Math.PI * (r() < 0.5 ? 0.62 : 0.48)), cabelo, 0, 1.64, -0.012));
    const g = fundir(p); g.scale(e, e, e); return g;
}

// ---------------------------------------------------------------------------
export function construirCheckin(scene, renderer) {
    const atrio = new THREE.Group(), teto = new THREE.Group(), fachada = new THREE.Group(); atrio.name = 'Zona de check-in — maquete didática'; scene.add(atrio); atrio.add(teto, fachada);
    const M = (cor, rug = 0.8, met = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: rug, metalness: met, ...extra });
    const amb = tela(512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fbfcfc'); gr.addColorStop(0.3, '#e3e8ea'); gr.addColorStop(0.5, '#bcc7cf'); gr.addColorStop(0.58, '#8d9296'); gr.addColorStop(1, '#6a6660'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; for (let i = 0; i < 12; i++) g.fillRect(i * 44 + 6, 10, 30, 14); g.fillStyle = '#dff0ff'; g.fillRect(150, 70, 210, 52); });
    amb.mapping = THREE.EquirectangularReflectionMapping; const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(amb).texture; scene.environmentIntensity = 0.55; amb.dispose(); pm.dispose();

    const add = (geo, mat, x = 0, y = 0, z = 0, pai = atrio, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; pai.add(m); return m; };
    const plano = (w, h, mat, x, y, z, ry = 0, pai = atrio) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; pai.add(m); return m; };
    const horizontal = (w, d, mat, x, y, z, pai = atrio) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; pai.add(m); return m; };
    const LARG = K.X1 - K.X0, FUNDO = K.Z1 - K.Z0, ZM = (K.Z0 + K.Z1) / 2, A = K.ALTURA;
    const AZUL = '#16365f', AZUL_CLARO = '#2a6fb0', LARANJA = '#e4572e', INOX = '#b9bfc3', INOX_ESC = '#7c8388', GRAFITE = '#262b31', BRANCO = '#f1f2ef', MADEIRA = '#b08a5c';
    const objetos = [], metal = [];              // peças fundidas no fim
    const matPessoas = M('#ffffff', 0.8, 0, { vertexColors: true }), matBaias = M('#ffffff', 0.4, 0.5, { vertexColors: true });
    const basico = (tex, extra = {}) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, ...extra });
    const letreiro = (texto, w, h, fundo, cor, x, y, z, ry = 0, pai = atrio, fonte = 0.62) => plano(w, h, basico(tela(Math.round(256 * w / h), 256, (g, W, H) => {
        g.fillStyle = fundo; g.fillRect(0, 0, W, H); g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle';
        let tam = H * fonte; g.font = `600 ${tam}px Arial, sans-serif`; const larg = g.measureText(texto).width; if (larg > W * 0.92) { tam *= W * 0.92 / larg; g.font = `600 ${tam}px Arial, sans-serif`; }
        g.fillText(texto, W / 2, H * 0.54);
    })), x, y, z, ry, pai);

    // --- Pavimento: granito polido claro, com passadeira em frente aos balcões --------
    const granito = tela(1024, 1024, (g, w) => {
        g.fillStyle = '#b9b3a6'; g.fillRect(0, 0, w, w); ruido(g, w, w, 30000, ['#a9a396', '#c8c2b5', '#989284', '#d3cec2', '#8c8678'], 1.8);
        g.strokeStyle = '#8e887b'; g.lineWidth = 4; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, w); g.moveTo(0, i * 256); g.lineTo(w, i * 256); g.stroke(); }
    });
    horizontal(LARG, FUNDO, M('#ffffff', 0.2, 0.03, { map: repetir(granito, LARG / 4.8, FUNDO / 4.8), envMapIntensity: 0.9 }), 0, 0, ZM);
    horizontal(LARG + 16, 14, M('#a9aaa6', 0.95), 0, -0.01, K.Z1 + 7);                                    // passeio exterior
    horizontal(LARG + 16, 9, M('#4b4d50', 0.95), 0, -0.012, K.Z1 + 18.5);                                 // via de acesso
    horizontal(25.6, 2.5, M(AZUL, 0.85), 0, 0.004, -3.75);                                                // passadeira dos balcões
    horizontal(LARG, 5.3, M('#8f9498', 0.7), 0, 0.003, -11.35);                                           // zona técnica atrás dos balcões
    horizontal(1.9, 0.12, M('#f2c40f', 0.7), 0, 0.006, -0.25);                                            // linha de espera
    // Texto pintado no chão: a tela tem a largura do texto (medido), para nunca ficar cortado
    const medir = document.createElement('canvas').getContext('2d'); medir.font = 'bold 84px Arial, sans-serif';
    const chao = (texto, x, z, alturaLetra, cor = '#ffffff') => {
        const larg = Math.ceil(medir.measureText(texto).width) + 48, h = alturaLetra * 128 / 84;
        return horizontal(h * larg / 128, h, new THREE.MeshBasicMaterial({ map: tela(larg, 128, (g) => { g.fillStyle = cor; g.font = 'bold 84px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texto, larg / 2, 68); }), transparent: true, opacity: 0.9 }), x, 0.008, z);
    };
    chao('AGUARDE AQUI A SUA VEZ', 0, -0.8, 0.42, '#16365f');
    for (const [c, x] of Object.entries(K.BALCOES)) chao(c, x + K.DX_SECRETARIA, -3.1, 0.175);

    // --- Paredes ---------------------------------------------------------------------
    const painel = tela(512, 512, (g, w, h) => {
        g.fillStyle = '#eceae4'; g.fillRect(0, 0, w, h); ruido(g, w, h, 2500, ['#e2dfd8', '#f4f2ed'], 1.2);
        g.strokeStyle = '#cfccc4'; g.lineWidth = 3; for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 170) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    });
    const matParede = larg => M('#ffffff', 0.85, 0, { map: repetir(painel.clone(), larg / 6, 1.5) });
    // fundo, com as duas passagens dos tapetes coletores
    const furos = [-K.X_SAIDA, K.X_SAIDA], LF = 1.5, AF = 1.25;
    plano(K.X_SAIDA * 2 - LF, A, matParede(31), 0, A / 2, K.Z0);
    for (const s of [-1, 1]) { const w = K.X1 - K.X_SAIDA - LF / 2; plano(w, A, matParede(w), s * (K.X_SAIDA + LF / 2 + w / 2), A / 2, K.Z0); plano(LF, A - AF - 0.25, matParede(1.5), s * K.X_SAIDA, (A + AF + 0.25) / 2, K.Z0); plano(LF, 0.25, M('#8f9498'), s * K.X_SAIDA, 0.125, K.Z0); }
    plano(FUNDO, A, matParede(FUNDO), K.X0, A / 2, ZM, Math.PI / 2);
    plano(FUNDO, A, matParede(FUNDO), K.X1, A / 2, ZM, -Math.PI / 2);
    for (const [x, ry] of [[K.X0 + 0.03, Math.PI / 2], [K.X1 - 0.03, -Math.PI / 2]]) plano(FUNDO, 1.1, M(MADEIRA, 0.6), x, 0.55, ZM, ry);     // lambrim
    furos.forEach((x, i) => {
        objetos.push(peca(cx(LF + 0.3, 0.14, 0.3), '#f2c40f', x, AF + 0.32, K.Z0 + 0.1), peca(cx(0.14, AF + 0.1, 0.3), '#f2c40f', x - LF / 2 - 0.07, AF / 2 + 0.2, K.Z0 + 0.1), peca(cx(0.14, AF + 0.1, 0.3), '#f2c40f', x + LF / 2 + 0.07, AF / 2 + 0.2, K.Z0 + 0.1));
        for (let k = 0; k < 7; k++) objetos.push(peca(cx(0.19, 0.62, 0.02), '#22262a', x - 0.63 + k * 0.21, AF - 0.02, K.Z0 + 0.06));       // cortina de lamelas
        plano(LF, AF, new THREE.MeshBasicMaterial({ color: '#0d0f11' }), x, AF / 2 + 0.25, K.Z0 - 0.6);
        letreiro(`LINHA C${i + 1}  ▸  CENTRAL DE TRIAGEM`, 4.6, 0.62, AZUL, '#ffffff', x, 2.35, K.Z0 + 0.05);
    });

    // --- Cobertura, luminárias e pilares ------------------------------------------------
    const cobertura = horizontal(LARG, FUNDO, M('#eef0ee', 0.95), 0, A, ZM, teto); cobertura.rotation.x = Math.PI / 2;
    const pecasTeto = [];
    for (let x = K.X0 + 3; x < K.X1; x += 6) pecasTeto.push(peca(cx(0.18, 0.5, FUNDO - 0.5), '#dfe2e0', x, A - 0.25, ZM));
    for (const z of [-8, 0, 8, 16, 24]) pecasTeto.push(peca(cx(LARG - 0.5, 0.36, 0.22), '#d5d9d7', 0, A - 0.5, z));
    add(fundir(pecasTeto), M('#ffffff', 0.8, 0, { vertexColors: true }), 0, 0, 0, teto, false);
    const luzMat = new THREE.MeshBasicMaterial({ color: '#fffaf0', toneMapped: false });
    for (let x = K.X0 + 6; x < K.X1; x += 6) for (const z of [-11, -3.5, 4, 12, 20]) { const l = horizontal(0.28, 5, luzMat, x, A - 0.52, z, teto); l.rotation.x = Math.PI / 2; }
    const PILARES = [[-20, 11.5], [20, 11.5], [-20, 23.5], [20, 23.5], [-27, -8], [27, -8]];
    for (const [x, z] of PILARES) objetos.push(peca(cil(0.34, 0.34, A, 20), BRANCO, x, A / 2, z), peca(cil(0.42, 0.42, 0.9, 20), INOX, x, 0.45, z));

    // --- Fachada envidraçada com três portas automáticas -----------------------------------
    const vidro = new THREE.MeshPhysicalMaterial({ color: '#bfe0ee', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    plano(LARG, A, vidro, 0, A / 2, K.Z1, Math.PI, fachada);
    const perfis = [];
    for (let x = K.X0; x <= K.X1 + 0.01; x += 3) perfis.push(peca(cx(0.12, A, 0.22), '#3a4148', x, A / 2, K.Z1));
    for (const y of [3.05, 6, A - 0.1]) perfis.push(peca(cx(LARG, 0.12, 0.22), '#3a4148', 0, y, K.Z1));
    for (const x of K.PORTAS) {
        perfis.push(peca(cx(3.4, 0.5, 0.5), AZUL, x, 3.05, K.Z1), peca(cx(0.16, 3.0, 0.3), '#2b3138', x - 1.6, 1.5, K.Z1), peca(cx(0.16, 3.0, 0.3), '#2b3138', x + 1.6, 1.5, K.Z1));
        perfis.push(peca(cx(3.0, 0.02, 2.2), '#3d4145', x, 0.012, K.Z1));                                // tapete de entrada
        letreiro('PARTIDAS · CHECK-IN', 3.2, 0.36, AZUL, '#ffffff', x, 3.05, K.Z1 - 0.27, Math.PI, fachada);
    }
    add(fundir(perfis), M('#ffffff', 0.5, 0.4, { vertexColors: true }), 0, 0, 0, fachada, false);
    const ceu = plano(170, 46, new THREE.MeshBasicMaterial({ map: tela(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6fa8d8'); gr.addColorStop(0.7, '#cfe3f0'); gr.addColorStop(1, '#e9eef0'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) }), 0, 21, K.Z1 + 34, Math.PI, fachada);
    ceu.receiveShadow = false;

    // --- Ilha de check-in: pala, secretárias, balanças e tapetes -----------------------------
    const tapeteTex = tela(128, 256, (g) => { g.fillStyle = '#25272a'; g.fillRect(0, 0, 128, 256); ruido(g, 128, 256, 900, ['#1b1c1f', '#34373b', '#2c2e31'], 1.3); g.fillStyle = '#3d4044'; for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 128, 2); g.fillStyle = '#5a5e63'; for (let y = 0; y < 256; y += 128) g.fillRect(0, y, 128, 4); });
    const tapetes = {};
    const novoTapete = (codigo, cam, meia) => {
        const tex = repetir(tapeteTex.clone(), 1, 1), mat = M('#ffffff', 0.85, 0.02, { map: tex, side: THREE.DoubleSide });
        add(fita(cam, -meia, 0, meia, 0, 0.5), mat, 0, 0, 0, atrio, false);
        metal.push([fita(cam, -meia - 0.06, -0.2, -meia - 0.06, 0.16), INOX], [fita(cam, meia + 0.06, -0.2, meia + 0.06, 0.16), INOX], [fita(cam, -meia - 0.06, -0.2, meia + 0.06, -0.2), INOX_ESC],
            [fita(cam, -meia - 0.09, 0.16, -meia - 0.03, 0.16), '#dfe3e6'], [fita(cam, meia + 0.03, 0.16, meia + 0.09, 0.16), '#dfe3e6']);
        const p = {}, n = Math.max(1, Math.round(cam.comp / 2.4));
        for (let k = 0; k <= n; k++) { cam.em(0.3 + (cam.comp - 0.6) * k / n, p); if (p.z < K.Z0) continue; const h = p.y - 0.2; for (const s of [-1, 1]) { const hz = Math.hypot(p.tx, p.tz) || 1; objetos.push(peca(cx(0.07, h, 0.07), INOX_ESC, p.x - p.tz / hz * meia * s, h / 2, p.z + p.tx / hz * meia * s)); } }
        tapetes[codigo] = { tex, cam };
    };
    novoTapete('C1', criarCaminho([[-0.7, K.Y_COLETOR, K.Z_COLETOR], [-K.X_SAIDA, K.Y_COLETOR, K.Z_COLETOR], [-K.X_SAIDA, K.Y_COLETOR, -15.8]], 0.55), 0.48);
    novoTapete('C2', criarCaminho([[2.3, K.Y_COLETOR, K.Z_COLETOR], [K.X_SAIDA, K.Y_COLETOR, K.Z_COLETOR], [K.X_SAIDA, K.Y_COLETOR, -15.8]], 0.55), 0.48);

    // pala luminosa por cima dos balcões
    objetos.push(peca(cx(27.4, 0.5, 2.2), AZUL, 0, 4.25, -6.3), peca(cx(27.4, 0.06, 2.3), '#0f2644', 0, 4.53, -6.3));
    for (const x of [-13.5, 13.5]) objetos.push(peca(cx(0.3, 4.0, 0.3), BRANCO, x, 2.0, -7.1));
    for (const x of [-9, -3, 3, 9]) objetos.push(peca(cil(0.03, 0.03, A - 4.5, 6), INOX_ESC, x, (A + 4.5) / 2, -6.3));
    letreiro('CHECK-IN  ·  DESPACHO DE BAGAGEM  ·  BAG DROP', 27.2, 0.46, AZUL, '#ffffff', 0, 4.25, -5.19, 0, atrio, 0.6);
    const luzPala = horizontal(26.8, 0.2, luzMat, 0, 3.99, -5.5); luzPala.rotation.x = Math.PI / 2;

    const balcoes = {};
    Object.entries(K.BALCOES).forEach(([codigo, x], i) => {
        const xs = x + K.DX_SECRETARIA, xb = x + K.DX_TAPETE, z = K.Z_BALCAO;
        // secretária: corpo branco, frente na cor da casa, tampo escuro
        objetos.push(peca(caixaRedonda(1.75, 1.02, 0.8, 0.05), BRANCO, xs, 0, z), peca(cx(1.79, 0.05, 0.9), GRAFITE, xs, 1.045, z), peca(cx(1.6, 0.62, 0.03), AZUL_CLARO, xs, 0.52, z + 0.41), peca(cx(1.6, 0.05, 0.035), LARANJA, xs, 0.9, z + 0.412));
        objetos.push(peca(cx(1.79, 0.26, 0.05), '#dfe3e6', xs, 1.2, z + 0.3));                                                             // resguardo
        objetos.push(peca(cx(0.5, 0.34, 0.04), GRAFITE, xs - 0.35, 1.33, z - 0.22, -0.15), peca(cx(0.08, 0.14, 0.08), GRAFITE, xs - 0.35, 1.12, z - 0.24), peca(cx(0.42, 0.02, 0.15), '#3a3f45', xs - 0.35, 1.075, z - 0.02));   // monitor e teclado do agente
        objetos.push(peca(cx(0.26, 0.2, 0.3), '#d5d8da', xs + 0.5, 1.17, z - 0.12), peca(cx(0.2, 0.015, 0.12), '#fbfbf7', xs + 0.5, 1.2, z + 0.1, 0.5));                                                                           // impressora de etiquetas
        // balança e tapete do balcão
        const cam = criarCaminho([[xb, K.Y_BALANCA, -4.55], [xb, K.Y_BALANCA, -6.5], [xb, K.Y_COLETOR, -8.3], [xb, K.Y_COLETOR, K.Z_COLETOR + 0.4]], 0.4);
        novoTapete(codigo, cam, 0.4);
        objetos.push(peca(cx(1.08, 0.06, 2.0), INOX, xb, 0.1, -5.5), peca(cx(1.0, 0.04, 0.05), '#f2c40f', xb, K.Y_BALANCA + 0.005, -4.5));
        objetos.push(peca(cx(0.05, 0.95, 3.7), INOX, x + 0.26, 0.475, -6.3), peca(cx(0.05, 0.75, 3.7), INOX, xb + 0.55, 0.375, -6.3));    // divisórias
        // ecrã suspenso do balcão e mostrador da balança (texturas dinâmicas)
        const cnv = document.createElement('canvas'); cnv.width = 768; cnv.height = 256; const tex = new THREE.CanvasTexture(cnv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
        const ecra = plano(3.0, 1.0, basico(tex), x, 3.3, -5.62); ecra.rotation.x = 0.1;
        objetos.push(peca(cx(3.14, 1.12, 0.1), GRAFITE, x, 3.3, -5.7, 0.1), peca(cx(0.06, 0.5, 0.06), GRAFITE, x - 1.1, 3.95, -5.8), peca(cx(0.06, 0.5, 0.06), GRAFITE, x + 1.1, 3.95, -5.8));
        const cnvB = document.createElement('canvas'); cnvB.width = 320; cnvB.height = 128; const texB = new THREE.CanvasTexture(cnvB); texB.colorSpace = THREE.SRGBColorSpace; texB.anisotropy = 8;
        const mostrador = plano(0.5, 0.2, basico(texB), xb, 1.12, -5.05); mostrador.rotation.x = -0.35;
        objetos.push(peca(cx(0.56, 0.26, 0.05), GRAFITE, xb, 1.12, -5.085, -0.35), peca(cx(0.05, 1.0, 0.05), INOX_ESC, xb + 0.5, 0.5, -5.1), peca(cx(0.5, 0.05, 0.05), INOX_ESC, xb + 0.25, 1.0, -5.1));
        const agente = add(geometriaAgente(40 + i), matPessoas, xs, 0, K.Z_AGENTE);
        // aviso de balcão fechado: fita à frente e placa no tampo
        const fechado = new THREE.Group(); fechado.visible = false; atrio.add(fechado);
        add(fundir([peca(cil(0.03, 0.03, 0.95, 8), INOX, x - 1.55, 0.475, -4.1), peca(cil(0.03, 0.03, 0.95, 8), INOX, x + 1.25, 0.475, -4.1), peca(cil(0.17, 0.17, 0.03, 14), INOX_ESC, x - 1.55, 0.015, -4.1), peca(cil(0.17, 0.17, 0.03, 14), INOX_ESC, x + 1.25, 0.015, -4.1), peca(cx(2.8, 0.06, 0.012), '#b3261e', x - 0.15, 0.9, -4.1)]), matBaias, 0, 0, 0, fechado);
        letreiro('BALCÃO FECHADO', 0.9, 0.22, '#b3261e', '#ffffff', xs, 1.36, z + 0.34, 0, fechado);
        balcoes[codigo] = { x, xs, xb, cam, ecra: { canvas: cnv, tex, chave: '' }, balanca: { canvas: cnvB, tex: texB, chave: '' }, agente, fechado };
    });

    // --- Painel de partidas na parede do fundo ---------------------------------------------
    const cnvP = document.createElement('canvas'); cnvP.width = 2048; cnvP.height = 512; const texP = new THREE.CanvasTexture(cnvP); texP.colorSpace = THREE.SRGBColorSpace; texP.anisotropy = 8;
    plano(16, 4, basico(texP), 0, 6.75, K.Z0 + 0.14);
    objetos.push(peca(cx(16.4, 4.4, 0.12), GRAFITE, 0, 6.75, K.Z0 + 0.06));

    // --- Baias da fila única: postes e fitas retráteis -------------------------------------
    const baias = [], poste = (x, z) => baias.push(peca(cil(0.028, 0.028, 0.95, 8), INOX, x, 0.475, z), peca(cil(0.17, 0.17, 0.03, 14), INOX_ESC, x, 0.015, z), peca(cil(0.045, 0.045, 0.08, 8), GRAFITE, x, 0.96, z));
    const linhaX = (z, x0, x1) => { const n = Math.max(1, Math.round((x1 - x0) / 1.9)); for (let k = 0; k <= n; k++) poste(x0 + (x1 - x0) * k / n, z); baias.push(peca(cx(x1 - x0, 0.055, 0.012), AZUL, (x0 + x1) / 2, 0.9, z)); };
    const linhaZ = (x, z0, z1) => { const n = Math.max(1, Math.round((z1 - z0) / 1.5)); for (let k = 1; k < n; k++) poste(x, z0 + (z1 - z0) * k / n); baias.push(peca(cx(0.012, 0.055, z1 - z0), AZUL, x, 0.9, (z0 + z1) / 2)); };
    linhaX(0.75, -10.3, -0.8); linhaX(0.75, 0.8, 10.3); linhaX(2.25, -10.3, 8.7); linhaX(3.75, -8.7, 10.3); linhaX(5.25, -10.3, 8.7); linhaX(6.75, -8.7, 10.3); linhaX(8.25, -10.3, 10.3);
    linhaZ(-10.3, 0.75, 8.25); linhaZ(10.3, 0.75, 6.75); linhaZ(-0.8, 0.75, 2.25);
    add(fundir(baias), matBaias);
    {   // totem da entrada da fila
        objetos.push(peca(cx(0.08, 2.1, 0.08), INOX_ESC, 11.2, 1.05, 8.6));
        letreiro('FILA ÚNICA  ·  TODOS OS VOOS', 2.4, 0.5, AZUL, '#ffffff', 11.2, 2.2, 8.66);
        letreiro('FILA ÚNICA  ·  TODOS OS VOOS', 2.4, 0.5, AZUL, '#ffffff', 11.2, 2.2, 8.54, Math.PI);
    }

    // --- Apoio ao cliente (poente) e acesso ao controlo de segurança (nascente) -------------
    {
        const [ax, az] = K.APOIO;
        objetos.push(peca(caixaRedonda(1.0, 1.05, 3.4, 0.05), BRANCO, ax - 2.6, 0, az - 1.6), peca(cx(1.1, 0.05, 3.5), GRAFITE, ax - 2.6, 1.075, az - 1.6), peca(cx(0.03, 0.62, 3.2), LARANJA, ax - 2.09, 0.52, az - 1.6));
        add(geometriaAgente(61), matPessoas, ax - 3.5, 0, az - 1.0).rotation.y = Math.PI / 2;
        letreiro('APOIO AO CLIENTE', 5.2, 0.7, LARANJA, '#ffffff', K.X0 + 0.06, 3.3, az - 1.6, Math.PI / 2);
        const [sx, sz] = K.SEGURANCA;
        objetos.push(peca(cx(0.5, 3.4, 0.4), AZUL, K.X1 - 0.25, 1.7, sz - 3.1), peca(cx(0.5, 3.4, 0.4), AZUL, K.X1 - 0.25, 1.7, sz + 3.1), peca(cx(0.5, 0.5, 6.6), AZUL, K.X1 - 0.25, 3.5, sz));
        plano(5.8, 3.25, new THREE.MeshBasicMaterial({ color: '#10161c' }), K.X1 - 0.05, 1.63, sz, -Math.PI / 2);
        letreiro('PARTIDAS  ✈  CONTROLO DE SEGURANÇA', 6.4, 0.42, AZUL, '#ffffff', K.X1 - 0.51, 3.5, sz, -Math.PI / 2);
        for (const dz of [-1.8, -0.6, 0.6, 1.8]) objetos.push(peca(cx(1.4, 1.0, 0.18), INOX, sx - 1.6, 0.5, sz + dz), peca(cx(0.3, 0.06, 0.2), '#27c152', sx - 2.2, 1.03, sz + dz));   // portas de embarque automáticas
    }

    // --- Quiosques, bancos, carrinhos, floreiras e papeleiras -----------------------------
    for (let k = 0; k < 5; k++) { const x = 17 + k * 1.7, z = 15.5; objetos.push(peca(caixaRedonda(0.6, 1.25, 0.5, 0.05), BRANCO, x, 0, z), peca(cx(0.5, 0.42, 0.04), '#0f1a2a', x, 1.42, z + 0.12, -0.5), peca(cx(0.5, 0.1, 0.03), AZUL_CLARO, x, 0.95, z + 0.26)); }
    letreiro('CHECK-IN AUTOMÁTICO', 3.4, 0.36, AZUL_CLARO, '#ffffff', 20.4, 2.5, 15.2);
    objetos.push(peca(cx(0.06, 2.4, 0.06), INOX_ESC, 18.8, 1.2, 15.2), peca(cx(0.06, 2.4, 0.06), INOX_ESC, 22, 1.2, 15.2));
    for (const [x, z, ry] of [[-25, 12.5, 0], [-25, 15.4, Math.PI], [-18.6, 12.5, 0], [-18.6, 15.4, Math.PI], [22, 20.5, 0], [22, 23.4, Math.PI]]) {      // bancos de espera
        const c = Math.cos(ry), sn = Math.sin(ry), em = (dx, dz) => [x + dx * c + dz * sn, z - dx * sn + dz * c];
        const [bx, bz] = em(0, -0.3);
        objetos.push(peca(cx(4.4, 0.09, 0.6), MADEIRA, x, 0.45, z), peca(cx(4.4, 0.5, 0.07), MADEIRA, bx, 0.8, bz, ry ? 0.12 : -0.12), peca(cx(4.4, 0.05, 0.1), INOX_ESC, x, 0.38, z));
        for (const dx of [-1.9, 0, 1.9]) { const [lx, lz] = em(dx, 0); objetos.push(peca(cx(0.07, 0.38, 0.5), INOX_ESC, lx, 0.19, lz, 0, ry)); }
    }
    for (let k = 0; k < 7; k++) { const x = -13.2 + k * 0.34, z = 24.2; objetos.push(peca(cx(0.5, 0.05, 0.9), INOX, x, 0.3 + k * 0.012, z, 0, 0.12), peca(cx(0.05, 0.75, 0.05), INOX, x, 0.7, z - 0.42), peca(cx(0.5, 0.04, 0.04), LARANJA, x, 1.05, z - 0.42)); }
    for (const [x, z] of [[-28, 23], [28, 23], [-28, 8], [28, 8], [-15, 10.2], [15, 10.2]]) {
        objetos.push(peca(cil(0.42, 0.34, 0.7, 16), '#51565c', x, 0.35, z));
        const r = aleatorio(Math.round(x * 13 + z * 7 + 500));
        for (let k = 0; k < 9; k++) { const a = r() * 6.28, d = r() * 0.3; objetos.push(peca(new THREE.SphereGeometry(0.3 + r() * 0.16, 7, 6), k % 3 ? '#3f7a45' : '#4f9457', x + Math.cos(a) * d, 1.05 + r() * 0.75, z + Math.sin(a) * d)); }
        objetos.push(peca(cil(0.05, 0.07, 0.6, 6), '#5a4632', x, 0.9, z));
    }
    for (const [x, z] of [[-12.2, 0.2], [12.2, 0.2], [-3, 24.4], [14, 24.4]]) objetos.push(peca(cil(0.24, 0.22, 0.85, 14), INOX, x, 0.425, z), peca(cil(0.25, 0.25, 0.05, 14), GRAFITE, x, 0.875, z));

    for (const [x, z] of [[0, 17.5]]) {             // sinalética suspensa à entrada
        objetos.push(peca(cx(9.4, 0.9, 0.12), AZUL, x, 5.2, z), peca(cil(0.025, 0.025, A - 5.65, 6), INOX_ESC, x - 4, (A + 5.65) / 2, z), peca(cil(0.025, 0.025, A - 5.65, 6), INOX_ESC, x + 4, (A + 5.65) / 2, z));
        letreiro('← APOIO AO CLIENTE      ↑ CHECK-IN  B01–B06      CONTROLO DE SEGURANÇA →', 9.2, 0.72, AZUL, '#ffffff', x, 5.2, z + 0.07, 0, atrio, 0.42);
        letreiro('SAÍDA  ·  TÁXIS  ·  METRO  ·  AUTOCARROS', 9.2, 0.72, AZUL, '#ffffff', x, 5.2, z - 0.07, Math.PI, atrio, 0.42);
    }
    {   // bagagem fora de formato (poente) e balcão de informações (junto à entrada)
        objetos.push(peca(caixaRedonda(0.9, 1.05, 3.0, 0.05), BRANCO, K.X0 + 1.2, 0, 6), peca(cx(1.0, 0.05, 3.1), GRAFITE, K.X0 + 1.2, 1.075, 6), peca(cx(1.6, 0.3, 2.6), INOX, K.X0 + 2.6, 0.3, 6));
        letreiro('BAGAGEM FORA DE FORMATO', 5.6, 0.6, AZUL, '#ffffff', K.X0 + 0.06, 3.3, 6, Math.PI / 2);
        objetos.push(peca(cil(1.5, 1.5, 1.05, 28), BRANCO, -6, 0.525, 21.5), peca(cil(1.56, 1.56, 0.06, 28), GRAFITE, -6, 1.08, 21.5), peca(cil(1.52, 1.52, 0.12, 28), LARANJA, -6, 0.85, 21.5), peca(cil(0.05, 0.05, 2.2, 8), INOX_ESC, -6, 2.1, 21.5));
        const info = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), new THREE.MeshBasicMaterial({ map: tela(256, 128, (g) => { g.fillStyle = '#2a6fb0'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#ffffff'; g.font = 'bold 96px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('i', 64, 66); g.fillText('i', 192, 66); }), toneMapped: false })); info.position.set(-6, 3.4, 21.5); atrio.add(info);
    }
    const AMBIENTE = [[18.6, 16.3, 3.1], [21.9, 16.4, 3.3], [23.8, 17.6, 2.2], [-24.2, 13.6, 0.4], [-19.6, 14.2, 2.9], [-17.2, 11.6, -0.8], [-6.2, 20.6, 0.3], [-4.3, 22.3, -1.9], [-7.9, 22.6, 1.2], [23.2, 21.6, 0.2], [20.4, 22.2, 2.8], [-27, 7.3, -1.57], [-12, 23.2, 2.4], [26.3, 11, -2.2]];
    AMBIENTE.forEach(([x, z, ry], i) => { add(geometriaPessoa(300 + i * 7), matPessoas, x, 0, z).rotation.y = ry; });
    add(geometriaAgente(63), matPessoas, -6, 0, 21.5).rotation.y = 0.5; add(geometriaAgente(64), matPessoas, K.X0 + 1.9, 0, 6.4).rotation.y = Math.PI / 2;

    add(fundir(objetos), M('#ffffff', 0.55, 0.12, { vertexColors: true }));
    add(fundir(metal), M('#ffffff', 0.35, 0.7, { vertexColors: true, side: THREE.DoubleSide }));

    // --- Luz: claridade geral e sol pela fachada ---------------------------------------------
    scene.add(new THREE.HemisphereLight('#ffffff', '#b3ab9c', 0.95));
    const sol = new THREE.DirectionalLight('#fff1d8', 2.3); sol.position.set(22, 34, 40); sol.target.position.set(0, 0, 2); sol.castShadow = true; sol.shadow.mapSize.set(4096, 4096);
    Object.assign(sol.shadow.camera, { left: -40, right: 40, top: 30, bottom: -30, near: 5, far: 120 }); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.05; scene.add(sol); scene.add(sol.target);

    return { atrio, teto, fachada, balcoes, tapetes, painel: { canvas: cnvP, tex: texP, chave: '' }, matPessoas, matMalas: M('#ffffff', 0.55, 0.05, { vertexColors: true }) };
}
