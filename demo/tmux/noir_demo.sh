#!/bin/bash

SESSION="trading-app"

tmux new-session -d -s $SESSION

# Window 1: Hardhat
tmux rename-window -t $SESSION:0 'hardhat'
tmux send-keys -t $SESSION:0 'npx hardhat node' C-m

# Window 2: Frontend
tmux new-window -t $SESSION:1 -n 'frontend'
tmux send-keys -t $SESSION:1 'yarn dev' C-m

# Window 3: PartyA Backend
tmux new-window -t $SESSION:2 -n 'partyB'
tmux send-keys -t $SESSION:2 'yarn server:b' C-m

# Window 4: PartyB Backend
tmux new-window -t $SESSION:3 -n 'partyA'
tmux send-keys -t $SESSION:3 'sleep 5; yarn server:a' C-m

# Attach to session
tmux attach-session -t $SESSION