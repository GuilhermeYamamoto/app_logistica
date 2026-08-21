# Configuração Docker - App Logística

## Visão Geral

Este projeto está configurado para rodar em containers Docker com a seguinte arquitetura:

- **FastAPI App**: Aplicação principal (porta 8000)
- **Redis**: Cache e sessões (porta 6379)
- **Nginx**: Reverse proxy e servidor de arquivos estáticos (portas 80/443)

## Pré-requisitos

- Docker 20.10+
- Docker Compose 2.0+

## Quick Start

### 1. Preparar arquivo de ambiente

```bash
cp .env.docker .env
```

Configure as variáveis conforme necessário:

```env
ODOO_URL=https://seu-odoo-url.com
ODOO_DB=seu-banco-odoo
```

### 2. Build e iniciar containers

```bash
# Build das imagens
docker-compose build

# Iniciar em background
docker-compose up -d

# Ver logs
docker-compose logs -f app
```

### 3. Acessar a aplicação

- **Aplicação**: http://localhost (via Nginx)
- **Direto FastAPI**: http://localhost:8000
- **Redis**: localhost:6379

## Comandos Úteis

### Gerenciamento de Containers

```bash
# Iniciar containers
docker-compose up -d

# Parar containers
docker-compose down

# Parar e remover volumes
docker-compose down -v

# Reiniciar containers
docker-compose restart

# Ver status
docker-compose ps
```

### Logs

```bash
# Todos os containers
docker-compose logs

# Container específico
docker-compose logs -f app

# Últimas 50 linhas
docker-compose logs --tail=50
```

### Execução de Comandos

```bash
# Executar comando no container app
docker-compose exec app python -m pytest

# Shell interativo
docker-compose exec app bash

# Redis CLI
docker-compose exec redis redis-cli
```

### Build

```bash
# Rebuild sem cache
docker-compose build --no-cache

# Build de imagem específica
docker-compose build app
```

## Desenvolvimento

### Desenvolvimento com hot-reload

Para desenvolvimento com auto-reload, o `docker-compose.yml` monta os volumes:

```yaml
volumes:
  - ./app:/app/app
  - ./static:/app/static
  - ./templates:/app/templates
```

Qualquer mudança nestes diretórios será refletida no container.

### Debug

Para debug interativo:

```bash
docker-compose exec app python -m pdb app/main.py
```

## Produção

### Considerações de Segurança

1. **Não use a imagem de debug em produção**
2. **Configure variáveis de ambiente seguras**
3. **Use secrets do Docker ou orquestrador**
4. **Implemente HTTPS com certificados válidos**

### Scale

```bash
# Aumentar instâncias do app
docker-compose up -d --scale app=3
```

### Monitoramento

```bash
# Verificar status dos containers
docker-compose ps

# Verificar uso de recursos
docker stats

# Health check
docker-compose ps
```

## Troubleshooting

### Porta já em uso

```bash
# Mudar porta no docker-compose.yml
# Ou liberar a porta
lsof -i :8000
kill -9 <PID>
```

### Erro de permissão

```bash
# Dar permissões ao diretório
sudo chown -R $USER:$USER .
chmod -R 755 .
```

### Redis não conecta

```bash
# Verificar status do Redis
docker-compose logs redis

# Testar conexão
docker-compose exec app redis-cli -h redis ping
```

### Imagem grande demais

```bash
# Limpar imagens não utilizadas
docker image prune

# Limpar volumes não utilizados
docker volume prune

# Limpeza completa
docker system prune -a
```

## Estrutura de Volumes

```
volumes:
  redis_data:  # Dados persistentes do Redis
```

Use `docker volume ls` para ver todos os volumes.

## Networking

Os containers se comunicam através da rede `app_network`:

- `app` (FastAPI)
- `redis` (Redis)
- `nginx` (Reverse Proxy)

Para adicionar mais serviços, adicione à rede:

```yaml
networks:
  - app_network
```

## Variáveis de Ambiente

Veja `.env.docker` para a lista completa. Override no `.env` local:

```bash
# .env (não commitar)
ODOO_URL=http://localhost:8069
ODOO_DB=test_db
```

## Referências

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Nginx Documentation](https://nginx.org/en/docs/)

## Suporte

Para problemas, verifique:

1. Logs dos containers: `docker-compose logs`
2. Status de health: `docker-compose ps`
3. Conectividade entre containers: `docker-compose exec app ping redis`
