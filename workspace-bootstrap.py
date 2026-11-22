import ast, json, traceback, sys, textwrap


def _workspace_function_sources():
    """Read definitions from exactly the bootstrap loaded by this Worker."""
    source = globals().get('_workspace_bootstrap_source')
    if not source:
        raise RuntimeError('O código das funções ainda não foi carregado.')
    tree = ast.parse(source)
    handler = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == '_workspace_handle')
    definitions = [n for n in handler.body[0].body if isinstance(n, ast.FunctionDef)]
    names = {n.name for n in definitions}
    lines = source.splitlines(keepends=True)
    return [dict(
        name=node.name,
        code=textwrap.dedent(''.join(lines[node.lineno-1:node.end_lineno])),
        internal=node.name.startswith('_'),
        dependencies=sorted({n.func.id for n in ast.walk(node)
                             if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
                             and n.func.id in names and n.func.id != node.name})
    ) for node in definitions]

_DADOS_DIR = '/dados'
_COMPANHIAS = [
    {'codigo': 'PX', 'nome': 'Porto Express', 'pais': 'Portugal', 'alianca': None, 'cor': '#1d4f86', 'ficticia': True},
    {'codigo': 'TP', 'nome': 'TAP Air Portugal', 'pais': 'Portugal', 'alianca': 'Star Alliance', 'cor': '#00a650', 'ficticia': False},
    {'codigo': 'FR', 'nome': 'Ryanair', 'pais': 'Irlanda', 'alianca': None, 'cor': '#073590', 'ficticia': False},
    {'codigo': 'U2', 'nome': 'easyJet', 'pais': 'Reino Unido', 'alianca': None, 'cor': '#ff6600', 'ficticia': False},
    {'codigo': 'LH', 'nome': 'Lufthansa', 'pais': 'Alemanha', 'alianca': 'Star Alliance', 'cor': '#05164d', 'ficticia': False},
    {'codigo': 'EK', 'nome': 'Emirates', 'pais': 'Emirados Árabes Unidos', 'alianca': None, 'cor': '#d71921', 'ficticia': False},
]
_CAMPOS_VOO = ['codigo', 'tipo', 'hora', 'cidade', 'codigo_cidade', 'continente', 'origem', 'destino', 'passageiros', 'aeronave']


def _hhmm(minutos):
    return f'{minutos // 60:02d}:{minutos % 60:02d}'


def _preparar_dados(voos_json=None):
    """Write the learning data files into the browser's virtual file system (Pyodide only)."""
    import csv, io, os
    if sys.platform != 'emscripten' and voos_json is None:
        return
    voos_json = voos_json if voos_json is not None else globals().get('_voos_exemplo_json')
    if not voos_json:
        return
    voos = json.loads(voos_json)
    os.makedirs(_DADOS_DIR, exist_ok=True)
    linhas = [{**{k: v.get(k) for k in _CAMPOS_VOO}, 'hora': _hhmm(v['hora'])} for v in voos]
    with open(_DADOS_DIR + '/voos.csv', 'w', encoding='utf-8', newline='') as f:
        escritor = csv.DictWriter(f, fieldnames=_CAMPOS_VOO)
        escritor.writeheader()
        escritor.writerows(linhas)
    sujos = [dict(l) for l in linhas[:20]]
    sujos[2]['passageiros'] = 'cento e vinte'
    sujos[4]['hora'] = '25:10'
    sujos[6]['codigo'] = ''
    sujos[9]['tipo'] = sujos[9]['tipo'].capitalize()
    sujos[11]['cidade'] = '  ' + sujos[11]['cidade'] + ' '
    sujos.insert(14, dict(sujos[13]))
    texto = io.StringIO()
    escritor = csv.DictWriter(texto, fieldnames=_CAMPOS_VOO, lineterminator='\n')
    escritor.writeheader()
    escritor.writerows(sujos)
    partes = texto.getvalue().splitlines()
    partes[17] = ','.join(partes[17].split(',')[:6])
    with open(_DADOS_DIR + '/voos_sujos.csv', 'w', encoding='utf-8', newline='') as f:
        f.write('\n'.join(partes) + '\n')
    with open(_DADOS_DIR + '/companhias.json', 'w', encoding='utf-8') as f:
        json.dump(_COMPANHIAS, f, ensure_ascii=False, indent=2)


_STDLIB_PROTEGIDOS = {'random', 'math', 'csv', 'json', 'datetime', 'time', 'os', 'sys', 'collections', 'statistics',
                      'zoneinfo', 'string', 're', 'io', 'pathlib', 'typing', 'copy', 'itertools', 'functools', 'ast',
                      'tempfile', 'traceback', 'textwrap', 'enum', 'dataclasses', 'decimal', 'fractions', 'operator',
                      'bagagens', 'triagem', 'checkin', 'carregamento', 'embarque', 'relatorio'}
_PROJETO = {'dir': None, 'nomes': set()}


def _preparar_modulos(files_json):
    """Write the student's extra .py tabs to a project folder and make them importable afresh."""
    import os, re, tempfile
    ficheiros = json.loads(files_json or '{}')
    if _PROJETO['dir'] is None:
        _PROJETO['dir'] = '/home/pyodide/projeto' if sys.platform == 'emscripten' else tempfile.mkdtemp(prefix='projeto_')
    pasta = _PROJETO['dir']
    os.makedirs(pasta, exist_ok=True)
    sys.dont_write_bytecode = True
    import shutil
    shutil.rmtree(os.path.join(pasta, '__pycache__'), ignore_errors=True)
    for antigo in os.listdir(pasta):
        if antigo.endswith('.py'):
            os.remove(os.path.join(pasta, antigo))
    for nome in list(_PROJETO['nomes']):
        sys.modules.pop(nome, None)
    _PROJETO['nomes'] = set()
    for nome, texto in ficheiros.items():
        if not re.fullmatch(r'[a-z_][a-z0-9_]*\.py', nome) or nome == 'chegada.py' or nome[:-3] in _STDLIB_PROTEGIDOS:
            raise ValueError(f'Nome de módulo inválido: {nome}')
        with open(os.path.join(pasta, nome), 'w', encoding='utf-8') as f:
            f.write(texto)
        _PROJETO['nomes'].add(nome[:-3])
    if pasta in sys.path:
        sys.path.remove(pasta)
    sys.path.insert(0, pasta)
    import importlib
    importlib.invalidate_caches()


def _modulo_motor(nome):
    """Motores do Bloco 2 (bagagens.py, triagem.py, checkin.py, carregamento.py, embarque.py, relatorio.py): no navegador vêm do Worker; nos testes, da pasta do projeto."""
    modulo = sys.modules.get(nome)
    if modulo is not None:
        return modulo
    fonte = globals().get(f'_{nome}_source')
    if fonte is None:
        import importlib
        return importlib.import_module(nome)
    import types
    modulo = types.ModuleType(nome)
    exec(compile(fonte, nome + '.py', 'exec'), modulo.__dict__)
    sys.modules[nome] = modulo
    return modulo


def _modulo_bagagens():
    return _modulo_motor('bagagens')


# Cenários das bagagens: o nível escolhe a sala inicial; '#n' é uma variante usada só na avaliação.
_AVARIAS_T03 = [dict(avaria=615, ocupados=[]), dict(avaria=608, ocupados=['T01']), dict(avaria=620, ocupados=['T04', 'T01'])]


def _cenario_bagagens(lesson_id):
    bag = _modulo_bagagens()
    nivel, _, variante = str(lesson_id or '').partition('#')
    if nivel != 'baggage_fault':
        return bag.SalaRecolha([bag.criar_voo('PY001', 600, 150, 120)])
    n = int(variante or 0)
    cenario = _AVARIAS_T03[n]
    voos = [bag.criar_voo('PY001', 600, 150, 120, semente=n + 1)]
    voos += [bag.criar_voo(f'PY{2 + i:03d}', 590, 90, 50, semente=n + 1) for i, _ in enumerate(cenario['ocupados'])]
    sala = bag.SalaRecolha(voos, semente=n + 1)
    for i, tapete in enumerate(cenario['ocupados']):
        sala.atribuir_tapete(f'PY{2 + i:03d}', tapete)
        sala.iniciar_motor(tapete)
    sala.atribuir_tapete('PY001', 'T03')
    sala.iniciar_motor('T03')
    sala.agendar_avaria('T03', cenario['avaria'])
    return sala


# Cenários da triagem: em cada manhã os voos saem por saídas diferentes; '#n' é uma variante usada só na avaliação.
_PARTIDAS = [('PY101', 'Lisboa', 600, 2), ('PY102', 'Madrid', 610, 0), ('PY103', 'Paris', 620, 1), ('PY104', 'Londres', 630, 0)]
_MANHAS = [dict(saidas=['S01', 'S02', 'S03', 'S04'], fora=None, avarias=[('A2', 'A3', 486)]),
           dict(saidas=['S03', 'S01', 'S04', 'S02'], fora=('A2', 'A3'), avarias=[('A1', 'A2', 484)]),
           dict(saidas=['S02', 'S04', 'S01', 'S03'], fora=('A3', 'B3'), avarias=[('A3', 'A4', 485), ('A2', 'B2', 491, 6)])]


def _cenario_triagem(lesson_id):
    tri = _modulo_motor('triagem')
    nivel, _, variante = str(lesson_id or '').partition('#')
    n = int(variante or 0)
    manha = _MANHAS[n]
    do_checkin = nivel.startswith(('checkin_', 'loading_', 'boarding_', 'report_'))     # nestes níveis as malas só existem depois de simular o check-in
    partidas = [tri.criar_partida(voo, destino, hora, saida, 0 if do_checkin else 36, semente=n + 1, ilegiveis=0 if do_checkin else ilegiveis)
                for (voo, destino, hora, ilegiveis), saida in zip(_PARTIDAS, manha['saidas'])]
    central = tri.CentralTriagem(partidas, semente=n + 1, sem_voo=0 if do_checkin else 3, programar=nivel != 'sorting_tags', rotas=nivel != 'sorting_routes')
    if nivel == 'sorting_routes' and manha['fora']:
        central.agendar_avaria(*manha['fora'], central.inicio, duracao=600)     # troço fora de serviço toda a manhã
        central._inicio_do_minuto()
    if nivel == 'sorting_fault':
        for avaria in manha['avarias']:
            central.agendar_avaria(*avaria)
    return central


# Cenários do check-in: os mesmos voos da triagem; em cada manhã há um balcão fechado e passageiros diferentes.
_BALCAO_FECHADO = ['B06', 'B03', 'B05']
_BALCOES_FECHADOS_NO_RELATORIO = [('B06', 'B02'), ('B03', 'B05'), ('B05', 'B01')]     # dia do relatório: dois balcões fechados
_PASSAGEIROS_POR_VOO = 36


def _cenario_checkin(lesson_id, central):
    ck = _modulo_motor('checkin')
    nivel, _, variante = str(lesson_id or '').partition('#')
    n = int(variante or 0)
    partidas = central.consultar_partidas()
    passageiros = ck.criar_passageiros(partidas, semente=n + 1, por_voo=_PASSAGEIROS_POR_VOO)
    fechados = _BALCOES_FECHADOS_NO_RELATORIO[n] if nivel.startswith('report_') else (_BALCAO_FECHADO[n],)
    return ck.CheckIn(partidas, passageiros, fechados=fechados, validar=nivel != 'checkin_validate',
                      fila=nivel != 'checkin_queue', etiquetas=nivel != 'checkin_tags')


# Cenários do carregamento: os mesmos voos; cada nível tem a sua dificuldade (porões apertados, centragem ou passageiros que faltam).
_MODO_CARGA = {'loading_plan': 'apertado', 'loading_balance': 'centragem'}
_SEM_RECONCILIACAO = [(1, 3), (0, 2), (2,)]     # dia do relatório: posição, por ordem de partida, dos voos sem leitor


def _cenario_carregamento(lesson_id, central):
    car = _modulo_motor('carregamento')
    nivel, _, variante = str(lesson_id or '').partition('#')
    n = int(variante or 0)
    placa = car.Placa(central.consultar_partidas(), semente=n + 1, modo=_MODO_CARGA.get(nivel, 'folgado'),
                      faltas=0 if nivel in _MODO_CARGA else 3, plano=nivel not in _MODO_CARGA, reconciliacao=nivel != 'loading_reconcile')
    if nivel.startswith('report_'):
        # Dia do relatório: o leitor de reconciliação falha em alguns lugares e as malas de quem faltou só saem numa busca manual
        ordem = [p['voo'] for p in sorted(central.consultar_partidas(), key=lambda p: p['hora'])]
        sem_leitor = {ordem[i] for i in _SEM_RECONCILIACAO[n]}
        de_fabrica = placa.reconciliacao_do_sistema
        placa._reconciliar = lambda malas, embarcados: set() if malas and malas[0]['voo'] in sem_leitor else de_fabrica(malas, embarcados)
    return placa


# Cenários do embarque: os mesmos voos; em cada manhã há uma linha de controlo fechada e passageiros diferentes.
_LINHA_FECHADA = ['L3', 'L4', 'L3']
_FALTAS_NO_RELATORIO = [(2, 4, 0, 3), (3, 1, 5, 2), (0, 2, 4, 1)]
_DADOS = {'dir': None}


def _pasta_dados():
    """Pasta dos ficheiros de dados: /dados no navegador; uma pasta temporária nos testes."""
    if _DADOS['dir'] is None:
        import os, tempfile
        _DADOS['dir'] = _DADOS_DIR if sys.platform == 'emscripten' else tempfile.mkdtemp(prefix='dados_')
        os.makedirs(_DADOS['dir'], exist_ok=True)
    return _DADOS['dir']


def _cenario_embarque(lesson_id, central):
    emb = _modulo_motor('embarque')
    nivel, _, variante = str(lesson_id or '').partition('#')
    n = int(variante or 0)
    faltas = 3
    if nivel.startswith('report_'):                                              # dia do relatório: cada voo com o seu número de faltas
        ordem = [p['voo'] for p in sorted(central.consultar_partidas(), key=lambda p: p['hora'])]
        faltas = dict(zip(ordem, _FALTAS_NO_RELATORIO[n]))
    return emb.Embarque(central.consultar_partidas(), semente=n + 1, fechada=_LINHA_FECHADA[n], faltas=faltas,
                        seguranca=nivel != 'boarding_security', porta=nivel != 'boarding_gate')


def _workspace_handle(source, snapshot_json, mode, lesson_id=None, stdin='', files_json='{}'):
    try:
        if mode == 'lexicon':
            return json.dumps({'ok': True, 'mode': mode, 'functions': _workspace_function_sources()}, ensure_ascii=False)
        compiled = compile(source, 'programa.py', 'exec')
        if mode == 'validate':
            return json.dumps({'ok': True, 'mode': mode})
        snapshot = json.loads(snapshot_json)
        parks = {p['code']: dict(p) for p in snapshot['stands']}
        actions = []
        flight_state = {'PY001': 'em_aproximacao'}
        def consultar_parqueamentos():
            return [{'codigo': p['code'], 'tipo': p['type'], 'ocupado': bool(p.get('occupiedBy')), 'voo': p.get('occupiedBy')} for p in parks.values()]
        def lugares_livres():
            return [p['code'] for p in parks.values() if not p.get('occupiedBy')]
        def parqueamento_livre(codigo):
            if codigo not in parks:
                raise KeyError(f'Parqueamento desconhecido: {codigo}')
            return not bool(parks[codigo].get('occupiedBy'))
        def estado_voo(codigo):
            if codigo not in flight_state:
                raise KeyError(f'Voo desconhecido nesta missão: {codigo}')
            return flight_state[codigo]
        def aterrar(codigo):
            if not isinstance(codigo, str):
                raise TypeError('O código do voo deve ser uma string.')
            if codigo != 'PY001':
                raise ValueError('Nesta missão, o voo de chegada é PY001.')
            if flight_state[codigo] != 'em_aproximacao':
                raise ValueError('Este voo já recebeu uma autorização de aterragem.')
            actions.append({'type': 'land', 'flight': codigo})
            flight_state[codigo] = 'na_pista'
        def parquear(codigo, destino):
            if codigo != 'PY001':
                raise ValueError('Nesta missão, o voo de chegada é PY001.')
            if destino not in parks:
                raise KeyError(f'Parqueamento desconhecido: {destino}')
            if parks[destino].get('occupiedBy'):
                raise ValueError(f'O parqueamento {destino} está ocupado.')
            if destino != 'P04':
                raise ValueError('A rota desta primeira missão termina em P04. Usa esse parqueamento.')
            if flight_state[codigo] != 'na_pista':
                raise ValueError('É necessário aterrar o avião antes de o parquear.')
            actions.append({'type': 'park', 'flight': codigo, 'stand': destino})
            parks[destino]['occupiedBy'] = codigo
            flight_state[codigo] = 'estacionado'
        day = snapshot.get('day', {})
        day_flights = day.get('voos', [])
        runway_reservations = [dict(r) for r in day.get('reservas', [])]
        _relogio = {'minuto': None}
        _duracao = {'chegada': 6, 'partida': 5}
        _por_codigo = {f['codigo']: f for f in day_flights}
        _autorizacoes = [dict(d) for d in day.get('despachos', [])]
        _linhas_entrada = iter(str(stdin or '').splitlines())
        def consultar_voos(tipo=None):
            if tipo not in (None, 'chegada', 'partida'):
                raise ValueError('Usa chegada ou partida para o tipo.')
            return [dict(f) for f in day_flights if tipo is None or f['tipo'] == tipo]
        def voos_para(cidade):
            return [dict(f) for f in day_flights if f['tipo'] == 'partida' and f['destino'].casefold() == cidade.casefold()]
        def contar_voos(cidade=None, continente=None, tipo=None):
            return sum(1 for f in consultar_voos(tipo) if (cidade is None or f['cidade'].casefold() == cidade.casefold()) and (continente is None or f['continente'].casefold() == continente.casefold()))
        def hora_atual():
            if _relogio['minuto'] is not None:
                return _relogio['minuto']
            return int(day.get('hora', 360))
        def _minutes(value):
            if isinstance(value, str):
                h, m = map(int, value.split(':'))
                if not (0 <= h <= 23 and 0 <= m <= 59):
                    raise ValueError('Hora inválida.')
                return h * 60 + m
            if type(value) is not int:
                raise TypeError('Usa minutos inteiros ou HH:MM.')
            return value
        def pista_livre(inicio=None, fim=None):
            if inicio is None and fim is None:
                if _relogio['minuto'] is not None:
                    return pista_livre(_relogio['minuto'], _relogio['minuto'] + 1)
                return bool(day.get('pista', {}).get('livre', True))
            if inicio is None or fim is None:
                raise ValueError('Indica inicio e fim.')
            start, end = _minutes(inicio), _minutes(fim)
            if not (hora_atual() <= start < end <= 1440):
                return False
            intervals = [(f['inicio'], f['fim']) for f in day_flights if f.get('inicio') is not None]
            intervals += [(r['inicio'], r['fim']) for r in runway_reservations]
            intervals += [(d['inicio'], d['inicio'] + _duracao[_por_codigo[d['codigo']]['tipo']]) for d in _autorizacoes
                          if d['codigo'] in _por_codigo and _por_codigo[d['codigo']].get('estado', 'previsto') == 'previsto']
            return not any(start < b and end > a for a, b in intervals)
        def reservar_pista(inicio, fim, operacao):
            if operacao not in ('aterrar', 'descolar'):
                raise ValueError('A operação deve ser aterrar ou descolar.')
            start, end = _minutes(inicio), _minutes(fim)
            if not pista_livre(start, end):
                raise ValueError('A pista não está disponível nesse intervalo.')
            runway_reservations.append({'inicio': start, 'fim': end, 'operacao': operacao})
            actions.append({'type': 'reserve-runway', 'start': start, 'end': end, 'operation': operacao})
        def ao_minuto(funcao, inicio=None, fim=None):
            if not callable(funcao):
                raise TypeError('ao_minuto recebe uma função, por exemplo ao_minuto(torre).')
            start = hora_atual() if inicio is None else _minutes(inicio)
            end = 1440 if fim is None else _minutes(fim)
            if not (0 <= start < end <= 1440):
                raise ValueError('O intervalo deve estar entre 00:00 e 24:00, com inicio antes de fim.')
            passos = 0
            try:
                for minuto in range(start, end):
                    _relogio['minuto'] = minuto
                    funcao(minuto)
                    passos += 1
            finally:
                _relogio['minuto'] = None
            return passos
        def autorizar(codigo, inicio=None, lugar=None):
            if codigo not in _por_codigo:
                raise KeyError(f'Voo desconhecido no painel do dia: {codigo}')
            voo = _por_codigo[codigo]
            if voo.get('estado', 'previsto') != 'previsto':
                raise ValueError(f'{codigo} já está {voo["estado"]}.')
            if any(d['codigo'] == codigo for d in _autorizacoes):
                raise ValueError(f'{codigo} já foi autorizado.')
            start = hora_atual() if inicio is None else _minutes(inicio)
            start = max(start, voo['hora']) if inicio is None else start
            if start < voo['hora']:
                raise ValueError(f'{codigo} só está previsto para as {voo["hora"] // 60:02d}:{voo["hora"] % 60:02d}.')
            end = start + _duracao[voo['tipo']]
            if voo['tipo'] == 'partida' and lugar is not None:
                raise ValueError('Uma partida sai do lugar onde está o avião; não indiques lugar.')
            if lugar is not None and lugar not in parks:
                raise KeyError(f'Parqueamento desconhecido: {lugar}')
            if not pista_livre(start, end):
                raise ValueError(f'A pista não está livre para {codigo} entre {start} e {end}.')
            _autorizacoes.append({'codigo': codigo, 'inicio': start, 'lugar': lugar})
            actions.append({'type': 'dispatch', 'flight': codigo, 'start': start, 'stand': lugar})
            return (start, end)
        _bag = _modulo_bagagens()
        _sala = _cenario_bagagens(lesson_id)
        def consultar_tapetes():
            return [{'codigo': t.codigo, 'estado': t.estado, 'voo': t.voo, 'motor': t.motor_ligado, 'malas': len(t.malas)}
                    for t in _sala.tapetes.values()]
        def atribuir_tapete(voo, tapete):
            _sala.atribuir_tapete(voo, tapete)
        def iniciar_motor(tapete):
            _sala.iniciar_motor(tapete)
        def parar_motor(tapete):
            _sala.parar_motor(tapete)
        def libertar_tapete(tapete):
            _sala.libertar_tapete(tapete)
        def estado_tapete(tapete):
            return _sala._tapete(tapete).estado
        def transferir_voo(voo, tapete):
            _sala.transferir_voo(voo, tapete)
        def ocorrencias():
            return [dict(o) for o in sorted(_sala.ocorrencias + _balcoes.ocorrencias + _central.ocorrencias + _portas.ocorrencias + _placa.ocorrencias + (_dia['obj'].ocorrencias if _dia['obj'] else []), key=lambda o: o['minuto'])]
        def contar_malas(voo, estado=None):
            if estado is not None and estado not in _bag.ESTADOS_MALA:
                raise ValueError('Estado desconhecido. Usa um destes: ' + ', '.join(_bag.ESTADOS_MALA) + '.')
            return _sala.contar_malas(voo, estado)
        def simular_bagagens(controlador=None, ate=None):
            if controlador is not None and not callable(controlador):
                raise TypeError('simular_bagagens recebe uma função, por exemplo simular_bagagens(controlar).')
            fim = None if ate is None else _minutes(ate)
            _sala.correr(None if controlador is None else (lambda sala, minuto: controlador(minuto)), ate=fim)
            return _sala.resumo()
        _central = _cenario_triagem(lesson_id)
        def consultar_partidas():
            return _central.consultar_partidas()
        def consultar_rede():
            return _central.rede()
        def programar_leitor(funcao):
            _central.programar_leitor(funcao)
        def definir_rota(saida, rota):
            _central.definir_rota(saida, rota)
        def consultar_rotas():
            return _central.consultar_rotas()
        def estado_troco(origem, destino):
            return _central.estado_troco(origem, destino)
        def simular_triagem(controlador=None, ate=None):
            if controlador is not None and not callable(controlador):
                raise TypeError('simular_triagem recebe uma função, por exemplo simular_triagem(reagir).')
            fim = None if ate is None else _minutes(ate)
            if _balcoes.simulado and _central.origem != 'checkin' and _central.minuto == _central.inicio:
                _central.receber_malas(_balcoes.malas_para_triagem())
            _central.correr(None if controlador is None else (lambda central, minuto: controlador(minuto)), ate=fim)
            return _central.resumo()
        _balcoes = _cenario_checkin(lesson_id, _central)
        def consultar_passageiros():
            return _balcoes.consultar_passageiros()
        def consultar_balcoes():
            return _balcoes.consultar_balcoes()
        def programar_validacao(funcao):
            _balcoes.programar_validacao(funcao)
        def programar_fila(entrar, chamar):
            _balcoes.programar_fila(entrar, chamar)
        def programar_etiquetas(funcao):
            _balcoes.programar_etiquetas(funcao)
        def simular_checkin(ate=None):
            fim = None if ate is None else _minutes(ate)
            _balcoes.correr(ate=fim)
            return _balcoes.resumo()
        _placa = _cenario_carregamento(lesson_id, _central)
        def consultar_avioes():
            return _placa.consultar_avioes()
        def consultar_malas(voo=None):
            return _placa.consultar_malas(voo)
        def programar_plano(funcao):
            _placa.programar_plano(funcao)
        def programar_reconciliacao(funcao):
            _placa.programar_reconciliacao(funcao)
        def simular_carregamento(ate=None):
            fim = None if ate is None else _minutes(ate)
            _ligado = _placa.origem == 'triagem'
            if _balcoes.simulado and _central.origem == 'checkin' and _central.concluida and not _placa.simulado and _placa.origem != 'triagem':
                saida_do_voo = {p['voo']: p['saida'] for p in _central.consultar_partidas()}
                voo_da_mala = {m['codigo']: m['voo'] for m in _balcoes.malas}
                chegada = {e['mala']: e['minuto'] for e in _central.eventos
                           if e['tipo'] == 'mala' and e.get('estado') == 'triada' and e.get('saida') == saida_do_voo.get(voo_da_mala.get(e['mala']))}
                _placa.receber_malas([{'etiqueta': m['codigo'], 'voo': m['voo'], 'peso': m['peso'], 'reserva': m['reserva'], 'pronta': chegada.get(m['codigo'])}
                                      for m in _balcoes.malas if m['voo'] in saida_do_voo],
                                     [{'reserva': p.reserva, 'nome': p.nome, 'voo': p.voo, 'malas': len(p.malas)} for p in _balcoes.passageiros if p.estado == 'aceite'])
            if not _ligado and _placa.origem == 'triagem' and _portas.origem == 'checkin' and _portas.concluida:
                # a porta de embarque diz à placa quem embarcou; no nível dos ficheiros, a lista é a que o programa entregar
                _placa.receber_embarque(_portas.para_a_placa(), None if _nivel != 'boarding_files' else _entregues)
            _placa.correr(ate=fim)
            return _placa.resumo()
        import os as _os
        _nivel = str(lesson_id or '').partition('#')[0]
        _portas = _cenario_embarque(lesson_id, _central)
        _entregues = {}
        FICHEIRO_LEITURAS = _pasta_dados() + '/leituras.csv'
        FICHEIRO_FALTAS = _pasta_dados() + '/faltas.json'
        for _antigo in (FICHEIRO_LEITURAS, FICHEIRO_FALTAS):
            if _os.path.exists(_antigo):
                _os.remove(_antigo)
        def consultar_linhas():
            return _portas.consultar_linhas()
        def consultar_portas():
            return _portas.consultar_portas()
        def consultar_cartoes(voo=None):
            if _balcoes.simulado and not _portas.simulado and _portas.origem != 'checkin':
                _portas.receber_passageiros([{'reserva': p.reserva, 'nome': p.nome, 'voo': p.voo, 'chegada': p.fim + 3, 'malas': len(p.malas)}
                                             for p in _balcoes.passageiros if p.estado == 'aceite'])
            return _portas.consultar_cartoes(voo)
        def programar_seguranca(classe, escolher):
            _portas.programar_seguranca(classe, escolher)
        def programar_porta(classe, erro):
            _portas.programar_porta(classe, erro)
        def simular_embarque(ate=None):
            fim = None if ate is None else _minutes(ate)
            if _balcoes.simulado and not _portas.simulado and _portas.origem != 'checkin':
                _portas.receber_passageiros([{'reserva': p.reserva, 'nome': p.nome, 'voo': p.voo, 'chegada': p.fim + 3, 'malas': len(p.malas)}
                                             for p in _balcoes.passageiros if p.estado == 'aceite'])
            _portas.correr(ate=fim)
            with open(FICHEIRO_LEITURAS, 'w', encoding='utf-8', newline='') as f:
                f.write(_portas.texto_leituras())
            return _portas.resumo()
        def entregar_embarcados(embarcados):
            if not isinstance(embarcados, dict):
                raise TypeError('entregar_embarcados recebe um dicionário {voo: conjunto de reservas}.')
            if _placa.simulado:
                raise ValueError('O carregamento já começou: entrega os embarcados antes de simular_carregamento().')
            for voo, reservas in embarcados.items():
                if isinstance(reservas, (str, dict)) or not hasattr(reservas, '__iter__'):
                    raise TypeError(f'Em entregar_embarcados, o voo {voo} devia ter um conjunto de reservas e tem {reservas!r}.')
                _entregues[voo] = list(reservas)
        _dia = {'obj': None}
        def simular_dia():
            if _dia['obj'] is None:
                simular_checkin()
                simular_triagem()
                simular_embarque()
                simular_carregamento()
                if not (_balcoes.concluida and _portas.concluida and _placa.concluida):
                    raise ValueError('O dia não chegou ao fim: não uses o argumento ate nas simulações antes de simular_dia().')
                _dia['obj'] = _modulo_motor('relatorio').DiaDeOperacao(_balcoes.registo(), _central.registo(), _portas.registo(), _placa.registo())
            return _dia['obj'].resumo()
        def consultar_dia():
            simular_dia()
            return _dia['obj'].consultar()
        def entregar_relatorio(relatorio):
            simular_dia()
            return _dia['obj'].entregar(relatorio)
        def _entrada(mensagem=''):
            print(mensagem, end='')
            try:
                resposta = next(_linhas_entrada)
            except StopIteration:
                print()
                raise EOFError('Não há mais entradas. Escreve as respostas no campo Entradas do programa, uma por linha.') from None
            print(resposta)
            return resposta
        api = dict(consultar_parqueamentos=consultar_parqueamentos, lugares_livres=lugares_livres, parqueamento_livre=parqueamento_livre, estado_voo=estado_voo, aterrar=aterrar, parquear=parquear)
        api.update(consultar_voos=consultar_voos, voos_para=voos_para, contar_voos=contar_voos, hora_atual=hora_atual, pista_livre=pista_livre, reservar_pista=reservar_pista, autorizar=autorizar, ao_minuto=ao_minuto, input=_entrada, voos=consultar_voos(), MAX_VOOS=100, HORA_INICIAL=360)
        api.update(consultar_tapetes=consultar_tapetes, atribuir_tapete=atribuir_tapete, iniciar_motor=iniciar_motor, parar_motor=parar_motor, libertar_tapete=libertar_tapete, contar_malas=contar_malas, simular_bagagens=simular_bagagens, estado_tapete=estado_tapete, transferir_voo=transferir_voo, ocorrencias=ocorrencias)
        api.update(consultar_partidas=consultar_partidas, consultar_rede=consultar_rede, programar_leitor=programar_leitor, definir_rota=definir_rota, consultar_rotas=consultar_rotas, estado_troco=estado_troco, simular_triagem=simular_triagem)
        api.update(consultar_avioes=consultar_avioes, consultar_malas=consultar_malas, programar_plano=programar_plano, programar_reconciliacao=programar_reconciliacao, simular_carregamento=simular_carregamento)
        api.update(consultar_passageiros=consultar_passageiros, consultar_balcoes=consultar_balcoes, programar_validacao=programar_validacao, programar_fila=programar_fila, programar_etiquetas=programar_etiquetas, simular_checkin=simular_checkin)
        api.update(consultar_linhas=consultar_linhas, consultar_portas=consultar_portas, consultar_cartoes=consultar_cartoes, programar_seguranca=programar_seguranca, programar_porta=programar_porta, simular_embarque=simular_embarque, entregar_embarcados=entregar_embarcados, FICHEIRO_LEITURAS=FICHEIRO_LEITURAS, FICHEIRO_FALTAS=FICHEIRO_FALTAS)
        api.update(simular_dia=simular_dia, consultar_dia=consultar_dia, entregar_relatorio=entregar_relatorio)
        if mode in ('run', 'assess'):
            _preparar_dados()
            _preparar_modulos(files_json)
        namespace = {'__name__': '__main__', **api}
        exec(compiled, namespace)
        assigned = {n.id for n in ast.walk(ast.parse(source)) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store)}
        assigned.update(n.name for n in ast.walk(ast.parse(source)) if isinstance(n, (ast.FunctionDef, ast.ClassDef)))
        variables = []
        for name, value in namespace.items():
            if name.startswith('_') or (name in api and name not in assigned):
                continue
            representation = repr(value)
            variables.append({'name': name, 'type': type(value).__name__, 'value': representation[:180]})
            if len(variables) >= 30:
                break
        return json.dumps({'ok': True, 'mode': mode, 'actions': actions, 'variables': variables, 'grade': _grade_solution(source, namespace, lesson_id) if mode == 'assess' else None, 'baggage': _sala.registo(), 'sorting': _central.registo(), 'checkin': _balcoes.registo(), 'loading': _placa.registo(), 'boarding': _portas.registo(), 'report': _dia['obj'].registo() if _dia['obj'] else None}, ensure_ascii=False)
    except BaseException as error:
        line = getattr(error, 'lineno', None)
        modulo = None
        filename = getattr(error, 'filename', None)
        if isinstance(error, SyntaxError) and filename and _PROJETO['dir'] and filename.startswith(_PROJETO['dir']):
            modulo = (filename.rsplit('/', 1)[-1], error.lineno)
            line = None
        for frame in traceback.extract_tb(error.__traceback__):
            if frame.filename == 'programa.py':
                line = frame.lineno
            elif _PROJETO['dir'] and frame.filename.startswith(_PROJETO['dir']):
                modulo = (frame.filename.rsplit('/', 1)[-1], frame.lineno)
        return json.dumps({'ok': False, 'mode': mode, 'error': {'type': type(error).__name__, 'message': (f'{modulo[0]}, linha {modulo[1]}: ' if modulo else '') + str(error), 'file': modulo[0] if modulo else None, 'fileLine': modulo[1] if modulo else None, 'line': line, 'column': getattr(error, 'offset', 1) or 1, 'endColumn': getattr(error, 'end_offset', None), 'traceback': ''.join(traceback.format_exception(error))}}, ensure_ascii=False)
