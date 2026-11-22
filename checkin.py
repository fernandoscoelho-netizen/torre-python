"""Motor da zona de check-in do Torre Python (Bloco 2 · Bagagens, Fase 3).

Python puro, sem dependências do navegador: testa-se com python test-checkin.py
e é carregado pelo Worker como o bagagens.py e o triagem.py.

O check-in é a entrada das malas na rede. Cada passageiro chega ao átrio, espera
numa fila única, é chamado por um balcão, vê a reserva validada e, se for aceite,
despacha as malas: cada mala é pesada, recebe uma etiqueta e segue pelo tapete
coletor até à central de triagem (linhas C1 e C2).

Percurso de um passageiro:
    a_chegar -> na_fila -> no_balcao -> aceite | recusado

Três programas decidem o que acontece, e cada um pode ser o do sistema ou o do aluno:
    validar(passageiro, minuto)   -> "OK" ou o motivo da recusa
    entrar(passageiro) e chamar(balcao, minuto)   -> a fila
    criar_etiqueta(voo, peso)     -> o código da etiqueta de cada mala

O tempo é contado em minutos do dia (480 = 08:00) e avança minuto a minuto. A
simulação é determinística: com os mesmos passageiros e os mesmos programas, o
registo de eventos é sempre igual. É esse registo que o JavaScript reproduz em 3D.
"""
import random
import re

# Parâmetros didáticos (fictícios, não são valores operacionais reais)
FECHO_CHECKIN = 40     # o check-in de um voo fecha 40 minutos antes da partida
URGENCIA = 15          # um passageiro é urgente quando faltam 15 minutos ou menos para o fecho do seu voo
PESO_MAXIMO = 32       # kg: acima disto a mala não pode ser despachada
PESO_PESADA = 23       # kg: acima disto a etiqueta leva um H (aviso para quem carrega a mala)
TEMPO_BASE = 2         # minutos de atendimento de um passageiro aceite, mais 1 por cada mala
TEMPO_RECUSA = 1       # minutos de atendimento de um passageiro recusado
TEMPO_COLETOR = 2      # minutos que a mala demora do balcão até à central de triagem

ESTADOS_PASSAGEIRO = ('a_chegar', 'na_fila', 'no_balcao', 'aceite', 'recusado')
MOTIVOS = ('reserva inválida', 'sem documento', 'voo desconhecido', 'check-in fechado', 'peso inválido')
BALCOES = ('B01', 'B02', 'B03', 'B04', 'B05', 'B06')
LINHA_DO_BALCAO = {'B01': 'C1', 'B02': 'C1', 'B03': 'C1', 'B04': 'C2', 'B05': 'C2', 'B06': 'C2'}

_NOMES = ('Ana', 'Rui', 'Inês', 'Tiago', 'Marta', 'João', 'Sofia', 'Pedro', 'Rita', 'Nuno', 'Clara', 'Hugo',
          'Lara', 'Vasco', 'Joana', 'Diogo', 'Beatriz', 'André', 'Carla', 'Miguel', 'Teresa', 'Bruno', 'Helena', 'Luís')
_APELIDOS = ('Silva', 'Costa', 'Pinto', 'Moreira', 'Ramos', 'Teixeira', 'Lopes', 'Sousa', 'Faria', 'Rocha', 'Nunes', 'Maia',
             'Vieira', 'Campos', 'Matos', 'Reis', 'Fonseca', 'Barros', 'Neves', 'Cunha', 'Leite', 'Azevedo', 'Brito', 'Melo')
_LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def _hhmm(minuto):
    return f'{minuto // 60:02d}:{minuto % 60:02d}'


class Passageiro:
    def __init__(self, reserva, nome, voo, documento, malas, chegada):
        self.reserva = reserva
        self.nome = nome
        self.voo = voo
        self.documento = documento
        self.malas = list(malas)       # peso de cada mala, em kg
        self.chegada = chegada
        self.estado = 'a_chegar'
        self.balcao = None
        self.chamada = None            # minuto em que foi chamado
        self.fim = None                # minuto em que saiu do balcão
        self.decisao = None            # 'OK' ou o motivo dado pelo programa de validação
        self.certo = None              # a decisão foi a certa?

    def dados(self):
        """O que os programas do aluno recebem: uma cópia, para não poderem estragar o original."""
        return {'reserva': self.reserva, 'nome': self.nome, 'voo': self.voo, 'documento': self.documento,
                'malas': list(self.malas), 'chegada': self.chegada}

    def __repr__(self):
        return f'Passageiro({self.reserva!r}, {self.nome!r}, {self.voo!r}, estado={self.estado!r})'


class Balcao:
    def __init__(self, codigo, aberto=True):
        self.codigo = codigo
        self.linha = LINHA_DO_BALCAO[codigo]
        self.aberto = aberto
        self.passageiro = None
        self.atendidos = 0

    def __repr__(self):
        return f'Balcao({self.codigo!r}, aberto={self.aberto}, passageiro={self.passageiro!r})'


def criar_passageiros(partidas, semente=1, por_voo=30, sem_voo=3, atrasados=3):
    """Cria os passageiros de uma manhã (fictícios), já por ordem de chegada.

    Cada voo tem passageiros que chegam com tempo, uma excursão que chega toda no mesmo
    minuto e alguns passageiros de última hora. Alguns passageiros trazem um problema:
    reserva mal escrita, falta de documento, mala com peso impossível, voo que não existe
    (PY900, cancelado) ou chegada depois do fecho do check-in.
    """
    rng = random.Random(f'checkin-{semente}')
    usadas, lista = set(), []

    def reserva():
        while True:
            codigo = ''.join(rng.choice(_LETRAS) for _ in range(6))
            if codigo not in usadas:
                usadas.add(codigo)
                return codigo

    def novo(voo, chegada):
        n = rng.choice((0, 1, 1, 1, 2, 2))
        malas = [round(rng.uniform(7, 22), 1) for _ in range(n)]
        if malas and rng.random() < 0.18:
            malas[0] = round(rng.uniform(23.5, 31), 1)          # mala pesada, mas dentro do limite
        p = Passageiro(reserva(), f'{rng.choice(_NOMES)} {rng.choice(_APELIDOS)}', voo, rng.choice(('CC', 'CC', 'passaporte')), malas, chegada)
        lista.append(p)
        return p

    calmos = []
    for partida in partidas:
        voo, fecho = partida['voo'], partida['hora'] - FECHO_CHECKIN
        ultima_hora = max(3, por_voo // 8)
        excursao = por_voo // 5
        for _ in range(por_voo - excursao - ultima_hora):
            calmos.append(novo(voo, rng.randint(fecho - 76, fecho - 24)))
        minuto = fecho - rng.randint(26, 38)
        for _ in range(excursao):
            novo(voo, minuto)
        for _ in range(ultima_hora):
            novo(voo, fecho - rng.randint(5, 11))
    # Problemas: um por passageiro, sempre em quem chegou com tempo (para o motivo não depender da fila)
    rng.shuffle(calmos)
    estragar = [lambda p: setattr(p, 'reserva', p.reserva[:5]),
                lambda p: setattr(p, 'reserva', p.reserva.lower()),
                lambda p: setattr(p, 'reserva', p.reserva[:3] + '-' + p.reserva[4:]),
                lambda p: setattr(p, 'documento', None),
                lambda p: setattr(p, 'documento', ''),
                lambda p: setattr(p, 'documento', None),
                lambda p: setattr(p, 'malas', [round(rng.uniform(33, 41), 1)] + p.malas[1:]),
                lambda p: setattr(p, 'malas', p.malas[:1] + [0]),
                lambda p: setattr(p, 'malas', [-2.5])]
    for p, defeito in zip(calmos, estragar):
        if not p.malas:
            p.malas = [round(rng.uniform(7, 22), 1)]
        usadas.discard(p.reserva)
        defeito(p)
        while p.reserva in usadas:                               # a reserva mal escrita também não se repete
            p.reserva = p.reserva[:-1] + rng.choice(_LETRAS.lower() if p.reserva.islower() else _LETRAS)
        usadas.add(p.reserva)
    primeiro = min(p['hora'] for p in partidas) - FECHO_CHECKIN
    for _ in range(sem_voo):
        novo('PY900', rng.randint(primeiro - 60, primeiro - 20))
    por_hora = sorted(partidas, key=lambda p: p['hora'])
    for i in range(atrasados):
        partida = por_hora[i % 2]
        novo(partida['voo'], partida['hora'] - FECHO_CHECKIN + rng.randint(2, 7))
    lista.sort(key=lambda p: p.chegada)                          # ordenação estável: empates pela ordem de criação
    return lista


class CheckIn:
    """Zona de check-in: passageiros, fila única, balcões, etiquetas e o relógio simulado."""

    def __init__(self, partidas, passageiros, inicio=480, fechados=(), validar=True, fila=True, etiquetas=True):
        self.partidas = {p['voo']: dict(p) for p in partidas}
        for p in self.partidas.values():
            p['fecho'] = p['hora'] - FECHO_CHECKIN
        self.passageiros = list(passageiros)
        self._por_reserva = {p.reserva: p for p in self.passageiros}
        self.balcoes = {c: Balcao(c, aberto=c not in fechados) for c in BALCOES}
        self.inicio = self.minuto = inicio
        self.eventos = []
        self.ocorrencias = []
        self._avisos = set()
        self._espera = []              # passageiros na fila, por ordem de chegada
        self._agenda = {}              # minuto -> [(tipo, dados...)]
        self._proximo = 0              # índice do próximo passageiro a chegar
        self.malas = []                # malas etiquetadas, por ordem
        self._etiquetas = set()
        self._numeracao = {}           # voo -> etiquetas emitidas
        self._validar = self.validacao_do_sistema if validar else None
        self._entrar, self._chamar = (None, self.chamada_do_sistema) if fila else (None, None)
        self._etiquetar = self.etiqueta_do_sistema if etiquetas else None
        self._contadores = {}          # contadores do programa de etiquetas do sistema
        self.simulado = False

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

    # --- consultas -----------------------------------------------------------
    def consultar_passageiros(self):
        return [p.dados() for p in self.passageiros]

    def consultar_balcoes(self):
        return [{'codigo': b.codigo, 'estado': 'aberto' if b.aberto else 'fechado', 'linha': b.linha,
                 'passageiro': b.passageiro.reserva if b.passageiro else None, 'atendidos': b.atendidos}
                for b in self.balcoes.values()]

    def urgente(self, passageiro, minuto=None):
        """Faltam URGENCIA minutos ou menos para o fecho do check-in do voo do passageiro?"""
        partida = self.partidas.get(passageiro.voo)
        minuto = self.minuto if minuto is None else minuto
        return partida is not None and partida['fecho'] - minuto <= URGENCIA

    def problemas(self, passageiro, minuto):
        """Todos os motivos de recusa que se aplicam ao passageiro neste minuto, pela ordem de MOTIVOS."""
        p, lista = passageiro, []
        r = p.reserva
        if not (isinstance(r, str) and len(r) == 6 and r.isalnum() and r == r.upper()):
            lista.append('reserva inválida')
        if not p.documento:
            lista.append('sem documento')
        partida = self.partidas.get(p.voo)
        if partida is None:
            lista.append('voo desconhecido')
        elif minuto >= partida['fecho']:
            lista.append('check-in fechado')
        if any(isinstance(m, bool) or not isinstance(m, (int, float)) or m <= 0 or m > PESO_MAXIMO for m in p.malas):
            lista.append('peso inválido')
        return lista

    # --- programas do sistema ------------------------------------------------
    def validacao_do_sistema(self, passageiro, minuto):
        """Programa de fábrica dos balcões: o primeiro motivo de recusa, ou "OK"."""
        problemas = self.problemas(self._por_reserva[passageiro['reserva']], minuto)
        return problemas[0] if problemas else 'OK'

    def chamada_do_sistema(self, balcao, minuto):
        """Fila de fábrica: primeiro o passageiro urgente que chegou há mais tempo; se não houver, o primeiro da fila."""
        for p in self._espera:
            if self.urgente(p, minuto):
                return p.reserva
        return self._espera[0].reserva if self._espera else None

    def etiqueta_do_sistema(self, voo, peso):
        """Etiquetas de fábrica: voo, hífen, número de três algarismos seguido por voo e H nas malas pesadas."""
        self._contadores[voo] = self._contadores.get(voo, 0) + 1
        return f'{voo}-{self._contadores[voo]:03d}' + ('H' if peso > PESO_PESADA else '')

    # --- ordens --------------------------------------------------------------
    def programar_validacao(self, funcao):
        if not callable(funcao):
            raise TypeError('programar_validacao recebe uma função, por exemplo programar_validacao(validar).')
        self._validar = funcao
        self._evento('programa', programa='validacao')

    def programar_fila(self, entrar, chamar):
        if not callable(entrar) or not callable(chamar):
            raise TypeError('programar_fila recebe duas funções, por exemplo programar_fila(entrar, chamar).')
        self._entrar, self._chamar = entrar, chamar
        self._evento('programa', programa='fila')

    def programar_etiquetas(self, funcao):
        if not callable(funcao):
            raise TypeError('programar_etiquetas recebe uma função, por exemplo programar_etiquetas(criar_etiqueta).')
        self._etiquetar = funcao
        self._evento('programa', programa='etiquetas')

    # --- simulação -----------------------------------------------------------
    def _chegadas(self):
        m = self.minuto
        while self._proximo < len(self.passageiros) and self.passageiros[self._proximo].chegada <= m:
            p = self.passageiros[self._proximo]
            self._proximo += 1
            p.estado = 'na_fila'
            self._espera.append(p)
            self._evento('chegada', reserva=p.reserva)
            if self._entrar is not None:
                self._entrar(p.dados())

    def _escolher(self, balcao):
        """Pede ao programa da fila o passageiro que o balcão vai atender (ou None)."""
        if self._chamar is None:
            if self._espera:
                self._aviso('fila', 'Fila sem programa: os balcões não chamam ninguém')
            return None
        resposta = self._chamar(balcao.codigo, self.minuto)
        if resposta is None:
            if self._espera:
                self._aviso('parado', f'O balcão {balcao.codigo} ficou livre com passageiros na fila e não chamou ninguém', balcao=balcao.codigo)
            return None
        reserva = resposta.get('reserva') if isinstance(resposta, dict) else resposta
        p = self._por_reserva.get(reserva) if isinstance(reserva, str) else None
        if p is None:
            raise ValueError(f'chamar devolveu {resposta!r}. Devolve o passageiro que recebeste em entrar, ou None se a fila estiver vazia.')
        if p.estado != 'na_fila':
            if p.estado == 'a_chegar':
                raise ValueError(f'chamar devolveu {p.nome} ({p.reserva}), que ainda não chegou ao átrio.')
            raise ValueError(f'chamar devolveu {p.nome} ({p.reserva}), que já tinha sido chamado. Tira o passageiro da fila quando o chamas.')
        return p

    def _atender(self, balcao, p):
        m = self.minuto
        urgentes = [q for q in self._espera if self.urgente(q, m)]
        do_voo = [q for q in self._espera if q.voo == p.voo]
        self._evento('chamada', reserva=p.reserva, balcao=balcao.codigo, posicao=self._espera.index(p), fila=len(self._espera),
                     urgentes=len(urgentes), urgente=p in urgentes, primeiro_do_voo=do_voo[0] is p,
                     primeiro_urgente=bool(urgentes) and urgentes[0] is p)
        self._espera.remove(p)
        p.estado, p.balcao, p.chamada = 'no_balcao', balcao.codigo, m
        balcao.passageiro = p
        if self._validar is None:
            self._aviso('validacao', 'Balcões sem regras de validação: todos os passageiros são aceites')
            dito = 'OK'
        else:
            dito = self._validar(p.dados(), m)
            if dito != 'OK' and dito not in MOTIVOS:
                raise ValueError(f'O programa de validação devolveu {dito!r} para {p.nome} ({p.reserva}). '
                                 f'Devolve "OK" ou um destes motivos: {", ".join(MOTIVOS)}.')
        reais = self.problemas(p, m)
        aceite = dito == 'OK'
        p.decisao = dito
        p.certo = (aceite and not reais) or (not aceite and dito in reais)
        perdeu = 'check-in fechado' in reais and p.chegada < self.partidas[p.voo]['fecho']
        self._evento('decisao', reserva=p.reserva, balcao=balcao.codigo, aceite=aceite, motivo=None if aceite else dito,
                     certo=p.certo, problemas=reais, perdeu=perdeu)
        if perdeu:
            self._ocorrencia(f'{p.nome} chegou às {_hhmm(p.chegada)} e só foi chamado depois do fecho do voo {p.voo}', reserva=p.reserva, voo=p.voo)
        if aceite and reais:
            self._ocorrencia(f'Balcão {balcao.codigo}: {p.nome} foi aceite, mas devia ser recusado ({reais[0]})', reserva=p.reserva)
        elif not aceite and not reais:
            self._ocorrencia(f'Balcão {balcao.codigo}: {p.nome} foi recusado ({dito}), mas estava tudo em ordem', reserva=p.reserva)
        elif not aceite and not p.certo:
            self._ocorrencia(f'Balcão {balcao.codigo}: {p.nome} foi recusado por "{dito}", mas o problema era "{reais[0]}"', reserva=p.reserva)
        if aceite:
            for k in range(len(p.malas)):
                self._agenda.setdefault(m + 1 + k, []).append(('mala', balcao, p, k))
            fim = m + TEMPO_BASE + len(p.malas)
        else:
            fim = m + TEMPO_RECUSA
        self._agenda.setdefault(fim, []).append(('fim', balcao, p, aceite))

    def _etiqueta(self, balcao, p, k):
        """Pesa a mala k do passageiro, pede a etiqueta ao programa e põe a mala no tapete coletor."""
        peso, voo = p.malas[k], p.voo
        ordem = len(self.malas) + 1
        numero = self._numeracao.get(voo, 0) + 1
        self._numeracao[voo] = numero
        texto, legivel, certa = None, False, False
        if self._etiquetar is None:
            self._aviso('etiquetas', 'Balcões sem programa de etiquetas: as malas seguem sem etiqueta')
        else:
            texto = self._etiquetar(voo, peso)
            pesada = isinstance(peso, (int, float)) and peso > PESO_PESADA
            if not isinstance(texto, str) or not re.fullmatch(re.escape(voo) + r'-\d{3}H?', texto):
                self._ocorrencia(f'Etiqueta mal formada no balcão {balcao.codigo}: {texto!r} (esperava-se algo como {voo}-{numero:03d})', balcao=balcao.codigo)
                texto = None if not isinstance(texto, str) else texto
            elif texto in self._etiquetas:
                self._ocorrencia(f'Etiqueta repetida no balcão {balcao.codigo}: {texto}', balcao=balcao.codigo)
            else:
                legivel = True
                self._etiquetas.add(texto)
                certa = True
                if int(texto[len(voo) + 1:len(voo) + 4]) != numero:
                    certa = False
                    self._aviso(('numeracao', voo), f'Numeração do voo {voo} fora de ordem: saiu {texto} e esperava-se o número {numero:03d}', voo=voo)
                if texto.endswith('H') != pesada:
                    certa = False
                    self._ocorrencia(f'Mala de {peso} kg com a etiqueta {texto}: ' + ('falta o H de mala pesada' if pesada else 'tem um H a mais'), balcao=balcao.codigo)
        codigo = texto if legivel else f'SEM-{ordem:03d}'
        mala = {'codigo': codigo, 'etiqueta': texto, 'voo': voo, 'peso': peso, 'legivel': legivel, 'certa': certa, 'reserva': p.reserva,
                'balcao': balcao.codigo, 'entrada': balcao.linha, 'minuto': self.minuto + TEMPO_COLETOR, 'indice': k}
        self.malas.append(mala)
        self._evento('mala', mala=codigo, etiqueta=texto, reserva=p.reserva, balcao=balcao.codigo, indice=k, peso=peso,
                     legivel=legivel, certa=certa, linha=balcao.linha)

    def passo(self):
        """Avança um minuto: chegadas, malas etiquetadas, saídas dos balcões e novas chamadas."""
        self.simulado = True
        self._chegadas()
        for tipo, balcao, p, extra in sorted(self._agenda.pop(self.minuto, []), key=lambda a: (a[0] == 'fim', a[1].codigo)):
            if tipo == 'mala':
                self._etiqueta(balcao, p, extra)
            else:
                p.estado, p.fim = ('aceite' if extra else 'recusado'), self.minuto
                balcao.passageiro = None
                balcao.atendidos += 1
                self._evento('saida', reserva=p.reserva, balcao=balcao.codigo, estado=p.estado)
        for balcao in self.balcoes.values():
            if balcao.aberto and balcao.passageiro is None:
                p = self._escolher(balcao)
                if p is not None:
                    self._atender(balcao, p)
        self.minuto += 1

    @property
    def concluida(self):
        return self._proximo == len(self.passageiros) and not self._agenda and not self._espera

    def correr(self, ate=None, limite=None):
        """Corre a simulação até todos os passageiros terem sido atendidos, até `ate` ou até ao fecho do último voo.

        Devolve o número de minutos simulados.
        """
        ultimo = max((p['fecho'] for p in self.partidas.values()), default=self.inicio) + 25
        if self.passageiros:
            ultimo = max(ultimo, self.passageiros[-1].chegada + 25)
        fim = ultimo if limite is None else self.minuto + limite
        passos = 0
        while self.minuto < fim and (ate is None or self.minuto < ate):
            if ate is None and self.concluida:
                break
            self.passo()
            passos += 1
        if ate is None and self._espera and not self._agenda:
            self._aviso('esquecidos', f'{len(self._espera)} passageiros ficaram na fila sem serem chamados')
        return passos

    def malas_para_triagem(self):
        """As malas etiquetadas, tal como entram na central de triagem."""
        return [{k: m[k] for k in ('codigo', 'voo', 'peso', 'legivel', 'entrada', 'minuto')} for m in self.malas]

    def resumo(self):
        por_estado = {e: 0 for e in ESTADOS_PASSAGEIRO}
        for p in self.passageiros:
            por_estado[p.estado] += 1
        esperas = [p.chamada - p.chegada for p in self.passageiros if p.chamada is not None]
        decisoes = [e for e in self.eventos if e['tipo'] == 'decisao']
        return {'minuto': self.minuto, 'hora': _hhmm(self.minuto), 'passageiros': por_estado, 'malas': len(self.malas),
                'erros': sum(not e['certo'] for e in decisoes), 'perderam_voo': sum(e['perdeu'] for e in decisoes),
                'espera_media': round(sum(esperas) / len(esperas), 1) if esperas else 0,
                'espera_maxima': max(esperas, default=0), 'ocorrencias': len(self.ocorrencias)}

    def registo(self):
        """Dados para a cena 3D: partidas, balcões, passageiros e o registo de eventos.

        Devolve None quando o programa não chegou a simular o check-in.
        """
        if not self.simulado:
            return None
        return {'inicio': self.inicio, 'fim': self.minuto, 'fecho_checkin': FECHO_CHECKIN, 'urgencia': URGENCIA,
                'tempo_coletor': TEMPO_COLETOR, 'peso_pesada': PESO_PESADA,
                'partidas': [dict(p) for p in self.partidas.values()],
                'balcoes': [{'codigo': b.codigo, 'aberto': b.aberto, 'linha': b.linha} for b in self.balcoes.values()],
                'passageiros': [{'reserva': p.reserva, 'nome': p.nome, 'voo': p.voo, 'malas': len(p.malas), 'chegada': p.chegada}
                                for p in self.passageiros],
                'eventos': self.eventos, 'resumo': self.resumo()}
