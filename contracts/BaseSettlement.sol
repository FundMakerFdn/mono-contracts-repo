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
    mapping(bytes32 => bool) public isScheduledForNextBatch;

    event SettlementCreated(bytes32 indexed settlementId, address indexed partyA, address indexed partyB);
    event EarlyAgreementExecuted(bytes32 indexed settlementId);
    event InstantWithdrawExecuted(
        bytes32 indexed settlementId, 
        address indexed replacedParty,
        uint256 fee
    );
    event MovedToNextBatch(bytes32 indexed settlementId);


    constructor(address _settleMaker, string memory name, string memory version) 
        EIP712(name, version) 
    {
        settleMaker = _settleMaker;
    }

    function createSettlement(
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

        settlements[settlementId] = SettlementData({
            partyA: partyA,
            partyB: partyB,
            collateralAmount: collateralAmount,
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
        bytes memory signature
    ) public virtual {
        SettlementData storage settlement = settlements[settlementId];
        require(settlement.state == SettlementState.Open, "Settlement not open");

        // Get the current nonce
        uint256 currentNonce = nonces[settlement.partyA];

        // Create the EIP712 hash
        bytes32 structHash = keccak256(abi.encode(
            EARLY_AGREEMENT_TYPEHASH,
            settlementId,
            partyAAmount,
            partyBAmount,
            currentNonce
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);

        // Verify signatures directly against the parties from the settlement
        require(
            (_verifySignature(hash, signature, settlement.partyA) && msg.sender == settlement.partyB ) ||
            (_verifySignature(hash, signature, settlement.partyB) && msg.sender == settlement.partyA ),
            "Invalid signature"
        );


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
        address replacedParty,
        uint256 instantWithdrawFee,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory signature
    ) public virtual {
        SettlementData storage settlement = settlements[settlementId];
        require(settlement.state == SettlementState.Open, "Settlement not open");

        // Verify signature from replaced party
        bytes32 structHash = keccak256(abi.encode(
            INSTANT_WITHDRAW_TYPEHASH,
            settlementId,
            replacedParty,
            instantWithdrawFee,
            partyAAmount,
            partyBAmount,
            nonces[replacedParty]
        ));
        bytes32 hash = _hashTypedDataV4(structHash);

        require(_verifySignature(hash, signature, replacedParty), "Invalid signature");
        require(
            replacedParty == settlement.partyA || 
            replacedParty == settlement.partyB, 
            "Invalid replaced party"
        );

        // Increment nonce
        nonces[replacedParty]++;

        // Transfer amounts including fee
        IERC20 token = IERC20(settlement.collateralToken);
        if (partyAAmount > 0) {
            token.safeTransfer(settlement.partyA, partyAAmount);
        }
        if (partyBAmount > 0) {
            token.safeTransfer(settlement.partyB, partyBAmount);
        }
        token.safeTransfer(msg.sender, instantWithdrawFee); // Fee to solver

        settlement.state = SettlementState.Settled;
        emit InstantWithdrawExecuted(settlementId, replacedParty, instantWithdrawFee);
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
        address expectedSigner
    ) internal pure returns (bool) {
        address recoveredSigner = ECDSA.recover(hash, signature);
        
        // Debug logging
        // console.log("Verification Debug:");
        // console.log("Expected Signer:", expectedSigner);
        // console.log("Recovered Signer:", recoveredSigner);
        // console.log("Hash to verify:");
        // console.logBytes32(hash);
        // console.log("Signature:");
        // console.logBytes(signature);
        
        return recoveredSigner == expectedSigner;
    }
}
