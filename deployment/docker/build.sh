#!/bin/bash
# Multi-arch Docker build. Usage: ./build.sh [all|api|frontend|proxy]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DOCKER_USERNAME="${DOCKER_USERNAME:-vabar}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

setup_buildx() {
    if ! docker buildx version &>/dev/null; then
        log_error "Docker buildx not available"
        exit 1
    fi
    if ! docker buildx inspect multiarch &>/dev/null; then
        log_step "Creating multiarch builder..."
        docker buildx create --name multiarch --use
    else
        docker buildx use multiarch 2>/dev/null || true
    fi
}

build_image() {
    local name=$1 context=$2
    local image="${DOCKER_USERNAME}/${name}:latest"
    log_step "Building $name for $PLATFORMS..."
    docker buildx build --platform "$PLATFORMS" -t "$image" --push "$context"
    log_info "Pushed $image"
}

build_api()       { build_image "studio-api" "$PROJECT_ROOT/studio-api"; }
build_frontend()  { build_image "studio-frontend" "$PROJECT_ROOT/studio"; }
build_proxy()     { build_image "studio-reverse-proxy" "$SCRIPT_DIR"; }
build_ml_worker() { build_image "media-ml-worker" "$PROJECT_ROOT/media-ml-worker"; }
build_all()       { build_api; build_frontend; build_proxy; build_ml_worker; }

main() {
    local target="${1:-all}"

    case $target in
        -h|--help)
            echo "Usage: $0 [all|api|frontend|proxy|ml-worker]"
            echo "Env: DOCKER_USERNAME (default: vabar), PLATFORMS (default: linux/amd64,linux/arm64)"
            exit 0 ;;
        api|frontend|proxy|ml-worker|all) ;;
        *) log_error "Unknown: $target"; exit 1 ;;
    esac

    echo -e "\n=== Multi-arch Build ($PLATFORMS) ===\n"
    setup_buildx

    case $target in
        api)       build_api ;;
        frontend)  build_frontend ;;
        proxy)     build_proxy ;;
        ml-worker) build_ml_worker ;;
        all)       build_all ;;
    esac

    log_info "Done!"
}

main "$@"
