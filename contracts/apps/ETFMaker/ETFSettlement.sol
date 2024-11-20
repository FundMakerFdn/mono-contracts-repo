// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "contracts/CollateralSettlement.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

/// @title ETF Settlement Contract
contract ETFSettlement is CollateralSettlement {
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
    ) CollateralSettlement(_settleMaker, name, version) {}

    function createETFSettlement(
        address partyA,
        address partyB,
        uint256 collateralAmount,
        address collateralToken,
        ETFParameters calldata params
    ) external returns (bytes32) {
        bytes32 settlementId = createCollateralSettlement(
            partyA,
            partyB,
            collateralAmount,
            collateralToken
        );
        
		etfParameters[settlementId] = params;
        
        return settlementId;
    }

    function executeEarlyAgreement(
        bytes32 settlementId,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory signature
    ) public override {
        // Get ETF parameters before executing parent's collateral transfers
        ETFParameters storage params = etfParameters[settlementId];
        CollateralData memory data = collateralData[settlementId];
        
        // Transfer ETF tokens from ETF creator (partyA) to buyer (partyB)
        IERC20(params.etfToken).safeTransferFrom(
            data.partyA,
            data.partyB, 
            params.etfTokenAmount
        );

        // Handle collateral distribution through parent implementation
        super.executeEarlyAgreement(
            settlementId,
            partyAAmount,
            partyBAmount,
            signature
        );
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
}
