#!/bin/bash

# Define the tmux session name
export SESSION_NAME="otc-workspace"

# Start a new tmux session
# The -d flag detaches the session so we can configure it before attaching
tmux new-session -d -s $SESSION_NAME

# Create 3 vertical panels
tmux split-window -h -t $SESSION_NAME:0
tmux split-window -h -t $SESSION_NAME:0

# Split panels horizontally where needed
tmux split-window -v -t $SESSION_NAME:0.0
tmux split-window -v -t $SESSION_NAME:0.2

# Resize panels to make them more evenly distributed
tmux resize-pane -t $SESSION_NAME:0.0 -x "33%"
tmux resize-pane -t $SESSION_NAME:0.2 -x "33%"

# Configure each panel with specific commands
# First panel (top-left) - Hardhat node
tmux send-keys -t $SESSION_NAME:0.0 "yarn hardhat node" C-m

# Second panel (bottom-left) - Deploy pSymm
tmux send-keys -t $SESSION_NAME:0.1 "sleep 5; yarn deploy-psymm" C-m

# Third panel (top-middle) - Start solver
tmux send-keys -t $SESSION_NAME:0.2 "sleep 8; yarn solver" C-m

# Fourth panel (bottom-middle) - Guardian
tmux send-keys -t $SESSION_NAME:0.3 "sleep 7; node apps/PSYMM-OTC/guardian.js 127.0.0.3 2" C-m

# Fifth panel (right) - Start trader
tmux send-keys -t $SESSION_NAME:0.4 "sleep 10; yarn trader" C-m

# Attach to the session
tmux attach -t $SESSION_NAME
