// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title BondingCurve
 * @dev Bonding curve contract for meme token launches with x^1.5 pricing
 * @notice This contract implements a bonding curve for token trading before DEX listing
 */
contract BondingCurve is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // Token being traded
    IERC20 public immutable token;
    
    // Bonding curve parameters
    uint256 public constant K = 10000; // Price constant (0.00001 * 1e9)
    uint256 public constant N = 15; // Exponent * 10 (1.5)
    uint256 public constant DECIMALS = 1e18;
    uint256 public constant PRICE_DECIMALS = 1e9;
    
    // Graduation thresholds
    uint256 public constant GRADUATION_MARKET_CAP = 100000 * DECIMALS; // $100k
    uint256 public constant GRADUATION_LIQUIDITY = 50000 * DECIMALS; // $50k
    uint256 public constant GRADUATION_HOLDERS = 100; // 100 unique holders
    uint256 public constant GRADUATION_VOLUME = 25000 * DECIMALS; // $25k daily volume
    
    // State variables
    uint256 public reserveBalance;
    uint256 public tokenSupply;
    uint256 public totalVolume;
    uint256 public dailyVolume;
    uint256 public lastVolumeReset;
    mapping(address => uint256) public balances;
    mapping(address => bool) public hasTraded;
    uint256 public uniqueHolders;
    
    // Graduation state
    bool public graduated;
    address public dexPool;
    
    // Fee structure (basis points)
    uint256 public constant BUY_FEE = 100; // 1%
    uint256 public constant SELL_FEE = 100; // 1%
    uint256 public constant GRADUATION_FEE = 500; // 5% on graduation
    address public feeRecipient;
    
    // Events
    event TokensPurchased(
        address indexed buyer,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 newPrice
    );
    
    event TokensSold(
        address indexed seller,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 newPrice
    );
    
    event Graduated(
        address indexed dexPool,
        uint256 liquidityETH,
        uint256 liquidityTokens
    );
    
    event FeesCollected(
        address indexed recipient,
        uint256 amount
    );
    
    /**
     * @dev Constructor
     * @param _token Address of the token to trade
     * @param _feeRecipient Address to receive trading fees
     */
    constructor(address _token, address _feeRecipient) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        token = IERC20(_token);
        feeRecipient = _feeRecipient;
        lastVolumeReset = block.timestamp;
    }
    
    /**
     * @dev Calculate token price based on supply using x^1.5 curve
     * @param supply Current token supply
     * @return price Price per token in ETH
     */
    function calculatePrice(uint256 supply) public pure returns (uint256) {
        if (supply == 0) return K;
        
        // Price = K * (supply / 1e9)^1.5
        // To handle 1.5 exponent: sqrt(supply^3)
        uint256 normalizedSupply = supply / PRICE_DECIMALS;
        uint256 cubed = normalizedSupply * normalizedSupply * normalizedSupply;
        uint256 sqrtCubed = sqrt(cubed);
        
        return K * sqrtCubed / PRICE_DECIMALS;
    }
    
    /**
     * @dev Calculate amount of tokens that can be bought with given ETH
     * @param ethAmount Amount of ETH to spend
     * @return tokenAmount Amount of tokens to receive
     */
    function calculateBuyAmount(uint256 ethAmount) public view returns (uint256) {
        require(!graduated, "Bonding curve graduated");
        
        uint256 feeAmount = (ethAmount * BUY_FEE) / 10000;
        uint256 ethAfterFee = ethAmount - feeAmount;
        
        // Binary search for token amount
        uint256 low = 0;
        uint256 high = token.totalSupply();
        uint256 result = 0;
        
        while (low <= high) {
            uint256 mid = (low + high) / 2;
            uint256 cost = calculatePurchaseCost(mid);
            
            if (cost <= ethAfterFee) {
                result = mid;
                low = mid + 1;
            } else {
                if (mid > 0) {
                    high = mid - 1;
                } else {
                    break;
                }
            }
        }
        
        return result;
    }
    
    /**
     * @dev Calculate ETH cost to purchase given amount of tokens
     * @param tokenAmount Amount of tokens to buy
     * @return cost ETH cost including fees
     */
    function calculatePurchaseCost(uint256 tokenAmount) public view returns (uint256) {
        require(!graduated, "Bonding curve graduated");
        
        uint256 startSupply = tokenSupply;
        uint256 endSupply = startSupply + tokenAmount;
        
        // Integrate price curve from startSupply to endSupply
        uint256 cost = integratePriceCurve(startSupply, endSupply);
        
        // Add buy fee
        uint256 feeAmount = (cost * BUY_FEE) / (10000 - BUY_FEE);
        
        return cost + feeAmount;
    }
    
    /**
     * @dev Calculate ETH received from selling tokens
     * @param tokenAmount Amount of tokens to sell
     * @return ethAmount ETH to receive after fees
     */
    function calculateSellReturn(uint256 tokenAmount) public view returns (uint256) {
        require(!graduated, "Bonding curve graduated");
        require(tokenAmount <= tokenSupply, "Insufficient liquidity");
        
        uint256 startSupply = tokenSupply - tokenAmount;
        uint256 endSupply = tokenSupply;
        
        // Integrate price curve from startSupply to endSupply
        uint256 ethBeforeFee = integratePriceCurve(startSupply, endSupply);
        
        // Deduct sell fee
        uint256 feeAmount = (ethBeforeFee * SELL_FEE) / 10000;
        
        return ethBeforeFee - feeAmount;
    }
    
    /**
     * @dev Buy tokens with ETH
     */
    function buy() external payable nonReentrant {
        require(!graduated, "Bonding curve graduated");
        require(msg.value > 0, "No ETH sent");
        
        uint256 tokenAmount = calculateBuyAmount(msg.value);
        require(tokenAmount > 0, "Insufficient ETH for minimum purchase");
        
        // Update state
        uint256 feeAmount = (msg.value * BUY_FEE) / 10000;
        uint256 ethAfterFee = msg.value - feeAmount;
        
        tokenSupply += tokenAmount;
        reserveBalance += ethAfterFee;
        totalVolume += msg.value;
        _updateDailyVolume(msg.value);
        
        // Update holder tracking
        if (balances[msg.sender] == 0 && tokenAmount > 0) {
            hasTraded[msg.sender] = true;
            uniqueHolders++;
        }
        balances[msg.sender] += tokenAmount;
        
        // Transfer tokens to buyer
        token.safeTransfer(msg.sender, tokenAmount);
        
        // Transfer fees
        if (feeAmount > 0) {
            (bool success, ) = feeRecipient.call{value: feeAmount}("");
            require(success, "Fee transfer failed");
            emit FeesCollected(feeRecipient, feeAmount);
        }
        
        emit TokensPurchased(msg.sender, msg.value, tokenAmount, calculatePrice(tokenSupply));
        
        // Check graduation criteria
        _checkGraduation();
    }
    
    /**
     * @dev Sell tokens for ETH
     * @param tokenAmount Amount of tokens to sell
     */
    function sell(uint256 tokenAmount) external nonReentrant {
        require(!graduated, "Bonding curve graduated");
        require(tokenAmount > 0, "Invalid amount");
        require(balances[msg.sender] >= tokenAmount, "Insufficient balance");
        
        uint256 ethReturn = calculateSellReturn(tokenAmount);
        require(ethReturn > 0, "No ETH return");
        require(reserveBalance >= ethReturn, "Insufficient reserves");
        
        // Update state
        tokenSupply -= tokenAmount;
        reserveBalance -= ethReturn;
        totalVolume += ethReturn;
        _updateDailyVolume(ethReturn);
        
        balances[msg.sender] -= tokenAmount;
        if (balances[msg.sender] == 0) {
            uniqueHolders--;
        }
        
        // Transfer tokens from seller
        token.safeTransferFrom(msg.sender, address(this), tokenAmount);
        
        // Calculate and transfer fees
        uint256 feeAmount = (ethReturn * SELL_FEE) / (10000 - SELL_FEE);
        uint256 ethAfterFee = ethReturn - feeAmount;
        
        // Transfer ETH to seller
        (bool success, ) = msg.sender.call{value: ethAfterFee}("");
        require(success, "ETH transfer failed");
        
        // Transfer fees
        if (feeAmount > 0) {
            (bool feeSuccess, ) = feeRecipient.call{value: feeAmount}("");
            require(feeSuccess, "Fee transfer failed");
            emit FeesCollected(feeRecipient, feeAmount);
        }
        
        emit TokensSold(msg.sender, tokenAmount, ethAfterFee, calculatePrice(tokenSupply));
    }
    
    /**
     * @dev Graduate to DEX when criteria are met
     * @param _dexPool Address of the DEX pool
     * @param liquidityPercentage Percentage of reserves to add as liquidity (0-100)
     */
    function graduate(address _dexPool, uint256 liquidityPercentage) external onlyOwner {
        require(!graduated, "Already graduated");
        require(_dexPool != address(0), "Invalid DEX pool");
        require(liquidityPercentage <= 100, "Invalid percentage");
        require(isEligibleForGraduation(), "Not eligible for graduation");
        
        graduated = true;
        dexPool = _dexPool;
        
        // Calculate liquidity amounts
        uint256 liquidityETH = (reserveBalance * liquidityPercentage) / 100;
        uint256 liquidityTokens = (tokenSupply * 30) / 100; // 30% of circulating supply
        
        // Deduct graduation fee
        uint256 graduationFeeAmount = (liquidityETH * GRADUATION_FEE) / 10000;
        liquidityETH -= graduationFeeAmount;
        
        // Transfer graduation fee
        if (graduationFeeAmount > 0) {
            (bool feeSuccess, ) = feeRecipient.call{value: graduationFeeAmount}("");
            require(feeSuccess, "Fee transfer failed");
            emit FeesCollected(feeRecipient, graduationFeeAmount);
        }
        
        // NOTE: Actual DEX integration would happen here
        // This would involve:
        // 1. Approving tokens to DEX router
        // 2. Adding liquidity via router
        // 3. Receiving and managing LP tokens
        
        emit Graduated(_dexPool, liquidityETH, liquidityTokens);
    }
    
    /**
     * @dev Check if bonding curve is eligible for graduation
     * @return eligible True if all criteria are met
     */
    function isEligibleForGraduation() public view returns (bool) {
        uint256 currentPrice = calculatePrice(tokenSupply);
        uint256 marketCap = tokenSupply * currentPrice / DECIMALS;
        
        return marketCap >= GRADUATION_MARKET_CAP &&
               reserveBalance >= GRADUATION_LIQUIDITY &&
               uniqueHolders >= GRADUATION_HOLDERS &&
               dailyVolume >= GRADUATION_VOLUME;
    }
    
    /**
     * @dev Get current graduation progress
     * @return marketCapProgress Percentage progress towards market cap target
     * @return liquidityProgress Percentage progress towards liquidity target
     * @return holdersProgress Percentage progress towards holders target
     * @return volumeProgress Percentage progress towards volume target
     */
    function getGraduationProgress() external view returns (
        uint256 marketCapProgress,
        uint256 liquidityProgress,
        uint256 holdersProgress,
        uint256 volumeProgress
    ) {
        uint256 currentPrice = calculatePrice(tokenSupply);
        uint256 marketCap = tokenSupply * currentPrice / DECIMALS;
        
        marketCapProgress = (marketCap * 100) / GRADUATION_MARKET_CAP;
        liquidityProgress = (reserveBalance * 100) / GRADUATION_LIQUIDITY;
        holdersProgress = (uniqueHolders * 100) / GRADUATION_HOLDERS;
        volumeProgress = (dailyVolume * 100) / GRADUATION_VOLUME;
    }
    
    /**
     * @dev Update daily volume tracking
     * @param amount Volume amount to add
     */
    function _updateDailyVolume(uint256 amount) private {
        // Reset daily volume if 24 hours have passed
        if (block.timestamp >= lastVolumeReset + 1 days) {
            dailyVolume = amount;
            lastVolumeReset = block.timestamp;
        } else {
            dailyVolume += amount;
        }
    }
    
    /**
     * @dev Check and trigger graduation if eligible
     */
    function _checkGraduation() private {
        // Auto-graduation could be implemented here
        // For now, graduation requires owner action
    }
    
    /**
     * @dev Integrate price curve between two supply points
     * @param fromSupply Starting supply
     * @param toSupply Ending supply
     * @return Total cost/value between the two points
     */
    function integratePriceCurve(uint256 fromSupply, uint256 toSupply) private pure returns (uint256) {
        // Numerical integration using trapezoidal rule
        uint256 steps = 100;
        uint256 stepSize = (toSupply - fromSupply) / steps;
        uint256 sum = 0;
        
        for (uint256 i = 0; i < steps; i++) {
            uint256 supply1 = fromSupply + (i * stepSize);
            uint256 supply2 = supply1 + stepSize;
            uint256 price1 = calculatePrice(supply1);
            uint256 price2 = calculatePrice(supply2);
            
            // Trapezoidal area
            sum += ((price1 + price2) * stepSize) / (2 * DECIMALS);
        }
        
        return sum;
    }
    
    /**
     * @dev Calculate square root using Babylonian method
     * @param x Input value
     * @return y Square root of x
     */
    function sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        
        uint256 z = (x + 1) / 2;
        y = x;
        
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
    
    /**
     * @dev Update fee recipient
     * @param _feeRecipient New fee recipient address
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Emergency withdraw (only when graduated)
     */
    function emergencyWithdraw() external onlyOwner {
        require(graduated, "Not graduated");
        
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = owner().call{value: balance}("");
            require(success, "Withdrawal failed");
        }
        
        uint256 tokenBalance = token.balanceOf(address(this));
        if (tokenBalance > 0) {
            token.safeTransfer(owner(), tokenBalance);
        }
    }
}