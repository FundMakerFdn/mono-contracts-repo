// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockSymm is ERC20, Ownable {
    using SafeERC20 for IERC20;

    constructor() ERC20("MockSymm", "SYMM") Ownable(msg.sender) {}

    // Function to mint tokens (for testing purposes)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

}
