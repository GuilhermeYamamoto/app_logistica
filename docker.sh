#!/bin/bash

# Script utilitário para gerenciar Docker Compose

set -e

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Funções
print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Comandos
case "${1:-help}" in
    up)
        print_header "Iniciando containers"
        docker-compose up -d
        print_success "Containers iniciados"
        print_header "Status"
        docker-compose ps
        ;;
    
    down)
        print_header "Parando containers"
        docker-compose down
        print_success "Containers parados"
        ;;
    
    dev)
        print_header "Iniciando em modo desenvolvimento"
        docker-compose -f docker-compose.dev.yml up -d
        print_success "Containers de desenvolvimento iniciados"
        docker-compose logs -f app
        ;;
    
    build)
        print_header "Building imagens"
        docker-compose build --no-cache
        print_success "Imagens construídas"
        ;;
    
    logs)
        docker-compose logs -f ${2:-app}
        ;;
    
    shell)
        print_header "Acessando shell do container ${2:-app}"
        docker-compose exec ${2:-app} bash
        ;;
    
    test)
        print_header "Executando testes"
        docker-compose exec app python -m pytest -v
        ;;
    
    lint)
        print_header "Executando linting"
        docker-compose exec app pylint app/
        ;;
    
    format)
        print_header "Formatando código"
        docker-compose exec app black app/
        print_success "Código formatado"
        ;;
    
    ps)
        print_header "Status dos containers"
        docker-compose ps
        ;;
    
    clean)
        print_header "Limpando containers e volumes"
        docker-compose down -v
        print_success "Limpeza concluída"
        ;;
    
    redis-cli)
        print_header "Conectando ao Redis"
        docker-compose exec redis redis-cli
        ;;
    
    logs-all)
        print_header "Logs de todos os containers"
        docker-compose logs --tail=100
        ;;
    
    help)
        echo "Docker Compose Helper"
        echo ""
        echo "Uso: ./docker.sh <comando> [opções]"
        echo ""
        echo "Comandos:"
        echo "  up          - Inicia containers"
        echo "  down        - Para containers"
        echo "  dev         - Inicia em modo desenvolvimento com hot-reload"
        echo "  build       - Build das imagens"
        echo "  logs [srv]  - Mostra logs (padrão: app)"
        echo "  shell [srv] - Acessa shell do container (padrão: app)"
        echo "  test        - Executa testes"
        echo "  lint        - Executa linting"
        echo "  format      - Formata código com black"
        echo "  ps          - Status dos containers"
        echo "  clean       - Remove containers e volumes"
        echo "  redis-cli   - Conecta ao Redis"
        echo "  logs-all    - Mostra logs de todos"
        echo "  help        - Mostra esta mensagem"
        echo ""
        echo "Exemplos:"
        echo "  ./docker.sh up"
        echo "  ./docker.sh logs app"
        echo "  ./docker.sh shell app"
        echo "  ./docker.sh dev"
        ;;
    
    *)
        print_error "Comando desconhecido: $1"
        echo "Use './docker.sh help' para ver comandos disponíveis"
        exit 1
        ;;
esac
