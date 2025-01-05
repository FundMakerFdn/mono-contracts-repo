// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./ISettlement.sol";

/// @title Validator Settlement Interface
interface IValidatorSettlement is ISettlement {
    function verifyValidator(address account) external view returns (bool);
}
