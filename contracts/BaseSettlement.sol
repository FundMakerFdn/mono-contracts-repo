// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ISettlement.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Base Settlement Contract Implementation
abstract contract BaseSettlement is ISettlement, EIP712 {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    bytes32 private constant EARLY_AGREEMENT_TYPEHASH = keccak256(
        "EarlyAgreement(bytes32 settlementId,uint256 partyAAmount,uint256 partyBAmount,uint256 nonce)"
    );

    // ============ Storage ============
    address public immutable settleMaker;
    mapping(bytes32 => SettlementData) public settlements;
    mapping(bytes32 => bool) private nextBatchSchedule;
    mapping(address => uint256) private nonces;
    uint256 private currentBatch;
    
    // ============ Constructor ============
    constructor(
        address _settleMaker,
        string memory name,
        string memory version
    ) EIP712(name, version) {
        require(_settleMaker != address(0), "Settlement: zero address");
        settleMaker = _settleMaker;
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

    function getNonce(address account) external view returns (uint256) {
        return nonces[account];
    }

    // ============ Core Functions ============
    function createSettlement(
        address partyA,
        address partyB,
        uint256 partyACollateral,
        uint256 partyBCollateral,
        address collateralToken
    ) public virtual returns (bytes32 settlementId) {
        require(partyA != address(0) && partyB != address(0), "Settlement: zero address");
        require(collateralToken != address(0), "Settlement: invalid token");
        require(partyACollateral > 0 || partyBCollateral > 0, "Settlement: zero collateral");

        settlementId = _generateSettlementId(
            partyA,
            partyB,
            partyACollateral,
            partyBCollateral,
            collateralToken
        );

        settlements[settlementId] = SettlementData({
            partyA: partyA,
            partyB: partyB,
            settlementTime: block.timestamp,
            partyACollateral: partyACollateral,
            partyBCollateral: partyBCollateral,
            collateralToken: collateralToken,
            state: 0 // Open state
        });

        // Transfer collateral
        if (partyACollateral > 0) {
            IERC20(collateralToken).safeTransferFrom(partyA, address(this), partyACollateral);
        }
        if (partyBCollateral > 0) {
            IERC20(collateralToken).safeTransferFrom(partyB, address(this), partyBCollateral);
        }

        emit SettlementCreated(settlementId, partyA, partyB);
        emit CollateralLocked(settlementId, partyACollateral + partyBCollateral);

        return settlementId;
    }

    function executeEarlyAgreement(
        bytes32 settlementId,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory partyASignature,
        bytes memory partyBSignature
    ) external virtual override {
        SettlementData storage settlement = settlements[settlementId];
        require(settlement.state == 0, "Settlement: invalid state");
        
        bytes32 structHash = keccak256(abi.encode(
            EARLY_AGREEMENT_TYPEHASH,
            settlementId,
            partyAAmount,
            partyBAmount,
            nonces[settlement.partyA]++
        ));

        bytes32 hash = _hashTypedDataV4(structHash);
        
        require(
            _verifySignature(hash, partyASignature, settlement.partyA) &&
            _verifySignature(hash, partyBSignature, settlement.partyB),
            "Settlement: invalid signatures"
        );

        _executeSettlement(settlementId, partyAAmount, partyBAmount);
    }

    function moveToNextBatch(bytes32 settlementId) external virtual returns (bool) {
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

    // ============ Internal Functions ============
    function _generateSettlementId(
        address partyA,
        address partyB,
        uint256 partyACollateral,
        uint256 partyBCollateral,
        address collateralToken
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(
            partyA,
            partyB,
            partyACollateral,
            partyBCollateral,
            collateralToken,
            block.timestamp
        ));
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

    function claimCollateral(bytes32 settlementId) external {
        SettlementData storage settlement = settlements[settlementId];
        require(settlement.state == 2, "Settlement: not in nextBatch state");
        
        // Transfer all collateral to SettleMaker contract for distribution
        if (settlement.partyACollateral > 0) {
            IERC20(settlement.collateralToken).safeTransfer(
                settleMaker,
                settlement.partyACollateral
            );
        }
        if (settlement.partyBCollateral > 0) {
            IERC20(settlement.collateralToken).safeTransfer(
                settleMaker,
                settlement.partyBCollateral
            );
        }

        settlement.state = 1; // Set to settled state
        emit CollateralReleased(settlementId);
    }

    function _executeSettlement(
        bytes32 settlementId,
        uint256 partyAAmount,
        uint256 partyBAmount
    ) internal virtual {
        SettlementData storage settlement = settlements[settlementId];
        require(
            partyAAmount + partyBAmount == settlement.partyACollateral + settlement.partyBCollateral,
            "Settlement: invalid amounts"
        );

        settlement.state = 1; // Settled state

        if (partyAAmount > 0) {
            IERC20(settlement.collateralToken).safeTransfer(settlement.partyA, partyAAmount);
        }
        if (partyBAmount > 0) {
            IERC20(settlement.collateralToken).safeTransfer(settlement.partyB, partyBAmount);
        }

        emit CollateralReleased(settlementId);
    }
}
