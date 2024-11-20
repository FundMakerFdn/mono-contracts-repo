// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Settlement Maker Interface
interface ISettleMaker {
    // State enum for batch lifecycle
    enum StateEnum {
        PAUSE,      // Before settlement start
        SETTLEMENT, // During settlement submission
        VOTING,     // During voting period
        VOTING_END  // After voting ends
    }

    // Batch metadata structure 
    struct BatchMetadata {
        uint256 settlementStart;
        uint256 votingStart;
        uint256 votingEnd;
    }

    // Events
    event VoteCast(address indexed validator, bytes32 softForkRoot);
    event BatchFinalized(uint256 indexed batchNumber, bytes32 winningRoot);
    event EditSettlementUpdated(address newEditSettlement);

    // View functions
    function symmToken() external view returns (address);
    function getCurrentState() external view returns (StateEnum);
    function editSettlementAddress() external view returns (address);
    function currentBatchMetadata() external view returns (BatchMetadata memory);
    function batchSoftFork(uint256 batchNumber) external view returns (bytes32);
    function votes(bytes32 softForkRoot) external view returns (uint256);
    function hasVoted(address validator, bytes32 softForkRoot) external view returns (bool);
    function currentBatchWinner() external view returns (bytes32);
    function currentBatch() external view returns (uint256);
    function isValidator(address account) external view returns (bool);

    // State changing functions
    function setEditSettlement(address newEditSettlement) external;
    function castVote(bytes32 softForkRoot) external;
    function finalizeBatchWinner() external;
}
