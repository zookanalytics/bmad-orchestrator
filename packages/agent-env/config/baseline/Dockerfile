FROM node:22-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux \
    zsh \
    git \
    gnupg \
    openssh-client \
    curl \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code@2.1.29

# Configure non-root user with sudo access
RUN echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node

# Switch to non-root user
USER node

# Set zsh as default shell
RUN sudo chsh -s /usr/bin/zsh node

WORKDIR /workspace
