#!/bin/bash
set -e

echo "========================================================"
echo "  Caliwo Backend: Fresh EC2 All-In-One Bootstrap Script"
echo "========================================================"

# 1. Setup 2GB Swap Memory (Prevents OOM during Docker build on micro/small instances)
echo "==> [1/5] Configuring 2GB Swap Space..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap configured successfully."
else
    echo "Swap already present."
fi

# 2. Install Docker & Docker Compose plugin if missing
echo "==> [2/5] Ensuring Docker and Docker Compose are installed..."
if ! command -v docker &> /dev/null; then
    sudo apt-get update -y
    sudo apt-get install -y docker.io docker-compose-v2 git curl
    sudo systemctl enable --now docker
    sudo usermod -aG docker $USER
    echo "Docker installed."
fi

# 3. Ensure certs directory exists
mkdir -p ./nginx/certs

# 4. Check .env file
if [ ! -f ".env" ]; then
    echo "[Error] .env file is missing in $(pwd). Please create backend/.env before running this script."
    exit 1
fi

# 5. Build and launch services
echo "==> [3/5] Building and launching containers..."
sudo docker compose -f docker-compose.ec2.yml down --remove-orphans || true
sudo docker compose -f docker-compose.ec2.yml build
sudo docker compose -f docker-compose.ec2.yml up -d redis

echo "Waiting for Redis to become healthy..."
sleep 5

sudo docker compose -f docker-compose.ec2.yml up -d api
echo "Waiting for API startup..."
sleep 5

sudo docker compose -f docker-compose.ec2.yml up -d nginx

# 6. Apply database migrations
echo "==> [4/5] Running Alembic database migrations..."
sudo docker compose -f docker-compose.ec2.yml exec -T api alembic upgrade head || true

# 7. Verification
echo "==> [5/5] Checking API health..."
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || true)
if [ "$HTTP_CODE" == "200" ]; then
    echo "========================================================"
    echo "  DEPLOYMENT SUCCESSFUL! API IS HEALTHY (HTTP 200)"
    echo "========================================================"
    curl -s http://localhost:8000/health
    echo ""
    sudo docker compose -f docker-compose.ec2.yml ps
else
    echo "========================================================"
    echo "  [WARNING] API health check returned: $HTTP_CODE"
    sudo docker compose -f docker-compose.ec2.yml logs --tail=40 api
fi
