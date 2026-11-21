"""Motor das bagagens do Torre Python (Bloco 2 · Bagagens).

Python puro, sem dependências do navegador: testa-se com python test-bagagens.py
e é carregado pelo Worker como o grading.py.

O tempo é contado em minutos do dia (360 = 06:00), como no resto do simulador.
A simulação avança minuto a minuto e é determinística: com os mesmos voos,
as mesmas ordens e a mesma semente, o registo de eventos é sempre igual.
O registo (lista de dicionários) é o que o JavaScript reproduz em 3D.

Percurso de uma mala de chegada:
    no_porao -> descarregada -> em_transporte -> no_carrossel -> entregue
Desvios: em_espera (tapete cheio, parado ou avariado; também quando o voo muda de tapete)
e inspecao (etiqueta ilegível).
"""
import random
from collections import deque

# Parâmetros didáticos (fictícios, não são valores operacionais reais)
INICIO_DESCARGA = 5        # minutos depois da aterragem até à primeira mala sair do porão
MALAS_POR_MINUTO = 10      # ritmo de descarga do porão
TEMPO_TRANSPORTE = 3       # minutos da placa até ao carrossel
CAPACIDADE_TAPETE = 60     # malas em simultâneo num carrossel
RECOLHA_MIN, RECOLHA_MAX = 1, 8   # minutos que o passageiro demora a recolher a mala

ESTADOS_MALA = ('no_porao', 'descarregada', 'em_transporte', 'em_espera', 'no_carrossel', 'entregue', 'inspecao')
TRANSICOES_MALA = {
    'no_porao': {'descarregada'},
    'descarregada': {'em_transporte', 'inspecao'},
    'em_transporte': {'no_carrossel', 'em_espera'},
    'em_espera': {'no_carrossel'},
    'no_carrossel': {'entregue', 'em_espera'},
    'entregue': set(),
    'inspecao': set(),
}
ESTADOS_TAPETE = ('livre', 'ocupado', 'avariado')


def _hhmm(minuto):
    return f'{minuto // 60:02d}:{minuto % 60:02d}'


class TransicaoInvalida(ValueError):
    """Pedido que o equipamento ou a mala não podem cumprir no estado atual."""


class Bagagem:
    def __init__(self, codigo, voo, peso, etiqueta_legivel=True):
        self.codigo = codigo
        self.voo = voo
        self.peso = peso
        self.etiqueta_legivel = etiqueta_legivel
        self.estado = 'no_porao'
        self.tapete = None
        self.historico = [('no_porao', None)]

    def atualizar_estado(self, estado, minuto):
        if estado not in TRANSICOES_MALA[self.estado]:
            raise TransicaoInvalida(f'A mala {self.codigo} não pode passar de {self.estado} para {estado}.')
        self.estado = estado
        self.historico.append((estado, minuto))

    def __repr__(self):
        return f'Bagagem({self.codigo!r}, {self.voo!r}, {self.peso}, estado={self.estado!r})'


class Tapete:
    def __init__(self, codigo, capacidade=CAPACIDADE_TAPETE):
        self.codigo = codigo
        self.capacidade = capacidade
        self.estado = 'livre'
        self.voo = None
        self.motor_ligado = False
        self.malas = []

    @property
    def cheio(self):
        return len(self.malas) >= self.capacidade

    @property
    def a_funcionar(self):
        return self.estado == 'ocupado' and self.motor_ligado

    def __repr__(self):
        return f'Tapete({self.codigo!r}, estado={self.estado!r}, voo={self.voo!r}, motor={self.motor_ligado})'


class VooChegada:
    def __init__(self, codigo, hora, passageiros, malas):
        self.codigo = codigo
        self.hora = hora
        self.passageiros = passageiros
        self.malas = list(malas)
        self.tapete = None

    @property
    def concluido(self):
        return all(m.estado in ('entregue', 'inspecao') for m in self.malas)

    def __repr__(self):
        return f'VooChegada({self.codigo!r}, {_hhmm(self.hora)}, malas={len(self.malas)})'


def criar_voo(codigo, hora, passageiros, n_malas, semente=1, ilegiveis=0):
    """Cria um voo com malas de pesos fictícios. As últimas `ilegiveis` malas têm a etiqueta ilegível."""
    rng = random.Random(f'{codigo}-{semente}')
    malas = [Bagagem(f'{codigo}-{i:03d}', codigo, round(rng.uniform(7, 23), 1),
                     etiqueta_legivel=i <= n_malas - ilegiveis) for i in range(1, n_malas + 1)]
    return VooChegada(codigo, hora, passageiros, malas)


class SalaRecolha:
    """Sala de recolha de bagagens: carrosséis, voos de chegada e o relógio simulado."""

    def __init__(self, voos, tapetes=('T01', 'T02', 'T03', 'T04'), inicio=None, semente=1):
        self.voos = {v.codigo: v for v in voos}
        self.tapetes = {c: Tapete(c) for c in tapetes}
        self.minuto = inicio if inicio is not None else min((v.hora for v in voos), default=360)
        self.rng = random.Random(semente)
        self.eventos = []
        self.avarias = {}          # minuto -> [codigo do tapete]
        self._descarga = {}        # voo -> deque de malas ainda no porão
        self._transporte = []      # (minuto de chegada ao carrossel, mala)
        self._espera = {}          # voo -> deque de malas à espera de lugar no carrossel
        self._recolha = []         # (minuto de recolha, mala)
        self.ocorrencias = []
        self._fechados = set()     # voos com todas as malas entregues ou em inspeção

    # --- registo -------------------------------------------------------------
    def _evento(self, tipo, **dados):
        self.eventos.append({'minuto': self.minuto, 'tipo': tipo, **dados})

    def _mala(self, mala, estado):
        mala.atualizar_estado(estado, self.minuto)
        self._evento('mala', mala=mala.codigo, voo=mala.voo, estado=estado, tapete=mala.tapete)

    def _ocorrencia(self, texto, **dados):
        self.ocorrencias.append({'minuto': self.minuto, 'texto': texto, **dados})
        self._evento('ocorrencia', texto=texto, **dados)

    # --- consultas -----------------------------------------------------------
    def _tapete(self, codigo):
        if codigo not in self.tapetes:
            raise KeyError(f'Tapete desconhecido: {codigo}')
        return self.tapetes[codigo]

    def _voo(self, codigo):
        if codigo not in self.voos:
            raise KeyError(f'Voo desconhecido: {codigo}')
        return self.voos[codigo]

    def tapetes_livres(self):
        return [t.codigo for t in self.tapetes.values() if t.estado == 'livre']

    def contar_malas(self, voo, estado=None):
        malas = self._voo(voo).malas
        return len(malas) if estado is None else sum(m.estado == estado for m in malas)

    # --- ordens --------------------------------------------------------------
    def atribuir_tapete(self, voo, tapete):
        v, t = self._voo(voo), self._tapete(tapete)
        if t.estado != 'livre':
            raise TransicaoInvalida(f'O tapete {tapete} não está livre (está {t.estado}).')
        if v.tapete is not None:
            raise TransicaoInvalida(f'O voo {voo} já tem o tapete {v.tapete}.')
        t.estado, t.voo, v.tapete = 'ocupado', voo, tapete
        self._evento('tapete', tapete=tapete, estado='ocupado', voo=voo)

    def iniciar_motor(self, tapete):
        t = self._tapete(tapete)
        if t.estado == 'avariado':
            raise TransicaoInvalida(f'O tapete {tapete} está avariado: não é possível ligar o motor.')
        if not t.motor_ligado:
            t.motor_ligado = True
            self._evento('motor', tapete=tapete, ligado=True)

    def parar_motor(self, tapete):
        t = self._tapete(tapete)
        if t.motor_ligado:
            t.motor_ligado = False
            self._evento('motor', tapete=tapete, ligado=False)

    def libertar_tapete(self, tapete):
        t = self._tapete(tapete)
        if t.malas:
            raise TransicaoInvalida(f'O tapete {tapete} ainda tem {len(t.malas)} malas.')
        if t.voo and t.estado != 'avariado':
            v = self.voos[t.voo]
            if not v.concluido:
                raise TransicaoInvalida(f'O voo {t.voo} ainda não terminou: não libertes o tapete {tapete}.')
        if t.voo:
            v = self.voos[t.voo]
            if v.tapete == tapete:
                v.tapete = None
        self.parar_motor(tapete)
        if t.estado != 'avariado':
            t.estado = 'livre'
        t.voo = None
        self._evento('tapete', tapete=tapete, estado=t.estado, voo=None)

    def agendar_avaria(self, tapete, minuto):
        self._tapete(tapete)
        self.avarias.setdefault(minuto, []).append(tapete)

    def transferir_voo(self, voo, novo_tapete):
        """Passa um voo para outro tapete livre. As malas do tapete antigo voltam à espera."""
        v, novo = self._voo(voo), self._tapete(novo_tapete)
        if novo.estado != 'livre':
            raise TransicaoInvalida(f'O tapete {novo_tapete} não está livre (está {novo.estado}).')
        if v.tapete is None:
            raise TransicaoInvalida(f'O voo {voo} ainda não tem tapete: usa atribuir_tapete.')
        antigo = self.tapetes[v.tapete]
        fila = self._espera.setdefault(voo, deque())
        for mala in reversed(antigo.malas):
            fila.appendleft(mala)
            self._recolha = [(m, x) for m, x in self._recolha if x is not mala]
            mala.tapete = None
            self._mala(mala, 'em_espera')
        antigo.malas = []
        antigo.voo = None
        if antigo.estado != 'avariado':
            antigo.estado = 'livre'
        self._evento('tapete', tapete=antigo.codigo, estado=antigo.estado, voo=None)
        v.tapete = None
        self.atribuir_tapete(voo, novo_tapete)

    # --- simulação -----------------------------------------------------------
    def passo(self):
        """Avança um minuto."""
        m = self.minuto
        for codigo in self.avarias.pop(m, []):
            t = self.tapetes[codigo]
            t.estado, t.motor_ligado = 'avariado', False
            self._evento('tapete', tapete=codigo, estado='avariado', voo=t.voo)
            self._ocorrencia(f'Avaria no tapete {codigo}', tapete=codigo)
        # 1. descarga do porão
        for v in self.voos.values():
            if m == v.hora:
                self._evento('voo', voo=v.codigo, estado='aterrou', malas=len(v.malas))
            if m == v.hora + INICIO_DESCARGA:
                self._descarga[v.codigo] = deque(v.malas)
            fila = self._descarga.get(v.codigo)
            for _ in range(MALAS_POR_MINUTO):
                if not fila:
                    break
                mala = fila.popleft()
                self._mala(mala, 'descarregada')
                if not mala.etiqueta_legivel:
                    self._mala(mala, 'inspecao')
                    self._ocorrencia(f'Etiqueta ilegível: {mala.codigo}', mala=mala.codigo)
                else:
                    self._mala(mala, 'em_transporte')
                    self._transporte.append((m + TEMPO_TRANSPORTE, mala))
        # 2. chegada ao carrossel (ou à zona de espera)
        a_chegar = [x for x in self._transporte if x[0] <= m]
        self._transporte = [x for x in self._transporte if x[0] > m]
        for _, mala in a_chegar:
            self._mala(mala, 'em_espera')
            self._espera.setdefault(mala.voo, deque()).append(mala)
        # 3. a zona de espera alimenta os carrosséis que estão a funcionar (FIFO)
        for voo, fila in self._espera.items():
            t = self.tapetes.get(self.voos[voo].tapete) if self.voos[voo].tapete else None
            while fila and t and t.a_funcionar and not t.cheio:
                mala = fila.popleft()
                mala.tapete = t.codigo
                self._mala(mala, 'no_carrossel')
                t.malas.append(mala)
                self._recolha.append((m + self.rng.randint(RECOLHA_MIN, RECOLHA_MAX), mala))
        # 4. recolha pelos passageiros (só com o carrossel a rodar)
        ainda = []
        for quando, mala in self._recolha:
            t = self.tapetes[mala.tapete]
            if quando <= m and t.a_funcionar:
                t.malas.remove(mala)
                self._mala(mala, 'entregue')
            else:
                ainda.append((quando if t.a_funcionar else quando + 1, mala))
        self._recolha = ainda
        for v in self.voos.values():
            if v.codigo not in self._fechados and m >= v.hora and v.concluido:
                self._fechados.add(v.codigo)
                self._evento('voo', voo=v.codigo, estado='concluido')
        self.minuto += 1

    def correr(self, controlador=None, ate=None, limite=600):
        """Corre a simulação. `controlador(sala, minuto)` é chamado no início de cada minuto.

        Para quando todos os voos terminam, ao chegar a `ate` ou ao fim de `limite` minutos.
        Devolve o número de minutos simulados.
        """
        passos = 0
        while passos < limite and (ate is None or self.minuto < ate):
            if ate is None and all(v.concluido for v in self.voos.values()) and self.minuto > max(v.hora for v in self.voos.values()):
                break
            if controlador is not None:
                controlador(self, self.minuto)
            self.passo()
            passos += 1
        return passos

    def resumo(self):
        por_estado = {e: 0 for e in ESTADOS_MALA}
        for v in self.voos.values():
            for mala in v.malas:
                por_estado[mala.estado] += 1
        return {'minuto': self.minuto, 'hora': _hhmm(self.minuto), 'malas': por_estado,
                'voos_concluidos': sorted(self._fechados), 'ocorrencias': len(self.ocorrencias)}
