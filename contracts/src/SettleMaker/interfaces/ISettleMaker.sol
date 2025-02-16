// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @title Settlement Maker Interface
interface ISettleMaker {
    // State enum for batch lifecycle
    // States:
    // 0 = PAUSE (Before settlement start)
    // 1 = SETTLEMENT (During settlement submission)
    // 2 = VOTING (During voting period)
    // 3 = VOTING_END (After voting ends)
    /* uint8 constant PAUSE = 0;
    uint8 constant SETTLEMENT = 1;
    uint8 constant VOTING = 2;
    uint8 constant VOTING_END = 3;
    */ 

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
    event SoftForkSubmitted(bytes32 indexed softForkRoot, bytes32 dataHash, address indexed submitter);

    // View functions
    function symmToken() external view returns (address);
    function getCurrentState() external view returns (uint8);
    function editSettlementAddress() external view returns (address);
    function currentBatchMetadata() external view returns (BatchMetadata memory);
    function batchSoftFork(uint256 batchNumber) external view returns (bytes32);
    function batchDataHashes(uint256 batchNumber) external view returns (bytes32);
    function votes(bytes32 softForkRoot) external view returns (uint256);
    function hasVoted(address validator, bytes32 softForkRoot) external view returns (bool);
    function currentBatchWinner() external view returns (bytes32);
    function currentBatch() external view returns (uint256);
    function verifyValidator(address account) external view returns (bool);
    function getCurrentUnresolvedRoot() external view returns (bytes32);
    function getCurrentUnresolvedDataHash() external view returns (bytes32);

    // State changing functions
    function setEditSettlement(address newEditSettlement) external;
    function castVote(bytes32 softForkRoot) external;
    function finalizeBatchWinner() external;

    function updateBatchMetadata(
        uint256 settlementStart,
        uint256 votingStart, 
        uint256 votingEnd
    ) external;
}
