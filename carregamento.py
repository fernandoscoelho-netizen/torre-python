"""Motor do carregamento do avião na placa do Torre Python (Bloco 2 · Bagagens, Fase 4).

Python puro, sem dependências do navegador: testa-se com python test-carregamento.py
e é carregado pelo Worker como o bagagens.py, o triagem.py e o checkin.py.

É o último elo da cadeia das malas de partida. As malas que a central de triagem
entregou na saída de cada voo são levadas em reboques até ao avião, sobem pelos
tapetes de carregamento e são arrumadas nos três porões. Antes de fechar os porões,
a bagagem é reconciliada com o embarque: uma mala só voa se o dono embarcou.

Percurso de uma mala:
    na_saida -> em_reboque -> carregada -> (retirada)
Desvio: em_terra (não chegou a tempo, ficou fora do plano ou não coube no porão).

Dois programas decidem o que acontece, e cada um pode ser o do sistema ou o do aluno:
    distribuir(malas, aviao)            -> {porão: [etiquetas, pela ordem de carga]}
    malas_a_retirar(malas, embarcados)  -> etiquetas das malas a tirar do avião

O tempo é contado em minutos do dia (480 = 08:00) e avança minuto a minuto. A
simulação é determinística: com as mesmas malas e os mesmos programas, o registo
de eventos é sempre igual. É esse registo que o JavaScript reproduz em 3D.
"""
import random

# Parâmetros didáticos (fictícios, não são valores operacionais reais)
PLANO = 26              # o plano de carga é feito 26 minutos antes da partida
SAIDA_REBOQUES = 24     # os reboques saem da central de triagem 24 minutos antes da partida
TEMPO_PLACA = 3         # minutos de caminho da central até ao avião
RITMO_CARGA = 4         # malas por minuto em cada tapete de carregamento
FECHO_EMBARQUE = 15     # o embarque fecha 15 minutos antes da partida
RITMO_DESCARGA = 1      # malas retiradas por minuto em cada tapete
FECHO_POROES = 8        # os porões fecham, no mínimo, 8 minutos antes da partida
ATRASO_CENTRAGEM = 12   # minutos perdidos a mudar malas de porão quando a centragem falha
ATRASO_BUSCA = 5        # minutos perdidos a procurar à mão cada mala que não devia voar
PESO_PASSAGEIRO = 84    # kg por passageiro, com bagagem de mão
PESO_PESADA = 23        # kg: acima disto a etiqueta leva um H

ESTADOS_MALA = ('na_saida', 'em_reboque', 'carregada', 'retirada', 'em_terra')
FASES = ('espera', 'planeado', 'reboques', 'a_carregar', 'carregado', 'reconciliacao', 'fechado', 'partiu')
POROES = ('DIANTEIRO', 'TRASEIRO', 'GRANEL')
BRACOS = {'DIANTEIRO': 10.9, 'TRASEIRO': 23.8, 'GRANEL': 28.2}      # metros, medidos a partir do nariz
TAPETE = {'DIANTEIRO': 'frente', 'TRASEIRO': 'tras', 'GRANEL': 'tras'}   # o granel carrega-se pela porta traseira
LUGARES = ('P21', 'P22', 'P23', 'P24')                                # a saída S01 serve o lugar P21, e assim por diante

# Avião didático: jato de corredor único. Os braços são distâncias ao nariz, em metros.
TIPO_AVIAO = 'A320 (valores didáticos)'
PESO_VAZIO, BRACO_VAZIO = 42600, 17.5
BRACO_COMBUSTIVEL = 17.4
ZONAS = (('cabine dianteira', 10.2), ('cabine central', 17.6), ('cabine traseira', 25.0))
CARGA_TOTAL = 3000                    # kg de carga e correio já arrumados nos porões dianteiro e traseiro
LIMITE_FRENTE, LIMITE_TRAS = 17.10, 17.78
CORDA = {'inicio': 16.31, 'comprimento': 4.19}   # corda média aerodinâmica, para mostrar a centragem em % (só na cena 3D)
MARGEM = 0.03                         # nos voos difíceis, o plano certo fica a 3 cm do limite

_NOMES = ('Ana', 'Rui', 'Inês', 'Tiago', 'Marta', 'João', 'Sofia', 'Pedro', 'Rita', 'Nuno', 'Clara', 'Hugo',
          'Lara', 'Vasco', 'Joana', 'Diogo', 'Beatriz', 'André', 'Carla', 'Miguel', 'Teresa', 'Bruno', 'Helena', 'Luís')
_APELIDOS = ('Silva', 'Costa', 'Pinto', 'Moreira', 'Ramos', 'Teixeira', 'Lopes', 'Sousa', 'Faria', 'Rocha', 'Nunes', 'Maia',
             'Vieira', 'Campos', 'Matos', 'Reis', 'Fonseca', 'Barros', 'Neves', 'Cunha', 'Leite', 'Azevedo', 'Brito', 'Melo')
_LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def _hhmm(minuto):
    return f'{minuto // 60:02d}:{minuto % 60:02d}'


def encher(malas, livres, ordem=POROES):
    """Arruma as malas, das mais pesadas para as mais leves, no primeiro porão de `ordem` onde cabem.

    `livres` é {porão: kg livres}. Devolve (plano, sobras): o plano é {porão: [malas]} e as sobras
    são as malas que não couberam em nenhum porão.
    """
    resto = {p: livres[p] for p in ordem}
    plano, sobras = {p: [] for p in POROES}, []
    for mala in sorted(malas, key=lambda m: -m['peso']):
        for porao in ordem:
            if mala['peso'] <= resto[porao] + 1e-9:
                plano[porao].append(mala)
                resto[porao] -= mala['peso']
                break
        else:
            sobras.append(mala)
    return plano, sobras


def centragem(aviao, pesos):
    """Centro de gravidade (metros a partir do nariz): soma dos momentos a dividir pela soma dos pesos."""
    momento = sum(m['peso'] * m['braco'] for m in aviao['massas'])
    total = sum(m['peso'] for m in aviao['massas'])
    for porao, peso in pesos.items():
        momento += peso * aviao['poroes'][porao]['braco']
        total += peso
    return momento / total


def dentro_dos_limites(aviao, cg):
    return aviao['limite_frente'] <= cg <= aviao['limite_tras']


def _pesos(plano):
    return {p: round(sum(m['peso'] for m in plano.get(p, [])), 1) for p in POROES}


def criar_aviao(partida, lugar, malas, passageiros, modo='folgado', perfil='equilibrado', semente=1):
    """Monta a ficha do avião de um voo: porões livres, massas fixas e limites de centragem.

    modo 'apertado': os porões já levam muita carga e sobra pouco espaço para as malas.
    modo 'centragem': há espaço de sobra, mas o avião está pesado de cauda ou de nariz (perfil)
    e só um plano que puxe as malas para o lado certo fica dentro dos limites.
    modo 'folgado': espaço e centragem sem dificuldade.
    """
    rng = random.Random(f'aviao-{partida["voo"]}-{semente}')
    peso_malas = sum(m['peso'] for m in malas)
    arredondar = lambda kg: int(-(-kg // 5) * 5)                       # para cima, de 5 em 5 kg
    if not malas:
        livres, ordem = dict(DIANTEIRO=300, TRASEIRO=300, GRANEL=100), POROES
    elif modo == 'apertado':
        folga, ordem = 1.10, POROES
        while True:
            livres = {p: arredondar(peso_malas * folga * parte) for p, parte in zip(POROES, (0.42, 0.43, 0.15))}
            if not encher(malas, livres, ordem)[1]:
                break
            folga += 0.02
    elif modo == 'centragem':
        livres = {p: arredondar(peso_malas * parte) for p, parte in zip(POROES, (0.75, 0.75, 0.25))}
        ordem = POROES[::-1] if perfil == 'nariz' else POROES
    else:
        livres = {p: arredondar(peso_malas * parte) for p, parte in zip(POROES, (0.6, 0.6, 0.2))}
        ordem = POROES
    perfil = perfil if modo == 'centragem' else 'equilibrado'
    referencia = _pesos(encher(malas, livres, ordem)[0])
    alvo = {'cauda': LIMITE_TRAS - MARGEM, 'nariz': LIMITE_FRENTE + MARGEM}.get(perfil, (LIMITE_FRENTE + LIMITE_TRAS) / 2)
    n = len(passageiros)
    partes = {'cauda': (1, 2, 4), 'nariz': (4, 2, 1)}.get(perfil, (1, 1, 1))
    zonas = [n * k // sum(partes) for k in partes]
    zonas[1] += n - sum(zonas)
    combustivel = rng.randrange(5200, 7401, 100)

    def ficha(carga_frente):
        massas = [{'nome': 'avião vazio', 'peso': PESO_VAZIO, 'braco': BRACO_VAZIO},
                  {'nome': 'combustível', 'peso': combustivel, 'braco': BRACO_COMBUSTIVEL}]
        massas += [{'nome': f'passageiros · {nome}', 'peso': k * PESO_PASSAGEIRO, 'braco': braco} for (nome, braco), k in zip(ZONAS, zonas)]
        massas += [{'nome': 'carga e correio · porão dianteiro', 'peso': carga_frente, 'braco': BRACOS['DIANTEIRO']},
                   {'nome': 'carga e correio · porão traseiro', 'peso': CARGA_TOTAL - carga_frente, 'braco': BRACOS['TRASEIRO']}]
        return {'voo': partida['voo'], 'destino': partida['destino'], 'hora': partida['hora'], 'lugar': lugar, 'tipo': TIPO_AVIAO,
                'poroes': {p: {'livre': livres[p], 'braco': BRACOS[p]} for p in POROES},
                'massas': massas, 'limite_frente': LIMITE_FRENTE, 'limite_tras': LIMITE_TRAS}

    # A carga já arrumada reparte-se entre a frente e a traseira de modo a pôr o plano de referência no alvo
    for _ in range(40):
        base = ficha(0)
        total = sum(m['peso'] for m in base['massas']) + sum(referencia.values())
        momento = centragem(base, referencia) * total
        frente = (momento - alvo * total) / (BRACOS['TRASEIRO'] - BRACOS['DIANTEIRO'])
        if frente < 0 and zonas[0] > 0:                 # nem com toda a carga atrás chega: um passageiro passa para trás
            zonas[0] -= 1; zonas[2] += 1
        elif frente > CARGA_TOTAL and zonas[2] > 0:     # ou para a frente
            zonas[2] -= 1; zonas[0] += 1
        else:
            break
    aviao = ficha(int(round(min(max(frente, 0), CARGA_TOTAL) / 10) * 10))
    aviao['_perfil'] = perfil
    return aviao


def criar_cenario(partidas, semente=1, por_voo=34):
    """Malas e passageiros fictícios para quando o check-in e a triagem não foram simulados.

    Devolve (malas, passageiros). Cada mala já está na saída do seu voo antes de o plano de carga fechar.
    """
    rng = random.Random(f'placa-{semente}')
    usadas, malas, passageiros = set(), [], []
    for partida in partidas:
        voo, numero = partida['voo'], 0
        for _ in range(por_voo):
            while True:
                reserva = ''.join(rng.choice(_LETRAS) for _ in range(6))
                if reserva not in usadas:
                    usadas.add(reserva)
                    break
            n = rng.choice((0, 1, 1, 1, 2, 2))
            passageiros.append({'reserva': reserva, 'nome': f'{rng.choice(_NOMES)} {rng.choice(_APELIDOS)}', 'voo': voo, 'malas': n})
            for _ in range(n):
                peso = round(rng.uniform(23.5, 31), 1) if rng.random() < 0.15 else round(rng.uniform(7, 22), 1)
                numero += 1
                malas.append({'etiqueta': f'{voo}-{numero:03d}' + ('H' if peso > PESO_PESADA else ''), 'voo': voo, 'peso': peso,
                              'reserva': reserva, 'pronta': rng.randint(partida['hora'] - 70, partida['hora'] - PLANO - 2)})
    return malas, passageiros


class Mala:
    def __init__(self, etiqueta, voo, peso, reserva, pronta):
        self.etiqueta, self.voo, self.peso, self.reserva = etiqueta, voo, peso, reserva
        self.pronta = pronta           # minuto em que chegou à saída da triagem (None: nunca chegou)
        self.estado = 'na_saida'
        self.porao = None

    def dados(self):
        """O que os programas do aluno recebem: uma cópia, para não poderem estragar o original."""
        return {'etiqueta': self.etiqueta, 'voo': self.voo, 'peso': self.peso, 'reserva': self.reserva}

    def __repr__(self):
        return f'Mala({self.etiqueta!r}, {self.peso} kg, estado={self.estado!r})'


class VooCarga:
    """Um voo de partida no seu lugar da placa: avião, malas, tapetes e a fase em que está."""

    def __init__(self, partida, lugar):
        self.voo, self.destino, self.hora, self.saida = partida['voo'], partida['destino'], partida['hora'], partida.get('saida')
        self.lugar = lugar
        self.fase = 'espera'
        self.malas, self.passageiros = [], []
        self.aviao = None
        self.faltas = set()            # reservas de quem fez check-in e não embarcou
        self.embarcados = []           # leituras dos cartões de embarque na porta (pode haver repetições)
        self.filas = {'frente': [], 'tras': []}
        self.retirar = {'frente': [], 'tras': []}
        self.pesos = {p: 0.0 for p in POROES}
        self.carregadas = {p: [] for p in POROES}
        self.chega = self.fim_carga = self.partida = None
        self.recusadas = 0
        self.cg = self.dentro = None
        self.atraso = 0

    def __repr__(self):
        return f'VooCarga({self.voo!r}, {self.lugar!r}, fase={self.fase!r})'


class Placa:
    """Carregamento dos voos de partida: plano de carga, reboques, tapetes, porões, centragem e reconciliação."""

    def __init__(self, partidas, malas=None, passageiros=None, semente=1, modo='folgado', faltas=0, plano=True, reconciliacao=True):
        self.semente, self.modo, self.n_faltas = semente, modo, faltas
        partidas = sorted((dict(p) for p in partidas), key=lambda p: p['hora'])
        self.voos = {}
        for i, p in enumerate(partidas):
            saida = p.get('saida')
            lugar = LUGARES[int(saida[1:]) - 1] if isinstance(saida, str) and saida[1:].isdigit() and 1 <= int(saida[1:]) <= len(LUGARES) else LUGARES[i % len(LUGARES)]
            self.voos[p['voo']] = VooCarga(p, lugar)
        self.inicio = self.minuto = min((v.hora for v in self.voos.values()), default=600) - PLANO - 8
        self.eventos, self.ocorrencias = [], []
        self._avisos = set()
        self._planear = self.plano_do_sistema if plano else None
        self._reconciliar = self.reconciliacao_do_sistema if reconciliacao else None
        self.origem = 'cenario'
        self.simulado = False
        if malas is None:
            malas, passageiros = criar_cenario(partidas, semente)
        self._montar(malas, passageiros or [])

    # --- registo -------------------------------------------------------------
    def _evento(self, tipo, **dados):
        self.eventos.append({'minuto': self.minuto, 'tipo': tipo, **dados})

    def _ocorrencia(self, texto, **dados):
        self.ocorrencias.append({'minuto': self.minuto, 'texto': texto, **dados})
        self._evento('ocorrencia', texto=texto, **dados)

    def _aviso(self, chave, texto, **dados):
        """Ocorrência que só é registada uma vez."""
        if chave not in self._avisos:
            self._avisos.add(chave)
            self._ocorrencia(texto, **dados)

    # --- montagem ------------------------------------------------------------
    def _montar(self, malas, passageiros):
        self.malas = []
        self._por_etiqueta = {}
        self._nomes = {p['reserva']: p['nome'] for p in passageiros}
        perfis = ('cauda', 'nariz')
        for i, v in enumerate(self.voos.values()):
            v.malas = [Mala(m['etiqueta'], m['voo'], m['peso'], m.get('reserva'), m.get('pronta')) for m in malas if m['voo'] == v.voo]
            v.passageiros = [dict(p) for p in passageiros if p['voo'] == v.voo]
            self.malas += v.malas
            self._por_etiqueta.update({m.etiqueta: m for m in v.malas})
            previstas = [m.dados() for m in v.malas if m.pronta is not None]
            v.aviao = criar_aviao({'voo': v.voo, 'destino': v.destino, 'hora': v.hora}, v.lugar, previstas, v.passageiros,
                                  modo=self.modo, perfil=perfis[(i + self.semente) % 2], semente=self.semente)
            # Quem não embarca: primeiro passageiros com malas (são esses que obrigam a abrir os porões), depois um sem malas
            rng = random.Random(f'embarque-{v.voo}-{self.semente}')
            com = sorted({m.reserva for m in v.malas if m.pronta is not None and m.reserva})
            sem = sorted(p['reserva'] for p in v.passageiros if p['reserva'] not in set(com))
            n_com = min(len(com), self.n_faltas - 1 if self.n_faltas > 1 else self.n_faltas)
            v.faltas = set(rng.sample(com, n_com)) | set(rng.sample(sem, min(len(sem), self.n_faltas - n_com)))
            presentes = [p['reserva'] for p in v.passageiros if p['reserva'] not in v.faltas]
            rng.shuffle(presentes)
            v.embarcados = presentes + rng.sample(presentes, min(2, len(presentes)))      # dois cartões lidos duas vezes
            rng.shuffle(v.embarcados)

    def receber_malas(self, malas, passageiros):
        """Troca as malas do cenário pelas que a central de triagem entregou. Só antes de o carregamento começar."""
        if self.simulado:
            raise ValueError('O carregamento já começou: as malas da triagem têm de chegar antes.')
        self._montar(malas, passageiros)
        self.origem = 'triagem'

    # --- consultas -----------------------------------------------------------
    def _ficha(self, v):
        """Cópia da ficha do avião, sem os campos internos."""
        a = v.aviao
        return {'voo': a['voo'], 'destino': a['destino'], 'hora': a['hora'], 'lugar': a['lugar'], 'tipo': a['tipo'],
                'poroes': {p: dict(d) for p, d in a['poroes'].items()}, 'massas': [dict(m) for m in a['massas']],
                'limite_frente': a['limite_frente'], 'limite_tras': a['limite_tras']}

    def consultar_avioes(self):
        return [self._ficha(v) for v in self.voos.values()]

    def consultar_malas(self, voo=None):
        if voo is not None and voo not in self.voos:
            raise KeyError(f'Voo desconhecido na placa: {voo}')
        return [m.dados() for m in self.malas if m.pronta is not None and (voo is None or m.voo == voo)]

    def centragem(self, voo, pesos=None):
        v = self.voos[voo]
        return centragem(v.aviao, v.pesos if pesos is None else pesos)

    # --- programas do sistema ------------------------------------------------
    def plano_do_sistema(self, malas, aviao):
        """Plano de fábrica: experimenta encher pela frente e por trás e fica com o primeiro plano dentro dos limites."""
        livres = {p: d['livre'] for p, d in aviao['poroes'].items()}
        melhor = None
        for ordem in (POROES, POROES[::-1], ('TRASEIRO', 'DIANTEIRO', 'GRANEL')):
            plano, sobras = encher(malas, livres, ordem)
            if melhor is None:
                melhor = plano
            if not sobras and dentro_dos_limites(aviao, centragem(aviao, _pesos(plano))):
                melhor = plano
                break
        return {p: [m['etiqueta'] for m in melhor[p]] for p in POROES}

    def reconciliacao_do_sistema(self, malas, embarcados):
        """Reconciliação de fábrica: saem as malas de quem não passou na porta de embarque."""
        presentes = set(embarcados)
        return {m['etiqueta'] for m in malas if m['reserva'] not in presentes}

    # --- ordens --------------------------------------------------------------
    def programar_plano(self, funcao):
        if not callable(funcao):
            raise TypeError('programar_plano recebe uma função, por exemplo programar_plano(distribuir).')
        self._planear = funcao
        self._evento('programa', programa='plano')

    def programar_reconciliacao(self, funcao):
        if not callable(funcao):
            raise TypeError('programar_reconciliacao recebe uma função, por exemplo programar_reconciliacao(malas_a_retirar).')
        self._reconciliar = funcao
        self._evento('programa', programa='reconciliacao')

    # --- simulação -----------------------------------------------------------
    def _fazer_plano(self, v):
        m = self.minuto
        prontas = [x for x in v.malas if x.pronta is not None and x.pronta <= m]
        tardias = [x for x in v.malas if x not in prontas]
        for x in tardias:
            x.estado = 'em_terra'
        if tardias:
            self._ocorrencia(f'{len(tardias)} {"mala" if len(tardias) == 1 else "malas"} do voo {v.voo} não {"estava" if len(tardias) == 1 else "estavam"} na saída '
                             f'quando o plano de carga fechou e {"ficou" if len(tardias) == 1 else "ficaram"} em terra', voo=v.voo, malas=[x.etiqueta for x in tardias])
        plano = {p: [] for p in POROES}
        if self._planear is None:
            if prontas:
                self._ocorrencia(f'Voo {v.voo} sem plano de carga: as {len(prontas)} malas ficam na saída da triagem', voo=v.voo)
            fora = prontas
        else:
            resposta = self._planear([x.dados() for x in prontas], self._ficha(v))
            if not isinstance(resposta, dict):
                raise ValueError(f'O plano de carga do voo {v.voo} devia ser um dicionário {{porão: [etiquetas]}} e veio {type(resposta).__name__}.')
            vistas = set()
            aceites = {x.etiqueta: x for x in prontas}
            for porao, lista in resposta.items():
                if porao not in POROES:
                    raise ValueError(f'O plano de carga do voo {v.voo} tem o porão {porao!r}. Os porões são {", ".join(POROES)}.')
                if isinstance(lista, (str, dict)) or not hasattr(lista, '__iter__'):
                    raise ValueError(f'No plano de carga do voo {v.voo}, o porão {porao} devia ter uma lista de etiquetas.')
                for item in lista:
                    etiqueta = item.get('etiqueta') if isinstance(item, dict) else item
                    if etiqueta not in aceites:
                        raise ValueError(f'O plano de carga do voo {v.voo} tem {item!r} no porão {porao}, que não é uma mala deste voo.')
                    if etiqueta in vistas:
                        raise ValueError(f'A mala {etiqueta} aparece duas vezes no plano de carga do voo {v.voo}.')
                    vistas.add(etiqueta)
                    plano[porao].append(aceites[etiqueta])
            fora = [x for x in prontas if x.etiqueta not in vistas]
            if fora:
                self._ocorrencia(f'{len(fora)} {"mala ficou" if len(fora) == 1 else "malas ficaram"} fora do plano de carga do voo {v.voo} '
                                 f'e não {"sai" if len(fora) == 1 else "saem"} da triagem', voo=v.voo, malas=[x.etiqueta for x in fora])
        for x in fora:
            x.estado = 'em_terra'
        for porao in POROES:
            for x in plano[porao]:
                x.porao = porao
                v.filas[TAPETE[porao]].append(x)
            leves_por_baixo = [a for a, b in zip(plano[porao], plano[porao][1:]) if a.peso < b.peso]
            if leves_por_baixo:
                self._ocorrencia(f'Voo {v.voo}, porão {porao}: há malas leves por baixo de malas mais pesadas '
                                 f'(a {leves_por_baixo[0].etiqueta}, de {leves_por_baixo[0].peso} kg, é carregada antes de uma mais pesada)', voo=v.voo, porao=porao)
        ordenado = all(a.peso >= b.peso for p in POROES for a, b in zip(plano[p], plano[p][1:]))
        previsto = {p: round(sum(x.peso for x in plano[p]), 1) for p in POROES}
        cg = centragem(v.aviao, previsto)
        self._evento('plano', voo=v.voo, plano={p: [x.etiqueta for x in plano[p]] for p in POROES}, pesos=previsto, cg=round(cg, 3),
                     dentro=dentro_dos_limites(v.aviao, cg), fora=[x.etiqueta for x in fora + tardias], ordenado=ordenado, sem_programa=self._planear is None)
        v.fase = 'planeado'

    def _carregar(self, v):
        for tapete, fila in v.filas.items():
            for ordem in range(min(RITMO_CARGA, len(fila))):
                x = fila.pop(0)
                livre = v.aviao['poroes'][x.porao]['livre']
                if v.pesos[x.porao] + x.peso > livre + 1e-9:
                    x.estado = 'em_terra'
                    v.recusadas += 1
                    self._evento('recusa', voo=v.voo, mala=x.etiqueta, porao=x.porao, tapete=tapete, ordem=ordem)
                    # a primeira mala recusada em cada porão é explicada; as seguintes entram na contagem final
                    self._aviso(('cheio', v.voo, x.porao), f'Voo {v.voo}: o porão {x.porao} já leva {v.pesos[x.porao]:.1f} kg de malas e só tem {livre} kg livres; '
                                f'a mala {x.etiqueta}, de {x.peso} kg, não coube e ficou em terra', voo=v.voo, mala=x.etiqueta, porao=x.porao)
                else:
                    x.estado = 'carregada'
                    v.pesos[x.porao] = round(v.pesos[x.porao] + x.peso, 1)
                    v.carregadas[x.porao].append(x)
                    self._evento('carga', voo=v.voo, mala=x.etiqueta, porao=x.porao, tapete=tapete, ordem=ordem, posicao=len(v.carregadas[x.porao]) - 1)
        if not any(v.filas.values()):
            v.fase, v.fim_carga = 'carregado', self.minuto
            v.cg = centragem(v.aviao, v.pesos)
            carregou = any(v.carregadas.values())
            v.dentro = dentro_dos_limites(v.aviao, v.cg) if carregou else None
            self._evento('fim_carga', voo=v.voo, pesos=dict(v.pesos), cg=round(v.cg, 3), dentro=v.dentro)
            if v.recusadas > 1:
                self._ocorrencia(f'Voo {v.voo}: ao todo, {v.recusadas} malas ficaram em terra porque não cabiam no porão indicado no plano de carga', voo=v.voo)
            if v.dentro is False:
                v.atraso += ATRASO_CENTRAGEM
                lado = 'atrás' if v.cg > v.aviao['limite_tras'] else 'à frente'
                self._ocorrencia(f'Voo {v.voo}: centragem fora dos limites (centro de gravidade a {v.cg:.2f} m, demasiado {lado}; '
                                 f'limites {v.aviao["limite_frente"]:.2f} a {v.aviao["limite_tras"]:.2f} m). A equipa muda malas de porão: '
                                 f'{ATRASO_CENTRAGEM} minutos de atraso', voo=v.voo)

    def _embarque(self, v):
        """Fecho do embarque: quem faltou é conhecido e o programa de reconciliação diz que malas saem."""
        a_bordo = [x for p in POROES for x in v.carregadas[p]]
        dados = [{**x.dados(), 'porao': x.porao} for x in a_bordo]
        decisao = []
        if self._reconciliar is None:
            if a_bordo:
                self._aviso('reconciliacao', 'Sem programa de reconciliação: ninguém confere as malas com os passageiros que embarcaram')
        else:
            resposta = self._reconciliar(dados, list(v.embarcados))
            if resposta is None or isinstance(resposta, (str, dict)) or not hasattr(resposta, '__iter__'):
                raise ValueError(f'malas_a_retirar devia devolver um conjunto de etiquetas (voo {v.voo}) e devolveu {resposta!r}.')
            carregadas = {x.etiqueta: x for x in a_bordo}
            for item in resposta:
                etiqueta = item.get('etiqueta') if isinstance(item, dict) else item
                if etiqueta not in carregadas:
                    raise ValueError(f'malas_a_retirar devolveu {item!r}, que não é uma mala carregada no voo {v.voo}.')
                if carregadas[etiqueta] not in decisao:
                    decisao.append(carregadas[etiqueta])
        decisao.sort(key=lambda x: a_bordo.index(x))
        for x in decisao:
            v.retirar[TAPETE[x.porao]].append(x)
            if x.reserva not in v.faltas:
                self._ocorrencia(f'Voo {v.voo}: a mala {x.etiqueta} de {self._nomes.get(x.reserva, x.reserva)} vai ser retirada, '
                                 f'mas o passageiro embarcou', voo=v.voo, mala=x.etiqueta)
        self._evento('embarque', voo=v.voo, embarcados=len(set(v.embarcados)), faltas=sorted(v.faltas), retirar=[x.etiqueta for x in decisao])
        v.fase = 'reconciliacao'

    def _tirar(self, v, x, tapete, manual=False):
        x.estado = 'retirada'
        v.carregadas[x.porao].remove(x)
        v.pesos[x.porao] = round(v.pesos[x.porao] - x.peso, 1)
        self._evento('descarga', voo=v.voo, mala=x.etiqueta, porao=x.porao, tapete=tapete, certa=x.reserva in v.faltas, manual=manual)

    def _fechar(self, v):
        esquecidas = [x for p in POROES for x in v.carregadas[p] if x.reserva in v.faltas]
        for x in esquecidas:
            v.atraso += ATRASO_BUSCA
            self._ocorrencia(f'Voo {v.voo}: a mala {x.etiqueta} é de {self._nomes.get(x.reserva, x.reserva)}, que não embarcou. '
                             f'O avião não pode partir com ela: busca manual no porão {x.porao}, {ATRASO_BUSCA} minutos de atraso', voo=v.voo, mala=x.etiqueta)
            self._tirar(v, x, TAPETE[x.porao], manual=True)
        v.cg = centragem(v.aviao, v.pesos)
        v.partida = max(v.hora, self.minuto + 3) + v.atraso
        self._evento('fecho', voo=v.voo, pesos=dict(v.pesos), cg=round(v.cg, 3), dentro=v.dentro, atraso=v.atraso, partida=v.partida)
        v.fase = 'fechado'

    def passo(self):
        """Avança um minuto em todos os voos."""
        self.simulado = True
        m = self.minuto
        for v in self.voos.values():
            if v.fase == 'espera' and m >= v.hora - PLANO:
                self._fazer_plano(v)
            elif v.fase == 'planeado' and m >= v.hora - SAIDA_REBOQUES:
                v.chega = m + TEMPO_PLACA
                levadas = [x for fila in v.filas.values() for x in fila]
                for x in levadas:
                    x.estado = 'em_reboque'
                self._evento('reboques', voo=v.voo, parte=m, chega=v.chega, malas=len(levadas))
                v.fase = 'reboques'
            elif v.fase == 'reboques' and m >= v.chega:
                v.fase = 'a_carregar'
                self._carregar(v)
            elif v.fase == 'a_carregar':
                self._carregar(v)
            elif v.fase == 'carregado' and m >= max(v.hora - FECHO_EMBARQUE, v.fim_carga + 1):
                self._embarque(v)
            elif v.fase == 'reconciliacao':
                if any(v.retirar.values()):
                    for tapete, fila in v.retirar.items():
                        for _ in range(min(RITMO_DESCARGA, len(fila))):
                            self._tirar(v, fila.pop(0), tapete)
                elif m >= v.hora - FECHO_POROES:
                    self._fechar(v)
            elif v.fase == 'fechado' and m >= v.partida:
                atraso = m - v.hora
                self._evento('partida', voo=v.voo, atraso=atraso)
                if atraso > 0:
                    self._ocorrencia(f'O voo {v.voo} para {v.destino} saiu do lugar {v.lugar} às {_hhmm(m)}, com {atraso} minutos de atraso', voo=v.voo, atraso=atraso)
                v.fase = 'partiu'
        self.minuto += 1

    @property
    def concluida(self):
        return all(v.fase == 'partiu' for v in self.voos.values())

    def correr(self, ate=None, limite=400):
        """Corre a simulação até todos os voos terem partido, até `ate` ou ao fim de `limite` minutos."""
        passos = 0
        while passos < limite and (ate is None or self.minuto < ate):
            if ate is None and self.concluida:
                break
            self.passo()
            passos += 1
        return passos

    def resumo(self):
        por_estado = {e: 0 for e in ESTADOS_MALA}
        for x in self.malas:
            por_estado[x.estado] += 1
        voos = {v.voo: {'lugar': v.lugar, 'estado': v.fase, 'pesos': dict(v.pesos), 'cg': None if v.cg is None else round(v.cg, 3),
                        'dentro': v.dentro, 'atraso': v.atraso if v.partida is None else v.partida - v.hora}
                for v in self.voos.values()}
        return {'minuto': self.minuto, 'hora': _hhmm(self.minuto), 'malas': por_estado, 'voos': voos,
                'atraso_total': sum(d['atraso'] for d in voos.values()), 'ocorrencias': len(self.ocorrencias)}

    def registo(self):
        """Dados para a cena 3D: voos, aviões, malas e o registo de eventos.

        Devolve None quando o programa não chegou a simular o carregamento.
        """
        if not self.simulado:
            return None
        return {'inicio': self.inicio, 'fim': self.minuto, 'origem': self.origem, 'modo': self.modo,
                'tempos': {'plano': PLANO, 'saida_reboques': SAIDA_REBOQUES, 'placa': TEMPO_PLACA, 'ritmo_carga': RITMO_CARGA,
                           'fecho_embarque': FECHO_EMBARQUE, 'fecho_poroes': FECHO_POROES},
                'corda': dict(CORDA), 'poroes': list(POROES), 'tapete': dict(TAPETE),
                'voos': [{'voo': v.voo, 'destino': v.destino, 'hora': v.hora, 'lugar': v.lugar, 'saida': v.saida, 'aviao': self._ficha(v),
                          'passageiros': len(v.passageiros), 'faltas': len(v.faltas)} for v in self.voos.values()],
                'malas': [{'etiqueta': x.etiqueta, 'voo': x.voo, 'peso': x.peso, 'reserva': x.reserva,
                           'nome': self._nomes.get(x.reserva), 'pronta': x.pronta} for x in self.malas],
                'eventos': self.eventos, 'resumo': self.resumo()}
