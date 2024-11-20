// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Base Settlement Interface
interface ISettlement {
    enum SettlementState { Open, Settled }
    
    event SettlementExecuted(bytes32 indexed settlementId);

    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) external returns (bool);

    function getSettlementState(bytes32 settlementId) external view returns (SettlementState);
}
