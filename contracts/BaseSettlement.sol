// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract BaseSettlement is EIP712 {
    using SafeERC20 for IERC20;

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

    address public immutable settleMaker;
    mapping(bytes32 => SettlementData) internal settlements;
    mapping(address => uint256) private nonces;
    mapping(bytes32 => bool) public isScheduledForNextBatch;

    event SettlementCreated(bytes32 indexed settlementId, address indexed partyA, address indexed partyB);
    event EarlyAgreementExecuted(bytes32 indexed settlementId);
    event MovedToNextBatch(bytes32 indexed settlementId);

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

        // Verify signatures
        bytes32 structHash = keccak256(abi.encode(
            EARLY_AGREEMENT_TYPEHASH,
            settlementId,
            partyAAmount,
            partyBAmount,
            nonces[settlement.partyA]
        ));
        bytes32 hash = _hashTypedDataV4(structHash);

        require(_verifySignature(hash, partyASignature, settlement.partyA), "Invalid party A signature");
        require(_verifySignature(hash, partyBSignature, settlement.partyB), "Invalid party B signature");

        // Increment nonce
        nonces[settlement.partyA]++;

        // Transfer collateral based on agreement
        IERC20(settlement.collateralToken).safeTransfer(settlement.partyA, partyAAmount);
        IERC20(settlement.collateralToken).safeTransfer(settlement.partyB, partyBAmount);

        settlement.state = SettlementState.Settled;
        emit EarlyAgreementExecuted(settlementId);
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
        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        return ecrecover(hash, v, r, s) == signer;
    }
}
