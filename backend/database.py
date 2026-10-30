"""Database engine and session configuration.

Scalability fixes applied:
  C1 — Reduced pool_size (5) and max_overflow (10) per worker to prevent
       connection starvation. PgBouncer should sit between app and PostgreSQL
       in production (configured in docker-compose.prod.yml).
  H8 — Read replica routing support via separate read engine.
"""

import os
import sys
import asyncio
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

def parse_database_url(url: str):
    """
    Sanitizes database URL and extracts asyncpg-compatible SSL arguments.
    Standard postgres URLs often include ?sslmode=require which asyncpg rejects
    with 'TypeError: connect() got an unexpected keyword argument sslmode'.
    """
    if not url:
        return url, {}
    
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
    connect_args = {}
    if "+asyncpg" in url:
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        
        if "sslmode" in query_params:
            sslmode = query_params.pop("sslmode")[0].lower()
            if sslmode in ("disable", "allow", "false", "0"):
                connect_args["ssl"] = False
            elif sslmode in ("require", "prefer", "verify-ca", "verify-full", "true", "1"):
                connect_args["ssl"] = "require"
            
            new_query = urlencode(query_params, doseq=True)
            url = urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                new_query,
                parsed.fragment
            ))
            
        # Optimize asyncpg connection parameters:
        # Disable prepared statement caching when connecting to PgBouncer / Neon pooled hosts
        # to prevent invalid statement collisions and re-planning latency in transaction mode
        if "pooler" in url or "-pooler" in url or "pgbouncer" in url.lower():
            connect_args["statement_cache_size"] = 0
            connect_args["prepared_statement_cache_size"] = 0
            
        connect_args["server_settings"] = {
            "application_name": "caliwo_backend",
            "tcp_keepalives_idle": "60",
            "tcp_keepalives_interval": "10",
            "tcp_keepalives_count": "5",
        }
        connect_args["command_timeout"] = 30
            
    return url, connect_args

_raw_db_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://mac@localhost:5432/caliwo")
DATABASE_URL, DB_CONNECT_ARGS = parse_database_url(_raw_db_url)

# Read replica URL (H8 — route read-heavy queries to replicas)
_raw_read_url = os.environ.get("DATABASE_READ_URL", "")
READ_DATABASE_URL, READ_DB_CONNECT_ARGS = parse_database_url(_raw_read_url) if _raw_read_url else ("", {})

IS_TESTING = os.environ.get("TESTING") == "1" or "pytest" in sys.modules

_engines = {}

def get_engine():
    if not IS_TESTING:
        if "main" not in _engines:
            _engines["main"] = create_async_engine(
                DATABASE_URL,
                connect_args=DB_CONNECT_ARGS,
                echo=False,
                # High-performance pool tuning:
                # Disable pool_pre_ping to avoid redundant ~250ms SELECT 1 roundtrips per checkout.
                # Rely on TCP keepalives and 300s recycle for connection health.
                pool_pre_ping=False,
                pool_recycle=300,
                pool_size=10,
                max_overflow=15,
                pool_timeout=15
            )
        return _engines["main"]
    
    try:
        loop = asyncio.get_running_loop()
        if loop not in _engines:
            _engines[loop] = create_async_engine(
                DATABASE_URL,
                connect_args=DB_CONNECT_ARGS,
                echo=False,
                poolclass=NullPool
            )
        return _engines[loop]
    except Exception:
        if "default" not in _engines:
            _engines["default"] = create_async_engine(
                DATABASE_URL,
                connect_args=DB_CONNECT_ARGS,
                echo=False,
                poolclass=NullPool
            )
        return _engines["default"]


def get_read_engine():
    """Return the read-replica engine, falling back to the primary if
    DATABASE_READ_URL is not configured."""
    if not READ_DATABASE_URL:
        return get_engine()

    if "read" not in _engines:
        _engines["read"] = create_async_engine(
            READ_DATABASE_URL,
            connect_args=READ_DB_CONNECT_ARGS,
            echo=False,
            pool_pre_ping=False,
            pool_recycle=300,
            pool_size=10,
            max_overflow=15,
            pool_timeout=15,
        )
    return _engines["read"]


class _EngineProxy:
    def __getattr__(self, name):
        return getattr(get_engine(), name)

engine = _EngineProxy()

_session_factory = None
_read_session_factory = None

def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _session_factory

def get_read_session_factory() -> async_sessionmaker[AsyncSession]:
    global _read_session_factory
    if _read_session_factory is None:
        _read_session_factory = async_sessionmaker(
            bind=get_read_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _read_session_factory

def AsyncSessionLocal():
    return get_session_factory()()

Base = declarative_base()

async def get_db():
    factory = get_session_factory()
    async with factory() as session:
        yield session

async def get_read_db():
    """Dependency that provides a read-only session routed to the read replica."""
    factory = get_read_session_factory()
    async with factory() as session:
        yield session
