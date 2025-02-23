#!/bin/bash
export SESSION_NAME="noir-demo-workspace"
# Start a new tmux session
tmux new-session -d -s $SESSION_NAME

# Create splits
tmux split-window -h -t $SESSION_NAME:0
tmux split-window -h -t $SESSION_NAME:0
tmux split-window -v -t $SESSION_NAME:0.0
tmux split-window -v -t $SESSION_NAME:0.3

# Adjust pane sizes
tmux resize-pane -t $SESSION_NAME:0.0 -x "25%"
tmux resize-pane -t $SESSION_NAME:0.2 -x "25%"

# Configure panes
# Leftmost pane (top) - Hardhat node
tmux send-keys -t $SESSION_NAME:0.0 "yarn hardhat node" C-m

# Leftmost pane (bottom) - Contract deployment
tmux send-keys -t $SESSION_NAME:0.1 "sleep 5; yarn noir_demo_deploy" C-m

# Center pane - Frontend (starts after deployment)
tmux send-keys -t $SESSION_NAME:0.2 "sleep 12; yarn dev" C-m

# Right panes - Servers (B starts first, then A)
tmux send-keys -t $SESSION_NAME:0.4 "sleep 10; yarn server:b" C-m
tmux send-keys -t $SESSION_NAME:0.3 "sleep 15; yarn server:a" C-m

tmux attach -t $SESSION_NAME