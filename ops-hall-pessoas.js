// Bloco 4 · Relatório do dia, Fase 6: operadores em modelos glTF (.glb) no centro de operações.
// Usa os modelos partilhados por todas as salas (pessoas-glb.js, modelos/pessoas/). Sentados nas
// consolas, de pé junto à mesa do dia. Se faltarem os modelos, ficam as pessoas do código.
import { carregarElenco, criarFigura } from './pessoas-glb.js?v=pessoas-1';
import * as THREE from 'three';

export async function carregarPessoas(scene, modelo) {
    const elenco = await carregarElenco();
    if (!elenco) return null;
    const grupo = new THREE.Group(); grupo.name = 'Operadores (glTF)'; modelo.sala.add(grupo);
    const figuras = modelo.lugares.map(lugar => {
        const f = criarFigura(elenco, lugar.semente, { papel: lugar.sentado ? 'operador' : 'agente' });
        f.figura.position.set(lugar.x, lugar.y, lugar.z); f.figura.rotation.y = lugar.ry + Math.PI;   // as pessoas do código olham para -z; o glTF olha para +z
        grupo.add(f.figura);
        return { f, sentado: lugar.sentado };
    });
    if (modelo.pessoasMalha) modelo.pessoasMalha.visible = false;
    return { grupo, atualizar: dt => { for (const { f, sentado } of figuras) f.atualizar(dt, { sentado, velocidade: 0 }); } };
}
