#!/bin/bash
# Deploy to Oracle VM. Usage: ./deploy.sh [all|api|frontend|keycloak|sync|status|logs]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_HOST="${VM_HOST:-opc@vabar-studio.duckdns.org}"
APP_DIR="${APP_DIR:-/home/opc/app}"
DOCKER_USERNAME="${DOCKER_USERNAME:-vabar}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

check_ssh() {
    if ! ssh -o ConnectTimeout=10 "$VM_HOST" "echo ok" &>/dev/null; then
        log_error "Cannot connect to $VM_HOST"
        exit 1
    fi
}

sync_config() {
    log_step "Syncing configuration files..."
    if [[ -d "$SCRIPT_DIR/../keycloak" ]]; then
        ssh "$VM_HOST" "mkdir -p $APP_DIR/keycloak/themes"
        rsync -avz --delete "$SCRIPT_DIR/../keycloak/" "$VM_HOST:$APP_DIR/keycloak/"
    fi
    rsync -avz "$SCRIPT_DIR/docker-compose.yml" "$VM_HOST:$APP_DIR/"
    rsync -avz "$SCRIPT_DIR/nginx.conf" "$VM_HOST:$APP_DIR/"
    log_info "Config synced"
}

deploy_service() {
    local service=$1
    log_step "Deploying $service..."
    ssh "$VM_HOST" "cd $APP_DIR && docker pull ${DOCKER_USERNAME}/studio-${service}:latest && docker compose up -d --force-recreate studio-$service"
    log_info "$service deployed"
}

# TODO: Re-enable when auth is needed
# deploy_keycloak() {
#     log_step "Deploying Keycloak..."
#     sync_config
#     ssh "$VM_HOST" "cd $APP_DIR && docker compose up -d keycloak-db keycloak"
#     log_info "Keycloak deployed"
# }

deploy_all() {
    log_step "Deploying all services..."
    sync_config
    ssh "$VM_HOST" "cd $APP_DIR && docker pull ${DOCKER_USERNAME}/studio-api:latest && docker pull ${DOCKER_USERNAME}/studio-frontend:latest && docker compose up -d"
    log_info "All deployed"
}

show_status() { ssh "$VM_HOST" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'"; }
show_logs()   { ssh "$VM_HOST" "docker logs -f --tail 100 ${1:-studio-api}"; }

main() {
    local cmd="${1:-all}"
    echo -e "\n=== Oracle VM Deploy ($VM_HOST) ===\n"

    case $cmd in
        -h|--help)
            echo "Usage: $0 [all|api|frontend|keycloak|sync|status|logs [service]]"
            echo "Commands:"
            echo "  all       - Sync config and deploy all services"
            echo "  api       - Deploy studio-api only"
            echo "  frontend  - Deploy studio-frontend only"
            echo "  keycloak  - Sync config and deploy Keycloak + DB"
            echo "  sync      - Sync config files only (no deploy)"
            echo "  status    - Show running containers"
            echo "  logs      - Show logs (default: studio-api)"
            echo "Env: VM_HOST, APP_DIR, DOCKER_USERNAME"
            exit 0 ;;
        status)       check_ssh; show_status ;;
        logs)         check_ssh; show_logs "$2" ;;
        sync)         check_ssh; sync_config ;;
        # keycloak)     check_ssh; deploy_keycloak; show_status ;;
        api|frontend) check_ssh; deploy_service "$cmd"; show_status ;;
        all)          check_ssh; deploy_all; show_status ;;
        *) log_error "Unknown: $cmd"; exit 1 ;;
    esac

    log_info "Done!"
}

main "$@"
