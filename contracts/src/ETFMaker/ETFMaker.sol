// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MockAaveSMA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../MockPPM/MockPPM.sol";
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

    function deposit(bytes32 pSymmCustodyId, uint256 amount, address token) external {
        pSymm.addressToCustody(pSymmCustodyId, token, amount);
        pSymmETF(etfId).deposit(amount);
    }

    function withdraw( address token, address destination, uint256 amount, VerificationData calldata v) external {
        pSymm.custodyToAddress(token, destination, amount, v);
        pSymmETF(etfId).withdraw(amount);
    }

    function reportRebalanceSpread(uint256 _rebalanceSpread) external {
        cumRebalanceSpread += _rebalanceSpread;
        emit rebalanceSpreadReport(_rebalanceSpread, block.timestamp);
    }
}

contract pSymmETF is ERC20 {
    address public immutable pSymmAddress;


    address etfMakerRegistryAddress,
        uint256 etfId,
        address pSymmAddress,
        bytes32 custodyId,
        address collateralToken,
        uint256 collateralTokenPrecision

    constructor(address _pSymmAddress) {
        pSymmAddress = _pSymmAddress;
    }

    modifier onlyPSymm() {
        require(msg.sender == pSymmAddress, "Only pSymm can call");
        _;
    }

    function mintTo(address target, uint256 amount) external onlyPSymm {
        _mint(target, amount);
    }

    function burnFrom(address target, uint256 amount) external onlyPSymm {
        _burn(target, amount);
    }   

    function getPrice() external pure returns (uint256) {
        return ETF_REGISTRY.getPrice(ETF_ID) * ( 1e18 - cumRebalanceSpread);
    }
}
