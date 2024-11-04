// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Base Settlement Contract
contract Settlement {
    address private immutable settleMaker;
    
    // ============ Storage ============
    mapping(bytes32 => SettlementData) private settlements;
    mapping(bytes32 => bool) private nextBatchSchedule;
    uint256 private currentBatch;
    
    constructor(address _settleMaker) {
        require(_settleMaker != address(0), "Settlement: zero address");
        settleMaker = _settleMaker;
    }

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

    // ============ View Functions ============
    function getSettleMaker() external view returns (address) {
        return settleMaker;
    }

    function getSettlementData(bytes32 settlementId) external view returns (SettlementData memory) {
        return settlements[settlementId];
    }

    function isScheduledForNextBatch(bytes32 settlementId) external view returns (bool) {
        return nextBatchSchedule[settlementId];
    }

    // ============ Core Functions ============
    /// @notice Create new settlement, lock the collateral
    function createSettlement(
        address partyA,
        address partyB,
        uint256 partyACollateral,
        uint256 partyBCollateral,
        address collateralToken
    ) external returns (bytes32 settlementId) {
        require(partyA != address(0) && partyB != address(0), "Settlement: zero address");
        require(collateralToken != address(0), "Settlement: invalid token");
        require(partyACollateral > 0 || partyBCollateral > 0, "Settlement: zero collateral");

        // Generate unique settlement ID
        settlementId = keccak256(abi.encodePacked(
            partyA,
            partyB,
            partyACollateral,
            partyBCollateral,
            collateralToken,
            block.timestamp
        ));

        // Store settlement data
        settlements[settlementId] = SettlementData({
            partyA: partyA,
            partyB: partyB,
            settlementTime: block.timestamp,
            partyACollateral: partyACollateral,
            partyBCollateral: partyBCollateral,
            collateralToken: collateralToken,
            state: 0 // Open state
        });

        emit SettlementCreated(settlementId, partyA, partyB);
        emit CollateralLocked(settlementId, partyACollateral + partyBCollateral);

        return settlementId;
    }

    function claimCollateral(bytes32 settlementId) external {
        SettlementData storage settlement = settlements[settlementId];
        require(settlement.partyA != address(0), "Settlement: does not exist");
        require(settlement.state == 1, "Settlement: not settled");
        
        // Implementation of collateral claiming logic would go here
        // This would interact with the collateral token contract
        
        emit CollateralReleased(settlementId);
    }

    function moveToNextBatch(bytes32 settlementId) external returns (bool) {
        SettlementData storage settlement = settlements[settlementId];
        require(settlement.partyA != address(0), "Settlement: does not exist");
        require(settlement.state == 0, "Settlement: not open");
        
        settlement.state = 2; // nextBatch state
        nextBatchSchedule[settlementId] = true;
        
        emit SettlementMovedToNextBatch(
            settlementId,
            currentBatch,
            currentBatch + 1
        );
        
        return true;
    }
}
