FROM node:22

ARG TZ
ENV TZ="$TZ"

# Install basic development tools and firewall packages
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  curl \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  dnsmasq \
  aggregate \
  jq \
  nano \
  vim \
  ripgrep \
  shellcheck \
  locales \
  lsof \
  ulogd2 \
  tmux \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install latest GitHub CLI from official repository
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg; \
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null; \
  apt update && apt install -y gh && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="/usr/local" sh

# Generate and set locale to prevent bash locale warnings
RUN sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
  locale-gen
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Setup pnpm via corepack
ENV PNPM_HOME="/pnpm"
RUN mkdir -p "$PNPM_HOME"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

ARG USERNAME=node

# Persist bash history
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set DEVCONTAINER environment variable
ENV DEVCONTAINER=true

RUN mkdir -p /workspaces && \
  chown -R node:node /workspaces

WORKDIR /workspaces

# Install git-delta
ARG GIT_DELTA_VERSION=0.18.2
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Install actionlint
ARG ACTIONLINT_VERSION=1.7.10
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_${ARCH}.tar.gz" && \
  tar -xzf "actionlint_${ACTIONLINT_VERSION}_linux_${ARCH}.tar.gz" -C /usr/local/bin actionlint && \
  chmod +x /usr/local/bin/actionlint && \
  rm "actionlint_${ACTIONLINT_VERSION}_linux_${ARCH}.tar.gz" && \
  actionlint --version

# Install Playwright system dependencies (browsers installed per-project in postCreateCommand)
RUN pnpm dlx playwright install-deps

# Ensure node user has access to required directories
RUN chown -R node:node /usr/local/share
RUN chown -R node:node /pnpm

# Set up non-root user
USER node

# Create directories for mounted volumes
RUN mkdir -p /home/node/.claude \
             /home/node/.config \
             /home/node/.gemini \
             /home/node/.cache/ms-playwright \
             /home/node/.local/bin

# Copy tmux configuration
COPY --chown=node:node image/config/tmux.conf /home/node/.tmux.conf
COPY --chown=node:node image/scripts/tmux-session.sh /home/node/.local/bin/tmux-session
RUN chmod +x /home/node/.local/bin/tmux-session

# Set default shell and editor
ENV SHELL=/bin/zsh
ENV EDITOR=vim
ENV VISUAL=vim

# Install zsh with powerlevel10k
ARG ZSH_IN_DOCKER_VERSION=1.2.1
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -a 'export PATH="$HOME/.local/bin:$PATH"' \
  -x

# Setup pnpm
RUN pnpm setup

# Install bun (required for keystone-cli)
# Must run as node user to install to ~/.bun
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/home/node/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Install keystone-cli globally via bun (must run as node user for PATH)
RUN bun install -g github:ZookAnalytics/keystone-cli

# Copy keystone-workflows package and run postinstall to set up symlinks and config
COPY --chown=node:node packages/keystone-workflows /home/node/.local/lib/keystone-workflows
RUN /home/node/.local/lib/keystone-workflows/scripts/postinstall.sh

USER root

# Copy configuration files
COPY image/config/allowed-domains.txt /etc/allowed-domains.txt
COPY image/config/dnsmasq.conf /etc/dnsmasq.conf
COPY image/config/ulogd.conf /etc/ulogd.conf

# Copy scripts
COPY image/scripts/init-firewall.sh /usr/local/bin/
COPY image/scripts/start-dnsmasq.sh /usr/local/bin/
COPY image/scripts/start-ulogd.sh /usr/local/bin/
COPY image/scripts/read-firewall-logs.sh /usr/local/bin/
COPY image/scripts/post-create.sh /usr/local/bin/
COPY image/scripts/derive-project-name.sh /usr/local/bin/
COPY image/scripts/check-daily-updates.sh /usr/local/bin/
COPY image/scripts/fix-node-modules-ownership.sh /usr/local/bin/
COPY image/scripts/update-packages.sh /usr/local/bin/
COPY image/scripts/find-blocked-domain.sh /usr/local/bin/
COPY image/scripts/test-firewall-logging.sh /usr/local/bin/
COPY image/scripts/assemble-managed-settings.sh /usr/local/bin/
COPY image/scripts/setup-instance-isolation.sh /usr/local/bin/
COPY image/scripts/setup-claude-auth-sharing.sh /usr/local/bin/
COPY image/scripts/search-history.sh /usr/local/bin/
COPY image/scripts/fix-shared-data-permissions.sh /usr/local/bin/
COPY image/scripts/update-keystone.sh /usr/local/bin/
COPY image/scripts/register-plugin-marketplaces.sh /usr/local/bin/
COPY image/scripts/devcontainer-sanity-check.sh /usr/local/bin/
COPY image/scripts/fix-ssh-socket-permissions.sh /usr/local/bin/

# Make scripts executable and configure sudo
RUN chmod 755 /usr/local/bin/init-firewall.sh && \
  chmod 755 /usr/local/bin/start-dnsmasq.sh && \
  chmod 755 /usr/local/bin/start-ulogd.sh && \
  chmod 755 /usr/local/bin/read-firewall-logs.sh && \
  chmod 755 /usr/local/bin/post-create.sh && \
  chmod 755 /usr/local/bin/derive-project-name.sh && \
  chmod 755 /usr/local/bin/check-daily-updates.sh && \
  chmod 755 /usr/local/bin/fix-node-modules-ownership.sh && \
  chmod 755 /usr/local/bin/update-packages.sh && \
  chmod 755 /usr/local/bin/find-blocked-domain.sh && \
  chmod 755 /usr/local/bin/test-firewall-logging.sh && \
  chmod 755 /usr/local/bin/assemble-managed-settings.sh && \
  chmod 755 /usr/local/bin/setup-instance-isolation.sh && \
  chmod 755 /usr/local/bin/setup-claude-auth-sharing.sh && \
  chmod 755 /usr/local/bin/search-history.sh && \
  chmod 755 /usr/local/bin/fix-shared-data-permissions.sh && \
  chmod 755 /usr/local/bin/update-keystone.sh && \
  chmod 755 /usr/local/bin/register-plugin-marketplaces.sh && \
  chmod 755 /usr/local/bin/devcontainer-sanity-check.sh && \
  chmod 755 /usr/local/bin/fix-ssh-socket-permissions.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/assemble-managed-settings.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/fix-node-modules-ownership.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/start-dnsmasq.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/start-ulogd.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/read-firewall-logs.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/update-packages.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/fix-shared-data-permissions.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/fix-ssh-socket-permissions.sh" >> /etc/sudoers.d/node-commands && \
  chmod 0440 /etc/sudoers.d/node-commands

# Create log files with proper permissions
RUN touch /var/log/dnsmasq.log && chmod 666 /var/log/dnsmasq.log
RUN touch /var/log/ulogd-firewall.log && chmod 666 /var/log/ulogd-firewall.log

# Copy Claude managed configuration (security hooks)
# Base settings are copied as default; assemble-managed-settings.sh merges optional modules at runtime
COPY image/hooks/managed-settings.base.json /etc/claude-code/managed-settings.json
COPY image/hooks/ /etc/claude-code/hooks/
# Ensure proper permissions (readable config, executable hooks)
RUN chmod 644 /etc/claude-code/managed-settings.json && \
  chmod 644 /etc/claude-code/hooks/*.json && \
  chmod 755 /etc/claude-code/hooks/*.sh /etc/claude-code/hooks/*.py

# Copy Gemini configuration (hooks are shared with Claude)
COPY image/gemini/settings.json /etc/gemini-code/settings.json
RUN mkdir -p /etc/gemini-code/hooks && \
  ln -s /etc/claude-code/hooks/prevent-main-push.sh /etc/gemini-code/hooks/ && \
  ln -s /etc/claude-code/hooks/prevent-admin-flag.sh /etc/gemini-code/hooks/ && \
  ln -s /etc/claude-code/hooks/prevent-no-verify.sh /etc/gemini-code/hooks/ && \
  ln -s /etc/claude-code/hooks/prevent-env-leakage.py /etc/gemini-code/hooks/ && \
  ln -s /etc/claude-code/hooks/prevent-bash-sensitive-args.py /etc/gemini-code/hooks/ && \
  ln -s /etc/claude-code/hooks/prevent-sensitive-files.py /etc/gemini-code/hooks/ && \
  ln -s /etc/claude-code/hooks/lib /etc/gemini-code/hooks/

# Copy CLI tools from packages (build context must be repo root)
COPY packages/claude-instance/bin/claude-instance /usr/local/bin/claude-instance
COPY packages/bmad-orchestrator/scripts/ /usr/local/lib/bmad/
RUN chmod 755 /usr/local/bin/claude-instance && \
  ln -s /usr/local/lib/bmad/bmad-cli /usr/local/bin/bmad-cli && \
  chmod 755 /usr/local/lib/bmad/bmad-cli

USER node
