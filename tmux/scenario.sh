#!/bin/bash

source ./tmux/base.sh

export SCENARIO="${1:-1.0}" # Scenario 1.0 by default

# Right pane (top)
tmux send-keys -t $SESSION_NAME:0.3 "sleep 10; yarn addSymm 0; sleep 3; yarn party $SCENARIO A" C-m
tmux send-keys -t $SESSION_NAME:0.4 "sleep 10; yarn addSymm 1; yarn party $SCENARIO B" C-m

tmux attach -t $SESSION_NAME
