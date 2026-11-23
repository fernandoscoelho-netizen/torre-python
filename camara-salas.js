// Câmara das salas 3D: além de rodar (arrastar) e aproximar (roda do rato), permite "agarrar" a
// imagem e deslocá-la para cima, para baixo e para os lados.
//   · botão "✋ Mover": o arrastar com o botão esquerdo (ou um dedo) passa a deslocar a imagem;
//   · em qualquer modo: botão direito, ou Shift/Ctrl + arrastar, desloca; o outro modo roda;
//   · teclado (depois de clicar na cena): setas ou WASD deslocam, Q/E sobem e descem, + e − aproximam;
//   · duplo clique num ponto centra a vista nesse ponto.
// O ponto para onde a câmara olha fica sempre dentro dos limites da sala, para não se perder a cena.
import * as THREE from 'three';

const estilo = document.createElement('style');
estilo.textContent = `
.cam-modo{white-space:nowrap}
.cam-modo[aria-pressed="true"]{background:#3d9be9 !important;border-color:#bfe0ff !important}
.cam-dica{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#14273ae8;color:#e8eef2;border-radius:6px;padding:7px 12px;font:12px system-ui,sans-serif;pointer-events:none;opacity:0;transition:opacity .4s;z-index:4;text-align:center;max-width:80%}
.cam-dica.visivel{opacity:1}
.salas-abrir{position:absolute;right:12px;bottom:32px;z-index:5;display:flex;flex-direction:column-reverse;align-items:flex-end;gap:8px;pointer-events:none}
.salas-abrir>button{position:static !important;pointer-events:auto}
.salas-abrir>button[hidden]{display:none}
`;
document.head.append(estilo);

// Botões que abrem as salas, empilhados no canto do mapa por uma ordem fixa (de baixo para cima).
// Ficam numa coluna flexível: se uma sala não carregar ou o botão estiver escondido, não fica buraco.
export function empilharBotao(viewport, botao, ordem) {
    let pilha = viewport.querySelector(':scope > .salas-abrir');
    if (!pilha) { pilha = document.createElement('div'); pilha.className = 'salas-abrir'; viewport.append(pilha); }
    botao.style.order = ordem; pilha.append(botao);
}

let modoGlobal = 'rodar';                                                         // o modo escolhido vale para todas as salas
const todas = new Set();

export function melhorarCamara({ controls, camera, scene, sala, barra, antesDe, limites = null, margem = 4 }) {
    const dom = controls.domElement;
    controls.enablePan = true; controls.screenSpacePanning = true; controls.panSpeed = 1.1; controls.keyPanSpeed = 22; controls.zoomToCursor = true;
    dom.tabIndex = 0; dom.style.outline = 'none';
    dom.addEventListener('pointerdown', () => dom.focus({ preventScroll: true }));
    controls.listenToKeyEvents(dom);                                               // só quando a cena tem o foco: não interfere com o editor de código
    controls.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };

    // Botão de modo, na barra de controlos da sala
    const botao = document.createElement('button');
    botao.className = 'cam-modo'; botao.type = 'button';
    botao.title = 'Alternar entre rodar a vista e mover a imagem (arrastar). Botão direito ou Shift + arrastar faz sempre o outro.';
    (antesDe && barra.contains(antesDe) ? barra.insertBefore(botao, antesDe) : barra.append(botao));
    const dica = document.createElement('div'); dica.className = 'cam-dica'; sala.append(dica);
    let tDica = 0;
    const mostrarDica = texto => { dica.textContent = texto; dica.classList.add('visivel'); clearTimeout(tDica); tDica = setTimeout(() => dica.classList.remove('visivel'), 2200); };
    const aplicar = (avisar = false) => {
        const mover = modoGlobal === 'mover';
        controls.mouseButtons = mover ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE } : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        controls.touches = mover ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE } : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
        botao.textContent = mover ? '✋ Mover' : '⟳ Rodar'; botao.setAttribute('aria-pressed', String(mover));
        if (avisar) mostrarDica(mover ? 'Arrasta para mover a imagem · botão direito para rodar' : 'Arrasta para rodar · botão direito ou Shift + arrastar para mover');
    };
    botao.onclick = () => { modoGlobal = modoGlobal === 'mover' ? 'rodar' : 'mover'; for (const f of todas) f(); aplicar(true); };
    todas.add(() => aplicar());
    aplicar();

    // Teclado extra: WASD, Q/E (subir e descer) e +/− (aproximar)
    const _d = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();
    dom.addEventListener('keydown', e => {
        const k = e.key.toLowerCase(), dist = camera.position.distanceTo(controls.target), passo = Math.max(0.3, dist * 0.06);
        camera.getWorldDirection(_f); _f.y = 0; if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1); _f.normalize(); _r.crossVectors(_f, camera.up).normalize();
        _d.set(0, 0, 0);
        if (k === 'w') _d.copy(_f).multiplyScalar(passo); else if (k === 's') _d.copy(_f).multiplyScalar(-passo);
        else if (k === 'a') _d.copy(_r).multiplyScalar(-passo); else if (k === 'd') _d.copy(_r).multiplyScalar(passo);
        else if (k === 'q') _d.set(0, -passo, 0); else if (k === 'e') _d.set(0, passo, 0);
        else if (k === '+' || k === '=' || k === '-') { const f = k === '-' ? 1.15 : 1 / 1.15; camera.position.sub(controls.target).multiplyScalar(f).add(controls.target); controls.update(); e.preventDefault(); return; }
        else return;
        controls.target.add(_d); camera.position.add(_d); controls.update(); e.preventDefault();
    });

    // Duplo clique: centra a vista no ponto clicado
    const raio = new THREE.Raycaster(), ndc = new THREE.Vector2();
    dom.addEventListener('dblclick', e => {
        const r = dom.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
        raio.setFromCamera(ndc, camera);
        const alvo = raio.intersectObjects(scene.children, true).find(h => h.object.visible && h.object.isMesh);
        if (!alvo) return;
        const d = alvo.point.clone().sub(controls.target); controls.target.add(d); camera.position.add(d); controls.update();
    });

    // Limites: o alvo da câmara fica dentro da caixa da sala (com folga)
    let caixa = limites;
    const conter = () => {
        if (!caixa) { caixa = new THREE.Box3().setFromObject(scene); if (caixa.isEmpty()) { caixa = null; return; } caixa.expandByScalar(margem); caixa.min.y = Math.max(caixa.min.y, 0); }
        const antes = controls.target.clone(); controls.target.clamp(caixa.min, caixa.max);
        if (!antes.equals(controls.target)) camera.position.add(controls.target.clone().sub(antes));
    };
    controls.addEventListener('change', conter);
    return { botao, recalcularLimites: () => { caixa = limites; } };
}
