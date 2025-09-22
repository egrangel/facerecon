#!/bin/bash

# Production Deployment Script for Facial Recognition System
# Usage: ./deploy.sh [command]
# Commands: build, start, stop, restart, logs, status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

check_requirements() {
    info "Checking requirements..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check if .env.production exists
    if [ ! -f "$ENV_FILE" ]; then
        error "Environment file $ENV_FILE not found!"
        warn "Copy .env.prod.template to .env.production and configure it."
        exit 1
    fi

    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "Docker compose file $COMPOSE_FILE not found!"
        exit 1
    fi

    log "All requirements met!"
}

validate_env() {
    info "Validating environment configuration..."

    # Check for placeholder values
    if grep -q "YOUR_" "$ENV_FILE"; then
        error "Found placeholder values in $ENV_FILE"
        warn "Please update all YOUR_* values with actual configuration"
        exit 1
    fi

    if grep -q "yourdomain.com" "$ENV_FILE"; then
        warn "Found 'yourdomain.com' in $ENV_FILE - make sure to update with your actual domain"
    fi

    log "Environment validation passed!"
}

backup_database() {
    if [ -d "data" ]; then
        info "Creating database backup..."
        mkdir -p "$BACKUP_DIR"
        timestamp=$(date +%Y%m%d_%H%M%S)

        # Backup SQLite if it exists
        if [ -f "data/facial_recognition.db" ]; then
            cp "data/facial_recognition.db" "$BACKUP_DIR/facial_recognition_backup_$timestamp.db"
            log "SQLite database backed up to $BACKUP_DIR/facial_recognition_backup_$timestamp.db"
        fi

        # Backup PostgreSQL if container is running
        if docker-compose -f "$COMPOSE_FILE" ps | grep -q postgres; then
            docker-compose -f "$COMPOSE_FILE" exec postgres pg_dump -U facial_recognition_user facial_recognition_prod | gzip > "$BACKUP_DIR/postgres_backup_$timestamp.sql.gz"
            log "PostgreSQL database backed up to $BACKUP_DIR/postgres_backup_$timestamp.sql.gz"
        fi
    fi
}

build_app() {
    log "Building application..."

    # Build TypeScript
    npm run build

    # Build Docker images
    docker-compose -f "$COMPOSE_FILE" build --no-cache

    log "Build completed!"
}

start_app() {
    log "Starting application..."

    # Start services
    docker-compose -f "$COMPOSE_FILE" up -d

    # Wait for services to be ready
    sleep 10

    # Check if services are running
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        log "Application started successfully!"
        show_status
    else
        error "Failed to start some services"
        docker-compose -f "$COMPOSE_FILE" logs
        exit 1
    fi
}

stop_app() {
    log "Stopping application..."
    docker-compose -f "$COMPOSE_FILE" down
    log "Application stopped!"
}

restart_app() {
    log "Restarting application..."
    stop_app
    start_app
}

show_logs() {
    docker-compose -f "$COMPOSE_FILE" logs -f "$2"
}

show_status() {
    info "Service Status:"
    docker-compose -f "$COMPOSE_FILE" ps

    echo ""
    info "Health Checks:"

    # Check backend health
    if curl -f -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        log "✓ Backend API is healthy"
    else
        warn "✗ Backend API is not responding"
    fi

    # Check frontend
    if curl -f -s http://localhost > /dev/null 2>&1; then
        log "✓ Frontend is accessible"
    else
        warn "✗ Frontend is not accessible"
    fi

    echo ""
    info "URLs:"
    echo "  Frontend: http://localhost"
    echo "  API: http://localhost:3000/api/v1"
    echo "  Health: http://localhost:3000/api/v1/health"
}

deploy_full() {
    log "Starting full deployment..."

    check_requirements
    validate_env
    backup_database
    build_app
    start_app

    log "Deployment completed successfully!"
    echo ""
    info "Your application is now running at:"
    echo "  Frontend: http://localhost"
    echo "  API: http://localhost:3000/api/v1"
}

# Main script logic
case "$1" in
    "build")
        check_requirements
        build_app
        ;;
    "start")
        check_requirements
        validate_env
        start_app
        ;;
    "stop")
        stop_app
        ;;
    "restart")
        check_requirements
        validate_env
        restart_app
        ;;
    "logs")
        show_logs "$@"
        ;;
    "status")
        show_status
        ;;
    "backup")
        backup_database
        ;;
    "deploy")
        deploy_full
        ;;
    *)
        echo "Usage: $0 {build|start|stop|restart|logs|status|backup|deploy}"
        echo ""
        echo "Commands:"
        echo "  build   - Build the application and Docker images"
        echo "  start   - Start the application"
        echo "  stop    - Stop the application"
        echo "  restart - Restart the application"
        echo "  logs    - Show application logs (add service name for specific logs)"
        echo "  status  - Show service status and health checks"
        echo "  backup  - Create database backup"
        echo "  deploy  - Full deployment (build + start)"
        echo ""
        echo "Examples:"
        echo "  $0 deploy           # Full deployment"
        echo "  $0 logs backend     # Show backend logs"
        echo "  $0 status           # Check service status"
        exit 1
        ;;
esac