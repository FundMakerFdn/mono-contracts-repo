// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./ISettlement.sol";

interface IBatchMetadataSettlement is ISettlement {
    function getBatchMetadataParameters(bytes32 settlementId) external view returns (
        uint256 settlementStart,
        uint256 votingStart,
        uint256 votingEnd
    );
}
