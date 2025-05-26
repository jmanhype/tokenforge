// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MemeCoinWithFees
 * @dev ERC20 token with creator fee mechanism for revenue sharing
 */
contract MemeCoinWithFees is ERC20, ERC20Burnable, Ownable, Pausable, ReentrancyGuard {
    // Fee configuration
    uint256 public constant CREATOR_FEE_BPS = 100; // 1% in basis points
    uint256 public constant PLATFORM_FEE_BPS = 100; // 1% in basis points
    uint256 public constant TOTAL_FEE_BPS = CREATOR_FEE_BPS + PLATFORM_FEE_BPS; // 2% total
    uint256 public constant BPS_DIVISOR = 10000; // Basis points divisor

    // Fee recipients
    address public immutable creator;
    address public platformFeeRecipient;
    
    // Fee tracking
    uint256 public totalCreatorFeesCollected;
    uint256 public totalPlatformFeesCollected;
    mapping(address => uint256) public pendingCreatorFees;
    mapping(address => uint256) public pendingPlatformFees;
    
    // Fee exemptions
    mapping(address => bool) public feeExempt;
    
    // Feature flags
    bool public canMint;
    bool public immutable canBurn;
    bool public feesEnabled;
    
    // Events
    event FeesCollected(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 creatorFee,
        uint256 platformFee
    );
    
    event CreatorFeesWithdrawn(address indexed creator, uint256 amount);
    event PlatformFeesWithdrawn(address indexed recipient, uint256 amount);
    event FeeExemptionUpdated(address indexed account, bool exempt);
    event FeesToggled(bool enabled);
    event PlatformFeeRecipientUpdated(address indexed newRecipient);

    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address _owner,
        address _creator,
        address _platformFeeRecipient,
        bool _canMint,
        bool _canBurn,
        bool _startWithFeesEnabled
    ) ERC20(name, symbol) Ownable(_owner) {
        require(_creator != address(0), "Invalid creator");
        require(_platformFeeRecipient != address(0), "Invalid platform recipient");
        
        creator = _creator;
        platformFeeRecipient = _platformFeeRecipient;
        canMint = _canMint;
        canBurn = _canBurn;
        feesEnabled = _startWithFeesEnabled;
        
        // Mint initial supply to owner
        _mint(_owner, initialSupply);
        
        // Fee exemptions for special addresses
        feeExempt[_owner] = true;
        feeExempt[_creator] = true;
        feeExempt[address(this)] = true;
        feeExempt[address(0)] = true;
    }

    /**
     * @dev Calculate fee amounts for a transfer
     */
    function calculateFees(uint256 amount) public pure returns (uint256 creatorFee, uint256 platformFee) {
        creatorFee = (amount * CREATOR_FEE_BPS) / BPS_DIVISOR;
        platformFee = (amount * PLATFORM_FEE_BPS) / BPS_DIVISOR;
    }

    /**
     * @dev Check if fees should be applied to this transfer
     */
    function shouldTakeFees(address from, address to) public view returns (bool) {
        if (!feesEnabled) return false;
        if (feeExempt[from] || feeExempt[to]) return false;
        if (from == address(0) || to == address(0)) return false; // Minting/burning
        return true;
    }

    /**
     * @dev Override transfer to include fee mechanism
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPaused {
        if (shouldTakeFees(from, to)) {
            (uint256 creatorFee, uint256 platformFee) = calculateFees(amount);
            uint256 totalFees = creatorFee + platformFee;
            uint256 transferAmount = amount - totalFees;
            
            // Transfer fees to this contract
            if (totalFees > 0) {
                super._update(from, address(this), totalFees);
                
                // Track pending fees
                pendingCreatorFees[creator] += creatorFee;
                pendingPlatformFees[platformFeeRecipient] += platformFee;
                totalCreatorFeesCollected += creatorFee;
                totalPlatformFeesCollected += platformFee;
                
                emit FeesCollected(from, to, amount, creatorFee, platformFee);
            }
            
            // Transfer remaining amount to recipient
            super._update(from, to, transferAmount);
        } else {
            // No fees - regular transfer
            super._update(from, to, amount);
        }
    }

    /**
     * @dev Withdraw accumulated creator fees
     */
    function withdrawCreatorFees() external nonReentrant onlyCreator {
        uint256 amount = pendingCreatorFees[creator];
        require(amount > 0, "No fees to withdraw");
        
        pendingCreatorFees[creator] = 0;
        _transfer(address(this), creator, amount);
        
        emit CreatorFeesWithdrawn(creator, amount);
    }

    /**
     * @dev Withdraw accumulated platform fees
     */
    function withdrawPlatformFees() external nonReentrant {
        require(msg.sender == platformFeeRecipient, "Only platform recipient");
        
        uint256 amount = pendingPlatformFees[platformFeeRecipient];
        require(amount > 0, "No fees to withdraw");
        
        pendingPlatformFees[platformFeeRecipient] = 0;
        _transfer(address(this), platformFeeRecipient, amount);
        
        emit PlatformFeesWithdrawn(platformFeeRecipient, amount);
    }

    /**
     * @dev Get fee statistics
     */
    function getFeeStats() external view returns (
        uint256 creatorPending,
        uint256 platformPending,
        uint256 creatorTotal,
        uint256 platformTotal
    ) {
        creatorPending = pendingCreatorFees[creator];
        platformPending = pendingPlatformFees[platformFeeRecipient];
        creatorTotal = totalCreatorFeesCollected;
        platformTotal = totalPlatformFeesCollected;
    }

    /**
     * @dev Update fee exemption status
     */
    function setFeeExempt(address account, bool exempt) external onlyOwner {
        feeExempt[account] = exempt;
        emit FeeExemptionUpdated(account, exempt);
    }

    /**
     * @dev Toggle fees on/off
     */
    function toggleFees() external onlyOwner {
        feesEnabled = !feesEnabled;
        emit FeesToggled(feesEnabled);
    }

    /**
     * @dev Update platform fee recipient
     */
    function updatePlatformFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        
        // Transfer any pending fees to current recipient first
        uint256 pendingAmount = pendingPlatformFees[platformFeeRecipient];
        if (pendingAmount > 0) {
            pendingPlatformFees[platformFeeRecipient] = 0;
            pendingPlatformFees[newRecipient] = pendingAmount;
        }
        
        platformFeeRecipient = newRecipient;
        emit PlatformFeeRecipientUpdated(newRecipient);
    }

    /**
     * @dev Mint new tokens (if enabled)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(canMint, "Minting disabled");
        _mint(to, amount);
    }

    /**
     * @dev Pause token transfers
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Disable minting permanently
     */
    function disableMinting() external onlyOwner {
        canMint = false;
    }

    /**
     * @dev Emergency function to recover stuck tokens (not the token itself)
     */
    function recoverToken(address tokenAddress, uint256 amount) external onlyOwner {
        require(tokenAddress != address(this), "Cannot recover native token");
        IERC20(tokenAddress).transfer(owner(), amount);
    }
}