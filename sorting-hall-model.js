// Bloco 2 · Bagagens, Fase 2: modelo 3D da central de triagem (maquete didática).
// Um pavilhão técnico com a rede de tapetes do motor Python (triagem.py): linhas do check-in,
// portal de leitura de etiquetas, linha A (principal) e linha B (distribuição) ligadas por
// transversais, retorno, rampas para as saídas S01 a S04 e posto de inspeção.
// Os nós e os troços têm os mesmos códigos do grafo que o aluno recebe em consultar_rede().
// 1 unidade = 1 metro. Não reproduz as instalações técnicas reais do aeroporto.
import * as THREE from 'three';
import { fundir, geometriaPessoa } from './baggage-hall-model.js?v=bagagens-3';

const Y = 2.4, YS = 0.95, ZA = -10, ZB = 4, ZR = -23, XL = -45, XR = 41, XS = [-27, -9, 9, 27];
export const T = {
    Y, YS, ZA, ZB, ZR, XL, XR, XS,
    X0: -66, X1: 54, Z0: -30, Z1: 34, ALTURA: 9.5,
    Z_CAIS: 21.5, Z_VIA: 27.5, LARGURA: 1.0,
};
export const NOS = {
    C1: [-66, 5.6, -16], C2: [-66, 5.6, -4], LEITOR: [XL, Y, ZA], INSPECAO: [XL, YS, 12], RET: [XR, Y, ZA],
    A1: [XS[0], Y, ZA], A2: [XS[1], Y, ZA], A3: [XS[2], Y, ZA], A4: [XS[3], Y, ZA],
    B1: [XS[0], Y, ZB], B2: [XS[1], Y, ZB], B3: [XS[2], Y, ZB], B4: [XS[3], Y, ZB],
    S01: [XS[0], YS, 17], S02: [XS[1], YS, 17], S03: [XS[2], YS, 17], S04: [XS[3], YS, 17],
};
const PONTOS = {
    'C1>LEITOR': [NOS.C1, [-62.5, 5.6, -16], [-55, Y, -16], [-51, Y, -13.6], NOS.LEITOR],
    'C2>LEITOR': [NOS.C2, [-62.5, 5.6, -4], [-55, Y, -4], [-51, Y, -6.4], NOS.LEITOR],
    'LEITOR>A1': [NOS.LEITOR, NOS.A1],
    'LEITOR>INSPECAO': [NOS.LEITOR, [XL, Y, -3.5], [XL, YS, 5], NOS.INSPECAO],
    'A4>RET': [NOS.A4, NOS.RET],
    'B4>RET': [NOS.B4, [XR, Y, ZB], NOS.RET],
    'RET>LEITOR': [NOS.RET, [XR, Y, ZR], [XL, Y, ZR], NOS.LEITOR],
};
for (let i = 0; i < 4; i++) {
    const n = i + 1, x = XS[i];
    if (i < 3) { PONTOS[`A${n}>A${n + 1}`] = [NOS['A' + n], NOS['A' + (n + 1)]]; PONTOS[`B${n}>B${n + 1}`] = [NOS['B' + n], NOS['B' + (n + 1)]]; }
    PONTOS[`A${n}>B${n}`] = [NOS['A' + n], NOS['B' + n]];
    PONTOS[`B${n}>S0${n}`] = [NOS['B' + n], [x, Y, 7], [x, YS, 13], NOS['S0' + n]];
}

// Caminho com os cantos arredondados; em(d) dá a posição e a direção a d metros do início.
export function criarCaminho(pontos, raio = 1.3) {
    const P = pontos.map(p => new THREE.Vector3(...p)), pts = [P[0].clone()];
    for (let i = 1; i < P.length - 1; i++) {
        const u = P[i].clone().sub(P[i - 1]), v = P[i + 1].clone().sub(P[i]), r = Math.min(raio, u.length() * 0.45, v.length() * 0.45);
        const a = P[i].clone().addScaledVector(u.normalize(), -r), b = P[i].clone().addScaledVector(v.normalize(), r);
        for (let k = 0; k <= 8; k++) { const s = k / 8; pts.push(a.clone().multiplyScalar((1 - s) ** 2).addScaledVector(P[i], 2 * s * (1 - s)).addScaledVector(b, s * s)); }
    }
    pts.push(P.at(-1).clone());
    const acum = [0];
    for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const comp = acum.at(-1);
    function em(d, alvo = {}) {
        d = Math.max(0, Math.min(comp, d));
        let i = 1; while (i < pts.length - 1 && acum[i] < d) i++;
        const a = pts[i - 1], b = pts[i], L = acum[i] - acum[i - 1], k = L > 1e-9 ? (d - acum[i - 1]) / L : 0;
        alvo.x = a.x + (b.x - a.x) * k; alvo.y = a.y + (b.y - a.y) * k; alvo.z = a.z + (b.z - a.z) * k;
        alvo.tx = (b.x - a.x) / L; alvo.ty = (b.y - a.y) / L; alvo.tz = (b.z - a.z) / L;
        return alvo;
    }
    return { pts, acum, comp, em };
}
export const CAMINHOS = Object.fromEntries(Object.entries(PONTOS).map(([codigo, pontos]) => [codigo, criarCaminho(pontos)]));

// ---------------------------------------------------------------------------
// Utilitários (os mesmos processos da sala de recolha)
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

// Fita ao longo de um caminho: une os pontos (lado a, alt a) e (lado b, alt b) medidos a partir do eixo do tapete.
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

// ---------------------------------------------------------------------------
export function construirCentral(scene, renderer) {
    const central = new THREE.Group(), teto = new THREE.Group(); central.name = 'Central de triagem de bagagens — maquete didática'; scene.add(central); central.add(teto);
    const M = (cor, rug = 0.8, met = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: rug, metalness: met, ...extra });
    const amb = tela(512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f4f6f6'); gr.addColorStop(0.35, '#d5dadc'); gr.addColorStop(0.52, '#a9aeb0'); gr.addColorStop(0.6, '#77797a'); gr.addColorStop(1, '#55585a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; for (let i = 0; i < 14; i++) g.fillRect(i * 38 + 6, 14, 22, 26); });
    amb.mapping = THREE.EquirectangularReflectionMapping; const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(amb).texture; scene.environmentIntensity = 0.5; amb.dispose(); pm.dispose();

    const add = (geo, mat, x = 0, y = 0, z = 0, pai = central, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; pai.add(m); return m; };
    const plano = (w, h, mat, x, y, z, ry = 0, pai = central) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; pai.add(m); return m; };
    const horizontal = (w, d, mat, x, y, z, pai = central) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; pai.add(m); return m; };
    const LARG = T.X1 - T.X0, FUNDO = T.Z1 - T.Z0, XM = (T.X0 + T.X1) / 2, ZM = (T.Z0 + T.Z1) / 2, A = T.ALTURA;
    const AMARELO = '#e8b90f', ACO = '#aab0b4', ACO_ESC = '#6d7377', AZUL = '#1f4f9a', GRAFITE = '#2a3138';
    const estrutura = [], pintura = [];          // peças fundidas no fim: estrutura (dois lados) e objetos

    // --- Pavimento industrial -------------------------------------------------
    const betao = tela(1024, 1024, (g, w) => {
        g.fillStyle = '#9a9c98'; g.fillRect(0, 0, w, w); ruido(g, w, w, 14000, ['#8c8e8a', '#a6a8a3', '#7f817d', '#b0b2ad'], 2.4);
        g.strokeStyle = '#787a76'; g.lineWidth = 3; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 512, 0); g.lineTo(i * 512, w); g.moveTo(0, i * 512); g.lineTo(w, i * 512); g.stroke(); }
        g.globalAlpha = 0.18; g.strokeStyle = '#3c3d3b'; g.lineWidth = 9; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(0, 150 + i * 190); g.bezierCurveTo(300, 120 + i * 190, 700, 190 + i * 190, w, 150 + i * 190); g.stroke(); } g.globalAlpha = 1;
    });
    horizontal(LARG, FUNDO, M('#ffffff', 0.55, 0.05, { map: repetir(betao, LARG / 12, FUNDO / 12) }), XM, 0, ZM);
    horizontal(30, 12, M('#b4b5b0', 0.9, 0, { map: repetir(betao.clone(), 3, 1) }), T.X1 + 15, -0.004, T.Z_VIA);                      // placa, para lá do portão
    const linha = (w, d, x, z, cor = AMARELO) => horizontal(w, d, M(cor, 0.75), x, 0.006, z);
    for (const z of [T.Z_VIA - 2.2, T.Z_VIA + 2.2]) linha(LARG - 6, 0.15, XM + 1, z);                                             // via dos tratores
    for (let x = T.X0 + 6; x < T.X1 - 2; x += 3.2) linha(1.5, 0.12, x, T.Z_VIA, '#f1f1ec');
    for (const z of [-19.6, -13.3, 9, 11]) linha(z < 0 ? 92 : 84, 0.12, z < 0 ? 0 : 1, z);                                         // corredores pedonais
    const zebra = tela(128, 128, (g) => { g.fillStyle = AMARELO; g.fillRect(0, 0, 128, 128); g.fillStyle = '#1b1b1b'; for (let i = -128; i < 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 - 128, 128); g.lineTo(i - 128, 128); g.fill(); } });
    const chao = (texto, x, z, w = 3.2, cor = '#f1f1ec') => { const t = tela(512, 128, (g) => { g.fillStyle = cor; g.font = 'bold 104px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texto, 256, 68); }); const m = horizontal(w, w / 4, new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.85 }), x, 0.008, z); return m; };

    // --- Paredes: painel sanduíche com faixa azul, embasamento em betão ----------
    const chapa = tela(256, 512, (g, w, h) => { g.fillStyle = '#e3e5e2'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, '#c9ccc9'); gr.addColorStop(0.12, '#eceeeb'); gr.addColorStop(0.9, '#dfe1de'); gr.addColorStop(1, '#bfc2bf'); g.fillStyle = gr; g.fillRect(x, 0, 32, h); } g.fillStyle = '#8f928e'; g.fillRect(0, h - 60, w, 60); g.fillStyle = '#1f4f9a'; g.fillRect(0, h - 190, w, 34); });
    const matParede = larg => M('#ffffff', 0.7, 0.15, { map: repetir(chapa.clone(), larg / 4, 1) });
    plano(LARG, A, matParede(LARG), XM, A / 2, T.Z0);                                                                             // fundo
    plano(FUNDO, A, matParede(FUNDO), T.X0, A / 2, ZM, Math.PI / 2);                                                              // poente (check-in)
    const zPortao = [T.Z_VIA - 3.6, T.Z_VIA + 3.6];                                                                              // nascente, com portão para a placa
    plano(zPortao[0] - T.Z0, A, matParede(zPortao[0] - T.Z0), T.X1, A / 2, (T.Z0 + zPortao[0]) / 2, -Math.PI / 2);
    plano(T.Z1 - zPortao[1], A, matParede(4), T.X1, A / 2, (T.Z1 + zPortao[1]) / 2, -Math.PI / 2);
    plano(7.2, A - 5.2, matParede(7.2), T.X1, (A + 5.2) / 2, T.Z_VIA, -Math.PI / 2);
    for (const z of zPortao) pintura.push(peca(cx(0.5, 5.4, 0.4), AMARELO, T.X1 - 0.1, 2.7, z));
    pintura.push(peca(cx(0.5, 0.5, 7.6), AMARELO, T.X1 - 0.1, 5.4, T.Z_VIA), peca(cx(0.25, 0.9, 7.2), '#c9cdd0', T.X1 - 0.05, 4.75, T.Z_VIA));   // portão seccionado recolhido

    // --- Estrutura metálica: pilares, pórticos e cobertura -----------------------
    const pilares = [];
    for (const x of [-54, -36, -18, 0, 18, 36]) for (const z of [-16.6, 10]) if (!(x === -54 && z < 0)) pilares.push([x, z]);
    for (const x of [-54, -36, -18, 0, 18, 36, 50]) pilares.push([x, T.Z0 + 0.4], [x, 31.5]);
    for (const [x, z] of pilares) {
        pintura.push(peca(cx(0.36, A, 0.04), '#c8ccce', x, A / 2, z), peca(cx(0.04, A, 0.36), '#c8ccce', x - 0.16, A / 2, z), peca(cx(0.04, A, 0.36), '#c8ccce', x + 0.16, A / 2, z));
        pintura.push(peca(cx(0.6, 1.1, 0.6), AMARELO, x, 0.55, z), peca(cx(0.62, 0.12, 0.62), '#1b1b1b', x, 0.36, z), peca(cx(0.62, 0.12, 0.62), '#1b1b1b', x, 0.78, z));
    }
    const pecasTeto = [];
    for (const x of [-54, -36, -18, 0, 18, 36, 50]) {                 // treliças transversais
        pecasTeto.push(peca(cx(0.22, 0.22, FUNDO - 2), '#bfc4c7', x, A - 0.2, ZM), peca(cx(0.18, 0.18, FUNDO - 2), '#bfc4c7', x, A - 1.5, ZM));
        for (let z = T.Z0 + 2; z < T.Z1 - 3; z += 4) pecasTeto.push(peca(cx(0.1, 1.9, 0.1), '#aeb3b6', x, A - 0.85, z + 2, ((z - T.Z0) / 4) % 2 < 1 ? 0.95 : -0.95));
    }
    for (const z of [-24, -16.6, -6, 4, 10, 20, 28]) pecasTeto.push(peca(cx(LARG - 4, 0.16, 0.16), '#b4b9bc', XM, A - 0.3, z));
    const matVertice = M('#ffffff', 0.55, 0.35, { vertexColors: true });
    add(fundir(pecasTeto), matVertice, 0, 0, 0, teto, false);
    const cobertura = horizontal(LARG, FUNDO, M('#d7dad8', 0.9), XM, A, ZM, teto); cobertura.rotation.x = Math.PI / 2;
    const luzMat = new THREE.MeshBasicMaterial({ color: '#fffbee' });
    for (let x = -57; x <= 48; x += 15) for (const z of [-20, -6, 8, 22]) {       // luminárias industriais suspensas
        add(cx(2.4, 0.12, 0.5), M('#e8eaea', 0.5, 0.3), x, 7.6, z, central, false); const l = horizontal(2.2, 0.36, luzMat, x, 7.53, z); l.rotation.x = Math.PI / 2;
        for (const k of [-1, 1]) add(cil(0.012, 0.012, A - 7.7, 4), M(ACO_ESC), x + k * 1.0, (A + 7.66) / 2, z, teto, false);
    }

    // --- Rede de tapetes ----------------------------------------------------------
    const tapeteTex = tela(128, 256, (g) => { g.fillStyle = '#25272a'; g.fillRect(0, 0, 128, 256); ruido(g, 128, 256, 900, ['#1b1c1f', '#34373b', '#2c2e31'], 1.3); g.fillStyle = '#15161800'; g.fillStyle = '#3d4044'; for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 128, 2); g.fillStyle = '#5a5e63'; for (let y = 0; y < 256; y += 128) g.fillRect(0, y, 128, 4); g.fillStyle = '#4a4d51'; g.fillRect(60, 0, 3, 256); });
    const trocos = {}, matRota = {};
    for (const s of ['S01', 'S02', 'S03', 'S04']) matRota[s] = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const matAvaria = new THREE.MeshBasicMaterial({ color: '#ff2a1a', toneMapped: false, side: THREE.DoubleSide });
    const matFarol = () => M('#4d5357', 0.4, 0, { emissive: '#27c152', emissiveIntensity: 1.4 });
    Object.entries(CAMINHOS).forEach(([codigo, cam], indice) => {
        const [origem, destino] = codigo.split('>');
        const tex = repetir(tapeteTex.clone(), 1, 1), mat = M('#ffffff', 0.82, 0.02, { map: tex });
        const sup = add(fita(cam, -0.5, 0, 0.5, 0, 0.5), mat, 0, 0, 0, central, false);
        estrutura.push([fita(cam, -0.57, -0.16, -0.57, 0.27), ACO], [fita(cam, 0.57, -0.16, 0.57, 0.27), ACO], [fita(cam, -0.57, -0.16, 0.57, -0.16), ACO_ESC]);
        estrutura.push([fita(cam, -0.6, 0.27, -0.54, 0.27), '#d9dde0'], [fita(cam, 0.54, 0.27, 0.6, 0.27), '#d9dde0']);
        // pernas em aço galvanizado, com travessa e sapatas
        const p = {}, n = Math.max(1, Math.round(cam.comp / 3.2));
        for (let k = 0; k <= n; k++) {
            const d = 0.9 + (cam.comp - 1.8) * k / n; cam.em(d, p); const h = p.y - 0.16; if (h < 0.3) continue;
            const hz = Math.hypot(p.tx, p.tz) || 1, lx = -p.tz / hz, lz = p.tx / hz;
            for (const s of [-1, 1]) { pintura.push(peca(cx(0.08, h, 0.08), ACO, p.x + lx * 0.5 * s, h / 2, p.z + lz * 0.5 * s)); pintura.push(peca(cx(0.22, 0.02, 0.22), ACO_ESC, p.x + lx * 0.5 * s, 0.01, p.z + lz * 0.5 * s)); }
            const tr = cx(1.0, 0.06, 0.06); pintura.push(peca(tr, ACO_ESC, p.x, Math.min(h - 0.3, 0.45), p.z, 0, Math.atan2(-lz, lx)));
            if (h > 1.6) { const dg = cx(Math.hypot(1.0, h - 0.9), 0.04, 0.04); pintura.push(peca(dg, ACO_ESC, p.x, (h + 0.45) / 2, p.z, 0, Math.atan2(-lz, lx), Math.atan2(h - 0.9, 1.0))); }
        }
        // grupo motor a meio do troço e coluna de comando com farol, no chão
        cam.em(cam.comp * 0.5, p); const hz = Math.hypot(p.tx, p.tz) || 1, lx = -p.tz / hz, lz = p.tx / hz, lado = (indice % 2 ? 1 : -1), rumo = Math.atan2(-p.tz, p.tx);
        pintura.push(peca(cx(0.7, 0.34, 0.36), AZUL, p.x + lx * 0.2 * lado, p.y - 0.36, p.z + lz * 0.2 * lado, 0, rumo), peca(cil(0.14, 0.14, 0.46, 12), '#33414f', p.x + lx * 0.62 * lado, p.y - 0.36, p.z + lz * 0.62 * lado, 0, rumo, Math.PI / 2));
        const px = p.x + lx * 1.25 * lado, pz = p.z + lz * 1.25 * lado, alto = origem === 'RET' || p.y < 1.4 ? 0 : 0;
        pintura.push(peca(cx(0.09, 1.35, 0.09), ACO_ESC, px, 0.675 + alto, pz), peca(cx(0.3, 0.42, 0.16), '#d7dadb', px, 1.2, pz, 0, rumo), peca(cil(0.05, 0.05, 0.05, 10), '#c81e1e', px + lz * 0.09 * lado * 0, 1.2, pz, 0, 0, 0), peca(cx(0.24, 0.02, 0.24), ACO_ESC, px, 0.01, pz));
        const farol = add(cil(0.07, 0.07, 0.2, 12), matFarol(), px, 1.53, pz, central, false); add(cil(0.08, 0.08, 0.03, 12), M(GRAFITE), px, 1.65, pz, central, false);
        // fotocélulas no fim do troço
        cam.em(cam.comp - 1.5, p); const h2 = Math.hypot(p.tx, p.tz) || 1;
        for (const s of [-1, 1]) pintura.push(peca(cx(0.06, 0.12, 0.06), s > 0 ? '#111' : '#b3261e', p.x - p.tz / h2 * 0.63 * s, p.y + 0.34, p.z + p.tx / h2 * 0.63 * s));
        // fitas luminosas das rotas (uma por saída), por cima da guarda
        const fitasRota = {};
        ['S01', 'S02', 'S03', 'S04'].forEach((s, k) => { const m = add(fita(cam, 0.63 + k * 0.085, 0.3, 0.7 + k * 0.085, 0.3), matRota[s], 0, 0, 0, central, false); m.visible = false; m.material.side = THREE.DoubleSide; fitasRota[s] = m; });
        // sinalização de avaria: guardas a vermelho e aviso por cima do troço (só aparece enquanto o troço está parado)
        const avaria = new THREE.Group(); avaria.visible = false; central.add(avaria);
        for (const s of [-1, 1]) add(fita(cam, s * 0.57 - 0.07, 0.285, s * 0.57 + 0.07, 0.285), matAvaria, 0, 0, 0, avaria, false);
        cam.em(cam.comp * 0.5, p);
        const texAviso = tela(512, 128, (g) => { g.fillStyle = '#b3160c'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 116); g.fillStyle = '#ffd21f'; g.beginPath(); g.moveTo(62, 22); g.lineTo(108, 104); g.lineTo(16, 104); g.closePath(); g.fill(); g.fillStyle = '#1b1b1b'; g.font = 'bold 60px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 62, 74); g.fillStyle = '#ffffff'; g.font = 'bold 40px Arial, sans-serif'; g.fillText('AVARIA', 310, 42); g.font = 'bold 44px Arial, sans-serif'; g.fillText(`${origem} → ${destino}`, 310, 92); });
        const aviso = new THREE.Sprite(new THREE.SpriteMaterial({ map: texAviso, toneMapped: false })); aviso.scale.set(3.8, 0.95, 1); aviso.position.set(p.x, p.y + 1.55, p.z); avaria.add(aviso);
        trocos[codigo] = { origem, destino, tex, mat, farol, fitasRota, avaria, comp: cam.comp, pedestal: [px, pz] };
    });

    // Mesas de transferência nos nós, com braço desviador e placa suspensa com o código do nó
    const placaNo = (texto, cor) => tela(256, 128, (g) => { g.fillStyle = cor; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 116); g.fillStyle = '#ffffff'; g.font = `bold ${texto.length > 4 ? 46 : 76}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texto, 128, 68); });
    const rolos = tela(128, 128, (g) => { g.fillStyle = '#7d8388'; g.fillRect(0, 0, 128, 128); for (let y = 0; y < 128; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#5d6266'); gr.addColorStop(0.45, '#e2e6e8'); gr.addColorStop(1, '#5d6266'); g.fillStyle = gr; g.fillRect(0, y, 128, 14); } });
    const matRolos = M('#ffffff', 0.35, 0.8, { map: repetir(rolos, 1, 2) });
    const nos = {};
    const CORES_NO = { desviador: '#1f4f9a', leitor: '#b7791f', saida: '#1f8a4c', inspecao: '#b0461c', retorno: '#5b3f8c', entrada: '#30363b' };
    const tipoNo = c => c === 'LEITOR' ? 'leitor' : c === 'INSPECAO' ? 'inspecao' : c === 'RET' ? 'retorno' : c[0] === 'S' ? 'saida' : c[0] === 'C' ? 'entrada' : 'desviador';
    for (const [codigo, [x, y, z]] of Object.entries(NOS)) {
        const tipo = tipoNo(codigo), no = nos[codigo] = { x, y, z, tipo };
        if (tipo === 'desviador' || tipo === 'retorno' || tipo === 'leitor') {
            const lado = tipo === 'leitor' ? 2.5 : 1.7;
            add(cx(lado, 0.2, lado), M(ACO_ESC, 0.5, 0.6), x, y - 0.1, z); horizontal(lado - 0.12, lado - 0.12, matRolos, x, y + 0.004, z);
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) pintura.push(peca(cx(0.1, y - 0.2, 0.1), ACO, x + sx * (lado / 2 - 0.08), (y - 0.2) / 2, z + sz * (lado / 2 - 0.08)));
        }
        if (tipo === 'desviador') {                     // braço que empurra a mala para a transversal ou para a rampa (sempre para +z)
            const braco = new THREE.Group(); braco.position.set(x + 0.92, y + 0.14, z - 0.92); central.add(braco);
            add(cx(1.35, 0.16, 0.07), M(AMARELO, 0.5, 0.2), 0.68, 0, 0, braco); add(cil(0.09, 0.09, 0.3, 12), M(GRAFITE, 0.5, 0.4), 0, 0, 0, braco);
            pintura.push(peca(cx(0.3, 0.36, 0.3), '#33414f', x + 0.92, y - 0.02, z - 1.1));
            no.braco = braco;
        }
        if (tipo !== 'entrada') {                       // placa suspensa da cobertura, com duas faces
            const tex = placaNo(codigo === 'INSPECAO' ? 'INSPEÇÃO' : codigo, CORES_NO[tipo]), alto = tipo === 'saida' || tipo === 'inspecao' ? 4.4 : 5.2, zp = tipo === 'saida' ? z - 5.5 : tipo === 'inspecao' ? z - 4 : z;
            for (const k of [1, -1]) plano(1.7, 0.85, new THREE.MeshBasicMaterial({ map: tex }), x, alto, zp + k * 0.035, k > 0 ? 0 : Math.PI);
            add(cx(1.78, 0.93, 0.05), M(GRAFITE, 0.6), x, alto, zp, central, false);
            for (const k of [-0.7, 0.7]) add(cil(0.015, 0.015, A - alto - 0.45, 4), M(ACO_ESC), x + k, (A + alto + 0.45) / 2, zp, teto, false);
        }
    }

    // Portal de leitura de etiquetas (leitura a 360°) sobre o nó LEITOR
    {
        const [x, y, z] = NOS.LEITOR, g = new THREE.Group(); g.position.set(x, 0, z); central.add(g);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cx(0.16, y + 2.0, 0.16), M('#e9ebec', 0.5, 0.3), sx * 1.55, (y + 2.0) / 2, sz * 1.55, g);
        for (const s of [-1, 1]) { add(cx(3.26, 0.2, 0.2), M(AMARELO, 0.5, 0.2), 0, y + 1.9, s * 1.55, g); add(cx(0.2, 0.2, 3.26), M(AMARELO, 0.5, 0.2), s * 1.55, y + 1.9, 0, g); }
        const cab = M('#15181b', 0.4, 0.3), janela = new THREE.MeshBasicMaterial({ color: '#ff3b30', toneMapped: false });
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, c = new THREE.Group(); c.position.set(Math.cos(a) * 1.3, y + 1.72, Math.sin(a) * 1.3); c.rotation.y = -a; g.add(c); add(cx(0.3, 0.26, 0.5), cab, 0, 0, 0, c).rotation.z = 0.6; const j = add(cx(0.02, 0.07, 0.34), janela, -0.13, -0.09, 0, c, false); j.rotation.z = 0.6; }
        add(cx(0.5, 0.26, 0.5), cab, 0, y + 1.86, 0, g);
        const feixe = add(new THREE.ConeGeometry(1.05, 1.55, 4, 1, true), new THREE.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }), 0, y + 0.95, 0, g, false); feixe.rotation.y = Math.PI / 4;
        const luz = add(cil(0.11, 0.11, 0.26, 14), M('#555a5e', 0.4, 0, { emissive: '#27c152', emissiveIntensity: 0 }), 1.55, y + 2.2, 1.55, g, false);
        const ecCanvas = document.createElement('canvas'); ecCanvas.width = 512; ecCanvas.height = 256; const ecTex = new THREE.CanvasTexture(ecCanvas); ecTex.colorSpace = THREE.SRGBColorSpace;
        add(cx(1.7, 0.9, 0.1), M(GRAFITE, 0.6), 0, y + 2.75, 1.62, g, false); plano(1.6, 0.8, new THREE.MeshBasicMaterial({ map: ecTex }), 0, y + 2.75, 1.68, 0, g);
        nos.LEITOR.luz = luz; nos.LEITOR.feixe = feixe; nos.LEITOR.ecra = { canvas: ecCanvas, tex: ecTex, chave: '' };
    }

    // --- Passadiço de manutenção ao longo da linha A, com guardas amarelas e escadas ---
    {
        const z0 = -13.0, z1 = -11.6, x0 = -39, x1 = 37, yp = 1.25;
        const grelha = tela(64, 64, (g) => { g.fillStyle = '#5e6468'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#2f3336'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) g.fillRect(i * 16 + 3, j * 16 + 3, 10, 10); });
        horizontal(x1 - x0, z1 - z0, M('#ffffff', 0.6, 0.5, { map: repetir(grelha, (x1 - x0) * 2, 3) }), (x0 + x1) / 2, yp, (z0 + z1) / 2);
        pintura.push(peca(cx(x1 - x0, 0.12, 0.08), ACO_ESC, (x0 + x1) / 2, yp - 0.07, z0), peca(cx(x1 - x0, 0.12, 0.08), ACO_ESC, (x0 + x1) / 2, yp - 0.07, z1));
        for (let x = x0; x <= x1 + 0.1; x += 3.8) { for (const z of [z0, z1]) pintura.push(peca(cx(0.09, yp, 0.09), ACO, x, yp / 2, z)); pintura.push(peca(cx(0.05, 1.1, 0.05), AMARELO, x, yp + 0.55, z0)); }
        for (const h of [0.55, 1.1]) pintura.push(peca(cx(x1 - x0, 0.05, 0.05), AMARELO, (x0 + x1) / 2, yp + h, z0));
        pintura.push(peca(cx(x1 - x0, 0.12, 0.02), '#3c4246', (x0 + x1) / 2, yp + 0.06, z0 + 0.03));
        for (const [xe, s] of [[x0, -1], [x1, 1]]) {     // escadas nos dois extremos
            for (let k = 0; k < 6; k++) pintura.push(peca(cx(0.28, 0.04, z1 - z0 - 0.1), '#5e6468', xe + s * (0.2 + k * 0.3), yp - 0.2 * (k + 0.5), (z0 + z1) / 2));
            for (const z of [z0, z1]) { const c = cx(2.2, 0.06, 0.06); pintura.push(peca(c, AMARELO, xe + s * 1.0, yp + 0.38, z, 0, 0, -s * 0.6)); pintura.push(peca(cx(0.05, 1.0, 0.05), AMARELO, xe + s * 1.85, 0.5, z)); }
        }
    }

    // --- Caminhos de cabos e quadros elétricos ---------------------------------------
    for (const z of [ZA - 1.9, ZB + 1.9]) { pintura.push(peca(cx(90, 0.05, 0.45), '#9aa0a4', -1, 5.9, z)); for (const k of [-1, 1]) pintura.push(peca(cx(90, 0.1, 0.03), '#b7bcbf', -1, 5.93, z + k * 0.23)); for (let x = -44; x <= 42; x += 6) pintura.push(peca(cx(0.03, A - 6.2, 0.03), ACO_ESC, x, (A + 5.9) / 2 - 0.15, z)); }
    for (let k = 0; k < 14; k++) {                       // quadros de comando encostados à parede do fundo
        const x = -34 + k * 1.25; pintura.push(peca(cx(1.15, 2.1, 0.55), k % 5 === 4 ? '#c9cdd0' : '#dfe2e3', x, 1.15, T.Z0 + 0.5), peca(cx(1.2, 0.1, 0.6), ACO_ESC, x, 0.05, T.Z0 + 0.5), peca(cx(0.04, 0.3, 0.04), '#1b1b1b', x + 0.4, 1.2, T.Z0 + 0.79));
        pintura.push(peca(cx(0.5, 0.22, 0.02), '#11161b', x - 0.1, 1.75, T.Z0 + 0.79), peca(cx(0.07, 0.07, 0.03), ['#27c152', '#e8b90f', '#27c152', '#c81e1e'][k % 4], x - 0.3, 1.45, T.Z0 + 0.79), peca(cx(0.07, 0.07, 0.03), '#27c152', x - 0.15, 1.45, T.Z0 + 0.79));
    }

    // --- Sala de controlo (SCADA) com sinótico mural -------------------------------------
    const sinCanvas = document.createElement('canvas'); sinCanvas.width = 1920; sinCanvas.height = 640; const sinTex = new THREE.CanvasTexture(sinCanvas); sinTex.colorSpace = THREE.SRGBColorSpace; sinTex.anisotropy = 8;
    add(cx(15.6, 5.4, 0.25), M(GRAFITE, 0.6), 9, 6.3, T.Z0 + 0.75, central, false); plano(15, 5, new THREE.MeshBasicMaterial({ map: sinTex }), 9, 6.3, T.Z0 + 0.89);
    let alarme;
    {
        const x = 9, z = T.Z0 + 3.2;                     // cabina envidraçada debaixo do sinótico
        add(cx(11, 0.25, 5.6), M('#c9cdd0', 0.7), x, 3.3, z - 0.4); add(cx(11, 0.5, 0.2), M(AZUL, 0.5, 0.2), x, 0.25, z + 2.3);
        const vidro = M('#9fc4cf', 0.08, 0.1, { transparent: true, opacity: 0.3, side: THREE.DoubleSide });
        plano(11, 2.7, vidro, x, 1.85, z + 2.3); for (const s of [-1, 1]) plano(5.4, 2.7, vidro, x + s * 5.5, 1.85, z - 0.4, Math.PI / 2);
        for (let k = -5.5; k <= 5.5; k += 2.75) pintura.push(peca(cx(0.1, 3.2, 0.1), '#e9ebec', x + k, 1.6, z + 2.3));
        pintura.push(peca(cx(8, 0.06, 1.1), '#d9dcdd', x, 0.78, z + 0.6), peca(cx(7.8, 0.74, 0.06), '#aeb3b6', x, 0.39, z + 0.1));
        // monitores da consola: recortes ao vivo do mesmo ecrã SCADA do mural (sinótico, alarmes, partidas e tendência)
        const matMon = new THREE.MeshBasicMaterial({ map: sinTex }), RECORTES = [[20, 120, 700, 400], [560, 120, 700, 400], [80, 0, 1120, 640], [1267, 54, 645, 369], [1267, 262, 645, 369]];
        [-3, -1.5, 0, 1.5, 3].forEach((k, i) => {
            add(cx(1.2, 0.72, 0.05), M('#15181b', 0.5), x + k, 1.35, z + 0.75, central, false); pintura.push(peca(cx(0.08, 0.3, 0.08), '#33414f', x + k, 0.95, z + 0.78));
            const m = plano(1.12, 0.64, matMon, x + k, 1.35, z + 0.78, 0), [rx, ry, rw, rh] = RECORTES[i], uv = m.geometry.attributes.uv, u0 = rx / 1920, u1 = (rx + rw) / 1920, v1 = 1 - ry / 640, v0 = 1 - (ry + rh) / 640;
            uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
        });
        alarme = add(cil(0.16, 0.16, 0.34, 14), M('#5a1a16', 0.4, 0, { emissive: '#ff2a1a', emissiveIntensity: 0 }), x + 5.1, 3.6, z + 2.1, central, false); pintura.push(peca(cil(0.2, 0.2, 0.06, 14), '#2a3138', x + 5.1, 3.44, z + 2.1));
    }

    // --- Entradas do check-in na parede poente -----------------------------------------
    const sinal = (linhas, cor = '#1f2937') => tela(1024, 256, (g, W, H) => { g.fillStyle = cor; g.fillRect(0, 0, W, H); g.fillStyle = '#ffd21f'; g.font = 'bold 84px Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText(linhas[0], 44, 86); g.fillStyle = '#ffffff'; g.font = '56px Arial, sans-serif'; g.fillText(linhas[1], 44, 186); });
    for (const [codigo, z] of [['C1', -16], ['C2', -4]]) {
        add(cx(0.3, 1.5, 2.2), M('#101418', 0.9), T.X0 + 0.1, 6.15, z, central, false);
        for (const k of [-1.1, 1.1]) pintura.push(peca(cx(0.4, 1.7, 0.14), '#c6cacc', T.X0 + 0.15, 6.15, z + k)); pintura.push(peca(cx(0.4, 0.14, 2.34), '#c6cacc', T.X0 + 0.15, 6.97, z));
        for (let i = 0; i < 8; i++) plano(0.24, 0.85, M('#22262a', 0.6, 0, { transparent: true, opacity: 0.82, side: THREE.DoubleSide }), T.X0 + 0.32 + 0.02 * (i % 2), 6.5, z - 0.9 + i * 0.26, Math.PI / 2);
        plano(6.4, 1.1, new THREE.MeshBasicMaterial({ map: sinal([`${codigo} · Check-in ${codigo === 'C1' ? 'balcões 1–20' : 'balcões 21–40'}`, 'Bagagem de porão · Partidas'], '#30363b') }), T.X0 + 0.12, 8.0, z, Math.PI / 2);
    }
    plano(9, 0.85, new THREE.MeshBasicMaterial({ map: sinal(['Placa  →', 'Apron · Carregamento dos aviões'], '#30363b') }), T.X1 - 0.12, 6.6, 17, -Math.PI / 2);
    plano(11, 1.0, new THREE.MeshBasicMaterial({ map: sinal(['Central de triagem · Partidas', 'Acesso reservado · Staff only'], '#1f2937') }), -30, 7.2, T.Z0 + 0.12);
    plano(8, 0.75, new THREE.MeshBasicMaterial({ map: sinal(['Retorno · Recirculação', 'Malas sem rota voltam ao leitor'], '#5b3f8c') }), -18, 4.9, ZR - 1.3);
    plano(7, 0.66, new THREE.MeshBasicMaterial({ map: sinal(['Linha A · Principal', 'A1 → A2 → A3 → A4'], AZUL) }), 0, 4.9, ZA - 0.05).position.y = 5.55;
    plano(7, 0.66, new THREE.MeshBasicMaterial({ map: sinal(['Linha B · Distribuição', 'B1 → B2 → B3 → B4'], AZUL) }), 0, 5.55, ZB + 2.12);

    // --- Saídas: rampa, mesa de preparação, ecrã do voo e cais dos reboques ---------------
    const saidas = {};
    XS.forEach((x, i) => {
        const codigo = 'S0' + (i + 1);
        add(cx(1.5, 0.5, 0.12), M(ACO, 0.4, 0.7), x, YS + 0.12, 17.62);                                   // batente no fim da mesa
        add(cx(3.6, 0.08, 1.5), matRolos, x + 2.5, YS - 0.06, 16.2); for (const k of [-1.6, 1.6]) for (const q of [-0.6, 0.6]) pintura.push(peca(cx(0.07, YS - 0.1, 0.07), ACO, x + 2.5 + k, (YS - 0.1) / 2, 16.2 + q));
        horizontal(11.6, 0.4, M('#fff', 0.8, 0, { map: repetir(zebra.clone(), 26, 1) }), x - 0.15, 0.009, T.Z_CAIS - 1.25);
        horizontal(11.6, 0.4, M('#fff', 0.8, 0, { map: repetir(zebra.clone(), 26, 1) }), x - 0.15, 0.009, T.Z_CAIS + 1.25);
        chao(codigo, x - 0.15, T.Z_CAIS + 2.3, 3.4, AMARELO);
        for (const k of [-6.4, 6.1]) { pintura.push(peca(cil(0.09, 0.09, 1.0, 10), AMARELO, x + k, 0.5, 19.2), peca(cil(0.095, 0.095, 0.12, 10), '#1b1b1b', x + k, 0.8, 19.2)); }
        // palete das malas que chegaram à saída errada
        pintura.push(peca(cx(2.4, 0.14, 2.0), '#a47a45', x - 4.6, 0.07, 15.6), peca(cx(2.5, 0.02, 2.1), '#c81e1e', x - 4.6, 0.012, 15.6));
        // ecrã do voo, suspenso e virado para o cais
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 288; const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
        const e = new THREE.Group(); e.position.set(x + 2.6, 3.5, 18.4); e.rotation.x = 0.12; central.add(e);
        add(cx(2.5, 1.45, 0.1), M(GRAFITE, 0.6), 0, 0, 0, e, false); plano(2.36, 1.33, new THREE.MeshBasicMaterial({ map: tex }), 0, 0, 0.06, 0, e);
        for (const k of [-0.9, 0.9]) add(cil(0.02, 0.02, A - 4.3, 4), M(ACO_ESC), x + 2.6 + k, (A + 4.2) / 2, 18.3, teto, false);
        saidas[codigo] = { x, indice: i, canvas, tex, chave: '' };
    });

    // --- Posto de inspeção: leitura manual de etiquetas --------------------------------
    {
        const x = XL, z = 12;
        add(cx(1.5, 0.5, 0.12), M(ACO, 0.4, 0.7), x, YS + 0.12, z + 0.62);
        add(cx(5.2, 0.08, 1.2), matRolos, x + 3.5, YS - 0.06, z - 0.6); for (const k of [-2.4, 0, 2.4]) for (const q of [-0.5, 0.5]) pintura.push(peca(cx(0.07, YS - 0.1, 0.07), ACO, x + 3.5 + k, (YS - 0.1) / 2, z - 0.6 + q));
        pintura.push(peca(cx(2.2, 0.06, 0.9), '#d9dcdd', x + 3.2, 0.92, z + 1.6), peca(cx(2.1, 0.9, 0.06), '#aeb3b6', x + 3.2, 0.46, z + 2.0), peca(cx(0.9, 0.56, 0.05), '#15181b', x + 3.2, 1.36, z + 1.9), peca(cx(0.08, 0.2, 0.08), '#33414f', x + 3.2, 1.03, z + 1.9));
        plano(0.84, 0.5, new THREE.MeshBasicMaterial({ map: tela(256, 152, (g, w, h) => { g.fillStyle = '#0b1b33'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd21f'; g.font = 'bold 24px Arial'; g.fillText('LEITURA MANUAL', 14, 34); g.fillStyle = '#fff'; g.font = '18px Arial'; g.fillText('Etiqueta: ilegível', 14, 74); g.fillText('Voo: ?', 14, 104); g.fillStyle = '#b0461c'; g.fillRect(14, 118, 228, 20); }) }), x + 3.2, 1.36, z + 1.87, Math.PI);
        for (const [dx, dz] of [[-4.2, -1.5], [8.2, -1.5], [-4.2, 9.5], [8.2, 9.5]]) pintura.push(peca(cil(0.05, 0.05, 1.0, 8), AMARELO, x + dx, 0.5, z + dz), peca(cx(0.3, 0.03, 0.3), '#1b1b1b', x + dx, 0.015, z + dz));
        plano(6.4, 0.78, new THREE.MeshBasicMaterial({ map: sinal(['Inspeção · Leitura manual', 'Etiquetas ilegíveis e malas sem voo'], '#b0461c') }), x + 2, 3.2, z + 3.2, Math.PI);
        for (const k of [-2.8, 2.8]) add(cil(0.03, 0.03, 3.6, 6), M(ACO_ESC), x + 2 + k, 1.8, z + 3.24, central, false);
        linha(12.6, 0.12, x + 2, z - 1.5); linha(12.6, 0.12, x + 2, z + 9.5); linha(0.12, 11, x - 4.2, z + 4); linha(0.12, 11, x + 8.2, z + 4);
        chao('INSPEÇÃO', x + 2, z + 8.4, 5.6, AMARELO);
    }

    // --- Equipamento solto: extintores, contentores e empilhador ---------------------------
    for (const [x, z] of [[-36, 10.6], [0, 10.6], [36, 10.6], [-18, -17.2], [18, -17.2]]) pintura.push(peca(cil(0.09, 0.09, 0.5, 10), '#c81e1e', x + 0.45, 1.35, z), peca(cx(0.4, 0.4, 0.02), '#c81e1e', x + 0.45, 2.0, z + 0.2), peca(cil(0.03, 0.03, 0.12, 6), '#1b1b1b', x + 0.45, 1.65, z));
    for (const [x, z, cor] of [[47, -24, '#d9dde0'], [47, -21.2, '#d9dde0'], [49.2, -24, '#c2c7cb'], [-60, 26, '#d9dde0'], [-57.6, 26, '#c2c7cb']]) {   // contentores de porão vazios
        pintura.push(peca(cx(2.0, 1.6, 1.5), cor, x, 0.95, z), peca(cx(2.04, 0.1, 1.54), ACO_ESC, x, 0.1, z), peca(cx(2.04, 0.06, 1.54), ACO_ESC, x, 1.76, z), peca(cx(0.02, 1.2, 1.1), '#1f4f9a', x + 1.01, 0.95, z));
    }
    {
        const x = -58, z = 21;                           // empilhador estacionado
        pintura.push(peca(caixaRedonda(1.9, 0.7, 1.1, 0.1), '#e8a112', x, 0.3, z), peca(cx(0.9, 0.9, 0.9), '#22262a', x - 0.2, 1.4, z), peca(cx(1.0, 0.06, 1.0), '#22262a', x - 0.2, 2.1, z), peca(cx(0.1, 2.3, 0.1), '#33414f', x + 0.95, 1.2, z - 0.4), peca(cx(0.1, 2.3, 0.1), '#33414f', x + 0.95, 1.2, z + 0.4));
        for (const k of [-0.3, 0.3]) pintura.push(peca(cx(1.1, 0.05, 0.12), '#9aa0a4', x + 1.55, 0.12, z + k));
        for (const [dx, dz] of [[-0.6, 0.5], [0.6, 0.5], [-0.6, -0.5], [0.6, -0.5]]) pintura.push(peca(cil(0.26, 0.26, 0.2, 14), '#151515', x + dx, 0.26, z + dz, Math.PI / 2));
    }

    const matEstrutura = M('#ffffff', 0.45, 0.6, { vertexColors: true, side: THREE.DoubleSide });
    add(fundir(estrutura), matEstrutura); add(fundir(pintura), matVertice);

    // --- Pessoal e veículos ---------------------------------------------------------------
    const matPessoas = M('#ffffff', 0.8, 0, { vertexColors: true });
    const pessoa = (semente, x, y, z, ry) => { const m = add(geometriaPessoa(semente, true), matPessoas, x, y, z); m.rotation.y = ry; return m; };
    const operadores = XS.flatMap((x, i) => [pessoa(700 + i, x + 1.05, 0, 18.5, Math.PI * 0.85), pessoa(720 + i, x - 1.0, 0, 18.9, -Math.PI * 0.85)]);
    pessoa(741, XL + 3.2, 0, 15.1, Math.PI); pessoa(742, 7.5, 0, T.Z0 + 4.6, Math.PI); pessoa(743, 10.6, 0, T.Z0 + 4.6, Math.PI); pessoa(744, 12, 1.25, -12.3, Math.PI / 2);
    const tecnico = pessoa(745, 0, 0, 0, 0); tecnico.visible = false;
    const caixaFerramentas = add(fundir([peca(cx(0.5, 0.26, 0.24), '#c81e1e', 0, 0.13, 0), peca(cx(0.3, 0.03, 0.03), '#1b1b1b', 0, 0.3, 0)]), matVertice); caixaFerramentas.visible = false;
    const geoReboque = fundir([peca(cx(3.0, 0.1, 1.5), '#8b9196', 0, 0.56, 0), peca(cx(2.9, 0.06, 0.08), '#5d6266', 0, 0.48, 0.6), peca(cx(2.9, 0.06, 0.08), '#5d6266', 0, 0.48, -0.6),
        ...[-1.47, 1.47].flatMap(x => [peca(cx(0.05, 0.9, 1.5), AMARELO, x, 1.05, 0), peca(cx(0.05, 0.05, 1.5), AMARELO, x, 1.5, 0)]), peca(cx(3.0, 0.05, 0.05), AMARELO, 0, 1.5, -0.74),
        ...[[-1.05, 0.62], [1.05, 0.62], [-1.05, -0.62], [1.05, -0.62]].map(([x, z]) => peca(cil(0.2, 0.2, 0.14, 12), '#151515', x, 0.2, z, Math.PI / 2)), peca(cx(0.7, 0.05, 0.06), '#5d6266', 1.85, 0.42, 0)]);
    const geoTrator = fundir([peca(caixaRedonda(2.1, 0.62, 1.15, 0.1), '#f2f2ee', 0, 0.28, 0), peca(caixaRedonda(0.9, 0.5, 1.0, 0.08), '#f2f2ee', 0.55, 0.88, 0), peca(cx(0.05, 0.85, 1.0), '#22262a', -0.3, 1.3, 0), peca(cx(1.0, 0.05, 1.1), '#f2f2ee', -0.05, 1.74, 0),
        ...[-0.5, 0.5].map(z => peca(cx(0.05, 0.85, 0.05), '#22262a', 0.2, 1.3, z)), peca(caixaRedonda(0.5, 0.4, 0.8, 0.06), '#33414f', -0.4, 0.88, 0), peca(cil(0.07, 0.07, 0.1, 10), '#f39c12', -0.05, 1.82, 0),
        peca(cx(2.14, 0.12, 0.3), AMARELO, 0, 0.36, 0.44), peca(cx(2.14, 0.12, 0.3), AMARELO, 0, 0.36, -0.44), ...[[-0.68, 0.58], [0.68, 0.58], [-0.68, -0.58], [0.68, -0.58]].map(([x, z]) => peca(cil(0.27, 0.27, 0.2, 14), '#151515', x, 0.27, z, Math.PI / 2))]);
    const matVeiculos = M('#ffffff', 0.6, 0.2, { vertexColors: true });
    const novoReboque = () => add(geoReboque, matVeiculos), novoTrator = () => add(geoTrator, matVeiculos);

    // --- Luz ----------------------------------------------------------------------------
    scene.add(new THREE.HemisphereLight('#ffffff', '#8f8d86', 1.15));
    const luz = new THREE.DirectionalLight('#fff6e6', 1.75); luz.position.set(-26, 52, 30); luz.target.position.set(-4, 0, 2); luz.castShadow = true; luz.shadow.mapSize.set(4096, 4096);
    Object.assign(luz.shadow.camera, { left: -72, right: 72, top: 48, bottom: -48, near: 5, far: 140 }); luz.shadow.bias = -0.0004; luz.shadow.normalBias = 0.05; scene.add(luz); scene.add(luz.target);

    return { central, teto, trocos, nos, saidas, matRota, matAvaria, sinotico: { canvas: sinCanvas, tex: sinTex, chave: '' }, alarme, operadores, tecnico, caixaFerramentas, novoReboque, novoTrator,
        matMalas: M('#ffffff', 0.55, 0.05, { vertexColors: true }), matPessoas };
}
