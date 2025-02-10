// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./Settlement.sol";
import "./interfaces/ICollateralSettlement.sol";
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

    mapping(bytes32 => CollateralData) internal lockedCollateral;

    constructor(
        address _settleMaker, 
        string memory name, 
        string memory version
    ) Settlement(_settleMaker, name, version) {}

    function _lockCollateral(
        bytes32 settlementId,
        address partyA,
        address partyB,
        uint256 collateralAmount,
        address collateralToken
    ) internal {
        IERC20 token = IERC20(collateralToken);
        token.safeTransferFrom(partyA, address(this), collateralAmount);
        token.safeTransferFrom(partyB, address(this), collateralAmount);
        
        lockedCollateral[settlementId] = CollateralData({
            partyA: partyA,
            partyB: partyB,
            collateralAmount: collateralAmount,
            collateralToken: collateralToken
        });
    }

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

        settlements[settlementId] = 0;
        
        _lockCollateral(
            settlementId,
            partyA,
            partyB,
            collateralAmount,
            collateralToken
        );

        return settlementId;
    }

    function executeEarlyAgreement(
        bytes32 settlementId,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory signature
    ) public virtual {
        require(settlements[settlementId] == 0, "Settlement not open");
        CollateralData storage data = lockedCollateral[settlementId];

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

        settlements[settlementId] = 1;
        emit EarlyAgreementExecuted(settlementId, partyAAmount, partyBAmount);
    }

    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) public virtual override(ISettlement, Settlement) {
        super.executeSettlement(batchNumber, settlementId, merkleProof);

        CollateralData storage data = lockedCollateral[settlementId];
        _releaseCollateral(settlementId);
        
        emit SettlementExecuted(settlementId, data.collateralAmount, data.collateralAmount);
    }

    function executeInstantWithdraw(
        bytes32 settlementId,
        address replacedParty,
        uint256 instantWithdrawFee,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory signature
    ) external virtual {
        require(settlements[settlementId] == 0, "Settlement not open");
        CollateralData storage data = lockedCollateral[settlementId];

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

        settlements[settlementId] = 1;
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

    function getLockedCollateral(bytes32 settlementId) external view returns (CollateralData memory) {
        return lockedCollateral[settlementId];
    }

    function _releaseCollateral(bytes32 settlementId) internal {
        CollateralData storage data = lockedCollateral[settlementId];
        
        address partyA = data.partyA;
        address partyB = data.partyB;
        uint256 amount = data.collateralAmount;
        address tokenAddr = data.collateralToken;

        // Verify data is valid
        require(partyA != address(0), "Invalid party A address");
        require(partyB != address(0), "Invalid party B address"); 
        require(amount > 0, "Invalid collateral amount");
        require(tokenAddr != address(0), "Invalid token address");
        
        // Delete mapping first to prevent reentrancy
        delete lockedCollateral[settlementId];
        
        // Transfer after state changes using cached values
        IERC20(tokenAddr).safeTransfer(partyA, amount);
        IERC20(tokenAddr).safeTransfer(partyB, amount);
    }
}
