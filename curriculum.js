export const LEVELS = [
  {
    "id": "types",
    "title": "Dados da torre",
    "description": "Constantes por convenção; str, int, float e bool. Define exatamente os cinco valores pedidos.",
    "criteria": "MAX_VOOS = 100; codigo = \"PX100\"; passageiros = 120; ocupacao = 0.8; pista_disponivel = True.",
    "code": "# Define os cinco nomes com os tipos e valores do enunciado.\n",
    "number": 1
  },
  {
    "id": "math",
    "title": "Ocupação do avião",
    "description": "Escreve calcular_ocupacao(passageiros, capacidade). Devolve a percentagem de ocupação; considera capacidade positiva.",
    "criteria": "Calcula passageiros / capacidade × 100; funciona com zero passageiros e lotação completa.",
    "code": "def calcular_ocupacao(passageiros, capacidade):\n    pass\n\nprint(calcular_ocupacao(125, 250))\n",
    "number": 2
  },
  {
    "id": "choice",
    "title": "Autorizar uma operação",
    "description": "Escreve pode_operar(pista_disponivel, autorizado). Usa if/else e devolve True apenas quando ambos são True.",
    "criteria": "Usa uma condição if; devolve bool nas quatro combinações de entrada.",
    "code": "def pode_operar(pista_disponivel, autorizado):\n    pass\n",
    "number": 3
  },
  {
    "id": "lists",
    "title": "Códigos das partidas",
    "description": "Escreve codigos_partidas(agenda). Recebe uma lista de dicionários e devolve uma lista dos códigos de partida, pela ordem original.",
    "criteria": "Seleciona tipo == \"partida\"; preserva a ordem; aceita uma agenda vazia.",
    "code": "def codigos_partidas(agenda):\n    pass\n\nprint(codigos_partidas(voos))\n",
    "number": 4
  },
  {
    "id": "dicts",
    "title": "Movimentos por continente",
    "description": "Escreve contar_continentes(agenda). Conta todos os movimentos por continente num dicionário. Usa for ou uma compreensão.",
    "criteria": "Devolve {continente: quantidade}; aceita continentes repetidos e uma agenda vazia.",
    "code": "def contar_continentes(agenda):\n    pass\n\nprint(contar_continentes(voos))\n",
    "number": 5
  },
  {
    "id": "matrix",
    "title": "Matriz de horários",
    "description": "Escreve matriz_horarios(agenda). Cada linha da matriz é uma lista [hora, codigo, passageiros], na ordem original.",
    "criteria": "Devolve uma lista de listas; mantém tipos e ordem; aceita uma agenda vazia.",
    "code": "def matriz_horarios(agenda):\n    pass\n\nprint(matriz_horarios(voos)[:5])\n",
    "number": 6
  },
  {
    "id": "while",
    "title": "Percorrer o tempo",
    "description": "Escreve minutos_intervalo(inicio, fim) com while. Devolve os minutos inteiros de inicio (incluído) até fim (excluído).",
    "criteria": "Usa while; inclui início e exclui fim; devolve [] se início >= fim.",
    "code": "def minutos_intervalo(inicio, fim):\n    pass\n",
    "number": 7
  },
  {
    "id": "query",
    "title": "Informar um passageiro",
    "description": "Escreve contar_destino(agenda, cidade). Conta apenas partidas para essa cidade, sem distinguir maiúsculas de minúsculas.",
    "criteria": "Usa os dados recebidos no parâmetro agenda; ignora chegadas; devolve int, incluindo zero.",
    "code": "def contar_destino(agenda, cidade):\n    pass\n\nprint(contar_destino(voos, \"Lisboa\"))\n",
    "number": 8
  },
  {
    "id": "errors",
    "title": "Tratar uma exceção",
    "description": "Escreve dividir_seguro(a, b). Devolve a / b, ou None se o divisor for zero. Usa try/except ZeroDivisionError.",
    "criteria": "Usa try e except ZeroDivisionError; mantém resultados negativos; trata divisor zero.",
    "code": "def dividir_seguro(a, b):\n    pass\n",
    "number": 9
  },
  {
    "id": "files",
    "title": "Guardar o painel",
    "description": "Escreve guardar_e_ler(caminho, codigos). Usa with e open: escreve um código por linha, lê o ficheiro e devolve a lista lida.",
    "criteria": "Usa o caminho recebido; grava todos os códigos; devolve linhas sem a mudança de linha; aceita uma lista vazia.",
    "code": "def guardar_e_ler(caminho, codigos):\n    pass\n\nprint(guardar_e_ler(\"painel.txt\", [\"PX100\", \"PX102\"]))\n",
    "number": 10
  },
  {
    "id": "panel",
    "title": "Balcão e painel",
    "description": "Escreve linha_painel(codigo, destino, hora, lugar, estado), que devolve uma linha do painel numa f-string: código à esquerda em 7 colunas, destino à esquerda em 14, a hora (minutos desde a meia-noite) como HH:MM, um espaço, o lugar centrado em 5 colunas, um espaço e o estado. No programa, pede o código de um voo com input() e mostra a sua linha.",
    "criteria": "Usa input() no programa e uma f-string na função; linha_painel(\"PX100\", \"Lisboa\", 365, \"P04\", \"EMBARQUE\") devolve \"PX100  Lisboa        06:05  P04  EMBARQUE\"; funciona com 00:00, 23:59 e destinos longos.",
    "code": "def linha_painel(codigo, destino, hora, lugar, estado):\n    pass\n\n# Escreve o código do voo no campo Entradas do programa (por exemplo PX100).\ncodigo = input(\"Código do voo: \")\nfor voo in voos:\n    if voo[\"codigo\"] == codigo:\n        print(linha_painel(voo[\"codigo\"], voo[\"cidade\"], voo[\"hora\"], voo[\"parqueamento\"] or \"-\", voo[\"estado\"]))\n",
    "number": 11
  },
  {
    "id": "priority",
    "title": "Prioridade de aterragem",
    "description": "Escreve prioridade(combustivel_min, mayday, pan_pan, atraso_min). Devolve 1 se houver MAYDAY ou combustível para menos de 30 min; 2 se houver PAN-PAN; 3 se o combustível der para menos de 45 min; 4 se o atraso passar de 60 min; 5 nos restantes casos. A primeira regra que se aplica é a que conta.",
    "criteria": "Testa os limites exatos: 29/30 min de combustível, 44/45 min e atraso 60/61; MAYDAY ganha a qualquer outra regra.",
    "code": "def prioridade(combustivel_min, mayday, pan_pan, atraso_min):\n    pass\n\nprint(prioridade(25, False, False, 0))   # 1\nprint(prioridade(90, False, True, 0))    # 2\n",
    "number": 12
  },
  {
    "id": "holding",
    "title": "Espera com nevoeiro",
    "description": "Escreve simular_espera(combustivel_kg, reserva_kg, consumo_kg_min, minuto_levanta) com while. A cada minuto, a partir do minuto 1, o avião gasta consumo_kg_min. Se nesse minuto o nevoeiro levanta, devolve (\"aterra\", minuto); senão, se o combustível já está na reserva ou abaixo, devolve (\"desvia\", minuto).",
    "criteria": "Usa while; o nevoeiro é verificado antes da reserva; 2400 kg, reserva 900 kg, 50 kg/min e nevoeiro a levantar ao minuto 40 dá (\"desvia\", 30).",
    "code": "def simular_espera(combustivel_kg, reserva_kg, consumo_kg_min, minuto_levanta):\n    pass\n\nprint(simular_espera(2400, 900, 50, 17))\n",
    "number": 13
  },
  {
    "id": "sets",
    "title": "Lugares com conjuntos",
    "description": "Escreve lugares_compativeis(lugares, corpo_largo), que recebe dicionários como os de consultar_parqueamentos() e devolve o set dos códigos livres; se corpo_largo for True, só os do tipo \"jetbridge\" (manga). Escreve também colisoes(pedidos, ocupados), que devolve o set dos lugares pedidos que estão ocupados.",
    "criteria": "Devolve sempre set; corpo largo só em manga; aceita listas sem lugares livres; colisoes usa a interseção de conjuntos.",
    "code": "def lugares_compativeis(lugares, corpo_largo):\n    pass\n\ndef colisoes(pedidos, ocupados):\n    pass\n\nprint(lugares_compativeis(consultar_parqueamentos(), True))\n",
    "number": 14
  },
  {
    "id": "metar",
    "title": "Ler uma mensagem METAR",
    "description": "Escreve ler_metar(texto) para mensagens como \"LPPR 171430Z 32018G28KT 9999 FEW020 17/09 Q1018\". Devolve um dicionário com aeroporto, dia (int), hora (\"14:30\"), direcao, vento e rajada (int, ou None sem G), visibilidade (int), temperatura (int; M02 é -2) e pressao (int).",
    "criteria": "Usa split() e fatiamento; encontra a temperatura pela barra /, mesmo quando há grupos extra como FG ou BKN008; aceita temperaturas negativas.",
    "code": "def ler_metar(texto):\n    pass\n\nprint(ler_metar(\"LPPR 171430Z 32018G28KT 9999 FEW020 17/09 Q1018\"))\n",
    "number": 15
  },
  {
    "id": "fees",
    "title": "Taxas do aeroporto",
    "description": "Escreve calcular_taxas(peso_t, passageiros, minutos_lugar, manga=True), que devolve um tuplo (aterragem, passageiros, estacionamento, total) com 2 casas decimais: 7,85 € por tonelada, 12,40 € por passageiro e, depois dos primeiros 30 minutos grátis, 1,20 €/min com manga ou 0,60 €/min a pé.",
    "criteria": "Devolve um tuplo de 4 valores (sem print dentro da função); manga tem valor por omissão; 30 minutos ou menos não pagam estacionamento.",
    "code": "def calcular_taxas(peso_t, passageiros, minutos_lugar, manga=True):\n    pass\n\nprint(calcular_taxas(70, 168, 45))\n",
    "number": 16
  },
  {
    "id": "stdlib",
    "title": "Horas noutro fuso",
    "description": "Escreve hora_chegada_local(partida, duracao_min, fuso_destino). partida é texto \"AAAA-MM-DDTHH:MM\" na hora de Portugal (Europe/Lisbon). Devolve a hora de chegada no fuso do destino como \"AAAA-MM-DD HH:MM\". Usa datetime, timedelta e zoneinfo.",
    "criteria": "Importa zoneinfo; respeita as mudanças de hora (os EUA mudam antes da Europa em março; Portugal atrasa a hora a 25 de outubro de 2026) e a passagem da meia-noite.",
    "code": "from datetime import datetime, timedelta\nfrom zoneinfo import ZoneInfo\n\ndef hora_chegada_local(partida, duracao_min, fuso_destino):\n    pass\n\nprint(hora_chegada_local(\"2026-03-15T10:35\", 485, \"America/New_York\"))\n",
    "number": 17
  },
  {
    "id": "data",
    "title": "Ficheiro de voos com erros",
    "description": "Escreve carregar_voos(caminho), que lê um CSV de voos com csv e devolve (validos, rejeitados). Remove espaços à volta dos campos, põe o tipo em minúsculas e converte passageiros para int. Rejeita, com (número da linha, motivo), linhas com colunas a menos, hora inválida, código vazio, passageiros que não são inteiros e códigos repetidos. A linha do cabeçalho é a linha 1.",
    "criteria": "Usa with/open e try/except; devolve os válidos pela ordem do ficheiro; os números de linha dos rejeitados são os do ficheiro. Experimenta com /dados/voos_sujos.csv.",
    "code": "import csv\n\ndef carregar_voos(caminho):\n    validos, rejeitados = [], []\n    return validos, rejeitados\n\nvalidos, rejeitados = carregar_voos(\"/dados/voos_sujos.csv\")\nprint(len(validos), \"válidos;\", len(rejeitados), \"rejeitados\")\nfor linha, motivo in rejeitados:\n    print(linha, motivo)\n",
    "number": 18
  },
  {
    "id": "objects",
    "title": "Estados de um voo",
    "description": "Cria a exceção TransicaoInvalida e a classe Voo(codigo). O estado começa em PROGRAMADO e avancar_estado() segue CHECK-IN, EMBARQUE, PORTAS FECHADAS e DESCOLOU. cancelar() passa a CANCELADO. Avançar depois de DESCOLOU ou de CANCELADO lança TransicaoInvalida. estado é uma @property sem setter.",
    "criteria": "TransicaoInvalida herda de Exception; os 5 estados por ordem; nenhum voo avança depois de descolar ou de ser cancelado; voo.estado = \"DESCOLOU\" provoca AttributeError.",
    "code": "class TransicaoInvalida(Exception):\n    pass\n\nclass Voo:\n    ESTADOS = [\"PROGRAMADO\", \"CHECK-IN\", \"EMBARQUE\", \"PORTAS FECHADAS\", \"DESCOLOU\"]\n\n    def __init__(self, codigo):\n        self.codigo = codigo\n        self._estado = \"PROGRAMADO\"\n\nvoo = Voo(\"PX100\")\nprint(voo.codigo)\n",
    "number": 19
  },
  {
    "id": "tower",
    "title": "Torre automática",
    "description": "Escreve planear_pista(pedidos). Cada pedido tem codigo, tipo, hora (minutos) e prioridade (1 a 5). Há uma só pista: uma chegada ocupa-a 6 min e uma partida 5 min. Sempre que a pista fica livre, escolhe entre os pedidos cuja hora já chegou o de menor prioridade, depois o de hora mais cedo, depois o de código menor. Devolve a lista de (codigo, inicio, fim). Depois, envia o plano para o painel com autorizar(codigo, inicio) e acompanha os aviões na maquete.",
    "criteria": "Nunca começa antes da hora pedida nem sobrepõe operações; o plano não depende da ordem da lista recebida; agenda vazia devolve [].",
    "code": "def planear_pista(pedidos):\n    plano = []\n    return plano\n\npedidos = [dict(codigo=v[\"codigo\"], tipo=v[\"tipo\"], hora=v[\"hora\"], prioridade=5) for v in voos[:10]]\nfor codigo, inicio, fim in planear_pista(pedidos):\n    print(codigo, inicio, fim)\n    # autorizar(codigo, inicio)   # tira o # para o painel seguir o teu plano\n",
    "number": 20
  },
  {
    "id": "baggage_claim",
    "title": "Recolha de bagagens do PY001",
    "description": "Bloco 2 · Bagagens. O PY001 aterra às 10:00 com 150 passageiros e 120 malas, e a sala de recolha tem quatro carrosséis (T01 a T04). Escreve escolher_tapete(tapetes): recebe uma lista de dicionários com codigo e estado e devolve o codigo do primeiro tapete com estado \"livre\", ou None se não houver nenhum. Depois usa as funções do jogo: consultar_tapetes(), atribuir_tapete(voo, tapete), iniciar_motor(tapete) e simular_bagagens(), que corre a recolha até todas as malas serem entregues e devolve um resumo.",
    "criteria": "Ignora tapetes ocupados e avariados; respeita a ordem da lista; sem tapetes livres ou com a lista vazia devolve None; o programa entrega as 120 malas do PY001.",
    "code": "def escolher_tapete(tapetes):\n    for tapete in tapetes:\n        pass  # se o estado for \"livre\", devolve o código\n    return None\n\ntapete = escolher_tapete(consultar_tapetes())\nprint(\"Tapete escolhido:\", tapete)\n# atribuir_tapete(\"PY001\", tapete)\n# iniciar_motor(tapete)\n# resumo = simular_bagagens()\n# print(resumo[\"malas\"][\"entregue\"], \"malas entregues às\", resumo[\"hora\"])\n",
    "number": 21
  },
  {
    "id": "baggage_fault",
    "title": "Avaria no carrossel T03",
    "description": "Bloco 2 · Bagagens. O PY001 está no carrossel T03, com o motor ligado, e a meio da recolha o T03 avaria. Escreve reagir(minuto): é chamada no início de cada minuto simulado. Quando estado_tapete(\"T03\") for \"avariado\" e o PY001 ainda lá estiver, escolhe um tapete livre (podes reutilizar escolher_tapete do nível anterior), usa transferir_voo(\"PY001\", tapete) e liga o motor do tapete novo. As malas que estavam no T03 voltam à zona de espera e não se perdem. Termina com simular_bagagens(reagir). ocorrencias() mostra o que aconteceu.",
    "criteria": "Avaliado em três cenários diferentes (avaria a horas diferentes e outros tapetes ocupados): as 120 malas do PY001 são entregues e o voo muda de tapete até 2 minutos depois da avaria.",
    "code": "def escolher_tapete(tapetes):\n    for tapete in tapetes:\n        if tapete[\"estado\"] == \"livre\":\n            return tapete[\"codigo\"]\n    return None\n\nvoo_no_t03 = True\n\ndef reagir(minuto):\n    global voo_no_t03\n    if voo_no_t03 and estado_tapete(\"T03\") == \"avariado\":\n        pass  # escolhe um tapete livre, transfere o PY001 e liga o motor\n\nresumo = simular_bagagens(reagir)\nprint(resumo)\nfor o in ocorrencias():\n    print(o[\"minuto\"], o[\"texto\"])\n",
    "number": 22
  },
  {
    "id": "sorting_tags",
    "title": "Triagem: ler a etiqueta",
    "description": "Bloco 2 · Bagagens · Central de triagem. As malas das partidas entram pelo check-in (C1 e C2), passam no leitor de etiquetas e seguem por tapetes e desviadores até à saída do seu voo (S01 a S04). O leitor ainda não tem programa: sem ele, todas as malas acabam na inspeção. Escreve criar_destinos(partidas): recebe a lista de consultar_partidas() (dicionários com voo, destino, hora, saida e malas) e devolve um dicionário {voo: saida}. Escreve encaminhar(mala): recebe um dicionário com codigo, voo e peso e devolve a saída desse voo, ou \"INSPECAO\" quando a etiqueta é ilegível (voo é None) ou o voo não está na tabela. Entrega a função ao leitor com programar_leitor(encaminhar) e corre a triagem com simular_triagem(), que devolve um resumo.",
    "criteria": "criar_destinos funciona com qualquer lista de partidas e devolve {} para a lista vazia. Avaliado em três manhãs com os voos em saídas diferentes: cada mala legível chega à saída do seu voo, nenhuma chega a uma saída errada e só as ilegíveis ou sem voo vão para inspeção.",
    "code": "def criar_destinos(partidas):\n    destinos = {}\n    for partida in partidas:\n        pass  # guarda a saída de cada voo: destinos[...] = ...\n    return destinos\n\ndestinos = criar_destinos(consultar_partidas())\nprint(destinos)\n\ndef encaminhar(mala):\n    # devolve a saída do voo da mala, ou \"INSPECAO\"\n    return \"INSPECAO\"\n\nprogramar_leitor(encaminhar)\nresumo = simular_triagem()\nprint(resumo[\"malas\"])\nprint(resumo[\"por_saida\"])\n",
    "number": 23
  },
  {
    "id": "sorting_routes",
    "title": "Rotas na rede de tapetes",
    "description": "Bloco 2 · Bagagens · Central de triagem. A central foi reiniciada e os desviadores perderam as rotas: sem rota, as malas vão para inspeção. consultar_rede() devolve o grafo dos tapetes que estão a funcionar, um dicionário {nó: [nós seguintes]}. Escreve encontrar_rota(rede, origem, destino): devolve a lista de nós do caminho com menos troços, com a origem e o destino incluídos, ou None se não houver caminho. Usa procura em largura: uma fila (deque) com os nós por visitar e um dicionário anterior que guarda de onde chegaste a cada nó. A rede tem um retorno que volta ao leitor, por isso nunca ponhas o mesmo nó duas vezes na fila. Depois, para cada partida, programa os desviadores com definir_rota(saida, rota), com a rota de \"LEITOR\" até à saída, e termina com simular_triagem().",
    "criteria": "encontrar_rota devolve sempre um caminho válido e com o menor número de troços, [origem] quando a origem é o destino e None quando não há caminho, mesmo em redes com ciclos. Avaliado em três manhãs (duas com um troço fora de serviço): cada mala legível chega à saída do seu voo.",
    "code": "from collections import deque\n\ndef encontrar_rota(rede, origem, destino):\n    anterior = {origem: None}        # de onde cheguei a cada nó\n    fila = deque([origem])           # nós por visitar, por ordem de chegada\n    while fila:\n        no = fila.popleft()\n        if no == destino:\n            rota = []\n            while no is not None:    # recua do destino até à origem\n                rota.append(no)\n                no = anterior[no]\n            return rota[::-1]\n        for vizinho in rede[no]:\n            pass  # se o vizinho ainda não está em anterior, regista de onde vieste e põe-no na fila\n    return None\n\nrede = consultar_rede()\nprint(encontrar_rota(rede, \"LEITOR\", \"S03\"))\n# for partida in consultar_partidas():\n#     definir_rota(partida[\"saida\"], encontrar_rota(rede, \"LEITOR\", partida[\"saida\"]))\n# resumo = simular_triagem()\n# print(resumo[\"malas\"])\n",
    "number": 24
  },
  {
    "id": "sorting_fault",
    "title": "Avaria num troço: rota alternativa",
    "description": "Bloco 2 · Bagagens · Central de triagem. A meio da triagem um troço de tapete avaria durante 10 minutos, e não sabes qual. As malas que lá estão ficam paradas até à reparação. As outras, se a rota passar pelo troço avariado, são desviadas para o retorno, voltam ao leitor e ficam às voltas; à terceira leitura vão para inspeção e perdem o voo. Escreve reagir(minuto): é chamada no início de cada minuto simulado. consultar_rede() só devolve os troços a funcionar: calcula a rota de cada saída com encontrar_rota (a do nível anterior) e, se for diferente da que está em consultar_rotas(), aplica-a com definir_rota. Termina com simular_triagem(reagir). ocorrencias() mostra o que aconteceu e resumo[\"recirculacoes\"] conta as voltas pelo retorno.",
    "criteria": "Avaliado em três manhãs, com avarias em troços e a horas diferentes: cada mala legível chega à saída do seu voo e, até um minuto depois de cada avaria, nenhuma rota passa pelo troço avariado.",
    "code": "from collections import deque\n\ndef encontrar_rota(rede, origem, destino):\n    anterior = {origem: None}\n    fila = deque([origem])\n    while fila:\n        no = fila.popleft()\n        if no == destino:\n            rota = []\n            while no is not None:\n                rota.append(no)\n                no = anterior[no]\n            return rota[::-1]\n        for vizinho in rede[no]:\n            if vizinho not in anterior:\n                anterior[vizinho] = no\n                fila.append(vizinho)\n    return None\n\ndef reagir(minuto):\n    rede = consultar_rede()        # só os troços a funcionar neste minuto\n    for partida in consultar_partidas():\n        saida = partida[\"saida\"]\n        pass  # calcula a rota até à saída; se mudou, aplica-a com definir_rota\n\nresumo = simular_triagem(reagir)\nprint(resumo[\"malas\"], resumo[\"recirculacoes\"])\nfor o in ocorrencias():\n    print(o[\"minuto\"], o[\"texto\"])\n",
    "number": 25
  },
  {
    "id": "checkin_validate",
    "title": "Check-in: validar os dados",
    "description": "Bloco 2 · Bagagens · Check-in. É aqui que as malas entram na rede: o passageiro espera na fila, é chamado por um balcão (B01 a B06) e, se for aceite, despacha as malas. Os balcões ainda não têm regras: sem elas aceitam toda a gente, incluindo quem não pode embarcar. Escreve validar(passageiro, minuto). O passageiro é um dicionário com reserva, nome, voo, documento, malas (lista com o peso de cada mala, em kg) e chegada; minuto é o minuto em que chega ao balcão. Devolve \"OK\" ou o primeiro motivo de recusa, por esta ordem: \"reserva inválida\" (a reserva tem de ter exatamente 6 caracteres, só letras maiúsculas e algarismos), \"sem documento\" (documento é None ou está vazio), \"voo desconhecido\" (o voo não está em consultar_partidas()), \"check-in fechado\" (o check-in fecha 40 minutos antes da partida: ao minuto hora − 40 já não se aceita ninguém) e \"peso inválido\" (alguma mala pesa 0 ou menos, ou mais de 32 kg). Entrega a função com programar_validacao(validar) e corre a manhã com simular_checkin(), que devolve um resumo. ocorrencias() mostra as decisões erradas.",
    "criteria": "validar é testada com passageiros de exemplo, incluindo os casos-limite: reserva com 5 e com 7 caracteres, minúsculas, mala com exatamente 32 kg, passageiro sem malas e o minuto exato do fecho. Avaliado em três manhãs com passageiros diferentes: todos os passageiros recebem a decisão certa.",
    "code": "horas = {}                      # voo -> hora da partida, em minutos\nfor partida in consultar_partidas():\n    horas[partida[\"voo\"]] = partida[\"hora\"]\n\nprint(consultar_passageiros()[0])\n\ndef validar(passageiro, minuto):\n    reserva = passageiro[\"reserva\"]\n    # devolve o primeiro motivo de recusa, pela ordem do enunciado\n    return \"OK\"\n\nprogramar_validacao(validar)\nresumo = simular_checkin()\nprint(resumo[\"passageiros\"], \"erros:\", resumo[\"erros\"])\nfor o in ocorrencias():\n    print(o[\"minuto\"], o[\"texto\"])\n",
    "number": 26
  },
  {
    "id": "checkin_queue",
    "title": "Filas nos balcões",
    "description": "Bloco 2 · Bagagens · Check-in. Há uma fila única para todos os balcões abertos e, esta manhã, é o teu programa que a gere. Escreve entrar(passageiro): é chamada quando um passageiro chega ao átrio e põe-no no fim da fila. Escreve chamar(balcao, minuto): é chamada sempre que um balcão fica livre e devolve o passageiro que ele vai atender, ou None se a fila estiver vazia. Quem é chamado sai da fila. A regra normal é a ordem de chegada (FIFO): usa deque, com append e popleft. Mas um passageiro é urgente quando faltam 15 minutos ou menos para o fecho do check-in do seu voo (o fecho é 40 minutos antes da partida): se houver urgentes, chama primeiro o urgente que está há mais tempo na fila. Sem esta regra, quem chega em cima da hora fica atrás de uma excursão inteira e perde o voo. Um voo que não está em consultar_partidas() nunca é urgente. Entrega as duas funções com programar_fila(entrar, chamar) e corre a manhã com simular_checkin().",
    "criteria": "entrar e chamar são testadas diretamente: ordem de chegada, urgente à frente, fila vazia devolve None e voo desconhecido não dá erro. Avaliado em três manhãs com um balcão fechado diferente: ninguém que chegou antes do fecho perde o voo, ninguém fica esquecido na fila, quando não há urgentes é atendido quem chegou primeiro e, dentro do mesmo voo, mantém-se a ordem de chegada.",
    "code": "from collections import deque\n\nfecho = {}                      # voo -> minuto em que o check-in fecha\nfor partida in consultar_partidas():\n    fecho[partida[\"voo\"]] = partida[\"hora\"] - 40\n\nfila = deque()\n\ndef urgente(passageiro, minuto):\n    limite = fecho.get(passageiro[\"voo\"])      # None se o voo não existir\n    return limite is not None and limite - minuto <= 15\n\ndef entrar(passageiro):\n    pass  # o passageiro chegou: vai para o fim da fila\n\ndef chamar(balcao, minuto):\n    # 1.º o primeiro urgente da fila; se não houver, o primeiro da fila\n    return None\n\nprogramar_fila(entrar, chamar)\nresumo = simular_checkin()\nprint(resumo)\nfor o in ocorrencias():\n    print(o[\"minuto\"], o[\"texto\"])\n",
    "number": 27
  },
  {
    "id": "checkin_tags",
    "title": "Etiquetas: do balcão à saída",
    "description": "Bloco 2 · Bagagens · Check-in e triagem. No balcão cada mala é pesada e recebe a etiqueta que o leitor da central de triagem vai ler. Os balcões estão sem programa de etiquetas: sem ele, as malas seguem sem etiqueta e acabam todas na inspeção. Escreve criar_etiqueta(voo, peso): é chamada uma vez por cada mala e devolve o código da etiqueta. O código é o voo, um hífen e o número da mala nesse voo com três algarismos: a primeira mala do PY101 é \"PY101-001\", a seguinte \"PY101-002\", e cada voo tem a sua numeração (guarda os contadores num dicionário). Uma mala com mais de 23 kg é pesada e leva um H no fim, por exemplo \"PY102-014H\", para avisar quem a carrega. Uma etiqueta repetida ou mal formada não é lida na triagem. Entrega a função com programar_etiquetas(criar_etiqueta), corre simular_checkin() e depois simular_triagem(): as malas etiquetadas saem pelo tapete coletor, entram na central pelas linhas C1 e C2 e seguem até à saída do voo.",
    "criteria": "criar_etiqueta é testada diretamente: numeração seguida e separada por voo, três algarismos, H só acima de 23 kg. Avaliado em três manhãs: todas as etiquetas estão certas, nenhuma se repete e, na triagem, cada mala chega à saída do seu voo sem passar pela inspeção.",
    "code": "contadores = {}                 # voo -> número de malas já etiquetadas\n\ndef criar_etiqueta(voo, peso):\n    # conta mais uma mala deste voo e devolve, por exemplo, \"PY101-007\" ou \"PY101-008H\"\n    return voo\n\nprint(criar_etiqueta(\"PX1\", 12.5))     # voo inventado, para não gastar números dos voos reais\n\nprogramar_etiquetas(criar_etiqueta)\ncheckin = simular_checkin()\nprint(\"Malas etiquetadas:\", checkin[\"malas\"])\nresumo = simular_triagem()\nprint(resumo[\"malas\"])\nprint(resumo[\"por_saida\"])\nfor o in ocorrencias():\n    print(o[\"minuto\"], o[\"texto\"])\n",
    "number": 28
  }
];
