// Mostra o enunciado de um nível a partir de um texto com marcação simples:
//   linha em branco      -> novo parágrafo
//   linha "- item"       -> lista com marcas
//   `código`             -> código em letra de máquina
//   **texto**            -> negrito (etiquetas como «Tarefa.» ou «Atenção:»)
// Um primeiro parágrafo «Bloco N · …» aparece como etiqueta do bloco.
// Constrói o DOM com textContent: o texto nunca é interpretado como HTML.

function inline(parent, text) {
  const parts = text.split('`');
  parts.forEach((part, i) => {
    if (!part) return;
    if (i % 2) {
      const code = document.createElement('code');
      code.textContent = part;
      parent.append(code);
      return;
    }
    part.split('**').forEach((piece, j) => {
      if (!piece) return;
      if (j % 2) {
        const strong = document.createElement('strong');
        strong.textContent = piece;
        parent.append(strong);
      } else parent.append(document.createTextNode(piece));
    });
  });
}

export function renderEnunciado(root, text) {
  root.replaceChildren();
  const blocks = String(text || '').trim().split(/\n\s*\n/);
  blocks.forEach((block, index) => {
    const lines = block.split('\n');
    if (index === 0 && lines.length === 1 && /^Bloco \d/.test(block)) {
      const kicker = document.createElement('p');
      kicker.className = 'enunciado-bloco';
      kicker.textContent = block.replace(/\.\s*$/, '');
      root.append(kicker);
      return;
    }
    let list = null, para = null;
    for (const line of lines) {
      if (line.startsWith('- ')) {
        para = null;
        if (!list) { list = document.createElement('ul'); root.append(list); }
        const li = document.createElement('li');
        inline(li, line.slice(2));
        list.append(li);
      } else {
        list = null;
        if (para) para.append(document.createTextNode(' '));
        else { para = document.createElement('p'); root.append(para); }
        inline(para, line);
      }
    }
  });
}
