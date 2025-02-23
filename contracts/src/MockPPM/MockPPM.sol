// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../SettleMaker/interfaces/ISettlement.sol";
import "./Schnorr.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

using SafeERC20 for IERC20;

interface ISMAFactory {
    function deploySMA(bytes calldata data) external returns (address);
}

// Will be merged to pSymm
contract MockPPM is EIP712 {
    event PPMUpdated(bytes32 indexed id, bytes32 ppm, uint256 timestamp);
    event CustodyStateChanged(bytes32 indexed id, uint8 newState);
    event SMADeployed(bytes32 indexed id, address factoryAddress, address smaAddress);


    mapping(bytes32 => bytes32) private custodys;
    mapping(bytes32 => mapping(address => uint256)) public custodyBalances; // custodyId => token address => balance
    mapping(bytes32 => mapping(address => bool)) public smaAllowance; // custodyId => deployed SMA address => isAllowed
    mapping(address => bool) public onlyCustodyOwner; // deployed SMA address => isDeployed
    mapping(bytes32 => bool) private signatureClaimed;
    mapping(bytes32 => uint256) public lastSMAUpdateTimestamp; // custodyId => timestamp
    mapping(bytes32 => bytes32) private PPMs;
    mapping(bytes32 => uint8) private custodyState;
    // 1 PPM private key is shared inside PPM
    // 2 In case of dispute, we reveal PPM Pk that decode 
    mapping(bytes32 => mapping(uint256 => bytes)) public custodyMsg; // custodyId => token address => balance
    mapping(bytes32 => uint256) private custodyMsgLength;
    // SettleMaker
    mapping(bytes32 => ISettlement) private disputes; // custodyId => Dispute

    constructor() EIP712("MockPPM", "1.0") {}

    modifier checkCustodyState(bytes32 _id) {
        require(custodyState[_id] == 0, "State isn't 0");
        _;
    }
    modifier checkCustodyBalance(bytes32 _id, address _token, uint256 _amount) {
        require(custodyBalances[_id][_token] >= _amount, "Out of collateral");
        _;
    }

    function createCustody(bytes32 _ppm) external {
        require(_ppm == bytes32(0), "PPM already created");
        custodys[_ppm] = _ppm;
        // @TODO update state
        // @TODO event
    }

    function updatePPM(
        bytes32 _id,
        bytes32 _newPPM,
        uint256 _timestamp,
        Schnorr.PPMKey calldata pubKey,
        Schnorr.Signature calldata sig,
        bytes32[] calldata merkleProof
    ) external checkCustodyState(_id) {
        // Verify timestamp
        require(_timestamp <= block.timestamp && _timestamp > lastSMAUpdateTimestamp[_id], "Signature expired");

        // Verify pubkey is whitelisted for this action
        bytes32 leaf = keccak256(abi.encode(
            "updatePPM",
            block.chainid,
            address(this),
            custodyState[_id],
            abi.encode(),
            pubKey.parity,
            pubKey.x
        ));
        require(MerkleProof.verify(merkleProof, PPMs[_id], leaf), "Invalid merkle proof");

        // Verify signature
        bytes32 message = keccak256(abi.encode(
            _timestamp,
            "updatePPM",
            _id,
            _newPPM
        ));
        require(Schnorr.verify(pubKey, message, sig), "Invalid signature");
        bytes32 signatureHash = keccak256(abi.encode(sig.e, sig.s));
        signatureClaimed[signatureHash] = true;

        PPMs[_id] = _newPPM;
        lastSMAUpdateTimestamp[_id] = _timestamp;

        emit PPMUpdated(_id, _newPPM, _timestamp);
    }

    function deploySMA(
        bytes32 _id,
        string calldata _smaType,
        address _factoryAddress,
        bytes calldata _data,
        uint256 _timestamp,
        Schnorr.PPMKey calldata pubKey,
        Schnorr.Signature calldata sig,
        bytes32[] calldata merkleProof
    ) external checkCustodyState(_id) {
        // Verify timestamp
        require(_timestamp <= block.timestamp && _timestamp > lastSMAUpdateTimestamp[_id], "Signature expired");

        // Verify pubkey is whitelisted for this action
        bytes32 leaf = keccak256(abi.encode(
            "deploySMA",
            block.chainid,
            address(this),
            custodyState[_id],
            abi.encode(_smaType, _factoryAddress, _data),
            pubKey.parity,
            pubKey.x
        ));
        require(MerkleProof.verify(merkleProof, PPMs[_id], leaf), "Invalid merkle proof");

        // Verify signature
        bytes32 message = keccak256(abi.encode(
            _timestamp,
            "deploySMA",
            _id,
            _smaType,
            _factoryAddress,
            _data
        ));
        require(Schnorr.verify(pubKey, message, sig), "Invalid signature");
        // bytes32 signatureHash = keccak256(abi.encode(sig.e, sig.s));
        // require(!signatureClaimed[signatureHash], "Signature already claimed");
        // signatureClaimed[signatureHash] = true;

        // Deploy SMA via factory
        address smaAddress = ISMAFactory(_factoryAddress).deploySMA(_data);
        
        // Whitelist the new SMA
        smaAllowance[_id][smaAddress] = true;
        onlyCustodyOwner[smaAddress] = true;
        // lastSMAUpdateTimestamp[_id] = _timestamp;

        emit SMADeployed(_id, _factoryAddress, smaAddress);
    }

    function addressToCustody(address sender, bytes32 _id, address _token, uint256 _amount, bytes memory signature) external {
        // @TODO verify EIP712 signature
        IERC20(_token).safeTransferFrom(sender, address(this), _amount);
        custodyBalances[_id][_token] += _amount;
        // @TODO event
    }

    function addressToCustody(bytes32 _id, address _token, uint256 _amount) external {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        custodyBalances[_id][_token] += _amount;
        // @TODO event
    }
    function custodyToAddress(
        bytes32 _id,
        address _token,
        address _destination,
        uint256 _amount,
        uint256 _timestamp,
        Schnorr.PPMKey calldata pubKey,
        Schnorr.Signature calldata sig,
        bytes32[] calldata merkleProof
    ) external checkCustodyState(_id) checkCustodyBalance(_id, _token, _amount) {
        // Verify timestamp
        require(_timestamp <= block.timestamp, "Signature expired");

        // Verify pubkey is whitelisted for this action
        bytes32 leaf = keccak256(abi.encode(
            "custodyToAddress",
            block.chainid,
            address(this),
            custodyState[_id],
            abi.encode(_destination),
            pubKey.parity,
            pubKey.x
        ));
        require(MerkleProof.verify(merkleProof, PPMs[_id], leaf), "Invalid merkle proof");

        // Verify signature
        bytes32 message = keccak256(abi.encode(
            _timestamp,
            "custodyToAddress",
            _id,
            _token,
            _destination,
            _amount
        ));
        require(Schnorr.verify(pubKey, message, sig), "Invalid signature");

        custodyBalances[_id][_token] -= _amount;
        IERC20(_token).safeTransfer(_destination, _amount);
    }

    function custodyToSMA(
        bytes32 _id,
        address _token,
        address _smaAddress,
        uint256 _amount,
        uint256 _timestamp,
        Schnorr.PPMKey calldata pubKey,
        Schnorr.Signature calldata sig,
        bytes32[] calldata merkleProof
    ) external checkCustodyState(_id) checkCustodyBalance(_id, _token, _amount) {
        // Verify timestamp
        require(_timestamp <= block.timestamp, "Signature expired");

        // Verify SMA is whitelisted
        require(smaAllowance[_id][_smaAddress], "SMA not whitelisted");
		require(onlyCustodyOwner[_smaAddress], "No permission");

        // Verify pubkey is whitelisted for this action
        bytes32 leaf = keccak256(abi.encode(
            "custodyToSMA",
            block.chainid,
            address(this),
            custodyState[_id],
            abi.encode(_smaAddress, _token),
            pubKey.parity,
            pubKey.x
        ));
        require(MerkleProof.verify(merkleProof, PPMs[_id], leaf), "Invalid merkle proof");

        // Verify signature
        bytes32 message = keccak256(abi.encode(
            _timestamp,
            "custodyToSMA",
            _id,
            _token,
            _smaAddress,
            _amount
        ));
        require(Schnorr.verify(pubKey, message, sig), "Invalid signature");

        custodyBalances[_id][_token] -= _amount;
        IERC20(_token).safeTransfer(_smaAddress, _amount);
    }

    function callSMA(
        bytes32 _id,
        string calldata _smaType,
        address _smaAddress,
        bytes calldata _fixedCallData,
        bytes calldata _tailCallData,
        uint256 _timestamp,
        Schnorr.PPMKey calldata pubKey,
        Schnorr.Signature calldata sig,
        bytes32[] calldata merkleProof
    ) external checkCustodyState(_id) {
        // Verify timestamp
        require(_timestamp <= block.timestamp, "Signature expired");

        // Verify SMA is whitelisted
        require(smaAllowance[_id][_smaAddress], "SMA not whitelisted");

        // Verify pubkey is whitelisted for this action
        bytes32 leaf = keccak256(abi.encode(
            "callSMA",
            block.chainid,
            address(this),
            custodyState[_id],
            abi.encode(_smaType, _smaAddress, _fixedCallData),
            pubKey.parity,
            pubKey.x
        ));
        require(MerkleProof.verify(merkleProof, PPMs[_id], leaf), "Invalid merkle proof");

		// @docs _fixedCallData = bytes.concat(selector, abi.encode(partialArgs))
		// @docs _tailCallData = abi.encode(restOfArgs)
		bytes memory _fullCallData = bytes.concat(_fixedCallData, _tailCallData);

        // Verify signature
        bytes32 message = keccak256(abi.encode(
			_timestamp,
			"callSMA", 
			_id,
			_smaType,
			_smaAddress,
			_fullCallData
		));
        require(Schnorr.verify(pubKey, message, sig), "Invalid signature");
        // bytes32 signatureHash = keccak256(abi.encode(sig.e, sig.s));
        // require(!signatureClaimed[signatureHash], "Signature already claimed");
        // signatureClaimed[signatureHash] = true;
        // lastSMAUpdateTimestamp[_id] = _timestamp;

        (bool success,) = _smaAddress.call(_fullCallData);
        require(success, "SMA call failed");
    }

     function changeCustodyState(
        bytes32 _id,
        uint8 _state,
        uint256 _timestamp,
        Schnorr.PPMKey calldata pubKey,
        Schnorr.Signature calldata sig,
        bytes32[] calldata merkleProof
    ) external checkCustodyState(_id) {
        // Verify timestamp
        require(_timestamp <= block.timestamp, "Signature expired");

        // Verify pubkey is whitelisted for this action
        bytes32 leaf = keccak256(abi.encode(
            "changeCustodyState",
            block.chainid,
            address(this),
            custodyState[_id],
            abi.encode(_state),
            pubKey.parity,
            pubKey.x
        ));
        require(MerkleProof.verify(merkleProof, PPMs[_id], leaf), "Invalid merkle proof");

        // Verify signature
        bytes32 message = keccak256(abi.encode(
            _timestamp,
            "changeCustodyState",
            _id,
            _state
        ));
        require(Schnorr.verify(pubKey, message, sig), "Invalid signature");

        custodyState[_id] = _state;
        emit CustodyStateChanged(_id, _state);
    }
}
