// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MockAaveSMA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

contract ETFMakerFactory {
    address public immutable pSymmAddress;

    constructor(address _pSymmAddress) {
        pSymmAddress = _pSymmAddress;
    }

    modifier onlyPSymm() {
        require(msg.sender == pSymmAddress, "Only pSymm can call");
        _;
    }

    function deployETF() external onlyPSymm returns (address) {
        pSymmETF etf = new pSymmETF(pSymmAddress);
        return address(etf);
    }
}





using SafeERC20 for IERC20;

contract pSymmETF {
    address public immutable pSymmAddress;


}

