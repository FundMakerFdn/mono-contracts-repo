#!/bin/bash

./tmux/base.sh

SCENARIO="${1:-1.0}" # Scenario 1.0 by default

# Right pane (top)
tmux send-keys -t $SESSION_NAME:0.3 "sleep 10; yarn addSymm 0; sleep 3; yarn hardhat run pSymm/demo/scenario$SCENARIO/partyA.js" C-m
tmux send-keys -t $SESSION_NAME:0.4 "sleep 10; yarn addSymm 1; yarn hardhat run pSymm/demo/scenario$SCENARIO/partyB.js" C-m

tmux attach -t $SESSION_NAME
