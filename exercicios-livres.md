# Torre Python — nove exercícios livres

Cada exercício inclui objetivo, tarefas, resultado esperado e solução completa. No jogo, abre **Exercícios livres**, escolhe o exercício e usa **Resolver exercício** para escrever a tua resolução ou **Ver solução** para carregar o exemplo completo. **Ctrl+Z** recupera o código anterior. Os rascunhos são guardados por exercício neste navegador.

Estes programas usam os dados e as funções fornecidos pelo jogo. Executa-os no editor do aeroporto. A prática livre não atribui classificação automática; o percurso Níveis mantém as dez atividades avaliadas.

## 1. Autorizar uma chegada

Usa as funções do jogo para aterrar PY001 e estacionar em P04. A animação começa depois de o programa terminar.

**Conceitos:** `str`, `bool`, `if`, `print`.

1. Cria as variáveis voo = "PY001" e destino = "P04".
2. Consulta parqueamento_livre(destino). Se estiver livre, chama aterrar(voo) antes de parquear(voo, destino).
3. Apresenta uma mensagem de autorização ou de indisponibilidade.

**Resultado esperado:** Com P04 livre, são enviadas duas ações, pela ordem aterrar → parquear. O avião termina a animação em P04. Um lugar ocupado não recebe autorização.

**Código inicial para o aluno**

```python
# Autoriza PY001 apenas se P04 estiver livre.
voo = "PY001"
destino = "P04"
# Escreve a condição e as duas ações.
```

**Solução completa**

```python
voo = "PY001"
destino = "P04"

if parqueamento_livre(destino):
    aterrar(voo)
    parquear(voo, destino)
    print("Autorização enviada:", voo, "→", destino)
else:
    print("O parqueamento", destino, "está ocupado.")
```

## 2. Criar a minha função de chegada

Define autorizar_chegada(voo, destino). A função é tua; as consultas e ações chamadas no seu corpo são fornecidas pelo jogo.

**Conceitos:** `def`, `parâmetros`, `if`, `return`.

1. Define autorizar_chegada(voo, destino).
2. Se o lugar estiver livre, envia as duas ações e devolve True; caso contrário, devolve False.
3. Chama a tua função com "PY001" e "P04" e apresenta o resultado. Nesta missão manual, usa apenas esta rota.

**Resultado esperado:** A chamada devolve True e envia as ações se P04 estiver livre. Se estiver ocupado, devolve False sem enviar ações. A função deve ser chamada para produzir efeitos.

**Código inicial para o aluno**

```python
def autorizar_chegada(voo, destino):
    # Consulta o lugar, envia as ações e devolve um bool.
    pass

print("Autorizado:", autorizar_chegada("PY001", "P04"))
```

**Solução completa**

```python
def autorizar_chegada(voo, destino):
    if parqueamento_livre(destino):
        aterrar(voo)
        parquear(voo, destino)
        return True
    return False


autorizado = autorizar_chegada("PY001", "P04")
print("Autorizado:", autorizado)
```

## 3. Constantes, variáveis e tipos

Identifica int, str, float e bool nos dados do aeroporto. Em Python, uma constante em MAIÚSCULAS é uma convenção, não uma variável imutável.

**Conceitos:** `int`, `str`, `float`, `bool`.

1. Guarda MAX_VOOS em LIMITE e seleciona o primeiro registo de voos.
2. Cria codigo, passageiros, ocupacao e pista_disponivel. Usa capacidade 250 para obter uma ocupação decimal.
3. Apresenta os valores e os respetivos tipos com print() e type().

**Resultado esperado:** LIMITE e passageiros são int; codigo é str; ocupacao é float; pista_disponivel é bool. A ocupação é uma fração: por exemplo, 80/250 = 0.32.

**Código inicial para o aluno**

```python
LIMITE = MAX_VOOS
primeiro = voos[0]
# Cria as quatro variáveis e apresenta os valores e tipos.
```

**Solução completa**

```python
# Constante por convenção: o valor continua a poder ser reatribuído.
LIMITE = MAX_VOOS
primeiro = voos[0]
codigo = primeiro["codigo"]
passageiros = primeiro["passageiros"]
ocupacao = passageiros / 250
pista_disponivel = pista_livre()

print("LIMITE:", LIMITE, type(LIMITE))
print("codigo:", codigo, type(codigo))
print("passageiros:", passageiros, type(passageiros))
print("ocupacao:", ocupacao, type(ocupacao))
print("pista_disponivel:", pista_disponivel, type(pista_disponivel))
```

## 4. Contas na operação diária

Calcula ocupação, total e média de passageiros por movimento. O total soma os registos da agenda; não representa pessoas únicas.

**Conceitos:** `+`, `/`, `*`, `round`.

1. Define CAPACIDADE = 250 e calcula a percentagem de ocupação do primeiro voo.
2. Percorre voos e acumula os passageiros em total_passageiros.
3. Calcula a média por movimento e apresenta percentagem e média arredondadas a duas casas decimais.

**Resultado esperado:** percentagem = passageiros / 250 * 100. O total corresponde à soma dos passageiros de todos os movimentos; a média corresponde ao total dividido por len(voos).

**Código inicial para o aluno**

```python
CAPACIDADE = 250
passageiros = voos[0]["passageiros"]
total_passageiros = 0
# Calcula a percentagem, o total e a média.
```

**Solução completa**

```python
CAPACIDADE = 250
passageiros = voos[0]["passageiros"]
percentagem = passageiros / CAPACIDADE * 100

total_passageiros = 0
for voo in voos:
    total_passageiros += voo["passageiros"]

media = total_passageiros / len(voos)
print("Ocupação do primeiro voo (%):", round(percentagem, 2))
print("Total nos movimentos:", total_passageiros)
print("Média por movimento:", round(media, 2))
```

## 5. Listas, tuplos e ciclos

Usa um tuplo para os tipos de movimento e uma lista para os códigos das partidas. O ciclo for percorre os registos pela ordem recebida.

**Conceitos:** `tuple`, `list`, `for`, `append`.

1. Cria tipos = ("chegada", "partida") e uma lista codigos vazia.
2. Percorre voos; quando tipo for "partida", acrescenta o código com append().
3. Apresenta o tuplo, a lista e o número de partidas.

**Resultado esperado:** A lista contém apenas códigos de partidas, pela ordem original. A quantidade depende do número de voos escolhido no painel. Sem partidas, o resultado é [].

**Código inicial para o aluno**

```python
tipos = ("chegada", "partida")
codigos = []
# Percorre voos e acrescenta os códigos de partida.
print(codigos)
```

**Solução completa**

```python
tipos = ("chegada", "partida")
codigos = []

for voo in voos:
    if voo["tipo"] == tipos[1]:
        codigos.append(voo["codigo"])

print("Tipos de movimento:", tipos)
print("Códigos das partidas:", codigos)
print("Número de partidas:", len(codigos))
```

## 6. Matriz de horários

Representa uma matriz através de uma lista de listas. Cada linha contém hora em minutos, código do voo e passageiros.

**Conceitos:** `listas de listas`, `índices`, `for`, `slicing`.

1. Cria uma lista matriz vazia.
2. Acrescenta uma linha [hora, codigo, passageiros] por voo, mantendo a ordem da agenda.
3. Mostra as primeiras cinco linhas e o número total de linhas.

**Resultado esperado:** A matriz tem len(voos) linhas e três campos por linha. A hora mantém-se em minutos desde a meia-noite: 365 corresponde a 06:05.

**Código inicial para o aluno**

```python
matriz = []
# Constrói as linhas com os três campos pedidos.
print(matriz[:5])
```

**Solução completa**

```python
matriz = []
for voo in voos:
    linha = [voo["hora"], voo["codigo"], voo["passageiros"]]
    matriz.append(linha)

print("Primeiras cinco linhas:")
for linha in matriz[:5]:
    print(linha)
print("Número de linhas:", len(matriz))
```

## 7. Consulta para passageiros

Escreve a tua função contar_destino(agenda, cidade), usando dicionários, um contador e uma comparação sem distinguir maiúsculas de minúsculas.

**Conceitos:** `def`, `dict`, `for`, `casefold`, `return`.

1. Define contar_destino(agenda, cidade) e inicializa um contador.
2. Conta apenas os registos com tipo "partida" e destino igual à cidade pedida, comparando com casefold().
3. Consulta Lisboa e LISBOA. Confere o resultado com len(voos_para("Lisboa")), função fornecida pelo jogo.

**Resultado esperado:** Lisboa e LISBOA produzem a mesma contagem. A função usa a agenda recebida e devolve 0 quando não existem partidas para a cidade. O resultado deve coincidir com a consulta fornecida pelo jogo.

**Código inicial para o aluno**

```python
def contar_destino(agenda, cidade):
    # Percorre a agenda recebida e devolve a contagem.
    pass

print(contar_destino(voos, "Lisboa"))
```

**Solução completa**

```python
def contar_destino(agenda, cidade):
    total = 0
    for voo in agenda:
        if voo["tipo"] == "partida" and voo["destino"].casefold() == cidade.casefold():
            total += 1
    return total


print("Partidas para Lisboa:", contar_destino(voos, "Lisboa"))
print("Partidas para LISBOA:", contar_destino(voos, "LISBOA"))
print("Conferência do jogo:", len(voos_para("Lisboa")))
```

## 8. Disponibilidade e reserva da pista

Com o dia em pausa, tenta reservar três minutos a partir das 10:00 ou da hora atual, se já for mais tarde. Usa if/elif/else para tratar os três resultados possíveis.

**Conceitos:** `int`, `max`, `if/elif/else`, `funções do jogo`.

1. Calcula inicio = max(600, hora_atual()) e fim = inicio + 3; 600 minutos correspondem a 10:00.
2. Se fim ultrapassar 1440, informa que já não cabem três minutos no dia. Caso contrário, consulta pista_livre(inicio, fim).
3. Se estiver livre, chama reservar_pista(inicio, fim, "aterrar"); se estiver ocupada, apresenta uma mensagem e não envia a reserva.

**Resultado esperado:** Um intervalo livre gera uma reserva no painel e pode atrasar movimentos previstos. Uma reserva sobreposta é recusada pela condição. No final do dia, o programa informa que não há tempo suficiente, sem provocar uma exceção.

**Código inicial para o aluno**

```python
inicio = max(600, hora_atual())
fim = inicio + 3
# Trata o fim do dia, a disponibilidade e a indisponibilidade.
```

**Solução completa**

```python
inicio = max(600, hora_atual())
fim = inicio + 3

if fim > 1440:
    print("Já não cabem três minutos no dia simulado.")
elif pista_livre(inicio, fim):
    reservar_pista(inicio, fim, "aterrar")
    print("Reserva enviada, em minutos:", inicio, "até", fim)
else:
    print("Pista indisponível neste intervalo. Escolhe outro horário.")
```

## 9. Repetição com while

Percorre os próximos cinco minutos com um ciclo while finito. Este exercício calcula e apresenta minutos; não avança o relógio da simulação.

**Conceitos:** `while`, `<`, `+=`, `min`.

1. Guarda a hora atual em minuto e calcula fim = min(minuto + 5, 1440).
2. Enquanto minuto < fim, apresenta o minuto e incrementa-o em 1.
3. No fim, apresenta uma mensagem de conclusão. Testa também às 23:59.

**Resultado esperado:** Às 06:00 são apresentados 360, 361, 362, 363 e 364. Às 23:59 é apresentado apenas 1439. O limite final não é incluído e o relógio do painel mantém-se na hora escolhida.

**Código inicial para o aluno**

```python
minuto = hora_atual()
fim = min(minuto + 5, 1440)
# Escreve o while e lembra-te do incremento.
```

**Solução completa**

```python
minuto = hora_atual()
fim = min(minuto + 5, 1440)

while minuto < fim:
    print(minuto)
    minuto += 1

print("Intervalo concluído; o relógio da simulação não foi alterado.")
```

