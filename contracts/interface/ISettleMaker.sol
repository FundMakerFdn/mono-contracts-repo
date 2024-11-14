// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Settlement Maker Interface
interface ISettleMaker {
    // ============ Structs ============
    struct SoftForkLeaf {
        bytes32 settlementId;
        uint256 batchNumber;
        uint256 amountToPartyA;
        address settlementContract;
        bytes parameters;
    }

    struct ValidatorRegistryLeaf {
        address validatorAddress;
        bool isEntry;  // true for adding, false for removing
        uint256 timestamp;
    }

    struct ValidatorData {
        bool isWhitelisted;
    }

    struct Vote {
        address validator;
        bytes32 resolutionHash;
        uint256 weight;
        uint256 timestamp;
    }

    // ============ Events ============
    event BatchlyBatchCreated(uint256 indexed batchId, bytes32 merkleRoot);
    event VoteCast(address indexed validator, bytes32 indexed resolutionHash);
    event VoteModified(address indexed validator, bytes32 indexed resolutionHash, uint256 newWeight);
    event SettlementTypeRegistered(address indexed settlementContract);
    event SettlementTypeRemoved(address indexed settlementContract);
    event ValidatorRewardsClaimed(address indexed validator, uint256 indexed batchNumber, uint256 amount);
    event ValidatorWhitelisted(address indexed validator);
    event ValidatorRemoved(address indexed validator);

    // ============ Core Functions ============
    /// @notice Submit batch of settlements for voting
    /// @param leafData Array of settlement leaf data for the Merkle tree
    function submitSoftFork(SoftForkLeaf[] calldata leafData) external;

    /// @notice Verify a settlement is part of a batch
    /// @param batchNumber The batch number to verify against
    /// @param settlementId The settlement ID to verify
    /// @param merkleProof The Merkle proof for verification
    function verifySettlementInBatch(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) external view returns (bool);

    /// @notice Cast vote for a batch resolution
    function castVote(bytes32 resolutionHash) external;

    /// @notice Modify existing vote
    function modifyVote(bytes32 resolutionHash, uint256 newWeight) external;

    /// @notice Get current batch number
    function getCurrentBatch() external view returns (uint256);

    /// @notice Get vote details for a batch and validator
    function getVoteDetails(uint256 batch, address validator) external view returns (Vote memory);

    /// @notice Get total votes for a batch
    function getBatchVotes(uint256 batch) external view returns (uint256);

    /// @notice Get votes for a specific resolution
    function getResolutionVotes(bytes32 resolutionHash) external view returns (uint256);

    /// @notice Check if address is whitelisted validator
    function isWhitelistedValidator(address validator) external view returns (bool);

    /// @notice Claim rewards for correct votes
    function claimValidatorRewards(uint256 batchNumber, address token) external;

    /// @notice Get pending rewards for a validator
    function getValidatorRewards(
        address validator,
        uint256 batchNumber,
        address token
    ) external view returns (
        uint256 rewardAmount,
        bool votedCorrectly,
        bytes32 votedResolutionHash
    );

    /// @notice Submit validator registry changes
    function submitValidatorRegistryBatch(
        ValidatorRegistryLeaf[] calldata leaves,
        bytes32 merkleRoot
    ) external;

    /// @notice Execute validator registry change
    function executeValidatorRegistryChange(
        ValidatorRegistryLeaf calldata leaf,
        bytes32[] calldata merkleProof,
        uint256 batchId
    ) external;

    /// @notice Get validator status and data
    function getValidatorStatus(address validator) external view returns (bool isWhitelisted);
    function getValidatorData(address validator) external view returns (ValidatorData memory);
}
