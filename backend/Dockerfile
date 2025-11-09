# 1. Start with a stable, general-purpose base image
FROM ubuntu:22.04

# Avoid interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# 2. Install all dependencies in a single RUN command to optimize layer caching
RUN apt-get update && \
    apt-get install -y \
    # Node.js dependencies
    curl \
    gnupg \
    # Python dependencies
    python3 \
    python3-pip \
    python3-venv \
    # OpenCV system dependencies
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 && \
    # Install Node.js v18
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    # Clean up apt cache
    rm -rf /var/lib/apt/lists/*

# 3. Set up Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# 4. Install Python dependencies
COPY scripts/mosaic/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# 5. Set up the Node.js application environment
WORKDIR /app
COPY package*.json ./
RUN npm install

# 6. Copy the rest of the application code
COPY . .

# 7. Expose port and define command
EXPOSE 8080
CMD ["npm", "start"]
