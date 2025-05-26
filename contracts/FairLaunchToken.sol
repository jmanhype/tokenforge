// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FairLaunchToken
 * @dev Meme token with fair launch mechanisms, anti-snipe protection, and advanced features
 */
contract FairLaunchToken is ERC20, ERC20Burnable, ERC20Permit, Ownable, ReentrancyGuard {
    // Fair Launch Configuration
    struct FairLaunchConfig {
        uint256 maxBuyPerWallet;     // Maximum tokens per wallet can buy
        uint256 maxBuyPerTx;         // Maximum tokens per transaction
        uint256 cooldownPeriod;      // Cooldown between purchases
        uint256 antiSnipeBlocks;     // Number of blocks for anti-snipe protection
        bool enabled;                // Whether fair launch is active
    }

    // Auto-liquidity Configuration
    struct AutoLiquidityConfig {
        uint256 liquidityFeePercent; // Fee percentage for auto-liquidity (basis points)
        uint256 minTokensBeforeSwap; // Minimum tokens before adding liquidity
        address liquidityPair;       // DEX pair address
        bool enabled;               // Whether auto-liquidity is enabled
    }

    // Reflection/Rewards Configuration
    struct ReflectionConfig {
        uint256 reflectionFeePercent; // Fee percentage for reflections (basis points)
        bool enabled;                 // Whether reflections are enabled
    }

    // State variables
    FairLaunchConfig public fairLaunchConfig;
    AutoLiquidityConfig public autoLiquidityConfig;
    ReflectionConfig public reflectionConfig;
    
    uint256 public launchBlock;
    uint256 public burnFeePercent = 100; // 1% burn fee (basis points)
    bool public tradingEnabled = false;
    
    mapping(address => uint256) public lastBuyTime;
    mapping(address => uint256) public totalBought;
    mapping(address => bool) public isExcludedFromFees;
    mapping(address => bool) public isBlacklisted;
    
    // Reflection tracking
    uint256 private _totalReflections;
    mapping(address => uint256) private _reflectionBalances;
    mapping(address => bool) private _isExcludedFromReflections;
    address[] private _excluded;
    
    // Events
    event FairLaunchConfigured(
        uint256 maxBuyPerWallet,
        uint256 maxBuyPerTx,
        uint256 cooldownPeriod,
        uint256 antiSnipeBlocks
    );
    event TradingEnabled(uint256 blockNumber);
    event AutoLiquidityAdded(uint256 tokensSwapped, uint256 ethReceived);
    event ReflectionsDistributed(uint256 amount);
    event Blacklisted(address indexed account, bool isBlacklisted);
    
    // Modifiers
    modifier onlyWhenTrading() {
        require(tradingEnabled || msg.sender == owner(), "Trading not enabled");
        _;
    }
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address initialOwner
    ) ERC20(name, symbol) ERC20Permit(name) Ownable(initialOwner) {
        _mint(initialOwner, initialSupply);
        
        // Exclude owner and contract from fees
        isExcludedFromFees[initialOwner] = true;
        isExcludedFromFees[address(this)] = true;
        
        // Initialize with default fair launch config
        fairLaunchConfig = FairLaunchConfig({
            maxBuyPerWallet: (initialSupply * 100) / 10000, // 1% of supply
            maxBuyPerTx: (initialSupply * 50) / 10000,      // 0.5% of supply
            cooldownPeriod: 300,                            // 5 minutes
            antiSnipeBlocks: 3,                              // 3 blocks
            enabled: true
        });
    }
    
    // Fair Launch Functions
    
    function configureFairLaunch(
        uint256 _maxBuyPerWallet,
        uint256 _maxBuyPerTx,
        uint256 _cooldownPeriod,
        uint256 _antiSnipeBlocks
    ) external onlyOwner {
        fairLaunchConfig.maxBuyPerWallet = _maxBuyPerWallet;
        fairLaunchConfig.maxBuyPerTx = _maxBuyPerTx;
        fairLaunchConfig.cooldownPeriod = _cooldownPeriod;
        fairLaunchConfig.antiSnipeBlocks = _antiSnipeBlocks;
        
        emit FairLaunchConfigured(
            _maxBuyPerWallet,
            _maxBuyPerTx,
            _cooldownPeriod,
            _antiSnipeBlocks
        );
    }
    
    function enableTrading() external onlyOwner {
        require(!tradingEnabled, "Trading already enabled");
        tradingEnabled = true;
        launchBlock = block.number;
        emit TradingEnabled(launchBlock);
    }
    
    function disableFairLaunch() external onlyOwner {
        fairLaunchConfig.enabled = false;
    }
    
    // Auto-Liquidity Functions
    
    function configureAutoLiquidity(
        uint256 _liquidityFeePercent,
        uint256 _minTokensBeforeSwap,
        address _liquidityPair
    ) external onlyOwner {
        require(_liquidityFeePercent <= 500, "Fee too high"); // Max 5%
        autoLiquidityConfig.liquidityFeePercent = _liquidityFeePercent;
        autoLiquidityConfig.minTokensBeforeSwap = _minTokensBeforeSwap;
        autoLiquidityConfig.liquidityPair = _liquidityPair;
        autoLiquidityConfig.enabled = true;
    }
    
    // Reflection Functions
    
    function enableReflections(uint256 _reflectionFeePercent) external onlyOwner {
        require(_reflectionFeePercent <= 500, "Fee too high"); // Max 5%
        reflectionConfig.reflectionFeePercent = _reflectionFeePercent;
        reflectionConfig.enabled = true;
    }
    
    function excludeFromReflections(address account) external onlyOwner {
        require(!_isExcludedFromReflections[account], "Already excluded");
        _isExcludedFromReflections[account] = true;
        _excluded.push(account);
    }
    
    // Burn Configuration
    
    function setBurnFee(uint256 _burnFeePercent) external onlyOwner {
        require(_burnFeePercent <= 500, "Fee too high"); // Max 5%
        burnFeePercent = _burnFeePercent;
    }
    
    // Blacklist Functions
    
    function setBlacklist(address account, bool blacklisted) external onlyOwner {
        isBlacklisted[account] = blacklisted;
        emit Blacklisted(account, blacklisted);
    }
    
    // Fee Exclusion
    
    function excludeFromFees(address account, bool excluded) external onlyOwner {
        isExcludedFromFees[account] = excluded;
    }
    
    // Override transfer to implement features
    
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override onlyWhenTrading {
        require(!isBlacklisted[from] && !isBlacklisted[to], "Blacklisted");
        
        // Fair Launch Checks (only on buys from DEX)
        if (fairLaunchConfig.enabled && from != owner() && to != owner()) {
            // Anti-snipe protection
            if (launchBlock > 0 && block.number <= launchBlock + fairLaunchConfig.antiSnipeBlocks) {
                require(to == owner() || from == owner(), "Anti-snipe protection");
            }
            
            // Check if this is a buy (from = pair, to = user)
            if (from == autoLiquidityConfig.liquidityPair && to != address(this)) {
                // Max buy per transaction
                require(amount <= fairLaunchConfig.maxBuyPerTx, "Exceeds max buy per tx");
                
                // Max buy per wallet
                require(
                    totalBought[to] + amount <= fairLaunchConfig.maxBuyPerWallet,
                    "Exceeds max buy per wallet"
                );
                
                // Cooldown period
                require(
                    block.timestamp >= lastBuyTime[to] + fairLaunchConfig.cooldownPeriod,
                    "Cooldown period active"
                );
                
                totalBought[to] += amount;
                lastBuyTime[to] = block.timestamp;
            }
        }
        
        // Calculate fees
        uint256 burnAmount = 0;
        uint256 liquidityAmount = 0;
        uint256 reflectionAmount = 0;
        
        if (!isExcludedFromFees[from] && !isExcludedFromFees[to]) {
            if (burnFeePercent > 0) {
                burnAmount = (amount * burnFeePercent) / 10000;
            }
            
            if (autoLiquidityConfig.enabled && autoLiquidityConfig.liquidityFeePercent > 0) {
                liquidityAmount = (amount * autoLiquidityConfig.liquidityFeePercent) / 10000;
            }
            
            if (reflectionConfig.enabled && reflectionConfig.reflectionFeePercent > 0) {
                reflectionAmount = (amount * reflectionConfig.reflectionFeePercent) / 10000;
            }
        }
        
        uint256 transferAmount = amount - burnAmount - liquidityAmount - reflectionAmount;
        
        // Handle burns
        if (burnAmount > 0) {
            super._update(from, address(0), burnAmount);
        }
        
        // Handle auto-liquidity
        if (liquidityAmount > 0) {
            super._update(from, address(this), liquidityAmount);
            // Auto-liquidity logic would go here (swap and add liquidity)
        }
        
        // Handle reflections
        if (reflectionAmount > 0) {
            _distributeReflections(reflectionAmount);
            super._update(from, address(this), reflectionAmount);
        }
        
        // Transfer remaining amount
        super._update(from, to, transferAmount);
    }
    
    function _distributeReflections(uint256 amount) private {
        _totalReflections += amount;
        emit ReflectionsDistributed(amount);
    }
    
    // Governance Functions (placeholder for future implementation)
    
    mapping(address => uint256) public votingPower;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    function delegate(address delegatee) external {
        votingPower[delegatee] += balanceOf(msg.sender);
    }
    
    // Emergency Functions
    
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        payable(owner()).transfer(balance);
    }
    
    function emergencyWithdrawTokens(address token) external onlyOwner {
        require(token != address(this), "Cannot withdraw own tokens");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        IERC20(token).transfer(owner(), balance);
    }
    
    // View Functions
    
    function getReflectionBalance(address account) external view returns (uint256) {
        if (_isExcludedFromReflections[account]) return balanceOf(account);
        return _reflectionBalances[account];
    }
    
    function getTotalReflections() external view returns (uint256) {
        return _totalReflections;
    }
    
    function isExcludedFromReflections(address account) external view returns (bool) {
        return _isExcludedFromReflections[account];
    }
}