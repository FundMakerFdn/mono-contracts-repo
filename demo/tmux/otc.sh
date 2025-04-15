#!/bin/bash

# Define the tmux session name
export SESSION_NAME="otc-workspace"

# Start a new tmux session
# The -d flag detaches the session so we can configure it before attaching
tmux new-session -d -s $SESSION_NAME

# Create 3 vertical panels initially
tmux split-window -h -t $SESSION_NAME:0
tmux split-window -h -t $SESSION_NAME:0
tmux split-window -v -t $SESSION_NAME:0.0

tmux resize-pane -t $SESSION_NAME:0.1 -x "33%"
tmux resize-pane -t $SESSION_NAME:0.2 -x "33%"

tmux send-keys -t $SESSION_NAME:0.0 "yarn hardhat node" C-m

# Panel 0.1 (bottom-left) - Deploy pSymm
tmux send-keys -t $SESSION_NAME:0.1 "sleep 5; yarn deploy-psymm" C-m

# Panel 0.2 (middle) - Start solver
tmux send-keys -t $SESSION_NAME:0.2 "sleep 8; yarn solver" C-m

# Panel 0.3 (right) - Start trader
tmux send-keys -t $SESSION_NAME:0.3 "sleep 10; yarn trader" C-m

# Attach to the session
tmux attach -t $SESSION_NAME
