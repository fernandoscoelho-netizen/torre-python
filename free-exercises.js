// One source for the interface, the downloadable exercise guide and tests.
// Solutions are complete programs; starters are deliberately unfinished work
// for the student and are loaded only by the «Resolver exercício» button.
export const FREE_EXERCISES = {
    guided: {
        number:1, title:'Autorizar uma chegada', daily:false,
        description:'Usa as funções do jogo para aterrar PY001 e estacionar em P04. A animação começa depois de o programa terminar.',
        concepts:['str','bool','if','print'],
        steps:['Cria as variáveis voo = "PY001" e destino = "P04".','Consulta parqueamento_livre(destino). Se estiver livre, chama aterrar(voo) antes de parquear(voo, destino).','Apresenta uma mensagem de autorização ou de indisponibilidade.'],
        expected:'Com P04 livre, são enviadas duas ações, pela ordem aterrar → parquear. O avião termina a animação em P04. Um lugar ocupado não recebe autorização.',
        starter:'# Autoriza PY001 apenas se P04 estiver livre.\nvoo = "PY001"\ndestino = "P04"\n# Escreve a condição e as duas ações.\n',
        solution:'voo = "PY001"\ndestino = "P04"\n\nif parqueamento_livre(destino):\n    aterrar(voo)\n    parquear(voo, destino)\n    print("Autorização enviada:", voo, "→", destino)\nelse:\n    print("O parqueamento", destino, "está ocupado.")\n'
    },
    author: {
        number:2, title:'Criar a minha função de chegada', daily:false,
        description:'Define autorizar_chegada(voo, destino). A função é tua; as consultas e ações chamadas no seu corpo são fornecidas pelo jogo.',
        concepts:['def','parâmetros','if','return'],
        steps:['Define autorizar_chegada(voo, destino).','Se o lugar estiver livre, envia as duas ações e devolve True; caso contrário, devolve False.','Chama a tua função com "PY001" e "P04" e apresenta o resultado. Nesta missão manual, usa apenas esta rota.'],
        expected:'A chamada devolve True e envia as ações se P04 estiver livre. Se estiver ocupado, devolve False sem enviar ações. A função deve ser chamada para produzir efeitos.',
        starter:'def autorizar_chegada(voo, destino):\n    # Consulta o lugar, envia as ações e devolve um bool.\n    pass\n\nprint("Autorizado:", autorizar_chegada("PY001", "P04"))\n',
        solution:'def autorizar_chegada(voo, destino):\n    if parqueamento_livre(destino):\n        aterrar(voo)\n        parquear(voo, destino)\n        return True\n    return False\n\n\nautorizado = autorizar_chegada("PY001", "P04")\nprint("Autorizado:", autorizado)\n'
    },
    day_types: {
        number:3, title:'Constantes, variáveis e tipos', daily:true,
        description:'Identifica int, str, float e bool nos dados do aeroporto. Em Python, uma constante em MAIÚSCULAS é uma convenção, não uma variável imutável.',
        concepts:['int','str','float','bool'],
        steps:['Guarda MAX_VOOS em LIMITE e seleciona o primeiro registo de voos.','Cria codigo, passageiros, ocupacao e pista_disponivel. Usa capacidade 250 para obter uma ocupação decimal.','Apresenta os valores e os respetivos tipos com print() e type().'],
        expected:'LIMITE e passageiros são int; codigo é str; ocupacao é float; pista_disponivel é bool. A ocupação é uma fração: por exemplo, 80/250 = 0.32.',
        starter:'LIMITE = MAX_VOOS\nprimeiro = voos[0]\n# Cria as quatro variáveis e apresenta os valores e tipos.\n',
        solution:'# Constante por convenção: o valor continua a poder ser reatribuído.\nLIMITE = MAX_VOOS\nprimeiro = voos[0]\ncodigo = primeiro["codigo"]\npassageiros = primeiro["passageiros"]\nocupacao = passageiros / 250\npista_disponivel = pista_livre()\n\nprint("LIMITE:", LIMITE, type(LIMITE))\nprint("codigo:", codigo, type(codigo))\nprint("passageiros:", passageiros, type(passageiros))\nprint("ocupacao:", ocupacao, type(ocupacao))\nprint("pista_disponivel:", pista_disponivel, type(pista_disponivel))\n'
    },
    day_math: {
        number:4, title:'Contas na operação diária', daily:true,
        description:'Calcula ocupação, total e média de passageiros por movimento. O total soma os registos da agenda; não representa pessoas únicas.',
        concepts:['+','/','*','round'],
        steps:['Define CAPACIDADE = 250 e calcula a percentagem de ocupação do primeiro voo.','Percorre voos e acumula os passageiros em total_passageiros.','Calcula a média por movimento e apresenta percentagem e média arredondadas a duas casas decimais.'],
        expected:'percentagem = passageiros / 250 * 100. O total corresponde à soma dos passageiros de todos os movimentos; a média corresponde ao total dividido por len(voos).',
        starter:'CAPACIDADE = 250\npassageiros = voos[0]["passageiros"]\ntotal_passageiros = 0\n# Calcula a percentagem, o total e a média.\n',
        solution:'CAPACIDADE = 250\npassageiros = voos[0]["passageiros"]\npercentagem = passageiros / CAPACIDADE * 100\n\ntotal_passageiros = 0\nfor voo in voos:\n    total_passageiros += voo["passageiros"]\n\nmedia = total_passageiros / len(voos)\nprint("Ocupação do primeiro voo (%):", round(percentagem, 2))\nprint("Total nos movimentos:", total_passageiros)\nprint("Média por movimento:", round(media, 2))\n'
    },
    day_lists: {
        number:5, title:'Listas, tuplos e ciclos', daily:true,
        description:'Usa um tuplo para os tipos de movimento e uma lista para os códigos das partidas. O ciclo for percorre os registos pela ordem recebida.',
        concepts:['tuple','list','for','append'],
        steps:['Cria tipos = ("chegada", "partida") e uma lista codigos vazia.','Percorre voos; quando tipo for "partida", acrescenta o código com append().','Apresenta o tuplo, a lista e o número de partidas.'],
        expected:'A lista contém apenas códigos de partidas, pela ordem original. A quantidade depende do número de voos escolhido no painel. Sem partidas, o resultado é [].',
        starter:'tipos = ("chegada", "partida")\ncodigos = []\n# Percorre voos e acrescenta os códigos de partida.\nprint(codigos)\n',
        solution:'tipos = ("chegada", "partida")\ncodigos = []\n\nfor voo in voos:\n    if voo["tipo"] == tipos[1]:\n        codigos.append(voo["codigo"])\n\nprint("Tipos de movimento:", tipos)\nprint("Códigos das partidas:", codigos)\nprint("Número de partidas:", len(codigos))\n'
    },
    day_matrix: {
        number:6, title:'Matriz de horários', daily:true,
        description:'Representa uma matriz através de uma lista de listas. Cada linha contém hora em minutos, código do voo e passageiros.',
        concepts:['listas de listas','índices','for','slicing'],
        steps:['Cria uma lista matriz vazia.','Acrescenta uma linha [hora, codigo, passageiros] por voo, mantendo a ordem da agenda.','Mostra as primeiras cinco linhas e o número total de linhas.'],
        expected:'A matriz tem len(voos) linhas e três campos por linha. A hora mantém-se em minutos desde a meia-noite: 365 corresponde a 06:05.',
        starter:'matriz = []\n# Constrói as linhas com os três campos pedidos.\nprint(matriz[:5])\n',
        solution:'matriz = []\nfor voo in voos:\n    linha = [voo["hora"], voo["codigo"], voo["passageiros"]]\n    matriz.append(linha)\n\nprint("Primeiras cinco linhas:")\nfor linha in matriz[:5]:\n    print(linha)\nprint("Número de linhas:", len(matriz))\n'
    },
    day_query: {
        number:7, title:'Consulta para passageiros', daily:true,
        description:'Escreve a tua função contar_destino(agenda, cidade), usando dicionários, um contador e uma comparação sem distinguir maiúsculas de minúsculas.',
        concepts:['def','dict','for','casefold','return'],
        steps:['Define contar_destino(agenda, cidade) e inicializa um contador.','Conta apenas os registos com tipo "partida" e destino igual à cidade pedida, comparando com casefold().','Consulta Lisboa e LISBOA. Confere o resultado com len(voos_para("Lisboa")), função fornecida pelo jogo.'],
        expected:'Lisboa e LISBOA produzem a mesma contagem. A função usa a agenda recebida e devolve 0 quando não existem partidas para a cidade. O resultado deve coincidir com a consulta fornecida pelo jogo.',
        starter:'def contar_destino(agenda, cidade):\n    # Percorre a agenda recebida e devolve a contagem.\n    pass\n\nprint(contar_destino(voos, "Lisboa"))\n',
        solution:'def contar_destino(agenda, cidade):\n    total = 0\n    for voo in agenda:\n        if voo["tipo"] == "partida" and voo["destino"].casefold() == cidade.casefold():\n            total += 1\n    return total\n\n\nprint("Partidas para Lisboa:", contar_destino(voos, "Lisboa"))\nprint("Partidas para LISBOA:", contar_destino(voos, "LISBOA"))\nprint("Conferência do jogo:", len(voos_para("Lisboa")))\n'
    },
    day_runway: {
        number:8, title:'Disponibilidade e reserva da pista', daily:true,
        description:'Com o dia em pausa, tenta reservar três minutos a partir das 10:00 ou da hora atual, se já for mais tarde. Usa if/elif/else para tratar os três resultados possíveis.',
        concepts:['int','max','if/elif/else','funções do jogo'],
        steps:['Calcula inicio = max(600, hora_atual()) e fim = inicio + 3; 600 minutos correspondem a 10:00.','Se fim ultrapassar 1440, informa que já não cabem três minutos no dia. Caso contrário, consulta pista_livre(inicio, fim).','Se estiver livre, chama reservar_pista(inicio, fim, "aterrar"); se estiver ocupada, apresenta uma mensagem e não envia a reserva.'],
        expected:'Um intervalo livre gera uma reserva no painel e pode atrasar movimentos previstos. Uma reserva sobreposta é recusada pela condição. No final do dia, o programa informa que não há tempo suficiente, sem provocar uma exceção.',
        starter:'inicio = max(600, hora_atual())\nfim = inicio + 3\n# Trata o fim do dia, a disponibilidade e a indisponibilidade.\n',
        solution:'inicio = max(600, hora_atual())\nfim = inicio + 3\n\nif fim > 1440:\n    print("Já não cabem três minutos no dia simulado.")\nelif pista_livre(inicio, fim):\n    reservar_pista(inicio, fim, "aterrar")\n    print("Reserva enviada, em minutos:", inicio, "até", fim)\nelse:\n    print("Pista indisponível neste intervalo. Escolhe outro horário.")\n'
    },
    day_while: {
        number:9, title:'Repetição com while', daily:true,
        description:'Percorre os próximos cinco minutos com um ciclo while finito. Este exercício calcula e apresenta minutos; não avança o relógio da simulação.',
        concepts:['while','<','+=','min'],
        steps:['Guarda a hora atual em minuto e calcula fim = min(minuto + 5, 1440).','Enquanto minuto < fim, apresenta o minuto e incrementa-o em 1.','No fim, apresenta uma mensagem de conclusão. Testa também às 23:59.'],
        expected:'Às 06:00 são apresentados 360, 361, 362, 363 e 364. Às 23:59 é apresentado apenas 1439. O limite final não é incluído e o relógio do painel mantém-se na hora escolhida.',
        starter:'minuto = hora_atual()\nfim = min(minuto + 5, 1440)\n# Escreve o while e lembra-te do incremento.\n',
        solution:'minuto = hora_atual()\nfim = min(minuto + 5, 1440)\n\nwhile minuto < fim:\n    print(minuto)\n    minuto += 1\n\nprint("Intervalo concluído; o relógio da simulação não foi alterado.")\n'
    }
};
