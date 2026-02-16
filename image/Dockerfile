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
  openssh-server \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install latest GitHub CLI from official repository
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg; \
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null; \
  apt update && apt install -y gh && apt-get clean && rm -rf /var/lib/apt/lists/*

# Generate and set locale to prevent bash locale warnings
RUN sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
  locale-gen
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Setup pnpm via corepack (pin version to avoid mismatch with project packageManager)
ARG PNPM_VERSION=10.29.3
ENV PNPM_HOME="/pnpm"
RUN mkdir -p "$PNPM_HOME"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

ARG USERNAME=node

# Persist bash history
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set DEVCONTAINER environment variable
ENV DEVCONTAINER=true

RUN mkdir -p /workspaces/.pnpm-store && \
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

# Pre-approve GitHub SSH host keys (published at https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)
RUN mkdir -p /etc/ssh && \
  ssh-keyscan -t ed25519,ecdsa,rsa github.com >> /etc/ssh/ssh_known_hosts 2>/dev/null

# SSH server setup: runtime dir, hardened config, remove default host keys (generated per-container)
RUN mkdir -p /run/sshd && \
  rm -f /etc/ssh/ssh_host_*_key /etc/ssh/ssh_host_*_key.pub
COPY image/config/sshd_config /etc/ssh/sshd_config

EXPOSE 22

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
COPY image/scripts/register-plugin-marketplaces.sh /usr/local/bin/
COPY image/scripts/devcontainer-sanity-check.sh /usr/local/bin/
COPY image/scripts/fix-ssh-socket-permissions.sh /usr/local/bin/
COPY image/scripts/start-sshd.sh /usr/local/bin/
COPY image/scripts/install-ssh-host-keys.sh /usr/local/bin/

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
  chmod 755 /usr/local/bin/register-plugin-marketplaces.sh && \
  chmod 755 /usr/local/bin/devcontainer-sanity-check.sh && \
  chmod 755 /usr/local/bin/fix-ssh-socket-permissions.sh && \
  chmod 755 /usr/local/bin/start-sshd.sh && \
  chmod 755 /usr/local/bin/install-ssh-host-keys.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/assemble-managed-settings.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/fix-node-modules-ownership.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/start-dnsmasq.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/start-ulogd.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/read-firewall-logs.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/update-packages.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/fix-shared-data-permissions.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/fix-ssh-socket-permissions.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/start-sshd.sh" >> /etc/sudoers.d/node-commands && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/install-ssh-host-keys.sh" >> /etc/sudoers.d/node-commands && \
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

# Devcontainer metadata — infrastructure defaults for all projects
# Projects override via their .devcontainer/devcontainer.json (additive merge)
# Inspect with: docker inspect <image> | jq -r '.[0].Config.Labels["devcontainer.metadata"]'
LABEL devcontainer.metadata='[ \
  { \
    "remoteUser": "node", \
    "containerUser": "node", \
    "capAdd": ["NET_ADMIN", "NET_RAW", "SYSLOG"], \
    "mounts": [ \
      "source=agent-devcontainer-shared-data,target=/shared-data,type=volume", \
      "source=agent-devcontainer-pnpm-store,target=/workspaces/.pnpm-store,type=volume", \
      "source=agent-devcontainer-node-modules-${localWorkspaceFolderBasename},target=/workspaces/${localWorkspaceFolderBasename}/node_modules,type=volume", \
      "source=${localEnv:HOME}/.gitconfig,target=/home/node/.gitconfig,type=bind,readonly", \
      "source=/run/host-services/ssh-auth.sock,target=/run/host-services/ssh-auth.sock,type=bind", \
      "source=${localEnv:HOME}/.agent-env/ssh-pub-keys,target=/home/node/.ssh-host,type=bind,readonly" \
    ], \
    "containerEnv": { \
      "SSH_AUTH_SOCK": "/run/host-services/ssh-auth.sock", \
      "POWERLEVEL9K_DISABLE_GITSTATUS": "true", \
      "SHARED_DATA_DIR": "/shared-data", \
      "PNPM_HOME": "/pnpm", \
      "npm_config_store_dir": "/workspaces/.pnpm-store", \
      "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "true" \
    }, \
    "postCreateCommand": "/usr/local/bin/post-create.sh", \
    "postStartCommand": "sudo /usr/local/bin/start-sshd.sh; tmux new-session -d -s main 2>/dev/null || true", \
    "forwardPorts": [22], \
    "customizations": { \
      "vscode": { \
        "settings": { \
          "terminal.integrated.defaultProfile.linux": "zsh" \
        }, \
        "extensions": [ \
          "Anthropic.claude-code", \
          "google.gemini-cli-vscode-ide-companion", \
          "eamodio.gitlens", \
          "esbenp.prettier-vscode", \
          "dbaeumer.vscode-eslint" \
        ] \
      } \
    } \
  } \
]'

USER node
