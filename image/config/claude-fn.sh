# claude-fn.sh — sourced by .zshrc to intercept claude with session tracking wrapper
# The wrapper tracks session IDs per tmux pane for session persistence across rebuilds.
claude() { /usr/local/bin/claude-wrapper "$@"; }
