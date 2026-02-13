#!/bin/bash

# Production Deployment Script
# Sistema de Tickets Next.js

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="tickets-app"
APP_DIR="/var/www/tickets-app"
BACKUP_DIR="/var/backups/tickets-app"
LOG_FILE="/var/log/tickets-app/deploy.log"
NODE_VERSION="18"
PM2_CONFIG="ecosystem.config.js"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as correct user
check_user() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    NODE_CURRENT=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_CURRENT -lt $NODE_VERSION ]]; then
        error "Node.js version $NODE_VERSION or higher is required (current: v$NODE_CURRENT)"
    fi
    
    # Check PM2
    if ! command -v pm2 &> /dev/null; then
        error "PM2 is not installed. Install with: npm install -g pm2"
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        error "Git is not installed"
    fi
    
    success "Prerequisites check passed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    sudo mkdir -p "$BACKUP_DIR"
    sudo mkdir -p "$(dirname "$LOG_FILE")"
    sudo mkdir -p "$APP_DIR"
    
    # Set permissions
    sudo chown -R $USER:$USER "$APP_DIR"
    sudo chown -R $USER:$USER "$(dirname "$LOG_FILE")"
    
    success "Directories created"
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    if [[ -d "$APP_DIR" ]]; then
        sudo mkdir -p "$BACKUP_PATH"
        sudo cp -r "$APP_DIR" "$BACKUP_PATH/"
        
        # Backup database
        if [[ -n "$DATABASE_URL" ]]; then
            log "Creating database backup..."
            pg_dump "$DATABASE_URL" > "$BACKUP_PATH/database.sql" 2>/dev/null || warning "Database backup failed"
        fi
        
        success "Backup created at $BACKUP_PATH"
        echo "$BACKUP_PATH" > /tmp/last_backup_path
    else
        warning "No existing installation found, skipping backup"
    fi
}

# Deploy application
deploy_application() {
    log "Deploying application..."
    
    # Clone or update repository
    if [[ -d "$APP_DIR/.git" ]]; then
        log "Updating existing repository..."
        cd "$APP_DIR"
        git fetch origin
        git reset --hard origin/main
    else
        log "Cloning repository..."
        if [[ -z "$REPO_URL" ]]; then
            error "REPO_URL environment variable is required for initial deployment"
        fi
        git clone "$REPO_URL" "$APP_DIR"
        cd "$APP_DIR"
    fi
    
    # Get current commit hash
    COMMIT_HASH=$(git rev-parse --short HEAD)
    log "Deploying commit: $COMMIT_HASH"
    
    success "Repository updated"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    cd "$APP_DIR"
    
    # Clean install
    rm -rf node_modules package-lock.json
    npm ci --only=production
    
    success "Dependencies installed"
}

# Build application
build_application() {
    log "Building application..."
    cd "$APP_DIR"
    
    # Set production environment
    export NODE_ENV=production
    
    # Build
    npm run build
    
    success "Application built successfully"
}

# Setup environment
setup_environment() {
    log "Setting up environment..."
    cd "$APP_DIR"
    
    # Copy environment file if it doesn't exist
    if [[ ! -f ".env.production" ]]; then
        if [[ -f ".env.example" ]]; then
            cp .env.example .env.production
            warning "Created .env.production from .env.example - please update with production values"
        else
            error ".env.production file is required"
        fi
    fi
    
    # Validate environment
    if command -v npm run config:validate &> /dev/null; then
        npm run config:validate || error "Environment validation failed"
    fi
    
    success "Environment configured"
}

# Database migration
migrate_database() {
    log "Running database migrations..."
    cd "$APP_DIR"
    
    if [[ -f "prisma/schema.prisma" ]]; then
        # Generate Prisma client
        npx prisma generate
        
        # Run migrations
        npx prisma migrate deploy
        
        success "Database migrations completed"
    else
        warning "No Prisma schema found, skipping database migrations"
    fi
}

# Start application with PM2
start_application() {
    log "Starting application with PM2..."
    cd "$APP_DIR"
    
    # Stop existing application
    pm2 stop "$APP_NAME" 2>/dev/null || true
    pm2 delete "$APP_NAME" 2>/dev/null || true
    
    # Start application
    if [[ -f "$PM2_CONFIG" ]]; then
        pm2 start "$PM2_CONFIG"
    else
        pm2 start npm --name "$APP_NAME" -- start
    fi
    
    # Save PM2 configuration
    pm2 save
    
    success "Application started with PM2"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for application to start
    sleep 10
    
    # Check if PM2 process is running
    if ! pm2 list | grep -q "$APP_NAME.*online"; then
        error "Application is not running in PM2"
    fi
    
    # Check health endpoint
    HEALTH_URL="http://localhost:3000/api/health"
    for i in {1..30}; do
        if curl -f -s "$HEALTH_URL" > /dev/null; then
            success "Health check passed"
            return 0
        fi
        log "Health check attempt $i/30 failed, retrying in 5 seconds..."
        sleep 5
    done
    
    error "Health check failed after 30 attempts"
}

# Cleanup old backups
cleanup_backups() {
    log "Cleaning up old backups..."
    
    # Keep only last 5 backups
    cd "$BACKUP_DIR"
    ls -t | tail -n +6 | xargs -r rm -rf
    
    success "Old backups cleaned up"
}

# Rollback function
rollback() {
    error_msg="$1"
    log "Deployment failed: $error_msg"
    log "Starting rollback procedure..."
    
    if [[ -f "/tmp/last_backup_path" ]]; then
        BACKUP_PATH=$(cat /tmp/last_backup_path)
        if [[ -d "$BACKUP_PATH" ]]; then
            log "Restoring from backup: $BACKUP_PATH"
            
            # Stop current application
            pm2 stop "$APP_NAME" 2>/dev/null || true
            
            # Restore files
            sudo cp -r "$BACKUP_PATH/$APP_NAME"/* "$APP_DIR/"
            
            # Restore database if backup exists
            if [[ -f "$BACKUP_PATH/database.sql" && -n "$DATABASE_URL" ]]; then
                log "Restoring database..."
                psql "$DATABASE_URL" < "$BACKUP_PATH/database.sql" || warning "Database restore failed"
            fi
            
            # Restart application
            cd "$APP_DIR"
            pm2 start "$PM2_CONFIG" 2>/dev/null || pm2 start npm --name "$APP_NAME" -- start
            
            success "Rollback completed"
        else
            error "Backup not found, manual intervention required"
        fi
    else
        error "No backup available, manual intervention required"
    fi
}

# Main deployment function
main() {
    log "Starting production deployment for $APP_NAME"
    
    # Trap errors for rollback
    trap 'rollback "Deployment script failed"' ERR
    
    check_user
    check_prerequisites
    create_directories
    create_backup
    deploy_application
    install_dependencies
    build_application
    setup_environment
    migrate_database
    start_application
    health_check
    cleanup_backups
    
    success "Deployment completed successfully!"
    log "Application is running at: http://localhost:3000"
    log "Health check: http://localhost:3000/api/health"
    log "PM2 status: pm2 status"
    log "View logs: pm2 logs $APP_NAME"
}

# Script usage
usage() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -r, --repo     Repository URL (required for initial deployment)"
    echo ""
    echo "Environment variables:"
    echo "  REPO_URL       Git repository URL"
    echo "  DATABASE_URL   Database connection string"
    echo ""
    echo "Example:"
    echo "  REPO_URL=https://github.com/user/repo.git $0"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -r|--repo)
            REPO_URL="$2"
            shift 2
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Run main function
main "$@"