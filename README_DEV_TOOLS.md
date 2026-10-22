# Caixa de ferramentas de desenvolvimento

Este documento descreve a caixa de ferramentas para desenvolvedores da aplicação FastAPI integrada ao Odoo 15.

As ferramentas existem para facilitar:

- debug de integrações;
- testes controlados via RPC;
- consultas pontuais ao Odoo;
- simulações de alterações;
- alterações operacionais explicitamente autorizadas;
- acompanhamento da execução por logs.

## Princípios de segurança

A caixa de ferramentas é isolada das telas e integrações operacionais existentes. Ela não altera os serviços de estoque, vendas, compras ou inventário usados pelo restante da aplicação.

As ferramentas:

1. não expõem um executor RPC genérico;
2. possuem endpoints próprios e métodos RPC definidos no código;
3. ficam disponíveis somente em `ENVIRONMENT=development`;
4. exigem uma sessão autenticada na aplicação;
5. exigem a senha novamente para desbloqueio;
6. exigem que o usuário pertença ao grupo administrativo `base.group_system` do Odoo;
7. utilizam um cookie temporário assinado para manter o desbloqueio;
8. executam simulação por padrão;
9. exigem `execute=true` para operações que alteram o Odoo.

> Não use a caixa de ferramentas em produção. Mesmo em desenvolvimento, utilize preferencialmente uma base de homologação.

## Configuração

No arquivo `.env`:

```env
ENVIRONMENT=development
DEBUG=true
DEV_UNLOCK_SECRET=troque-por-um-segredo-aleatorio
DEV_UNLOCK_MAX_AGE=900
```

`DEV_UNLOCK_MAX_AGE` é informado em segundos. O valor `900` corresponde a 15 minutos.

Em produção:

```env
ENVIRONMENT=production
DEBUG=false
```

Nesse ambiente, o router de desenvolvimento nem é registrado pela aplicação.

O segredo `DEV_UNLOCK_SECRET` deve ser diferente entre ambientes e não deve ser commitado no repositório.

## Acesso à caixa

O fluxo de acesso é:

```text
Login normal na aplicação
        ↓
GET /dev
        ↓
Usuário clica em "Desbloquear"
        ↓
POST /dev/unlock com a senha do Odoo
        ↓
Reautenticação no Odoo
        ↓
Verificação do grupo base.group_system
        ↓
Cookie temporário de desbloqueio
```

O cookie contém o UID, a data de expiração e uma assinatura HMAC. A senha não é enviada pela URL.

O desbloqueio não substitui a sessão normal. O usuário precisa continuar autenticado na aplicação e o cookie precisa estar válido.

## Organização das caixas

`/dev` exibe as caixas de ferramentas disponíveis:

```text
/dev
├── Sale Order (Vendas)
├── Purchase Order (Compras)
└── Stock Picking (Inventário)
```

Ao abrir uma caixa, é exibida uma lista própria de ferramentas:

```text
/dev/tools/sale-order
└── Criar pedido de venda
```

A mesma estrutura é usada para as demais caixas. Uma caixa sem ferramentas mostra uma mensagem informando que nenhuma ferramenta foi disponibilizada.

As opções de caixas ficam em:

```text
app/services/dev_service.py
```

O catálogo de ferramentas de cada caixa é retornado por:

```python
DevService.get_toolbox_tools(toolbox_key)
```

## Ferramenta: criação de pedido de venda

### Tela

Rota da caixa:

```text
GET /dev/tools/sale-order
```

Rota da ferramenta:

```text
GET /dev/tools/sale-order/create-sale-order
```

A tela possui:

- campo para o ID do CRM Lead;
- opção `Executar no Odoo`;
- botão de execução;
- descrição dos métodos RPC utilizados;
- shell com o log da operação;
- indicação se a operação foi simulada, executada ou falhou.

### Endpoint

```text
POST /dev/api/tools/sale-order
```

Exemplo de simulação:

```json
{
  "lead_id": 99497,
  "execute": false
}
```

Exemplo de execução real:

```json
{
  "lead_id": 99497,
  "execute": true
}
```

O valor padrão de `execute` é `false`.

### Modo de simulação

Com `execute=false`, a ferramenta consulta o Odoo e prepara os dados, mas não cria nem confirma a cotação.

Ela executa consultas para:

1. localizar o CRM Lead;
2. buscar fornecedores permitidos;
3. localizar produtos vendáveis;
4. selecionar produtos e quantidades;
5. selecionar registros auxiliares;
6. montar os valores da Sale Order.

No modo de simulação, estes métodos não são chamados:

```text
sale.order.create
sale.order.get_item_cost
ir.actions.server.run
sale.order.action_integra_crm
sale.order.action_confirm
```

### Modo de execução

Com `execute=true`, depois da preparação dos valores, a ferramenta:

1. cria a cotação com `sale.order.create`;
2. atualiza os custos com `sale.order.get_item_cost`;
3. executa a ação de validação `ir.actions.server` ID `1817`;
4. consulta os erros em `sale.order.validation`;
5. arquiva os erros somente se o modelo possuir o campo `active`;
6. integra a cotação ao CRM com `sale.order.action_integra_crm`;
7. executa novamente a validação;
8. confirma a cotação com `sale.order.action_confirm`.

O ID `1817` é específico da configuração atual do Odoo. Se a ação de servidor mudar entre bases, a ferramenta deverá ser configurada para a base correspondente.

## Logs

O endpoint retorna os logs em uma lista:

```json
{
  "success": true,
  "result": {
    "execute": false,
    "lead_id": 99497,
    "lead_name": "Lead de teste",
    "values": {}
  },
  "logs": [
    "Buscando CRM Lead 99497...",
    "Lead encontrado: Lead de teste",
    "Fornecedores válidos encontrados: 10",
    "Produtos vendáveis encontrados: 25",
    "Linhas de produto geradas: 3",
    "Valores da Sale Order preparados.",
    "Simulação concluída. Nenhuma alteração foi enviada ao Odoo."
  ]
}
```

Na interface, essa lista é exibida no painel **Shell da operação**.

Falhas de validação ou RPC retornam o erro e os logs já coletados. Exemplos:

```text
CRM Lead 99497 não foi encontrado.
```

```text
O Odoo recusou ou não concluiu a operação RPC.
```

## Campos esperados no CRM Lead

A ferramenta espera que o Lead possua os seguintes campos:

```text
id
name
partner_id
company_id
team_id
user_id
```

Se algum campo relacional obrigatório estiver vazio, a operação é interrompida antes da criação da cotação.

## Validação de `sale.order.validation`

Algumas bases possuem o campo `active` no modelo `sale.order.validation`; outras não.

A ferramenta consulta os metadados do modelo antes de tentar arquivar os erros:

- com `active`: executa `write(..., {"active": false})`;
- sem `active`: registra um aviso e continua o fluxo;
- nunca envia deliberadamente um `write` para um campo inexistente.

Isso evita que uma diferença de configuração entre bases interrompa o processo.

## Métodos RPC permitidos atualmente

A ferramenta de Sale Order não aceita um nome de modelo ou método arbitrário para executar. Os métodos estão definidos diretamente no serviço:

```text
crm.lead.search_read
product.supplierinfo.search_read
product.product.search
account.payment.term.search
account.incoterms.search
delivery.carrier.search
sale.order.create
sale.order.get_item_cost
ir.actions.server.read
ir.actions.server.run
sale.order.validation.search_read
sale.order.validation.fields_get
sale.order.validation.write
sale.order.action_integra_crm
sale.order.action_confirm
```

Essa lista deve ser revisada sempre que o fluxo for alterado.

## Onde implementar novas ferramentas

### 1. Catálogo da caixa

Adicione a ferramenta em `DevService.get_toolbox_tools()`:

```python
{
    "key": "minha-ferramenta",
    "name": "Minha ferramenta",
    "description": "Descrição curta da operação.",
    "route": "/dev/tools/sale-order/minha-ferramenta",
}
```

### 2. Schema de entrada

Crie o schema em:

```text
app/models/dev.py
```

Exemplo:

```python
class MinhaFerramentaRequest(BaseModel):
    record_id: int = Field(gt=0)
    execute: bool = False
```

### 3. Serviço

Implemente a lógica RPC em:

```text
app/services/dev_service.py
```

O serviço deve:

- receber um `OdooClient`;
- aceitar um callback de log;
- usar métodos RPC explícitos;
- simular por padrão;
- separar preparação de execução;
- validar respostas obrigatórias;
- não alterar telas ou serviços operacionais existentes.

### 4. Router

Adicione uma rota protegida em:

```text
app/routers/dev.py
```

Use:

```python
credentials: OdooCredentials = Depends(require_dev_admin)
```

para exigir ambiente, sessão, desbloqueio e perfil administrativo.

### 5. Tela

Crie um template em:

```text
templates/dev/
```

Use o stylesheet compartilhado:

```text
static/css/dev/dev.css
```

Os painéis de código e shell devem manter altura delimitada e rolagem interna:

```css
overflow-y: auto;
overflow-x: hidden;
white-space: pre-wrap;
overflow-wrap: anywhere;
```

## Testes recomendados

Antes de executar uma ferramenta contra uma base real:

1. rode a ferramenta em modo simulado;
2. confirme o Lead e os dados selecionados no shell;
3. valide os valores da cotação;
4. use uma base de homologação;
5. execute com um Lead de teste;
6. confira a Sale Order criada diretamente no Odoo.

Validações locais:

```bash
.venv/bin/python -m compileall -q app
git diff --check
```

O serviço deve ser testado com um cliente RPC simulado para garantir que:

- `execute=false` não chama `create` nem confirmação;
- `execute=true` chama os métodos esperados;
- domínios são enviados sem listas aninhadas indevidamente;
- diferenças de campos opcionais não interrompem a operação.

## Limitações atuais

- A ferramenta utiliza seleção aleatória de produtos, quantidades e registros auxiliares.
- O ID da ação de servidor de validação está fixo em `1817`.
- O fluxo depende de campos customizados da instalação do Odoo, como `id_crm`, `empresa_faturamento_id` e `approver_id`.
- `dry_run` não cria uma transação com rollback no Odoo; ele evita chamar os métodos de alteração.
- A ferramenta não executa `unlink`.
- As sessões podem usar memória local quando o Redis não estiver disponível. Isso é adequado apenas para desenvolvimento local.
