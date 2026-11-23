// Avião genérico de corredor único (porte de um A320 / 737), sem marcas comerciais.
// 1 unidade = 1 metro; o nariz aponta para -z e o centro da fuselagem fica a 4 m do chão, como no
// modelo anterior, para manter as posições, a câmara e as etiquetas do resto do simulador.
// A fuselagem é um sólido de revolução com nariz arredondado e cone de cauda; a pintura (janelas,
// para-brisas, faixa da companhia e ventre) é uma textura gerada no código, uma por cor.
// As geometrias são partilhadas por todos os aviões; os materiais, por cor.
import * as THREE from 'three';

const L = 38, R = 2, Y0 = 4;                                                      // comprimento, raio e altura do eixo
const S0 = -19, S1 = 19;                                                          // nariz e cauda ao longo de z
function raio(s) {                                                                // perfil da fuselagem
    const n = s - S0;
    if (n < 6) return R * Math.max(0, 1 - ((6 - n) / 6) ** 2) ** 0.62;            // nariz arredondado
    if (s < 7) return R;
    const t = (s - 7) / (S1 - 7);
    return R * (1 - 0.82 * t ** 1.35);
}

let geo = null;
function geometrias() {
    if (geo) return geo;
    // Fuselagem: pontos de meio em meio metro, para a textura correr em linha reta ao longo do avião.
    const pts = [];
    for (let s = S0; s <= S1 + 1e-6; s += 0.5) pts.push(new THREE.Vector2(Math.max(0.001, raio(s)), s));
    const fus = new THREE.LatheGeometry(pts, 40);
    fus.rotateX(Math.PI / 2);                                                     // o eixo do torno (y) passa a ser o z
    // a cauda sobe um pouco, como nos aviões reais (o ventre da cauda inclina para cima)
    const p = fus.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z > 6) p.setY(i, p.getY(i) + 0.95 * ((z - 6) / 13) ** 1.6); }
    fus.computeVertexNormals();
    fus.translate(0, Y0, 0);

    const planta = (pontos, espessura, bisel = 0.12) => {                      // superfície sustentadora com espessura e bordos suaves
        const sh = new THREE.Shape(); pontos.forEach(([x, z], i) => i ? sh.lineTo(x, z) : sh.moveTo(x, z)); sh.closePath();
        const g = new THREE.ExtrudeGeometry(sh, { depth: espessura, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2, curveSegments: 4 });
        g.rotateX(Math.PI / 2); g.translate(0, espessura / 2, 0); return g;      // forma no plano x-z, espessura em y
    };
    // Asa direita (x > 0): enflechamento de cerca de 25°, afilamento e corda grossa junto à fuselagem.
    const asa = planta([[0.8, -3.2], [6, -1.2], [16.6, 4.6], [17.1, 6.1], [6.2, 4.4], [0.8, 4.6]], 0.32, 0.14);
    const winglet = planta([[0, 0], [0.9, 0], [1.25, 1.8], [0.85, 1.9]], 0.12, 0.04); winglet.rotateX(-Math.PI / 2); winglet.rotateY(-Math.PI / 2);
    const estab = planta([[0.5, 13.4], [6.2, 16.6], [6.4, 17.9], [0.5, 17.7]], 0.18, 0.06);
    const deriva = new THREE.ExtrudeGeometry(new THREE.Shape([[11.6, 0], [18.3, 0], [18.9, 7.3], [16.4, 7.3]].map(([z, y]) => new THREE.Vector2(z, y))), { depth: 0.32, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
    deriva.rotateY(-Math.PI / 2); deriva.translate(0.16, Y0 + 1.4, 0);         // forma em (z, y), espessura em x
    // Motor: nacelle de revolução, entrada larga e saída estreita, com cone central.
    const nac = new THREE.LatheGeometry([[0.95, -2.4], [1.2, -2.3], [1.28, -1.6], [1.22, 0.4], [0.95, 1.5], [0.7, 1.9], [0.62, 1.9], [0.9, 1.4], [1.0, -1.6], [1.0, -2.3], [0.95, -2.4]].map(([r, z]) => new THREE.Vector2(r, z)), 28);
    nac.rotateX(Math.PI / 2);
    const fan = new THREE.CircleGeometry(1.0, 28); fan.translate(0, 0, 0); fan.rotateY(Math.PI); fan.translate(0, 0, -1.6);
    const cone = new THREE.ConeGeometry(0.32, 0.8, 16); cone.rotateX(-Math.PI / 2); cone.translate(0, 0, -1.95);
    const escape = new THREE.ConeGeometry(0.5, 1.1, 16); escape.rotateX(Math.PI / 2); escape.translate(0, 0, 2.3);
    const pilone = new THREE.BoxGeometry(0.32, 1.0, 3.6); pilone.translate(0, 0.95, 0.4);
    // Trem de aterragem
    const roda = new THREE.CylinderGeometry(0.55, 0.55, 0.38, 16); roda.rotateZ(Math.PI / 2);
    const rodaN = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 12); rodaN.rotateZ(Math.PI / 2);
    const perna = new THREE.CylinderGeometry(0.1, 0.12, 1, 8);
    const apu = new THREE.CylinderGeometry(0.18, 0.24, 0.5, 10); apu.rotateX(Math.PI / 2);
    const carenagem = new THREE.SphereGeometry(1, 20, 10); carenagem.scale(2.1, 0.75, 5.2);
    return geo = { fus, asa, winglet, estab, deriva, nac, fan, cone, escape, pilone, roda, rodaN, perna, apu, carenagem };
}

// Pintura da fuselagem. u dá a volta (0 = ventre, 0,5 = topo, 0,25 = lado direito), v corre do nariz (0) à cauda (1).
const pinturas = new Map();
function pintura(cor) {
    if (pinturas.has(cor)) return pinturas.get(cor);
    const W = 512, H = 2048, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const Y = s => H * (1 - (s - S0) / L), X = u => u * W;                     // a textura entra com flipY
    g.fillStyle = '#f4f5f2'; g.fillRect(0, 0, W, H);
    const ventre = g.createLinearGradient(0, 0, W, 0);                              // ventre cinzento claro, a fundir com o branco
    for (const [u, a] of [[0, 1], [0.13, 1], [0.2, 0], [0.8, 0], [0.87, 1], [1, 1]]) ventre.addColorStop(u, `rgba(196,201,206,${a})`);
    g.fillStyle = ventre; g.fillRect(0, 0, W, H);
    for (const lado of [1, -1]) {                                                    // faixa da companhia e janelas, nos dois lados
        const u = lado > 0 ? 0.25 : 0.75, du = d => u + lado * d;
        const faixa = (d0, d1, s0, s1) => { const a = X(Math.min(du(d0), du(d1))), b = X(Math.max(du(d0), du(d1))); g.fillRect(a, Y(s1), b - a, Y(s0) - Y(s1)); };
        g.fillStyle = cor; faixa(-0.075, -0.035, -14.5, 15.5);
        g.fillStyle = '#ffffff'; faixa(-0.035, -0.028, -14.5, 15.5);
        g.fillStyle = '#20282e';
        for (let s = -12.2; s < 12.5; s += 0.82) { if (Math.abs(s - 2.2) < 0.7) continue; const a = X(du(0.033)), b = X(du(0.058)); g.beginPath(); g.roundRect(Math.min(a, b), Y(s + 0.25), Math.abs(b - a), Y(s) - Y(s + 0.25), 3); g.fill(); }
        g.strokeStyle = '#aeb4b8'; g.lineWidth = 2;                                 // portas
        for (const s of [-13.6, 13.0]) { const a = X(du(-0.02)), b = X(du(0.07)); g.strokeRect(Math.min(a, b), Y(s + 0.85), Math.abs(b - a), Y(s) - Y(s + 0.85)); }
        g.fillStyle = '#16202a';                                                     // janelas laterais do cockpit
        const a = X(du(0.07)), b = X(du(0.12)); g.fillRect(Math.min(a, b), Y(-15.6), Math.abs(b - a), Y(-16.5) - Y(-15.6));
    }
    g.fillStyle = '#16202a'; g.fillRect(X(0.39), Y(-15.9), X(0.22), Y(-16.7) - Y(-15.9));   // para-brisas
    g.fillStyle = cor; g.fillRect(X(0.3), Y(S1), X(0.4), Y(13.5) - Y(S1));         // topo da cauda com a cor da companhia
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const m = { fus: new THREE.MeshStandardMaterial({ map: t, metalness: 0.15, roughness: 0.32 }), cor: new THREE.MeshStandardMaterial({ color: cor, metalness: 0.2, roughness: 0.4 }) };
    pinturas.set(cor, m); return m;
}
const comuns = {
    asa: new THREE.MeshStandardMaterial({ color: '#cfd3d6', metalness: 0.45, roughness: 0.38 }),
    nacelle: new THREE.MeshStandardMaterial({ color: '#e9ebea', metalness: 0.3, roughness: 0.3 }),
    escuro: new THREE.MeshStandardMaterial({ color: '#2a2f33', metalness: 0.5, roughness: 0.45 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9aa1a6', metalness: 0.8, roughness: 0.3 }),
    pneu: new THREE.MeshStandardMaterial({ color: '#1b1d1f', roughness: 0.9 }),
};

export function criarAviao(cor) {
    const G = geometrias(), P = pintura(cor), grupo = new THREE.Group();
    const add = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; grupo.add(o); return o; };
    add(G.fus, P.fus);
    add(G.carenagem, comuns.asa, 0, Y0 - 1.45, 0.9);                                 // carenagem asa-fuselagem
    add(G.deriva, P.cor);
    add(G.apu, comuns.escuro, 0, Y0 + 0.95, S1 + 0.1);
    for (const k of [-1, 1]) {
        const asa = add(G.asa, comuns.asa, 0, Y0 - 1.1, 0); asa.scale.x = k; asa.rotation.z = k * 0.075;   // diedro
        const wl = add(G.winglet, P.cor, k * 17.0, Y0 - 1.1 + 17 * 0.075 + 0.1, 5.5); wl.scale.x = k;
        const est = add(G.estab, comuns.asa, 0, Y0 + 0.75, 0); est.scale.x = k; est.rotation.z = k * 0.1;
        const x = k * 5.7, y = Y0 - 2.15;                                            // motor sob a asa
        add(G.nac, comuns.nacelle, x, y, -1.3); add(G.fan, comuns.escuro, x, y, -1.3); add(G.cone, comuns.metal, x, y, -1.3); add(G.escape, comuns.escuro, x, y, -1.3);
        add(G.pilone, comuns.asa, x, y, -1.3);
        for (const dx of [-0.25, 0.25]) add(G.roda, comuns.pneu, k * 2.6 + dx, 0.55, 1.6);
        const pm = add(G.perna, comuns.metal, k * 2.6, 1.6, 1.6); pm.scale.y = 2.2;
    }
    for (const dx of [-0.16, 0.16]) add(G.rodaN, comuns.pneu, dx, 0.38, -14.6);
    const pn = add(G.perna, comuns.metal, 0, 1.3, -14.6); pn.scale.y = 1.9;
    return grupo;
}
