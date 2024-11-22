// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @title Base Settlement Interface
interface ISettlement {
    // Settlement states:
    // 0 = OPEN (Settlement is open)
    // 1 = SETTLED (Settlement has been executed)
    uint8 constant OPEN = 0;
    uint8 constant SETTLED = 1;
    
    event SettlementCreated(bytes32 indexed settlementId, address indexed creator, address indexed settlementContract);
    event SettlementExecuted(bytes32 indexed settlementId);

    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) external;

    function getSettlementState(bytes32 settlementId) external view returns (SettlementState);
}
