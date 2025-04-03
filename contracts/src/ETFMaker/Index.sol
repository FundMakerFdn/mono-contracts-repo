// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
//import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "hardhat/console.sol";
import "../PSYMM/PSYMM.sol";
import "./IndexRegistry.sol";

contract pSymmIndex is ERC20
    {

    event Deposit(uint256 amount, address from, address frontend);
    event WithdrawRequest(uint256 amount, address from, address frontend);
    event Withdraw(uint256 amount, address to, uint256 executionPrice, uint256 executionTime, address frontend);
    event Mint(uint256 amount, address to, uint256 executionPrice, uint256 executionTime, address frontend);
    event Burn(uint256 amount, address to, uint256 chainId, address frontend);
    event MaxMintPerBlockChanged(uint256 oldMaxMintPerBlock, uint256 maxMintPerBlock);
    event MaxRedeemPerBlockChanged(uint256 oldMaxRedeemPerBlock, uint256 maxRedeemPerBlock);

    IndexRegistry public immutable _IndexRegistry;
    address public immutable indexRegistryAddress;
    uint256 public immutable indexRegistryChainId;
    uint256 public immutable indexId;

    PSYMM public immutable pSymm;
    address public immutable pSymmAddress;
    bytes32 public immutable custodyId;

    address public collateralToken;
    uint256 public collateralTokenPrecision;
    uint256 public mintFee;
    uint256 public burnFee;
    uint256 public managementFee;
    uint256 public frontendShare;    


    /// @notice token minted per block
    mapping(uint256 => uint256) public mintedPerBlock;
    /// @notice token redeemed per block
    mapping(uint256 => uint256) public redeemedPerBlock;
    /// @notice max minted token allowed per block
    uint256 public maxMintPerBlock;
    /// @notice max redeemed token allowed per block
    uint256 public maxRedeemPerBlock;

    /* --------------- CONSTRUCTOR --------------- */

    constructor(
        address _pSymmAddress, 
        address _IndexRegistryAddress,
        string memory _name, 
        string memory _symbol, 
        bytes32 _custodyId, 
        address _collateralToken, 
        uint256 _collateralTokenPrecision,
        uint256 _mintFee,
        uint256 _burnFee,
        uint256 _managementFee,
        uint256 _maxMintPerBlock,
        uint256 _maxRedeemPerBlock
    ) ERC20(_name, _symbol) {
        _IndexRegistry = IndexRegistry(_IndexRegistryAddress);
        pSymmAddress = _pSymmAddress;
        pSymm = PSYMM(_pSymmAddress);
        custodyId = _custodyId;
        collateralToken = _collateralToken;
        collateralTokenPrecision = _collateralTokenPrecision;
        mintFee = _mintFee;
        burnFee = _burnFee;
        managementFee = _managementFee;
        maxMintPerBlock = _maxMintPerBlock;
        maxRedeemPerBlock = _maxRedeemPerBlock;
    }

    /* --------------- MODIFIERS --------------- */

    /// @notice ensure that the already minted token in the actual block plus the amount to be minted is below the maxMintPerBlock var
    /// @param mintAmount The token amount to be minted
    modifier belowMaxMintPerBlock(uint256 mintAmount) {
        require(mintedPerBlock[block.number] + mintAmount > maxMintPerBlock, "MaxMintPerBlockExceeded");
        _;
    }

    /// @notice ensure that the already redeemed token in the actual block plus the amount to be redeemed is below the maxRedeemPerBlock var
    /// @param redeemAmount The token amount to be redeemed
    modifier belowMaxRedeemPerBlock(uint256 redeemAmount) {
        require(redeemedPerBlock[block.number] + redeemAmount > maxRedeemPerBlock, "MaxRedeemPerBlockExceeded");
        _;
    }

    modifier onlyPSymm() {
        require(msg.sender == pSymmAddress, "Only pSymm can call");
        _;
    }

    //@notice only solver
    //@TODO submit FIX quote messagea
    function mint(address target, uint256 amount, uint256 executionPrice, uint256 executionTime, address frontend) 
        external 
        onlyPSymm 
        belowMaxMintPerBlock(amount)
    {
        _mint(target, amount);
        emit Mint(amount, target, executionPrice, executionTime, frontend);
    }

    //@notice only solver
    //@param if chainId is 0, it is a burn on the current chain, else this is a bridge request to designated chainId
    function burn( uint256 amount, uint256 chainId, address frontend) external onlyPSymm {
        _burn(msg.sender, amount);
        emit Burn(amount, msg.sender, chainId, frontend);
    }   

    function deposit(uint256 amount, address frontend) external onlyPSymm {
        pSymm.addressToCustody(custodyId, collateralToken, amount);
        emit Deposit(amount, msg.sender, frontend);
    }

    function withdrawRequest(uint256 amount, address frontend) external onlyPSymm {
        emit WithdrawRequest(amount, msg.sender, frontend);
    }

    //@notice only solver
    //@TODO add EIP712 submit signature of quote
    function withdraw(uint256 amount, address to, PSYMM.VerificationData memory v, uint256 executionPrice, uint256 executionTime, address frontend) external onlyPSymm {
        pSymm.custodyToAddress(collateralToken, to, amount, v);
        emit Withdraw(amount, to, executionPrice, executionTime, frontend);
    }


    /// @notice Sets the max mintPerBlock limit
    function _setMaxMintPerBlock(uint256 _maxMintPerBlock) internal {
        uint256 oldMaxMintPerBlock = maxMintPerBlock;
        maxMintPerBlock = _maxMintPerBlock;
        emit MaxMintPerBlockChanged(oldMaxMintPerBlock, maxMintPerBlock);
    }

    /// @notice Sets the max redeemPerBlock limit
    function _setMaxRedeemPerBlock(uint256 _maxRedeemPerBlock) internal {
        uint256 oldMaxRedeemPerBlock = maxRedeemPerBlock;
        maxRedeemPerBlock = _maxRedeemPerBlock;
        emit MaxRedeemPerBlockChanged(oldMaxRedeemPerBlock, maxRedeemPerBlock);
    }

    /* --------- 
    Getters
    --------- */

    function getLastPrice() external view returns (uint256) {
        return _IndexRegistry.getLastPrice(indexId);
    }

    function getCollateralToken() external view returns (address) {
        return collateralToken;
    }

    function getCollateralTokenPrecision() external view returns (uint256) {
        return collateralTokenPrecision;
    }

    function getMintFee() external view returns (uint256) {
        return mintFee;
    }

    function getBurnFee() external view returns (uint256) {
        return burnFee;
    }

    function getManagementFee() external view returns (uint256) {
        return managementFee;
    }


}