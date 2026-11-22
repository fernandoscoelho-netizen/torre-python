"""Relatório do dia de operação (Bloco 4, Fase 6).

Junta os registos dos quatro motores da manhã (check-in, triagem, embarque e carregamento) em três
tabelas simples, listas de dicionários, que o programa do aluno percorre com compreensões:

    voos         uma linha por partida        (hora, atraso, passageiros, malas, peso...)
    passageiros  uma linha por reserva        (estado, esperas no check-in e na segurança...)
    malas        uma linha por etiqueta       (peso, estado, porão...)

O módulo não simula nada: só lê os registos. `indicadores_do_sistema` calcula os indicadores de
referência, com que `DiaDeOperacao.entregar` confere o relatório entregue pelo programa.
É Python puro e determinístico: os mesmos registos dão sempre as mesmas tabelas.
"""

import copy

# Indicadores que o relatório pode trazer, pela ordem em que aparecem no centro de operações.
INDICADORES = ('pontualidade', 'atrasados', 'taxa_embarque', 'faltas', 'peso', 'esperas')
TITULOS = {
    'pontualidade': 'Pontualidade',
    'atrasados': 'Voos atrasados',
    'taxa_embarque': 'Taxa de embarque',
    'faltas': 'Faltas por voo',
    'peso': 'Peso carregado por voo',
    'esperas': 'Maiores esperas no check-in',
}
MAIORES_ESPERAS = 5        # quantos passageiros entram na lista das maiores esperas
TOLERANCIA = 0.05          # diferença aceite nos valores com casas decimais
ZONAS = ('checkin', 'triagem', 'embarque', 'placa')


def hhmm(minuto):
    return f'{int(minuto) // 60:02d}:{int(minuto) % 60:02d}'


# --- tabelas ---------------------------------------------------------------------------------------
def criar_tabelas(checkin, triagem, embarque, carregamento):
    """Devolve {'voos', 'passageiros', 'malas', 'ocorrencias'} a partir dos quatro registos."""
    partidas = sorted(checkin['partidas'], key=lambda p: (p['hora'], p['voo']))
    porta = {g['voo']: g['porta'] for g in embarque['portas']}
    lugar = {v['voo']: v['lugar'] for v in carregamento['voos']}

    # passageiros: o check-in decide quem é aceite; a porta de embarque diz quem entrou no avião
    chamada, decisao = {}, {}
    for e in checkin['eventos']:
        if e['tipo'] == 'chamada':
            chamada[e['reserva']] = e['minuto']
        elif e['tipo'] == 'decisao':
            decisao[e['reserva']] = e
    na_porta = {p['reserva']: p for p in embarque['passageiros'] if p.get('papel') != 'outro'}
    espera_seguranca = {e['reserva']: e['espera'] for e in embarque['eventos'] if e['tipo'] == 'controlo'}
    passageiros = []
    for p in checkin['passageiros']:
        d = decisao.get(p['reserva'])
        espera = chamada[p['reserva']] - p['chegada'] if p['reserva'] in chamada else None
        if d is None or not d['aceite']:
            estado = 'recusado'
            motivo = 'não chegou a ser atendido' if d is None else ('perdeu o voo na fila' if d.get('perdeu') else d.get('motivo'))
            seguranca = None
        else:
            g = na_porta.get(p['reserva'])
            embarcou = g is not None and g['estado'] == 'embarcado'
            estado = 'embarcou' if embarcou else 'faltou'
            motivo = None if embarcou else {'tarde': 'chegou à porta depois do fecho', 'ausente': 'não apareceu na porta',
                                            'atraso': 'ficou retido na segurança'}.get(g and g.get('motivo'), 'não embarcou')
            seguranca = espera_seguranca.get(p['reserva'])
        passageiros.append({'reserva': p['reserva'], 'nome': p['nome'], 'voo': p['voo'], 'estado': estado, 'motivo': motivo,
                            'espera': espera, 'seguranca': seguranca, 'malas': p['malas'] if estado != 'recusado' else 0})

    # malas: etiquetadas no balcão; a placa diz se ficaram no porão, se saíram ou se nem chegaram a entrar
    porao, retirada = {}, set()
    for e in carregamento['eventos']:
        if e['tipo'] == 'carga':
            porao[e['mala']] = e['porao']
        elif e['tipo'] == 'descarga':
            retirada.add(e['mala'])
    malas = []
    for m in carregamento['malas']:
        etiqueta = m['etiqueta']
        estado = 'retirada' if etiqueta in retirada else ('carregada' if etiqueta in porao else 'em_terra')
        malas.append({'etiqueta': etiqueta, 'voo': m['voo'], 'reserva': m['reserva'], 'peso': m['peso'], 'estado': estado, 'porao': porao.get(etiqueta)})

    # voos
    partiu = {e['voo']: e for e in carregamento['eventos'] if e['tipo'] == 'partida'}
    voos = []
    for p in partidas:
        v = p['voo']
        dele = [x for x in passageiros if x['voo'] == v]
        bagagem = [x for x in malas if x['voo'] == v]
        atraso = partiu[v]['atraso'] if v in partiu else 0
        voos.append({
            'voo': v, 'destino': p['destino'], 'hora': p['hora'], 'porta': porta.get(v), 'lugar': lugar.get(v),
            'partida': partiu[v]['minuto'] if v in partiu else None, 'atraso': atraso,
            'reservas': len(dele), 'aceites': sum(x['estado'] != 'recusado' for x in dele),
            'embarcados': sum(x['estado'] == 'embarcou' for x in dele), 'faltas': sum(x['estado'] == 'faltou' for x in dele),
            'malas': len(bagagem), 'carregadas': sum(x['estado'] == 'carregada' for x in bagagem),
            'retiradas': sum(x['estado'] == 'retirada' for x in bagagem), 'em_terra': sum(x['estado'] == 'em_terra' for x in bagagem),
            'peso': round(sum(x['peso'] for x in bagagem if x['estado'] == 'carregada'), 1),
        })

    ocorrencias = []
    for zona, registo in zip(ZONAS, (checkin, triagem, embarque, carregamento)):
        ocorrencias += [{'minuto': e['minuto'], 'zona': zona, 'texto': e['texto']} for e in registo['eventos'] if e['tipo'] == 'ocorrencia']
    ocorrencias.sort(key=lambda o: o['minuto'])
    return {'voos': voos, 'passageiros': passageiros, 'malas': malas, 'ocorrencias': ocorrencias}


# --- indicadores de referência ----------------------------------------------------------------------
def indicadores_do_sistema(tabelas, n=MAIORES_ESPERAS):
    voos, passageiros, malas = tabelas['voos'], tabelas['passageiros'], tabelas['malas']
    codigos = [v['voo'] for v in voos]
    aceites = [p for p in passageiros if p['estado'] != 'recusado']
    atendidos = [p for p in passageiros if p['espera'] is not None]
    return {
        'pontualidade': round(100 * len([v for v in voos if v['atraso'] == 0]) / len(voos)) if voos else 0,
        'atrasados': [v['voo'] for v in voos if v['atraso'] > 0],
        'taxa_embarque': round(100 * len([p for p in aceites if p['estado'] == 'embarcou']) / len(aceites), 1) if aceites else 0.0,
        'faltas': {c: len([p for p in passageiros if p['voo'] == c and p['estado'] == 'faltou']) for c in codigos},
        'peso': {c: round(sum(m['peso'] for m in malas if m['voo'] == c and m['estado'] == 'carregada'), 1) for c in codigos},
        'esperas': [(p['nome'], p['espera']) for p in sorted(atendidos, key=lambda p: (-p['espera'], p['nome']))[:n]],
    }


def _numero(valor):
    return isinstance(valor, (int, float)) and not isinstance(valor, bool)


def confere(chave, entregue, certo):
    """True se o valor entregue para um indicador coincide com o de referência."""
    try:
        if chave in ('pontualidade', 'taxa_embarque'):
            return _numero(entregue) and abs(entregue - certo) <= TOLERANCIA
        if chave == 'atrasados':
            return isinstance(entregue, (list, tuple)) and list(entregue) == certo
        if chave == 'faltas':
            return isinstance(entregue, dict) and set(entregue) == set(certo) and all(type(entregue[k]) is int and entregue[k] == certo[k] for k in certo)
        if chave == 'peso':
            return isinstance(entregue, dict) and set(entregue) == set(certo) and all(_numero(entregue[k]) and abs(entregue[k] - certo[k]) <= TOLERANCIA for k in certo)
        if chave == 'esperas':
            return isinstance(entregue, (list, tuple)) and [tuple(x) for x in entregue] == certo
    except (TypeError, ValueError, KeyError):
        return False
    return False


def _simples(valor, fundo=0):
    """Cópia do valor só com tipos que cabem em JSON (para o registo)."""
    if isinstance(valor, bool) or valor is None or isinstance(valor, (int, float, str)):
        return valor
    if fundo > 4:
        return repr(valor)[:80]
    if isinstance(valor, dict):
        return {str(k): _simples(v, fundo + 1) for k, v in list(valor.items())[:40]}
    if isinstance(valor, (list, tuple, set, frozenset)):
        itens = sorted(valor, key=repr) if isinstance(valor, (set, frozenset)) else list(valor)
        return [_simples(v, fundo + 1) for v in itens[:40]]
    return repr(valor)[:80]


# --- curvas do dia, minuto a minuto -------------------------------------------------------------------
def criar_curvas(checkin, triagem, embarque, carregamento, tabelas):
    """Contagens acumuladas por voo, minuto a minuto, para o centro de operações reproduzir a manhã."""
    codigos = [v['voo'] for v in tabelas['voos']]
    voo_da_reserva = {p['reserva']: p['voo'] for p in tabelas['passageiros']}
    voo_da_mala = {m['etiqueta']: m['voo'] for m in tabelas['malas']}
    inicio = min(checkin['inicio'], triagem['inicio'], embarque['inicio'], carregamento['inicio'])
    partidas = [v['partida'] for v in tabelas['voos'] if v['partida'] is not None]
    fim = max([checkin['fim'], embarque['fim'], carregamento['fim']] + partidas)
    n = fim - inicio + 1
    series = {c: {k: [0] * n for k in ('aceites', 'triadas', 'embarcados', 'carregadas')} for c in codigos}

    def soma(voo, chave, minuto, quanto=1):
        if voo in series and inicio <= minuto <= fim:
            series[voo][chave][minuto - inicio] += quanto

    for e in checkin['eventos']:
        if e['tipo'] == 'decisao' and e['aceite']:
            soma(voo_da_reserva.get(e['reserva']), 'aceites', e['minuto'])
    triada = set()
    for e in triagem['eventos']:
        if e['tipo'] == 'mala' and e.get('estado') == 'triada' and e['mala'] not in triada:
            triada.add(e['mala'])
            soma(voo_da_mala.get(e['mala']), 'triadas', e['minuto'])
    for e in embarque['eventos']:
        if e['tipo'] == 'leitura' and e['aceite'] and not e.get('repetida') and voo_da_reserva.get(e['reserva']) == e['voo']:
            soma(e['voo'], 'embarcados', e['minuto'])
    for e in carregamento['eventos']:
        if e['tipo'] == 'carga':
            soma(e['voo'], 'carregadas', e['minuto'])
        elif e['tipo'] == 'descarga':
            soma(e['voo'], 'carregadas', e['minuto'], -1)
    for c in codigos:
        for serie in series[c].values():
            for i in range(1, n):
                serie[i] += serie[i - 1]
    return {'inicio': inicio, 'fim': fim, 'voos': series}


# --- o dia --------------------------------------------------------------------------------------------
class DiaDeOperacao:
    """As tabelas do dia e o relatório que o programa entregou."""

    def __init__(self, checkin, triagem, embarque, carregamento):
        self.tabelas = criar_tabelas(checkin, triagem, embarque, carregamento)
        self.sistema = indicadores_do_sistema(self.tabelas)
        self.curvas = criar_curvas(checkin, triagem, embarque, carregamento, self.tabelas)
        self.entregue = None
        self.resultado = {}
        self.ocorrencias = []

    def consultar(self):
        return copy.deepcopy(self.tabelas)

    def resumo(self):
        t = self.tabelas
        return {'hora': hhmm(self.curvas['fim']), 'voos': len(t['voos']), 'passageiros': len(t['passageiros']),
                'malas': len(t['malas']), 'ocorrencias': len(t['ocorrencias'])}

    def entregar(self, relatorio):
        if not isinstance(relatorio, dict):
            raise TypeError('entregar_relatorio recebe um dicionário, por exemplo {"pontualidade": 75, "atrasados": ["PY102"]}.')
        desconhecidas = [k for k in relatorio if k not in INDICADORES]
        if desconhecidas:
            raise KeyError(f'Indicador desconhecido no relatório: {desconhecidas[0]!r}. Usa estes nomes: ' + ', '.join(INDICADORES) + '.')
        self.entregue = dict(relatorio)
        self.resultado = {k: confere(k, relatorio[k], self.sistema[k]) for k in INDICADORES if k in relatorio}
        fim = self.curvas['fim']
        self.ocorrencias = [{'minuto': fim, 'zona': 'relatorio', 'texto': f'Relatório: o indicador {k} ({TITULOS[k]}) não confere com os dados do dia'}
                            for k, certo in self.resultado.items() if not certo]
        return dict(self.resultado)

    def registo(self):
        t = self.tabelas
        return {
            'inicio': self.curvas['inicio'], 'fim': self.curvas['fim'],
            'voos': copy.deepcopy(t['voos']),
            'passageiros': {estado: sum(p['estado'] == estado for p in t['passageiros']) for estado in ('embarcou', 'faltou', 'recusado')},
            'malas': {estado: sum(m['estado'] == estado for m in t['malas']) for estado in ('carregada', 'retirada', 'em_terra')},
            'esperas': {'checkin': _media([p['espera'] for p in t['passageiros'] if p['espera'] is not None]),
                        'seguranca': _media([p['seguranca'] for p in t['passageiros'] if p['seguranca'] is not None])},
            'ocorrencias': copy.deepcopy(t['ocorrencias']) + list(self.ocorrencias),
            'curvas': self.curvas,
            'indicadores': [{'chave': k, 'titulo': TITULOS[k], 'entregue': k in (self.entregue or {}),
                             'valor': _simples(self.entregue[k]) if k in (self.entregue or {}) else None,
                             'confere': self.resultado.get(k)} for k in INDICADORES],
            'entregue': self.entregue is not None,
            'resumo': {**self.resumo(), 'entregues': len(self.resultado), 'certos': sum(self.resultado.values()),
                       'atraso_total': sum(v['atraso'] for v in t['voos'])},
        }


def _media(valores):
    return round(sum(valores) / len(valores), 1) if valores else 0.0
