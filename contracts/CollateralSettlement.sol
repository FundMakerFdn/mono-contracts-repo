// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Settlement.sol";
import "./interface/ICollateralSettlement.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

abstract contract CollateralSettlement is Settlement, ICollateralSettlement {
    using SafeERC20 for IERC20;
    using ECDSA for bytes;
    using MessageHashUtils for bytes32;

    struct CollateralData {
        address partyA;
        address partyB;
        uint256 collateralAmount;
        address collateralToken;
    }

    bytes32 private constant EARLY_AGREEMENT_TYPEHASH = 
        keccak256("EarlyAgreement(bytes32 settlementId,uint256 partyAAmount,uint256 partyBAmount)");
    
    bytes32 private constant INSTANT_WITHDRAW_TYPEHASH = 
        keccak256("InstantWithdraw(bytes32 settlementId,address replacedParty,uint256 instantWithdrawFee,uint256 partyAAmount,uint256 partyBAmount)");

    mapping(bytes32 => CollateralData) internal collateralData;

    constructor(
        address _settleMaker, 
        string memory name, 
        string memory version
    ) Settlement(_settleMaker, name, version) {}

    function createCollateralSettlement(
        address partyA,
        address partyB,
        uint256 collateralAmount,
        address collateralToken
    ) internal returns (bytes32) {
        bytes32 settlementId = keccak256(abi.encode(
            partyA,
            partyB,
            collateralAmount,
            collateralToken,
            block.timestamp,
            block.number
        ));

        settlements[settlementId] = SettlementState.Open;
        collateralData[settlementId] = CollateralData({
            partyA: partyA,
            partyB: partyB,
            collateralAmount: collateralAmount,
            collateralToken: collateralToken
        });

        // Transfer collateral from both parties
        IERC20(collateralToken).safeTransferFrom(partyA, address(this), collateralAmount);
        IERC20(collateralToken).safeTransferFrom(partyB, address(this), collateralAmount);

        return settlementId;
    }

    function executeEarlyAgreement(
        bytes32 settlementId,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory signature
    ) public virtual {
        require(settlements[settlementId] == SettlementState.Open, "Settlement not open");
        CollateralData storage data = collateralData[settlementId];

        bytes32 structHash = keccak256(abi.encode(
            EARLY_AGREEMENT_TYPEHASH,
            settlementId,
            partyAAmount,
            partyBAmount
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);

        require(
            (_verifySignature(hash, signature, data.partyA) && msg.sender == data.partyB) ||
            (_verifySignature(hash, signature, data.partyB) && msg.sender == data.partyA),
            "Invalid signature"
        );

        IERC20(data.collateralToken).safeTransfer(data.partyA, partyAAmount);
        IERC20(data.collateralToken).safeTransfer(data.partyB, partyBAmount);

        settlements[settlementId] = SettlementState.Settled;
        emit EarlyAgreementExecuted(settlementId, partyAAmount, partyBAmount);
    }

    function executeInstantWithdraw(
        bytes32 settlementId,
        address replacedParty,
        uint256 instantWithdrawFee,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory signature
    ) external virtual {
        require(settlements[settlementId] == SettlementState.Open, "Settlement not open");
        CollateralData storage data = collateralData[settlementId];

        bytes32 structHash = keccak256(abi.encode(
            INSTANT_WITHDRAW_TYPEHASH,
            settlementId,
            replacedParty,
            instantWithdrawFee,
            partyAAmount,
            partyBAmount
        ));
        bytes32 hash = _hashTypedDataV4(structHash);

        require(_verifySignature(hash, signature, replacedParty), "Invalid signature");
        require(
            replacedParty == data.partyA || 
            replacedParty == data.partyB, 
            "Invalid replaced party"
        );

        IERC20 token = IERC20(data.collateralToken);
        if (partyAAmount > 0) {
            token.safeTransfer(data.partyA, partyAAmount);
        }
        if (partyBAmount > 0) {
            token.safeTransfer(data.partyB, partyBAmount);
        }
        token.safeTransfer(msg.sender, instantWithdrawFee);

        settlements[settlementId] = SettlementState.Settled;
        emit InstantWithdrawExecuted(settlementId, replacedParty, instantWithdrawFee);
    }

    function _verifySignature(
        bytes32 hash,
        bytes memory signature,
        address expectedSigner
    ) internal pure returns (bool) {
        address recoveredSigner = ECDSA.recover(hash, signature);
        return recoveredSigner == expectedSigner;
    }

    function getCollateralData(bytes32 settlementId) external view returns (CollateralData memory) {
        return collateralData[settlementId];
    }
}
