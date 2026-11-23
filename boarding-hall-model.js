// Bloco 3 · Passageiros, Fase 5: geometria da sala de embarque.
// Maquete didática do piso de embarque: controlo de segurança com quatro linhas (tapete de
// rolos, aparelho de raios X e pórtico), corredor com lojas e quatro portas de embarque com
// balcão, leitor de cartões, fila e cadeiras. Pelos vidros veem-se os aviões estacionados nos
// lugares P21 a P24, com as mangas encostadas. Medidas em metros; o piso da sala fica 3,5 m
// acima da placa. Não reproduz nenhum aeroporto em concreto.
import * as THREE from 'three';
import { fundir } from './baggage-hall-model.js?v=pessoas-1';
import { criarCaminho } from './sorting-hall-model.js?v=relatorio-1';
import { geometriaAgente } from './checkin-hall-model.js?v=pessoas-1';
import { P, construirEstacionados } from './ramp-hall-model.js?v=pessoas-1';

export const K = {
    X0: -124, X1: 94, Z0: -20, Z1: 0, ALTURA: 7.5, Y_PLACA: -3.5,
    LINHAS: { L1: -16.4, L2: -12, L3: -7.6, L4: -3.2 },                 // z do corredor do passageiro em cada linha
    X_CABECA: -108.8, X_MESA: -107, X_PORTICO: -102.9, X_RECOLHA: -98.4, X_SAIDA: -95.2, X_DIVISORIA: -93.6, DZ_TAPETE: -1.15,
    PORTAS: { G21: -82, G22: -38, G23: 6, G24: 50 },                    // x da porta: a rotunda da manga do lugar P21 a P24
    LUGAR: { G21: 'P21', G22: 'P22', G23: 'P23', G24: 'P24' },
    Z_LEITOR: -3.6, Z_CORREDOR: -13.2, X_FIM: 96,
    V_PESSOA: 42,            // metros por minuto simulado (0,7 m/s)
    ESPACO: 0.8,             // distância entre passageiros nas filas
};
const CODIGOS = Object.keys(K.LINHAS);

// Fila de cada linha de controlo: da cabeça para trás, junto à parede e até ao corredor que vem do check-in.
export const FILAS = Object.fromEntries(CODIGOS.map((c, i) => {
    const z = K.LINHAS[c], xv = -118.4 - i * 0.85;
    return [c, criarCaminho([[K.X_CABECA, 0, z], [xv, 0, z], [xv, 0, K.Z0 - 2], [xv, 0, K.Z0 - 30]], 0.45)];
}));
// Fila de cada porta: do leitor para trás, em serpentina, ao lado das cadeiras.
export const FILAS_PORTA = Object.fromEntries(Object.entries(K.PORTAS).map(([g, x]) =>
    [g, criarCaminho([[x, 0, K.Z_LEITOR], [x, 0, -8.9], [x + 21, 0, -8.9], [x + 21, 0, -10.5], [x + 1.5, 0, -10.5]], 0.45)]));
// Cadeiras de cada porta: [x, z, rotação]. Três filas de dois blocos de dez lugares.
export const CADEIRAS = Object.fromEntries(Object.entries(K.PORTAS).map(([g, x]) => {
    const lista = [];
    for (const [z, ry] of [[-5.05, 0], [-2.35, Math.PI], [-5.75, Math.PI]]) for (const x0 of [x + 5.2, x + 13]) for (let k = 0; k < 10; k++) lista.push([x0 + k * 0.62, z, ry]);
    return [g, lista];
}));
// Onde fica quem perdeu o voo: ao lado da fila da porta.
export function lugarEmTerra(porta, k, alvo = {}) { alvo.x = K.PORTAS[porta] - 1.9 - (k % 5) * 0.72; alvo.z = -5.2 - Math.floor(k / 5) * 0.75; return alvo; }
// Montras do corredor, para quem se distrai antes de ir para a porta.
export function lugarNaLoja(i, alvo = {}) { alvo.x = -84 + (i * 37 % 150); alvo.z = -18.3 + (i % 3) * 0.5; return alvo; }

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

// Passageiro, de pé ou sentado, com as mesmas cores nas duas posições. A frente é +z.
const PELE = ['#e8c4a0', '#d9a77f', '#c68b5e', '#9a6843', '#6f4a2f', '#f0d0b4'], CABELO = ['#1d1a17', '#3a2a1c', '#6b4a2b', '#a9843f', '#c9c9c6', '#7b2f1e'];
const ROUPA = ['#2f4a6b', '#7a2e2e', '#3d5a3a', '#c8b68a', '#252a33', '#8a8f96', '#b5532a', '#4b3b63', '#d7d2c4', '#1f5f6b', '#a23b4a', '#5b6f8c'], CALCA = ['#22262d', '#2c3e58', '#4a4033', '#3a3a3a', '#5b5f66', '#1d2a3a', '#6b5a44'];
export function geometriaPassageiro(semente, sentado = false) {
    const r = aleatorio(semente * 2654435 + 4177), e = 0.93 + r() * 0.13, lg = 0.92 + r() * 0.22, p = [];
    const pele = PELE[Math.floor(r() * PELE.length)], cabelo = CABELO[Math.floor(r() * CABELO.length)], roupa = ROUPA[Math.floor(r() * ROUPA.length)], calca = CALCA[Math.floor(r() * CALCA.length)];
    const cabeloComprido = r() < 0.45, mochila = r() < 0.35, corMochila = ROUPA[Math.floor(r() * ROUPA.length)];
    const dy = sentado ? -0.42 : 0, dz = sentado ? -0.05 : 0;                    // o tronco desce para o assento
    for (const k of [-1, 1]) {
        if (sentado) {
            p.push(peca(cx(0.14 * lg, 0.15, 0.46), calca, k * 0.1 * lg, 0.53, 0.17), peca(cx(0.12 * lg, 0.46, 0.14), calca, k * 0.1 * lg, 0.27, 0.36), peca(cx(0.12, 0.08, 0.25), '#1b1b1d', k * 0.1 * lg, 0.04, 0.42));
            p.push(peca(cil(0.05, 0.042, 0.34, 6), roupa, k * 0.25 * lg, 0.86, 0.02, 0, 0, k * 0.08), peca(cil(0.04, 0.038, 0.3, 6), roupa, k * 0.2 * lg, 0.66, 0.16, -1.3, 0, k * 0.3), peca(new THREE.SphereGeometry(0.045, 6, 5), pele, k * 0.14 * lg, 0.63, 0.3));
        } else {
            p.push(peca(cx(0.13 * lg, 0.8, 0.15), calca, k * 0.09 * lg, 0.48, 0), peca(cx(0.12, 0.08, 0.25), '#1b1b1d', k * 0.09 * lg, 0.04, 0.04));
            p.push(peca(cil(0.05, 0.042, 0.6, 6), roupa, k * 0.25 * lg, 1.15, 0, 0, 0, k * 0.08), peca(new THREE.SphereGeometry(0.045, 6, 5), pele, k * 0.275 * lg, 0.83, 0));
        }
    }
    const tronco = cil(0.2 * lg, 0.17 * lg, 0.6, 10); tronco.scale(1, 1, 0.62); p.push(peca(tronco, roupa, 0, 1.17 + dy, dz));
    p.push(peca(cil(0.05, 0.055, 0.08, 8), pele, 0, 1.5 + dy, dz), peca(new THREE.SphereGeometry(0.105, 12, 10), pele, 0, 1.63 + dy, dz));
    p.push(peca(new THREE.SphereGeometry(0.112, 12, 8, 0, Math.PI * 2, 0, Math.PI * (cabeloComprido ? 0.62 : 0.48)), cabelo, 0, 1.64 + dy, dz - 0.012));
    if (mochila) p.push(sentado ? peca(caixaRedonda(0.3, 0.4, 0.18, 0.05), corMochila, 0.36, 0, 0.3) : peca(caixaRedonda(0.3, 0.42, 0.16, 0.05), corMochila, 0, 0.95, -0.2));
    const g = fundir(p); g.scale(e, sentado ? 1 : e, e); g.userData = { papel: 'passageiro', semente, sentado }; return g;
}

// ---------------------------------------------------------------------------
export function construirEmbarque(scene, renderer) {
    const sala = new THREE.Group(), teto = new THREE.Group(), fundo = new THREE.Group(), exterior = new THREE.Group();
    sala.name = 'Sala de embarque — maquete didática'; scene.add(sala); sala.add(teto, fundo, exterior); exterior.position.y = K.Y_PLACA;
    const M = (cor, rug = 0.8, met = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: rug, metalness: met, ...extra });
    const amb = tela(512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f6f8f9'); gr.addColorStop(0.3, '#dfe7ec'); gr.addColorStop(0.5, '#b9cbd8'); gr.addColorStop(0.58, '#8d9296'); gr.addColorStop(1, '#6a6660'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; for (let i = 0; i < 12; i++) g.fillRect(i * 44 + 6, 10, 30, 14); g.fillStyle = '#dff0ff'; g.fillRect(120, 70, 270, 52); });
    amb.mapping = THREE.EquirectangularReflectionMapping; const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(amb).texture; scene.environmentIntensity = 0.6; amb.dispose(); pm.dispose();

    const add = (geo, mat, x = 0, y = 0, z = 0, pai = sala, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; pai.add(m); return m; };
    const plano = (w, h, mat, x, y, z, ry = 0, pai = sala) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; pai.add(m); return m; };
    const horizontal = (w, d, mat, x, y, z, pai = sala) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; pai.add(m); return m; };
    const basico = (tex, extra = {}) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, ...extra });
    const letreiro = (texto, w, h, fundoCor, cor, x, y, z, ry = 0, pai = sala, fonte = 0.62) => plano(w, h, basico(tela(Math.round(256 * w / h), 256, (g, W, H) => {
        g.fillStyle = fundoCor; g.fillRect(0, 0, W, H); g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle';
        let tam = H * fonte; g.font = `700 ${tam}px Arial, sans-serif`; const larg = g.measureText(texto).width; if (larg > W * 0.92) { tam *= W * 0.92 / larg; g.font = `700 ${tam}px Arial, sans-serif`; }
        g.fillText(texto, W / 2, H * 0.54);
    })), x, y, z, ry, pai);
    const ecra = (w, h, pxW, pxH, x, y, z, ry = 0, pai = sala) => { const canvas = document.createElement('canvas'); canvas.width = pxW; canvas.height = pxH; const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; plano(w, h, basico(tex), x, y, z, ry, pai); return { canvas, tex, chave: null }; };
    const LARG = K.X1 - K.X0, FUNDO = K.Z1 - K.Z0, XM = (K.X0 + K.X1) / 2, ZM = (K.Z0 + K.Z1) / 2, A = K.ALTURA;
    const AZUL = '#16365f', AZUL_CLARO = '#2a6fb0', LARANJA = '#e4572e', INOX = '#b9bfc3', INOX_ESC = '#7c8388', GRAFITE = '#262b31', BRANCO = '#f1f2ef', AMARELO = '#f2c40f';
    const objetos = [], metal = [], vidros = [];
    const matPessoas = M('#ffffff', 0.8, 0, { vertexColors: true });

    // --- Pavimento ------------------------------------------------------------------------------
    const granito = tela(1024, 1024, (g, w) => {
        g.fillStyle = '#c3bfb5'; g.fillRect(0, 0, w, w); ruido(g, w, w, 30000, ['#b3afa4', '#d0ccc2', '#a39f94', '#dad6cd', '#96928a'], 1.8);
        g.strokeStyle = '#99958b'; g.lineWidth = 4; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, w); g.moveTo(0, i * 256); g.lineTo(w, i * 256); g.stroke(); }
    });
    horizontal(LARG, FUNDO, M('#ffffff', 0.22, 0.03, { map: repetir(granito, LARG / 4.8, FUNDO / 4.8), envMapIntensity: 0.9 }), XM, 0, ZM);
    horizontal(8, 30, M('#b7b3a9', 0.5), -120.2, -0.004, K.Z0 - 15);                                     // corredor que vem do check-in
    const alcatifa = tela(256, 256, (g, w) => { g.fillStyle = '#2f4f77'; g.fillRect(0, 0, w, w); ruido(g, w, w, 5000, ['#294769', '#365a86', '#2b4a70', '#3f6593'], 1.2); });
    for (const x of Object.values(K.PORTAS)) horizontal(27, 8.2, M('#ffffff', 0.95, 0, { map: repetir(alcatifa.clone(), 9, 2.7) }), x + 10.5, 0.004, -4.1);
    horizontal(K.X_SAIDA - K.X_CABECA + 3, FUNDO, M('#8d9399', 0.6), (K.X_SAIDA + K.X_CABECA) / 2, 0.003, ZM);    // piso técnico do controlo
    const medir = document.createElement('canvas').getContext('2d'); medir.font = 'bold 84px Arial, sans-serif';
    const chao = (texto, x, z, alturaLetra, cor = '#ffffff', rz = 0) => {
        const larg = Math.ceil(medir.measureText(texto).width) + 48, h = alturaLetra * 128 / 84;
        const m = horizontal(h * larg / 128, h, new THREE.MeshBasicMaterial({ map: tela(larg, 128, (g) => { g.fillStyle = cor; g.font = 'bold 84px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texto, larg / 2, 68); }), transparent: true, opacity: 0.9 }), x, 0.008, z);
        m.rotation.z = rz; return m;
    };

    // --- Paredes, lojas e teto -------------------------------------------------------------------
    const parede = M('#e7e6e1', 0.9);
    plano(FUNDO, A, parede, K.X0, A / 2, ZM, Math.PI / 2); plano(FUNDO, A, parede, K.X1, A / 2, ZM, -Math.PI / 2);
    plano(1.6, A, parede, -123.2, A / 2, K.Z0, 0, fundo);                                                  // canto à esquerda da entrada
    plano(K.X_DIVISORIA + 117.4, A, parede, (K.X_DIVISORIA - 117.4) / 2, A / 2, K.Z0, 0, fundo);            // parede do controlo
    plano(5, A - 3.1, parede, -119.9, (A + 3.1) / 2, K.Z0, 0, fundo);                                      // por cima da entrada
    letreiro('CONTROLO DE SEGURANÇA', 4.6, 0.62, AZUL, '#ffffff', -119.9, 3.45, K.Z0 + 0.03, 0, fundo);
    for (const s of [-1, 1]) plano(30, 3.1, parede, -119.9 + s * 2.5, 1.55, K.Z0 - 15, -s * Math.PI / 2, fundo);       // corredor que vem do check-in
    const LOJAS = [['CAFÉ DOURO', '#6b3f22'], ['LIVRARIA', '#27465f'], ['LOJA FRANCA', '#7a2e4a'], ['PASTELARIA', '#8a5a1c'], ['FARMÁCIA', '#2f6b4a'], ['LEMBRANÇAS DO PORTO', '#1f5f6b'], ['CAFÉ RIBEIRA', '#5b3a63']];
    const xLojas = K.X_DIVISORIA + 0.6, largLoja = (K.X1 - xLojas) / LOJAS.length;
    LOJAS.forEach(([nome, cor], i) => {
        const r = aleatorio(i * 13 + 3), xc = xLojas + largLoja * (i + 0.5);
        const montra = tela(1024, 256, (g, w, h) => {
            const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff3da'); gr.addColorStop(1, '#d8c9a8'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
            for (let y = 60; y < h; y += 62) { g.fillStyle = '#6f5a41'; g.fillRect(0, y, w, 7); for (let x = 12; x < w - 30; x += 22 + r() * 30) { g.fillStyle = `hsl(${Math.floor(r() * 360)},${35 + r() * 35}%,${35 + r() * 35}%)`; const a = 18 + r() * 30, l = 12 + r() * 18; g.fillRect(x, y - a, l, a); } }
            g.fillStyle = '#2b3138'; for (let x = 0; x <= w; x += 256) g.fillRect(x - 5, 0, 10, h); g.fillRect(0, 0, w, 8); g.fillRect(0, h - 10, w, 10);
            g.fillStyle = '#1b1f24'; g.fillRect(w / 2 - 70, 30, 140, h - 30); g.fillStyle = 'rgba(255,240,200,0.5)'; g.fillRect(w / 2 - 62, 38, 124, h - 46);
        });
        plano(largLoja - 0.6, 3.1, basico(montra), xc, 1.55, K.Z0 + 0.04, 0, fundo);
        plano(largLoja, A - 3.1, M(cor, 0.85), xc, (A + 3.1) / 2, K.Z0 + 0.02, 0, fundo);
        letreiro(nome, Math.min(largLoja - 4, 11), 0.95, cor, '#ffffff', xc, 3.75, K.Z0 + 0.06, 0, fundo);
        objetos.push(peca(cx(0.5, A, 0.5), '#d9d8d2', xc - largLoja / 2, A / 2, K.Z0 + 0.25));
    });
    const tetoTex = tela(512, 512, (g, w) => { g.fillStyle = '#eceeed'; g.fillRect(0, 0, w, w); g.strokeStyle = '#cfd3d2'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, w); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); } g.fillStyle = '#ffffff'; g.fillRect(40, 228, 432, 56); });
    const mTeto = new THREE.Mesh(new THREE.PlaneGeometry(LARG, FUNDO), new THREE.MeshBasicMaterial({ map: repetir(tetoTex, LARG / 6, FUNDO / 6) })); mTeto.rotation.x = Math.PI / 2; mTeto.position.set(XM, A, ZM); teto.add(mTeto);
    const cobertura = new THREE.Mesh(cx(LARG + 3, 0.6, FUNDO + 4), M('#e3e4e0', 0.9)); cobertura.position.set(XM, A + 0.35, ZM + 0.6); teto.add(cobertura);

    // --- Fachada envidraçada, portas das mangas e o que se vê lá fora --------------------------------
    const matVidro = M('#bcd6e6', 0.05, 0.1, { transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 1.4, side: THREE.DoubleSide });
    const portasX = Object.values(K.PORTAS);
    let x0 = K.X0;
    for (const xp of [...portasX, null]) {                                         // panos de vidro entre as portas
        const x1 = xp === null ? K.X1 : xp - 1.3;
        plano(x1 - x0, A, matVidro, (x0 + x1) / 2, A / 2, 0).castShadow = false;
        if (xp !== null) { plano(2.6, A - 2.7, matVidro, xp, (A + 2.7) / 2, 0); x0 = xp + 1.3; }
    }
    for (let x = K.X0; x <= K.X1 + 0.1; x += 5.45) metal.push(peca(cx(0.14, A, 0.22), '#4a535b', x, A / 2, 0.02));
    metal.push(peca(cx(LARG, 0.16, 0.2), '#4a535b', XM, 3.4, 0.02), peca(cx(LARG, 0.3, 0.3), '#4a535b', XM, A - 0.15, 0.02), peca(cx(LARG, 0.5, 0.36), '#d9d8d2', XM, 0.25, 0.06));
    plano(LARG, -K.Y_PLACA + 0.9, M('#cdcbc3', 0.9), XM, (K.Y_PLACA - 0.9) / 2 + 0.9 - 0.45, 0.24);            // piso técnico, visto de fora
    plano(FUNDO, -K.Y_PLACA, M('#c4c2ba', 0.9), K.X1 + 0.02, K.Y_PLACA / 2, ZM, Math.PI / 2); plano(FUNDO, -K.Y_PLACA, M('#c4c2ba', 0.9), K.X0 - 0.02, K.Y_PLACA / 2, ZM, -Math.PI / 2);
    plano(FUNDO, A, M('#d9d8d2', 0.9), K.X1 + 0.02, A / 2, ZM, Math.PI / 2); plano(FUNDO, A, M('#d9d8d2', 0.9), K.X0 - 0.02, A / 2, ZM, -Math.PI / 2);

    const ceu = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: tela(32, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#4f8fd0'); gr.addColorStop(0.36, '#9cc4e6'); gr.addColorStop(0.5, '#dfeaf0'); gr.addColorStop(1, '#dfeaf0'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) }));
    exterior.add(ceu);
    const betao = tela(1024, 1024, (g, w) => {
        g.fillStyle = '#b3b1aa'; g.fillRect(0, 0, w, w); ruido(g, w, w, 26000, ['#a5a39c', '#bfbdb6', '#9b9992', '#c8c6bf'], 1.7);
        g.strokeStyle = '#8a8882'; g.lineWidth = 5; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 512, 0); g.lineTo(i * 512, w); g.moveTo(0, i * 512); g.lineTo(w, i * 512); g.stroke(); }
    });
    horizontal(520, 96, M('#ffffff', 0.93, 0, { map: repetir(betao, 520 / 15, 96 / 15) }), 0, 0, 30, exterior);
    const asfalto = tela(512, 512, (g, w) => { g.fillStyle = '#55585b'; g.fillRect(0, 0, w, w); ruido(g, w, w, 9000, ['#4a4d50', '#606366', '#3f4245', '#6a6d70'], 1.5); });
    horizontal(520, 34, M('#ffffff', 0.95, 0, { map: repetir(asfalto, 52, 3.4) }), 0, -0.004, 95, exterior);
    const relva = tela(512, 512, (g, w) => { g.fillStyle = '#6e8f52'; g.fillRect(0, 0, w, w); ruido(g, w, w, 9000, ['#5f8046', '#7c9c5e', '#688a4c', '#88a468'], 2.2); });
    horizontal(2400, 2400, M('#ffffff', 1, 0, { map: repetir(relva, 160, 160) }), 0, -0.06, 200, exterior);
    horizontal(900, 300, M('#8d8c86', 1), 0, -0.03, -170, exterior);
    const marcas = [];
    const linha = (xa, za, xb, zb, larg, cor) => { const dx = xb - xa, dz = zb - za; marcas.push(peca(cx(larg, 0.004, Math.hypot(dx, dz)), cor, (xa + xb) / 2, 0.014, (za + zb) / 2, 0, Math.atan2(dx, dz))); };
    linha(-260, P.Z_TAXI, 260, P.Z_TAXI, 0.3, AMARELO); linha(-120, 3.2, 120, 3.2, 0.15, '#f4f4f0'); linha(-120, 11.8, 120, 11.8, 0.15, '#f4f4f0');
    for (const xc of Object.values(P.LUGARES)) { linha(xc, P.Z_TAXI, xc, P.Z_NARIZ + 5, 0.22, AMARELO); for (const [a, b, c, d] of [[-19.6, 14, 19.6, 14], [-19.6, 14, -19.6, 60], [19.6, 14, 19.6, 60]]) linha(xc + a, b, xc + c, d, 0.2, '#c0392b'); }
    add(fundir(marcas), M('#ffffff', 0.85, 0, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 0, 0, 0, exterior, false);
    const estacionados = construirEstacionados(exterior);

    // --- Controlo de segurança -------------------------------------------------------------------
    const rolos = tela(64, 256, (g) => { g.fillStyle = '#6d747a'; g.fillRect(0, 0, 64, 256); for (let y = 0; y < 256; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 14); gr.addColorStop(0, '#8d949a'); gr.addColorStop(0.5, '#dfe3e6'); gr.addColorStop(1, '#7d848a'); g.fillStyle = gr; g.fillRect(3, y + 1, 58, 13); } });
    const lona = tela(64, 256, (g) => { g.fillStyle = '#1c1d1f'; g.fillRect(0, 0, 64, 256); ruido(g, 64, 256, 500, ['#141516', '#2a2c2e'], 1.2); g.fillStyle = '#34373a'; for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 64, 3); });
    const linhas = {};
    const posto = (x, z, ry = 0) => {                                               // monitores do operador de raios X
        const p = [peca(cx(1.3, 0.05, 0.6), GRAFITE, 0, 1.02, 0), peca(cx(0.08, 1.0, 0.5), INOX_ESC, -0.55, 0.5, 0), peca(cx(0.08, 1.0, 0.5), INOX_ESC, 0.55, 0.5, 0)];
        for (const k of [-0.31, 0.31]) p.push(peca(cx(0.56, 0.36, 0.04), '#101418', k, 1.34, 0.1, -0.15), peca(cx(0.5, 0.3, 0.01), k < 0 ? '#2d8fb8' : '#c9772a', k, 1.34, 0.125, -0.15), peca(cx(0.05, 0.14, 0.05), GRAFITE, k, 1.1, 0.1));
        const g = fundir(p); g.rotateY(ry); g.translate(x, 0, z); return g;
    };
    CODIGOS.forEach((codigo, i) => {
        const z = K.LINHAS[codigo], zt = z + K.DZ_TAPETE, grupo = new THREE.Group(), aberto = new THREE.Group(), fechado = new THREE.Group(); sala.add(grupo); grupo.add(aberto, fechado);
        // tapete de rolos de entrada, aparelho de raios X e tapete de recolha
        const p = [];
        for (const [xa, xb] of [[-108, -104.4], [-101.6, -97.2]]) {
            p.push(peca(cx(xb - xa, 0.1, 0.78), INOX_ESC, (xa + xb) / 2, 0.76, zt), peca(cx(xb - xa, 0.07, 0.05), INOX, (xa + xb) / 2, 0.86, zt - 0.4), peca(cx(xb - xa, 0.07, 0.05), INOX, (xa + xb) / 2, 0.86, zt + 0.4));
            for (let x = xa + 0.25; x < xb; x += 1.1) for (const k of [-0.3, 0.3]) p.push(peca(cx(0.06, 0.72, 0.06), INOX_ESC, x, 0.36, zt + k));
            const m = horizontal(0.7, xb - xa, M('#ffffff', 0.35, 0.6, { map: repetir(rolos.clone(), 1, (xb - xa) * 4) }), (xa + xb) / 2, 0.815, zt, grupo); m.rotation.z = Math.PI / 2;
        }
        p.push(peca(caixaRedonda(2.8, 1.5, 1.06, 0.06), '#dfe2e3', -103, 0.34, zt), peca(cx(2.84, 0.16, 1.1), AZUL, -103, 1.5, zt), peca(cx(2.6, 0.34, 0.9), GRAFITE, -103, 0.17, zt));
        for (const k of [-1, 1]) { p.push(peca(cx(0.04, 0.5, 0.74), '#0d0f11', -103 + k * 1.41, 1.08, zt)); for (let j = 0; j < 7; j++) p.push(peca(cx(0.02, 0.44, 0.09), '#3a3d40', -103 + k * 1.43, 1.06, zt - 0.3 + j * 0.1)); }
        p.push(peca(cx(0.12, 0.12, 0.12), '#ff3b30', -102.2, 1.7, zt + 0.3), peca(cx(0.5, 0.3, 0.04), '#101418', -103.6, 1.3, zt + 0.55), peca(cx(0.44, 0.24, 0.01), '#2d8fb8', -103.6, 1.3, zt + 0.572));
        for (let k = 0; k < 6; k++) p.push(peca(caixaRedonda(0.56, 0.1, 0.4, 0.03), '#8f979d', -108.45, 0.22 + k * 0.045, zt));       // pilha de tabuleiros
        p.push(peca(cx(0.7, 0.2, 0.52), INOX_ESC, -108.45, 0.1, zt));
        // pórtico detetor de metais
        for (const k of [-0.43, 0.43]) p.push(peca(cx(0.5, 2.15, 0.12), '#e3e5e4', K.X_PORTICO, 1.075, z + k), peca(cx(0.52, 0.5, 0.13), AZUL_CLARO, K.X_PORTICO, 1.5, z + k));
        p.push(peca(cx(0.5, 0.16, 0.98), '#e3e5e4', K.X_PORTICO, 2.2, z), peca(cx(0.4, 0.02, 0.74), '#3a3f44', K.X_PORTICO, 0.012, z));
        // divisórias de vidro entre linhas e baias da fila
        vidros.push(peca(cx(13.5, 1.5, 0.03), '#bcd6e6', -101.9, 1.05, z + 2.18));
        for (let x = -108.6; x <= -95; x += 2.7) p.push(peca(cx(0.06, 1.85, 0.06), INOX_ESC, x, 0.92, z + 2.18));
        const xv = -118.4 - i * 0.85;
        for (let x = K.X_CABECA - 0.4; x > xv + 1.2; x -= 1.9) for (const k of [-0.5, 0.5]) { metal.push(peca(cil(0.03, 0.03, 0.95, 8), INOX, x, 0.475, z + k), peca(cil(0.14, 0.16, 0.03, 12), INOX_ESC, x, 0.015, z + k), peca(cx(1.9, 0.05, 0.012), AZUL, x - 0.95, 0.9, z + k)); }
        add(fundir(p), M('#ffffff', 0.5, 0.25, { vertexColors: true }), 0, 0, 0, grupo);
        add(posto(-103, zt - 0.95, 0), M('#ffffff', 0.5, 0.2, { vertexColors: true }), 0, 0, 0, aberto);
        add(geometriaAgente(40 + i), matPessoas, -103, 0, zt - 1.45, aberto);                                       // operador do raios X
        add(geometriaAgente(50 + i), matPessoas, -101.5, 0, z + 0.85, aberto).rotation.y = -Math.PI / 2 - 0.5;      // agente depois do pórtico
        add(geometriaAgente(60 + i), matPessoas, -107.2, 0, z + 0.95, aberto).rotation.y = -Math.PI / 2 - 0.9;      // agente que ajuda nos tabuleiros
        add(fundir([peca(cx(0.05, 0.1, 1.1), '#d32f2f', K.X_CABECA + 0.2, 0.95, z), peca(cil(0.03, 0.03, 1, 8), INOX, K.X_CABECA + 0.2, 0.5, z - 0.55), peca(cil(0.03, 0.03, 1, 8), INOX, K.X_CABECA + 0.2, 0.5, z + 0.55),
            peca(cx(0.05, 0.6, 0.6), '#d32f2f', K.X_CABECA + 0.25, 1.5, z)]), M('#ffffff', 0.6, 0.1, { vertexColors: true }), 0, 0, 0, fechado);
        // sinal por cima da entrada da linha
        metal.push(peca(cx(0.1, 0.1, 2.6), GRAFITE, K.X_CABECA + 0.5, 3.35, z), peca(cx(0.06, 0.5, 0.06), GRAFITE, K.X_CABECA + 0.5, 3.6, z - 1.1), peca(cx(0.06, 0.5, 0.06), GRAFITE, K.X_CABECA + 0.5, 3.6, z + 1.1));
        const sinal = ecra(2.4, 0.9, 512, 192, K.X_CABECA + 0.44, 2.85, z, -Math.PI / 2);
        objetos.push(peca(cx(0.1, 1.0, 2.5), GRAFITE, K.X_CABECA + 0.5, 2.85, z));
        chao(codigo, K.X_CABECA - 1.6, z + 1.25, 0.5, '#ffffff', Math.PI / 2);
        linhas[codigo] = { z, grupo, aberto, fechado, sinal };
    });
    // divisória entre o controlo e o corredor, com uma passagem por linha
    let za = K.Z0;
    for (const z of [...Object.values(K.LINHAS), null]) {
        const zb = z === null ? K.Z1 : z - 0.9;
        if (zb - za > 0.2) { vidros.push(peca(cx(0.04, 2.7, zb - za), '#bcd6e6', K.X_DIVISORIA, 1.35, (za + zb) / 2)); metal.push(peca(cx(0.1, 2.8, 0.1), INOX_ESC, K.X_DIVISORIA, 1.4, za + 0.05), peca(cx(0.1, 2.8, 0.1), INOX_ESC, K.X_DIVISORIA, 1.4, zb - 0.05), peca(cx(0.1, 0.1, zb - za), INOX_ESC, K.X_DIVISORIA, 2.75, (za + zb) / 2)); }
        if (z !== null) za = z + 0.9;
    }
    letreiro('PORTAS  G21 – G24  ➜', 7, 0.8, AZUL, '#ffffff', K.X_DIVISORIA + 0.08, 3.5, -10, Math.PI / 2);
    objetos.push(peca(cx(0.12, 1.0, 7.3), GRAFITE, K.X_DIVISORIA, 3.5, -10));
    // quadro do controlo, virado para quem chega do check-in
    const quadro = ecra(4.6, 2.3, 1024, 512, -113.2, 3.4, K.Z0 + 0.12, 0);
    objetos.push(peca(cx(4.9, 2.6, 0.14), GRAFITE, -113.2, 3.4, K.Z0 + 0.05));

    // --- Corredor: painel de partidas, colunas, bancos e plantas -----------------------------------
    const painel = ecra(6.4, 2.6, 2048, 832, K.X_DIVISORIA + 7, 4.0, -12.1, -Math.PI / 2);
    plano(6.4, 2.6, basico(painel.tex), K.X_DIVISORIA + 7.32, 4.0, -12.1, Math.PI / 2);
    objetos.push(peca(cx(0.3, 2.9, 6.7), GRAFITE, K.X_DIVISORIA + 7.16, 4.0, -12.1), peca(cx(0.1, A - 5.4, 0.1), INOX_ESC, K.X_DIVISORIA + 7.16, (A + 5.45) / 2, -14.6), peca(cx(0.1, A - 5.4, 0.1), INOX_ESC, K.X_DIVISORIA + 7.16, (A + 5.45) / 2, -9.6));
    for (let x = -80; x < K.X1; x += 22) {
        objetos.push(peca(cil(0.32, 0.32, A, 18), '#eceae4', x - 9, A / 2, -15.4), peca(cil(0.36, 0.36, 0.5, 18), INOX_ESC, x - 9, 0.25, -15.4));
        const r = aleatorio(Math.round(x + 500));
        objetos.push(peca(cil(0.34, 0.26, 0.55, 14), '#5b6269', x + 2, 0.275, -15.6));                                        // planta em vaso
        for (let k = 0; k < 9; k++) objetos.push(peca(new THREE.ConeGeometry(0.16, 0.9 + r() * 0.6, 5), k % 2 ? '#3f7a45' : '#56925a', x + 2 + (r() - 0.5) * 0.4, 0.9 + r() * 0.3, -15.6 + (r() - 0.5) * 0.4, (r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7));
        objetos.push(peca(cil(0.26, 0.24, 0.8, 14), INOX_ESC, x - 7.6, 0.4, -15.5), peca(cil(0.27, 0.27, 0.05, 14), GRAFITE, x - 7.6, 0.82, -15.5));   // papeleira
    }
    chao('G21 – G24', -86, -13.2, 0.7, '#ffffff', 0);

    // --- Portas de embarque ---------------------------------------------------------------------------
    const cadeira = () => {                                                         // bloco de dez lugares, virado para +z
        const p = [peca(cx(6.3, 0.07, 0.07), INOX_ESC, 2.79, 0.36, 0)];
        for (const x of [0.3, 2.79, 5.28]) p.push(peca(cx(0.07, 0.36, 0.07), INOX_ESC, x, 0.18, 0), peca(cx(0.09, 0.03, 0.6), INOX_ESC, x, 0.015, 0.05));
        for (let k = 0; k < 10; k++) {
            p.push(peca(caixaRedonda(0.54, 0.07, 0.5, 0.03), '#2b3440', k * 0.62, 0.4, 0.06), peca(caixaRedonda(0.54, 0.5, 0.07, 0.03), '#2b3440', k * 0.62, 0.5, -0.2, -0.16));
            if (k % 2 === 0) p.push(peca(cx(0.04, 0.04, 0.42), INOX, k * 0.62 - 0.31, 0.62, 0.05), peca(cx(0.04, 0.2, 0.04), INOX, k * 0.62 - 0.31, 0.52, 0.24));
        }
        p.push(peca(cx(0.04, 0.04, 0.42), INOX, 9 * 0.62 + 0.31, 0.62, 0.05), peca(cx(0.04, 0.2, 0.04), INOX, 9 * 0.62 + 0.31, 0.52, 0.24));
        return fundir(p);
    };
    const gCadeira = cadeira(), matCadeira = M('#ffffff', 0.55, 0.3, { vertexColors: true });
    const portas = {};
    Object.entries(K.PORTAS).forEach(([codigo, x], i) => {
        const grupo = new THREE.Group(); sala.add(grupo);
        // moldura da porta da manga e folhas de correr
        objetos.push(peca(cx(0.22, 2.75, 0.5), GRAFITE, x - 1.21, 1.375, -0.3), peca(cx(0.22, 2.75, 0.5), GRAFITE, x + 1.21, 1.375, -0.3), peca(cx(2.64, 0.26, 0.5), GRAFITE, x, 2.7, -0.3));
        objetos.push(peca(cx(2.5, 2.95, 0.6), '#30363c', x, 1.48, 0.42), peca(cx(2.2, 0.02, 0.9), '#5a6068', x, 0.012, -0.1));
        const matFolha = M('#9fb9c9', 0.1, 0.3, { transparent: true, opacity: 0.55 });
        const folhas = [-1, 1].map(k => { const m = add(cx(1.1, 2.5, 0.05), matFolha, x + k * 0.55, 1.27, -0.34, grupo, false); m.userData.x0 = x + k * 0.55; m.userData.k = k; return m; });
        letreiro(codigo, 2.6, 1.15, AMARELO, '#1b1b1b', x, 3.55, -0.36, Math.PI, grupo, 0.78);
        objetos.push(peca(cx(2.8, 1.35, 0.14), GRAFITE, x, 3.55, -0.27));
        // leitor de cartões, balcão e ecrã da porta
        metal.push(peca(cx(0.14, 1.0, 0.14), INOX_ESC, x - 0.72, 0.5, K.Z_LEITOR + 0.5), peca(cx(0.26, 0.08, 0.34), GRAFITE, x - 0.72, 1.04, K.Z_LEITOR + 0.5, 0.5), peca(cil(0.18, 0.2, 0.03, 12), INOX_ESC, x - 0.72, 0.015, K.Z_LEITOR + 0.5));
        const lampada = add(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: '#39424a', toneMapped: false }), x - 0.72, 1.2, K.Z_LEITOR + 0.62, grupo, false);
        for (const k of [-1, 1]) metal.push(peca(cx(0.1, 0.95, 1.3), INOX, x + k * 0.62, 0.475, K.Z_LEITOR + 1.5), peca(cx(0.12, 0.05, 1.34), GRAFITE, x + k * 0.62, 0.97, K.Z_LEITOR + 1.5));
        objetos.push(peca(caixaRedonda(2.3, 1.08, 0.75, 0.05), AZUL, x + 3.1, 0, -2.6), peca(cx(2.36, 0.05, 0.82), BRANCO, x + 3.1, 1.1, -2.6), peca(cx(2.3, 0.4, 0.03), LARANJA, x + 3.1, 0.75, -2.99));
        objetos.push(peca(cx(0.5, 0.34, 0.04), '#101418', x + 3.1, 1.32, -2.45, 0.2), peca(cx(0.06, 0.12, 0.06), GRAFITE, x + 3.1, 1.16, -2.4));
        add(geometriaAgente(70 + i), matPessoas, x + 3.1, 0, -1.95, grupo).rotation.y = Math.PI;                              // agente no balcão
        add(geometriaAgente(80 + i), matPessoas, x - 1.5, 0, K.Z_LEITOR + 0.75, grupo).rotation.y = Math.PI / 2 + 0.6;        // agente junto ao leitor
        const tela1 = ecra(3.6, 1.5, 1024, 432, x + 3.1, 3.3, -0.62, Math.PI, grupo);
        objetos.push(peca(cx(3.8, 1.7, 0.12), GRAFITE, x + 3.1, 3.3, -0.54), peca(cx(0.08, A - 4.1, 0.08), INOX_ESC, x + 2.1, (A + 4.15) / 2, -0.5), peca(cx(0.08, A - 4.1, 0.08), INOX_ESC, x + 4.1, (A + 4.15) / 2, -0.5));
        // baias da fila e cadeiras
        const fila = FILAS_PORTA[codigo];
        for (let d = 1.2; d < 26; d += 1.9) { const a = fila.em(d); const lado = Math.abs(a.tz) > 0.5 ? [0.55, 0] : [0, 0.55]; for (const k of [-1, 1]) metal.push(peca(cil(0.03, 0.03, 0.95, 8), INOX, a.x + k * lado[0], 0.475, a.z + k * lado[1]), peca(cil(0.14, 0.16, 0.03, 12), INOX_ESC, a.x + k * lado[0], 0.015, a.z + k * lado[1])); }
        for (const k of [-0.55, 0.55]) metal.push(peca(cx(0.012, 0.05, 4.2), AZUL, x + k, 0.9, -6.6));
        metal.push(peca(cx(19.8, 0.05, 0.012), AZUL, x + 10.9, 0.9, -8.35), peca(cx(19.8, 0.05, 0.012), AZUL, x + 10.3, 0.9, -9.7), peca(cx(19, 0.05, 0.012), AZUL, x + 11, 0.9, -11.05));
        for (const [z, ry] of [[-5.05, 0], [-2.35, Math.PI], [-5.75, Math.PI]]) for (const xb of [x + 5.2, x + 13]) { const m = add(gCadeira, matCadeira, ry ? xb + 9 * 0.62 : xb, 0, z, grupo); m.rotation.y = ry; }
        chao(codigo, x + 1.9, -6.6, 0.8, '#ffffff', Math.PI / 2);
        portas[codigo] = { x, grupo, folhas, lampada, ecra: tela1, lugar: K.LUGAR[codigo] };
    });

    add(fundir(objetos), M('#ffffff', 0.6, 0.1, { vertexColors: true }));
    add(fundir(metal), M('#ffffff', 0.35, 0.6, { vertexColors: true }));
    add(fundir(vidros), M('#ffffff', 0.08, 0.1, { vertexColors: true, transparent: true, opacity: 0.28, depthWrite: false }), 0, 0, 0, sala, false);

    // --- Luz: sol a entrar pelos vidros; a sombra acompanha a zona que a câmara está a ver -----------
    scene.add(new THREE.HemisphereLight('#f3f6f8', '#a9a69c', 1.25));
    const sol = new THREE.DirectionalLight('#fff3dc', 2.1); sol.castShadow = true; sol.shadow.mapSize.set(4096, 4096);
    Object.assign(sol.shadow.camera, { left: -70, right: 70, top: 60, bottom: -60, near: 10, far: 420 }); sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.06; scene.add(sol); scene.add(sol.target);
    const focar = (x, z) => { sol.target.position.set(x, 0, z); sol.position.set(x + 60, 110, z + 95); };
    focar(0, 0);

    return { sala, teto, fundo, exterior, linhas, portas, quadro, painel, estacionados, matPessoas, focar,
        lona: M('#ffffff', 0.9, 0, { map: lona }), matTabuleiro: M('#ffffff', 0.6, 0.05, { vertexColors: true }) };
}

// Tabuleiro com os pertences de um passageiro, para o tapete do raios X.
export function geometriaTabuleiro(semente) {
    const r = aleatorio(semente * 977 + 11), p = [peca(caixaRedonda(0.58, 0.09, 0.42, 0.03), '#8f979d', 0, 0, 0)];
    p.push(peca(caixaRedonda(0.3, 0.16, 0.24, 0.04), ROUPA[Math.floor(r() * ROUPA.length)], -0.08, 0.06, 0.02), peca(cx(0.14, 0.02, 0.2), '#22262d', 0.18, 0.09, -0.04), peca(cil(0.03, 0.03, 0.12, 8), '#d9d2c4', 0.16, 0.14, 0.12));
    return fundir(p);
}
