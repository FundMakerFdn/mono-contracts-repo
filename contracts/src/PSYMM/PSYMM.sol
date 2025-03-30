// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../SettleMaker/interfaces/ISettlement.sol";
import "./Schnorr.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./VerificationUtils.sol";

interface ISMAFactory {
    function deploySMA(bytes calldata data) external returns (address);
}

contract PSYMM {
    using SafeERC20 for IERC20;

    struct VerificationData {
        bytes32 id;
        uint8 state;
        uint256 timestamp;
        Schnorr.PPMKey pubKey;
        Schnorr.Signature sig;
        bytes32[] merkleProof;
    }

    event PPMUpdated(bytes32 indexed id, bytes32 ppm, uint256 timestamp);
    event CustodyStateChanged(bytes32 indexed id, uint8 newState);
    event SMADeployed(bytes32 indexed id, address factoryAddress, address smaAddress);
    event addressToCustodyEvent(bytes32 indexed id, address token, uint256 amount);
    event custodyToCustodyEvent(bytes32 indexed id, bytes32 receiverId, address token, uint256 amount);
    event custodyToAddressEvent(bytes32 indexed id, address token, address destination, uint256 amount);
    event custodyToSMAEvent(bytes32 indexed id, address token, address smaAddress, uint256 amount);
    event callSMAEvent(bytes32 indexed id, string smaType, address smaAddress, bytes fixedCallData, bytes tailCallData);
    event withdrawReRoutingEvent(bytes32 indexed id, address sender, address destination);
    event submitProvisionalEvent(bytes32 indexed id, bytes _calldata, bytes _msg);
    event revokeProvisionalEvent(bytes32 indexed id, bytes _calldata, bytes _msg);
    event discussProvisionalEvent(bytes32 indexed id, bytes _msg);

    mapping(bytes32 => bytes32) private custodys;
    mapping(bytes32 => mapping(address => uint256)) public custodyBalances; // custodyId => token address => balance
    mapping(bytes32 => mapping(address => bool)) public smaAllowance; // custodyId => deployed SMA address => isAllowed
    mapping(address => bool) public onlyCustodyOwner; // deployed SMA address => isDeployed
    mapping(bytes32 => bool) private nullifier;
    mapping(bytes32 => uint256) public lastSMAUpdateTimestamp; // custodyId => timestamp
    mapping(bytes32 => bytes32) private PPMs;
    mapping(bytes32 => uint8) private custodyState;
    mapping(bytes32 => mapping(uint256 => bytes)) public custodyMsg; // custodyId => token address => balance
    mapping(bytes32 => uint256) private custodyMsgLength;

    mapping(bytes32 => mapping(address => address)) private withdrawReRoutings; // custodyId => address => address // used for instant withdraw

    mapping(uint256 => mapping(address => uint256)) public slashableCustody; // msgSeqNum => tokenId => amount
    mapping(bytes32 => mapping(address => mapping(address => uint256))) public freezeOrder; // custodyId => partyId => tokenId => amount

    modifier checkCustodyState(bytes32 id, uint8 state) {
        require(custodyState[id] == state, "State isn't 0");
        _;
    }

    modifier checkCustodyBalance(bytes32 id, address token, uint256 amount) {
        require(custodyBalances[id][token] >= amount, "Out of collateral");
        _;
    }

    modifier checkNullifier(bytes32 _nullifier) {
        require(!nullifier[_nullifier], "Nullifier has been used");
        nullifier[_nullifier] = true;
        _;
    }
    
    modifier checkExpiry(uint256 _timestamp) {
        require(_timestamp <= block.timestamp, "Signature expired");
        _;
    }

    function addressToCustody(bytes32 id, address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        custodyBalances[id][token] += amount;
		PPMs[id] = id;
        emit addressToCustodyEvent(id, token, amount);
    }

    function custodyToAddress(
        address token,
        address destination,
        uint256 amount,
        VerificationData calldata v
    ) external checkCustodyState(v.id, v.state) checkCustodyBalance(v.id, token, amount) checkExpiry(v.timestamp) checkNullifier(v.sig.e){

        VerificationUtils.verifyLeaf(
            PPMs[v.id],
            v.merkleProof,
            "custodyToAddress",
            block.chainid,
            address(this),
            custodyState[v.id],
            abi.encode(destination),
            v.pubKey.parity,
            v.pubKey.x
        );

        VerificationUtils.verifySchnorr(
            abi.encode(
                v.timestamp,
                "custodyToAddress",
                v.id,
                token,
                destination,
                amount
            ),
            v.pubKey,
            v.sig
        );

        if (withdrawReRoutings[v.id][destination] != address(0)){
            custodyBalances[v.id][token] -= amount;
            IERC20(token).safeTransfer(withdrawReRoutings[v.id][destination], amount);
        } else {
            custodyBalances[v.id][token] -= amount;
            IERC20(token).safeTransfer(destination, amount);
        }
        emit custodyToAddressEvent(v.id, token, destination, amount);
    }

    function custodyToCustody(
        address token,
        bytes32 receiverId,
        uint256 amount,
        VerificationData calldata v
    ) external checkCustodyState(v.id, v.state) checkCustodyBalance(v.id, token, amount) checkExpiry(v.timestamp) checkNullifier(v.sig.e){

        VerificationUtils.verifyLeaf(
            PPMs[v.id],
            v.merkleProof,
            "custodyToCustody",
            block.chainid,
            address(this),
            custodyState[v.id],
            abi.encode(receiverId),
            v.pubKey.parity,
            v.pubKey.x
        );

        VerificationUtils.verifySchnorr(
            abi.encode(
                v.timestamp,
                "custodyToCustody",
                v.id,
                token,
                receiverId,
                amount
            ),
            v.pubKey,
            v.sig
        );

  
        custodyBalances[v.id][token] -= amount;
        custodyBalances[receiverId][token] += amount;

        emit custodyToCustodyEvent(v.id, receiverId, token, amount);
    }

    function custodyToSMA(
        address token,
        address smaAddress,
        uint256 amount,
        VerificationData calldata v
    ) external checkCustodyState(v.id, v.state) checkCustodyBalance(v.id, token, amount) checkExpiry(v.timestamp) checkNullifier(v.sig.e){
        require(smaAllowance[v.id][smaAddress], "SMA not whitelisted");
        require(onlyCustodyOwner[smaAddress], "No permission");

        VerificationUtils.verifyLeaf(
            PPMs[v.id],
            v.merkleProof,
            "custodyToSMA",
            block.chainid,
            address(this),
            custodyState[v.id],
            abi.encode(smaAddress, token),
            v.pubKey.parity,
            v.pubKey.x
        );

        VerificationUtils.verifySchnorr(
            abi.encode(
                v.timestamp,
                "custodyToSMA",
                v.id,
                token,
                smaAddress,
                amount
            ),
            v.pubKey,
            v.sig
        );

        custodyBalances[v.id][token] -= amount;
        IERC20(token).safeTransfer(smaAddress, amount);
    }

    function updatePPM(
        bytes32 _newPPM,
        VerificationData calldata v
    ) external checkCustodyState(v.id, v.state) checkExpiry(v.timestamp) checkNullifier(v.sig.e){
        require(v.timestamp > lastSMAUpdateTimestamp[v.id], "Signature expired");

        VerificationUtils.verifyLeaf(
            PPMs[v.id],
            v.merkleProof,
            "updatePPM",
            block.chainid,
            address(this),
            custodyState[v.id],
            abi.encode(), // no extra parameters
            v.pubKey.parity,
            v.pubKey.x
        );

        VerificationUtils.verifySchnorr(
            abi.encode(
                v.timestamp,
                "updatePPM",
                v.id,
                _newPPM
            ),
            v.pubKey,
            v.sig
        );

        PPMs[v.id] = _newPPM;
        lastSMAUpdateTimestamp[v.id] = v.timestamp;
        emit PPMUpdated(v.id, _newPPM, v.timestamp);
    }

    function deploySMA(
        string calldata _smaType,
        address _factoryAddress,
        bytes calldata _data,
        VerificationData calldata v
    ) external checkCustodyState(v.id, v.state) checkExpiry(v.timestamp) checkNullifier(v.sig.e){
        require(v.timestamp > lastSMAUpdateTimestamp[v.id], "Signature expired");

        VerificationUtils.verifyLeaf(
            PPMs[v.id],
            v.merkleProof,
            "deploySMA",
            block.chainid,
            address(this),
            custodyState[v.id],
            abi.encode(_smaType, _factoryAddress, _data),
            v.pubKey.parity,
            v.pubKey.x
        );

        VerificationUtils.verifySchnorr(
            abi.encode(
                v.timestamp,
                "deploySMA",
                v.id,
                _smaType,
                _factoryAddress,
                _data
            ),
            v.pubKey,
            v.sig
        );

        address smaAddress = ISMAFactory(_factoryAddress).deploySMA(_data);
        smaAllowance[v.id][smaAddress] = true;
        onlyCustodyOwner[smaAddress] = true;

        emit SMADeployed(v.id, _factoryAddress, smaAddress);
    }


    function callSMA(
        string calldata smaType,
        address smaAddress,
        bytes calldata fixedCallData,
        bytes calldata tailCallData,
        VerificationData calldata v
    ) external checkCustodyState(v.id, v.state) checkExpiry(v.timestamp) checkNullifier(v.sig.e){
        require(smaAllowance[v.id][smaAddress], "SMA not whitelisted");

        VerificationUtils.verifyLeaf(
            PPMs[v.id],
            v.merkleProof,
            "callSMA",
            block.chainid,
            address(this),
            custodyState[v.id],
            abi.encode(smaType, smaAddress, fixedCallData),
            v.pubKey.parity,
            v.pubKey.x
        );

        bytes memory fullCallData = bytes.concat(fixedCallData, tailCallData);
        VerificationUtils.verifySchnorr(
            abi.encode(
                v.timestamp,
                "callSMA",
                v.id,
                smaType,
                smaAddress,
                fullCallData
            ),
            v.pubKey,
            v.sig
        );

        (bool success, ) = smaAddress.call(fullCallData);
        require(success, "SMA call failed");

        emit callSMAEvent(v.id, smaType, smaAddress, fixedCallData, tailCallData);
    }

    function updateCustodyState(
        uint8 state,
        VerificationData calldata v
    ) external checkCustodyState(v.id, v.state) checkExpiry(v.timestamp) checkNullifier(v.sig.e){

        VerificationUtils.verifyLeaf(
            PPMs[v.id],
            v.merkleProof,
            "changeCustodyState",
            block.chainid,
            address(this),
            custodyState[v.id],
            abi.encode(state),
            v.pubKey.parity,
            v.pubKey.x
        );

        VerificationUtils.verifySchnorr(
            abi.encode(
                v.timestamp,
                "changeCustodyState",
                v.id,
                state
            ),
            v.pubKey,
            v.sig
        );

        custodyState[v.id] = state;
        emit CustodyStateChanged(v.id, state);
    }

    /// SettleMaker
    function withdrawReRouting(bytes32 id, address destination) public {
        // buy the right of redirecting claims from a dispute // managed in external contract
        require(withdrawReRoutings[id][msg.sender] == address(0), "Already the custody owner");
        withdrawReRoutings[id][msg.sender] = destination;
        emit withdrawReRoutingEvent(id, msg.sender, destination);
    }

    /// Provisional Settlement
    // @notice multiple provisional settlement can be emmited on the same custody, but only 1 need to not be revoked
    //          If more than 1 provisional settlement is live during vote phase, report vote
    //          If no proposal, dispute is considered on hold
    //          Submit and revoke are only considered if called by a validator
    //          Any user can propose a submit though discuss
    //          Solver who spam submit will be slashed by other SettleMaker validators
    function submitProvisional(bytes32 _id, bytes calldata _calldata, bytes calldata _msg) external { emit submitProvisionalEvent(_id, _calldata, _msg);}
    function revokeProvisional(bytes32 _id, bytes calldata _calldata, bytes calldata _msg) external { emit revokeProvisionalEvent(_id, _calldata, _msg);}
    function discussProvisional(bytes32 _id, bytes calldata _msg) external { emit discussProvisionalEvent(_id, _msg);}  // submit arweave merkle leaves here
    

    // Read functions

    function getCustodyState(bytes32 id) external view returns (uint8) {
        return custodyState[id];
    }

    function getPPM(bytes32 id) external view returns (bytes32) {
        return PPMs[id];
    }

    function getCustodyBalances(bytes32 id, address token) external view returns (uint256) {
        return custodyBalances[id][token];
    }

    function getSMAAllowance(bytes32 id, address smaAddress) external view returns (bool) {
        return smaAllowance[id][smaAddress];
    }

    function getOnlyCustodyOwner(address smaAddress) external view returns (bool) {
        return onlyCustodyOwner[smaAddress];
    }

    function getLastSMAUpdateTimestamp(bytes32 id) external view returns (uint256) {
        return lastSMAUpdateTimestamp[id];
    }

    function getNullifier(bytes32 _nullifier) external view returns (bool) {
        return nullifier[_nullifier];
    }

    function getCustodyMsg(bytes32 id, uint256 msgId) external view returns (bytes memory) {
        return custodyMsg[id][msgId];
    }

    function getCustodyMsgLength(bytes32 id) external view returns (uint256) {
        return custodyMsgLength[id];
    }

}
