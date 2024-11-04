// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Base Settlement Interface
abstract contract ISettlement {
	address private settleMaker;
	constructor(address _settleMaker) {
		settleMaker = _settleMaker;
	}
    function getSettleMaker() virtual external view returns (address);
	

    // ============ Events ============
    event SettlementCreated(bytes32 indexed settlementId, address indexed partyA, address indexed partyB);
    event CollateralLocked(bytes32 indexed settlementId, uint256 amount);
    event CollateralReleased(bytes32 indexed settlementId);
    event SettlementMovedToNextBatch(bytes32 indexed settlementId, uint256 indexed currentBatch, uint256 indexed nextBatch);

    // ============ Structs ============
    struct SettlementData {
        address partyA;
        address partyB;
        uint256 settlementTime;
        uint256 partyACollateral;
        uint256 partyBCollateral;
        address collateralToken;
        uint8 state; // 0=open, 1=settled, 2=nextBatch
    }

    // ============ Core Functions ============
	/// @notice Create new settlement, lock the collateral
    function createSettlement(
        address partyA,
        address partyB,
        uint256 partyACollateral,
        uint256 partyBCollateral,
        address collateralToken
    ) external virtual returns (bytes32 settlementId);

    function claimCollateral(bytes32 settlementId) external virtual;

    // Keep track of non-settled settlements and include to next softFork offchain without onchain ?
    function moveToNextBatch(bytes32 settlementId) external virtual returns (bool);
    
    function isScheduledForNextBatch(bytes32 settlementId) external virtual view returns (bool);
}

/// @title ETF Settlement Interface
abstract contract IETFSettlement is ISettlement {
    struct ETFParameters {
        uint256 priceMint;
        uint256 mintTime;
        uint256 etfTokenAmount;
        address etfToken;
        uint256 interestRate;
        address interestRatePayer;
    }
}

/// @title PSymm Settlement Interface
abstract contract IPSymmSettlement is ISettlement {
    struct PSymmParameters {
        uint256 entryPrice;
        uint256 settlementPrice;
        address pSymmContract;
        uint256 derivativeId;
    }
}


/// @title RFQ Registry Interface - Basic solver IP registry
abstract contract RegistryRFQ {
    struct SolverData {
        string ipAddress;
    }
    
    event SolverRegistered(address indexed solver, string ipAddress);
    event SolverRemoved(address indexed solver);
    
    /// @notice Register as a solver with IP address
    /// @param ipAddress The solver's IP address for RFQ communication
    function registerSolver(string calldata ipAddress) external virtual;
    
    /// @notice Remove solver from registry
    function removeSolver() external virtual;

    /// @notice Get solver's IP address
    function getSolver(address solver) external virtual view returns (string memory ipAddress);
}


/// TODO: implement slashing
/// @title SettleMaker Core Interface
abstract contract ISettleMaker {
    // ============ Merkle Tree Structure ============
    struct SoftForkLeaf {
        bytes32 settlementId;
        uint256 batchNumber;
        uint256 amountToPartyA;
        address settlementContract;
        bytes parameters;
    }

    // ============ Events ============
    event BatchlyBatchCreated(uint256 indexed batchId, bytes32 merkleRoot);
    event VoteCast(address indexed voter, bytes32 indexed resolutionHash);
    event VoteModified(address indexed voter, bytes32 indexed resolutionHash, uint256 newWeight);
    event SettlementTypeRegistered(address indexed settlementContract);
    event SettlementTypeRemoved(address indexed settlementContract);
    event VoterRewardsClaimed(address indexed voter, uint256 indexed batchNumber, uint256 amount);
    event SoftForkProposed(bytes32 indexed settlementId, bytes32 proposalHash);
    event SoftForkExecuted(bytes32 indexed settlementId, uint256 resolution);
    event ValidatorWhitelisted(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event SymmDelegated(address indexed delegator, address indexed validator, uint256 amount);
    event SymmUndelegated(address indexed delegator, address indexed validator, uint256 amount);

    // ============ Structs ============
    struct ValidatorRegistryLeaf {
        address validatorAddress;
        bool isEntry;  // true for adding, false for removing
        uint256 timestamp;
    }

    struct ValidatorData {
        bool isWhitelisted;
        uint256 totalDelegated;
    }

    struct SoftFork {
        bytes32 settlementsMerkleRoot;
        bytes32 validatorsMerkleRoot; 
        uint256 batchNumber;
        mapping(bytes32 => bool) processedSettlements;
        mapping(bytes32 => bool) processedValidatorChanges;
        uint256 totalVotes;
        uint256 settlementsTimeEnd;
        uint256 votesTimeEnd;
        bool finalized;
        mapping(address => uint256) rewardPools; // token address => total reward amount
        mapping(address => mapping(address => uint256)) claimedRewards; // token address => (voter address => claimed amount)
    }

    struct Vote {
        address voter;
        bytes32 resolutionHash;
        uint256 weight;
        uint256 timestamp;
    }

    // ============ Core Functions ============
    /// @notice Register a new settlement type with merkle proof verification
    /// @param settlementContract Address of the settlement contract to register
    /// @param merkleProof Merkle proof verifying the settlement type is valid
    /// @param merkleLeafData ABI encoded data used to construct the leaf for verification
    function registerSettlementType(
        address settlementContract,
        bytes32[] calldata merkleProof,
        bytes calldata merkleLeafData
    ) external virtual;

    /// @notice Remove a settlement type with merkle proof verification
    /// @param settlementContract Address of the settlement contract to remove
    /// @param merkleProof Merkle proof verifying the removal is valid
    /// @param merkleLeafData ABI encoded data used to construct the leaf for verification
    function removeSettlementType(
        address settlementContract,
        bytes32[] calldata merkleProof,
        bytes calldata merkleLeafData
    ) external virtual;

    /// @notice Check if a settlement type is currently valid
    function isValidSettlementType(address settlementContract) external view virtual returns (bool);
    function validateSettlement(bytes32 settlementId, bytes calldata data) external view virtual returns (bool);
    
    /// @notice Submit batchly batch of settlements as a Merkle tree
    /// @param leafData Array of settlement leaf data for the Merkle tree
    function submitSoftFork(
        SoftForkLeaf[] calldata leafData
    ) external virtual;

    /// @notice Verify a settlement is part of a batchly batch
    /// @param batchNumber The batch number to verify against
    /// @param leaf The leaf data for the settlement
    /// @param proof The Merkle proof for the leaf
    function verifySettlementInBatch(
        uint256 batchNumber,
        SoftForkLeaf calldata leaf,
        bytes32[] calldata proof
    ) external view virtual returns (bool);

    /// @notice Get the encoded leaf hash for a settlement
    /// @param leaf The leaf data to encode
    function getLeafHash(SoftForkLeaf calldata leaf) external pure virtual returns (bytes32);
    function castVote(bytes32 resolutionHash) external virtual;
    function getCurrentBatch() external view virtual returns (uint256);

    // ============ Soft Fork Functions ============
    function proposeSoftFork(
		bytes32 settlementId, uint256 resolution
	) external virtual returns (bytes32);

    function verifySoftFork(
		bytes32 settlementId, uint256 resolution
	) external view virtual returns (bool);

    function executeSoftFork(
		bytes32 settlementId, uint256 resolution
	) external virtual;

    // ============ View Functions ============
    function getVoteDetails(uint256 batch, address voter) external view virtual returns (Vote memory);
    function getBatchVotes(uint256 batch) external view virtual returns (uint256);
    function getResolutionVotes(bytes32 resolutionHash) external view virtual returns (uint256);
    function isWhitelistedVoter(address voter) external view virtual returns (bool);
    function getSoftFork(bytes32 settlementId) external view virtual returns (uint256 resolution, bytes32 proposalHash, bool executed);
    
    // ============ Rewards Functions ============
    function claimVoterRewards(uint256 batchNumber, address token) external virtual;
    function getVoterRewards(address voter, uint256 batchNumber, address token) external view virtual returns (
        uint256 rewardAmount,
        bool votedCorrectly,
        bytes32 votedResolutionHash
    );

    // ============ Validator Management Functions ============
    // Removed since validator registry changes now use batch process
    function delegateToValidator(address validator, uint256 amount) external virtual;
    function undelegateFromValidator(address validator, uint256 amount) external virtual;
    function getValidatorData(address validator) external view virtual returns (
        bool isWhitelisted,
        uint256 totalDelegated
    );
    function getDelegatedAmount(address delegator, address validator) external view virtual returns (uint256);
    function claimDelegatingRewards(address validator) external virtual returns (uint256);
    function getPendingRewards(address delegator, address validator) external view virtual returns (uint256);
    function getTotalValidatorRewards(address validator) external view virtual returns (uint256);

    // ============ Validator Registry Functions ============
    /// @notice Submit batch of validator registry changes for voting
    function submitValidatorRegistryBatch(
        ValidatorRegistryLeaf[] calldata leaves,
        bytes32 merkleRoot
    ) external virtual;

    /// @notice Execute approved validator registry change with merkle proof
    function executeValidatorRegistryChange(
        ValidatorRegistryLeaf calldata leaf,
        bytes32[] calldata merkleProof,
        uint256 batchId
    ) external virtual;

    /// @notice Get current validator status
    function getValidatorStatus(address validator) external view virtual returns (bool isWhitelisted);
    
    // ============ Instant Withdraw Functions ============
    function executeInstantWithdraw(
        bytes32 settlementId,
        address replacedParty,
        uint256 instantWithdrawFee,
        bytes calldata signature
    ) external virtual;
}
