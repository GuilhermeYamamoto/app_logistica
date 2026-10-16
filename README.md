# App Logística

Aplicação web para operação logística integrada ao Odoo. O backend é
construído com FastAPI e comunica-se com o Odoo por XML-RPC; o frontend é
renderizado com Jinja2 e complementado por JavaScript, CSS e leitura de
código de barras no navegador.

## Funcionalidades

- Autenticação de usuários no Odoo.
- Sessões com cookie `HttpOnly`, Redis e fallback para memória.
- Dashboard e consulta de modelos do Odoo.
- Fluxo de inventário dividido em etapas operacionais.
- Busca, filtros, validação, impressão, fotos, localização e chat de pickings.
- Recebimento de qualidade e registro de alertas.
- Leitura de código de barras pela câmera.
- Interface responsiva para computador, tablet e dispositivos móveis.
- Health check em `/health`.

## Arquitetura

```text
Navegador
    │ HTML, CSS, JavaScript e fetch()
    ▼
Nginx (opcional: portas 80/443)
    │
    ▼
FastAPI/Uvicorn (container app: porta 8000)
    ├── Routers HTTP
    ├── Serviços de negócio
    ├── Sessões Redis/memória
    └── Cliente XML-RPC
             │
             ▼
          Odoo
```

O Redis não contém os dados do Odoo. Ele armazena as sessões autenticadas,
com TTL definido por `SESSION_MAX_AGE`. O Odoo continua sendo a fonte de
dados de usuários, pickings, produtos e operações logísticas.

## Estrutura do projeto

```text
app_logistica/
├── app/
│   ├── main.py                  # Criação da aplicação FastAPI e middleware
│   ├── config.py                # Settings, caminhos e versão de assets
│   ├── core/
│   │   ├── exceptions.py        # Exceções de domínio
│   │   ├── security.py          # Dependências de autenticação dos routers
│   │   └── auth/
│   │       ├── odoo_client.py   # Cliente XML-RPC do Odoo
│   │       ├── service.py       # Autenticação, sessões e operações Odoo
│   │       └── session.py       # Contrato e implementações de session store
│   ├── models/
│   │   └── schemas.py           # Schemas Pydantic de entrada da API
│   ├── routers/
│   │   ├── auth.py              # Login e logout
│   │   ├── index.py             # Raiz e dashboard
│   │   ├── models.py            # Consulta genérica de modelos
│   │   └── stock_picking.py     # Inventário e endpoints operacionais
│   └── services/
│       └── inventory_service.py # Regras e consultas do fluxo de inventário
├── templates/
│   ├── base/                    # Layout e telas compartilhadas
│   ├── index/                  # Dashboard
│   ├── login/                  # Autenticação
│   └── stock_picking/           # Telas das etapas de inventário
├── static/
│   ├── css/                    # Estilos compartilhados e por etapa
│   ├── js/                     # Comportamento compartilhado e por etapa
│   └── img/                    # Imagens da interface
├── Dockerfile                  # Imagem de produção
├── Dockerfile.dev              # Imagem de desenvolvimento com reload
├── docker-compose.yml          # App, Redis e Nginx
├── docker-compose.dev.yml      # Ambiente de desenvolvimento
├── docker.sh                   # Atalhos de operação Docker
├── nginx.conf                  # Reverse proxy opcional
├── pyproject.toml              # Dependências e configuração de build
├── uv.lock                     # Resolução reproduzível das dependências
└── .dockerignore               # Arquivos excluídos do contexto Docker
```

Arquivos `__pycache__` e artefatos locais não fazem parte da arquitetura e não
devem ser versionados.

## Organização do backend

### `app/main.py`: composição da aplicação

`main.py` cria o objeto `FastAPI`, monta `/static`, registra os routers e
expõe `/health`. Também possui o middleware `prevent_html_caching`, que
aplica `Cache-Control: no-store, max-age=0, must-revalidate` às respostas
HTML. Isso evita que WebViews e navegadores reutilizem uma página com URLs
antigas de assets.

Os routers são registrados separadamente para evitar que a aplicação
principal concentre regras de negócio:

```python
app.include_router(auth.router)
app.include_router(index.router)
app.include_router(stock_picking.router)
app.include_router(models.router)
```

### `app/config.py`: configuração centralizada

`Settings` herda de `pydantic_settings.BaseSettings`. Os valores padrão podem
ser sobrescritos por variáveis no arquivo `.env` ou pelo ambiente do
container:

- `ODOO_URL`: URL base do Odoo.
- `ODOO_DB`: banco do Odoo.
- `SESSION_COOKIE_NAME`: nome do cookie de sessão.
- `SESSION_MAX_AGE`: duração da sessão em segundos.
- `REDIS_URL`: conexão do Redis.
- `ENVIRONMENT` e `DEBUG`: modo de execução.

O objeto global `settings` evita que cada módulo leia o ambiente de forma
independente. `static_asset_version(path)` calcula a versão pelo `mtime` do
arquivo e impede cache obsoleto dos assets, validando também que o caminho
permanece dentro de `static/`.

### `app/core/auth/odoo_client.py`: gateway XML-RPC

`OdooClient` encapsula a comunicação com o Odoo. Ele cria os proxies XML-RPC
`common` e `object` e mantém o contexto autenticado (`db`, `uid` e senha)
apenas durante o uso do cliente.

Métodos principais:

- `authenticate(db, username, password)`: autentica no endpoint `common` e
  retorna o UID.
- `set_authenticated_session(...)`: restaura uma sessão já autenticada.
- `execute(model, method, *args, **kwargs)`: chama `execute_kw` no Odoo.
- `search`, `read`, `create`, `write` e `unlink`: operações convenientes de
  CRUD sobre modelos Odoo.

A aplicação não espalha chamadas XML-RPC diretamente pelos templates ou pelo
frontend. Os routers usam dependências para receber um cliente autenticado.

### `app/core/auth/session.py`: contrato de sessão e polimorfismo

`OdooCredentials` é um `dataclass(frozen=True)` que representa os dados
necessários para reconstruir o contexto Odoo.

`BaseSessionStore` define o contrato comum:

```text
create(credentials) -> token
get(token)           -> credentials ou None
delete(token)        -> None
```

Duas implementações herdam esse contrato:

- `MemorySessionStore`: dicionário protegido por `threading.Lock`; adequado
  para desenvolvimento e testes locais.
- `RedisSessionStore`: persiste a sessão no Redis com `setex` e TTL. Se o
  Redis não estiver disponível, usa `MemorySessionStore` como fallback.

Essa herança permite trocar a estratégia de armazenamento sem alterar os
routers nem o serviço de autenticação. Em produção, o Redis é preferível,
especialmente quando há mais de uma instância da aplicação.

### `app/core/auth/service.py`: serviço de autenticação

`OdooAuthService` concentra o caso de uso de autenticação e as operações
Odoo que precisam de credenciais:

- `authenticate`: autentica, cria `OdooCredentials` e gera o token.
- `logout`: remove a sessão.
- `get_credentials`: recupera a sessão pelo token.
- `create_client_from_session`: reconstrói um `OdooClient`.
- `search`, `read`, `create`, `write` e operações de domínio: delegam a
  chamada ao cliente autenticado.

O serviço separa a orquestração dos casos de uso dos detalhes HTTP. Assim,
um router lida com request/response, enquanto o serviço lida com Odoo e
sessão.

### `app/core/security.py`: dependências FastAPI

As funções `get_odoo_credentials` e `get_odoo_client` são dependências
injetadas pelos endpoints. Elas leem o cookie, recuperam as credenciais e
retornam um contexto autenticado. Endpoints protegidos falham antes de
executar a operação quando não existe uma sessão válida.

### `app/models/schemas.py`: contratos de entrada

Os schemas herdam de `pydantic.BaseModel` e validam payloads recebidos pela
API. Exemplos:

- `LoginRequest`: credenciais do login.
- `QualityAlert`: dados de um alerta de qualidade.
- `ReceivedQuantity`: quantidade recebida.
- `SavePickingPhotos`: fotos associadas ao picking.
- `BarcodeScan`: leitura de código de barras.

Usar Pydantic nos limites da aplicação evita que os serviços recebam
estruturas inválidas e mantém a documentação OpenAPI coerente.

### `app/services/inventory_service.py`: regras do inventário

`InventoryService` é responsável pela lógica de negócio das etapas. Seus
métodos estáticos:

- `get_inventory_stages`: define a chave, nome, `picking_type_id` e template
  de cada etapa.
- `list_stage_records`: consulta pickings, movimentos e estados no Odoo e
  transforma o resultado no formato consumido pela interface.
- métodos auxiliares: agrupam movimentos, calculam quantidades, tratam
  etapas especiais, pacotes, impressão, localização e ações operacionais.

Algumas etapas da operação são separadas visualmente no FastAPI, embora
compartilhem o mesmo `picking_type_id` no Odoo. Nesses casos, a camada de
serviço usa tags ou campos do picking para diferenciar o fluxo, mantendo essa
regra fora dos templates.

### `app/routers`: camada HTTP

Os routers definem endpoints, status HTTP, dependências e renderização:

- `auth.py`: `GET /login`, `POST /login` e `POST /logout`.
- `index.py`: `/` redireciona e `/index` exibe o dashboard.
- `models.py`: páginas e API para consulta de modelos.
- `stock_picking.py`: páginas de etapas e endpoints `/api/inventario/*`,
  qualidade, fotos, códigos de barras, localização e chat.

O router de inventário usa `get_stage(stage_key)` para validar a etapa
recebida na URL. A configuração da etapa vem do `InventoryService`, evitando
duplicar um endpoint e um template de roteamento para cada fase.

## Organização do frontend

### Herança de templates Jinja2

Os templates seguem uma composição em camadas:

```text
templates/base/base.html
    ├── base/modelo.html
    └── stock_picking/base.html
            ├── recebimento_fiscal.html
            ├── recebimento_qualidade.html
            ├── pre_separacao.html
            ├── separacao.html
            ├── conferencia_separacao.html
            ├── empacotamento.html
            ├── armazenamento_expedicao.html
            ├── conferencia_expedicao.html
            └── faturamento.html
```

`{% extends %}` fornece a herança visual; `{% block %}` funciona como ponto
de extensão. `stock_picking/base.html` concentra a barra superior, filtros,
dashboard, lista de pickings, modais, validação e chat. Cada etapa preenche
apenas seus blocos e detalhes específicos.

### JavaScript e CSS

`static/js/base/base.js` e `static/css/base/base.css` possuem comportamento e
estilo compartilhados, como tema, modal, pull-to-refresh e utilitários de
interface. As etapas têm arquivos próprios em `static/js/stock_picking` e
`static/css/stock_picking`.

O padrão recomendado é:

1. Colocar em `base` tudo que é comum a mais de uma tela.
2. Colocar no arquivo da etapa somente regras e eventos específicos.
3. Usar os endpoints `/api/...` em vez de duplicar lógica de negócio no
   navegador.
4. Referenciar assets com `?v={{ static_asset_version(...) }}`.

O template e o router devem registrar o helper `static_asset_version` quando
renderizam assets. Isso faz o navegador buscar um novo arquivo quando ele
realmente foi alterado.

## Fluxo de autenticação

```text
1. Usuário envia login e senha
2. auth.py chama OdooAuthService.authenticate()
3. OdooClient.authenticate() valida no Odoo
4. OdooCredentials é armazenado no Redis ou na memória
5. Um token aleatório é enviado em cookie HttpOnly
6. Cada endpoint protegido recupera o token por Depends()
7. get_odoo_client() reconstrói o cliente autenticado
8. Logout remove o token do session store
```

A senha não é enviada de volta ao navegador. Ela permanece no servidor dentro
do contexto da sessão e é usada apenas para chamadas XML-RPC autenticadas.

## Dependências e build Python

As dependências ficam no `pyproject.toml`, dentro de `[project]`. O `uv.lock`
registra a resolução das versões e dependências indiretas. Não instale uma
biblioteca apenas no ambiente virtual local esperando que ela apareça no
servidor; declare-a no `pyproject.toml` e atualize o lockfile:

```bash
uv add requests
# ou edite pyproject.toml e execute:
uv lock
```

O projeto usa `uv_build` e o pacote da aplicação é `app`, configurado em:

```toml
[tool.uv.build-backend]
module-name = "app"
module-root = "."
```

## Execução local

### Sem Docker

```bash
python -m venv .venv

# Linux/macOS
source .venv/bin/activate

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

pip install uv
uv pip install -e .

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Configure um `.env` antes de iniciar:

```env
ODOO_URL=https://seu-odoo.example.com
ODOO_DB=seu-banco
SESSION_COOKIE_NAME=odoo_session
SESSION_MAX_AGE=28800
REDIS_URL=redis://localhost:6379/0
ENVIRONMENT=development
DEBUG=true
```

Acesse `http://localhost:8000`.

## Docker

### Arquitetura da imagem

O `Dockerfile` usa dois estágios:

1. `builder`: instala ferramentas de compilação, copia o manifesto, o
   `README.md` e o pacote `app`, e instala o projeto com `uv`.
2. `runtime`: usa uma imagem Python menor, copia os pacotes instalados e o
   código, cria o usuário não-root `appuser` e inicia o Uvicorn.

O `README.md` é copiado porque está declarado como `readme` no
`pyproject.toml`. O `.dockerignore` exclui Markdown por padrão, mas mantém
`README.md` com `!README.md`.

### Produção

O Compose de produção executa:

- `app`: FastAPI na porta interna `8000`, publicada como `8001`.
- `redis`: Redis na porta `6379`.
- `nginx`: proxy opcional nas portas `80` e `443`.

```bash
# Criar .env a partir do exemplo, se existir
cp .env.docker .env

# Construir e iniciar
docker compose build
docker compose up -d

# Verificar
docker compose ps
docker compose logs -f app
curl http://localhost:8001/health
```

No navegador, o acesso direto ao FastAPI é:

```text
http://IP_DO_SERVIDOR:8001
```

Quando o Nginx estiver configurado e exposto, use o domínio ou IP nas portas
80/443.

### Deploy depois de alterar dependências ou o Dockerfile

Alterações em Python montadas por volume não exigem necessariamente rebuild,
mas alterações em `pyproject.toml`, `uv.lock`, `Dockerfile` ou
`.dockerignore` exigem uma nova imagem:

```bash
git pull
docker compose stop app
docker compose build --no-cache app
docker compose up -d app
docker compose logs -f --tail=100 app
```

Se o container estiver em loop de reinício, ainda é possível reconstruir a
imagem: `docker compose build` não depende de o serviço estar rodando.

### Desenvolvimento com Docker

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml logs -f app
```

O Compose de desenvolvimento monta `app/`, `static/` e `templates/` no
container e inicia o Uvicorn com `--reload`.

### Comandos auxiliares

O script `docker.sh` oferece atalhos:

```bash
./docker.sh up
./docker.sh down
./docker.sh build
./docker.sh logs app
./docker.sh shell app
./docker.sh ps
./docker.sh redis-cli
```

Para confirmar a biblioteca instalada na imagem:

```bash
docker compose exec app python -c \
  "import requests; print(requests.__version__)"
```

## Testes e validações

```bash
# A aplicação pode ser importada
python -c "from app.main import app; print(len(app.routes))"

# Testes, quando disponíveis no ambiente
pytest

# Verificar se o lock está consistente
uv lock --check
```

Também é recomendado verificar o endpoint de saúde após cada deploy:

```bash
curl http://localhost:8001/health
```

Resposta esperada:

```json
{"status": "ok"}
```

## Boas práticas de manutenção

- Declarar toda dependência em `pyproject.toml`; não depender de instalação
  manual dentro de container.
- Atualizar `uv.lock` junto com o manifesto.
- Reconstruir a imagem quando mudar dependências, Dockerfile ou contexto.
- Manter regras de negócio no serviço e não em templates.
- Usar schemas Pydantic nos payloads recebidos pelos endpoints.
- Reutilizar `stock_picking/base.html`, `base.js` e `base.css` para mudanças
  compartilhadas.
- Não registrar senhas, tokens ou credenciais nos logs.
- Usar Redis em produção quando houver múltiplas instâncias.
- Validar alterações com `git diff --check`, import da aplicação e health
  check.

## Troubleshooting

### `ModuleNotFoundError: No module named 'requests'`

Confirme que `requests` está no `pyproject.toml`, que o `uv.lock` foi
atualizado e reconstrua a imagem com `--no-cache`.

### `Expected a Python module at src/fast_api_odoo`

O build precisa da configuração `module-name = "app"` e
`module-root = "."` em `pyproject.toml`, além de `COPY app ./app` no estágio
`builder`.

### `README.md: No such file or directory` durante o build

Confira se `README.md` está no contexto e se o `.dockerignore` contém:

```text
!README.md
```

### Container reiniciando

```bash
docker compose ps
docker compose logs --tail=200 app
docker compose stop app
docker compose build --no-cache app
docker compose up -d app
```

### Redis indisponível

O `RedisSessionStore` tenta usar Redis e cai para `MemorySessionStore` quando
não consegue conectar. Em produção, corrija a conectividade e use Redis para
que as sessões não dependam de uma única instância da aplicação.
