// Janela «Materiais»: vídeo de introdução, manual do aluno e caderno de missões
// (ficheiros em materiais/, só na versão publicada; no servidor de desenvolvimento estão em manual/).
// O vídeo abre sozinho na primeira visita, até o aluno escolher «Não voltar a mostrar» ou o ver até ao fim.
const $ = id => document.getElementById(id);
const CHAVE_INTRO = 'porto-python.intro.v1';

async function existe(url) {
    try {
        const r = await fetch(url, {method: 'HEAD', cache: 'no-store'});
        return r.ok;
    } catch {
        return false;
    }
}

async function verificar() {
    const links = [...document.querySelectorAll('#materials-dialog a[data-material]')];
    const estados = await Promise.all(links.map(a => existe(a.getAttribute('href'))));
    links.forEach((a, i) => a.classList.toggle('indisponivel', !estados[i]));
    $('materials-note').hidden = estados.every(Boolean);
}

function introVista() {
    try {
        return localStorage.getItem(CHAVE_INTRO) === 'vista';
    } catch {
        return true;
    }
}

function marcarIntro() {
    try {
        localStorage.setItem(CHAVE_INTRO, 'vista');
    } catch {}
}

function iniciarIntro() {
    const dialogo = $('intro-dialog'), video = $('intro-video');
    if (!dialogo || !video) return () => {};
    const fechar = () => {
        video.pause();
        if ($('intro-hide').checked) marcarIntro();
        if (dialogo.open) dialogo.close();
    };
    $('intro-close').onclick = fechar;
    $('intro-start').onclick = fechar;
    dialogo.addEventListener('cancel', e => {
        e.preventDefault();
        fechar();
    });
    dialogo.addEventListener('click', e => {
        if (e.target === dialogo) fechar();
    });
    video.addEventListener('ended', () => {
        $('intro-hide').checked = true;
        marcarIntro();
    });
    // No servidor de desenvolvimento a capa está em manual/.
    existe(video.getAttribute('poster')).then(ok => {
        if (!ok) video.poster = 'manual/torre-python-intro.jpg';
    });
    return (automatico = false) => {
        $('intro-hide').checked = automatico ? false : introVista();
        dialogo.showModal();
        $('intro-start').focus();
    };
}

function init() {
    const abrirIntro = iniciarIntro();
    const dialogo = $('materials-dialog');
    if (dialogo) {
        $('materials-open').onclick = () => {
            dialogo.showModal();
            verificar();
        };
        $('materials-close').onclick = () => dialogo.close();
        dialogo.addEventListener('click', e => {
            if (e.target === dialogo) dialogo.close();
        });
        const cartao = dialogo.querySelector('a[data-video]');
        if (cartao) cartao.addEventListener('click', e => {
            e.preventDefault();
            dialogo.close();
            abrirIntro();
        });
    }
    // Primeira visita: mostrar o vídeo depois de a página assentar, se existir.
    if (!introVista()) {
        setTimeout(async () => {
            const video = $('intro-video');
            const fontes = video ? [...video.querySelectorAll('source')].map(s => s.getAttribute('src')) : [];
            for (const f of fontes) {
                if (await existe(f)) {
                    if (!document.querySelector('dialog[open]')) abrirIntro(true);
                    return;
                }
            }
        }, 1200);
    }
}

init();
