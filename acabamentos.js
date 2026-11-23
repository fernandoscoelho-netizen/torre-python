// Acabamentos das salas 3D: dá textura e relevo fino ao mobiliário e aos equipamentos que só tinham
// cor lisa. Escolhe o acabamento pelo próprio material: metal (metalness alta) fica escovado,
// superfícies mates ficam com grão (pintura, laminado, tecido), as brilhantes com um grão muito leve.
// As texturas são geradas no código, quase brancas, e multiplicam a cor que já existe: o aspeto
// geral das salas mantém-se, mas deixa de parecer plástico liso. Não mexe em materiais que já têm
// imagem (letreiros, ecrãs, pavimentos), em vidros nem nas pessoas.
import * as THREE from 'three';
import { uvCaixa } from './baggage-hall-model.js?v=pessoas-1';

function aleatorio(semente) { let s = semente >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function tela(w, pintar) {
    const c = document.createElement('canvas'); c.width = c.height = w; pintar(c.getContext('2d'), w);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
let texturas = null;
function criarTexturas() {
    const grao = tela(256, (g, w) => {                                               // tinta/laminado: grão fino e manchas muito suaves
        g.fillStyle = '#f3f3f3'; g.fillRect(0, 0, w, w); const r = aleatorio(3);
        for (let i = 0; i < 0; i++) { const x = r() * w, y = r() * w, rr = 30 + r() * 60, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${r() < 0.5 ? '255,255,255' : '225,225,225'},0.10)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }
        for (let i = 0; i < 9000; i++) { const v = 222 + Math.floor(r() * 33); g.fillStyle = `rgba(${v},${v},${v},${0.2 + r() * 0.3})`; g.fillRect(r() * w, r() * w, 1, 1); }
    });
    const tecido = tela(128, (g, w) => {                                             // tecido / alcatifa / malas de pano
        g.fillStyle = '#eeeeee'; g.fillRect(0, 0, w, w);
        for (let y = 0; y < w; y += 2) { g.fillStyle = y % 4 ? 'rgba(255,255,255,0.35)' : 'rgba(150,150,150,0.25)'; g.fillRect(0, y, w, 1); }
        for (let x = 0; x < w; x += 2) { g.fillStyle = x % 4 ? 'rgba(140,140,140,0.18)' : 'rgba(255,255,255,0.2)'; g.fillRect(x, 0, 1, w); }
    });
    const escovado = tela(256, (g, w) => {                                           // inox escovado
        g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, w, w); const r = aleatorio(9);
        for (let i = 0; i < 1100; i++) { const v = r() < 0.5 ? 255 : 170; g.fillStyle = `rgba(${v},${v},${v},${0.06 + r() * 0.16})`; g.fillRect(0, r() * w, w, 0.5 + r()); }
    });
    const liso = tela(128, (g, w) => { g.fillStyle = '#f7f7f7'; g.fillRect(0, 0, w, w); const r = aleatorio(5); for (let i = 0; i < 2500; i++) { const v = 225 + Math.floor(r() * 30); g.fillStyle = `rgba(${v},${v},${v},0.3)`; g.fillRect(r() * w, r() * w, 1, 1); } });
    return { grao, tecido, escovado, liso };
}

const tratados = new WeakSet();
export function aplicarAcabamentos(raiz, { excluir = [] } = {}) {
    texturas ??= criarTexturas();
    const fora = new Set(excluir.filter(Boolean));
    raiz.traverse(m => {
        if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh) return;
        const mats = [].concat(m.material);
        if (mats.length !== 1) return;
        const mat = mats[0];
        if (fora.has(mat) || !mat.isMeshStandardMaterial || mat.map || mat.emissiveMap || mat.alphaMap || mat.transparent || mat.opacity < 1 || !mat.visible) return;
        if (m.geometry.userData?.papel) return;                                      // pessoas do código
        const g = m.geometry;
        if (!g.userData.uvMundo) {                                                    // peças soltas: coordenadas de textura em metros
            if (!g.attributes.position || !g.attributes.normal || g.userData.uvProprias) return;
            const ng = g.index ? g.toNonIndexed() : g;
            if (ng !== g) { m.geometry = ng; }
            ng.setAttribute('uv', new THREE.BufferAttribute(uvCaixa(ng.attributes.position.array, ng.attributes.normal.array), 2)); ng.userData.uvMundo = true;
        }
        if (tratados.has(mat)) return;
        tratados.add(mat);
        const metal = mat.metalness >= 0.5, tecido = mat.roughness >= 0.88, brilho = mat.roughness < 0.45;
        const t = metal ? texturas.escovado : tecido ? texturas.tecido : brilho ? texturas.liso : texturas.grao;
        const rep = metal ? 1.5 : tecido ? 6 : 2.5;
        const mapa = t.clone(); mapa.repeat.set(rep, rep); mapa.needsUpdate = true;
        mat.map = mapa; mat.bumpMap = mapa; mat.bumpScale = metal ? 0.12 : tecido ? 0.8 : 0.1;
        if (metal) { mat.roughnessMap = mapa; }
        mat.needsUpdate = true;
    });
}
