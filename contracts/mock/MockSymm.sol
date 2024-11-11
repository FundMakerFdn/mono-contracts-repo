// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockSymm is ERC20, Ownable {

    constructor() ERC20("MockSymm", "SYMM") Ownable(msg.sender) {}

    // Function to mint tokens (for testing purposes)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

}
