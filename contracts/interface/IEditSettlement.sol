// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ISettlement.sol";

/// @title Edit Settlement Interface
interface IEditSettlement is ISettlement {
    function validatorSettlementAddress() external view returns (address);
    function batchMetadataSettlementAddress() external view returns (address);
}
