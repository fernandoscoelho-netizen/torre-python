// Bloco 2 · Bagagens: sala de recolha em 3D.
// Não simula nada: reproduz o registo de eventos devolvido pelo motor Python (bagagens.py),
// por isso o que se vê é exatamente o que o programa do aluno fez.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const RETA = 14, RAIO = 3;                       // carrossel: duas retas e dois semicírculos (metros)
const PERIMETRO = 2 * RETA + 2 * Math.PI * RAIO;
const VELOCIDADE = 9;                            // metros por minuto simulado com o motor ligado
const ESPACO = 0.85;                             // distância entre malas que entram no mesmo minuto
const XS = [-27, -9, 9, 27];                     // posição dos quatro carrosséis
const PORTA = new THREE.Vector3(0, 0.9, -24);    // abertura da placa para a sala
const ESPERA_CENTRAL = new THREE.Vector3(0, 0.6, -18);
const INSPECAO = new THREE.Vector3(0, 0.4, 16);
const CORES_VOO = ['#c8553d', '#2f6690', '#d9a404', '#5b8e55', '#8a4f7d'];

// ---------------------------------------------------------------------------
// Reconstrução do estado a partir do registo (funções puras, testáveis em Node)
export function prepararRegisto(registo) {
    const malas = new Map(), tapetes = {}, ocorrencias = [];
    for (const codigo of registo.tapetes) tapetes[codigo] = { estados: [], motor: [] };
    registo.voos.forEach((voo, i) => {
        for (const codigo of voo.malas) malas.set(codigo, { codigo, voo: voo.codigo, indice: malas.size, cor: CORES_VOO[i % CORES_VOO.length], passos: [] });
    });
    const entradas = {};                         // tapete -> minuto -> número de malas que já entraram nesse minuto
    for (const e of registo.eventos) {
        if (e.tipo === 'mala') {
            const passo = { minuto: e.minuto, estado: e.estado, tapete: e.tapete };
            if (e.estado === 'no_carrossel') {
                const porMinuto = (entradas[e.tapete] ??= {});
                passo.ordem = porMinuto[e.minuto] = (porMinuto[e.minuto] ?? -1) + 1;
            }
            malas.get(e.mala)?.passos.push(passo);
        } else if (e.tipo === 'tapete') tapetes[e.tapete]?.estados.push({ minuto: e.minuto, estado: e.estado, voo: e.voo });
        else if (e.tipo === 'motor') tapetes[e.tapete]?.motor.push({ minuto: e.minuto, ligado: e.ligado });
        else if (e.tipo === 'ocorrencia') ocorrencias.push(e);
    }
    return { inicio: registo.inicio, fim: registo.fim, malas: [...malas.values()], tapetes, ocorrencias, resumo: registo.resumo };
}

// Minutos de motor ligado entre o início e t (o carrossel só anda com o motor ligado).
export function tempoMotor(motor, t) {
    let total = 0, desde = null;
    for (const m of motor) {
        if (m.minuto > t) break;
        if (m.ligado && desde === null) desde = m.minuto;
        if (!m.ligado && desde !== null) { total += m.minuto - desde; desde = null; }
    }
    return desde === null ? total : total + (t - desde);
}

export function estadoTapete(tapete, t) {
    let estado = 'livre', voo = null, motor = false;
    for (const e of tapete.estados) { if (e.minuto > t) break; estado = e.estado; voo = e.voo; }
    for (const m of tapete.motor) { if (m.minuto > t) break; motor = m.ligado; }
    return { estado, voo, motor: motor && estado !== 'avariado' };
}

// Passo atual da mala no instante t e o seguinte (para interpolar o transporte).
export function passoMala(mala, t) {
    let i = -1;
    while (i + 1 < mala.passos.length && mala.passos[i + 1].minuto <= t) i++;
    return { atual: mala.passos[i] ?? null, seguinte: mala.passos[i + 1] ?? null };
}

export function contar(dados, t) {
    const n = { porao: 0, transporte: 0, espera: 0, carrossel: 0, entregue: 0, inspecao: 0 };
    for (const mala of dados.malas) {
        const e = passoMala(mala, t).atual?.estado ?? 'no_porao';
        if (e === 'no_porao' || e === 'descarregada') n.porao++;
        else if (e === 'em_transporte') n.transporte++;
        else if (e === 'em_espera') n.espera++;
        else if (e === 'no_carrossel') n.carrossel++;
        else n[e]++;
    }
    return n;
}

// Ponto do carrossel a s metros do ponto de alimentação (topo da reta de trás).
function pontoCarrossel(x0, s) {
    s = ((s % PERIMETRO) + PERIMETRO) % PERIMETRO;
    const meio = RETA / 2, arco = Math.PI * RAIO;
    let x, z;
    if (s < RETA) { x = x0 - RAIO; z = -meio + s; }
    else if ((s -= RETA) < arco) { const a = Math.PI - s / RAIO; x = x0 + RAIO * Math.cos(a); z = meio + RAIO * Math.sin(a); }
    else if ((s -= arco) < RETA) { x = x0 + RAIO; z = meio - s; }
    else { s -= RETA; const a = -s / RAIO; x = x0 + RAIO * Math.cos(a); z = -meio + RAIO * Math.sin(a); }
    return new THREE.Vector3(x, 0.95, z);
}

// ---------------------------------------------------------------------------
// Cena
const estilo = document.createElement('style');
estilo.textContent = `
.baggage-hall{position:absolute;inset:0;z-index:6;background:#d9ddd6;display:none}
.baggage-hall.aberta{display:block}
.baggage-hall canvas{display:block;width:100%;height:100%}
.bh-topo{position:absolute;top:12px;left:14px;right:14px;display:flex;gap:10px;align-items:flex-start;justify-content:space-between;pointer-events:none;font:13px/1.35 system-ui,sans-serif}
.bh-cartao{pointer-events:auto;background:#1c3346e8;color:#e8eef2;border-radius:6px;padding:9px 12px;backdrop-filter:blur(8px)}
.bh-cartao b{font-size:12px;letter-spacing:1.5px;font-weight:650}
.bh-contadores{display:grid;grid-template-columns:repeat(3,auto);gap:4px 14px;margin-top:6px;font-variant-numeric:tabular-nums}
.bh-contadores span{color:#9fb3c2;font-size:11px;display:block}
.bh-ocorrencias{max-width:260px;max-height:120px;overflow:auto;font-size:12px}
.bh-ocorrencias li{margin-left:16px}
.bh-controlos{position:absolute;left:14px;right:14px;bottom:14px;display:flex;gap:8px;align-items:center;background:#1c3346e8;color:#e8eef2;border-radius:6px;padding:8px 10px;font:13px system-ui,sans-serif}
.bh-controlos input[type=range]{flex:1;min-width:80px}
.bh-controlos button,.bh-controlos select{background:#2d4b63;color:#fff;border:1px solid #ffffff33;border-radius:4px;padding:4px 9px;font:inherit;cursor:pointer}
.bh-hora{font-variant-numeric:tabular-nums;min-width:44px;text-align:center;font-weight:650}
.bh-seguir{position:absolute;right:14px;top:12px;max-width:280px;font-size:12px}
.bh-seguir ol{margin:6px 0 0 18px;padding:0}
.bh-seguir button{margin-top:6px;background:#2d4b63;color:#fff;border:1px solid #ffffff33;border-radius:4px;padding:3px 8px;cursor:pointer}
.bh-legenda i{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 10px;vertical-align:-1px}
.bh-dica{font-size:11px;color:#9fb3c2;margin-top:6px}
.bh-abrir{position:absolute;right:12px;bottom:32px;z-index:5;background:#1c3346e8;color:#e8eef2;border:1px solid #ffffff33;border-radius:4px;padding:6px 11px;font:13px system-ui,sans-serif;cursor:pointer}
.bh-vazio[hidden],.bh-cartao[hidden]{display:none}
.bh-vazio{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#2b3b45;font:15px system-ui,sans-serif;text-align:center;padding:0 40px;pointer-events:none}
`;
document.head.append(estilo);

const viewport = document.querySelector('.workspace-viewport') ?? document.getElementById('scene')?.parentElement ?? document.body;
const sala = document.createElement('div');
sala.className = 'baggage-hall';
sala.innerHTML = `
<div class="bh-topo">
  <div class="bh-cartao"><b>SALA DE RECOLHA · BAGAGENS</b><span class="bh-legenda" id="bh-legenda"></span><div class="bh-contadores" id="bh-contadores"></div><div class="bh-dica">Clica numa mala para a seguir.</div></div>
  <div class="bh-cartao bh-ocorrencias" id="bh-ocorrencias" hidden></div>
</div>
<div class="bh-cartao bh-seguir" id="bh-seguir" hidden></div>
<div class="bh-vazio" id="bh-vazio">Executa um programa do Bloco 2 (por exemplo, o nível 21) para ver aqui as malas do PY001.</div>
<div class="bh-controlos">
  <button id="bh-play" title="Reproduzir ou pausar">▶</button>
  <span class="bh-hora" id="bh-hora">--:--</span>
  <input type="range" id="bh-tempo" min="0" max="1" step="0.01" value="0" aria-label="Hora simulada">
  <select id="bh-velocidade" aria-label="Velocidade"><option value="0.5">0,5 min/s</option><option value="1" selected>1 min/s</option><option value="2">2 min/s</option><option value="4">4 min/s</option></select>
  <button id="bh-fechar" title="Voltar à maquete do aeroporto">Aeroporto ✕</button>
</div>`;
viewport.append(sala);
const botaoAbrir = document.createElement('button');
botaoAbrir.className = 'bh-abrir';
botaoAbrir.textContent = '🧳 Sala de bagagens';
viewport.append(botaoAbrir);
const $ = id => sala.querySelector('#' + id);

let renderer = null, scene, camera, controls, malhasTapete = {}, malhasMala = new Map(), monitores = {};
let dados = null, t = 0, aReproduzir = false, ultimo = 0, ciclo = null, seguida = null, marcador = null;
const NOMES_ESTADO = { no_porao: 'no porão', descarregada: 'descarregada', em_transporte: 'em transporte', em_espera: 'em espera', no_carrossel: 'no carrossel', entregue: 'entregue', inspecao: 'em inspeção' };

function texto(linhas, cor = '#0f2433') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = cor; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#f4c542'; g.font = 'bold 64px system-ui,sans-serif'; g.fillText(linhas[0], 28, 84);
    g.fillStyle = '#e8eef2'; g.font = '44px system-ui,sans-serif';
    linhas.slice(1).forEach((l, i) => g.fillText(l, 28, 150 + i * 58));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

function anelCarrossel() {
    const s = new THREE.Shape(), meio = RETA / 2, ext = RAIO + 0.9, int = RAIO - 0.9;
    s.moveTo(-ext, -meio); s.lineTo(-ext, meio); s.absarc(0, meio, ext, Math.PI, 0, true); s.lineTo(ext, -meio); s.absarc(0, -meio, ext, 0, Math.PI, true);
    const furo = new THREE.Path();
    furo.moveTo(-int, -meio); furo.absarc(0, -meio, int, Math.PI, 0, false); furo.lineTo(int, meio); furo.absarc(0, meio, int, 0, Math.PI, false); furo.lineTo(-int, -meio);
    s.holes.push(furo);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    return geo;
}

function construir() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    sala.prepend(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#d9ddd6');
    camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
    camera.position.set(0, 50, 50);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - 0.05; controls.minDistance = 8; controls.maxDistance = 140;
    scene.add(new THREE.HemisphereLight('#ffffff', '#8a8f86', 2.2));
    const luz = new THREE.DirectionalLight('#fff6e8', 2.2); luz.position.set(-20, 40, 25); luz.castShadow = true;
    Object.assign(luz.shadow.camera, { left: -50, right: 50, top: 40, bottom: -40 }); luz.shadow.mapSize.set(2048, 2048);
    scene.add(luz);

    const chao = new THREE.Mesh(new THREE.PlaneGeometry(90, 56), new THREE.MeshStandardMaterial({ color: '#c9c6bd', roughness: 0.85 }));
    chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; scene.add(chao);
    const parede = new THREE.Mesh(new THREE.BoxGeometry(90, 7, 0.6), new THREE.MeshStandardMaterial({ color: '#e9ebe7' }));
    parede.position.set(0, 3.5, -26); scene.add(parede);
    const porta = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.7), new THREE.MeshStandardMaterial({ color: '#2b2f33' }));
    porta.position.set(0, 1.5, -25.9); scene.add(porta);
    const zonaInspecao = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), new THREE.MeshStandardMaterial({ color: '#e7c64a', roughness: 0.9 }));
    zonaInspecao.rotation.x = -Math.PI / 2; zonaInspecao.position.set(INSPECAO.x, 0.02, INSPECAO.z); scene.add(zonaInspecao);
    const rotulo = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: texto(['INSPEÇÃO'], '#7a5c00') }));
    rotulo.rotation.x = -Math.PI / 2; rotulo.position.set(INSPECAO.x, 0.04, INSPECAO.z - 4.6); scene.add(rotulo);

    const anel = anelCarrossel();
    for (const [i, codigo] of ['T01', 'T02', 'T03', 'T04'].entries()) {
        const x = XS[i];
        const base = new THREE.Mesh(new THREE.BoxGeometry(2 * RAIO - 1.6, 0.8, RETA), new THREE.MeshStandardMaterial({ color: '#9aa3a8', metalness: 0.4, roughness: 0.4 }));
        base.position.set(x, 0.4, 0); base.castShadow = true; scene.add(base);
        const tapete = new THREE.Mesh(anel, new THREE.MeshStandardMaterial({ color: '#3a3f44', metalness: 0.2, roughness: 0.6 }));
        tapete.position.set(x, 0.6, 0); tapete.receiveShadow = true; scene.add(tapete);
        const alimentacao = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 12), new THREE.MeshStandardMaterial({ color: '#4b5157' }));
        alimentacao.position.set(x - RAIO, 0.6, -RETA / 2 - 6.5); scene.add(alimentacao);
        const farol = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshStandardMaterial({ color: '#888', emissive: '#000' }));
        farol.position.set(x + RAIO + 1.6, 2.6, -RETA / 2); scene.add(farol);
        const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.1), new THREE.MeshStandardMaterial({ color: '#555' }));
        poste.position.set(x + RAIO + 1.6, 1.05, -RETA / 2); scene.add(poste);
        const monitor = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ map: texto([codigo, 'livre']) }));
        monitor.position.set(x, 6, -RETA / 2 - 1.2); monitor.rotation.x = -0.35; scene.add(monitor);
        malhasTapete[codigo] = { tapete, farol, x };
        monitores[codigo] = { malha: monitor, chave: '' };
    }
    marcador = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.09, 8, 32), new THREE.MeshBasicMaterial({ color: '#ffd400' }));
    marcador.rotation.x = Math.PI / 2; marcador.visible = false; scene.add(marcador);
    const raio = new THREE.Raycaster(), ponteiro = new THREE.Vector2();
    let inicioClique = null;
    renderer.domElement.addEventListener('pointerdown', e => { inicioClique = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', e => {
        if (!inicioClique || Math.hypot(e.clientX - inicioClique[0], e.clientY - inicioClique[1]) > 5 || !dados) return;
        const caixa = renderer.domElement.getBoundingClientRect();
        ponteiro.set((e.clientX - caixa.left) / caixa.width * 2 - 1, -(e.clientY - caixa.top) / caixa.height * 2 + 1);
        raio.setFromCamera(ponteiro, camera);
        const visiveis = [...malhasMala.values()].filter(m => m.visible);
        const alvo = raio.intersectObjects(visiveis)[0]?.object;
        seguir(alvo ? [...malhasMala.entries()].find(([, m]) => m === alvo)[0] : null);
    });
    new ResizeObserver(ajustar).observe(sala);
    ajustar();
}

function ajustar() {
    if (!renderer) return;
    const w = Math.max(1, sala.clientWidth), h = Math.max(1, sala.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

function carregar(registo) {
    dados = prepararRegisto(registo);
    for (const m of malhasMala.values()) scene.remove(m);
    malhasMala.clear();
    const geo = new THREE.BoxGeometry(0.75, 0.45, 0.55);
    for (const mala of dados.malas) {
        const malha = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: mala.cor, roughness: 0.55 }));
        malha.castShadow = true; malha.visible = false; scene.add(malha);
        malhasMala.set(mala.codigo, malha);
    }
    $('bh-vazio').hidden = true;
    seguir(null);
    const voos = [...new Map(dados.malas.map(m => [m.voo, m.cor])).entries()];
    $('bh-legenda').innerHTML = voos.map(([v, c]) => `<i style="background:${c}"></i>${v}`).join('');
    $('bh-tempo').min = dados.inicio; $('bh-tempo').max = dados.fim;
    const lista = dados.ocorrencias;
    $('bh-ocorrencias').hidden = !lista.length;
    $('bh-ocorrencias').innerHTML = '<b>OCORRÊNCIAS</b><ul>' + lista.map(o => `<li>${hhmm(o.minuto)} · ${o.texto.replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;')}</li>`).join('') + '</ul>';
    t = dados.inicio; aReproduzir = true;
}

function hhmm(m) { m = Math.floor(m); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

function tapeteDoVoo(voo, tt) {
    for (const [codigo, tp] of Object.entries(dados.tapetes)) {
        const e = estadoTapete(tp, tt);
        if (e.voo === voo && e.estado === 'ocupado') return codigo;
    }
    return null;
}

function posicaoMala(mala, tt, contagemEspera) {
    const { atual, seguinte } = passoMala(mala, tt);
    if (!atual || atual.estado === 'no_porao' || atual.estado === 'descarregada' && !seguinte) return null;
    const e = atual.estado;
    if (e === 'descarregada' || e === 'em_transporte') {
        const fim = seguinte?.minuto ?? atual.minuto + 3, k = Math.min(1, Math.max(0, (tt - atual.minuto) / Math.max(0.01, fim - atual.minuto)));
        const destino = tapeteDoVoo(mala.voo, tt);
        const i = mala.indice % 10, desvio = new THREE.Vector3((i % 5 - 2) * 0.8, 0, Math.floor(i / 5) * 0.8);
        return PORTA.clone().add(desvio).lerp((destino ? new THREE.Vector3(malhasTapete[destino].x - RAIO, 1.1, -RETA / 2 - 12) : ESPERA_CENTRAL.clone()).add(desvio), k);
    }
    if (e === 'em_espera') {
        const n = contagemEspera.get(mala.voo) ?? 0; contagemEspera.set(mala.voo, n + 1);
        const tapeteAtual = tapeteDoVoo(mala.voo, tt);
        if (tapeteAtual) {
            const x = malhasTapete[tapeteAtual].x - RAIO;
            return new THREE.Vector3(x + ((n % 2) - 0.5) * 0.6, 1.1 + Math.floor(n / 28) * 0.5, -RETA / 2 - 1 - (Math.floor(n / 2) % 14) * 0.85);
        }
        return new THREE.Vector3(ESPERA_CENTRAL.x + (n % 12) * 0.85 - 4.7, 0.25 + Math.floor(n / 72) * 0.5, ESPERA_CENTRAL.z + (Math.floor(n / 12) % 6) * 0.7);
    }
    if (e === 'no_carrossel') {
        const tp = dados.tapetes[atual.tapete], x = malhasTapete[atual.tapete].x;
        const s = VELOCIDADE * (tempoMotor(tp.motor, tt) - tempoMotor(tp.motor, atual.minuto)) - atual.ordem * ESPACO;
        return pontoCarrossel(x, s);
    }
    if (e === 'inspecao') {
        const i = dados.malas.indexOf(mala) % 30;
        return new THREE.Vector3(INSPECAO.x - 3.5 + (i % 6) * 1.2, 0.25, INSPECAO.z - 2 + Math.floor(i / 6) * 0.9);
    }
    return null;                                 // entregue: já saiu com o passageiro
}

function desenhar() {
    if (!dados) return;
    const espera = new Map();
    for (const mala of dados.malas) {
        const malha = malhasMala.get(mala.codigo), p = posicaoMala(mala, t, espera);
        malha.visible = !!p;
        if (p) malha.position.copy(p);
    }
    for (const [codigo, tp] of Object.entries(dados.tapetes)) {
        const est = estadoTapete(tp, t), m = malhasTapete[codigo];
        const cor = est.estado === 'avariado' ? '#d23c2c' : est.motor ? '#33b24a' : est.estado === 'ocupado' ? '#e0a526' : '#8b8f93';
        m.farol.material.color.set(cor); m.farol.material.emissive.set(est.estado === 'livre' ? '#000' : cor); m.farol.material.emissiveIntensity = 0.7;
        m.tapete.material.color.set(est.estado === 'avariado' ? '#5a2b28' : '#3a3f44');
        const noCarrossel = dados.malas.filter(x => { const a = passoMala(x, t).atual; return a?.estado === 'no_carrossel' && a.tapete === codigo; }).length;
        const linhas = est.estado === 'avariado' ? [codigo, 'AVARIADO', est.voo ?? ''] : est.voo ? [codigo + ' · ' + est.voo, est.motor ? 'em serviço' : 'motor parado', noCarrossel + ' malas'] : [codigo, 'livre'];
        const chave = linhas.join('|');
        if (monitores[codigo].chave !== chave) {
            monitores[codigo].malha.material.map.dispose();
            monitores[codigo].malha.material.map = texto(linhas, est.estado === 'avariado' ? '#5a1712' : '#0f2433');
            monitores[codigo].chave = chave;
        }
    }
    if (seguida) {
        const mala = dados.malas.find(m => m.codigo === seguida), malha = malhasMala.get(seguida);
        marcador.visible = malha.visible;
        if (malha.visible) {
            marcador.position.set(malha.position.x, malha.position.y + 0.9, malha.position.z);
            const passo = malha.position.clone().sub(controls.target).multiplyScalar(0.08);
            controls.target.add(passo); camera.position.add(passo);
        }
        const passos = mala.passos.filter(p => p.minuto <= t);
        const atual = passos.at(-1)?.estado ?? 'no_porao';
        const chave = seguida + '|' + passos.length;
        if ($('bh-seguir').dataset.chave !== chave) {
            $('bh-seguir').dataset.chave = chave;
            $('bh-seguir').innerHTML = `<b>MALA ${seguida}</b><div>Voo ${mala.voo} · ${NOMES_ESTADO[atual]}</div><ol>` +
                passos.map(p => `<li>${hhmm(p.minuto)} · ${NOMES_ESTADO[p.estado]}${p.tapete ? ' (' + p.tapete + ')' : ''}</li>`).join('') +
                '</ol><button id="bh-largar">Deixar de seguir</button>';
            $('bh-largar').onclick = () => seguir(null);
        }
    }
    const pulso = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 250));
    for (const [codigo, tp] of Object.entries(dados.tapetes)) {
        if (estadoTapete(tp, t).estado === 'avariado') malhasTapete[codigo].farol.material.emissiveIntensity = pulso;
    }
    const n = contar(dados, t);
    $('bh-contadores').innerHTML = [['Entregues', n.entregue], ['No carrossel', n.carrossel], ['Em espera', n.espera], ['Em transporte', n.transporte], ['No porão', n.porao], ['Inspeção', n.inspecao]]
        .map(([r, v]) => `<div><span>${r}</span>${v}</div>`).join('');
    $('bh-hora').textContent = hhmm(t);
    $('bh-tempo').value = t;
}

function animar(agora) {
    ciclo = requestAnimationFrame(animar);
    const dt = Math.min(1, (agora - (ultimo || agora)) / 1000); ultimo = agora;
    if (dados && aReproduzir) {
        t = Math.min(dados.fim, t + dt * Number($('bh-velocidade').value));
        if (t >= dados.fim) aReproduzir = false;
    }
    $('bh-play').textContent = aReproduzir ? 'Ⅱ' : '▶';
    desenhar();
    controls.update();
    renderer.render(scene, camera);
}

function seguir(codigo) {
    seguida = codigo;
    if (marcador) marcador.visible = false;
    for (const [c, m] of malhasMala) m.material.emissive?.set(c === codigo ? '#665500' : '#000000');
    $('bh-seguir').hidden = !codigo;
    $('bh-seguir').dataset.chave = '';
    $('bh-ocorrencias').style.visibility = codigo ? 'hidden' : '';
}

export function abrir() {
    if (!renderer) construir();
    sala.classList.add('aberta'); botaoAbrir.hidden = true;
    ajustar();
    if (ciclo === null) { ultimo = 0; ciclo = requestAnimationFrame(animar); }
}

export function fechar() {
    sala.classList.remove('aberta'); botaoAbrir.hidden = false;
    if (ciclo !== null) cancelAnimationFrame(ciclo);
    ciclo = null;
}

botaoAbrir.onclick = abrir;
$('bh-fechar').onclick = fechar;
$('bh-play').onclick = () => { if (!dados) return; if (t >= dados.fim) t = dados.inicio; aReproduzir = !aReproduzir; };
$('bh-tempo').oninput = e => { t = Number(e.target.value); aReproduzir = false; };

window.addEventListener('baggage-run', e => { abrir(); carregar(e.detail); });
window.baggageHall = { abrir, fechar, seguir };
