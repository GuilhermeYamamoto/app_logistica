# FastAPI Odoo

Aplicacao web em FastAPI que autentica usuarios no Odoo por XML-RPC, mantem
uma sessao no servidor e disponibiliza uma tela inicial para consultar modelos
do Odoo.

## Funcionalidades

- Login no banco Odoo por XML-RPC.
- Sessao protegida por cookie `HttpOnly`.
- Pagina inicial com os modulos Vendas, Compras, Inventario, Produtos e
  Contatos.
- Consulta dos registros recentes de cada modelo.
- Etapas de Inventario com templates independentes e registros filtrados por
  tipo de operacao.
- Logout que encerra a sessao no navegador e no servidor.

## Tecnologias

- Python 3.14+
- FastAPI
- Jinja2
- XML-RPC nativo do Python (`xmlrpc.client`)
- `uv` para dependencias e execucao

## Estrutura do projeto

```text
fast_api_odoo/
├── pyproject.toml
├── README.md
└── src/
    └── fast_api_odoo/
        ├── main.py
        ├── frontend/
        │   ├── static/
        │   │   ├── css/
        │   │   └── js/
        │   └── templates/
        ├── odoo/
        │   ├── rpc.py
        │   └── session.py
        └── routers/
            ├── inicio.py
            ├── inventario.py
            ├── login.py
            └── modelos.py
```

## Como executar

Na raiz do projeto:

```bash
uv sync
uv run fastapi dev src/fast_api_odoo/main.py
```

Abra `http://127.0.0.1:8000`. A rota raiz redireciona para `/inicio`; sem uma
sessao valida, o usuario e redirecionado para `/login`.

## Fluxo de autenticacao

### 1. Envio do formulario

O formulario em `frontend/templates/login.html` chama o JavaScript de
`frontend/static/js/login.js`.

Ao clicar em **Entrar**, o JavaScript envia uma requisicao:

```http
POST /login
Content-Type: application/json
```

```json
{
  "username": "usuario@empresa.com",
  "password": "senha"
}
```

### 2. Autenticacao no Odoo

A rota `POST /login`, em `routers/login.py`, instancia `OdooRPC` e chama:

```py
uid = client.authenticate(
    db=ODOO_DB,
    username=data.username,
    password=data.password,
)
```

O metodo `authenticate()` em `odoo/rpc.py` chama o endpoint XML-RPC:

```text
https://trn-serp.indufix.com.br/xmlrpc/2/common
```

O Odoo responde com o `uid` do usuario quando as credenciais sao validas. Se
nao forem, a aplicacao levanta `AuthenticationError`.

### 3. Criacao da sessao

Depois de um login valido, o backend cria `OdooCredentials`, contendo:

- banco Odoo;
- usuario;
- senha;
- `uid`.

Esses dados sao armazenados no `OdooSessionStore`, em
`odoo/session.py`. Em seguida, o backend gera um token aleatorio e o envia no
cookie `odoo_session`.

O navegador recebe apenas o token; a senha permanece no servidor.

Exemplo de resposta de sucesso:

```json
{
  "success": true,
  "message": "Login realizado com sucesso.",
  "redirect": "/inicio"
}
```

O frontend usa `redirect` para navegar ate a pagina inicial.

### 4. Falhas de login e conectividade

Credenciais invalidas retornam HTTP `401`:

```json
{
  "success": false,
  "message": "Usuário ou senha inválidos."
}
```

Quando nao e possivel conectar ao Odoo, a aplicacao retorna HTTP `502`, sem
expor detalhes internos da conexao.

## Sessao e novas chamadas XML-RPC

`odoo/session.py` concentra o controle de sessoes.

```py
credentials = get_odoo_credentials(request)
client = get_odoo_client(request)
```

`get_odoo_client()`:

1. le o cookie `odoo_session` da requisicao;
2. busca as credenciais associadas ao token no servidor;
3. cria uma nova instancia de `OdooRPC`;
4. configura `db`, `uid` e `password` com `set_authenticated_session()`;
5. devolve o cliente pronto para executar chamadas XML-RPC.

Assim, cada requisicao usa as credenciais da propria sessao, sem compartilhar
estado de autenticacao entre usuarios.

## Pagina inicial e modelos

`routers/inicio.py` define os modulos exibidos em `/inicio`:

| Modulo | Modelo Odoo | Descricao |
| --- | --- | --- |
| Vendas | `sale.order` | Pedidos e cotacoes |
| Compras | `purchase.order` | Pedidos a fornecedores |
| Inventario | `stock.picking` | Etapas e transferencias de estoque |
| Produtos | `product.template` | Catalogo de produtos |
| Contatos | `res.partner` | Clientes e fornecedores |

Cada cartao aponta para `/modelos/{model}`, exceto Inventario, que aponta para
`/inventario` e apresenta as etapas antes da listagem de registros. A pagina
dos demais modelos usa
`frontend/static/js/modelo.js` para buscar os registros por API.

A consulta e realizada por:

```http
GET /api/modelos/{model}
```

Internamente, a aplicacao executa:

```py
client.execute(
    model,
    "search_read",
    [],
    fields=["display_name"],
    limit=30,
)
```

O resultado retorna no maximo 30 registros, exibindo inicialmente apenas o
nome de cada um.

Somente os modelos presentes na lista de modulos sao aceitos. Uma URL com um
modelo nao cadastrado retorna HTTP `404`.

## Etapas de Inventario

A rota `/inventario` exibe as etapas configuradas em
`routers/inventario.py`:

| Etapa | Chave na URL |
| --- | --- |
| Recebimento Fiscal | `recebimento-fiscal` |
| Recebimento Qualidade | `recebimento-qualidade` |
| Estoque Transitorio | `estoque-transitorio` |
| Pre-Separacao | `pre-separacao` |
| Separacao | `separacao` |
| Empacotamento | `empacotamento` |
| Conferencia Expedicao | `conferencia-expedicao` |
| Faturamento | `faturamento` |
| Entrega | `entrega` |

Ao clicar em uma etapa, o usuario acessa:

```text
/inventario/etapas/{chave-da-etapa}
```

A API busca primeiro o tipo de operacao com o nome configurado na etapa:

```py
client.execute(
    "stock.picking.type",
    "search_read",
    [("name", "=", stage["name"])],
    fields=["id"],
    limit=1,
)
```

Em seguida, consulta apenas transferencias (`stock.picking`) daquele tipo,
desconsiderando registros concluidos ou cancelados:

```py
client.execute(
    "stock.picking",
    "search_read",
    [
        ("picking_type_id", "=", picking_type_id),
        ("state", "not in", ["done", "cancel"]),
    ],
    fields=["name", "origin", "state", "partner_id", "scheduled_date"],
    limit=30,
    order="scheduled_date asc",
)
```

### Template especifico por etapa

Cada item de `INVENTORY_STAGES` possui o campo `template`. A rota da etapa
usa esse campo para decidir qual arquivo HTML renderizar.

Por exemplo, **Recebimento Qualidade** usa `inventario3.html`:

```py
{
    "key": "recebimento-qualidade",
    "name": "Recebimento Qualidade",
    "template": "inventario3.html",
}
```

Portanto, o cartao dessa etapa abre:

```text
/inventario/etapas/recebimento-qualidade
```

e a rota renderiza `frontend/templates/inventario3.html`.

As outras etapas usam provisoriamente `inventario_etapa.html`. Para atribuir
um template proprio a uma delas, crie o HTML em `frontend/templates/` e altere
somente o valor de `template`:

```py
{
    "key": "separacao",
    "name": "Separação",
    "template": "separacao.html",
}
```

## Rotas

| Metodo | Rota | Finalidade |
| --- | --- | --- |
| GET | `/` | Redireciona para `/inicio` |
| GET | `/login` | Exibe o formulario de login |
| POST | `/login` | Autentica no Odoo e cria a sessao |
| POST | `/logout` | Remove a sessao e redireciona para login |
| GET | `/inicio` | Exibe os modulos disponiveis |
| GET | `/inventario` | Exibe as etapas de Inventario |
| GET | `/inventario/etapas/{stage_key}` | Renderiza o template da etapa |
| GET | `/api/inventario/etapas/{stage_key}` | Lista transferencias pendentes da etapa |
| GET | `/modelos/{model}` | Exibe a pagina de um modelo |
| GET | `/api/modelos/{model}` | Lista registros do modelo via XML-RPC |

## Logout

O botao **Sair** envia `POST /logout`. A rota:

1. encontra o token no cookie;
2. remove as credenciais correspondentes da memoria;
3. apaga o cookie `odoo_session`;
4. redireciona o usuario para `/login`.

## Seguranca e limitacoes atuais

- O cookie possui `HttpOnly` e `SameSite=Lax`.
- A senha nao e enviada ao frontend depois do login.
- O token do cookie e aleatorio e nao contem credenciais.
- A sessao expira em oito horas.
- As credenciais estao em memoria. Ao reiniciar a aplicacao, todas as sessoes
  sao encerradas.
- Sessoes em memoria nao funcionam entre multiplos processos ou servidores.

Para ambiente de producao, substitua `OdooSessionStore` por Redis ou banco de
dados. O cookie deve continuar contendo somente um identificador de sessao.

Tambem configure HTTPS e marque o cookie com `secure=True` ao publicar a
aplicacao.

## Como adicionar outro modulo

1. Abra `src/fast_api_odoo/routers/inicio.py`.
2. Adicione um item a `MODULES`:

```py
{
    "name": "Faturamento",
    "model": "account.move",
    "description": "Faturas e notas fiscais",
}
```

3. Reinicie a aplicacao.

O cartao, a pagina e a API passam a aceitar o novo modelo automaticamente,
pois `routers/modelos.py` usa a lista `MODULES` como fonte permitida.