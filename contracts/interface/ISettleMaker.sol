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
        uint256 totalDelegated;
    }

    struct Vote {
        address voter;
        bytes32 resolutionHash;
        uint256 weight;
        uint256 timestamp;
    }

    // ============ Events ============
    event BatchlyBatchCreated(uint256 indexed batchId, bytes32 merkleRoot);
    event VoteCast(address indexed voter, bytes32 indexed resolutionHash);
    event VoteModified(address indexed voter, bytes32 indexed resolutionHash, uint256 newWeight);
    event SettlementTypeRegistered(address indexed settlementContract);
    event SettlementTypeRemoved(address indexed settlementContract);
    event VoterRewardsClaimed(address indexed voter, uint256 indexed batchNumber, uint256 amount);
    event ValidatorWhitelisted(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event SymmDelegated(address indexed delegator, address indexed validator, uint256 amount);
    event SymmUndelegated(address indexed delegator, address indexed validator, uint256 amount);

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

    /// @notice Get vote details for a batch and voter
    function getVoteDetails(uint256 batch, address voter) external view returns (Vote memory);

    /// @notice Get total votes for a batch
    function getBatchVotes(uint256 batch) external view returns (uint256);

    /// @notice Get votes for a specific resolution
    function getResolutionVotes(bytes32 resolutionHash) external view returns (uint256);

    /// @notice Check if address is whitelisted validator
    function isWhitelistedVoter(address voter) external view returns (bool);

    /// @notice Claim rewards for correct votes
    function claimVoterRewards(uint256 batchNumber, address token) external;

    /// @notice Get pending rewards for a voter
    function getVoterRewards(
        address voter,
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

    /// @notice Delegation functions
    function delegateToValidator(address validator, uint256 amount) external;
    function undelegateFromValidator(address validator, uint256 amount) external;
    function getDelegatedAmount(address delegator, address validator) external view returns (uint256);
    function getPendingRewards(address delegator, address validator) external view returns (uint256);
    function getTotalValidatorRewards(address validator) external view returns (uint256);
}
