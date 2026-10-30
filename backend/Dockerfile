FROM python:3.12-slim

# Prevent Python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Create a non-root user
RUN groupadd -r caliwo && useradd -r -g caliwo caliwo

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and scripts
COPY . .

# Ensure entrypoint is executable
RUN chmod +x /app/entrypoint.sh

# Change ownership of the app directory to the non-root user
RUN chown -R caliwo:caliwo /app

# Switch to the non-root user
USER caliwo

# Expose the FastAPI port
EXPOSE 8000

# Health check — M4: uses lightweight /health that does NOT hit the database
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run the entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]

# Start server using uvicorn/gunicorn (2 workers + 120s timeout for stability on EC2)
CMD ["gunicorn", "server:app", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "120", "--graceful-timeout", "30", "--access-logfile", "-", "--error-logfile", "-"]
