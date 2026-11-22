"""Motor dos passageiros do Torre Python (Bloco 3, Fase 5): controlo de segurança e porta de embarque.

Python puro, sem dependências do navegador: testa-se com python test-embarque.py
e é carregado pelo Worker como o bagagens.py, o triagem.py, o checkin.py e o carregamento.py.

Depois do check-in, as malas seguem para a triagem e os passageiros seguem a pé para
o controlo de segurança. Cada linha de controlo atende um passageiro de cada vez e
umas são mais rápidas do que outras. Passado o controlo, o passageiro caminha até à
porta de embarque do seu voo, onde o leitor lê o cartão de embarque. A porta fecha
15 minutos antes da partida: quem não entrou até lá fica em terra e as suas malas
têm de sair do porão (é a reconciliação da bagagem, no carregamento.py).

Percurso de um passageiro:
    a_chegar -> na_fila -> no_controlo -> a_caminho -> na_porta -> embarcado
Desvios: em_terra (faltou, chegou tarde ou foi recusado) e saiu (passageiros de outros voos).

Os objetos que decidem o que acontece podem ser os do sistema ou os do aluno:
    Linha(codigo, tempo)          com entrar(passageiro), atender(), espera() e len()
    escolher(linhas, passageiro)  devolve a linha onde o passageiro entra
    Porta(codigo, voo, fecho)     com ler(cartao, minuto), embarcados e faltas(esperados)

O tempo é contado em minutos do dia (480 = 08:00) e avança minuto a minuto. A
simulação é determinística: com os mesmos passageiros e os mesmos programas, o
registo de eventos é sempre igual. É esse registo que o JavaScript reproduz em 3D.
"""
import random

# Parâmetros didáticos (fictícios, não são valores operacionais reais)
CAMINHO_SEGURANCA = 3   # minutos a pé do balcão de check-in até ao controlo de segurança
ABERTURA_PORTA = 40     # a porta de embarque abre 40 minutos antes da partida
FECHO_EMBARQUE = 15     # e fecha 15 minutos antes da partida
CONTAGEM = 6            # minutos depois do fecho em que a porta faz a contagem final
RITMO_PORTA = 6         # cartões lidos por minuto em cada porta
TROCA_PORTA = 2         # minutos a pé entre duas portas
ATRASO_INTRUSO = 6      # minutos perdidos a tirar do avião um passageiro de outro voo
ATRASO_RECONTAGEM = 4   # minutos perdidos a recontar os passageiros quando os números não batem certo
ATRASO_REABERTURA = 3   # minutos perdidos por cada passageiro que entra depois de a porta fechar

LINHAS = ('L1', 'L2', 'L3', 'L4')
TEMPO_LINHA = {'L1': 1, 'L2': 1, 'L3': 2, 'L4': 3}       # minutos por passageiro em cada linha de controlo
PORTAS = ('G21', 'G22', 'G23', 'G24')                     # a porta G21 serve o lugar P21, e assim por diante
CAMINHO_PORTA = {'G21': 2, 'G22': 3, 'G23': 4, 'G24': 5}  # minutos a pé do controlo de segurança até cada porta
ESTADOS = ('a_chegar', 'na_fila', 'no_controlo', 'a_caminho', 'na_porta', 'embarcado', 'em_terra', 'saiu')

_NOMES = ('Ana', 'Rui', 'Inês', 'Tiago', 'Marta', 'João', 'Sofia', 'Pedro', 'Rita', 'Nuno', 'Clara', 'Hugo',
          'Lara', 'Vasco', 'Joana', 'Diogo', 'Beatriz', 'André', 'Carla', 'Miguel', 'Teresa', 'Bruno', 'Helena', 'Luís')
_APELIDOS = ('Silva', 'Costa', 'Pinto', 'Moreira', 'Ramos', 'Teixeira', 'Lopes', 'Sousa', 'Faria', 'Rocha', 'Nunes', 'Maia',
             'Vieira', 'Campos', 'Matos', 'Reis', 'Fonseca', 'Barros', 'Neves', 'Cunha', 'Leite', 'Azevedo', 'Brito', 'Melo')
_LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def _hhmm(minuto):
    return f'{minuto // 60:02d}:{minuto % 60:02d}'


def _plural(n, um, varios):
    return f'{n} {um if n == 1 else varios}'


# --- objetos do sistema ------------------------------------------------------
class ErroEmbarque(Exception):
    """Um cartão de embarque que a porta não pode aceitar."""


class VooErrado(ErroEmbarque):
    pass


class PortaFechada(ErroEmbarque):
    pass


class CartaoRepetido(ErroEmbarque):
    pass


class LinhaDoSistema:
    """Linha de controlo de fábrica: fila por ordem de chegada."""

    def __init__(self, codigo, tempo):
        self.codigo = codigo
        self.tempo = tempo
        self.fila = []

    def entrar(self, passageiro):
        self.fila.append(passageiro)

    def atender(self):
        return self.fila.pop(0) if self.fila else None

    def espera(self):
        return (len(self.fila) + 1) * self.tempo

    def __len__(self):
        return len(self.fila)


def escolher_do_sistema(linhas, passageiro):
    """Escolha de fábrica: a linha onde o passageiro acaba o controlo mais cedo."""
    return min(linhas, key=lambda linha: linha.espera())


class PortaDoSistema:
    """Porta de embarque de fábrica: só entra quem é deste voo, a horas e uma só vez."""

    def __init__(self, codigo, voo, fecho):
        self.codigo, self.voo, self.fecho = codigo, voo, fecho
        self.embarcados = set()

    def ler(self, cartao, minuto):
        if cartao['voo'] != self.voo:
            raise VooErrado(f"{cartao['reserva']} é do voo {cartao['voo']}")
        if minuto >= self.fecho:
            raise PortaFechada(f'a porta {self.codigo} fechou às {_hhmm(self.fecho)}')
        if cartao['reserva'] in self.embarcados:
            raise CartaoRepetido(f"{cartao['reserva']} já embarcou")
        self.embarcados.add(cartao['reserva'])

    def faltas(self, esperados):
        return set(esperados) - self.embarcados


# --- passageiros -------------------------------------------------------------
class Viajante:
    def __init__(self, reserva, nome, voo, hora, chegada, malas=0, lugar=None, porta=None):
        self.reserva, self.nome, self.voo, self.hora = reserva, nome, voo, hora
        self.chegada = chegada         # minuto em que chega ao controlo de segurança (None: nunca chega)
        self.malas = malas             # malas de porão (só para escolher quem falta)
        self.lugar, self.porta = lugar, porta
        self.estado = 'a_chegar'
        self.papel = 'normal'          # normal, ausente, tarde, enganado, duplo ou outro (voo que não acompanhamos)
        self.linha = self.inicio = self.livre = None
        self.destino = porta           # porta para onde caminha (a errada, se estiver enganado)
        self.chega_porta = None
        self.embarcou_em = None
        self.motivo = None             # porque ficou em terra

    def dados(self):
        """O que os programas do aluno recebem na segurança: uma cópia, para não poderem estragar o original."""
        return {'reserva': self.reserva, 'nome': self.nome, 'voo': self.voo, 'hora': self.hora, 'chegada': self.chegada}

    def cartao(self):
        """O cartão de embarque que o leitor da porta lê."""
        return {'reserva': self.reserva, 'nome': self.nome, 'voo': self.voo, 'lugar': self.lugar}

    def __repr__(self):
        return f'Viajante({self.reserva!r}, {self.nome!r}, {self.voo!r}, estado={self.estado!r})'


def criar_passageiros(partidas, semente=1, por_voo=34):
    """Passageiros fictícios para quando o check-in não foi simulado: [{reserva, nome, voo, chegada, malas}].

    Em cada voo há quem chegue com tempo, uma excursão que chega toda junta e alguns passageiros de última hora.
    """
    rng = random.Random(f'embarque-{semente}')
    usadas, lista = set(), []
    for partida in partidas:
        hora = partida['hora']
        excursao, ultima_hora = por_voo // 4, 3
        momento = hora - rng.randint(50, 58)
        chegadas = [rng.randint(hora - 105, hora - 46) for _ in range(por_voo - excursao - ultima_hora)]
        chegadas += [momento] * excursao + [hora - rng.randint(36, 40) for _ in range(ultima_hora)]
        for chegada in chegadas:
            while True:
                reserva = ''.join(rng.choice(_LETRAS) for _ in range(6))
                if reserva not in usadas:
                    usadas.add(reserva)
                    break
            lista.append({'reserva': reserva, 'nome': f'{rng.choice(_NOMES)} {rng.choice(_APELIDOS)}', 'voo': partida['voo'],
                          'chegada': chegada, 'malas': rng.choice((0, 1, 1, 1, 2, 2))})
    return lista


class PortaEmbarque:
    """Uma porta de embarque e o seu voo: fila, leituras e contagem final."""

    def __init__(self, codigo, partida):
        self.codigo = codigo
        self.voo, self.destino, self.hora = partida['voo'], partida['destino'], partida['hora']
        self.abertura, self.fecho = self.hora - ABERTURA_PORTA, self.hora - FECHO_EMBARQUE
        self.fila = []                 # (viajante, leitura repetida?)
        self.a_bordo, self.intrusos = [], []
        self.lidas = []                # reservas aceites pelo leitor, pela ordem (com repetições, se o programa as deixar passar)
        self.repetidos = self.reabertas = self.recusados = 0
        self.contada = False
        self.faltas = []
        self.atraso = 0

    def __repr__(self):
        return f'PortaEmbarque({self.codigo!r}, {self.voo!r})'


class Embarque:
    """Zona de embarque: linhas de controlo de segurança, portas, passageiros e o relógio simulado."""

    def __init__(self, partidas, passageiros=None, semente=1, fechada=None, faltas=3, outros=44, seguranca=True, porta=True):
        self.semente, self.n_faltas, self.n_outros = semente, faltas, outros
        partidas = sorted((dict(p) for p in partidas), key=lambda p: p['hora'])
        self.portas = {}
        for i, p in enumerate(partidas):
            saida = p.get('saida')
            n = int(saida[1:]) - 1 if isinstance(saida, str) and saida[1:].isdigit() and 1 <= int(saida[1:]) <= len(PORTAS) else i % len(PORTAS)
            self.portas[PORTAS[n]] = PortaEmbarque(PORTAS[n], p)
        self.portas = dict(sorted(self.portas.items()))
        self._porta_do_voo = {g.voo: g for g in self.portas.values()}
        self.linhas = {c: {'codigo': c, 'tempo': TEMPO_LINHA[c], 'aberta': c != fechada} for c in LINHAS}
        self._classe_linha, self._escolher = (LinhaDoSistema, escolher_do_sistema) if seguranca else (None, None)
        self._classe_porta, self._erro = (PortaDoSistema, ErroEmbarque) if porta else (None, None)
        self.eventos, self.ocorrencias = [], []
        self._avisos = set()
        self.origem = 'cenario'
        self.simulado = False
        self._montar(criar_passageiros(partidas, semente) if passageiros is None else passageiros)

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
    def _montar(self, passageiros):
        self.passageiros = []
        voos = sorted(self._porta_do_voo, key=lambda voo: self._porta_do_voo[voo].hora)     # por ordem de partida
        for i, voo in enumerate(voos):
            g = self._porta_do_voo[voo]
            rng = random.Random(f'porta-{voo}-{self.semente}')
            grupo = [Viajante(p['reserva'], p['nome'], voo, g.hora, p['chegada'], p.get('malas', 0), porta=g.codigo)
                     for p in passageiros if p['voo'] == voo]
            lugares = [f'{fila}{letra}' for fila in range(1, 31) for letra in 'ABCDEF']
            rng.shuffle(lugares)
            for v, lugar in zip(grupo, lugares):
                v.lugar = lugar
            # Quem não embarca: primeiro passageiros com malas (são esses que obrigam a abrir os porões), depois um sem malas
            com = [v for v in grupo if v.malas]
            sem = [v for v in grupo if not v.malas]
            n_faltas = self.n_faltas.get(voo, 0) if isinstance(self.n_faltas, dict) else self.n_faltas     # um número para todos ou {voo: número}
            n_com = min(len(com), n_faltas - 1 if n_faltas > 1 else n_faltas)
            tarde = rng.sample(com, n_com)
            ausentes = rng.sample(sem, min(len(sem), n_faltas - n_com))
            for v in tarde:
                v.papel = 'tarde'                      # distrai-se nas lojas e só aparece depois de a porta fechar
            for v in ausentes:
                v.papel, v.chegada = 'ausente', None   # fez check-in e nunca mais foi visto
            resto = sorted((v for v in grupo if v.papel == 'normal'), key=lambda v: v.chegada)
            cedo = resto[:max(2, len(resto) // 2)]
            vizinha = self._porta_do_voo[voos[(i + 1) % len(voos)]].codigo
            for v in rng.sample(cedo, min(2, len(cedo))) if len(voos) > 1 else []:
                v.papel, v.destino = 'enganado', vizinha   # vai primeiro para a porta do lado
            normais = [v for v in resto if v.papel == 'normal']
            for v in rng.sample(normais, min(2, len(normais))):
                v.papel = 'duplo'                      # passa o cartão duas vezes no leitor
            self.passageiros += grupo
        # Passageiros de outros voos, que só passam no controlo de segurança
        horas = [g.hora for g in self.portas.values()] or [600]
        rng = random.Random(f'outros-{self.semente}')
        for k in range(self.n_outros):
            v = Viajante(f'OUT{k + 1:03d}', f'{rng.choice(_NOMES)} {rng.choice(_APELIDOS)}', f'PY{rng.choice((201, 202, 203, 204, 205))}',
                         max(horas) + rng.randint(30, 120), rng.randint(min(horas) - 100, max(horas) - 40))
            v.papel = 'outro'
            self.passageiros.append(v)
        self.passageiros.sort(key=lambda v: (v.chegada is None, v.chegada or 0))   # ordenação estável
        self._por_reserva = {v.reserva: v for v in self.passageiros}
        self._chegadas = {}
        for v in self.passageiros:
            if v.chegada is not None:
                self._chegadas.setdefault(v.chegada, []).append(v)
        self.inicio = self.minuto = min(self._chegadas, default=min(horas) - 100) - 1
        self._objetos = None
        self._filas = {c: [] for c in LINHAS}
        self._ocupada = {c: None for c in LINHAS}
        self._a_caminho = {}
        self._esperas = []

    def receber_passageiros(self, passageiros):
        """Troca os passageiros do cenário pelos que o check-in aceitou. Só antes de a simulação começar."""
        if self.simulado:
            raise ValueError('O embarque já começou: os passageiros do check-in têm de chegar antes.')
        self._montar([p for p in passageiros if p['voo'] in self._porta_do_voo])
        self.origem = 'checkin'

    # --- consultas -----------------------------------------------------------
    def consultar_linhas(self):
        return [dict(l) for l in self.linhas.values()]

    def consultar_portas(self):
        return [{'porta': g.codigo, 'voo': g.voo, 'destino': g.destino, 'hora': g.hora, 'abertura': g.abertura, 'fecho': g.fecho}
                for g in self.portas.values()]

    def consultar_cartoes(self, voo=None):
        if voo is not None and voo not in self._porta_do_voo:
            raise KeyError(f'Voo desconhecido nas portas de embarque: {voo}')
        return [{**v.cartao(), 'porta': v.porta} for v in self.passageiros if v.papel != 'outro' and (voo is None or v.voo == voo)]

    # --- ordens --------------------------------------------------------------
    def programar_seguranca(self, classe, escolher):
        if not isinstance(classe, type):
            raise TypeError('programar_seguranca recebe a classe e a função, por exemplo programar_seguranca(Linha, escolher). Não cries o objeto: escreve Linha, sem parênteses.')
        if not callable(escolher):
            raise TypeError('O segundo argumento de programar_seguranca é a função que escolhe a linha, por exemplo programar_seguranca(Linha, escolher).')
        if self.simulado:
            raise ValueError('A segurança já está a funcionar: usa programar_seguranca antes de simular_embarque.')
        self._classe_linha, self._escolher = classe, escolher
        self._evento('programa', programa='seguranca')

    def programar_porta(self, classe, erro):
        if not isinstance(classe, type):
            raise TypeError('programar_porta recebe duas classes, por exemplo programar_porta(Porta, ErroEmbarque). Não cries o objeto: escreve Porta, sem parênteses.')
        if not (isinstance(erro, type) and issubclass(erro, Exception)):
            raise TypeError('O segundo argumento de programar_porta é a classe base das tuas exceções, que tem de herdar de Exception: class ErroEmbarque(Exception).')
        if self.simulado:
            raise ValueError('As portas já estão a funcionar: usa programar_porta antes de simular_embarque.')
        self._classe_porta, self._erro = classe, erro
        self._evento('programa', programa='porta')

    # --- simulação: segurança -------------------------------------------------
    def _preparar(self):
        abertas = [l for l in self.linhas.values() if l['aberta']]
        self._objetos = {}
        if self._classe_linha is not None:
            for l in abertas:
                self._objetos[l['codigo']] = self._classe_linha(l['codigo'], l['tempo'])
        self._leitores = {}
        if self._classe_porta is not None:
            for g in self.portas.values():
                self._leitores[g.codigo] = self._classe_porta(g.codigo, g.voo, g.fecho)

    def _entrar(self, v):
        abertas = [c for c, l in self.linhas.items() if l['aberta']]
        self._evento('chegada', reserva=v.reserva)
        if self._escolher is None:
            codigo = abertas[0]
            self._aviso('seguranca', f'Segurança sem programa: todos os passageiros vão para a linha {codigo}')
        else:
            objetos = [self._objetos[c] for c in abertas]
            escolhida = self._escolher(list(objetos), v.dados())
            codigo = next((c for c, o in self._objetos.items() if o is escolhida), None)
            if codigo is None:
                raise ValueError(f'escolher tem de devolver uma das linhas que recebeu (um objeto Linha) e devolveu {escolhida!r}.')
            escolhida.entrar(v.dados())
        v.estado, v.linha = 'na_fila', codigo
        self._filas[codigo].append(v)
        self._evento('linha', reserva=v.reserva, linha=codigo, posicao=len(self._filas[codigo]))

    def _atender(self, codigo):
        fila = self._filas[codigo]
        if self._escolher is None:
            v = fila[0]
        else:
            resposta = self._objetos[codigo].atender()
            if resposta is None:
                self._aviso(('parada', codigo), f'Linha {codigo} parada: atender() devolveu None com {_plural(len(fila), "passageiro", "passageiros")} à espera')
                return
            reserva = resposta.get('reserva') if isinstance(resposta, dict) else getattr(resposta, 'reserva', None)
            v = next((x for x in fila if x.reserva == reserva), None)
            if v is None:
                outro = self._por_reserva.get(reserva)
                if outro is not None and outro.estado == 'na_fila':
                    raise ValueError(f'A linha {codigo} chamou {outro.nome}, que entrou na linha {outro.linha}. As linhas estão a partilhar a mesma lista? '
                                     f'Cada objeto precisa da sua: cria-a em __init__ com self.fila = [].')
                raise ValueError(f'atender() da linha {codigo} devolveu {resposta!r}, que não é um passageiro à espera nessa linha.')
            if v is not fila[0]:
                self._aviso(('ordem', codigo), f'Linha {codigo}: {v.nome} foi atendido antes de {fila[0].nome}, que chegou primeiro')
        fila.remove(v)
        fim = self.minuto + self.linhas[codigo]['tempo']
        v.estado, v.inicio = 'no_controlo', self.minuto
        self._ocupada[codigo] = (v, fim)
        if v.papel != 'outro':
            self._esperas.append(self.minuto - v.chegada)
        self._evento('controlo', reserva=v.reserva, linha=codigo, fim=fim, espera=self.minuto - v.chegada)

    def _libertar(self, v):
        v.livre = self.minuto
        if v.papel == 'outro':
            v.estado = 'saiu'
            self._evento('livre', reserva=v.reserva, linha=v.linha, porta=None, chega=None)
            return
        chega = self.minuto + CAMINHO_PORTA[v.destino]
        if v.papel == 'tarde':
            chega = max(chega, self._porta_do_voo[v.voo].fecho + 1 + sum(map(ord, v.reserva)) % 4)
        self._caminhar(v, chega)
        self._evento('livre', reserva=v.reserva, linha=v.linha, porta=v.destino, chega=chega)

    def _caminhar(self, v, chega):
        v.estado, v.chega_porta = 'a_caminho', chega
        self._a_caminho.setdefault(chega, []).append(v)

    # --- simulação: portas ----------------------------------------------------
    def _perdeu(self, v, motivo):
        v.estado, v.motivo = 'em_terra', motivo
        self._evento('perdeu', reserva=v.reserva, voo=v.voo, motivo=motivo)
        if motivo == 'atraso':
            espera = '' if v.inicio is None else f' (esperou {v.inicio - v.chegada} minutos na linha {v.linha} da segurança)'
            self._ocorrencia(f'{v.nome}, do voo {v.voo}, chegou à porta {v.porta} depois do fecho e perdeu o voo{espera}', reserva=v.reserva, voo=v.voo)

    def _ler(self, g, v, repetida, ordem):
        m = self.minuto
        razoes = []
        if v.voo != g.voo:
            razoes.append('voo errado')
        if m >= g.fecho:
            razoes.append('porta fechada')
        if repetida or v in g.a_bordo:
            razoes.append('cartão repetido')
        leitor, motivo = self._leitores.get(g.codigo), None
        if leitor is None:
            aceite = True
            self._aviso('porta', 'Portas sem programa: o leitor aceita todos os cartões')
        else:
            try:
                leitor.ler(v.cartao(), m)
                aceite = True
            except self._erro as erro:
                aceite, motivo = False, type(erro).__name__
        self._evento('leitura', porta=g.codigo, voo=g.voo, reserva=v.reserva, aceite=aceite, motivo=motivo, certo=aceite == (not razoes),
                     repetida=repetida, razoes=razoes, ordem=ordem)
        if aceite:
            g.lidas.append(v.reserva)
            if 'voo errado' in razoes:
                v.estado, v.embarcou_em = 'embarcado', g.voo
                g.intrusos.append(v)
                self._ocorrencia(f'Porta {g.codigo}: {v.nome} tem cartão para o voo {v.voo} e entrou no avião do voo {g.voo}', reserva=v.reserva, voo=g.voo)
            elif 'cartão repetido' in razoes:
                g.repetidos += 1
                self._ocorrencia(f'Porta {g.codigo}: o cartão de {v.nome} ({v.reserva}) foi aceite duas vezes', reserva=v.reserva, voo=g.voo)
            else:
                v.estado, v.embarcou_em = 'embarcado', g.voo
                g.a_bordo.append(v)
                if razoes:
                    g.reabertas += 1
                    self._ocorrencia(f'Porta {g.codigo}: {v.nome} entrou às {_hhmm(m)}, depois de a porta fechar ({_hhmm(g.fecho)})', reserva=v.reserva, voo=g.voo)
                elif v.papel == 'duplo':
                    g.fila.insert(0, (v, True))        # o mesmo cartão volta a passar no leitor
        elif not razoes:
            g.recusados += 1
            self._perdeu(v, 'recusado')
            self._ocorrencia(f'Porta {g.codigo}: {v.nome} ({v.reserva}) tinha o cartão em ordem e foi recusado ({motivo})', reserva=v.reserva, voo=g.voo)
        elif 'cartão repetido' in razoes:
            pass                                       # já está a bordo: o leitor só apitou
        elif 'voo errado' in razoes:
            v.destino = v.porta
            self._caminhar(v, m + TROCA_PORTA)         # segue para a porta certa
        else:
            self._perdeu(v, 'tarde' if v.papel == 'tarde' else 'atraso')

    def _contar(self, g):
        """Contagem final: quem falta, quem está a mais e quanto atrasa o voo."""
        esperados = [v for v in self.passageiros if v.voo == g.voo and v.papel != 'outro']
        for v in esperados:
            if v not in g.a_bordo and v.estado != 'em_terra':
                if v in g.fila_viajantes():
                    g.fila[:] = [(x, r) for x, r in g.fila if x is not v]
                self._perdeu(v, 'ausente' if v.chegada is None else 'noutro voo' if v.embarcou_em else 'atraso')
        g.faltas = sorted(v.reserva for v in esperados if v not in g.a_bordo)
        recontar = g.repetidos > 0
        if g.intrusos:
            nomes = ', '.join(v.nome for v in g.intrusos)
            self._ocorrencia(f'Voo {g.voo}: na contagem a bordo há {_plural(len(g.intrusos), "passageiro", "passageiros")} de outro voo ({nomes}). '
                             f'{ATRASO_INTRUSO} minutos de atraso por cada um', voo=g.voo)
        leitor = self._leitores.get(g.codigo)
        if leitor is not None:
            dito = leitor.faltas([v.reserva for v in esperados])
            if dito is None or isinstance(dito, (str, dict)) or not hasattr(dito, '__iter__'):
                raise ValueError(f'faltas(esperados) da porta {g.codigo} devia devolver um conjunto de reservas e devolveu {dito!r}.')
            if set(dito) != set(g.faltas) and not g.intrusos and not g.repetidos:
                recontar = True
                self._ocorrencia(f'Voo {g.voo}: a porta {g.codigo} diz que faltam {len(set(dito))} passageiros e a contagem a bordo dá {len(g.faltas)}', voo=g.voo)
        if recontar:
            self._ocorrencia(f'Voo {g.voo}: os números da porta não batem certo com os lugares ocupados. Recontagem: {ATRASO_RECONTAGEM} minutos de atraso', voo=g.voo)
        g.atraso = ATRASO_INTRUSO * len(g.intrusos) + ATRASO_REABERTURA * g.reabertas + (ATRASO_RECONTAGEM if recontar else 0)
        g.contada = True
        self._evento('contagem', porta=g.codigo, voo=g.voo, embarcados=len(g.a_bordo), faltas=list(g.faltas),
                     intrusos=[v.reserva for v in g.intrusos], atraso=g.atraso)

    def passo(self):
        """Avança um minuto na segurança e nas portas."""
        self.simulado = True
        if self._objetos is None:
            self._preparar()
        m = self.minuto
        abertas = [c for c, l in self.linhas.items() if l['aberta']]
        for codigo in abertas:
            if self._ocupada[codigo] and self._ocupada[codigo][1] <= m:
                v = self._ocupada[codigo][0]
                self._ocupada[codigo] = None
                self._libertar(v)
        for v in self._chegadas.get(m, []):
            self._entrar(v)
        for codigo in abertas:
            if self._ocupada[codigo] is None and self._filas[codigo]:
                self._atender(codigo)
        for v in self._a_caminho.pop(m, []):
            g = self.portas[v.destino]
            if g.contada:
                self._perdeu(v, 'tarde' if v.papel == 'tarde' else 'atraso')
            else:
                v.estado = 'na_porta'
                g.fila.append((v, False))
                self._evento('na_porta', reserva=v.reserva, porta=g.codigo)
        for g in self.portas.values():
            if m == g.abertura:
                self._evento('porta', porta=g.codigo, voo=g.voo, estado='aberta')
            if m == g.fecho:
                self._evento('porta', porta=g.codigo, voo=g.voo, estado='fechada')
            if m >= g.abertura and not g.contada:
                for ordem in range(RITMO_PORTA):
                    if not g.fila:
                        break
                    v, repetida = g.fila.pop(0)
                    self._ler(g, v, repetida, ordem)
            if m == g.fecho + CONTAGEM:
                self._contar(g)
        self.minuto += 1

    @property
    def concluida(self):
        return (all(g.contada for g in self.portas.values()) and not self._a_caminho
                and not any(self._filas.values()) and not any(self._ocupada.values())
                and all(m < self.minuto for m in self._chegadas))

    def correr(self, ate=None, limite=500):
        """Corre a simulação até todas as portas terem feito a contagem final, até `ate` ou ao fim de `limite` minutos."""
        passos = 0
        while passos < limite and (ate is None or self.minuto < ate):
            if ate is None and self.concluida:
                break
            self.passo()
            passos += 1
        return passos

    # --- resultados ----------------------------------------------------------
    def para_a_placa(self):
        """O que a porta de cada voo envia à placa: reservas lidas, quem faltou e o atraso causado na porta."""
        return {g.voo: {'embarcados': list(g.lidas), 'faltas': set(g.faltas), 'atraso': g.atraso} for g in self.portas.values() if g.contada}

    def leituras(self):
        """Registo dos leitores das portas: [{voo, reserva, hora, resultado}], pela ordem das leituras."""
        return [{'voo': e['voo'], 'reserva': e['reserva'], 'hora': _hhmm(e['minuto']), 'resultado': 'embarcou' if e['aceite'] else 'recusado'}
                for e in self.eventos if e['tipo'] == 'leitura']

    def texto_leituras(self, falhas=True):
        """O ficheiro CSV dos leitores. Com `falhas`, cada porta gravou três linhas estragadas, todas de passageiros que não embarcaram."""
        linhas = [[l['voo'], l['reserva'], l['hora'], l['resultado']] for l in self.leituras()]
        if falhas:
            for g in self.portas.values():
                rng = random.Random(f'leitor-{g.voo}-{self.semente}')
                suas = [i for i, l in enumerate(linhas) if l[0] == g.voo]
                faltas = list(g.faltas) or ['??????']
                estragadas = [[g.voo, faltas[0], 'ERRO', 'embarcou'], [g.voo, faltas[-1]], [g.voo, faltas[len(faltas) // 2], '--:--', 'embarcou']]
                for linha in estragadas:
                    linhas.insert(rng.choice(suas) if suas else len(linhas), linha)
                    suas = [i for i, l in enumerate(linhas) if l[0] == g.voo]
        return 'voo,reserva,hora,resultado\n' + ''.join(','.join(l) + '\n' for l in linhas)

    def resumo(self):
        por_estado = {e: 0 for e in ESTADOS}
        for v in self.passageiros:
            if v.papel != 'outro':
                por_estado[v.estado] += 1
        voos = {}
        for g in self.portas.values():
            seus = [v for v in self.passageiros if v.voo == g.voo and v.papel != 'outro']
            voos[g.voo] = {'porta': g.codigo, 'passageiros': len(seus), 'embarcados': len(g.a_bordo),
                           'faltas': sum(v.estado == 'em_terra' for v in seus), 'atrasados': sum(v.motivo == 'atraso' for v in seus),
                           'recusados': g.recusados, 'intrusos': len(g.intrusos), 'atraso': g.atraso, 'contada': g.contada}
        return {'minuto': self.minuto, 'hora': _hhmm(self.minuto), 'passageiros': por_estado, 'voos': voos,
                'espera_maxima': max(self._esperas, default=0),
                'espera_media': round(sum(self._esperas) / len(self._esperas), 1) if self._esperas else 0,
                'atrasados': sum(d['atrasados'] for d in voos.values()),
                'atraso_total': sum(d['atraso'] for d in voos.values()), 'ocorrencias': len(self.ocorrencias)}

    def registo(self):
        """Dados para a cena 3D: linhas, portas, passageiros e o registo de eventos.

        Devolve None quando o programa não chegou a simular o embarque.
        """
        if not self.simulado:
            return None
        return {'inicio': self.inicio, 'fim': self.minuto, 'origem': self.origem,
                'tempos': {'abertura': ABERTURA_PORTA, 'fecho': FECHO_EMBARQUE, 'contagem': CONTAGEM, 'ritmo_porta': RITMO_PORTA, 'troca': TROCA_PORTA},
                'linhas': self.consultar_linhas(),
                'portas': [{**p, 'caminho': CAMINHO_PORTA[p['porta']]} for p in self.consultar_portas()],
                'passageiros': [{'reserva': v.reserva, 'nome': v.nome, 'voo': v.voo, 'lugar': v.lugar, 'porta': v.porta,
                                 'chegada': v.chegada, 'papel': v.papel, 'estado': v.estado, 'motivo': v.motivo} for v in self.passageiros],
                'eventos': self.eventos, 'resumo': self.resumo()}


def _fila_viajantes(self):
    return [v for v, _ in self.fila]


PortaEmbarque.fila_viajantes = _fila_viajantes
