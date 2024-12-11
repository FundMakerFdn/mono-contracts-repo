#!/bin/bash

# Define the tmux session name
SESSION_NAME="workspace"

# Start a new tmux session
# The -d flag detaches the session so we can configure it before attaching
# The -s flag specifies the session name
tmux new-session -d -s $SESSION_NAME

# Create a global vertical split in the center
tmux split-window -h -t $SESSION_NAME:0

# Create a global vertical split on the right
tmux split-window -h -t $SESSION_NAME:0

# Split the leftmost pane horizontally
tmux split-window -v -t $SESSION_NAME:0.0


tmux resize-pane -t $SESSION_NAME:0.0 -x 10
tmux resize-pane -t $SESSION_NAME:0.2 -x 25


# Configure each pane to print its name and sleep
# Leftmost pane (top)
tmux send-keys -t $SESSION_NAME:0.0 "yarn hardhat node" C-m

# Leftmost pane (bottom)
tmux send-keys -t $SESSION_NAME:0.1 "sleep 5; yarn miner" C-m

# Center vertical pane
tmux send-keys -t $SESSION_NAME:0.2 "sleep 7; yarn deploy" C-m

# # Right vertical pane
# tmux send-keys -t $SESSION_NAME:0.3 "echo 'Pane 4: Right'; sleep 999999" C-m

# Attach to the session
tmux attach -t $SESSION_NAME

