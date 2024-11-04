// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseSettlement.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ETF Settlement Contract
contract ETFSettlement is BaseSettlement {
    using SafeERC20 for IERC20;
    struct ETFParameters {
        uint256 priceMint;
        uint256 mintTime;
        uint256 etfTokenAmount;
        address etfToken;
        uint256 interestRate;
        address interestRatePayer;
    }

    // ============ Storage ============
    mapping(bytes32 => ETFParameters) private etfParameters;

    constructor(
        address _settleMaker,
        string memory name,
        string memory version
    ) BaseSettlement(_settleMaker, name, version) {}

    // ============ External Functions ============
    function createETFSettlement(
        address partyA,
        address partyB,
        uint256 partyACollateral,
        uint256 partyBCollateral,
        address collateralToken,
        ETFParameters calldata params
    ) external returns (bytes32) {
        // Transfer ETF tokens from Party A
        IERC20(params.etfToken).safeTransferFrom(
            partyA,
            address(this),
            params.etfTokenAmount
        );

        bytes32 settlementId = createSettlement(
            partyA,
            partyB,
            partyACollateral,
            partyBCollateral,
            collateralToken
        );
        
        etfParameters[settlementId] = params;
        return settlementId;
    }

    function executeEarlyAgreement(
        bytes32 settlementId,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory partyASignature,
        bytes memory partyBSignature
    ) external override {
        SettlementData storage settlement = settlements[settlementId];
        ETFParameters storage params = etfParameters[settlementId];
        
        // Transfer ETF tokens back based on agreement
        if (partyAAmount > 0) {
            IERC20(params.etfToken).safeTransfer(settlement.partyA, params.etfTokenAmount);
        } else {
            IERC20(params.etfToken).safeTransfer(settlement.partyB, params.etfTokenAmount);
        }

        BaseSettlement(this).executeEarlyAgreement(
            settlementId,
            partyAAmount,
            partyBAmount,
            partyASignature,
            partyBSignature
        );
    }

    // ============ View Functions ============
    function getETFParameters(bytes32 settlementId) external view returns (ETFParameters memory) {
        return etfParameters[settlementId];
    }
}
