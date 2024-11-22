// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Base Settlement Interface
interface ISettlement {
    enum SettlementState { Open, Settled }
    
    event SettlementCreated(bytes32 indexed settlementId, address indexed creator, address indexed settlementContract);
    event SettlementExecuted(bytes32 indexed settlementId);

    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) external;

    function getSettlementState(bytes32 settlementId) external view returns (SettlementState);
}
