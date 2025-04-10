FROM python:3.9-slim

WORKDIR /app

# Copy the package files
COPY . /app/

# Install dependencies and the package
RUN pip install --no-cache-dir cterasdk && \
    pip install --no-cache-dir -e . && \
    pip install --no-cache-dir gunicorn

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV MCP_API_TOKEN=default-token

# Expose port
EXPOSE 5000

# Run with Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "8", "cterasdk_mcp.agent:app"] 