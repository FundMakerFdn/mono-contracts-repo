// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @title Base Settlement Interface
interface ISettlement {
    // Settlement states:
  
    event SettlementCreated(bytes32 indexed settlementId, address indexed creator, address indexed settlementContract);
    event SettlementExecuted(bytes32 indexed settlementId);

    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) external;

    function getSettlementState(bytes32 settlementId) external view returns (uint8);
}
