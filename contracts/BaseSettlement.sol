// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "hardhat/console.sol";

abstract contract BaseSettlement is EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA for bytes;
    using MessageHashUtils for bytes32;

    enum SettlementState { Open, Settled, NextBatch }
    
    struct SettlementData {
        address partyA;
        address partyB;
        uint256 partyACollateral;
        uint256 partyBCollateral;
        address collateralToken;
        SettlementState state;
    }

    bytes32 private constant EARLY_AGREEMENT_TYPEHASH = 
        keccak256("EarlyAgreement(bytes32 settlementId,uint256 partyAAmount,uint256 partyBAmount,uint256 nonce)");
    
    bytes32 private constant INSTANT_WITHDRAW_TYPEHASH = 
        keccak256("InstantWithdraw(bytes32 settlementId,address replacedParty,uint256 instantWithdrawFee,uint256 partyAAmount,uint256 partyBAmount,uint256 nonce)");

    address public immutable settleMaker;
    mapping(bytes32 => SettlementData) internal settlements;
    mapping(address => uint256) private nonces;
    mapping(bytes32 => bool) public isScheduledForNextBatch;

    event SettlementCreated(bytes32 indexed settlementId, address indexed partyA, address indexed partyB);
    event EarlyAgreementExecuted(bytes32 indexed settlementId);
    event InstantWithdrawExecuted(
        bytes32 indexed settlementId, 
        address indexed replacedParty,
        uint256 fee
    );
    event MovedToNextBatch(bytes32 indexed settlementId);

    struct InstantWithdrawParams {
        address replacedParty;
        uint256 instantWithdrawFee;
        uint256 partyAAmount;
        uint256 partyBAmount;
    }

    constructor(address _settleMaker, string memory name, string memory version) 
        EIP712(name, version) 
    {
        settleMaker = _settleMaker;
    }

    function createSettlement(
        address partyA,
        address partyB,
        uint256 partyACollateral,
        uint256 partyBCollateral,
        address collateralToken
    ) internal returns (bytes32) {
        bytes32 settlementId = keccak256(
            abi.encodePacked(
                partyA,
                partyB,
                partyACollateral,
                partyBCollateral,
                collateralToken,
                block.timestamp
            )
        );

        settlements[settlementId] = SettlementData({
            partyA: partyA,
            partyB: partyB,
            partyACollateral: partyACollateral,
            partyBCollateral: partyBCollateral,
            collateralToken: collateralToken,
            state: SettlementState.Open
        });

        // Transfer collateral
        IERC20(collateralToken).safeTransferFrom(partyA, address(this), partyACollateral);
        IERC20(collateralToken).safeTransferFrom(partyB, address(this), partyBCollateral);

        emit SettlementCreated(settlementId, partyA, partyB);
        return settlementId;
    }

    function executeEarlyAgreement(
        bytes32 settlementId,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory partyASignature,
        bytes memory partyBSignature
    ) public virtual {
        SettlementData storage settlement = settlements[settlementId];
        require(settlement.state == SettlementState.Open, "Settlement not open");

        bytes32 structHash = keccak256(abi.encode(
            EARLY_AGREEMENT_TYPEHASH,
            settlementId,
            partyAAmount,
            partyBAmount,
            nonces[settlement.partyA]
        ));

        require(_verifySignature(structHash, partyASignature, settlement.partyA), "Invalid party A signature");
        require(_verifySignature(structHash, partyBSignature, settlement.partyB), "Invalid party B signature");

        // Increment nonce
        nonces[settlement.partyA]++;

        // Transfer collateral based on agreement
        IERC20(settlement.collateralToken).safeTransfer(settlement.partyA, partyAAmount);
        IERC20(settlement.collateralToken).safeTransfer(settlement.partyB, partyBAmount);

        settlement.state = SettlementState.Settled;
        emit EarlyAgreementExecuted(settlementId);
    }

    function executeInstantWithdraw(
        bytes32 settlementId,
        InstantWithdrawParams memory params,
        bytes memory signature
    ) public virtual {
        SettlementData storage settlement = settlements[settlementId];
        require(settlement.state == SettlementState.Open, "Settlement not open");

        // Verify signature from replaced party
        bytes32 structHash = keccak256(abi.encode(
            INSTANT_WITHDRAW_TYPEHASH,
            settlementId,
            params.replacedParty,
            params.instantWithdrawFee,
            params.partyAAmount,
            params.partyBAmount,
            nonces[params.replacedParty]
        ));
        bytes32 hash = _hashTypedDataV4(structHash);

        require(_verifySignature(hash, signature, params.replacedParty), "Invalid signature");
        require(
            params.replacedParty == settlement.partyA || 
            params.replacedParty == settlement.partyB, 
            "Invalid replaced party"
        );

        // Increment nonce
        nonces[params.replacedParty]++;

        // Transfer amounts including fee
        IERC20 token = IERC20(settlement.collateralToken);
        if (params.partyAAmount > 0) {
            token.safeTransfer(settlement.partyA, params.partyAAmount);
        }
        if (params.partyBAmount > 0) {
            token.safeTransfer(settlement.partyB, params.partyBAmount);
        }
        token.safeTransfer(msg.sender, params.instantWithdrawFee); // Fee to solver

        settlement.state = SettlementState.Settled;
        emit InstantWithdrawExecuted(settlementId, params.replacedParty, params.instantWithdrawFee);
    }

    function moveToNextBatch(bytes32 settlementId) external {
        SettlementData storage settlement = settlements[settlementId];
        require(settlement.state == SettlementState.Open, "Settlement not open");
        
        settlement.state = SettlementState.NextBatch;
        isScheduledForNextBatch[settlementId] = true;
        
        emit MovedToNextBatch(settlementId);
    }

    function getSettlementData(bytes32 settlementId) external view returns (SettlementData memory) {
        return settlements[settlementId];
    }

    function getNonce(address account) external view returns (uint256) {
        return nonces[account];
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _verifySignature(
        bytes32 hash,
        bytes memory signature,
        address signer
    ) internal pure returns (bool) {
        bytes32 ethSignedHash = hash.toEthSignedMessageHash();
        address recoveredSigner = ECDSA.recover(ethSignedHash, signature);
        
        // Debug logging
        console.log("Verification Debug:");
        console.log("Expected Signer:", signer);
        console.log("Recovered Signer:", recoveredSigner);
		console.log("Original Hash:");
        console.logBytes32(hash);
		console.log("Eth-signed Hash:");
        console.logBytes32(ethSignedHash);
		console.log("Signature:");
        console.logBytes(signature);
        
        return recoveredSigner == signer;
    }
}
