// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./ISettlement.sol";

/// @title Collateral Settlement Interface
interface ICollateralSettlement is ISettlement {
    event EarlyAgreementExecuted(
        bytes32 indexed settlementId, 
        uint256 partyAAmount, 
        uint256 partyBAmount
    );
    event InstantWithdrawExecuted(
        bytes32 indexed settlementId,
        address indexed replacedParty,
        uint256 fee
    );

    event SettlementExecuted(
        bytes32 indexed settlementId,
        uint256 partyAAmount,
        uint256 partyBAmount
    );

    function executeEarlyAgreement(
        bytes32 settlementId,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory signature
    ) external;

    function executeInstantWithdraw(
        bytes32 settlementId,
        address replacedParty,
        uint256 instantWithdrawFee,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory signature
    ) external;
}
