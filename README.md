# FastAPI Odoo - App Logística

Aplicação web em FastAPI que integra com Odoo via XML-RPC, gerencia sessões de usuários e fornece uma interface para consultar dados de inventário, modelos e recebimentos de qualidade.

## ✨ Funcionalidades

- ✅ Autenticação no Odoo via XML-RPC
- ✅ Gerenciamento de sessões com Redis (fallback para memória)
- ✅ Sessões protegidas por cookie `HttpOnly`
- ✅ Dashboard com módulos do Odoo
- ✅ Consulta de registros por modelo
- ✅ Etapas de inventário com templates específicos
- ✅ Recebimento de qualidade com integração em tempo real
- ✅ Logout seguro

## 🛠️ Tecnologias

- **Python 3.8.9+**
- **FastAPI** - Framework web moderno
- **Uvicorn** - ASGI server
- **Pydantic** - Validação de dados e configurações
- **Jinja2** - Templates HTML
- **Redis** - Armazenamento de sessões (opcional)
- **Docker** - Containerização
- **Nginx** - Reverse proxy

## 📁 Estrutura do Projeto

```
app_logistica/
├── app/
│   ├── core/
│   │   ├── auth/              ← Autenticação e sessões
│   │   │   ├── odoo_client.py
│   │   │   ├── session.py
│   │   │   ├── service.py
│   │   │   └── __init__.py
│   │   ├── exceptions.py
│   │   ├── security.py
│   │   └── __init__.py
│   ├── models/                ← Schemas Pydantic
│   │   ├── schemas.py
│   │   └── __init__.py
│   ├── routers/               ← Endpoints
│   │   ├── auth.py
│   │   ├── dashboard.py
│   │   ├── inventario.py
│   │   ├── models.py
│   │   ├── quality.py
│   │   └── __init__.py
│   ├── services/              ← Serviços de negócio
│   │   ├── inventario_service.py
│   │   └── __init__.py
│   ├── config.py              ← Configurações
│   ├── main.py                ← FastAPI app
│   └── __init__.py
├── static/                    ← Arquivos estáticos
│   ├── css/
│   ├── img/
│   └── js/
├── templates/                 ← Templates Jinja2
│   ├── base.html
│   ├── login.html
│   ├── index.html
│   └── ...
├── Dockerfile                 ← Produção
├── Dockerfile.dev             ← Desenvolvimento
├── docker-compose.yml         ← Produção
├── docker-compose.dev.yml     ← Desenvolvimento
├── docker.sh                  ← Helper scripts
├── nginx.conf                 ← Configuração Nginx
├── pyproject.toml
├── README.md
├── README_DOCKER.md           ← Documentação Docker
└── .env.docker                ← Variáveis de ambiente exemplo
```

## 🚀 Como Executar

### Desenvolvimento Local (sem Docker)

```bash
# Criar ambiente virtual
python -m venv venv

# Ativar (Windows)
.\venv\Scripts\Activate.ps1

# Instalar dependências
pip install fastapi uvicorn jinja2 pydantic-settings python-dotenv redis

# Configurar variáveis de ambiente
cp .env.docker .env
# Editar .env com suas credenciais Odoo

# Rodar servidor
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Acesse `http://localhost:8000`

### Com Docker

```bash
# Desenvolvimento com hot-reload
docker-compose -f docker-compose.dev.yml up

# Produção
docker-compose up -d
```

Ver [README_DOCKER.md](README_DOCKER.md) para mais detalhes.

## ⚙️ Configuração

Crie um arquivo `.env` baseado em `.env.docker`:

```env
# Odoo
ODOO_URL=https://seu-odoo.com
ODOO_DB=seu_banco

# Sessão
SESSION_COOKIE_NAME=odoo_session
SESSION_MAX_AGE=28800

# Redis (opcional)
REDIS_URL=redis://localhost:6379/0

# FastAPI
ENVIRONMENT=development
DEBUG=True
```

## 🔐 Fluxo de Autenticação

1. **Login** → Usuário envia credenciais
2. **Autenticação Odoo** → Valida via XML-RPC
3. **Criar Sessão** → Armazena credenciais (Redis/Memória)
4. **Cookie** → Define cookie HttpOnly com token
5. **Requisições** → Cookie incluído automaticamente
6. **Logout** → Remove sessão

## 📚 Módulos Principais

### `app.core.auth`
- `OdooClient` - Cliente XML-RPC para Odoo
- `OdooAuthService` - Serviço de autenticação
- `OdooCredentials` - Dataclass com credenciais
- Session stores (Redis + Memory fallback)

### `app.routers`
- `auth.py` - Login/Logout
- `dashboard.py` - Dashboard principal
- `inventario.py` - Etapas de inventário
- `models.py` - Consulta de modelos
- `quality.py` - Recebimento de qualidade

### `app.services`
- `InventarioService` - Etapas de inventário

## 🧪 Testes

```bash
# Verificar app carrega
python -c "from app.main import app; print(f'{len(app.routes)} routers carregados')"

# Com pytest (se instalado)
pytest
```

## 🐛 Troubleshooting

**Redis não conecta?** → App usa fallback automático para memória

**Sessão expira rápido?** → Ajuste `SESSION_MAX_AGE` em `.env`

**CORS issues?** → Adicione origens permitidas em `main.py`

## 📝 Licença

MIT

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

Cada cartao aponta para `/{model}`, exceto Inventario, que aponta para
`/inventario` e apresenta as etapas antes da listagem de registros. A pagina
dos demais modelos usa
`static/js/base/modelo.js` para buscar os registros por API.

A consulta e realizada por:

```http
GET /api/{model}
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

### Recebimento de Qualidade

A tela `/recebimento-qualidade` obtém os dados reais em:

```http
GET /api/recebimento-qualidade/pickings
```

A API consulta `stock.picking` com `picking_type_id = 137`, exclui registros
cancelados e busca as respectivas linhas em `stock.move`. A resposta contém
fornecedor, referência, produtos e as quantidades esperada e recebida para
cada picking. O navegador carrega esse endpoint na abertura da tela; os dados
de demonstração não são usados.

## Rotas

| Metodo | Rota | Finalidade |
| --- | --- | --- |
| GET | `/` | Redireciona para `/inicio` |
| GET | `/login` | Exibe o formulario de login |
| POST | `/login` | Autentica no Odoo e cria a sessao |
| POST | `/logout` | Remove a sessao e redireciona para login |
| GET | `/recebimento-qualidade` | Exibe a tela de recebimento de qualidade |
| GET | `/api/recebimento-qualidade/pickings` | Lista os pickings do tipo 137 |
| GET | `/inicio` | Exibe os modulos disponiveis |
| GET | `/inventario` | Exibe as etapas de Inventario |
| GET | `/inventario/etapas/{stage_key}` | Renderiza o template da etapa |
| GET | `/api/inventario/etapas/{stage_key}` | Lista transferencias pendentes da etapa |
| GET | `/{model}` | Exibe a pagina de um modelo |
| GET | `/api/{model}` | Lista registros do modelo via XML-RPC |

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
