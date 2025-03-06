// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

using SafeERC20 for IERC20;

contract MockAaveSMA {
    address public immutable pSymmAddress;

	// TODO: Accept AaveSMA params in constructor
    constructor(address _pSymmAddress) {
        require(_pSymmAddress != address(0), "Invalid pSymm address");
        pSymmAddress = _pSymmAddress;
    }

    modifier onlyPSymm() {
        require(msg.sender == pSymmAddress, "Only pSymm can call");
        _;
    }

    function borrow(address _token, uint256 _minAmount) external view onlyPSymm {
		// borrow minAmount of token
		console.log("Borrow function called with arguments %s %s", _token, _minAmount);
    }

    function repay(address _token, uint256 _amount) external view onlyPSymm {
		// repay amount of token
		console.log("Borrow function called with arguments %s %s", _token, _amount);
    }

    function smaToCustody(address _token, uint256 _amount) external onlyPSymm {
      IERC20(_token).safeTransfer(pSymmAddress, _amount);
    }

	// function supply, withdraw
}

