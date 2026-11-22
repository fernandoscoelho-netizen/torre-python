import copy, math, tempfile, pathlib

_NOVOS_NIVEIS = {'panel', 'priority', 'holding', 'sets', 'metar', 'fees', 'stdlib', 'data', 'objects', 'tower', 'baggage_claim', 'baggage_fault', 'sorting_tags', 'sorting_routes', 'sorting_fault', 'checkin_validate', 'checkin_queue', 'checkin_tags', 'loading_plan', 'loading_balance', 'loading_reconcile', 'boarding_security', 'boarding_gate', 'boarding_files'}

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
        elif lesson in ('checkin_validate', 'checkin_queue', 'checkin_tags'):
            import contextlib, io
            def manha(n, cache={}):
                # Volta a correr o programa do aluno noutra manhã (outros passageiros, outro balcão fechado, voos noutras saídas)
                if n not in cache:
                    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                        cache[n] = json.loads(_workspace_handle(source, '{"stands":[]}', 'checkin', f'{lesson}#{n}'))
                r = cache[n]
                if not r['ok']:
                    raise RuntimeError(r['error']['type'] + ': ' + r['error']['message'])
                if not r['checkin']:
                    raise ValueError('O programa não chegou a simular o check-in.')
                return r
            def eventos(n, tipo):
                return [e for e in manha(n)['checkin']['eventos'] if e['tipo'] == tipo]
            def nomes(n):
                return {p['reserva']: p for p in manha(n)['checkin']['passageiros']}
            def todos_atendidos(n):
                reg = manha(n)['checkin']
                falta = reg['resumo']['passageiros']
                por_atender = falta['a_chegar'] + falta['na_fila'] + falta['no_balcao']
                if por_atender:
                    raise ValueError(f'{por_atender} passageiros não chegaram a ser atendidos.')
                return True
            if lesson == 'checkin_validate':
                def passageiro(**mudar):
                    return {**dict(reserva='AB12CD', nome='Teste', voo='PY101', documento='CC', malas=[12.5], chegada=500), **mudar}
                def diz(esperado, minuto=500, **mudar):
                    return chamar('validar', passageiro(**mudar), minuto) == esperado
                check('validar usa if', lambda: usa('validar', ast.If))
                check('O programa usa programar_validacao', lambda: chama(None, 'programar_validacao'))
                check('Passageiro em ordem: "OK" (com uma mala, com duas e sem malas)', lambda: diz('OK') and diz('OK', malas=[8.0, 21.3]) and diz('OK', malas=[]) and diz('OK', documento='passaporte', reserva='9Z8Y7X'))
                check('Reserva com 5 ou com 7 caracteres: "reserva inválida"', lambda: diz('reserva inválida', reserva='AB12C') and diz('reserva inválida', reserva='AB12CDE') and diz('reserva inválida', reserva=''))
                check('Reserva com minúsculas ou com símbolos: "reserva inválida"', lambda: diz('reserva inválida', reserva='ab12cd') and diz('reserva inválida', reserva='AB1-CD') and diz('reserva inválida', reserva='AB 2CD'))
                check('Documento None ou vazio: "sem documento"', lambda: diz('sem documento', documento=None) and diz('sem documento', documento=''))
                check('Voo que não está nas partidas: "voo desconhecido"', lambda: diz('voo desconhecido', voo='PY999') and diz('voo desconhecido', voo='PY900', minuto=700))
                check('Fecho 40 minutos antes da partida: aceita às 09:19 e recusa às 09:20 (PY101, 10:00)', lambda: diz('OK', minuto=559) and diz('check-in fechado', minuto=560) and diz('check-in fechado', minuto=575))
                check('O fecho depende do voo: PY104 (10:30) aceita às 09:49 e recusa às 09:50', lambda: diz('OK', voo='PY104', minuto=589) and diz('check-in fechado', voo='PY104', minuto=590))
                check('Mala com 32 kg é aceite; com mais de 32, com 0 ou negativa: "peso inválido"', lambda: diz('OK', malas=[32]) and diz('peso inválido', malas=[32.1]) and diz('peso inválido', malas=[0]) and diz('peso inválido', malas=[-3.0]))
                check('Basta uma mala inválida, mesmo que seja a segunda', lambda: diz('peso inválido', malas=[10.0, 40.0]))
                check('Com dois problemas, devolve o primeiro pela ordem do enunciado', lambda: diz('reserva inválida', reserva='x', documento=None) and diz('sem documento', documento=None, voo='PY999') and diz('check-in fechado', minuto=600, malas=[50]))
                def decisoes_certas(n):
                    todos_atendidos(n)
                    quem = nomes(n)
                    for e in eventos(n, 'decisao'):
                        if not e['certo']:
                            p = quem[e['reserva']]
                            devia = e['problemas'][0] if e['problemas'] else 'OK'
                            raise ValueError(f"{p['nome']} (reserva {p['reserva']}, voo {p['voo']}) recebeu \"{e['motivo'] or 'OK'}\" e devia receber \"{devia}\".")
                    return True
                for n in range(3):
                    check(f'Manhã {n + 1}: todos os passageiros recebem a decisão certa', lambda n=n: decisoes_certas(n))
            elif lesson == 'checkin_queue':
                def reserva_de(resposta):
                    return resposta.get('reserva') if isinstance(resposta, dict) else resposta
                def pessoa(reserva, voo, chegada=480):
                    return dict(reserva=reserva, nome='Teste ' + reserva, voo=voo, documento='CC', malas=[], chegada=chegada)
                def sequencia(entradas, minuto, esperado):
                    # Fila vazia no fim da manhã: entram os passageiros de teste e são chamados um a um
                    if ns['chamar']('B01', minuto) is not None:
                        raise ValueError('Depois da simulação a fila devia estar vazia e chamar devolveu um passageiro.')
                    for p in entradas:
                        ns['entrar'](dict(p))
                    saida = [reserva_de(ns['chamar']('B01', minuto)) for _ in entradas]
                    return saida == esperado and ns['chamar']('B02', minuto) is None
                a, b, c = pessoa('T1', 'PY104'), pessoa('T2', 'PY104'), pessoa('T3', 'PY103')
                u = pessoa('T4', 'PY101')
                x = pessoa('T5', 'PY900')
                check('O programa define entrar e chamar e usa programar_fila', lambda: defn('entrar') is not None and defn('chamar') is not None and chama(None, 'programar_fila'))
                check('Fila vazia: chamar devolve None', lambda: sequencia([], 480, []))
                check('Sem urgentes, a ordem é a de chegada (FIFO)', lambda: sequencia([a, b, c], 480, ['T1', 'T2', 'T3']))
                check('Um urgente (faltam 10 minutos para o fecho do PY101) passa à frente', lambda: sequencia([a, u, b], 550, ['T4', 'T1', 'T2']))
                check('Faltam 16 minutos: ainda não é urgente; faltam 15: já é', lambda: sequencia([a, u], 544, ['T1', 'T4']) and sequencia([a, u], 545, ['T4', 'T1']))
                check('Entre urgentes, primeiro o que está há mais tempo na fila', lambda: sequencia([a, pessoa('T6', 'PY102'), u], 558, ['T6', 'T4', 'T1']))
                check('Voo desconhecido não dá erro e nunca é urgente', lambda: sequencia([x, a], 700, ['T1', 'T5']) and sequencia([x], 480, ['T5']))
                def fila_certa(n):
                    reg = manha(n)['checkin']
                    quem = nomes(n)
                    for e in eventos(n, 'decisao'):
                        if e['perdeu']:
                            p = quem[e['reserva']]
                            raise ValueError(f"{p['nome']} chegou às {p['chegada'] // 60:02d}:{p['chegada'] % 60:02d}, antes do fecho do voo {p['voo']}, e só foi chamado às {e['minuto'] // 60:02d}:{e['minuto'] % 60:02d}.")
                    todos_atendidos(n)
                    for e in eventos(n, 'chamada'):
                        p = quem[e['reserva']]
                        hora = f"{e['minuto'] // 60:02d}:{e['minuto'] % 60:02d}"
                        if e['urgentes'] and not e['urgente']:
                            raise ValueError(f"Às {hora} havia {e['urgentes']} passageiros urgentes na fila e foi chamado {p['nome']} (voo {p['voo']}), que não era urgente.")
                        if not e['urgentes'] and e['posicao']:
                            raise ValueError(f"Às {hora} não havia urgentes e foi chamado {p['nome']}, que tinha {e['posicao']} passageiros à frente.")
                        if not e['primeiro_do_voo']:
                            raise ValueError(f"Às {hora} foi chamado {p['nome']} antes de outro passageiro do voo {p['voo']} que chegou primeiro.")
                    return True
                for n in range(3):
                    check(f'Manhã {n + 1} (balcão {_BALCAO_FECHADO[n]} fechado): ninguém perde o voo na fila e a ordem é respeitada', lambda n=n: fila_certa(n))
            else:
                def etiquetas(voo, pesos):
                    return [chamar('criar_etiqueta', voo, peso) for peso in pesos]
                check('criar_etiqueta usa if', lambda: usa('criar_etiqueta', ast.If))
                check('O programa usa programar_etiquetas, simular_checkin e simular_triagem', lambda: chama(None, 'programar_etiquetas') and chama(None, 'simular_checkin') and chama(None, 'simular_triagem'))
                check('Numeração seguida dentro do voo: QX1-001, QX1-002, QX1-003', lambda: etiquetas('QX1', [10, 12.5, 8]) == ['QX1-001', 'QX1-002', 'QX1-003'])
                check('Cada voo tem a sua numeração', lambda: etiquetas('QX2', [10, 10]) == ['QX2-001', 'QX2-002'] and etiquetas('QX3', [10]) == ['QX3-001'] and etiquetas('QX2', [10]) == ['QX2-003'])
                check('Três algarismos: a décima mala é a 010', lambda: etiquetas('QX4', [10] * 10)[-1] == 'QX4-010')
                check('H só nas malas com mais de 23 kg (23 kg ainda não leva)', lambda: etiquetas('QX5', [23.1, 23, 31.9, 7]) == ['QX5-001H', 'QX5-002', 'QX5-003H', 'QX5-004'])
                def etiquetas_certas(n):
                    todos_atendidos(n)
                    malas = eventos(n, 'mala')
                    if not malas:
                        raise ValueError('Nenhuma mala foi etiquetada.')
                    for e in malas:
                        if not e['certa']:
                            raise ValueError(f"A mala de {e['peso']} kg despachada no balcão {e['balcao']} ficou com a etiqueta {e['etiqueta']!r}. Vê as ocorrências.")
                    return True
                def na_saida_certa(n):
                    r = manha(n)
                    reg = r['sorting']
                    if not reg or reg.get('origem') != 'checkin':
                        raise ValueError('O programa tem de correr simular_checkin() e, a seguir, simular_triagem().')
                    saida_do_voo = {p['voo']: p['saida'] for p in reg['partidas']}
                    fim = {e['mala']: e for e in reg['eventos'] if e['tipo'] == 'mala' and e['estado'] != 'em_tapete'}
                    if len(reg['malas']) != r['checkin']['resumo']['malas']:
                        raise ValueError('Nem todas as malas do check-in entraram na central de triagem.')
                    for mala in reg['malas']:
                        e = fim.get(mala['codigo'])
                        if e is None:
                            raise ValueError(f"A mala {mala['codigo']} não chegou a nenhuma saída.")
                        if e['estado'] != 'triada' or e['saida'] != saida_do_voo.get(mala['voo']):
                            onde = 'inspeção' if e['estado'] == 'inspecao' else e['saida']
                            raise ValueError(f"A mala {mala['codigo']} do voo {mala['voo']} devia sair em {saida_do_voo.get(mala['voo'])} e acabou em {onde}.")
                    return True
                for n in range(3):
                    check(f'Manhã {n + 1}: todas as etiquetas certas e sem repetições', lambda n=n: etiquetas_certas(n))
                    check(f'Manhã {n + 1}: na triagem, cada mala chega à saída do seu voo', lambda n=n: na_saida_certa(n))
        elif lesson in ('loading_plan', 'loading_balance', 'loading_reconcile'):
            import contextlib, io
            POROES = ('DIANTEIRO', 'TRASEIRO', 'GRANEL')
            def manha(n, cache={}):
                # Volta a correr o programa do aluno noutra manhã (outras malas, outros aviões, voos noutros lugares)
                if n not in cache:
                    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                        cache[n] = json.loads(_workspace_handle(source, '{"stands":[]}', 'loading', f'{lesson}#{n}'))
                r = cache[n]
                if not r['ok']:
                    raise RuntimeError(r['error']['type'] + ': ' + r['error']['message'])
                if not r['loading']:
                    raise ValueError('O programa não chegou a simular o carregamento.')
                return r
            def eventos(n, tipo):
                return [e for e in manha(n)['loading']['eventos'] if e['tipo'] == tipo]
            def hora(m):
                return f'{m // 60:02d}:{m % 60:02d}'
            def a_horas(n):
                reg = manha(n)['loading']
                partidas = {e['voo']: e for e in eventos(n, 'partida')}
                for v in reg['voos']:
                    if v['voo'] not in partidas:
                        raise ValueError(f"O voo {v['voo']} não chegou a partir.")
                    if partidas[v['voo']]['atraso'] > 0:
                        raise ValueError(f"O voo {v['voo']} partiu com {partidas[v['voo']]['atraso']} minutos de atraso. Vê as ocorrências.")
                return True
            def tudo_a_bordo(n):
                reg = manha(n)['loading']
                em_terra = reg['resumo']['malas']['em_terra']
                if em_terra:
                    raise ValueError(f"{em_terra} malas ficaram em terra. Vê as ocorrências.")
                if not reg['resumo']['malas']['carregada']:
                    raise ValueError('Não foi carregada nenhuma mala.')
                return True
            def aviao_teste(livres, bracos=(10.0, 24.0, 28.0), massas=((10000, 17.2),), limites=(10.0, 30.0)):
                return {'voo': 'QX1', 'destino': 'Teste', 'hora': 600, 'lugar': 'P21', 'tipo': 'avião de teste',
                        'poroes': {p: {'livre': l, 'braco': b} for p, l, b in zip(POROES, livres, bracos)},
                        'massas': [{'nome': f'massa {i + 1}', 'peso': p, 'braco': b} for i, (p, b) in enumerate(massas)],
                        'limite_frente': limites[0], 'limite_tras': limites[1]}
            def malas_teste(pesos):
                return [{'etiqueta': f'QX1-{i + 1:03d}' + ('H' if p > 23 else ''), 'voo': 'QX1', 'peso': p, 'reserva': f'R{i + 1:05d}'} for i, p in enumerate(pesos)]
            def plano_valido(pesos_malas, livres, **extra):
                # Chama distribuir e confere o plano: {porão: [etiquetas]}, cada mala uma vez, nenhum porão acima do livre
                malas, aviao = malas_teste(pesos_malas), aviao_teste(livres, **extra)
                plano = chamar('distribuir', malas, aviao)
                if not isinstance(plano, dict):
                    raise ValueError('distribuir tem de devolver um dicionário {porão: [etiquetas]}.')
                peso = {m['etiqueta']: m['peso'] for m in malas}
                vistas, limpo = set(), {p: [] for p in POROES}
                for porao, lista in plano.items():
                    if porao not in POROES:
                        raise ValueError(f'Porão desconhecido no plano: {porao!r}.')
                    for item in lista:
                        etiqueta = item.get('etiqueta') if isinstance(item, dict) else item
                        if etiqueta not in peso:
                            raise ValueError(f'{item!r} não é uma das malas recebidas.')
                        if etiqueta in vistas:
                            raise ValueError(f'A mala {etiqueta} aparece duas vezes no plano.')
                        vistas.add(etiqueta)
                        limpo[porao].append(etiqueta)
                if len(vistas) != len(malas):
                    raise ValueError(f'Com malas de {list(pesos_malas)} kg e porões com {list(livres)} kg livres, {len(malas) - len(vistas)} malas ficaram fora do plano.')
                somas = {p: sum(peso[e] for e in limpo[p]) for p in POROES}
                for porao, livre in zip(POROES, livres):
                    if somas[porao] > livre + 1e-6:
                        raise ValueError(f'O porão {porao} ficou com {somas[porao]:g} kg e só tem {livre} kg livres.')
                return limpo, peso, somas, aviao
            def cg_de(aviao, somas):
                momento = sum(m['peso'] * m['braco'] for m in aviao['massas']) + sum(somas[p] * aviao['poroes'][p]['braco'] for p in POROES)
                return momento / (sum(m['peso'] for m in aviao['massas']) + sum(somas.values()))
            if lesson == 'loading_plan':
                def pesadas_primeiro():
                    plano, peso, _, _ = plano_valido([12, 9, 15, 7, 20, 11, 25, 8], (60, 60, 30))
                    for porao in POROES:
                        lista = [peso[e] for e in plano[porao]]
                        if lista != sorted(lista, reverse=True):
                            raise ValueError(f'No porão {porao} a ordem de carga ficou {lista} kg: as mais pesadas têm de vir primeiro.')
                    return True
                check('O programa ordena as malas (sorted ou sort)', lambda: chama(None, 'sorted') or chama(None, 'sort'))
                check('O programa usa programar_plano e simular_carregamento', lambda: chama(None, 'programar_plano') and chama(None, 'simular_carregamento'))
                check('Todas as malas entram no plano, uma só vez', lambda: plano_valido([12, 9, 15, 7, 20, 11], (40, 40, 20)) and plano_valido([14.5], (20, 20, 20)) and plano_valido([], (20, 20, 20)))
                check('Nenhum porão passa dos quilos livres (oito malas de 10 kg em porões de 30 kg)', lambda: plano_valido([10] * 8, (30, 30, 30)))
                check('Um porão sem espaço fica vazio; malas de 20, 20, 30 e 30 kg cabem em dois porões de 50 kg começando pelas mais pesadas', lambda: plano_valido([20, 20, 30, 30], (50, 50, 0)))
                check('Em cada porão, as mais pesadas primeiro', pesadas_primeiro)
                def carga_certa(n):
                    tudo_a_bordo(n)
                    for e in eventos(n, 'plano'):
                        if not e['ordenado']:
                            raise ValueError(f"No plano do voo {e['voo']} há malas leves carregadas antes de malas mais pesadas do mesmo porão.")
                    return a_horas(n)
                for n in range(3):
                    check(f'Manhã {n + 1}: todas as malas embarcam, das mais pesadas para as mais leves, e os voos partem à hora', lambda n=n: carga_certa(n))
            elif lesson == 'loading_balance':
                def cg(esperado, pesos, **extra):
                    return abs(chamar('centragem', aviao_teste((1000, 1000, 1000), **extra), pesos) - esperado) < 1e-6
                def plano_equilibrado(braco_vazio):
                    _, _, somas, aviao = plano_valido([28, 26, 24, 22, 20, 20, 18, 16, 14, 12], (200, 200, 100), massas=((10000, braco_vazio),), limites=(17.0, 17.3))
                    valor = cg_de(aviao, somas)
                    if not 17.0 <= valor <= 17.3:
                        raise ValueError(f'Avião de teste com limites 17.00 a 17.30 m: o plano devolvido dá um centro de gravidade de {valor:.2f} m '
                                         f'(malas por porão: {somas}).')
                    return True
                check('centragem usa um ciclo for', lambda: usa('centragem', ast.For))
                check('O programa usa programar_plano e simular_carregamento', lambda: chama(None, 'programar_plano') and chama(None, 'simular_carregamento'))
                check('Sem malas: duas massas de 1000 kg, a 10 m e a 20 m, dão 15 m', lambda: cg(15.0, {}, massas=((1000, 10), (1000, 20))) and cg(15.0, {'DIANTEIRO': 0, 'TRASEIRO': 0, 'GRANEL': 0}, massas=((1000, 10), (1000, 20))))
                check('Com 500 kg de malas num porão a 5 m do nariz, o centro de gravidade passa para 13 m', lambda: cg(13.0, {'DIANTEIRO': 500}, bracos=(5.0, 24.0, 28.0), massas=((1000, 10), (1000, 20))))
                check('As malas de todos os porões contam, cada uma com o braço do seu porão', lambda: cg(16.92, {'DIANTEIRO': 300, 'TRASEIRO': 500, 'GRANEL': 200}, massas=((4000, 16),)))
                check('Avião pesado de cauda: o plano que enche pela frente fica dentro dos limites', lambda: plano_equilibrado(17.395))
                check('Avião pesado de nariz: o plano que enche por trás fica dentro dos limites', lambda: plano_equilibrado(16.871))
                def centragem_certa(n):
                    tudo_a_bordo(n)
                    limites = {v['voo']: v['aviao'] for v in manha(n)['loading']['voos']}
                    for e in eventos(n, 'fim_carga'):
                        if not e['dentro']:
                            a = limites[e['voo']]
                            raise ValueError(f"Voo {e['voo']}: o carregamento acabou com o centro de gravidade a {e['cg']:.2f} m "
                                             f"(limites {a['limite_frente']:.2f} a {a['limite_tras']:.2f} m).")
                    return a_horas(n)
                for n in range(3):
                    check(f'Manhã {n + 1}: os quatro voos carregam todas as malas com a centragem dentro dos limites e partem à hora', lambda n=n: centragem_certa(n))
            else:
                def mala(numero, reserva, porao='DIANTEIRO'):
                    return {'etiqueta': f'QX1-{numero:03d}', 'voo': 'QX1', 'peso': 10.0 + numero, 'reserva': reserva, 'porao': porao}
                carga = [mala(1, 'AAA111'), mala(2, 'BBB222', 'TRASEIRO'), mala(3, 'CCC333'), mala(4, 'BBB222', 'GRANEL'), mala(5, 'DDD444', 'TRASEIRO')]
                def retira(embarcados, esperado, malas=carga):
                    r = chamar('malas_a_retirar', malas, embarcados)
                    if not isinstance(r, (set, frozenset)):
                        raise ValueError(f'malas_a_retirar tem de devolver um conjunto (set) e devolveu {type(r).__name__}.')
                    return r == set(esperado)
                d = defn('malas_a_retirar')
                check('malas_a_retirar usa conjuntos', lambda: d is not None and any(isinstance(n, (ast.Set, ast.SetComp)) or (isinstance(n, ast.Call) and getattr(n.func, 'id', None) in ('set', 'frozenset')) for n in ast.walk(d)))
                check('O programa usa programar_reconciliacao, simular_checkin, simular_triagem e simular_carregamento', lambda: all(chama(None, f) for f in ('programar_reconciliacao', 'simular_checkin', 'simular_triagem', 'simular_carregamento')))
                check('Faltou um passageiro com uma mala: sai essa mala', lambda: retira(['AAA111', 'BBB222', 'DDD444'], {'QX1-003'}))
                check('Faltou um passageiro com duas malas: saem as duas', lambda: retira(['AAA111', 'CCC333', 'DDD444'], {'QX1-002', 'QX1-004'}))
                check('Cartões lidos duas vezes e passageiros sem mala não confundem', lambda: retira(['DDD444', 'ZZZ999', 'AAA111', 'DDD444', 'CCC333', 'YYY888', 'AAA111'], {'QX1-002', 'QX1-004'}))
                check('Todos embarcaram: conjunto vazio', lambda: retira(['AAA111', 'BBB222', 'CCC333', 'DDD444'], set()) and retira(['AAA111'], set(), malas=[]))
                check('Ninguém embarcou: saem todas as malas', lambda: retira([], {'QX1-001', 'QX1-002', 'QX1-003', 'QX1-004', 'QX1-005'}))
                def reconciliado(n):
                    reg = manha(n)['loading']
                    if reg.get('origem') != 'triagem':
                        raise ValueError('O programa tem de correr simular_checkin(), simular_triagem() e, só depois, simular_carregamento().')
                    if not eventos(n, 'carga'):
                        raise ValueError('Não foi carregada nenhuma mala.')
                    dono = {m['etiqueta']: m for m in reg['malas']}
                    for e in eventos(n, 'descarga'):
                        m = dono[e['mala']]
                        if e['manual']:
                            raise ValueError(f"Voo {e['voo']}: a mala {e['mala']} de {m['nome']} (reserva {m['reserva']}) ficou a bordo e o dono não embarcou.")
                        if not e['certa']:
                            raise ValueError(f"Voo {e['voo']}: a mala {e['mala']} de {m['nome']} (reserva {m['reserva']}) foi retirada e o dono embarcou.")
                    return a_horas(n)
                for n in range(3):
                    check(f'Manhã {n + 1}, do check-in ao porão: só saem as malas de quem não embarcou e os voos partem à hora', lambda n=n: reconciliado(n))
        elif lesson in ('boarding_security', 'boarding_gate', 'boarding_files'):
            import contextlib, io, os
            def manha(n, cache={}):
                # Volta a correr o programa do aluno noutra manhã (outros passageiros, outra linha fechada, voos noutras portas)
                if n not in cache:
                    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                        cache[n] = json.loads(_workspace_handle(source, '{"stands":[]}', 'boarding', f'{lesson}#{n}'))
                    caminho = _pasta_dados() + '/faltas.json'
                    cache[n]['_faltas'] = open(caminho, encoding='utf-8').read() if os.path.exists(caminho) else None
                r = cache[n]
                if not r['ok']:
                    raise RuntimeError(r['error']['type'] + ': ' + r['error']['message'])
                if not r['boarding']:
                    raise ValueError('O programa não chegou a simular o embarque.')
                return r
            def eventos(n, tipo, zona='boarding'):
                return [e for e in manha(n)[zona]['eventos'] if e['tipo'] == tipo]
            def classe(nome, base=None):
                alvo = ns.get(nome)
                if not isinstance(alvo, type):
                    raise ValueError(f'Define a classe {nome} no teu programa.')
                if base is not None and not issubclass(alvo, base):
                    raise ValueError(f'{nome} tem de herdar de {base.__name__}: class {nome}({base.__name__}).')
                return alvo
            def pessoa(i):
                return {'reserva': f'R{i:05d}', 'nome': f'Passageiro {i}', 'voo': 'QX1', 'hora': 600, 'chegada': 500 + i}
            if lesson == 'boarding_security':
                def linha(codigo='L9', tempo=2, pessoas=0, inicio=1):
                    l = classe('Linha')(codigo, tempo)
                    for i in range(pessoas):
                        l.entrar(pessoa(inicio + i))
                    return l
                def atributos():
                    l = linha('L7', 3)
                    if not hasattr(l, 'fila'):
                        raise ValueError('O objeto não tem o atributo fila. Cria-o em __init__ com self.fila = [].')
                    return l.codigo == 'L7' and l.tempo == 3 and list(l.fila) == [] and len(l) == 0
                def separadas():
                    a, b = linha('L1', 1), linha('L2', 2)
                    a.entrar(pessoa(1))
                    if len(b) != 0 or a.fila is b.fila:
                        raise ValueError('Um passageiro entrou na linha L1 e apareceu também na L2: as duas linhas partilham a mesma lista. Cria a fila em __init__ com self.fila = [].')
                    return len(a) == 1
                def ordem():
                    l = linha(pessoas=3)
                    saidas = [l.atender() for _ in range(3)]
                    if [p and p.get('reserva') for p in saidas] != ['R00001', 'R00002', 'R00003']:
                        raise ValueError('Entraram três passageiros (R00001, R00002 e R00003) e atender() não os devolveu por essa ordem.')
                    return len(l) == 0
                def vazia():
                    l = linha()
                    return l.atender() is None and len(l) == 0 and l.atender() is None
                def espera():
                    return linha(tempo=3).espera() == 3 and linha(tempo=3, pessoas=2).espera() == 9 and linha(tempo=1, pessoas=5).espera() == 6
                def escolhe(filas, certa):
                    linhas = [linha(f'L{i + 1}', tempo, pessoas, 10 * i + 1) for i, (tempo, pessoas) in enumerate(filas)]
                    r = fn('escolher')(linhas, pessoa(99))
                    if not any(r is l for l in linhas):
                        raise ValueError(f'escolher tem de devolver um dos objetos da lista e devolveu {r!r}.')
                    if r is not linhas[certa]:
                        descricao = ', '.join(f'{l.codigo}: {pessoas} na fila a {tempo} min' for l, (tempo, pessoas) in zip(linhas, filas))
                        raise ValueError(f'Com {descricao}, a linha certa é a {linhas[certa].codigo} e escolher devolveu a {getattr(r, "codigo", r)}.')
                    return True
                def sem_atrasos(n):
                    resumo = manha(n)['boarding']['resumo']
                    paradas = [e['texto'] for e in eventos(n, 'ocorrencia') if e['texto'].startswith('Linha')]
                    if paradas:
                        raise ValueError(paradas[0])
                    if resumo['atrasados']:
                        raise ValueError(f"{resumo['atrasados']} passageiros perderam o voo por causa da segurança (espera máxima de {resumo['espera_maxima']} minutos). Vê as ocorrências.")
                    if not all(v['contada'] for v in resumo['voos'].values()):
                        raise ValueError('A simulação não chegou ao fim: usa simular_embarque() sem argumentos.')
                    return True
                d = defn('Linha')
                check('Linha é uma classe com __init__, entrar, atender, espera e __len__', lambda: isinstance(d, ast.ClassDef) and {'__init__', 'entrar', 'atender', 'espera', '__len__'} <= {n.name for n in d.body if isinstance(n, ast.FunctionDef)})
                check('O programa usa programar_seguranca e simular_embarque', lambda: chama(None, 'programar_seguranca') and chama(None, 'simular_embarque'))
                check('Linha("L7", 3) guarda o código e o tempo e começa com a fila vazia', atributos)
                check('Cada linha tem a sua fila', separadas)
                check('atender() devolve os passageiros pela ordem em que entraram', ordem)
                check('atender() numa fila vazia devolve None', vazia)
                check('espera() é (pessoas na fila + 1) × tempo', espera)
                check('escolher devolve a linha com a menor espera', lambda: escolhe([(2, 3), (1, 2), (3, 1)], 1))
                check('A fila mais curta não é a mais rápida: 4 pessoas a 1 min ganham a 2 pessoas a 3 min', lambda: escolhe([(3, 2), (2, 3), (1, 4)], 2))
                for n in range(3):
                    check(f'Manhã {n + 1}: ninguém perde o voo por causa da segurança', lambda n=n: sem_atrasos(n))
            elif lesson == 'boarding_gate':
                def classes():
                    base = classe('ErroEmbarque', Exception)
                    return classe('Porta'), base, classe('VooErrado', base), classe('PortaFechada', base), classe('CartaoRepetido', base)
                def cartao(i, voo='QX1'):
                    return {'reserva': f'R{i:05d}', 'nome': f'Passageiro {i}', 'voo': voo, 'lugar': f'{i}A'}
                def levanta(erro, acao):
                    try:
                        acao()
                    except erro:
                        return True
                    except Exception as outro:
                        raise ValueError(f'Devia levantar {erro.__name__} e levantou {type(outro).__name__}.')
                    raise ValueError(f'Devia levantar {erro.__name__} e não levantou nenhuma exceção.')
                def hierarquia():
                    _, base, *filhas = classes()
                    if base is Exception or any(f is base for f in filhas) or len(set(filhas)) != 3:
                        raise ValueError('São precisas quatro classes diferentes: ErroEmbarque e as três filhas.')
                    return True
                def valido():
                    Porta = classes()[0]
                    p = Porta('G9', 'QX1', 585)
                    if not isinstance(p.embarcados, set) or p.embarcados:
                        raise ValueError('embarcados tem de começar como um conjunto vazio: self.embarcados = set().')
                    p.ler(cartao(1), 560)
                    p.ler(cartao(2), 584)
                    return p.embarcados == {'R00001', 'R00002'} and p.codigo == 'G9' and p.voo == 'QX1' and p.fecho == 585
                def recusa(qual):
                    Porta, base, VooErrado, PortaFechada, CartaoRepetido = classes()
                    p = Porta('G9', 'QX1', 585)
                    p.ler(cartao(1), 560)
                    if qual == 'voo':
                        levanta(VooErrado, lambda: p.ler(cartao(2, 'QX2'), 561))
                    elif qual == 'fecho':
                        levanta(PortaFechada, lambda: p.ler(cartao(2), 585))
                        levanta(PortaFechada, lambda: p.ler(cartao(3), 590))
                    else:
                        levanta(CartaoRepetido, lambda: p.ler(cartao(1), 562))
                    if p.embarcados != {'R00001'}:
                        raise ValueError(f'Um cartão recusado não pode entrar em embarcados (ficou {sorted(p.embarcados)}).')
                    return True
                def faltas():
                    Porta = classes()[0]
                    p, q = Porta('G9', 'QX1', 585), Porta('G8', 'QX2', 595)
                    p.ler(cartao(1), 560)
                    p.ler(cartao(3), 560)
                    r = p.faltas(['R00001', 'R00002', 'R00003', 'R00004'])
                    if not isinstance(r, (set, frozenset)):
                        raise ValueError(f'faltas tem de devolver um conjunto (set) e devolveu {type(r).__name__}.')
                    if q.embarcados:
                        raise ValueError('Duas portas partilham o mesmo conjunto de embarcados. Cria-o em __init__ com self.embarcados = set().')
                    return r == {'R00002', 'R00004'} and p.faltas(['R00001']) == set() and q.faltas(['R00001']) == {'R00001'}
                def leituras_certas(n):
                    nomes = {p['reserva']: p['nome'] for p in manha(n)['boarding']['passageiros']}
                    for e in eventos(n, 'leitura'):
                        if not e['certo']:
                            quem = f"{nomes.get(e['reserva'], e['reserva'])} ({e['reserva']})"
                            if e['aceite']:
                                raise ValueError(f"Porta {e['porta']}, voo {e['voo']}: o cartão de {quem} foi aceite e devia ser recusado ({', '.join(e['razoes'])}).")
                            raise ValueError(f"Porta {e['porta']}, voo {e['voo']}: o cartão de {quem} estava em ordem e foi recusado ({e['motivo']}).")
                    contagens = eventos(n, 'contagem')
                    if len(contagens) < len(manha(n)['boarding']['portas']):
                        raise ValueError('A simulação não chegou ao fim: usa simular_embarque() sem argumentos.')
                    for e in contagens:
                        if e['atraso']:
                            raise ValueError(f"A porta {e['porta']} atrasou o voo {e['voo']} {e['atraso']} minutos. Vê as ocorrências.")
                    return True
                check('O programa usa raise e as classes Porta e ErroEmbarque', lambda: isinstance(defn('Porta'), ast.ClassDef) and isinstance(defn('ErroEmbarque'), ast.ClassDef) and usa('Porta', ast.Raise))
                check('O programa usa programar_porta e simular_embarque', lambda: chama(None, 'programar_porta') and chama(None, 'simular_embarque'))
                check('ErroEmbarque herda de Exception; VooErrado, PortaFechada e CartaoRepetido herdam de ErroEmbarque', hierarquia)
                check('Cartões em ordem entram em embarcados', valido)
                check('Cartão de outro voo: VooErrado', lambda: recusa('voo'))
                check('No minuto do fecho e depois dele: PortaFechada', lambda: recusa('fecho'))
                check('O mesmo cartão segunda vez: CartaoRepetido', lambda: recusa('repetido'))
                check('faltas(esperados) devolve o conjunto de quem não embarcou, e cada porta tem o seu', faltas)
                for n in range(3):
                    check(f'Manhã {n + 1}: todas as leituras com a decisão certa e nenhum voo atrasado pela porta', lambda n=n: leituras_certas(n))
            else:
                import tempfile as _tmp
                def ficheiro(texto):
                    pasta = _tmp.mkdtemp(prefix='teste_')
                    caminho = os.path.join(pasta, 'leituras.csv')
                    with open(caminho, 'w', encoding='utf-8', newline='') as f:
                        f.write(texto)
                    return caminho
                def le(texto, esperado, rejeitadas):
                    r = fn('ler_leituras')(ficheiro('voo,reserva,hora,resultado\n' + texto))
                    if not (isinstance(r, tuple) and len(r) == 2):
                        raise ValueError('ler_leituras tem de devolver dois valores: return embarcados, rejeitadas.')
                    dados, n = r
                    if not isinstance(dados, dict) or not all(isinstance(v, (set, frozenset)) for v in dados.values()):
                        raise ValueError('O primeiro valor tem de ser um dicionário {voo: conjunto de reservas}.')
                    if {k: set(v) for k, v in dados.items() if v} != esperado:
                        raise ValueError(f'Embarcados esperados: {esperado}. Obtidos: {dados}.')
                    if n != rejeitadas:
                        raise ValueError(f'Linhas rejeitadas esperadas: {rejeitadas}. Obtidas: {n}.')
                    return True
                def sem_ficheiro():
                    r = fn('ler_leituras')(os.path.join(_tmp.mkdtemp(prefix='teste_'), 'nao_existe.csv'))
                    return isinstance(r, tuple) and len(r) == 2 and r[0] == {} and r[1] == 0
                def grava():
                    caminho = os.path.join(_tmp.mkdtemp(prefix='teste_'), 'faltas.json')
                    cartoes = [{'reserva': r, 'nome': 'Teste', 'voo': v, 'lugar': '1A', 'porta': 'G21'}
                               for v, r in (('QX1', 'CCC333'), ('QX1', 'AAA111'), ('QX2', 'DDD444'), ('QX1', 'BBB222'), ('QX3', 'EEE555'))]
                    esperado = {'QX1': ['BBB222', 'CCC333'], 'QX2': [], 'QX3': ['EEE555']}
                    devolvido = chamar('guardar_faltas', caminho, cartoes, {'QX1': {'AAA111'}, 'QX2': {'DDD444', 'ZZZ999'}})
                    if not os.path.exists(caminho):
                        raise ValueError('guardar_faltas não criou o ficheiro no caminho recebido.')
                    gravado = json.loads(open(caminho, encoding='utf-8').read())
                    if gravado != esperado:
                        raise ValueError(f'Ficheiro esperado: {esperado}. Gravado: {gravado}.')
                    return devolvido == esperado
                def percurso(n):
                    r = manha(n)
                    reg = r['loading']
                    if not reg or reg.get('origem') != 'triagem' or r['boarding'].get('origem') != 'checkin':
                        raise ValueError('O programa tem de correr simular_checkin(), simular_triagem(), simular_embarque() e, só depois, simular_carregamento().')
                    sem_lista = [e['texto'] for e in reg['eventos'] if e['tipo'] == 'ocorrencia' and 'não recebeu a lista' in e['texto']]
                    if sem_lista:
                        raise ValueError(sem_lista[0] + '. Usa entregar_embarcados(embarcados) antes de simular_carregamento().')
                    dono = {m['etiqueta']: m for m in reg['malas']}
                    for e in reg['eventos']:
                        if e['tipo'] == 'descarga':
                            m = dono[e['mala']]
                            if e['manual']:
                                raise ValueError(f"Voo {e['voo']}: a mala {e['mala']} de {m['nome']} (reserva {m['reserva']}) ficou a bordo e o dono não embarcou.")
                            if not e['certa']:
                                raise ValueError(f"Voo {e['voo']}: a mala {e['mala']} de {m['nome']} (reserva {m['reserva']}) foi retirada e o dono embarcou.")
                    for e in reg['eventos']:
                        if e['tipo'] == 'partida' and e['atraso'] > 0:
                            raise ValueError(f"O voo {e['voo']} partiu com {e['atraso']} minutos de atraso. Vê as ocorrências.")
                    if sum(e['tipo'] == 'partida' for e in reg['eventos']) < len(reg['voos']):
                        raise ValueError('Nem todos os voos chegaram a partir: usa simular_carregamento() sem argumentos.')
                    return True
                def ficheiro_de_faltas(n):
                    r = manha(n)
                    if r['_faltas'] is None:
                        raise ValueError('O programa não gravou o ficheiro FICHEIRO_FALTAS.')
                    gravado = json.loads(r['_faltas'])
                    certo = {e['voo']: sorted(e['faltas']) for e in eventos(n, 'contagem')}
                    for voo, faltas in certo.items():
                        if gravado.get(voo) != faltas:
                            raise ValueError(f'Voo {voo}: as faltas são {faltas} e o ficheiro tem {gravado.get(voo)}.')
                    return True
                check('O programa usa csv e json', lambda: (chama(None, 'reader') or chama(None, 'DictReader')) and (chama(None, 'dump') or chama(None, 'dumps')))
                check('ler_leituras usa try/except', lambda: usa('ler_leituras', ast.Try))
                check('O programa usa simular_checkin, simular_triagem, simular_embarque, entregar_embarcados e simular_carregamento', lambda: all(chama(None, f) for f in ('simular_checkin', 'simular_triagem', 'simular_embarque', 'entregar_embarcados', 'simular_carregamento')))
                check('Linhas certas: um conjunto de reservas por voo', lambda: le('QX1,AAA111,09:20,embarcou\nQX2,DDD444,09:31,embarcou\nQX1,BBB222,09:21,embarcou\n', {'QX1': {'AAA111', 'BBB222'}, 'QX2': {'DDD444'}}, 0) and le('', {}, 0))
                check('Quem foi recusado não conta como embarcado', lambda: le('QX1,AAA111,09:20,embarcou\nQX1,BBB222,09:46,recusado\nQX1,AAA111,09:20,recusado\nQX2,CCC333,09:50,recusado\n', {'QX1': {'AAA111'}}, 0))
                check('Linhas com campos a menos ou a mais são rejeitadas e contadas', lambda: le('QX1,AAA111,09:20,embarcou\nQX1,BBB222\nQX1,CCC333,09:22\nQX1,DDD444,09:23,embarcou,extra\nQX1\n', {'QX1': {'AAA111'}}, 4))
                check('Linhas com a hora estragada são rejeitadas e contadas', lambda: le('QX1,AAA111,ERRO,embarcou\nQX1,BBB222,--:--,embarcou\nQX1,CCC333,09:25,embarcou\nQX1,DDD444,,embarcou\n', {'QX1': {'CCC333'}}, 3))
                check('Ficheiro que não existe: devolve ({}, 0)', sem_ficheiro)
                check('guardar_faltas grava {voo: lista ordenada} em JSON e devolve o dicionário', grava)
                for n in range(3):
                    check(f'Manhã {n + 1}, do balcão ao porão: só saem as malas de quem não embarcou e os voos partem à hora', lambda n=n: percurso(n))
                    check(f'Manhã {n + 1}: o ficheiro de faltas tem quem não embarcou em cada voo', lambda n=n: ficheiro_de_faltas(n))
    else:
        raise ValueError('Nível de aprendizagem desconhecido.')
    passed=sum(t['passed'] for t in tests)
    return dict(passed=bool(tests) and passed==len(tests), score=round(100*passed/len(tests)) if tests else 0, tests=tests)
