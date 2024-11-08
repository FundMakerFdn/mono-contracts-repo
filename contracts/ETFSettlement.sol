// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseSettlement.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

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

    bytes32 private constant ETF_SETTLEMENT_TYPEHASH = 
        keccak256("ETFSettlement(uint256 priceMint,uint256 mintTime,uint256 etfTokenAmount,address etfToken,uint256 interestRate,address interestRatePayer)");

    mapping(bytes32 => ETFParameters) private etfParameters;

    constructor(
        address _settleMaker,
        string memory name,
        string memory version
    ) BaseSettlement(_settleMaker, name, version) {}

    function createETFSettlement(
        address partyA,
        address partyB,
        uint256 partyACollateral,
        uint256 partyBCollateral,
        address collateralToken,
        ETFParameters calldata params
    ) external returns (bytes32) {
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
    ) public override {
        SettlementData storage settlement = settlements[settlementId];
        ETFParameters storage params = etfParameters[settlementId];

        // Call parent implementation first for signature verification
        super.executeEarlyAgreement(
            settlementId,
            partyAAmount,
            partyBAmount,
            partyASignature,
            partyBSignature
        );
        
        // Transfer ETF tokens based on agreement
        if (partyAAmount > 0) {
            IERC20(params.etfToken).safeTransfer(settlement.partyA, params.etfTokenAmount);
        } else {
            IERC20(params.etfToken).safeTransfer(settlement.partyB, params.etfTokenAmount);
        }
    }

    function getETFParameters(bytes32 settlementId) external view returns (ETFParameters memory) {
        ETFParameters memory params = etfParameters[settlementId];
        return params;
    }

    function calculateETFHash(ETFParameters memory params) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            ETF_SETTLEMENT_TYPEHASH,
            params.priceMint,
            params.mintTime,
            params.etfTokenAmount,
            params.etfToken,
            params.interestRate,
            params.interestRatePayer
        ));
        return _hashTypedDataV4(structHash);
    }

    function calculateLeaf(
        bytes32 settlementId, 
        uint256 partyAAmount, 
        uint256 partyBAmount, 
        uint256 nonce
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            keccak256("EarlyAgreement(bytes32 settlementId,uint256 partyAAmount,uint256 partyBAmount,uint256 nonce)"),
            settlementId,
            partyAAmount,
            partyBAmount,
            nonce
        ));
        return _hashTypedDataV4(structHash);
    }
}
