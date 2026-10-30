#!/bin/bash
set -e

echo "==> Caliwo API Container Initializing..."

# Wait for database availability before executing migrations (up to 30 attempts)
if [ "${SKIP_MIGRATIONS}" != "true" ] && [ "${SKIP_MIGRATIONS}" != "1" ]; then
    echo "==> Checking database connectivity..."
    python3 -c "
import sys, os, time, asyncio
from dotenv import load_dotenv
load_dotenv()
from database import DATABASE_URL, DB_CONNECT_ARGS
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check():
    engine = create_async_engine(DATABASE_URL, connect_args=DB_CONNECT_ARGS)
    try:
        async with engine.connect() as conn:
            await conn.execute(text('SELECT 1'))
        return True
    except Exception as e:
        return False
    finally:
        await engine.dispose()

async def wait_loop():
    for attempt in range(1, 31):
        if await check():
            print('==> Database connection verified!')
            sys.exit(0)
        print(f'==> Waiting for database (attempt {attempt}/30)...')
        await asyncio.sleep(2)
    print('==> [Error] Database connection timed out after 60 seconds.', file=sys.stderr)
    sys.exit(1)

asyncio.run(wait_loop())
"

    # Run Alembic migrations
    echo "==> Running database migrations..."
    if ! alembic upgrade head; then
        echo "==> [Warning] Alembic upgrade head failed (schema may already be populated). Stamping head to continue..."
        alembic stamp head || true
    fi
else
    echo "==> SKIP_MIGRATIONS is set; skipping database migrations."
fi

# Execute CMD instruction from Dockerfile
echo "==> Starting application..."
exec "$@"
