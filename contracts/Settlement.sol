// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Base Settlement Contract
abstract contract Settlement {
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
