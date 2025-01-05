#!/bin/bash

export SCENARIO="${1:-1.0}" # Scenario 1.0 by default
export PARTY="${2:-A}" # Party A by default

yarn hardhat run "apps/pSymm/demo/scenario$SCENARIO/party$PARTY.js" --network localhost
