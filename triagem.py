"""Motor da central de triagem do Torre Python (Bloco 2 · Bagagens, Fase 2).

Python puro, sem dependências do navegador: testa-se com python test-triagem.py
e é carregado pelo Worker como o bagagens.py.

A central é uma rede de tapetes: um grafo dirigido em que os nós são a entrada do
check-in, o leitor de etiquetas, os desviadores, o retorno e as saídas (zona de
preparação de cada voo), e as ligações são os troços de tapete.

Percurso de uma mala de partida:
    no_checkin -> em_tapete -> triada   (chegou à saída do seu voo)
Desvios: errada (chegou a uma saída que não é a do seu voo) e inspecao (etiqueta
ilegível, voo desconhecido, saída sem rota ou mala que recirculou demasiado).

O tempo é contado em minutos do dia (480 = 08:00) e avança minuto a minuto. A
simulação é determinística: com as mesmas partidas, as mesmas ordens e a mesma
semente, o registo de eventos é sempre igual. É esse registo que o JavaScript
reproduz em 3D.
"""
import random
from collections import deque

# Parâmetros didáticos (fictícios, não são valores operacionais reais)
DEBITO = 12            # malas que entram num troço por minuto
RITMO_CHECKIN = 6      # malas que cada linha do check-in entrega por minuto
MAX_LEITURAS = 3       # à terceira passagem pelo leitor sem chegar à saída, a mala vai para inspeção
DURACAO_AVARIA = 10    # minutos até o técnico reparar um troço

ESTADOS_MALA = ('no_checkin', 'em_tapete', 'triada', 'errada', 'inspecao')
ESTADOS_TROCO = ('ok', 'avariado')

# Rede didática: (origem, destino, minutos de percurso). A ordem das ligações de cada nó é a da lista.
TROCOS = [
    ('C1', 'LEITOR', 1), ('C2', 'LEITOR', 1),
    ('LEITOR', 'A1', 1), ('LEITOR', 'INSPECAO', 1),
    ('A1', 'A2', 1), ('A1', 'B1', 1),
    ('A2', 'A3', 1), ('A2', 'B2', 1),
    ('A3', 'A4', 1), ('A3', 'B3', 1),
    ('A4', 'RET', 1), ('A4', 'B4', 1),
    ('B1', 'B2', 1), ('B1', 'S01', 1),
    ('B2', 'B3', 1), ('B2', 'S02', 1),
    ('B3', 'B4', 1), ('B3', 'S03', 1),
    ('B4', 'RET', 2), ('B4', 'S04', 1),
    ('RET', 'LEITOR', 6),
]
TIPOS_NO = {'C1': 'entrada', 'C2': 'entrada', 'LEITOR': 'leitor', 'INSPECAO': 'inspecao', 'RET': 'retorno',
            'S01': 'saida', 'S02': 'saida', 'S03': 'saida', 'S04': 'saida'}   # os restantes são desviadores


def _hhmm(minuto):
    return f'{minuto // 60:02d}:{minuto % 60:02d}'


class TransicaoInvalida(ValueError):
    """Pedido que a central não pode cumprir no estado atual."""


def encontrar_rota(rede, origem, destino):
    """Caminho com menos troços entre dois nós (procura em largura), ou None se não houver."""
    if origem == destino:
        return [origem]
    anterior, fila = {origem: None}, deque([origem])
    while fila:
        no = fila.popleft()
        for vizinho in rede.get(no, ()):
            if vizinho in anterior:
                continue
            anterior[vizinho] = no
            if vizinho == destino:
                rota = [destino]
                while anterior[rota[-1]] is not None:
                    rota.append(anterior[rota[-1]])
                return rota[::-1]
            fila.append(vizinho)
    return None


class Mala:
    def __init__(self, codigo, voo, peso, legivel=True):
        self.codigo = codigo
        self.voo = voo
        self.peso = peso
        self.legivel = legivel
        self.estado = 'no_checkin'
        self.entrada = None        # linha do check-in por onde entra
        self.minuto_checkin = None
        self.troco = None
        self.pronta = None         # minuto em que chega ao fim do troço onde está
        self.destino = None        # saída decidida no leitor
        self.rota = None           # rota que recebeu no leitor (lista de nós)
        self.em_retorno = False    # perdeu a rota: volta ao leitor para ser lida outra vez
        self.leituras = 0
        self.lida = False          # já foi lida nesta passagem pelo leitor
        self.percurso = []         # nós por onde passou

    def dados(self):
        """O que o leitor de etiquetas entrega ao programa do aluno."""
        return {'codigo': self.codigo, 'voo': self.voo if self.legivel else None, 'peso': self.peso}

    def __repr__(self):
        return f'Mala({self.codigo!r}, {self.voo!r}, estado={self.estado!r})'


class Troco:
    def __init__(self, origem, destino, tempo):
        self.origem, self.destino, self.tempo = origem, destino, tempo
        self.codigo = f'{origem}>{destino}'
        self.capacidade = DEBITO * tempo
        self.estado = 'ok'
        self.malas = deque()
        self.parado_desde = None

    def __repr__(self):
        return f'Troco({self.codigo!r}, estado={self.estado!r}, malas={len(self.malas)})'


class Partida:
    def __init__(self, voo, destino, hora, saida, malas):
        self.voo, self.destino, self.hora, self.saida = voo, destino, hora, saida
        self.malas = list(malas)

    def __repr__(self):
        return f'Partida({self.voo!r}, {self.destino!r}, {_hhmm(self.hora)}, saida={self.saida!r}, malas={len(self.malas)})'


def criar_partida(voo, destino, hora, saida, n_malas, semente=1, ilegiveis=0):
    """Cria uma partida com malas de pesos fictícios. As últimas `ilegiveis` malas têm a etiqueta ilegível."""
    rng = random.Random(f'{voo}-{semente}')
    malas = [Mala(f'{voo}-{i:03d}', voo, round(rng.uniform(7, 23), 1), legivel=i <= n_malas - ilegiveis)
             for i in range(1, n_malas + 1)]
    return Partida(voo, destino, hora, saida, malas)


class CentralTriagem:
    """Central de triagem: rede de tapetes, leitor, desviadores, saídas e o relógio simulado."""

    def __init__(self, partidas, inicio=480, semente=1, sem_voo=0, programar=True, rotas=True):
        self.partidas = {p.voo: p for p in partidas}
        self.trocos = {(a, b): Troco(a, b, t) for a, b, t in TROCOS}
        self.nos = []
        for a, b, _ in TROCOS:
            for no in (a, b):
                if no not in self.nos:
                    self.nos.append(no)
        self.saidas = [n for n in self.nos if TIPOS_NO.get(n) == 'saida']
        self.entradas = [n for n in self.nos if TIPOS_NO.get(n) == 'entrada']
        self.inicio = self.minuto = inicio
        self.eventos = []
        self.ocorrencias = []
        self.rotas = {}
        self.programa = None
        self.avarias = {}          # minuto -> [(origem, destino, duracao)]
        self._reparacoes = {}      # minuto -> [troço]
        self._avisos = set()
        self.recirculacoes = 0
        # Malas sem voo conhecido (por exemplo, de um voo cancelado) e ordem de chegada ao check-in
        rng = random.Random(semente)
        self.malas = [m for p in partidas for m in p.malas]
        self.malas += [Mala(f'PY900-{i:03d}', 'PY900', round(rng.uniform(7, 23), 1)) for i in range(1, sem_voo + 1)]
        rng.shuffle(self.malas)
        self._checkin = {e: deque() for e in self.entradas}
        for i, mala in enumerate(self.malas):
            mala.entrada = self.entradas[i % len(self.entradas)]
            mala.minuto_checkin = inicio + i // (RITMO_CHECKIN * len(self.entradas))
            self._checkin[mala.entrada].append(mala)
        self._por_codigo = {m.codigo: m for m in self.malas}
        # Ordem de processamento: primeiro os troços mais perto das saídas, para libertar espaço a montante
        nivel = {'LEITOR': 0}
        fila = deque(['LEITOR'])
        while fila:
            no = fila.popleft()
            for (a, b) in self.trocos:
                if a == no and b not in nivel:
                    nivel[b] = nivel[no] + 1
                    fila.append(b)
        self._ordem = sorted(self.trocos.values(), key=lambda t: (t.destino == 'LEITOR', -nivel.get(t.origem, 0)))
        if programar:
            self.programa = self.programa_do_sistema
        if rotas:
            for saida in self.saidas:
                self.rotas[saida] = encontrar_rota(self.rede(), 'LEITOR', saida)
        self._rotas_iniciais = {s: list(r) for s, r in self.rotas.items()}
        self.origem = 'cenario'    # 'checkin' quando as malas vêm da zona de check-in (Fase 3)

    # --- registo -------------------------------------------------------------
    def _evento(self, tipo, **dados):
        self.eventos.append({'minuto': self.minuto, 'tipo': tipo, **dados})

    def _ocorrencia(self, texto, **dados):
        self.ocorrencias.append({'minuto': self.minuto, 'texto': texto, **dados})
        self._evento('ocorrencia', texto=texto, **dados)

    def _aviso(self, chave, texto, **dados):
        """Ocorrência que só é registada uma vez (para não repetir a mesma linha em cada mala)."""
        if chave not in self._avisos:
            self._avisos.add(chave)
            self._ocorrencia(texto, **dados)

    # --- consultas -----------------------------------------------------------
    def _troco(self, origem, destino):
        if (origem, destino) not in self.trocos:
            raise KeyError(f'Não existe nenhum troço de {origem} para {destino}.')
        return self.trocos[(origem, destino)]

    def rede(self, so_a_funcionar=True):
        """Grafo da central: {nó: [nós seguintes]}. Por omissão só entram os troços a funcionar."""
        grafo = {no: [] for no in self.nos}
        for (a, b), t in self.trocos.items():
            if t.estado == 'ok' or not so_a_funcionar:
                grafo[a].append(b)
        return grafo

    def consultar_partidas(self):
        return [{'voo': p.voo, 'destino': p.destino, 'hora': p.hora, 'saida': p.saida, 'malas': len(p.malas)}
                for p in self.partidas.values()]

    def consultar_rotas(self):
        return {saida: list(rota) for saida, rota in self.rotas.items() if rota}

    def consultar_trocos(self):
        return [{'origem': t.origem, 'destino': t.destino, 'estado': t.estado, 'malas': len(t.malas)}
                for t in self.trocos.values()]

    def estado_troco(self, origem, destino):
        return self._troco(origem, destino).estado

    def programa_do_sistema(self, mala):
        """Programa de fábrica do leitor: a saída do voo, ou a inspeção se não o conhecer."""
        partida = self.partidas.get(mala['voo'])
        return partida.saida if partida else 'INSPECAO'

    def contar(self, estado=None):
        return len(self.malas) if estado is None else sum(m.estado == estado for m in self.malas)

    # --- ordens --------------------------------------------------------------
    def programar_leitor(self, funcao):
        if not callable(funcao):
            raise TypeError('programar_leitor recebe uma função, por exemplo programar_leitor(encaminhar).')
        self.programa = funcao
        self._evento('leitor', programado=True)

    def definir_rota(self, saida, rota):
        """Programa os desviadores para as malas de uma saída: lista de nós do LEITOR até à saída."""
        if saida not in self.saidas:
            raise KeyError(f'Saída desconhecida: {saida}')
        if not isinstance(rota, (list, tuple)) or len(rota) < 2:
            raise TransicaoInvalida(f'A rota para {saida} tem de ser uma lista de nós, do LEITOR até {saida}.')
        rota = list(rota)
        if rota[0] != 'LEITOR' or rota[-1] != saida:
            raise TransicaoInvalida(f'A rota para {saida} tem de começar em LEITOR e acabar em {saida}.')
        if len(set(rota)) != len(rota):
            raise TransicaoInvalida(f'A rota para {saida} passa duas vezes pelo mesmo nó.')
        for a, b in zip(rota, rota[1:]):
            if (a, b) not in self.trocos:
                raise TransicaoInvalida(f'A rota para {saida} usa um troço que não existe: de {a} para {b}.')
            if self.trocos[(a, b)].estado != 'ok':
                raise TransicaoInvalida(f'O troço de {a} para {b} está avariado: escolhe outra rota para {saida}.')
        if self.rotas.get(saida) != rota:
            self.rotas[saida] = rota
            self._evento('rota', saida=saida, rota=rota)

    def receber_malas(self, malas):
        """Troca as malas do cenário pelas que foram etiquetadas no check-in (Fase 3).

        Cada mala é um dicionário com codigo, voo, peso, legivel, entrada (C1 ou C2) e minuto
        (aquele em que chega ao fim do tapete coletor). Só pode ser chamado antes de a triagem começar.
        """
        if self.minuto != self.inicio or any(e['tipo'] == 'mala' for e in self.eventos):
            raise TransicaoInvalida('A triagem já começou: as malas do check-in têm de entrar antes.')
        self.malas = []
        for partida in self.partidas.values():
            partida.malas = []
        self._checkin = {e: deque() for e in self.entradas}
        for dados in sorted(malas, key=lambda d: d['minuto']):
            if dados['entrada'] not in self._checkin:
                raise KeyError(f"Entrada desconhecida: {dados['entrada']}")
            mala = Mala(dados['codigo'], dados['voo'], dados['peso'], legivel=dados.get('legivel', True))
            mala.entrada, mala.minuto_checkin = dados['entrada'], max(self.inicio, dados['minuto'])
            self.malas.append(mala)
            self._checkin[mala.entrada].append(mala)
            if mala.voo in self.partidas:
                self.partidas[mala.voo].malas.append(mala)
        self._por_codigo = {m.codigo: m for m in self.malas}
        if len(self._por_codigo) != len(self.malas):
            raise ValueError('Há malas do check-in com o mesmo código.')
        self.origem = 'checkin'

    def agendar_avaria(self, origem, destino, minuto, duracao=DURACAO_AVARIA):
        self._troco(origem, destino)
        self.avarias.setdefault(minuto, []).append((origem, destino, duracao))

    # --- simulação -----------------------------------------------------------
    def _terminar(self, mala, estado, **dados):
        mala.estado, mala.troco, mala.pronta = estado, None, None
        self._evento('mala', mala=mala.codigo, estado=estado, **dados)

    def _ler(self, mala):
        """Passagem pelo leitor: decide a saída e a rota da mala. Devolve o nó seguinte."""
        mala.lida, mala.em_retorno = True, False
        mala.leituras += 1
        if mala.leituras > 1:
            self.recirculacoes += 1
        if mala.leituras >= MAX_LEITURAS:
            self._ocorrencia(f'A mala {mala.codigo} recirculou {mala.leituras - 1} vezes: enviada para inspeção', mala=mala.codigo)
            mala.destino = 'INSPECAO'
        else:
            if self.programa is None:
                self._aviso('leitor', 'Leitor sem programa: as malas seguem para inspeção')
                destino = 'INSPECAO'
            else:
                destino = self.programa(mala.dados())
                if destino is None:
                    destino = 'INSPECAO'
                if destino != 'INSPECAO' and destino not in self.saidas:
                    raise ValueError(f'O programa do leitor devolveu {destino!r} para a mala {mala.codigo}. '
                                     f'Devolve o código de uma saída ({", ".join(self.saidas)}) ou "INSPECAO".')
            if destino != 'INSPECAO' and self.rotas.get(destino) is None:
                self._aviso(('rota', destino), f'Sem rota definida para {destino}: as malas seguem para inspeção', saida=destino)
                destino = 'INSPECAO'
            mala.destino = destino
            mala.rota = None if destino == 'INSPECAO' else list(self.rotas[destino])
        self._evento('leitura', mala=mala.codigo, voo=mala.dados()['voo'], destino=mala.destino, leituras=mala.leituras)

    def _seguinte(self, mala, no):
        """Nó para onde a mala segue a partir de `no` (None: tem de esperar).

        A mala segue a rota que recebeu no leitor. Se um troço dessa rota avariar, o desviador
        consulta a rota atual da saída; se também não servir, a mala volta ao leitor pelo retorno.
        """
        if no == 'LEITOR' and not mala.lida:
            self._ler(mala)
        if mala.destino == 'INSPECAO':
            return 'INSPECAO'
        if not mala.em_retorno:
            candidatas = [r for r in (mala.rota, self.rotas.get(mala.destino)) if r and no in r[:-1]]
            restos = [r[r.index(no):] for r in candidatas]
            for rota, resto in zip(candidatas, restos):          # 1.º uma rota inteira a funcionar
                if all(self.trocos[par].estado == 'ok' for par in zip(resto, resto[1:])):
                    mala.rota = list(rota)
                    return resto[1]
            for resto in restos:                                 # 2.º avança enquanto o troço seguinte funcionar
                if self.trocos[(no, resto[1])].estado == 'ok':
                    return resto[1]
            if restos:
                self._aviso(('desvio', no, restos[0][1]), f'Malas desviadas para o retorno em {no}: o troço para {restos[0][1]} está avariado',
                            troco=f'{no}>{restos[0][1]}')
        if no == 'LEITOR':
            return None                   # a rota começa num troço avariado: espera no leitor
        if not mala.em_retorno:
            mala.em_retorno = True
            self._evento('retorno', mala=mala.codigo, no=no)
        volta = encontrar_rota(self.rede(), no, 'LEITOR')
        return volta[1] if volta else None

    def _avancar(self, mala, troco, entradas):
        """Tenta passar a mala do fim de `troco` para o troço seguinte. Devolve True se saiu."""
        no = troco.destino
        tipo = TIPOS_NO.get(no)
        mala.percurso.append(no)
        if tipo == 'saida':
            certa = mala.legivel and mala.voo in self.partidas and self.partidas[mala.voo].saida == no
            self._terminar(mala, 'triada' if certa else 'errada', saida=no)
            if not certa:
                self._ocorrencia(f'Mala {mala.codigo} na saída errada ({no})', mala=mala.codigo, saida=no)
            return True
        if tipo == 'inspecao':
            self._terminar(mala, 'inspecao')
            return True
        mala.percurso.pop()
        proximo = self._seguinte(mala, no)
        if proximo is None:
            return False
        seguinte = self.trocos[(no, proximo)]
        if seguinte.estado != 'ok' or len(seguinte.malas) >= seguinte.capacidade or entradas.get(seguinte.codigo, 0) >= DEBITO:
            return False
        mala.percurso.append(no)
        self._entrar(mala, seguinte, entradas)
        return True

    def _entrar(self, mala, troco, entradas):
        ordem = entradas.get(troco.codigo, 0)
        entradas[troco.codigo] = ordem + 1
        troco.malas.append(mala)
        mala.estado, mala.troco, mala.pronta, mala.lida = 'em_tapete', troco, self.minuto + troco.tempo, False
        self._evento('mala', mala=mala.codigo, estado='em_tapete', troco=troco.codigo, ordem=ordem)

    def _inicio_do_minuto(self):
        """Avarias e reparações marcadas para este minuto (antes de o controlador ser chamado)."""
        m = self.minuto
        for troco in self._reparacoes.pop(m, []):
            parado = m - troco.parado_desde
            for mala in troco.malas:
                mala.pronta += parado
            troco.estado, troco.parado_desde = 'ok', None
            self._evento('troco', troco=troco.codigo, estado='ok')
            self._ocorrencia(f'Troço de {troco.origem} para {troco.destino} reparado', troco=troco.codigo)
        for origem, destino, duracao in self.avarias.pop(m, []):
            troco = self.trocos[(origem, destino)]
            if troco.estado == 'ok':
                troco.estado, troco.parado_desde = 'avariado', m
                self._reparacoes.setdefault(m + duracao, []).append(troco)
                self._evento('troco', troco=troco.codigo, estado='avariado')
                self._ocorrencia(f'Avaria no troço de {origem} para {destino}', troco=troco.codigo)

    def passo(self):
        """Avança um minuto."""
        self._inicio_do_minuto()
        m = self.minuto
        # 1. cada troço entrega as malas que chegaram ao fim (de jusante para montante)
        entradas = {}
        ordem = self._ordem
        if m % 2:                          # alterna a prioridade nas junções, para ninguém ficar sempre para trás
            ordem = [t for t in ordem if t.destino != 'LEITOR'] + [t for t in ordem if t.destino == 'LEITOR'][::-1]
        for troco in ordem:
            if troco.estado != 'ok':
                continue
            saidas = 0
            while troco.malas and saidas < DEBITO and troco.malas[0].pronta <= m:
                if not self._avancar(troco.malas[0], troco, entradas):
                    break
                troco.malas.popleft()
                saidas += 1
        # 2. o check-in entrega malas novas às linhas de entrada
        for entrada, fila in self._checkin.items():
            troco = self.trocos[(entrada, 'LEITOR')]
            n = 0
            while fila and n < RITMO_CHECKIN and fila[0].minuto_checkin <= m and len(troco.malas) < troco.capacidade and troco.estado == 'ok':
                self._entrar(fila.popleft(), troco, entradas)
                n += 1
        self.minuto += 1

    @property
    def concluida(self):
        return all(m.estado in ('triada', 'errada', 'inspecao') for m in self.malas)

    def correr(self, controlador=None, ate=None, limite=240):
        """Corre a simulação. `controlador(central, minuto)` é chamado no início de cada minuto.

        Para quando todas as malas chegaram a uma saída ou à inspeção, ao chegar a `ate`
        ou ao fim de `limite` minutos. Devolve o número de minutos simulados.
        """
        passos = 0
        while passos < limite and (ate is None or self.minuto < ate):
            if ate is None and self.concluida:
                break
            self._inicio_do_minuto()
            if controlador is not None:
                controlador(self, self.minuto)
            self.passo()
            passos += 1
        return passos

    def resumo(self):
        por_estado = {e: 0 for e in ESTADOS_MALA}
        por_saida = {s: 0 for s in self.saidas}
        for mala in self.malas:
            por_estado[mala.estado] += 1
            if mala.estado in ('triada', 'errada'):
                por_saida[mala.percurso[-1]] += 1
        return {'minuto': self.minuto, 'hora': _hhmm(self.minuto), 'malas': por_estado, 'por_saida': por_saida,
                'recirculacoes': self.recirculacoes, 'ocorrencias': len(self.ocorrencias)}

    def registo(self):
        """Dados para a cena 3D: rede, partidas, malas e o registo de eventos.

        Devolve None quando o programa não deu nenhuma ordem nem simulou nada.
        """
        if not self.eventos:
            return None
        return {'inicio': self.inicio, 'fim': self.minuto, 'debito': DEBITO, 'origem': self.origem,
                'nos': {no: TIPOS_NO.get(no, 'desviador') for no in self.nos},
                'trocos': [{'codigo': t.codigo, 'origem': t.origem, 'destino': t.destino, 'tempo': t.tempo,
                            'capacidade': t.capacidade} for t in self.trocos.values()],
                'partidas': self.consultar_partidas(),
                'malas': [{'codigo': m.codigo, 'voo': m.voo, 'legivel': m.legivel, 'entrada': m.entrada} for m in self.malas],
                'rotas_iniciais': self._rotas_iniciais, 'eventos': self.eventos, 'resumo': self.resumo()}
