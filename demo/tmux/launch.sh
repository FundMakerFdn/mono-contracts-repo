#!/bin/bash

# launch.sh
SESSION="trading-app"

tmux new-session -d -s $SESSION

# Window 1: Hardhat
tmux rename-window -t $SESSION:0 'hardhat'
tmux send-keys -t $SESSION:0 'npx hardhat node' C-m

# Window 2: Frontend
tmux new-window -t $SESSION:1 -n 'frontend'
tmux send-keys -t $SESSION:1 'cd frontend && npm run dev' C-m

# Window 3: PartyA Backend
tmux new-window -t $SESSION:2 -n 'partyA'
tmux send-keys -t $SESSION:2 'cd partyA && node server.js' C-m

# Window 4: PartyB Backend
tmux new-window -t $SESSION:3 -n 'partyB'
tmux send-keys -t $SESSION:3 'cd partyB && node server.js' C-m

# Attach to session
tmux attach-session -t $SESSION