// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MultiSigWallet
 * @dev Multi-signature wallet for secure management of token operations
 * @notice Requires multiple confirmations for critical operations
 */
contract MultiSigWallet is ReentrancyGuard {
    // Events
    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event SubmitTransaction(
        address indexed owner,
        uint256 indexed txIndex,
        address indexed to,
        uint256 value,
        bytes data
    );
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);
    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event RequiredConfirmationsChanged(uint256 required);
    
    // State variables
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public numConfirmationsRequired;
    
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
        uint256 timestamp;
        string description;
    }
    
    mapping(uint256 => mapping(address => bool)) public isConfirmed;
    Transaction[] public transactions;
    
    // Modifiers
    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner");
        _;
    }
    
    modifier txExists(uint256 _txIndex) {
        require(_txIndex < transactions.length, "Transaction does not exist");
        _;
    }
    
    modifier notExecuted(uint256 _txIndex) {
        require(!transactions[_txIndex].executed, "Transaction already executed");
        _;
    }
    
    modifier notConfirmed(uint256 _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "Transaction already confirmed");
        _;
    }
    
    /**
     * @dev Constructor
     * @param _owners List of initial owners
     * @param _numConfirmationsRequired Number of confirmations required
     */
    constructor(address[] memory _owners, uint256 _numConfirmationsRequired) {
        require(_owners.length > 0, "Owners required");
        require(
            _numConfirmationsRequired > 0 && 
            _numConfirmationsRequired <= _owners.length,
            "Invalid number of required confirmations"
        );
        
        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Owner not unique");
            
            isOwner[owner] = true;
            owners.push(owner);
        }
        
        numConfirmationsRequired = _numConfirmationsRequired;
    }
    
    /**
     * @dev Receive ETH
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }
    
    /**
     * @dev Submit a transaction for approval
     * @param _to Destination address
     * @param _value ETH value to send
     * @param _data Transaction data
     * @param _description Human-readable description
     */
    function submitTransaction(
        address _to,
        uint256 _value,
        bytes memory _data,
        string memory _description
    ) public onlyOwner {
        uint256 txIndex = transactions.length;
        
        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0,
                timestamp: block.timestamp,
                description: _description
            })
        );
        
        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }
    
    /**
     * @dev Confirm a transaction
     * @param _txIndex Transaction index
     */
    function confirmTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;
        
        emit ConfirmTransaction(msg.sender, _txIndex);
    }
    
    /**
     * @dev Execute a transaction after enough confirmations
     * @param _txIndex Transaction index
     */
    function executeTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        nonReentrant
    {
        Transaction storage transaction = transactions[_txIndex];
        
        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "Cannot execute transaction"
        );
        
        transaction.executed = true;
        
        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "Transaction failed");
        
        emit ExecuteTransaction(msg.sender, _txIndex);
    }
    
    /**
     * @dev Revoke a confirmation
     * @param _txIndex Transaction index
     */
    function revokeConfirmation(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        require(isConfirmed[_txIndex][msg.sender], "Transaction not confirmed");
        
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;
        
        emit RevokeConfirmation(msg.sender, _txIndex);
    }
    
    /**
     * @dev Add a new owner (requires multi-sig approval)
     * @param _owner New owner address
     */
    function addOwner(address _owner) public {
        require(msg.sender == address(this), "Must be executed through multi-sig");
        require(_owner != address(0), "Invalid owner");
        require(!isOwner[_owner], "Owner exists");
        
        isOwner[_owner] = true;
        owners.push(_owner);
        
        emit OwnerAdded(_owner);
    }
    
    /**
     * @dev Remove an owner (requires multi-sig approval)
     * @param _owner Owner address to remove
     */
    function removeOwner(address _owner) public {
        require(msg.sender == address(this), "Must be executed through multi-sig");
        require(isOwner[_owner], "Not owner");
        require(owners.length - 1 >= numConfirmationsRequired, "Cannot remove owner");
        
        isOwner[_owner] = false;
        
        // Remove from array
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == _owner) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }
        
        emit OwnerRemoved(_owner);
    }
    
    /**
     * @dev Change required confirmations (requires multi-sig approval)
     * @param _numConfirmationsRequired New required confirmations
     */
    function changeRequirement(uint256 _numConfirmationsRequired) public {
        require(msg.sender == address(this), "Must be executed through multi-sig");
        require(
            _numConfirmationsRequired > 0 && 
            _numConfirmationsRequired <= owners.length,
            "Invalid requirement"
        );
        
        numConfirmationsRequired = _numConfirmationsRequired;
        
        emit RequiredConfirmationsChanged(_numConfirmationsRequired);
    }
    
    /**
     * @dev Get owners
     * @return _owners List of owner addresses
     */
    function getOwners() public view returns (address[] memory) {
        return owners;
    }
    
    /**
     * @dev Get transaction count
     * @return Number of transactions
     */
    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }
    
    /**
     * @dev Get transaction details
     * @param _txIndex Transaction index
     * @return to Destination address
     * @return value ETH value
     * @return data Transaction data
     * @return executed Execution status
     * @return numConfirmations Number of confirmations
     * @return timestamp Transaction timestamp
     * @return description Transaction description
     */
    function getTransaction(uint256 _txIndex)
        public
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 numConfirmations,
            uint256 timestamp,
            string memory description
        )
    {
        Transaction storage transaction = transactions[_txIndex];
        
        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations,
            transaction.timestamp,
            transaction.description
        );
    }
    
    /**
     * @dev Check if transaction is confirmed by an owner
     * @param _txIndex Transaction index
     * @param _owner Owner address
     * @return True if confirmed
     */
    function isTransactionConfirmed(uint256 _txIndex, address _owner)
        public
        view
        returns (bool)
    {
        return isConfirmed[_txIndex][_owner];
    }
    
    /**
     * @dev Get pending transactions
     * @return pendingIndices Array of pending transaction indices
     */
    function getPendingTransactions() public view returns (uint256[] memory) {
        uint256 pendingCount = 0;
        
        // Count pending transactions
        for (uint256 i = 0; i < transactions.length; i++) {
            if (!transactions[i].executed) {
                pendingCount++;
            }
        }
        
        // Create array of pending indices
        uint256[] memory pendingIndices = new uint256[](pendingCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < transactions.length; i++) {
            if (!transactions[i].executed) {
                pendingIndices[currentIndex] = i;
                currentIndex++;
            }
        }
        
        return pendingIndices;
    }
}