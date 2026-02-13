#!/bin/bash

# Deployment script for Tickets System
set -e

echo "🚀 Starting deployment process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
BUILD_CONTEXT=${2:-.}

echo -e "${YELLOW}Environment: $ENVIRONMENT${NC}"
echo -e "${YELLOW}Build Context: $BUILD_CONTEXT${NC}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    echo -e "${RED}❌ Invalid environment. Use: development, staging, or production${NC}"
    exit 1
fi

# Check required files
echo "📋 Checking required files..."
required_files=(
    "Dockerfile"
    "docker-compose.prod.yml"
    "package.json"
    "next.config.ts"
    "prisma/schema.prisma"
)

for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}❌ Required file missing: $file${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ All required files present${NC}"

# Check environment variables
echo "🔧 Checking environment variables..."
required_env_vars=(
    "DATABASE_URL"
    "REDIS_URL"
    "NEXTAUTH_SECRET"
    "NEXTAUTH_URL"
    "EMAIL_FROM_ADDRESS"
)

missing_vars=()
for var in "${required_env_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        missing_vars+=("$var")
    fi
done

if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    printf '%s\n' "${missing_vars[@]}"
    echo -e "${YELLOW}💡 Create a .env.production file with these variables${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables configured${NC}"

# Load environment file if exists
if [[ -f ".env.$ENVIRONMENT" ]]; then
    echo "📄 Loading environment file: .env.$ENVIRONMENT"
    export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
fi

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Check Node.js version
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

# Check npm/yarn
if command -v yarn &> /dev/null; then
    PACKAGE_MANAGER="yarn"
    echo "Package manager: yarn"
else
    PACKAGE_MANAGER="npm"
    echo "Package manager: npm"
fi

# Install dependencies
echo "📦 Installing dependencies..."
if [[ "$PACKAGE_MANAGER" == "yarn" ]]; then
    yarn install --frozen-lockfile
else
    npm ci
fi

# Generate Prisma client
echo "🗄️  Generating Prisma client..."
npx prisma generate

# Run tests
echo "🧪 Running tests..."
if [[ "$ENVIRONMENT" != "production" ]]; then
    npm test -- --passWithNoTests --watchAll=false
    echo -e "${GREEN}✅ Tests passed${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping tests in production deployment${NC}"
fi

# Build application
echo "🏗️  Building application..."
npm run build

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Docker operations
echo "🐳 Preparing Docker deployment..."

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down --remove-orphans || true

# Build Docker image
echo "🔨 Building Docker image..."
docker build \
    --build-arg NODE_ENV=$ENVIRONMENT \
    --build-arg DATABASE_URL="$DATABASE_URL" \
    --build-arg REDIS_URL="$REDIS_URL" \
    --build-arg NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
    --build-arg NEXTAUTH_URL="$NEXTAUTH_URL" \
    -t tickets-system:$ENVIRONMENT \
    -t tickets-system:latest \
    $BUILD_CONTEXT

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Docker image built successfully${NC}"
else
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi

# Database migrations
echo "🗄️  Running database migrations..."
if [[ "$ENVIRONMENT" == "production" ]]; then
    # In production, run migrations in a temporary container
    docker run --rm \
        --network host \
        -e DATABASE_URL="$DATABASE_URL" \
        tickets-system:$ENVIRONMENT \
        sh -c "npx prisma migrate deploy"
else
    # In development/staging, run migrations directly
    npx prisma migrate deploy
fi

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Database migrations completed${NC}"
else
    echo -e "${RED}❌ Database migrations failed${NC}"
    exit 1
fi

# Start services
echo "🚀 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Health check
echo "🏥 Performing health check..."
max_attempts=10
attempt=1

while [[ $attempt -le $max_attempts ]]; do
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Health check passed${NC}"
        break
    else
        echo "Attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    fi
done

if [[ $attempt -gt $max_attempts ]]; then
    echo -e "${RED}❌ Health check failed after $max_attempts attempts${NC}"
    echo "📋 Container logs:"
    docker-compose -f docker-compose.prod.yml logs app
    exit 1
fi

# Cleanup old images
echo "🧹 Cleaning up old Docker images..."
docker image prune -f

# Display deployment info
echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "📊 Deployment Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Application: http://localhost:3000"
echo "  Health Check: http://localhost:3000/api/health"
echo "  Admin Panel: http://localhost:3000/admin"
echo ""
echo "🔧 Management Commands:"
echo "  View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "  Stop services: docker-compose -f docker-compose.prod.yml down"
echo "  Restart services: docker-compose -f docker-compose.prod.yml restart"
echo ""
echo -e "${GREEN}✅ Deployment process completed successfully!${NC}"