// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Settlement.sol";

/// @title ETF Settlement Contract
abstract contract ETFSettlement is Settlement {
    struct ETFParameters {
        uint256 priceMint;
        uint256 mintTime;
        uint256 etfTokenAmount;
        address etfToken;
        uint256 interestRate;
        address interestRatePayer;
    }
}
