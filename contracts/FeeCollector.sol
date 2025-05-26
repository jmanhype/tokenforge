// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FeeCollector
 * @dev Collects and manages platform fees with configurable distribution
 * @notice This contract handles all fee collection and distribution for the platform
 */
contract FeeCollector is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Fee types
    enum FeeType {
        TOKEN_CREATION,
        BONDING_CURVE_TRADE,
        DEX_GRADUATION,
        LIQUIDITY_PROVISION,
        MULTI_SIG_DEPLOYMENT
    }
    
    // Fee configuration
    struct FeeConfig {
        uint256 amount;           // Fee amount in basis points (100 = 1%)
        uint256 minAmount;        // Minimum fee in wei
        uint256 maxAmount;        // Maximum fee in wei (0 = no limit)
        bool isEnabled;           // Whether this fee is active
        bool isPercentage;        // true = percentage, false = fixed amount
    }
    
    // Revenue share configuration
    struct RevenueShare {
        address recipient;
        uint256 share;            // Share in basis points (100 = 1%)
        string description;
    }
    
    // Constants
    uint256 public constant BASIS_POINTS = 10000; // 100%
    uint256 public constant MAX_FEE_PERCENTAGE = 1000; // 10% max fee
    
    // State variables
    mapping(FeeType => FeeConfig) public feeConfigs;
    RevenueShare[] public revenueShares;
    uint256 public totalShares;
    
    // Fee collection tracking
    mapping(address => mapping(FeeType => uint256)) public userFeesPaid;
    mapping(FeeType => uint256) public totalFeesCollected;
    uint256 public totalRevenue;
    uint256 public totalDistributed;
    
    // Treasury and emergency
    address public treasury;
    address public emergencyWithdrawAddress;
    bool public paused;
    
    // Events
    event FeeCollected(
        address indexed payer,
        FeeType indexed feeType,
        uint256 amount,
        address token
    );
    
    event FeeConfigUpdated(
        FeeType indexed feeType,
        uint256 amount,
        bool isEnabled
    );
    
    event RevenueDistributed(
        address indexed recipient,
        uint256 amount,
        address token
    );
    
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event EmergencyWithdraw(address indexed recipient, uint256 amount, address token);
    event PausedStateChanged(bool isPaused);
    
    /**
     * @dev Constructor
     * @param _treasury Address to receive unallocated fees
     * @param _emergencyAddress Address for emergency withdrawals
     */
    constructor(address _treasury, address _emergencyAddress) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        require(_emergencyAddress != address(0), "Invalid emergency address");
        
        treasury = _treasury;
        emergencyWithdrawAddress = _emergencyAddress;
        
        // Initialize default fee configurations
        _initializeDefaultFees();
    }
    
    /**
     * @dev Initialize default fee configurations
     */
    function _initializeDefaultFees() private {
        // Token creation fee: 0.01 ETH fixed
        feeConfigs[FeeType.TOKEN_CREATION] = FeeConfig({
            amount: 0.01 ether,
            minAmount: 0.01 ether,
            maxAmount: 0.01 ether,
            isEnabled: true,
            isPercentage: false
        });
        
        // Bonding curve trading fee: 1% of trade amount
        feeConfigs[FeeType.BONDING_CURVE_TRADE] = FeeConfig({
            amount: 100, // 1%
            minAmount: 0.0001 ether,
            maxAmount: 1 ether,
            isEnabled: true,
            isPercentage: true
        });
        
        // DEX graduation fee: 2.5% of liquidity
        feeConfigs[FeeType.DEX_GRADUATION] = FeeConfig({
            amount: 250, // 2.5%
            minAmount: 0.01 ether,
            maxAmount: 10 ether,
            isEnabled: true,
            isPercentage: true
        });
        
        // Liquidity provision fee: 0.5% of liquidity
        feeConfigs[FeeType.LIQUIDITY_PROVISION] = FeeConfig({
            amount: 50, // 0.5%
            minAmount: 0.001 ether,
            maxAmount: 0,
            isEnabled: true,
            isPercentage: true
        });
        
        // Multi-sig deployment: 0.005 ETH fixed
        feeConfigs[FeeType.MULTI_SIG_DEPLOYMENT] = FeeConfig({
            amount: 0.005 ether,
            minAmount: 0.005 ether,
            maxAmount: 0.005 ether,
            isEnabled: true,
            isPercentage: false
        });
    }
    
    /**
     * @dev Calculate fee amount
     * @param feeType Type of fee
     * @param baseAmount Base amount for percentage fees
     * @return feeAmount Calculated fee amount
     */
    function calculateFee(FeeType feeType, uint256 baseAmount) public view returns (uint256) {
        FeeConfig memory config = feeConfigs[feeType];
        
        if (!config.isEnabled) {
            return 0;
        }
        
        uint256 feeAmount;
        
        if (config.isPercentage) {
            feeAmount = (baseAmount * config.amount) / BASIS_POINTS;
        } else {
            feeAmount = config.amount;
        }
        
        // Apply min/max limits
        if (feeAmount < config.minAmount) {
            feeAmount = config.minAmount;
        }
        
        if (config.maxAmount > 0 && feeAmount > config.maxAmount) {
            feeAmount = config.maxAmount;
        }
        
        return feeAmount;
    }
    
    /**
     * @dev Collect fee in ETH
     * @param feeType Type of fee being collected
     */
    function collectFeeETH(FeeType feeType) external payable nonReentrant {
        require(!paused, "Fee collection paused");
        
        uint256 requiredFee = calculateFee(feeType, msg.value);
        require(msg.value >= requiredFee, "Insufficient fee");
        
        userFeesPaid[msg.sender][feeType] += requiredFee;
        totalFeesCollected[feeType] += requiredFee;
        totalRevenue += requiredFee;
        
        // Refund excess
        if (msg.value > requiredFee) {
            (bool success, ) = msg.sender.call{value: msg.value - requiredFee}("");
            require(success, "Refund failed");
        }
        
        emit FeeCollected(msg.sender, feeType, requiredFee, address(0));
    }
    
    /**
     * @dev Collect fee in ERC20 tokens
     * @param feeType Type of fee being collected
     * @param token Token address
     * @param amount Amount for percentage calculation
     */
    function collectFeeToken(
        FeeType feeType,
        address token,
        uint256 amount
    ) external nonReentrant {
        require(!paused, "Fee collection paused");
        require(token != address(0), "Invalid token");
        
        uint256 requiredFee = calculateFee(feeType, amount);
        require(requiredFee > 0, "No fee required");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), requiredFee);
        
        userFeesPaid[msg.sender][feeType] += requiredFee;
        totalFeesCollected[feeType] += requiredFee;
        totalRevenue += requiredFee;
        
        emit FeeCollected(msg.sender, feeType, requiredFee, token);
    }
    
    /**
     * @dev Distribute collected fees to revenue share recipients
     */
    function distributeRevenue() external nonReentrant {
        require(!paused, "Distribution paused");
        require(totalShares > 0, "No revenue shares configured");
        
        uint256 availableETH = address(this).balance;
        require(availableETH > 0, "No ETH to distribute");
        
        uint256 distributed = 0;
        
        for (uint256 i = 0; i < revenueShares.length; i++) {
            RevenueShare memory share = revenueShares[i];
            
            if (share.share > 0 && share.recipient != address(0)) {
                uint256 amount = (availableETH * share.share) / totalShares;
                
                if (amount > 0) {
                    (bool success, ) = share.recipient.call{value: amount}("");
                    require(success, "Distribution failed");
                    
                    distributed += amount;
                    emit RevenueDistributed(share.recipient, amount, address(0));
                }
            }
        }
        
        totalDistributed += distributed;
        
        // Send remaining to treasury
        uint256 remaining = address(this).balance;
        if (remaining > 0) {
            (bool success, ) = treasury.call{value: remaining}("");
            require(success, "Treasury transfer failed");
            emit RevenueDistributed(treasury, remaining, address(0));
        }
    }
    
    /**
     * @dev Distribute specific ERC20 token revenue
     * @param token Token to distribute
     */
    function distributeTokenRevenue(address token) external nonReentrant {
        require(!paused, "Distribution paused");
        require(token != address(0), "Invalid token");
        require(totalShares > 0, "No revenue shares configured");
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to distribute");
        
        for (uint256 i = 0; i < revenueShares.length; i++) {
            RevenueShare memory share = revenueShares[i];
            
            if (share.share > 0 && share.recipient != address(0)) {
                uint256 amount = (balance * share.share) / totalShares;
                
                if (amount > 0) {
                    IERC20(token).safeTransfer(share.recipient, amount);
                    emit RevenueDistributed(share.recipient, amount, token);
                }
            }
        }
        
        // Send remaining to treasury
        uint256 remaining = IERC20(token).balanceOf(address(this));
        if (remaining > 0) {
            IERC20(token).safeTransfer(treasury, remaining);
            emit RevenueDistributed(treasury, remaining, token);
        }
    }
    
    /**
     * @dev Update fee configuration
     * @param feeType Type of fee to update
     * @param amount New fee amount
     * @param minAmount New minimum amount
     * @param maxAmount New maximum amount
     * @param isEnabled Whether fee is enabled
     * @param isPercentage Whether fee is percentage-based
     */
    function updateFeeConfig(
        FeeType feeType,
        uint256 amount,
        uint256 minAmount,
        uint256 maxAmount,
        bool isEnabled,
        bool isPercentage
    ) external onlyOwner {
        require(!isPercentage || amount <= MAX_FEE_PERCENTAGE, "Fee too high");
        require(minAmount <= maxAmount || maxAmount == 0, "Invalid min/max");
        
        feeConfigs[feeType] = FeeConfig({
            amount: amount,
            minAmount: minAmount,
            maxAmount: maxAmount,
            isEnabled: isEnabled,
            isPercentage: isPercentage
        });
        
        emit FeeConfigUpdated(feeType, amount, isEnabled);
    }
    
    /**
     * @dev Add revenue share recipient
     * @param recipient Address to receive share
     * @param share Share in basis points
     * @param description Description of recipient
     */
    function addRevenueShare(
        address recipient,
        uint256 share,
        string memory description
    ) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(share > 0, "Share must be positive");
        require(totalShares + share <= BASIS_POINTS, "Total shares exceed 100%");
        
        revenueShares.push(RevenueShare({
            recipient: recipient,
            share: share,
            description: description
        }));
        
        totalShares += share;
    }
    
    /**
     * @dev Remove revenue share recipient
     * @param index Index of recipient to remove
     */
    function removeRevenueShare(uint256 index) external onlyOwner {
        require(index < revenueShares.length, "Invalid index");
        
        totalShares -= revenueShares[index].share;
        
        // Move last element to deleted position
        revenueShares[index] = revenueShares[revenueShares.length - 1];
        revenueShares.pop();
    }
    
    /**
     * @dev Update treasury address
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        
        address oldTreasury = treasury;
        treasury = newTreasury;
        
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /**
     * @dev Pause/unpause fee collection
     * @param _paused Pause state
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedStateChanged(_paused);
    }
    
    /**
     * @dev Emergency withdraw
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external {
        require(msg.sender == emergencyWithdrawAddress, "Not emergency address");
        
        if (token == address(0)) {
            (bool success, ) = emergencyWithdrawAddress.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(emergencyWithdrawAddress, amount);
        }
        
        emit EmergencyWithdraw(emergencyWithdrawAddress, amount, token);
    }
    
    /**
     * @dev Get revenue share count
     * @return Number of revenue share recipients
     */
    function getRevenueShareCount() external view returns (uint256) {
        return revenueShares.length;
    }
    
    /**
     * @dev Get user's total fees paid
     * @param user User address
     * @return total Total fees paid by user
     */
    function getUserTotalFees(address user) external view returns (uint256 total) {
        for (uint256 i = 0; i < 5; i++) {
            total += userFeesPaid[user][FeeType(i)];
        }
    }
    
    /**
     * @dev Receive ETH
     */
    receive() external payable {}
}