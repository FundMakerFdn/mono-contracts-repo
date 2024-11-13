// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Settlement Interface
interface ISettlement {
    // ============ Events ============
    event SettlementCreated(bytes32 indexed settlementId, address indexed partyA, address indexed partyB);
    event CollateralLocked(bytes32 indexed settlementId, uint256 amount);
    event CollateralReleased(bytes32 indexed settlementId);
    event SettlementMovedToNextBatch(bytes32 indexed settlementId, uint256 indexed currentBatch, uint256 indexed nextBatch);
    event EarlyAgreementExecuted(bytes32 indexed settlementId, uint256 partyAAmount, uint256 partyBAmount, address indexed partyA, address indexed partyB);

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

    // ============ View Functions ============
    function getSettleMaker() external view returns (address);
    function getSettlementData(bytes32 settlementId) external view returns (SettlementData memory);
    function isScheduledForNextBatch(bytes32 settlementId) external view returns (bool);

    // ============ Core Functions ============
    function createSettlement(
        address partyA,
        address partyB,
        uint256 collateralAmount,
        address collateralToken
    ) external returns (bytes32 settlementId);

    function claimCollateral(bytes32 settlementId) external;
    function moveToNextBatch(bytes32 settlementId, bytes32[] calldata merkleProof) external returns (bool);

    function executeEarlyAgreement(
        bytes32 settlementId,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory partyASignature,
        bytes memory partyBSignature
    ) external;
}
