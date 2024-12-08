# pSymm Protocol Specification

## Overview

This protocol defines the Socket.IO message format and flow for synchronizing CustodyRollupTree elements between parties. All messages use JSON format and require EIP712 signatures from both parties for each action.

## Connection

- Namespace: `/psymm`
- Authentication: Required via initial handshake with EIP712 wallet signature
- Rooms: Automatically joined based on custodyId

## EIP712 Domain

```json
{
  "name": "CustodyRollup",
  "version": "1",
  "chainId": "31337",
  "verifyingContract": "0xpSymmContractAddress"
}
```

## Message Structure

All messages follow this base format with EIP712 typed data:

```json
{
  "type": "messageType",
  "payload": {
    "custodyId": "string",
    "messageHash": "string",
    "signature": "string", // EIP712 signature
    "params": {}, // Action-specific parameters from custodyRollup.types.js
    "domain": {}, // EIP712 domain data
    "types": {} // EIP712 type definitions
  },
  "timestamp": "number",
  "nonce": "string"
}
```

## Message Types

### 1. Tree Synchronization Messages

#### `tree.propose`

Sent when initiating a new tree action:

```json
{
  "type": "tree.propose",
  "payload": {
    "custodyId": "1",
    "messageHash": "0x...",
    "signature": "0x...", // EIP712 signature
    "params": {
      // Any valid tree action params from custodyRollup.types.js
    },
    "domain": {
      "name": "CustodyRollup",
      "version": "1",
      "chainId": "31337",
      "verifyingContract": "0x..."
    },
    "types": {
      // EIP712 type definitions matching the params
    }
  }
}
```

#### `tree.sign`

Response to tree.propose with counterparty EIP712 signature:

```json
{
  "type": "tree.sign",
  "payload": {
    "custodyId": "1",
    "messageHash": "0x...",
    "signature": "0x..." // Counterparty EIP712 signature
  }
}
```

#### `tree.reject`

Reject a proposed tree action:

```json
{
  "type": "tree.reject",
  "payload": {
    "custodyId": "1",
    "messageHash": "0x...",
    "reason": "string"
  }
}
```

### (TODO, for now ignore) 2. Synchronization Control Messages

#### `sync.request`

Request full tree state:

```json
{
  "type": "sync.request",
  "payload": {
    "custodyId": "1",
    "fromNonce": "0x..." // Optional, for partial sync
  }
}
```

#### `sync.response`

Send full tree state:

```json
{
  "type": "sync.response",
  "payload": {
    "custodyId": "1",
    "tree": [] // Full array of signed messages from CustodyRollupTreeBuilder
  }
}
```

## Protocol Flow

1. **Initial Connection**

   - Client connects to `/psymm` namespace with EIP712 signed auth message
   - Joins room based on custodyId
     FOR NOW, ASSUME EMPTY TREE ON CONNECTION START (we'll implement later)
   - Requests sync with `sync.request`
   - Receives current tree with `sync.response`

2. **New Action Flow**

   - Party A sends `tree.propose` with action and EIP712 signature
   - Party B validates signature and data, then either:
     - Responds with `tree.sign` containing their EIP712 signature
     - Or sends `tree.reject` if invalid
   - Both parties add action+signatures to their local tree

3. **Error Handling**
   - Connection drops: Automatic reconnect and sync
   - Invalid EIP712 signatures: Reject with reason
   - Nonce mismatch: Request full sync

## Implementation Requirements

1. **Tree Consistency**

   - Both parties must maintain identical trees
   - Each action must have both EIP712 signatures before being added
   - Nonces must be sequential and follow A/B pattern (0xA... for PartyA, 0xB... for PartyB)

2. **Security**

   - All messages must be signed using EIP712
   - EIP712 signatures must be verified against expected addresses
   - Domain and type data must match exactly between parties
   - Nonces must be unique and sequential

## (TODO, ignore for now) Error Codes

For now, ignore

```json
{
  "INVALID_EIP712_SIGNATURE": "E001",
  "NONCE_MISMATCH": "E002",
  "INVALID_PARAMS": "E003",
  "TIMEOUT": "E004",
  "UNAUTHORIZED": "E005",
  "INVALID_DOMAIN": "E006",
  "INVALID_TYPES": "E007"
}
```

## EIP712 Type Definitions

The protocol uses the type definitions from custodyRollup.types.js for all actions. These must match exactly between parties and the smart contract implementations.
