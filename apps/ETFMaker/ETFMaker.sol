// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

using SafeERC20 for IERC20;

contract ETFMaker is EIP712, IERC20 {

    IETFRegistry immutable ETF_REGISTRY;
    uint256 immutable ETF_ID
    IPSYMM immutable PSYMM;
    bytes32 immutable CUSTODY_ID;
    address immutable COLLATERAL_TOKEN;
    uint256 immutable COLLATERAL_TOKEN_PRECISION

    uint256 private cumulativeRebalanceSpread;

    mapping(address => uint256) private deposited;

    constructor(
        address etfMakerRegistryAddress,
        uint256 etfId,
        address pSymmAddress,
        bytes32 custodyId,
        address collateralToken,
    ) EIP712("EtfMaker", "1.0") {
        ETF_REGISTRY = ETFRegistry(etfMakerRegistryAddress)
        PSYMM = pSymm(pSymmAddress)
    }

    // 0 deposit token
    // 1 send burn order
    // 2 solver fill
    // 3 solver execute this function as an ECDSA
    function mint() external {
        // verify ECDSA
    }

    // 0 deposist token
    // 1 send burn order
    // 2 solver fill
    // 3 solver execute this function as an ECDSA
    function burn() external {
        // verify ECDSA
    }

    // deposit before sending an EIP712 to solver
    function deposit(uint256 _amount, address _token) external {
        IERC20(_token).safeTransferFrom(msg.sender, _amount);
        PSYMM.addressToCustody( CUSTODY_ID, COLLATERAL_TOKEN, _amount );
        deposited[msg.sender] = _amount;
        // @TODO event
    }

    // Withdraw free collateral // Only callable by solver
    function withdraw() external {

    }

    function reportRebalanceSpread(uint256 _rebalanceSpread) external {
        cumRebalanceSpread += _rebalanceSpread;
        emit rebalanceSpreadReport(_rebalanceSpread, block.timestamp);
    }

    // Case where eip712 doesnt work : call pSymm.publishCustodyMsg()
    // Case where solver deposited into custody but doesnt allow withdraw : call settleMaker

    /// Read function

    function getPrice() external pure view return(uint256){
        return ETFREGISTRY.getPrice(ETF_ID) * ( 1e18 - cumulativeRebalanceSpread);
    }

}

contract ETFRegistry {
    mapping(uint256 => uint256) private custodyMsgLenght;

    struct ETF{
        mappging( uint256 => bytes)) private weights //timestamp => weights
        // threshold signature or ECDSA
        uint256 updateFrequency;
        address publisher;
    }

    function registerETF(ETF) external {

    }

    function updateWeights() external {

    }

    function updatePrice() external {

    }

    // how to insure rebalanc time for the solver

}