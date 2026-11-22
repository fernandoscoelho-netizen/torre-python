import copy, math, tempfile, pathlib

_NOVOS_NIVEIS = {'panel', 'priority', 'holding', 'sets', 'metar', 'fees', 'stdlib', 'data', 'objects', 'tower', 'baggage_claim', 'baggage_fault', 'sorting_tags', 'sorting_routes', 'sorting_fault'}

def _grade_solution(source, ns, lesson):
    tests = []
    tree = ast.parse(source)
    def check(label, fn):
        try:
            passed = bool(fn())
            message = 'Correto.' if passed else 'Revê este critério e volta a avaliar.'
        except BaseException as e:
            passed = False
            message = type(e).__name__ + ': ' + str(e)
        tests.append(dict(label=label, passed=passed, message=message))
    names = dict(math='calcular_ocupacao', choice='pode_operar', lists='codigos_partidas', dicts='contar_continentes', matrix='matriz_horarios', while_='minutos_intervalo', query='contar_destino', errors='dividir_seguro', files='guardar_e_ler')
    name = names.get('while_' if lesson == 'while' else lesson)
    definition = next((n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name), None)
    def call(*args):
        if definition is None or not callable(ns.get(name)):
            raise ValueError('Define a função ' + str(name) + ' no teu programa.')
        return ns[name](*copy.deepcopy(args))
    def uses(kind):
        return definition is not None and any(isinstance(n, kind) for n in ast.walk(definition))
    agenda = [dict(codigo='T1',tipo='chegada',destino='Porto',continente='Europa',hora=420,passageiros=88),dict(codigo='T2',tipo='partida',destino='Lisboa',continente='Europa',hora=470,passageiros=120),dict(codigo='T3',tipo='partida',destino='Madrid',continente='Europa',hora=480,passageiros=99),dict(codigo='T4',tipo='partida',destino='LISBOA',continente='África',hora=510,passageiros=160)]
    if lesson == 'types':
        assigned = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store)}
        for key, value in [('MAX_VOOS',100),('codigo','PX100'),('passageiros',120),('ocupacao',0.8),('pista_disponivel',True)]:
            check(key + ': ' + type(value).__name__ + ' = ' + repr(value), lambda k=key,v=value: k in assigned and type(ns.get(k)) is type(v) and ns[k] == v)
    elif lesson == 'math':
        for a,b,want in [(125,250,50),(0,180,0),(180,180,100),(30,120,25)]:
            def valid(a=a,b=b,want=want):
                got=call(a,b)
                return type(got) in (int,float) and math.isclose(got,want)
            check(f'Ocupação de {a}/{b}: {want}%',valid)
    elif lesson == 'choice':
        check('A função usa if', lambda: uses(ast.If))
        for a,b in [(True,True),(True,False),(False,True),(False,False)]:
            check(f'Pista={a}; autorização={b}', lambda a=a,b=b: call(a,b) is (a and b))
    elif lesson == 'lists':
        check('Seleciona partidas e mantém a ordem',lambda: call(agenda)==['T2','T3','T4'])
        check('Agenda diferente e ordem invertida',lambda: call(agenda[::-1])==['T4','T3','T2'])
        check('Agenda vazia',lambda: call([])==[])
    elif lesson == 'dicts':
        check('Usa for ou uma compreensão',lambda: uses((ast.For,ast.comprehension)))
        check('Conta movimentos por continente',lambda: call(agenda)=={'Europa':3,'África':1})
        check('Aceita novos continentes',lambda: call([{'continente':'Ásia'},{'continente':'Ásia'},{'continente':'Oceânia'}])=={'Ásia':2,'Oceânia':1})
        check('Agenda vazia',lambda: call([])=={})
    elif lesson == 'matrix':
        def matrix_valid(data):
            got=call(data)
            return type(got) is list and all(type(row) is list for row in got) and got==[[f['hora'],f['codigo'],f['passageiros']] for f in data]
        check('Cria as linhas com os três campos',lambda: matrix_valid(agenda))
        check('Mantém a ordem recebida',lambda: matrix_valid(agenda[::-1]))
        check('Agenda vazia',lambda: matrix_valid([]))
    elif lesson == 'while':
        check('Usa um ciclo while',lambda: uses(ast.While))
        for a,b in [(3,7),(6,6),(8,4),(0,3)]:
            check(f'Intervalo [{a}, {b}[',lambda a=a,b=b: call(a,b)==list(range(a,b)))
    elif lesson == 'query':
        for data,city,want in [(agenda,'Lisboa',2),(agenda,'LISBOA',2),(agenda,'Madrid',1),(agenda,'Paris',0),([],'Lisboa',0)]:
            def query_valid(data=data,city=city,want=want):
                got=call(data,city)
                return type(got) is int and got==want
            check(f'{len(data)} movimentos; destino {city}: {want}',query_valid)
    elif lesson == 'errors':
        check('Usa try/except ZeroDivisionError',lambda: uses(ast.Try) and any(isinstance(n,ast.ExceptHandler) and isinstance(n.type,ast.Name) and n.type.id=='ZeroDivisionError' for n in ast.walk(definition)))
        check('Divisão normal',lambda: call(9,2)==4.5)
        check('Resultado negativo',lambda: call(-8,2)==-4)
        check('Divisor zero devolve None',lambda: call(8,0) is None)
    elif lesson == 'files':
        check('Usa with e open',lambda: uses(ast.With) and any(isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='open' for n in ast.walk(definition)))
        for codes in [['AA1','BB2','CC3'],[],['ZX9']]:
            def file_valid(codes=codes):
                with tempfile.TemporaryDirectory() as folder:
                    path=str(pathlib.Path(folder)/('teste_'+str(len(codes))+'.txt'))
                    got=call(path,codes)
                    return type(got) is list and got==codes and pathlib.Path(path).read_text(encoding='utf-8').splitlines()==codes
            check(f'Grava e lê {len(codes)} códigos no caminho recebido',file_valid)
    elif lesson in _NOVOS_NIVEIS:
        def fn(nome):
            alvo = ns.get(nome)
            if not callable(alvo):
                raise ValueError('Define ' + nome + ' no teu programa.')
            return alvo
        def chamar(nome, *args, **kwargs):
            return fn(nome)(*copy.deepcopy(args), **copy.deepcopy(kwargs))
        def defn(nome):
            return next((n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name == nome), None)
        def usa(nome, tipo):
            d = defn(nome)
            return d is not None and any(isinstance(n, tipo) for n in ast.walk(d))
        def chama(nome, funcao):
            d = defn(nome) if nome else tree
            return d is not None and any(isinstance(n, ast.Call) and getattr(n.func, 'id', getattr(n.func, 'attr', None)) == funcao for n in ast.walk(d))
        if lesson == 'panel':
            def ref(c, d, h, l, e):
                return f'{c:<7}{d:<14}{h // 60:02d}:{h % 60:02d} {l:^5} {e}'
            check('O programa usa input()', lambda: chama(None, 'input'))
            check('linha_painel usa uma f-string', lambda: usa('linha_painel', ast.JoinedStr))
            for args in [('PX100', 'Lisboa', 365, 'P04', 'EMBARQUE'), ('PX7', 'Nova Iorque', 1439, 'M01', 'ATRASADO'), ('PX1234', 'Roma', 0, 'W2', 'A HORAS')]:
                check(f'Linha de {args[0]} às {ref(*args)[21:26]}', lambda a=args: chamar('linha_painel', *a) == ref(*a))
        elif lesson == 'priority':
            casos = [((20, False, False, 0), 1), ((90, True, False, 0), 1), ((29, False, True, 90), 1), ((30, False, True, 0), 2),
                     ((44, False, False, 0), 3), ((45, False, False, 61), 4), ((45, False, False, 60), 5), ((200, False, False, 5), 5)]
            for args, esperado in casos:
                check(f'Combustível {args[0]} min, MAYDAY={args[1]}, PAN-PAN={args[2]}, atraso {args[3]}: prioridade {esperado}',
                      lambda a=args, e=esperado: chamar('prioridade', *a) == e)
        elif lesson == 'holding':
            check('Usa um ciclo while', lambda: usa('simular_espera', ast.While))
            for args, esperado in [((2400, 900, 50, 17), ('aterra', 17)), ((2400, 900, 50, 40), ('desvia', 30)),
                                   ((2400, 900, 50, 30), ('aterra', 30)), ((1000, 900, 50, 99), ('desvia', 2)), ((5000, 1000, 100, 1), ('aterra', 1))]:
                check(f'{args[0]} kg, reserva {args[1]} kg, nevoeiro levanta ao minuto {args[3]}: {esperado}',
                      lambda a=args, e=esperado: tuple(chamar('simular_espera', *a)) == e)
        elif lesson == 'sets':
            lugares = [dict(codigo='P01', tipo='jetbridge', ocupado=True), dict(codigo='P02', tipo='jetbridge', ocupado=False),
                       dict(codigo='W01', tipo='walk', ocupado=False), dict(codigo='W02', tipo='walk', ocupado=True),
                       dict(codigo='M01', tipo='jetbridge', ocupado=False)]
            check('Corpo estreito: todos os livres', lambda: chamar('lugares_compativeis', lugares, False) == {'P02', 'W01', 'M01'})
            check('Corpo largo: só livres com manga', lambda: chamar('lugares_compativeis', lugares, True) == {'P02', 'M01'})
            check('Devolve um set', lambda: type(chamar('lugares_compativeis', lugares, False)) is set)
            check('Sem lugares livres', lambda: chamar('lugares_compativeis', [dict(codigo='X', tipo='walk', ocupado=True)], False) == set())
            check('Colisões: interseção', lambda: chamar('colisoes', ['P01', 'P02', 'W02'], {'P01', 'W02', 'M01'}) == {'P01', 'W02'})
            check('Colisões: nenhuma', lambda: chamar('colisoes', [], {'P01'}) == set())
        elif lesson == 'metar':
            casos = [
                ('LPPR 171430Z 32018G28KT 9999 FEW020 17/09 Q1018', dict(aeroporto='LPPR', dia=17, hora='14:30', direcao=320, vento=18, rajada=28, visibilidade=9999, temperatura=17, pressao=1018)),
                ('LPPT 020600Z 05006KT 0400 FG M02/M03 Q1031', dict(aeroporto='LPPT', dia=2, hora='06:00', direcao=50, vento=6, rajada=None, visibilidade=400, temperatura=-2, pressao=1031)),
                ('LEVX 310005Z 18030G45KT 3000 BKN008 08/M01 Q0995', dict(aeroporto='LEVX', dia=31, hora='00:05', direcao=180, vento=30, rajada=45, visibilidade=3000, temperatura=8, pressao=995)),
            ]
            for texto, esperado in casos:
                check(texto[:22] + '…', lambda t=texto, e=esperado: chamar('ler_metar', t) == e)
        elif lesson == 'fees':
            def ref(peso, pax, minutos, manga=True):
                a = round(peso * 7.85, 2)
                p = round(pax * 12.40, 2)
                e = round(max(0, minutos - 30) * (1.20 if manga else 0.60), 2)
                return (a, p, e, round(a + p + e, 2))
            def igual(got, want):
                return type(got) is tuple and len(got) == 4 and all(math.isclose(x, y, abs_tol=0.005) for x, y in zip(got, want))
            check('Não usa print dentro de calcular_taxas', lambda: not chama('calcular_taxas', 'print') and defn('calcular_taxas') is not None)
            check('manga tem valor por omissão', lambda: (d := defn('calcular_taxas')) is not None and len(d.args.defaults) >= 1)
            for args in [(70, 168, 45), (70, 168, 45, False), (300, 350, 30), (0, 0, 0), (41.5, 80, 125, False)]:
                check(f'Taxas para {args}', lambda a=args: igual(chamar('calcular_taxas', *a), ref(*a)))
        elif lesson == 'stdlib':
            check('Importa zoneinfo', lambda: any(isinstance(n, (ast.Import, ast.ImportFrom)) and ('zoneinfo' in [getattr(n, 'module', None)] + [x.name for x in n.names]) for n in ast.walk(tree)))
            for args, esperado in [(('2026-03-15T10:35', 485, 'America/New_York'), '2026-03-15 14:40'),
                                   (('2026-07-01T23:30', 150, 'Europe/Madrid'), '2026-07-02 03:00'),
                                   (('2026-01-10T06:05', 60, 'Europe/Lisbon'), '2026-01-10 07:05'),
                                   (('2026-10-25T00:30', 120, 'Europe/Lisbon'), '2026-10-25 01:30')]:
                check(f'{args[0]} + {args[1]} min → {args[2]}', lambda a=args, e=esperado: chamar('hora_chegada_local', *a) == e)
        elif lesson == 'data':
            conteudo = ('codigo,tipo,hora,destino,passageiros\n'
                        'AA1,partida,06:05,Lisboa,120\n'
                        'AA2,Chegada,06:30, Paris ,80\n'
                        'AA3,partida,25:10,Roma,90\n'
                        ',partida,07:00,Madrid,100\n'
                        'AA4,chegada,07:15,Londres,cem\n'
                        'AA1,partida,06:05,Lisboa,120\n'
                        'AA5,partida,08:00\n'
                        'AA6,chegada,23:59,Dubai,350\n')
            check('Usa with e open', lambda: usa('carregar_voos', ast.With) and chama('carregar_voos', 'open'))
            check('Usa try/except', lambda: usa('carregar_voos', ast.Try))
            def correr():
                with tempfile.TemporaryDirectory() as pasta:
                    caminho = str(pathlib.Path(pasta) / 'voos_teste.csv')
                    pathlib.Path(caminho).write_text(conteudo, encoding='utf-8')
                    return chamar('carregar_voos', caminho)
            def validos_ok():
                validos, _ = correr()
                return [v['codigo'] for v in validos] == ['AA1', 'AA2', 'AA6']
            def normalizados_ok():
                validos, _ = correr()
                v = validos[1]
                return v['tipo'] == 'chegada' and v['destino'] == 'Paris' and validos[0]['passageiros'] == 120 and type(validos[0]['passageiros']) is int
            def rejeitados_ok():
                _, rejeitados = correr()
                return [r[0] for r in rejeitados] == [4, 5, 6, 7, 8] and all(isinstance(r[1], str) and r[1].strip() for r in rejeitados)
            check('Aceita as 3 linhas válidas, pela ordem', validos_ok)
            check('Normaliza tipo e espaços; passageiros como int', normalizados_ok)
            check('Rejeita as linhas 4 a 8 com o motivo', rejeitados_ok)
        elif lesson == 'objects':
            ordem = ['PROGRAMADO', 'CHECK-IN', 'EMBARQUE', 'PORTAS FECHADAS', 'DESCOLOU']
            def classes():
                Voo, Erro = ns.get('Voo'), ns.get('TransicaoInvalida')
                if not isinstance(Voo, type) or not isinstance(Erro, type):
                    raise ValueError('Define as classes Voo e TransicaoInvalida.')
                return Voo, Erro
            def sequencia():
                Voo, _ = classes()
                v = Voo('PX100')
                vistos = [v.estado]
                for _ in range(4):
                    v.avancar_estado()
                    vistos.append(v.estado)
                return vistos == ordem and v.codigo == 'PX100'
            def depois_de_descolar():
                Voo, Erro = classes()
                v = Voo('PX101')
                for _ in range(4):
                    v.avancar_estado()
                try:
                    v.avancar_estado()
                except Erro:
                    return v.estado == 'DESCOLOU'
                return False
            def cancelado():
                Voo, Erro = classes()
                v = Voo('PX102')
                v.avancar_estado()
                v.cancelar()
                try:
                    v.avancar_estado()
                except Erro:
                    return v.estado == 'CANCELADO'
                return False
            def protegido():
                Voo, _ = classes()
                v = Voo('PX103')
                try:
                    v.estado = 'DESCOLOU'
                except AttributeError:
                    return v.estado == 'PROGRAMADO'
                return False
            check('TransicaoInvalida é uma exceção', lambda: issubclass(classes()[1], Exception))
            check('Percorre os 5 estados por ordem', sequencia)
            check('Depois de descolar, avançar lança TransicaoInvalida', depois_de_descolar)
            check('Um voo cancelado não volta a avançar', cancelado)
            check('estado não pode ser alterado por fora (property)', protegido)
        elif lesson == 'tower':
            def ref(pedidos):
                pendentes = sorted(pedidos, key=lambda p: (p['hora'], p['codigo']))
                plano, t = [], 0
                while pendentes:
                    prontos = [p for p in pendentes if p['hora'] <= t]
                    if not prontos:
                        t = min(p['hora'] for p in pendentes)
                        continue
                    p = min(prontos, key=lambda p: (p['prioridade'], p['hora'], p['codigo']))
                    duracao = 6 if p['tipo'] == 'chegada' else 5
                    plano.append((p['codigo'], t, t + duracao))
                    t += duracao
                    pendentes.remove(p)
                return plano
            agenda = [dict(codigo='A1', tipo='chegada', hora=600, prioridade=5), dict(codigo='D1', tipo='partida', hora=600, prioridade=5),
                      dict(codigo='A2', tipo='chegada', hora=602, prioridade=1), dict(codigo='D2', tipo='partida', hora=640, prioridade=4),
                      dict(codigo='A3', tipo='chegada', hora=603, prioridade=3)]
            check('Agenda vazia', lambda: list(chamar('planear_pista', [])) == [])
            check('Um só voo começa à sua hora', lambda: [tuple(x) for x in chamar('planear_pista', agenda[:1])] == [('A1', 600, 606)])
            check('Prioridade, hora e código decidem a ordem', lambda: [tuple(x) for x in chamar('planear_pista', agenda)] == ref(agenda))
            check('Ordem da lista recebida não muda o plano', lambda: [tuple(x) for x in chamar('planear_pista', agenda[::-1])] == ref(agenda))
            def sem_sobreposicao():
                plano = [tuple(x) for x in chamar('planear_pista', agenda)]
                horas = {p['codigo']: p['hora'] for p in agenda}
                return all(b[1] >= a[2] for a, b in zip(plano, plano[1:])) and all(inicio >= horas[c] for c, inicio, _ in plano)
            check('Sem sobreposições nem operações antes da hora', sem_sobreposicao)
        elif lesson == 'baggage_claim':
            def t(codigo, estado):
                return dict(codigo=codigo, estado=estado, voo=None, motor=False, malas=0)
            mistos = [t('T01', 'ocupado'), t('T02', 'avariado'), t('T03', 'livre'), t('T04', 'livre')]
            check('escolher_tapete usa um ciclo for', lambda: usa('escolher_tapete', ast.For))
            check('Escolhe o primeiro tapete livre', lambda: chamar('escolher_tapete', mistos) == 'T03')
            check('Ignora tapetes ocupados e avariados', lambda: chamar('escolher_tapete', [t('T01', 'avariado'), t('T02', 'ocupado'), t('T05', 'livre')]) == 'T05')
            check('Respeita a ordem da lista', lambda: chamar('escolher_tapete', mistos[::-1]) == 'T04')
            check('Sem tapetes livres devolve None', lambda: chamar('escolher_tapete', [t('T01', 'ocupado'), t('T02', 'avariado')]) is None)
            check('Lista vazia devolve None', lambda: chamar('escolher_tapete', []) is None)
            check('O programa entrega as 120 malas do PY001', lambda: ns['contar_malas']('PY001', 'entregue') == 120)
        elif lesson == 'baggage_fault':
            import contextlib, io
            check('reagir usa if', lambda: usa('reagir', ast.If))
            check('O programa passa reagir a simular_bagagens', lambda: chama(None, 'simular_bagagens'))
            for n, cenario in enumerate(_AVARIAS_T03):
                cache = {}
                def correr_cenario(n=n, cache=cache):
                    if 'r' not in cache:
                        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                            cache['r'] = json.loads(_workspace_handle(source, '{"stands":[]}', 'bagagens', f'baggage_fault#{n}'))
                    r = cache['r']
                    if not r['ok']:
                        raise RuntimeError(r['error']['type'] + ': ' + r['error']['message'])
                    return r['baggage']
                def entregues(correr_cenario=correr_cenario):
                    reg = correr_cenario()
                    malas = {e['mala'] for e in reg['eventos'] if e['tipo'] == 'mala' and e['voo'] == 'PY001' and e['estado'] == 'entregue'}
                    return len(malas) == 120
                def rapido(correr_cenario=correr_cenario, avaria=cenario['avaria']):
                    reg = correr_cenario()
                    novo = [e for e in reg['eventos'] if e['tipo'] == 'tapete' and e.get('voo') == 'PY001' and e['estado'] == 'ocupado' and e['tapete'] != 'T03']
                    return bool(novo) and novo[0]['minuto'] - avaria <= 2
                hora = f"{cenario['avaria'] // 60:02d}:{cenario['avaria'] % 60:02d}"
                ocup = ', '.join(cenario['ocupados']) or 'nenhum'
                check(f'Avaria às {hora} (outros tapetes ocupados: {ocup}): 120 malas entregues', entregues)
                check(f'Avaria às {hora}: PY001 mudado de tapete até 2 minutos depois', rapido)
        elif lesson in ('sorting_tags', 'sorting_routes', 'sorting_fault'):
            import contextlib, io
            def manha(n, cache={}):
                # Volta a correr o programa do aluno numa central diferente (voos noutras saídas, outros troços parados)
                if n not in cache:
                    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                        cache[n] = json.loads(_workspace_handle(source, '{"stands":[]}', 'triagem', f'{lesson}#{n}'))
                r = cache[n]
                if not r['ok']:
                    raise RuntimeError(r['error']['type'] + ': ' + r['error']['message'])
                if not r['sorting']:
                    raise ValueError('O programa não chegou a simular a triagem.')
                return r['sorting']
            def bem_triadas(n):
                reg = manha(n)
                saida_do_voo = {p['voo']: p['saida'] for p in reg['partidas']}
                fim = {e['mala']: e for e in reg['eventos'] if e['tipo'] == 'mala' and e['estado'] != 'em_tapete'}
                for mala in reg['malas']:
                    esperado = saida_do_voo.get(mala['voo']) if mala['legivel'] else None
                    e = fim.get(mala['codigo'])
                    if e is None:
                        raise ValueError(f"A mala {mala['codigo']} não chegou a nenhuma saída.")
                    if esperado and (e['estado'] != 'triada' or e['saida'] != esperado):
                        onde = 'inspeção' if e['estado'] == 'inspecao' else e['saida']
                        raise ValueError(f"A mala {mala['codigo']} do voo {mala['voo']} devia sair em {esperado} e acabou em {onde}.")
                    if not esperado and e['estado'] != 'inspecao':
                        raise ValueError(f"A mala {mala['codigo']} não tem voo conhecido ou etiqueta legível e acabou em {e['saida']}.")
                return True
            if lesson == 'sorting_tags':
                tabela = [dict(voo='PX1', destino='Faro', hora=600, saida='S02', malas=10), dict(voo='PX2', destino='Roma', hora=615, saida='S04', malas=20), dict(voo='PX3', destino='Oslo', hora=620, saida='S02', malas=5)]
                check('criar_destinos usa um ciclo for', lambda: usa('criar_destinos', ast.For))
                check('criar_destinos devolve {voo: saida}', lambda: chamar('criar_destinos', tabela) == {'PX1': 'S02', 'PX2': 'S04', 'PX3': 'S02'})
                check('Lista vazia devolve um dicionário vazio', lambda: chamar('criar_destinos', []) == {})
                check('encaminhar usa if', lambda: usa('encaminhar', ast.If))
                check('O programa usa programar_leitor', lambda: chama(None, 'programar_leitor'))
                for n in range(3):
                    saidas = ', '.join(_MANHAS[n]['saidas'])
                    check(f'Manhã {n + 1} (voos em {saidas}): cada mala na saída certa e só as ilegíveis ou sem voo em inspeção', lambda n=n: bem_triadas(n))
            else:
                def curta(rede, origem, destino):
                    visto, fila = {origem: 0}, [origem]
                    for no in fila:
                        for v in rede.get(no, []):
                            if v not in visto:
                                visto[v] = visto[no] + 1
                                fila.append(v)
                    return visto.get(destino)
                def rota_minima(rede, origem, destino):
                    rota = chamar('encontrar_rota', rede, origem, destino)
                    if not isinstance(rota, (list, tuple)) or not rota or rota[0] != origem or rota[-1] != destino:
                        return False
                    return all(b in rede[a] for a, b in zip(rota, rota[1:])) and len(rota) - 1 == curta(rede, origem, destino)
                escada = {'E': ['A', 'X'], 'A': ['B', 'C'], 'B': ['D'], 'C': ['D', 'F'], 'D': ['S', 'E'], 'F': ['S'], 'X': [], 'S': []}
                anel = {'A': ['B'], 'B': ['C', 'A'], 'C': ['A', 'D'], 'D': ['B'], 'Z': ['A']}
                atalho = {'P': ['Q', 'L1'], 'Q': ['T'], 'L1': ['L2'], 'L2': ['T'], 'T': ['P']}
                desvio = {'P': ['L1', 'Q'], 'Q': ['T'], 'L1': ['L2'], 'L2': ['T'], 'T': ['P']}
                if lesson == 'sorting_routes':
                    check('encontrar_rota usa um ciclo while', lambda: usa('encontrar_rota', ast.While))
                    check('Dois nós ligados diretamente', lambda: list(chamar('encontrar_rota', escada, 'E', 'A')) == ['E', 'A'])
                    check('Caminho com menos troços entre vários possíveis', lambda: rota_minima(escada, 'E', 'S') and rota_minima(escada, 'A', 'F') and rota_minima(atalho, 'P', 'T') and rota_minima(desvio, 'P', 'T'))
                    check('Rede com ciclos: não visita o mesmo nó duas vezes', lambda: rota_minima(anel, 'A', 'D') and rota_minima(anel, 'D', 'C'))
                    check('Origem igual ao destino devolve [origem]', lambda: list(chamar('encontrar_rota', escada, 'B', 'B')) == ['B'])
                    check('Sem caminho devolve None', lambda: chamar('encontrar_rota', escada, 'S', 'E') is None and chamar('encontrar_rota', anel, 'A', 'Z') is None)
                    check('O programa usa definir_rota', lambda: chama(None, 'definir_rota'))
                    for n in range(3):
                        fora = _MANHAS[n]['fora']
                        texto = 'todos os troços a funcionar' if not n or not fora else f'troço de {fora[0]} para {fora[1]} fora de serviço'
                        check(f'Manhã {n + 1} ({texto}): cada mala na saída do seu voo', lambda n=n: bem_triadas(n))
                else:
                    check('reagir usa um ciclo for', lambda: usa('reagir', ast.For))
                    check('O programa passa reagir a simular_triagem', lambda: chama(None, 'simular_triagem') and defn('reagir') is not None)
                    def rotas_corrigidas(n):
                        reg = manha(n)
                        for avaria in [e for e in reg['eventos'] if e['tipo'] == 'troco' and e['estado'] == 'avariado']:
                            rotas = dict(reg['rotas_iniciais'])
                            for e in reg['eventos']:
                                if e['tipo'] == 'rota' and e['minuto'] <= avaria['minuto'] + 1:
                                    rotas[e['saida']] = e['rota']
                            for saida, rota in rotas.items():
                                if avaria['troco'] in [a + '>' + b for a, b in zip(rota, rota[1:])]:
                                    de, para = avaria['troco'].split('>')
                                    raise ValueError(f"Um minuto depois da avaria no troço de {de} para {para}, a rota para {saida} ainda passa por lá.")
                        return True
                    for n in range(3):
                        texto = ' e '.join(f'{a[0]}–{a[1]} às {a[2] // 60:02d}:{a[2] % 60:02d}' for a in _MANHAS[n]['avarias'])
                        check(f'Manhã {n + 1} (avaria {texto}): cada mala na saída do seu voo', lambda n=n: bem_triadas(n))
                        check(f'Manhã {n + 1}: rotas fora do troço avariado até 1 minuto depois', lambda n=n: rotas_corrigidas(n))
    else:
        raise ValueError('Nível de aprendizagem desconhecido.')
    passed=sum(t['passed'] for t in tests)
    return dict(passed=bool(tests) and passed==len(tests), score=round(100*passed/len(tests)) if tests else 0, tests=tests)
