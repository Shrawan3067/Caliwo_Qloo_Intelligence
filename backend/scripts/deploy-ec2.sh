#!/bin/bash
set -e

echo "========================================================"
echo "  Caliwo Backend: AWS EC2 Docker Deployment Script"
echo "========================================================"

# 1. Ensure docker and docker compose are available
if ! command -v docker &> /dev/null; then
    echo "[Error] Docker is not installed. Please install Docker first:"
    echo "  sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2"
    exit 1
fi

# 2. Check for environment file
if [ ! -f ".env" ]; then
    echo "[Warning] .env file not found. Creating .env from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "[Notice] Generated .env from .env.example. Please populate your DATABASE_URL and secrets!"
    fi
fi

# Ensure certs directory exists for volume mount
mkdir -p ./nginx/certs

# 3. Pull / build production containers
echo "==> Building production Docker containers for AWS EC2..."
docker compose -f docker-compose.ec2.yml build

# 4. Stop previous container instances cleanly
echo "==> Stopping running containers..."
docker compose -f docker-compose.ec2.yml down --remove-orphans || true

# 5. Start Redis cache & rate-limiter first
echo "==> Starting Redis service..."
docker compose -f docker-compose.ec2.yml up -d redis

echo "==> Waiting for Redis to become healthy..."
until [ "$(docker inspect -f '{{.State.Health.Status}}' $(docker compose -f docker-compose.ec2.yml ps -q redis))" == "healthy" ]; do
    sleep 1
    echo -n "."
done
echo " Redis is healthy!"

# 6. Start API container first
echo "==> Starting Caliwo API container..."
docker compose -f docker-compose.ec2.yml up -d api

# 7. Check health of the deployed backend API on EC2
echo "==> Verifying API container startup..."
sleep 3

MAX_RETRIES=30
COUNTER=0
API_READY=0

while [ $COUNTER -lt $MAX_RETRIES ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || true)
    if [ "$HTTP_CODE" == "200" ]; then
        API_READY=1
        echo " API container is ready (HTTP 200)!"
        break
    fi
    COUNTER=$((COUNTER + 1))
    echo "Waiting for API on port 8000 (attempt $COUNTER/$MAX_RETRIES, status: $HTTP_CODE)..."
    sleep 2
done

if [ $API_READY -ne 1 ]; then
    echo "========================================================"
    echo "  [WARNING] API did not return 200 on port 8000."
    docker compose -f docker-compose.ec2.yml logs --tail=50 api
    exit 1
fi

# 8. Start Nginx reverse proxy now that API upstream is healthy
echo "==> Starting Nginx reverse proxy..."
docker compose -f docker-compose.ec2.yml up -d nginx
sleep 2

# Verify Nginx proxy endpoint
NGINX_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || true)
SUCCESS=0
if [ "$NGINX_CODE" == "200" ]; then
    SUCCESS=1
else
    # Retry a couple times for Nginx socket bind
    for retry in {1..5}; do
        sleep 1
        NGINX_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || true)
        if [ "$NGINX_CODE" == "200" ]; then
            SUCCESS=1
            break
        fi
    done
fi

if [ $SUCCESS -eq 1 ]; then
    echo "========================================================"
    echo "  DEPLOYMENT SUCCESSFUL!"
    echo "========================================================"
    echo "• Direct API Port:   http://localhost:8000/health"
    echo "• Nginx Proxy Port:  http://localhost/health"
    echo "• Public access via: http://<EC2-PUBLIC-IP>/api/"
    echo "========================================================"
    docker compose -f docker-compose.ec2.yml ps
else
    echo "========================================================"
    echo "  [WARNING] Health check did not return 200 within expected time."
    echo "  Container Status:"
    echo "========================================================"
    docker compose -f docker-compose.ec2.yml ps
    echo "--------------------------------------------------------"
    echo "  API Logs:"
    echo "--------------------------------------------------------"
    docker compose -f docker-compose.ec2.yml logs --tail=50 api
    exit 1
fi
