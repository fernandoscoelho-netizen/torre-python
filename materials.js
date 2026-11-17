// Janela «Materiais»: manual do aluno e caderno de missões (PDF em materiais/, só na versão publicada).
const $ = id => document.getElementById(id);

async function verificar() {
    const links = [...document.querySelectorAll('#materials-dialog a[data-material]')];
    const estados = await Promise.all(links.map(async a => {
        try {
            const r = await fetch(a.getAttribute('href'), {method: 'HEAD', cache: 'no-store'});
            return r.ok;
        } catch {
            return false;
        }
    }));
    links.forEach((a, i) => a.classList.toggle('indisponivel', !estados[i]));
    $('materials-note').hidden = estados.every(Boolean);
}

function init() {
    const dialogo = $('materials-dialog');
    if (!dialogo) return;
    $('materials-open').onclick = () => {
        dialogo.showModal();
        verificar();
    };
    $('materials-close').onclick = () => dialogo.close();
    dialogo.addEventListener('click', e => {
        if (e.target === dialogo) dialogo.close();
    });
}

init();
