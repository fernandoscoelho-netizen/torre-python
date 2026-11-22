// Bloco 2 · Bagagens, Fase 2: sinótico SCADA da central de triagem.
// Desenha, num canvas 2D, o ecrã de supervisão: rede de tapetes com o estado de cada troço, as malas
// na posição em que estão, os desviadores, o leitor, as saídas, os alarmes e as tendências.
// Tal como a cena 3D, não simula nada: lê o registo do motor Python (triagem.py) já preparado por
// sorting-hall.js. O mesmo desenho serve o painel interativo e o mural da sala de controlo em 3D.

const NOS = {
    C1: [6, 20], C2: [6, 36], LEITOR: [20, 28], INSPECAO: [20, 53], RET: [94, 28],
    A1: [34, 28], A2: [50, 28], A3: [66, 28], A4: [82, 28],
    B1: [34, 42], B2: [50, 42], B3: [66, 42], B4: [82, 42],
    S01: [34, 55.5], S02: [50, 55.5], S03: [66, 55.5], S04: [82, 55.5],
};
const LINHAS = {
    'C1>LEITOR': [[6, 20], [13.5, 20], [18.6, 26.2]], 'C2>LEITOR': [[6, 36], [13.5, 36], [18.6, 29.8]],
    'LEITOR>A1': [NOS.LEITOR, NOS.A1], 'LEITOR>INSPECAO': [NOS.LEITOR, [20, 50.6]],
    'A1>A2': [NOS.A1, NOS.A2], 'A2>A3': [NOS.A2, NOS.A3], 'A3>A4': [NOS.A3, NOS.A4], 'A4>RET': [NOS.A4, NOS.RET],
    'A1>B1': [NOS.A1, NOS.B1], 'A2>B2': [NOS.A2, NOS.B2], 'A3>B3': [NOS.A3, NOS.B3], 'A4>B4': [NOS.A4, NOS.B4],
    'B1>B2': [NOS.B1, NOS.B2], 'B2>B3': [NOS.B2, NOS.B3], 'B3>B4': [NOS.B3, NOS.B4], 'B4>RET': [NOS.B4, [94, 42], NOS.RET],
    'B1>S01': [NOS.B1, NOS.S01], 'B2>S02': [NOS.B2, NOS.S02], 'B3>S03': [NOS.B3, NOS.S03], 'B4>S04': [NOS.B4, NOS.S04],
    'RET>LEITOR': [NOS.RET, [94, 10], [20, 10], NOS.LEITOR],
};
const ANCORAS = { 'C1>LEITOR': [10.6, 16.9], 'C2>LEITOR': [10.6, 39.1] };   // onde fica a carga dos troços que saem do check-in
const LARGURA = 100, ALTURA = 66;                 // espaço do sinótico, em unidades
const SAIDAS = ['S01', 'S02', 'S03', 'S04'];
const EM_FRENTE = { A1: 'A2', A2: 'A3', A3: 'A4', A4: 'RET', B1: 'B2', B2: 'B3', B3: 'B4', B4: 'RET' };
const DESVIO = { A1: 'B1', A2: 'B2', A3: 'B3', A4: 'B4', B1: 'S01', B2: 'S02', B3: 'S03', B4: 'S04' };
const COR = {
    fundo: '#0a121c', painel: '#0f1b29', borda: '#1e3046', texto: '#e2e9ef', suave: '#8296a8', fraco: '#4d6176',
    verde: '#2fc277', verdeEsc: '#1c6b45', vermelho: '#ff4d3d', vermelhoEsc: '#5e1712', ambar: '#f2b705', ciano: '#4cc9f0',
    tapete: '#152230', no: '#1f4f9a', leitor: '#b7791f', saida: '#17804a', inspecao: '#b0461c', retorno: '#5b3f8c', entrada: '#3a4856',
};
const FONTE = 'system-ui, "Segoe UI", Arial, sans-serif', MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';
const hhmm = m => { m = Math.floor(m); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const hhmmss = m => hhmm(m) + ':' + String(Math.floor((m % 1) * 60)).padStart(2, '0');
const nomeNo = c => c === 'INSPECAO' ? 'INSPEÇÃO' : c;
const ate = (lista, t) => { let a = 0, b = lista.length; while (a < b) { const m = (a + b) >> 1; if (lista[m] <= t) a = m + 1; else b = m; } return a; };   // quantos valores ≤ t

function medir(pts) { const acum = [0]; for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return acum; }
const CAMINHOS = Object.fromEntries(Object.entries(LINHAS).map(([c, pts]) => { const acum = medir(pts); return [c, { pts, acum, comp: acum.at(-1) }]; }));
function ponto(cam, d, alvo) {                    // ponto e direção a d unidades do início do troço
    d = Math.max(0, Math.min(cam.comp, d));
    let i = 1; while (i < cam.pts.length - 1 && cam.acum[i] < d) i++;
    const a = cam.pts[i - 1], b = cam.pts[i], seg = cam.acum[i] - cam.acum[i - 1] || 1, k = (d - cam.acum[i - 1]) / seg;
    alvo.x = a[0] + (b[0] - a[0]) * k; alvo.y = a[1] + (b[1] - a[1]) * k; alvo.dx = (b[0] - a[0]) / seg; alvo.dy = (b[1] - a[1]) / seg;
    return alvo;
}

// ---------------------------------------------------------------------------
// Dados que o sinótico acrescenta ao registo preparado: alarmes, eventos agrupados e séries de tendência.
export function prepararScada(dados, fim) {
    const alarmes = [], grupos = new Map();
    for (const tr of Object.values(dados.trocos)) for (const [de, a] of tr.paragens) alarmes.push({ t: de, fim: a, troco: tr.codigo, texto: `Avaria no troço ${tr.origem} → ${tr.destino}` });
    alarmes.sort((a, b) => a.t - b.t);
    for (const o of dados.ocorrencias) {
        if (/^Avaria no troço|reparado$/.test(o.texto)) continue;          // já estão nos alarmes dos troços
        const chave = o.texto.replace(/PY\d+-\d+/g, '#');
        if (!grupos.has(chave)) grupos.set(chave, { chave, primeiro: o.texto, tempos: [], saida: o.saida ?? null });
        grupos.get(chave).tempos.push(o.minuto);
    }
    const eventos = [...grupos.values()].map(g => ({ ...g, plural: g.chave.replace(/^Mala # na saída errada/, 'Malas na saída errada').replace(/^A mala # recirculou (\d+) vezes: enviada para inspeção/, 'Malas enviadas para inspeção depois de $1 voltas') }));
    const passo = 0.2, serie = [];
    for (let ts = dados.inicio; ts <= fim + 1e-9; ts += passo) {
        let tapete = 0, triadas = 0, outras = 0;
        for (const m of dados.malas) {
            if (m.fim && m.fim.t <= ts) { if (m.fim.estado === 'triada') triadas++; else outras++; }
            else if (m.passos.length && m.passos[0].tIn <= ts) tapete++;
        }
        serie.push({ t: ts, tapete, triadas, outras });
    }
    return {
        alarmes, eventos, serie, fim, total: dados.malas.length, maxTapete: Math.max(1, ...serie.map(s => s.tapete)),
        leiturasT: dados.leituras.map(l => l.t), triadasT: dados.malas.filter(m => m.fim?.estado === 'triada').map(m => m.fim.t).sort((a, b) => a - b),
    };
}

// Linhas do painel «Detalhe» para o elemento selecionado.
function detalhe(c) {
    const { dados, t, selecao, carga, n, f } = c;
    if (!selecao) return { titulo: 'DETALHE', linhas: [['', 'Clica num troço, num nó, numa saída ou numa mala']] };
    if (!dados) return { titulo: 'DETALHE', linhas: [['', 'Sem dados: executa um programa da central de triagem']] };
    const rotasPor = teste => SAIDAS.filter(s => { const r = f.rotaAtual(dados, s, t); return r && teste(r); }).join(' ') || 'nenhuma';
    if (selecao.tipo === 'troco') {
        const tr = dados.trocos[selecao.id]; if (!tr) return { titulo: 'DETALHE', linhas: [] };
        const par = tr.paragens.find(([de, a]) => de <= t && t < a), passaram = tr.passos.filter(p => p.tOut <= t).length;
        return { titulo: `TROÇO ${tr.origem} → ${nomeNo(tr.destino)}`, linhas: [
            ['Estado', par ? `AVARIADO desde as ${hhmm(par[0])}` : 'Em serviço', par ? COR.vermelho : COR.verde],
            ['Carga', `${carga[tr.codigo] ?? 0} de ${tr.capacidade} malas`], ['Percurso', `${tr.tempo} min`], ['Já passaram', `${passaram} malas`],
            ['Rotas por aqui', rotasPor(r => r.some((no, i) => no === tr.origem && r[i + 1] === tr.destino))]] };
    }
    if (selecao.tipo === 'mala') {
        const m = dados.malas.find(x => x.codigo === selecao.id); if (!m) return { titulo: 'DETALHE', linhas: [] };
        const e = f.estadoMala(m, t), lido = m.leituras.filter(l => l.t <= t).at(-1), feitos = m.passos.filter(p => p.tIn <= t);
        const estado = { no_checkin: 'No check-in', em_tapete: `Em tapete: ${e.passo?.troco.origem} → ${nomeNo(e.passo?.troco.destino ?? '')}`, triada: `Na saída certa (${e.saida})`, errada: `Na saída errada (${e.saida})`, inspecao: 'Em inspeção' }[e.estado];
        return { titulo: `MALA ${m.codigo}`, linhas: [
            ['Etiqueta', m.legivel ? `Voo ${m.voo}${dados.voos[m.voo] ? ' → ' + dados.voos[m.voo].saida : ' (sem partida)'}` : 'Ilegível'], ['Estado', estado, e.estado === 'errada' ? COR.vermelho : e.estado === 'triada' ? COR.verde : null],
            ['Leitor', lido ? `${lido.destino === 'INSPECAO' ? 'Inspeção' : 'Saída ' + lido.destino}${lido.vez > 1 ? ` · ${lido.vez}.ª leitura` : ''}` : 'Ainda não foi lida'],
            ['Percurso', feitos.length ? [feitos[0].troco.origem, ...feitos.map(p => nomeNo(p.troco.destino))].slice(-7).join(' › ') : '—']] };
    }
    const id = selecao.id;
    if (selecao.tipo === 'saida') {
        const info = dados.saidas[id], voo = info.voo, rota = f.rotaAtual(dados, id, t), partiu = t >= info.partida;
        return { titulo: `SAÍDA ${id}`, linhas: [
            ['Voo', voo ? `${voo.voo} · ${voo.destino} · ${hhmm(voo.hora)}` : 'Sem voo atribuído'], ['Malas', `${n.saidas[id] ?? 0} de ${voo?.total ?? 0}` + (n.erradas[id] ? ` · ${n.erradas[id]} de outros voos` : ''), n.erradas[id] ? COR.vermelho : null],
            ['Estado', !voo ? 'Livre' : partiu ? 'Reboques a caminho da placa' : (n.saidas[id] ?? 0) ? 'A carregar' : 'A aguardar malas'], ['Rota', rota ? rota.map(nomeNo).join(' › ') : 'Sem rota definida', rota ? null : COR.ambar]] };
    }
    if (id === 'LEITOR') {
        const lidas = ate(c.sc.leiturasT, t), ult = dados.leituras[lidas - 1], rel = dados.leituras.filter(l => l.t <= t && l.vez > 1).length;
        return { titulo: 'LEITOR DE ETIQUETAS', linhas: [['Leituras', `${lidas} (${rel} releituras)`], ['Última', ult ? `${ult.mala} · ${ult.voo ? 'voo ' + ult.voo : 'ilegível'}` : '—'],
            ['Decisão', ult ? (ult.destino === 'INSPECAO' ? 'Inspeção' : 'Saída ' + ult.destino) : '—'], ['À espera', `${(carga['C1>LEITOR'] ?? 0) + (carga['C2>LEITOR'] ?? 0) + (carga['RET>LEITOR'] ?? 0)} malas a chegar`]] };
    }
    if (id === 'INSPECAO') {
        const la = dados.malas.filter(m => m.fim?.estado === 'inspecao' && m.fim.t <= t);
        return { titulo: 'POSTO DE INSPEÇÃO', linhas: [['Malas', String(la.length)], ['Ilegíveis', String(la.filter(m => !m.legivel).length)], ['Sem partida', String(la.filter(m => m.legivel && !dados.voos[m.voo]).length)],
            ['Outras', `${la.filter(m => m.legivel && dados.voos[m.voo]).length} (sem rota ou 3.ª leitura)`]] };
    }
    if (id === 'RET') return { titulo: 'RETORNO', linhas: [['A caminho', `${(carga['A4>RET'] ?? 0) + (carga['B4>RET'] ?? 0)} malas`], ['No retorno', `${carga['RET>LEITOR'] ?? 0} malas`], ['Recirculações', String(n.recirculacoes)], ['', 'As malas sem rota voltam ao leitor']] };
    if (id[0] === 'C') { const porEntrar = dados.malas.filter(m => m.entrada === id && !(m.passos.length && m.passos[0].tIn <= t)).length; return { titulo: `ENTRADA ${id} · CHECK-IN`, linhas: [['Por entrar', `${porEntrar} malas`], ['No tapete', `${carga[id + '>LEITOR'] ?? 0} malas`]] }; }
    const desvios = (dados.desvios[id] ?? []).filter(x => x <= t).length;
    return { titulo: `DESVIADOR ${id}`, linhas: [['Em frente', nomeNo(EM_FRENTE[id])], ['Desvio', DESVIO[id]], ['Desvios feitos', String(desvios)],
        ['Rotas que desviam', rotasPor(r => r.some((no, i) => no === id && r[i + 1] === DESVIO[id]))]] };
}

// ---------------------------------------------------------------------------
// c: { dados, sc, t, n (contagens), carga (malas por troço), f: { ativo, avariado, rotaAtual, estadoMala },
//      modo: 'painel' | 'mural', selecao: { tipo, id } | null, pulso: 0..1 }
// Devolve { zonas (áreas clicáveis, em píxeis do canvas), cctv (retângulo reservado à câmara 3D ou null) }.
export function desenharScada(g, W, H, c) {
    const { dados, sc, t, n, carga, f, selecao, pulso } = c, mural = c.modo === 'mural', compacto = !mural && W < 900;
    const k = mural ? H / 640 : compacto ? Math.max(0.62, W / 900) : Math.max(0.85, Math.min(1.3, W / 1500));
    const zonas = [], p = {}, q = {};
    const px = v => Math.round(v * k);
    const txt = (s, x, y, { tam = 13, cor = COR.texto, peso = 400, alinha = 'left', mono = false, max = 0 } = {}) => {
        g.font = `${peso} ${Math.max(7, tam * k)}px ${mono ? MONO : FONTE}`; g.fillStyle = cor; g.textAlign = alinha; g.textBaseline = 'middle';
        s = String(s);
        if (max && g.measureText(s).width > max) { while (s.length > 2 && g.measureText(s + '…').width > max) s = s.slice(0, -1); s += '…'; }
        g.fillText(s, x, y);
    };
    const caixa = (x, y, w, h, cor, raio = 4, borda = null) => { g.beginPath(); g.roundRect(x, y, w, h, raio * k); if (cor) { g.fillStyle = cor; g.fill(); } if (borda) { g.strokeStyle = borda; g.lineWidth = Math.max(1, k); g.stroke(); } };
    const painel = (x, y, w, h, titulo, extra = '') => { caixa(x, y, w, h, COR.painel, 5, COR.borda); txt(titulo, x + px(10), y + px(13), { tam: 10.5, cor: COR.suave, peso: 700 }); if (extra) txt(extra, x + w - px(10), y + px(13), { tam: 10.5, cor: COR.suave, alinha: 'right' }); return y + px(26); };
    const avarias = dados ? Object.values(dados.trocos).filter(tr => f.avariado(tr, t)) : [];

    const dpr = c.dpr ?? 1; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = COR.fundo; g.fillRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';

    // --- Barra de topo: título, estado geral, indicadores e relógio ------------------------
    const hTopo = px(compacto ? 34 : 46);
    g.fillStyle = '#0d1826'; g.fillRect(0, 0, W, hTopo); g.fillStyle = COR.borda; g.fillRect(0, hTopo - 1, W, 1);
    txt(compacto ? 'SCADA · TRIAGEM' : 'SCADA · CENTRAL DE TRIAGEM · PARTIDAS', px(14), hTopo / 2, { tam: compacto ? 13 : 15, peso: 700 });
    let xk = px(compacto ? 150 : 372);
    const chip = (rotulo, cor, pisca) => { g.font = `700 ${Math.max(7, 11 * k)}px ${FONTE}`; const w = g.measureText(rotulo).width + px(18); caixa(xk, hTopo / 2 - px(10), w, px(20), pisca && pulso > 0.5 ? COR.vermelhoEsc : cor, 3); txt(rotulo, xk + w / 2, hTopo / 2 + 0.5, { tam: 11, peso: 700, cor: '#fff', alinha: 'center' }); xk += w + px(10); };
    chip(!dados ? 'SEM DADOS' : avarias.length ? `ALARME · ${avarias.length}` : 'NORMAL', !dados ? COR.fraco : avarias.length ? COR.vermelho : COR.saida, avarias.length > 0);
    if (dados && !compacto) {
        const lidas = ate(sc.leiturasT, t), debito = ate(sc.triadasT, t) - ate(sc.triadasT, t - 1);
        for (const [rotulo, valor, cor] of [['LIDAS', lidas], ['EM TAPETE', n.em_tapete], ['TRIADAS', `${n.triada}/${sc.total}`, COR.verde], ['INSPEÇÃO', n.inspecao, n.inspecao ? COR.ambar : null], ['ERRADAS', n.errada, n.errada ? COR.vermelho : null], ['RECIRC.', n.recirculacoes, n.recirculacoes ? COR.ambar : null], ['DÉBITO', `${debito}/min`]]) {
            if (xk > W - px(250)) break;
            txt(rotulo, xk, hTopo / 2 - px(8), { tam: 8.5, cor: COR.suave, peso: 700 }); txt(valor, xk, hTopo / 2 + px(7), { tam: 14, peso: 700, mono: true, cor: cor ?? COR.texto });
            xk += px(String(valor).length > 5 ? 96 : 80);
        }
    }
    txt(dados ? hhmmss(Math.min(t, dados.fim + 0.999)) : '--:--:--', W - px(14), hTopo / 2, { tam: compacto ? 15 : 19, peso: 700, mono: true, alinha: 'right' });

    // --- Áreas ------------------------------------------------------------------------------
    const m = px(compacto ? 5 : 8), wCol = compacto ? 0 : Math.round(Math.max(px(330), W * (mural ? 0.34 : 0.3)));
    const hBase = compacto ? px(22) : mural ? 0 : Math.round(Math.max(px(92), (H - hTopo) * 0.16));
    const R = { x: m, y: hTopo + m, w: W - wCol - m * (wCol ? 2 : 2), h: H - hTopo - m * 2 - (hBase ? hBase + m : 0) };
    caixa(R.x, R.y, R.w, R.h, COR.painel, 5, COR.borda);
    const s = Math.min((R.w - px(8)) / LARGURA, (R.h - px(8)) / (ALTURA - 4)), ox = R.x + (R.w - LARGURA * s) / 2, oy = R.y + (R.h - (ALTURA - 4) * s) / 2 - 4 * s;
    const X = x => ox + x * s, Y = y => oy + y * s, b = 1.75 * s;
    const etiqueta = (texto, x, y, alinha = 'left') => { g.font = `700 ${Math.max(6.5, 0.95 * s)}px ${FONTE}`; g.fillStyle = COR.fraco; g.textAlign = alinha; g.textBaseline = 'middle'; g.fillText(texto, X(x), Y(y)); };
    etiqueta('CHECK-IN', 2.8, 14.6); etiqueta('LINHA A · PRINCIPAL', 36.4, 23.7); etiqueta('LINHA B · DISTRIBUIÇÃO', 85.6, 48.4); etiqueta('RETORNO · RECIRCULAÇÃO', 52, 7.2);

    const tracar = (cam, largura, cor, de = 0, a = cam.comp) => {
        g.strokeStyle = cor; g.lineWidth = largura; g.beginPath(); ponto(cam, de, p); g.moveTo(X(p.x), Y(p.y));
        for (let i = 1; i < cam.pts.length - 1; i++) if (cam.acum[i] > de && cam.acum[i] < a) g.lineTo(X(cam.pts[i][0]), Y(cam.pts[i][1]));
        ponto(cam, a, p); g.lineTo(X(p.x), Y(p.y)); g.stroke();
    };
    // Rotas em vigor: uma linha fina por saída, do lado de fora da guarda (como as fitas luminosas da cena 3D)
    if (dados) SAIDAS.forEach((sd, i) => {
        const rota = f.rotaAtual(dados, sd, t), cor = dados.saidas[sd].voo?.cor ?? '#ffffff';
        if (!rota) return;
        g.strokeStyle = cor; g.lineWidth = Math.max(1.2, 0.3 * s); g.globalAlpha = selecao?.tipo === 'saida' && selecao.id !== sd ? 0.25 : 0.95;
        for (let j = 0; j < rota.length - 1; j++) {
            const cam = CAMINHOS[rota[j] + '>' + rota[j + 1]]; if (!cam || cam.pts.length !== 2) continue;
            const [a, z] = cam.pts, dx = (z[0] - a[0]) / cam.comp, dy = (z[1] - a[1]) / cam.comp, d = 1.35 + i * 0.46, folga = rota[j] === 'LEITOR' ? 4.5 : 2.4;
            g.beginPath(); g.moveTo(X(a[0] + dx * folga + dy * d), Y(a[1] + dy * folga - dx * d)); g.lineTo(X(z[0] - dx * folga + dy * d), Y(z[1] - dy * folga - dx * d)); g.stroke();
        }
        g.globalAlpha = 1;
    });
    // Troços: guardas com a cor do estado, tapete, setas do movimento, carga e motor
    for (const [codigo, cam] of Object.entries(CAMINHOS)) {
        const tr = dados?.trocos[codigo], mau = !!tr && f.avariado(tr, t), n1 = carga[codigo] ?? 0, escolhido = selecao?.tipo === 'troco' && selecao.id === codigo;
        if (escolhido) tracar(cam, b + 0.95 * s, COR.ciano);
        tracar(cam, b + 0.42 * s, mau ? (pulso > 0.5 ? COR.vermelho : '#8f241b') : !tr ? COR.fraco : n1 ? COR.verde : COR.verdeEsc);
        tracar(cam, b - 0.05 * s, mau ? COR.vermelhoEsc : COR.tapete);
        const passo = 2.6, fase = tr ? (cam.comp / tr.tempo * f.ativo(tr, t)) % passo : 0;
        g.strokeStyle = mau ? '#a8382e' : '#33485c'; g.lineWidth = Math.max(1, 0.2 * s);
        for (let d = fase + 0.6; d < cam.comp - 1.6; d += passo) {
            if (d < 1.9) continue;
            ponto(cam, d, p); const cx = X(p.x), cy = Y(p.y), a = 0.42 * s;
            g.beginPath();
            if (mau) { g.moveTo(cx - a * 0.7, cy - a * 0.7); g.lineTo(cx + a * 0.7, cy + a * 0.7); g.moveTo(cx + a * 0.7, cy - a * 0.7); g.lineTo(cx - a * 0.7, cy + a * 0.7); }
            else { g.moveTo(cx - p.dx * a - p.dy * a, cy - p.dy * a + p.dx * a); g.lineTo(cx + p.dx * a * 0.5, cy + p.dy * a * 0.5); g.lineTo(cx - p.dx * a + p.dy * a, cy - p.dy * a - p.dx * a); }
            g.stroke();
        }
        zonas.push({ tipo: 'troco', id: codigo, pts: cam.pts.map(([x, y]) => [X(x), Y(y)]), raio: b / 2 + 4 });
    }
    // Malas, na posição em que estão em cada troço
    if (dados) {
        const r = Math.max(2, 0.5 * s);
        for (const tr of Object.values(dados.trocos)) {
            const cam = CAMINHOS[tr.codigo]; if (!cam) continue;
            for (const passo of tr.passos) {
                if (passo.tIn > t) break;
                if (passo.tOut <= t) continue;
                const mala = passo.mala; ponto(cam, 1.7 + (cam.comp - 3.4) * Math.max(0, Math.min(1, passo.pos / tr.comp)), q);
                const cx = X(q.x) + (mala ? ((mala.indice * 7) % 5 - 2) * 0.12 * s * -q.dy : 0), cy = Y(q.y) + (mala ? ((mala.indice * 7) % 5 - 2) * 0.12 * s * q.dx : 0);
                g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fillStyle = mala?.cor ?? '#ffffff'; g.fill(); g.strokeStyle = '#05090e'; g.lineWidth = Math.max(0.6, 0.1 * s); g.stroke();
                if (mala && selecao?.tipo === 'mala' && selecao.id === mala.codigo) { g.beginPath(); g.arc(cx, cy, r + 0.45 * s, 0, 6.3); g.strokeStyle = COR.ciano; g.lineWidth = Math.max(1.5, 0.25 * s); g.stroke(); }
                if (mala) zonas.push({ tipo: 'mala', id: mala.codigo, x: cx, y: cy, raio: r + 3 });
            }
        }
    }
    // Carga e motor de cada troço
    for (const [codigo, cam] of Object.entries(CAMINHOS)) {
        const tr = dados?.trocos[codigo], mau = !!tr && f.avariado(tr, t), n1 = carga[codigo] ?? 0, cap = tr?.capacidade ?? 0;
        ponto(cam, cam.pts.length === 2 ? cam.comp / 2 : cam.acum[1] / 2, p);
        const fixo = ANCORAS[codigo], cx = fixo ? X(fixo[0]) : X(p.x - p.dy * 2.25), cy = fixo ? Y(fixo[1]) : Y(p.y + p.dx * 2.25), vertical = Math.abs(p.dy) > 0.5, w = 5.3 * s, h = 1.7 * s;
        const bx = vertical ? cx - (p.dy > 0 ? w - 0.85 * s : 0.85 * s) : cx - w / 2, by = cy - h / 2;
        caixa(bx, by, w, h, '#0a141f', 2.5, mau ? COR.vermelho : COR.borda);
        g.beginPath(); g.arc(bx + 0.85 * s, cy, 0.48 * s, 0, 6.3); g.fillStyle = mau ? (pulso > 0.5 ? COR.vermelho : '#8f241b') : !tr ? COR.fraco : COR.verde; g.fill();
        g.font = `700 ${Math.max(6.5, 1.02 * s)}px ${MONO}`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillStyle = mau ? COR.vermelho : cap && n1 >= cap * 0.9 ? COR.ambar : n1 ? COR.texto : COR.suave;
        g.fillText(tr ? `${n1}/${cap}` : '—', bx + w - 0.4 * s, cy + 0.5);
    }
    // Nós
    const noCaixa = (codigo, w, h, cor, linhas, opc = {}) => {
        const [x, y] = NOS[codigo], x0 = X(x - w / 2), y0 = Y(y - h / 2 + (opc.dy ?? 0)), escolhido = selecao && selecao.tipo !== 'troco' && selecao.tipo !== 'mala' && selecao.id === codigo;
        if (escolhido) caixa(x0 - 0.35 * s, y0 - 0.35 * s, (w + 0.7) * s, (h + 0.7) * s, null, 4, COR.ciano), g.lineWidth = Math.max(2, 0.3 * s), g.stroke();
        caixa(x0, y0, w * s, h * s, cor, 3, opc.borda ?? '#ffffff55');
        linhas.forEach(([texto, tam, corT, peso], i) => { g.font = `${peso ?? 700} ${Math.max(6.5, tam * s)}px ${FONTE}`; g.fillStyle = corT ?? '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texto, X(x), y0 + h * s * (i + 0.5) / linhas.length + (linhas.length > 1 ? (i ? -0.12 * i : 0.18) * s : 0.5)); });
        zonas.push({ tipo: SAIDAS.includes(codigo) ? 'saida' : 'no', id: codigo, x: x0, y: y0, w: w * s, h: h * s });
        return [x0, y0];
    };
    for (const e of ['C1', 'C2']) { const porEntrar = dados ? dados.malas.filter(mm => mm.entrada === e && !(mm.passos.length && mm.passos[0].tIn <= t)).length : 0; noCaixa(e, 6.4, 4.4, COR.entrada, [[e, 1.35], [dados ? `${porEntrar} por entrar` : 'check-in', 0.92, '#c7d2dc', 500]]); }
    for (const codigo of Object.keys(EM_FRENTE)) {
        let ativoK = 0;
        for (const tau of dados?.desvios[codigo] ?? []) { if (tau > t + 0.06) break; ativoK = Math.max(ativoK, 1 - Math.abs(t - tau) / 0.06); }
        noCaixa(codigo, 4.4, 3.5, COR.no, [[codigo, 1.45]], { borda: ativoK > 0 ? COR.ambar : '#ffffff55' });
        const [x, y] = NOS[codigo], alvo = NOS[DESVIO[codigo]], ax = X(x), ay = Y(y + 1.75 + 0.75);     // seta do desvio, acesa quando o braço fecha
        if (alvo) { g.beginPath(); g.moveTo(ax - 0.55 * s, ay - 0.35 * s); g.lineTo(ax + 0.55 * s, ay - 0.35 * s); g.lineTo(ax, ay + 0.45 * s); g.closePath(); g.fillStyle = ativoK > 0 ? COR.ambar : '#31465b'; g.fill(); }
    }
    {
        let ult = null; if (dados) { const i = ate(sc.leiturasT, t); ult = dados.leituras[i - 1] ?? null; }
        const flash = ult ? Math.max(0, 1 - (t - ult.t) / 0.06) : 0;
        const [x0, y0] = noCaixa('LEITOR', 8.6, 6.6, COR.leitor, [['LEITOR', 1.35], [ult ? ult.mala : 'à espera', 0.92, '#fff3d6', 500], [ult ? '→ ' + nomeNo(ult.destino) + (ult.vez > 1 ? ` (${ult.vez}.ª)` : '') : '', 0.98, ult?.destino === 'INSPECAO' ? '#ffd9a8' : '#d6ffe6', 700]], { borda: flash > 0 ? '#ffffff' : '#ffffff55' });
        if (flash > 0) { g.strokeStyle = `rgba(255,255,255,${flash})`; g.lineWidth = Math.max(2, 0.4 * s); g.strokeRect(x0 - 0.3 * s, y0 - 0.3 * s, 9.2 * s, 7.2 * s); }
    }
    noCaixa('RET', 5.6, 3.5, COR.retorno, [['RET', 1.4]]);
    noCaixa('INSPECAO', 11, 4.6, COR.inspecao, [['INSPEÇÃO', 1.25], [dados ? `${n.inspecao} malas` : 'posto manual', 0.95, '#ffe2d6', 500]]);
    for (const sd of SAIDAS) {
        const info = dados?.saidas[sd], voo = info?.voo ?? null, feitas = n.saidas[sd] ?? 0, erradas = n.erradas[sd] ?? 0, partiu = info && t >= info.partida;
        const [x0, y0] = noCaixa(sd, 11.6, 7.4, '#0c1a17', [], { dy: 3.6, borda: erradas ? COR.vermelho : COR.saida });
        const w = 11.6 * s;
        g.fillStyle = voo?.cor ?? COR.fraco; g.fillRect(x0 + 0.5 * s, y0 + 0.55 * s, 0.55 * s, 2.5 * s);
        g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = `700 ${Math.max(7, 1.5 * s)}px ${FONTE}`; g.fillStyle = '#fff'; g.fillText(sd, x0 + 1.5 * s, y0 + 1.25 * s);
        g.font = `600 ${Math.max(6.5, 1.0 * s)}px ${FONTE}`; g.fillStyle = COR.suave; g.fillText(voo ? `${voo.voo} · ${hhmm(voo.hora)}` : 'sem voo', x0 + 1.5 * s, y0 + 2.7 * s);
        g.textAlign = 'right'; g.font = `700 ${Math.max(7, 1.3 * s)}px ${MONO}`; g.fillStyle = voo && feitas >= voo.total ? COR.verde : COR.texto; g.fillText(`${feitas}/${voo?.total ?? 0}`, x0 + w - 0.6 * s, y0 + 1.3 * s);
        g.fillStyle = '#1b2c3d'; g.fillRect(x0 + 0.5 * s, y0 + 3.75 * s, w - s, 0.8 * s);
        if (voo) { g.fillStyle = voo.cor; g.fillRect(x0 + 0.5 * s, y0 + 3.75 * s, (w - s) * Math.min(1, feitas / voo.total), 0.8 * s); }
        g.textAlign = 'left'; g.font = `700 ${Math.max(6, 0.88 * s)}px ${FONTE}`; g.fillStyle = !voo ? COR.fraco : partiu ? COR.ciano : feitas ? COR.verde : COR.ambar;
        g.fillText(!voo ? 'LIVRE' : partiu ? 'REBOQUES NA PLACA' : feitas >= voo.total ? 'COMPLETO' : feitas ? 'A CARREGAR' : 'A AGUARDAR', x0 + 0.5 * s, y0 + 6.0 * s);
        if (erradas) { g.textAlign = 'right'; g.font = `700 ${Math.max(6.5, 1.0 * s)}px ${MONO}`; g.fillStyle = COR.vermelho; g.fillText(`+${erradas}`, x0 + w - 0.6 * s, y0 + 2.75 * s); }
    }
    if (!dados) { txt('Sem dados: executa um programa da central de triagem (níveis 23 a 25)', R.x + R.w / 2, R.y + R.h - px(16), { tam: 12.5, cor: COR.suave, alinha: 'center' }); }
    // Legenda
    if (dados && !compacto) {
        let lx = R.x + px(12); const ly = R.y + px(15);
        for (const v of Object.values(dados.voos)) { g.fillStyle = v.cor; g.beginPath(); g.arc(lx + px(4), ly, px(4.5), 0, 6.3); g.fill(); txt(`${v.voo} → ${v.saida}`, lx + px(13), ly, { tam: 10.5, cor: COR.suave }); lx += px(96); }
        for (const [cor, nome] of [['#f4f4ee', 'ilegível'], ['#8a8f96', 'sem partida']]) { g.fillStyle = cor; g.beginPath(); g.arc(lx + px(4), ly, px(4.5), 0, 6.3); g.fill(); txt(nome, lx + px(13), ly, { tam: 10.5, cor: COR.suave }); lx += px(78); }
    }

    // --- Listas: alarmes e eventos -------------------------------------------------------------
    const linhasAlarme = () => {
        if (!dados) return [];
        const linhas = [];
        for (const a of sc.alarmes) if (a.t <= t) linhas.push({ t: a.t, ativo: t < a.fim, prio: 1, texto: a.texto, estado: t < a.fim ? 'ATIVO' : `normal. ${hhmm(a.fim)}`, alvo: { tipo: 'troco', id: a.troco } });
        for (const e of sc.eventos) { const qt = ate(e.tempos, t); if (qt) linhas.push({ t: e.tempos[qt - 1], ativo: false, prio: 2, texto: qt > 1 ? `${e.plural.replace(/#/g, '…')} ×${qt}` : e.primeiro, estado: '', alvo: e.saida ? { tipo: 'saida', id: e.saida } : null }); }
        return linhas.sort((a, z) => (z.ativo - a.ativo) || (a.prio - z.prio) * (a.ativo ? 1 : 0) || z.t - a.t);
    };
    const listaAlarmes = (x, y, w, h) => {
        const linhas = linhasAlarme(), ativos = linhas.filter(l => l.ativo && l.prio === 1).length;
        let yy = painel(x, y, w, h, 'ALARMES E EVENTOS', ativos ? `${ativos} ativo${ativos > 1 ? 's' : ''}` : 'sem alarmes ativos');
        const hl = px(21), cabem = Math.max(0, Math.floor((y + h - yy - px(4)) / hl));
        if (!linhas.length) txt(dados ? 'Sem ocorrências até agora' : '—', x + px(10), yy + hl / 2, { tam: 11.5, cor: COR.fraco });
        linhas.slice(0, cabem).forEach((l, i) => {
            const cy = yy + hl * (i + 0.5), cor = l.prio === 1 ? (l.ativo ? COR.vermelho : COR.suave) : l.ativo ? COR.ambar : COR.suave;
            if (l.ativo && l.prio === 1) caixa(x + px(4), cy - hl / 2 + 1, w - px(8), hl - 2, pulso > 0.5 ? '#5e1712' : '#3a100c', 2);
            g.fillStyle = cor; g.fillRect(x + px(8), cy - px(6), px(3), px(12));
            txt(hhmm(l.t), x + px(16), cy, { tam: 11, mono: true, cor: COR.suave }); if (l.estado) txt(l.estado, x + w - px(9), cy, { tam: 9.5, peso: 700, cor, alinha: 'right' });
            txt(l.texto, x + px(58), cy, { tam: 11.5, cor: l.ativo ? COR.texto : '#b4c1cc', max: w - px(68) - (l.estado ? px(l.estado.length * 6.2 + 8) : 0) });
            if (l.alvo) zonas.push({ ...l.alvo, x: x + px(4), y: cy - hl / 2, w: w - px(8), h: hl });
        });
        if (linhas.length > cabem && cabem) txt(`+${linhas.length - cabem}`, x + w - px(10), y + h - px(9), { tam: 9.5, cor: COR.fraco, alinha: 'right' });
    };
    const tabelaPartidas = (x, y, w, h) => {
        let yy = painel(x, y, w, h, 'PARTIDAS'); const hl = Math.min(px(24), (y + h - yy - px(4)) / 4);
        SAIDAS.forEach((sd, i) => {
            const info = dados?.saidas[sd], voo = info?.voo ?? null, cy = yy + hl * (i + 0.5), feitas = n.saidas[sd] ?? 0, erradas = n.erradas[sd] ?? 0;
            if (selecao?.tipo === 'saida' && selecao.id === sd) caixa(x + px(4), cy - hl / 2 + 1, w - px(8), hl - 2, '#12283a', 2, COR.ciano);
            g.fillStyle = voo?.cor ?? COR.fraco; g.fillRect(x + px(9), cy - px(7), px(4), px(14));
            txt(sd, x + px(20), cy, { tam: 12, peso: 700 }); txt(voo ? voo.voo : '—', x + px(56), cy, { tam: 12, mono: true }); txt(voo ? `${voo.destino} ${hhmm(voo.hora)}` : 'sem voo', x + px(110), cy, { tam: 11, cor: COR.suave, max: w * 0.3 });
            const bx = x + w * 0.62, bw = w * 0.2; g.fillStyle = '#1b2c3d'; g.fillRect(bx, cy - px(4), bw, px(8)); if (voo) { g.fillStyle = voo.cor; g.fillRect(bx, cy - px(4), bw * Math.min(1, feitas / voo.total), px(8)); }
            txt(`${feitas}/${voo?.total ?? 0}`, x + w - px(10), cy, { tam: 12, mono: true, peso: 700, alinha: 'right', cor: voo && feitas >= voo.total ? COR.verde : COR.texto });
            if (erradas) txt(`+${erradas}`, bx - px(6), cy, { tam: 10.5, mono: true, peso: 700, alinha: 'right', cor: COR.vermelho });
            zonas.push({ tipo: 'saida', id: sd, x: x + px(4), y: cy - hl / 2, w: w - px(8), h: hl });
        });
    };
    const tendencia = (x, y, w, h) => {
        const yy = painel(x, y, w, h, 'TENDÊNCIA', ''), gx = x + px(34), gw = w - px(46), gy = yy + px(2), gh = y + h - gy - px(18);
        let lx = x + px(96); for (const [cor, nome] of [[COR.ciano, 'em tapete'], [COR.verde, 'triadas'], [COR.ambar, 'inspeção e erradas']]) { g.fillStyle = cor; g.fillRect(lx, y + px(11), px(12), px(3)); txt(nome, lx + px(17), y + px(13), { tam: 10, cor: COR.suave }); lx += px(nome.length * 6 + 34); }
        if (gh < px(20) || !dados) { if (!dados) txt('—', gx, gy + gh / 2, { cor: COR.fraco }); return; }
        const t0 = dados.inicio, t1 = sc.fim, tx = v => gx + gw * (v - t0) / (t1 - t0), maxE = Math.max(sc.maxTapete, sc.total);
        g.strokeStyle = '#18283a'; g.lineWidth = 1; for (let i = 0; i <= 2; i++) { const ly = gy + gh * i / 2; g.beginPath(); g.moveTo(gx, ly); g.lineTo(gx + gw, ly); g.stroke(); txt(String(Math.round(maxE * (1 - i / 2))), gx - px(5), ly, { tam: 9, cor: COR.fraco, alinha: 'right', mono: true }); }
        for (let v = Math.ceil(t0 / 5) * 5; v <= t1; v += 5) txt(hhmm(v), tx(v), gy + gh + px(9), { tam: 9, cor: COR.fraco, alinha: 'center', mono: true });
        for (const a of sc.alarmes) if (a.t <= t) { g.fillStyle = '#ff4d3d2a'; g.fillRect(tx(a.t), gy, tx(Math.min(a.fim, t, t1)) - tx(a.t), gh); }
        const linha = (campo, cor, area) => {
            g.beginPath(); let ultimoX = gx, comecou = false;
            for (const pt of sc.serie) { if (pt.t > t) break; const xx = tx(pt.t), yv = gy + gh * (1 - pt[campo] / maxE); if (comecou) g.lineTo(xx, yv); else { g.moveTo(xx, yv); comecou = true; } ultimoX = xx; }
            if (!comecou) return;
            g.strokeStyle = cor; g.lineWidth = Math.max(1.5, 1.8 * k); g.stroke();
            if (area) { g.lineTo(ultimoX, gy + gh); g.lineTo(gx, gy + gh); g.closePath(); g.fillStyle = cor + '22'; g.fill(); }
        };
        linha('tapete', COR.ciano, true); linha('triadas', COR.verde, false); linha('outras', COR.ambar, false);
        if (t <= t1) { g.strokeStyle = '#ffffff88'; g.lineWidth = 1; g.beginPath(); g.moveTo(tx(t), gy); g.lineTo(tx(t), gy + gh); g.stroke(); }
    };

    let cctv = null;
    if (compacto) {                              // visor pequeno: só o sinótico e uma linha com o alarme ou o último evento
        const l = linhasAlarme()[0], y = H - hBase - m;
        caixa(m, y, W - 2 * m, hBase, l?.ativo && l.prio === 1 ? (pulso > 0.5 ? '#5e1712' : '#3a100c') : COR.painel, 4, COR.borda);
        txt(l ? `${hhmm(l.t)} · ${l.texto}${l.estado ? ' · ' + l.estado : ''}` : 'Sem ocorrências', m + px(8), y + hBase / 2, { tam: 11.5, cor: l ? COR.texto : COR.suave, max: W - 2 * m - px(16) });
    } else {
        const x = W - wCol, w = wCol - m, y0 = hTopo + m, hTot = H - y0 - m;
        if (mural) {
            const hA = Math.round(hTot * 0.36), hP = px(126);
            listaAlarmes(x, y0, w, hA); tabelaPartidas(x, y0 + hA + m, w, hP); tendencia(x, y0 + hA + hP + 2 * m, w, hTot - hA - hP - 2 * m);
        } else {
            const hP = px(126), hD = px(142), hC = Math.max(px(120), Math.min(Math.round(hTot * 0.36), Math.round(w * 0.6))), hA = Math.max(px(70), hTot - hP - hD - hC - 3 * m);
            listaAlarmes(x, y0, w, hA); tabelaPartidas(x, y0 + hA + m, w, hP);
            const d = detalhe(c); let yy = painel(x, y0 + hA + hP + 2 * m, w, hD, d.titulo);
            for (const [rotulo, valor, cor] of d.linhas) { if (rotulo) txt(rotulo, x + px(10), yy + px(9), { tam: 11, cor: COR.suave }); txt(valor, x + (rotulo ? px(118) : px(10)), yy + px(9), { tam: 11.5, cor: cor ?? (rotulo ? COR.texto : COR.suave), peso: rotulo ? 600 : 400, max: w - (rotulo ? px(128) : px(20)) }); yy += px(22); }
            cctv = { x, y: y0 + hA + hP + hD + 3 * m, w, h: hTot - hA - hP - hD - 3 * m };
            caixa(cctv.x, cctv.y, cctv.w, cctv.h, '#05090e', 5, COR.borda);
            tendencia(m, H - hBase - m, W - wCol - 2 * m, hBase);
        }
    }
    return { zonas, cctv };
}

// Elemento do sinótico debaixo do ponto (x, y), em píxeis do canvas: malas primeiro, depois nós e troços.
export function zonaEm(zonas, x, y) {
    let melhor = null;
    for (const z of zonas) if (z.tipo === 'mala' && Math.hypot(x - z.x, y - z.y) <= z.raio) melhor = z;
    if (melhor) return melhor;
    for (const z of zonas) if (z.w !== undefined && x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z;
    for (const z of zonas) if (z.tipo === 'troco' && z.pts) for (let i = 1; i < z.pts.length; i++) {
        const [ax, ay] = z.pts[i - 1], [bx, by] = z.pts[i], dx = bx - ax, dy = by - ay, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(x - ax - dx * u, y - ay - dy * u) <= z.raio) return z;
    }
    return null;
}
