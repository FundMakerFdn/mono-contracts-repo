// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseSettlement.sol";

/// @title PSymm Settlement Contract
abstract contract PSymmSettlement is BaseSettlement {
    struct PSymmParameters {
        uint256 entryPrice;
        uint256 settlementPrice;
        address pSymmContract;
        uint256 derivativeId;
    }
}
