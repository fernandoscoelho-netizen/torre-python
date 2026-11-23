// Painel «Missões»: um só sítio para escolher exemplos, exercícios livres e níveis.
// Também mantém o estado no topo (missão atual e progresso) e o enunciado recolhível.
import {LEVELS} from './curriculum.js?v=enunciados-1';
import {FREE_EXERCISES} from './free-exercises.js';

const $ = id => document.getElementById(id);
const CHAVE_PROGRESSO = 'porto-python.learning.v1';
const CHAVE_ENUNCIADO = 'porto-python.brief.v1';
const PROFESSOR = new URLSearchParams(location.search).has('professor_fcoelho');
const LIVRES = Object.entries(FREE_EXERCISES).sort((a, b) => a[1].number - b[1].number);

function progresso() {
    const vivo = window.learningPath?.progress;
    if (vivo) return vivo;
    try {
        const guardado = JSON.parse(localStorage.getItem(CHAVE_PROGRESSO)) || {};
        return {levels: guardado.levels || {}, active: guardado.active || null, professor: PROFESSOR};
    } catch {
        return {levels: {}, active: null, professor: PROFESSOR};
    }
}

function aberto(i, p) {
    return p.professor || i === 0 || !!p.levels[LEVELS[i - 1].id]?.passed;
}

function el(tag, props = {}, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    e.append(...filhos);
    return e;
}

function estadoTopo() {
    const p = progresso();
    const feitos = LEVELS.filter(l => p.levels[l.id]?.passed).length;
    const nivel = LEVELS.find(l => l.id === p.active);
    if (nivel) {
        $('mission-chip').textContent = 'NÍVEL ' + nivel.number;
        $('mission-name').textContent = nivel.title;
    } else {
        const modo = $('lesson-mode')?.value || 'guided';
        const ex = FREE_EXERCISES[modo] || FREE_EXERCISES.guided;
        $('mission-chip').textContent = ex.number <= 2 ? 'EXEMPLO ' + ex.number : 'EXERCÍCIO ' + ex.number;
        $('mission-name').textContent = ex.title;
    }
    $('mission-count').textContent = feitos + '/' + LEVELS.length;
    $('mission-bar').style.width = (100 * feitos / LEVELS.length) + '%';
    return {p, feitos};
}

function abrirLivre(modo) {
    const select = $('lesson-mode');
    if (!select) return;
    select.value = modo;
    select.dispatchEvent(new Event('change'));
    fecharPainel();
}

function abrirNivel(id) {
    window.learningPath?.open(id);
    fecharPainel();
}

function renderPainel() {
    const {p, feitos} = estadoTopo();
    const corpo = $('missions-body');
    if (!corpo || $('missions-panel').hidden) return;
    const nivelAtivo = p.active;
    const modo = nivelAtivo ? null : ($('lesson-mode')?.value || 'guided');
    corpo.replaceChildren();

    const comecar = el('section', {class: 'missions-group'}, el('h3', {text: '1 · Começar'}));
    const exercicios = el('div', {class: 'missions-free'});
    for (const [id, ex] of LIVRES) {
        const atual = id === modo;
        const botao = el('button', {
            class: 'mission-item' + (atual ? ' current' : ''),
            'aria-current': atual ? 'true' : false,
            onclick: () => abrirLivre(id)
        }, el('b', {text: String(ex.number)}), el('span', {text: ex.title}),
            el('small', {text: ex.daily ? '' : 'Exemplo guiado'}));
        if (ex.number <= 2) comecar.append(botao);
        else exercicios.append(botao);
    }
    const livres = el('section', {class: 'missions-group'},
        el('h3', {text: '2 · Exercícios livres · horário do dia'}), exercicios);

    const grelha = el('div', {class: 'missions-levels'});
    for (const [i, l] of LEVELS.entries()) {
        const feito = !!p.levels[l.id]?.passed;
        const livre = aberto(i, p);
        const atual = l.id === nivelAtivo;
        const estado = feito ? 'concluído' : atual ? 'atual' : livre ? 'disponível' : 'bloqueado';
        grelha.append(el('button', {
            class: 'level-tile ' + (feito ? 'done' : livre ? 'open' : 'locked') + (atual ? ' current' : ''),
            title: 'Nível ' + l.number + ' · ' + l.title + ' · ' + estado,
            'aria-label': 'Nível ' + l.number + ', ' + l.title + ', ' + estado,
            'aria-current': atual ? 'true' : false,
            disabled: !livre,
            onclick: () => abrirNivel(l.id)
        }, el('b', {text: String(l.number)}), el('small', {text: feito ? '✓' : atual ? '●' : livre ? '' : '—'})));
    }
    const proximo = LEVELS.find((l, i) => aberto(i, p) && !p.levels[l.id]?.passed);
    const niveis = el('section', {class: 'missions-group'},
        el('h3', {}, '3 · Percurso · ' + LEVELS.length + ' níveis', el('span', {text: feitos + ' concluídos'})),
        grelha,
        el('p', {class: 'missions-legend', text: '✓ concluído · ● atual · — bloqueado (conclui o anterior)'}));
    if (proximo && proximo.id !== nivelAtivo) {
        niveis.append(el('button', {class: 'missions-next', onclick: () => abrirNivel(proximo.id)},
            'Continuar: nível ' + proximo.number + ' · ' + proximo.title));
    }
    corpo.append(comecar, livres, niveis);
}

function marcarRail(id) {
    for (const b of document.querySelectorAll('.activity-rail .rail-btn')) b.classList.toggle('selected', b.id === id);
}

function abrirPainel() {
    const painel = $('missions-panel');
    painel.hidden = false;
    $('nav-missions').setAttribute('aria-expanded', 'true');
    marcarRail('nav-missions');
    renderPainel();
    (painel.querySelector('.current') || painel.querySelector('button'))?.focus();
}

function fecharPainel() {
    const painel = $('missions-panel');
    if (painel.hidden) return;
    painel.hidden = true;
    $('nav-missions').setAttribute('aria-expanded', 'false');
    marcarRail('nav-code');
}

function enunciado(recolhido, guardar = true) {
    const painel = document.querySelector('.program-panel');
    painel.classList.toggle('brief-collapsed', recolhido);
    const botao = $('brief-toggle');
    botao.setAttribute('aria-expanded', String(!recolhido));
    botao.textContent = recolhido ? 'Ver enunciado ▾' : 'Recolher ▴';
    if (guardar) try { localStorage.setItem(CHAVE_ENUNCIADO, recolhido ? '1' : '0'); } catch {}
    window.dispatchEvent(new Event('workspace-layout-change'));
    window.dispatchEvent(new Event('resize'));
}

function init() {
    $('nav-missions').onclick = () => ($('missions-panel').hidden ? abrirPainel() : fecharPainel());
    $('missions-close').onclick = fecharPainel;
    $('missions-details').onclick = () => { fecharPainel(); $('learning-open').click(); };
    for (const id of ['nav-code', 'nav-guide', 'nav-parks']) {
        $(id).addEventListener('click', () => { fecharPainel(); marcarRail(id); });
    }
    // Guia: abre o guia de Python na janela de leitura, bem visível.
    $('nav-guide').addEventListener('click', () => {
        setTimeout(() => {
            const ler = $('output-read-open');
            if (ler && !ler.disabled) ler.click();
        }, 0);
    });
    // Lugares: sai do horário do dia, mostra a tabela de parqueamentos e destaca-a.
    $('nav-parks').addEventListener('click', () => {
        if (document.body.classList.contains('day-mode')) $('day-close')?.click();
        setTimeout(() => {
            const dados = document.querySelector('.airport-data');
            if (!dados) return;
            dados.scrollIntoView({block: 'nearest'});
            const r = dados.getBoundingClientRect();
            const marca = el('div', {class: 'destaque-lugares', 'aria-hidden': 'true'});
            Object.assign(marca.style, {left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px'});
            document.body.append(marca);
            setTimeout(() => { marca.remove(); marcarRail('nav-code'); }, 1400);
            dados.querySelector('[data-data="stands"]')?.focus();
        }, 50);
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !$('missions-panel').hidden && !document.querySelector('dialog[open]')) fecharPainel();
    });
    document.querySelector('.lab-panels')?.addEventListener('pointerdown', fecharPainel);
    window.addEventListener('missions-change', renderPainel);
    $('output-reading-dialog')?.addEventListener('close', () => {
        if ($('missions-panel').hidden) marcarRail('nav-code');
        // Guia e Funções do jogo só se consultam na janela de leitura: o painel de baixo volta à consola.
        const sel = document.querySelector('.output-tabs [aria-selected="true"]');
        if (!sel || sel.id === 'tab-functions' || sel.id === 'tab-guide') setTimeout(() => $('tab-console')?.click(), 0);
    });
    $('brief-toggle').onclick = () => enunciado(!document.querySelector('.program-panel').classList.contains('brief-collapsed'));
    let recolhido = false;
    try { recolhido = localStorage.getItem(CHAVE_ENUNCIADO) === '1'; } catch {}
    if (recolhido) enunciado(true, false);
    estadoTopo();
}

init();
