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
  },
  {
    "id": "loading_plan",
    "title": "Porões: o plano de carga",
    "description": "Bloco 2 · Bagagens · Carregamento do avião. As malas que a triagem entregou na saída de cada voo vão em reboques até ao avião e sobem pelos tapetes de carregamento para os três porões: DIANTEIRO, TRASEIRO e GRANEL (o mais pequeno, na cauda). Esta manhã os porões já levam muita carga e correio, por isso o espaço é pouco: cada porão só aceita os quilos que tem livres, em aviao[\"poroes\"][nome][\"livre\"]. Escreve distribuir(malas, aviao): recebe as malas do voo (cada uma é um dicionário com etiqueta, voo, peso e reserva) e a ficha do avião, e devolve o plano de carga, um dicionário {porão: [etiquetas]}. Regras: cada mala entra uma vez e só uma; a soma dos pesos de cada porão não passa dos quilos livres; em cada porão as etiquetas ficam pela ordem de carga, das malas mais pesadas para as mais leves (as pesadas ficam por baixo). O método que funciona: ordena as malas da mais pesada para a mais leve com sorted(malas, key=..., reverse=True) e põe cada uma no primeiro porão onde ainda cabe. Se distribuíres sem ordenar, as malas grandes chegam ao fim sem sítio. Uma mala que não cabe no porão indicado, ou que fica fora do plano, não embarca. Entrega a função com programar_plano(distribuir) e corre simular_carregamento().",
    "criteria": "distribuir é testada diretamente com aviões de teste: todas as malas no plano uma só vez, nenhum porão acima dos quilos livres, as mais pesadas primeiro e um caso em que só cabem todas se começares pelas mais pesadas. Avaliado em três manhãs: todas as malas de todos os voos embarcam, nenhum porão é excedido e os quatro voos partem à hora.",
    "code": "def distribuir(malas, aviao):\n    plano = {\"DIANTEIRO\": [], \"TRASEIRO\": [], \"GRANEL\": []}\n    livre = {}                      # porão -> quilos que ainda cabem\n    for nome, porao in aviao[\"poroes\"].items():\n        livre[nome] = porao[\"livre\"]\n    # 1.º ordena as malas da mais pesada para a mais leve\n    # 2.º põe cada mala no primeiro porão onde ainda cabe e desconta o peso\n    for mala in malas:\n        plano[\"DIANTEIRO\"].append(mala[\"etiqueta\"])\n    return plano\n\nfor aviao in consultar_avioes():\n    print(aviao[\"voo\"], aviao[\"lugar\"], aviao[\"poroes\"])\n\nprogramar_plano(distribuir)\nresumo = simular_carregamento()\nprint(resumo[\"malas\"])\nfor o in ocorrencias():\n    print(o[\"minuto\"], o[\"texto\"])\n",
    "number": 29
  },
  {
    "id": "loading_balance",
    "title": "Centragem: o avião equilibrado",
    "description": "Bloco 2 · Bagagens · Carregamento do avião. Um avião só pode descolar se o centro de gravidade estiver entre dois limites: demasiado à frente não levanta o nariz, demasiado atrás fica instável. O centro de gravidade calcula-se com momentos: cada massa conta com o seu peso vezes o braço, que é a distância ao nariz em metros. Centro de gravidade = soma dos (peso × braço) a dividir pela soma dos pesos. Escreve centragem(aviao, pesos): soma primeiro as massas fixas de aviao[\"massas\"] (avião vazio, combustível, passageiros e carga, cada uma com peso e braco) e depois as malas de cada porão, em que pesos é {porão: quilos de malas} e o braço do porão está em aviao[\"poroes\"][nome][\"braco\"]. Usa um ciclo e dois acumuladores, um para os momentos e outro para os pesos. Hoje os porões têm espaço de sobra, mas os aviões não estão equilibrados: uns têm os passageiros quase todos atrás e a carga na traseira (pesados de cauda), outros o contrário (pesados de nariz). Completa distribuir(malas, aviao) para experimentar duas ordens de enchimento, primeiro pela frente (DIANTEIRO, TRASEIRO, GRANEL) e depois por trás (GRANEL, TRASEIRO, DIANTEIRO), e devolver o primeiro plano cuja centragem fica entre aviao[\"limite_frente\"] e aviao[\"limite_tras\"]. Se a centragem falhar, a equipa tem de mudar malas de porão e o voo atrasa 12 minutos.",
    "criteria": "centragem é testada diretamente com aviões de teste, com e sem malas. distribuir é testada com um avião pesado de cauda e outro pesado de nariz. Avaliado em três manhãs: todas as malas embarcam, todos os voos acabam de carregar com a centragem dentro dos limites e partem à hora.",
    "code": "def centragem(aviao, pesos):\n    momento = 0.0                   # soma dos peso × braço\n    total = 0.0                     # soma dos pesos\n    for massa in aviao[\"massas\"]:\n        pass  # soma o momento e o peso de cada massa fixa\n    for nome, peso in pesos.items():\n        pass  # soma as malas de cada porão: o braço está em aviao[\"poroes\"][nome][\"braco\"]\n    return 0.0                      # momento / total\n\ndef encher(malas, aviao, ordem):\n    # o plano do nível anterior, a experimentar os porões pela ordem recebida\n    plano = {\"DIANTEIRO\": [], \"TRASEIRO\": [], \"GRANEL\": []}\n    pesos = {\"DIANTEIRO\": 0.0, \"TRASEIRO\": 0.0, \"GRANEL\": 0.0}\n    for mala in sorted(malas, key=lambda m: m[\"peso\"], reverse=True):\n        for nome in ordem:\n            if pesos[nome] + mala[\"peso\"] <= aviao[\"poroes\"][nome][\"livre\"]:\n                plano[nome].append(mala[\"etiqueta\"])\n                pesos[nome] += mala[\"peso\"]\n                break\n    return plano, pesos\n\ndef distribuir(malas, aviao):\n    plano, pesos = encher(malas, aviao, [\"DIANTEIRO\", \"TRASEIRO\", \"GRANEL\"])\n    # calcula a centragem deste plano; se ficar fora dos limites, experimenta encher por trás\n    return plano\n\nfor aviao in consultar_avioes():\n    print(aviao[\"voo\"], round(centragem(aviao, {}), 2), aviao[\"limite_frente\"], aviao[\"limite_tras\"])\n\nprogramar_plano(distribuir)\nresumo = simular_carregamento()\nfor voo, dados in resumo[\"voos\"].items():\n    print(voo, dados[\"cg\"], dados[\"dentro\"], \"atraso:\", dados[\"atraso\"])\nfor o in ocorrencias():\n    print(o[\"minuto\"], o[\"texto\"])\n",
    "number": 30
  },
  {
    "id": "loading_reconcile",
    "title": "Reconciliação: do balcão ao porão",
    "description": "Bloco 2 · Bagagens · Do check-in ao avião. Regra de segurança: uma mala só voa se o dono embarcou. Quando o embarque fecha, 15 minutos antes da partida, a porta de embarque envia a lista das reservas lidas nos cartões de embarque. Quem fez check-in e não apareceu à porta não voa, e as suas malas têm de sair do porão antes de o fecharem. Escreve malas_a_retirar(malas, embarcados): malas é a lista das malas carregadas no voo (dicionários com etiqueta, reserva, peso e porao) e embarcados é a lista das reservas lidas na porta, onde há cartões lidos duas vezes e passageiros sem mala de porão. Devolve o conjunto das etiquetas das malas cujo dono não embarcou. Usa conjuntos: set(embarcados) elimina as repetições, a diferença entre o conjunto das reservas com mala e o conjunto dos embarcados dá quem faltou, e reserva in conjunto é uma pergunta rápida. Se deixares a bordo a mala de quem faltou, o avião não parte: a equipa procura-a à mão e o voo atrasa 5 minutos por mala. Se tirares a mala de quem embarcou, ela fica em terra. Entrega a função com programar_reconciliacao(malas_a_retirar) e corre a manhã inteira: simular_checkin(), simular_triagem() e simular_carregamento(). As malas seguem do balcão até ao porão.",
    "criteria": "malas_a_retirar é testada diretamente: devolve um conjunto, ignora cartões repetidos, não tira nada quando todos embarcam e tira tudo quando ninguém embarca. Avaliado em três manhãs com o percurso completo (check-in, triagem e carregamento): nenhuma mala de quem faltou fica a bordo, nenhuma mala de quem embarcou fica em terra e os quatro voos partem à hora.",
    "code": "def malas_a_retirar(malas, embarcados):\n    presentes = set(embarcados)             # reservas de quem passou na porta, sem repetições\n    retirar = set()\n    # junta a retirar a etiqueta de cada mala cujo dono não está em presentes\n    return retirar\n\nprogramar_reconciliacao(malas_a_retirar)\nsimular_checkin()\nsimular_triagem()\nresumo = simular_carregamento()\nprint(resumo[\"malas\"])\nfor voo, dados in resumo[\"voos\"].items():\n    print(voo, dados[\"estado\"], \"atraso:\", dados[\"atraso\"])\nfor o in ocorrencias():\n    print(o[\"minuto\"], o[\"texto\"])\n",
    "number": 31
  },
  {
    "id": "boarding_security",
    "title": "Segurança: a classe Linha",
    "description": "Bloco 3 · Passageiros · Controlo de segurança. Depois do check-in, as malas seguem para a triagem e os passageiros vão a pé para o controlo de segurança. Há quatro linhas, L1 a L4, e hoje uma está fechada. Cada linha atende um passageiro de cada vez e umas são mais rápidas do que outras: consultar_linhas() diz o tempo de cada uma, em minutos por passageiro. A porta de embarque fecha 15 minutos antes da partida, por isso quem fica preso na segurança perde o voo. Cada linha vai ser um objeto da tua classe Linha. O objeto guarda o seu estado em atributos: codigo, tempo e fila, uma lista que começa vazia e é criada em __init__ com self.fila = []. Se escreveres fila = [] fora do __init__, a lista passa a ser da classe e todas as linhas partilham a mesma fila. Os métodos são: entrar(passageiro) põe o passageiro no fim da fila; atender() tira e devolve o primeiro, ou None se a fila estiver vazia; espera() devolve (pessoas na fila + 1) × tempo, os minutos até quem entrar agora acabar o controlo; __len__ devolve o número de pessoas na fila, para len(linha) funcionar. Escreve também escolher(linhas, passageiro), que recebe a lista dos objetos das linhas abertas e devolve o objeto com a menor espera. A fila mais curta nem sempre é a mais rápida: duas pessoas numa linha de 3 minutos demoram mais do que quatro numa linha de 1 minuto. Entrega a classe e a função com programar_seguranca(Linha, escolher), sem parênteses depois de Linha: é o simulador que cria um objeto por linha aberta. Depois corre simular_embarque().",
    "criteria": "A classe Linha é testada diretamente: atributos criados em __init__, duas linhas com filas separadas, entrar e atender por ordem de chegada, atender numa fila vazia, espera() e len(). escolher é testada com filas em que a mais curta não é a mais rápida. Avaliado em três manhãs: nenhum passageiro perde o voo por causa da segurança e nenhuma linha fica parada.",
    "code": "class Linha:\n    def __init__(self, codigo, tempo):\n        self.codigo = codigo\n        self.tempo = tempo              # minutos por passageiro\n        # falta a fila: uma lista vazia, só deste objeto\n\n    def entrar(self, passageiro):\n        pass                            # o passageiro vai para o fim da fila\n\n    def atender(self):\n        return None                     # tira e devolve o primeiro da fila; None se estiver vazia\n\n    def espera(self):\n        return 0                        # (pessoas na fila + 1) × tempo\n\n    def __len__(self):\n        return 0                        # pessoas na fila\n\n\ndef escolher(linhas, passageiro):\n    # devolve a linha (o objeto) com a menor espera()\n    return linhas[0]\n\n\nfor linha in consultar_linhas():\n    print(linha[\"codigo\"], linha[\"tempo\"], \"min por passageiro\", \"aberta\" if linha[\"aberta\"] else \"fechada\")\n\nprogramar_seguranca(Linha, escolher)\nresumo = simular_embarque()\nprint(resumo[\"passageiros\"])\nprint(\"espera máxima:\", resumo[\"espera_maxima\"], \"min; perderam o voo na segurança:\", resumo[\"atrasados\"])\nfor o in ocorrencias():\n    print(o[\"minuto\"], o[\"texto\"])\n",
    "number": 32
  },
  {
    "id": "boarding_gate",
    "title": "Porta de embarque: cartões e exceções",
    "description": "Bloco 3 · Passageiros · Porta de embarque. Passada a segurança, cada passageiro caminha até à porta do seu voo, G21 a G24. A porta abre 40 minutos antes da partida, lê 6 cartões por minuto e fecha 15 minutos antes. O leitor tem de recusar três casos: o cartão é de outro voo (há passageiros que se enganam na porta), a porta já fechou (há quem chegue tarde das lojas) e o cartão já foi lido (há quem o passe duas vezes). Em vez de devolver um texto, o método levanta uma exceção, e cada caso tem a sua classe. Uma exceção própria é uma classe que herda de Exception. Cria a classe base ErroEmbarque(Exception) e três filhas: VooErrado, PortaFechada e CartaoRepetido. Como as três herdam de ErroEmbarque, quem escrever except ErroEmbarque apanha qualquer uma delas. Escreve a classe Porta: __init__(self, codigo, voo, fecho) guarda os três valores e cria self.embarcados, um conjunto vazio; ler(cartao, minuto) recebe o cartão (dicionário com reserva, nome, voo e lugar) e levanta VooErrado se o voo não for o da porta, PortaFechada se minuto >= fecho ou CartaoRepetido se a reserva já estiver em embarcados; se estiver tudo certo, junta a reserva a embarcados. Um cartão recusado não entra no conjunto. faltas(esperados) devolve o conjunto das reservas esperadas que não embarcaram. Entrega as duas classes com programar_porta(Porta, ErroEmbarque): o simulador cria uma Porta por voo e trata como recusa qualquer exceção filha de ErroEmbarque. Consequências: um passageiro de outro voo a bordo custa 6 minutos, cada entrada depois do fecho custa 3, e uma contagem que não bate certo obriga a recontar, 4 minutos. Quem tem o cartão em ordem e é recusado fica em terra.",
    "criteria": "As quatro exceções são testadas: ErroEmbarque herda de Exception e as outras três herdam de ErroEmbarque. A classe Porta é testada diretamente: cartão válido, voo errado, porta fechada no minuto do fecho, cartão repetido, recusados fora do conjunto, faltas e duas portas independentes. Avaliado em três manhãs: todas as leituras têm a decisão certa, ninguém com o cartão em ordem fica em terra e nenhuma porta atrasa o voo.",
    "code": "class ErroEmbarque(Exception):\n    pass\n\n\nclass VooErrado(ErroEmbarque):\n    pass\n\n# faltam duas exceções: PortaFechada e CartaoRepetido, também filhas de ErroEmbarque\n\n\nclass Porta:\n    def __init__(self, codigo, voo, fecho):\n        self.codigo = codigo\n        self.voo = voo\n        self.fecho = fecho              # minuto em que a porta fecha\n        self.embarcados = set()         # reservas de quem já entrou\n\n    def ler(self, cartao, minuto):\n        if cartao[\"voo\"] != self.voo:\n            raise VooErrado(f\"{cartao['nome']} é do voo {cartao['voo']}\")\n        # se minuto >= self.fecho: raise PortaFechada(...)\n        # se a reserva já está em self.embarcados: raise CartaoRepetido(...)\n        self.embarcados.add(cartao[\"reserva\"])\n\n    def faltas(self, esperados):\n        return set()                    # reservas esperadas que não embarcaram\n\n\nfor porta in consultar_portas():\n    print(porta[\"porta\"], porta[\"voo\"], porta[\"destino\"], \"fecha ao minuto\", porta[\"fecho\"])\n\nprogramar_porta(Porta, ErroEmbarque)\nresumo = simular_embarque()\nfor voo, dados in resumo[\"voos\"].items():\n    print(voo, dados[\"porta\"], \"embarcados:\", dados[\"embarcados\"], \"faltas:\", dados[\"faltas\"], \"atraso:\", dados[\"atraso\"])\nfor o in ocorrencias():\n    print(o[\"minuto\"], o[\"texto\"])\n",
    "number": 33
  },
  {
    "id": "boarding_files",
    "title": "Do balcão à porta: ficheiros e reconciliação",
    "description": "Bloco 3 · Passageiros · Do check-in ao avião. Hoje a rede entre as portas de embarque e a placa está em baixo: a placa não recebe a lista de quem embarcou e, sem ela, ninguém confere as malas com os passageiros. Os leitores das portas gravaram tudo num ficheiro CSV, cujo caminho está em FICHEIRO_LEITURAS. Tem um cabeçalho (voo,reserva,hora,resultado) e uma linha por cartão lido, com resultado embarcou ou recusado. Algumas linhas ficaram estragadas: faltam campos ou a hora não é HH:MM. Escreve ler_leituras(caminho), que devolve dois valores: um dicionário {voo: conjunto das reservas que embarcaram} e o número de linhas rejeitadas. Lê o ficheiro com csv.reader. Uma linha é válida quando tem exatamente quatro campos e a hora são dois números separados por dois pontos: a atribuição voo, reserva, hora, resultado = campos e a função int() levantam ValueError quando isso falha, por isso um try/except ValueError à volta apanha os dois casos; conta a linha como rejeitada e passa à seguinte com continue. Só entram no dicionário as linhas com resultado embarcou. Se o ficheiro não existir, apanha FileNotFoundError e devolve ({}, 0). Entrega o dicionário à placa com entregar_embarcados(embarcados), antes de simular_carregamento(). Escreve também guardar_faltas(caminho, cartoes, embarcados): cartoes é a lista de consultar_cartoes(), com todos os passageiros que fizeram check-in; a função grava em JSON, com json.dump, um dicionário {voo: lista ordenada das reservas que não embarcaram} e devolve-o. Um voo sem faltas fica com uma lista vazia. Corre a manhã inteira: simular_checkin(), simular_triagem(), simular_embarque() e, depois de entregares os embarcados, simular_carregamento(). Se contares como embarcado quem foi recusado ou quem aparece numa linha estragada, a mala fica a bordo sem o dono e o voo atrasa 5 minutos por mala.",
    "criteria": "ler_leituras é testada diretamente com ficheiros de teste: linhas certas, recusados, linhas com campos a menos, horas estragadas e um ficheiro que não existe. guardar_faltas é testada com um ficheiro temporário. Avaliado em três manhãs com o percurso completo: a placa recebe os embarcados certos, só saem dos porões as malas de quem não embarcou, os quatro voos partem à hora e o ficheiro de faltas está correto.",
    "code": "import csv\nimport json\n\n\ndef ler_leituras(caminho):\n    embarcados = {}                     # voo -> conjunto de reservas que embarcaram\n    rejeitadas = 0\n    with open(caminho, encoding=\"utf-8\", newline=\"\") as ficheiro:\n        linhas = list(csv.reader(ficheiro))\n    for campos in linhas[1:]:           # a primeira linha é o cabeçalho\n        voo, reserva, hora, resultado = campos\n        # 1.º protege a linha de cima e a conversão da hora com try/except ValueError\n        # 2.º só conta quem tem resultado \"embarcou\"\n        embarcados.setdefault(voo, set()).add(reserva)\n    return embarcados, rejeitadas\n\n\ndef guardar_faltas(caminho, cartoes, embarcados):\n    faltas = {}                         # voo -> lista ordenada das reservas que faltaram\n    # percorre os cartões e grava o dicionário com json.dump\n    return faltas\n\n\nsimular_checkin()\nsimular_triagem()\nsimular_embarque()\n\nembarcados, rejeitadas = ler_leituras(FICHEIRO_LEITURAS)\nprint(\"linhas rejeitadas:\", rejeitadas)\nentregar_embarcados(embarcados)\nfaltas = guardar_faltas(FICHEIRO_FALTAS, consultar_cartoes(), embarcados)\n\nresumo = simular_carregamento()\nprint(resumo[\"malas\"])\nfor voo, dados in resumo[\"voos\"].items():\n    print(voo, dados[\"estado\"], \"atraso:\", dados[\"atraso\"])\nfor o in ocorrencias():\n    print(o[\"minuto\"], o[\"texto\"])\n",
    "number": 34
  },
  {
    "id": "report_lists",
    "title": "Relatório do dia: compreensões de listas",
    "description": "Bloco 4 · Relatório do dia · Centro de operações. A manhã acabou e a direção quer o relatório. simular_dia() corre a manhã inteira com os programas de fábrica (check-in, triagem, embarque e carregamento) e consultar_dia() devolve um dicionário com três tabelas, cada uma uma lista de dicionários: voos (voo, destino, hora, porta, lugar, partida, atraso em minutos, reservas, aceites, embarcados, faltas, malas, carregadas, retiradas, em_terra e peso), passageiros (reserva, nome, voo, estado, motivo, espera, seguranca e malas; o estado é embarcou, faltou ou recusado) e malas (etiqueta, voo, reserva, peso, estado e porao; o estado é carregada, retirada ou em_terra). Hoje houve dois balcões fechados e o leitor de reconciliação falhou em alguns lugares, por isso há voos atrasados. Uma compreensão de lista cria uma lista nova numa só expressão: [v[\"voo\"] for v in voos if v[\"atraso\"] > 0] percorre os voos, fica com os que cumprem a condição e guarda só o código. Uma compreensão de dicionário faz o mesmo com pares chave: valor, por exemplo {v[\"voo\"]: v[\"atraso\"] for v in voos}. Escreve quatro funções, sem ciclos for nem while: voos_atrasados(voos) devolve a lista dos códigos dos voos com atraso maior que 0; pontualidade(voos) devolve a percentagem de voos com atraso 0, arredondada às unidades com round, e 0 se a lista estiver vazia; faltas_por_voo(voos, passageiros) devolve {voo: número de passageiros desse voo com estado faltou}, com uma chave por cada voo da tabela, mesmo que não tenha faltas; peso_por_voo(voos, malas) devolve {voo: soma dos pesos das malas desse voo com estado carregada, arredondada a uma casa decimal}. Dentro do valor de uma compreensão de dicionário podes usar len([...]) ou sum(... for ...). As chaves vêm sempre da tabela dos voos: na dos passageiros há reservas para voos que não existem. Junta os quatro valores num dicionário com as chaves pontualidade, atrasados, faltas e peso e entrega-o com entregar_relatorio(relatorio), que devolve, para cada indicador, True se confere com os dados do dia. O centro de operações mostra o relatório na parede de ecrãs.",
    "criteria": "As quatro funções são testadas diretamente com tabelas pequenas (voos sem passageiros, passageiros recusados, malas retiradas e listas vazias) e não podem ter ciclos for nem while. Avaliado em três dias diferentes: o relatório entregue tem de conferir com os dados do dia nos quatro indicadores.",
    "code": "\ndef voos_atrasados(voos):\n    # compreensão de lista com filtro: [expressão for elemento in lista if condição]\n    return [v[\"voo\"] for v in voos]\n\n\ndef pontualidade(voos):\n    # percentagem, arredondada com round, dos voos com atraso 0; devolve 0 se não houver voos\n    return 0\n\n\ndef faltas_por_voo(voos, passageiros):\n    # compreensão de dicionário: {chave: valor for elemento in lista}\n    return {v[\"voo\"]: 0 for v in voos}\n\n\ndef peso_por_voo(voos, malas):\n    return {v[\"voo\"]: 0 for v in voos}\n\n\nprint(simular_dia())\ndia = consultar_dia()\nvoos, passageiros, malas = dia[\"voos\"], dia[\"passageiros\"], dia[\"malas\"]\nprint(voos[0])\nprint(passageiros[0])\nprint(malas[0])\n\nrelatorio = {\n    \"pontualidade\": pontualidade(voos),\n    \"atrasados\": voos_atrasados(voos),\n    \"faltas\": faltas_por_voo(voos, passageiros),\n    \"peso\": peso_por_voo(voos, malas),\n}\nfor nome, valor in relatorio.items():\n    print(nome, valor)\nprint(entregar_relatorio(relatorio))\n",
    "number": 35
  },
  {
    "id": "report_modules",
    "title": "Relatório do dia: organizar em módulos",
    "description": "Bloco 4 · Relatório do dia · Centro de operações. O programa cresceu: as contas dos indicadores e o programa que as usa estão no mesmo ficheiro. Um módulo é um ficheiro .py com funções que outros programas importam. Cria o separador indicadores.py com o botão + ao lado de chegada.py e passa para lá as quatro funções do nível anterior. No programa principal ficam só a recolha dos dados, a montagem do relatório e a entrega. Há duas formas de usar o módulo: import indicadores, e depois indicadores.pontualidade(voos); ou from indicadores import pontualidade, e depois pontualidade(voos). As funções do jogo (consultar_dia, entregar_relatorio e as outras) só existem no programa principal: um módulo não as pode chamar, recebe os dados pelos parâmetros. É isso que o torna fácil de reutilizar e de testar. Acrescenta ao módulo duas funções novas, também com compreensões. taxa_embarque(passageiros) devolve a percentagem, com uma casa decimal, dos passageiros aceites no check-in (estado diferente de recusado) que embarcaram; devolve 0.0 se não houver aceites. maiores_esperas(passageiros, n=5) devolve uma lista com os n pares (nome, espera) com mais minutos de espera no check-in, da maior para a menor; nos empates, por ordem alfabética do nome; ficam de fora os passageiros com espera None. Ordena com sorted e uma chave que devolve um tuplo: key=lambda p: (-p[\"espera\"], p[\"nome\"]). Podes guardar o 5 numa constante do módulo, por exemplo MAIORES_ESPERAS = 5. O relatório passa a ter seis indicadores: pontualidade, atrasados, taxa_embarque, faltas, peso e esperas.",
    "criteria": "O programa principal importa indicadores e não define lá as funções. As seis funções do módulo são testadas diretamente, incluindo empates nas esperas, o valor de n, esperas None e listas vazias, e continuam sem ciclos for nem while. Avaliado em três dias diferentes: os seis indicadores do relatório têm de conferir com os dados do dia.",
    "code": "\n# Cria o separador indicadores.py (botão + ao lado de chegada.py) e passa para lá as funções.\nimport indicadores\n\nprint(simular_dia())\ndia = consultar_dia()\nvoos, passageiros, malas = dia[\"voos\"], dia[\"passageiros\"], dia[\"malas\"]\n\nrelatorio = {\n    \"pontualidade\": indicadores.pontualidade(voos),\n    \"atrasados\": indicadores.voos_atrasados(voos),\n    \"taxa_embarque\": indicadores.taxa_embarque(passageiros),\n    \"faltas\": indicadores.faltas_por_voo(voos, passageiros),\n    \"peso\": indicadores.peso_por_voo(voos, malas),\n    \"esperas\": indicadores.maiores_esperas(passageiros),\n}\nfor nome, valor in relatorio.items():\n    print(nome, valor)\nprint(entregar_relatorio(relatorio))\n",
    "number": 36
  },
  {
    "id": "report_tests",
    "title": "Relatório do dia: testes simples",
    "description": "Bloco 4 · Relatório do dia · Centro de operações. Como sabes que os indicadores estão certos antes de o relatório chegar à direção? Com testes: funções pequenas que chamam o teu código com dados feitos à mão, para os quais sabes a resposta, e que confirmam o resultado com assert. A instrução assert condição não faz nada se a condição for verdadeira e levanta AssertionError se for falsa. Um bom teste não se fica pelo caso normal: experimenta os limites, que é onde os erros se escondem. O módulo indicadores.py do nível anterior continua no seu separador. No programa principal já estão três tabelas pequenas, VOOS, PASSAGEIROS e MALAS, e seis testes quase vazios. Completa-os. testar_pontualidade: um caso em que os voos a horas não sejam metade, e a lista vazia. testar_voos_atrasados: uma tabela com voos a horas e atrasados, comparando com a lista dos códigos. testar_faltas_por_voo: a tabela toda, que tem recusados e voos sem faltas. testar_peso_por_voo: a tabela toda, que tem malas retiradas e em terra, e um voo em que o número de malas carregadas seja diferente do peso. testar_taxa_embarque: a tabela toda, que tem recusados, e a lista vazia. testar_maiores_esperas: um n menor do que a lista, e os três passageiros empatados com 9 minutos. Cada teste é avaliado duas vezes: tem de passar com uma função correta e tem de falhar com versões erradas da mesma função (por exemplo, uma que conta os recusados como faltas). Escreve também correr_testes(testes), que recebe uma lista de funções de teste, chama cada uma dentro de try/except AssertionError e devolve a lista dos nomes (teste.__name__) das que falharam. O programa só simula o dia e entrega o relatório se a lista vier vazia.",
    "criteria": "Cada um dos seis testes tem de passar com uma função correta e de apanhar duas ou três versões erradas da função que testa. correr_testes é testada com testes que passam e que falham. Avaliado em três dias diferentes: os seis indicadores do relatório têm de conferir com os dados do dia.",
    "code": "\nimport indicadores\n\n# Dados pequenos, feitos à mão: sabes de cor qual é a resposta certa.\nVOOS = [\n    {\"voo\": \"T1\", \"atraso\": 0},\n    {\"voo\": \"T2\", \"atraso\": 12},\n    {\"voo\": \"T3\", \"atraso\": 0},\n    {\"voo\": \"T4\", \"atraso\": 3},\n]\nPASSAGEIROS = [\n    {\"nome\": \"Rui\", \"voo\": \"T1\", \"estado\": \"embarcou\", \"espera\": 4},\n    {\"nome\": \"Ana\", \"voo\": \"T1\", \"estado\": \"faltou\", \"espera\": 9},\n    {\"nome\": \"Eva\", \"voo\": \"T1\", \"estado\": \"recusado\", \"espera\": 2},\n    {\"nome\": \"Gil\", \"voo\": \"T2\", \"estado\": \"embarcou\", \"espera\": 9},\n    {\"nome\": \"Bia\", \"voo\": \"T2\", \"estado\": \"embarcou\", \"espera\": 9},\n    {\"nome\": \"Ivo\", \"voo\": \"T4\", \"estado\": \"faltou\", \"espera\": 1},\n    {\"nome\": \"Lia\", \"voo\": \"T4\", \"estado\": \"faltou\", \"espera\": 0},\n    {\"nome\": \"Zé\", \"voo\": \"T4\", \"estado\": \"recusado\", \"espera\": None},\n]\nMALAS = [\n    {\"voo\": \"T1\", \"peso\": 10.5, \"estado\": \"carregada\"},\n    {\"voo\": \"T1\", \"peso\": 20.3, \"estado\": \"carregada\"},\n    {\"voo\": \"T1\", \"peso\": 7.0, \"estado\": \"retirada\"},\n    {\"voo\": \"T2\", \"peso\": 15.0, \"estado\": \"em_terra\"},\n    {\"voo\": \"T4\", \"peso\": 8.0, \"estado\": \"carregada\"},\n]\n\n\ndef testar_pontualidade():\n    assert indicadores.pontualidade(VOOS) == 50\n    # junta um caso que não seja metade/metade e o caso da lista vazia\n\n\ndef testar_voos_atrasados():\n    assert indicadores.voos_atrasados([]) == []\n\n\ndef testar_faltas_por_voo():\n    assert indicadores.faltas_por_voo([], PASSAGEIROS) == {}\n\n\ndef testar_peso_por_voo():\n    assert indicadores.peso_por_voo([], MALAS) == {}\n\n\ndef testar_taxa_embarque():\n    assert indicadores.taxa_embarque([]) == 0\n\n\ndef testar_maiores_esperas():\n    assert indicadores.maiores_esperas([], 3) == []\n\n\ndef correr_testes(testes):\n    falhados = []\n    for teste in testes:\n        teste()          # protege com try/except AssertionError e guarda teste.__name__\n    return falhados\n\n\nfalhados = correr_testes([testar_pontualidade, testar_voos_atrasados, testar_faltas_por_voo,\n                          testar_peso_por_voo, testar_taxa_embarque, testar_maiores_esperas])\nif falhados:\n    print(\"Testes falhados:\", falhados)\nelse:\n    print(\"Os seis testes passaram.\")\n    print(simular_dia())\n    dia = consultar_dia()\n    voos, passageiros, malas = dia[\"voos\"], dia[\"passageiros\"], dia[\"malas\"]\n    relatorio = {\n        \"pontualidade\": indicadores.pontualidade(voos),\n        \"atrasados\": indicadores.voos_atrasados(voos),\n        \"taxa_embarque\": indicadores.taxa_embarque(passageiros),\n        \"faltas\": indicadores.faltas_por_voo(voos, passageiros),\n        \"peso\": indicadores.peso_por_voo(voos, malas),\n        \"esperas\": indicadores.maiores_esperas(passageiros),\n    }\n    for nome, valor in relatorio.items():\n        print(nome, valor)\n    print(entregar_relatorio(relatorio))\n",
    "number": 37
  }
];
