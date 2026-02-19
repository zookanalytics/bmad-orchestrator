#!/bin/sh
# pbcopy — copy stdin to the system clipboard via OSC 52
#
# Works through SSH, tmux (including nested sessions), and Docker containers
# as long as each tmux layer has set-clipboard on and the terminal emulator
# supports OSC 52 (iTerm2, WezTerm, Ghostty, Alacritty, Windows Terminal, etc.).
#
# Usage: echo "hello" | pbcopy

printf "\033]52;c;%s\a" "$(base64 | tr -d "\n")"
