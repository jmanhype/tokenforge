// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title MemeCoin
 * @dev ERC20 Token for meme coins with optional mint, burn, and pause features
 * @custom:security-contact security@memecoingen.com
 */
contract MemeCoin is ERC20, ERC20Burnable, Pausable, Ownable, ERC20Permit {
    bool public canMint;
    bool public canBurn;
    bool public canPause;
    
    uint256 public constant MAX_SUPPLY = 1000000000000 * 10**18; // 1 trillion tokens max
    
    event MintingEnabled(bool enabled);
    event BurningEnabled(bool enabled);
    event PausingEnabled(bool enabled);
    
    /**
     * @dev Constructor for MemeCoin
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial token supply (in whole tokens, will be multiplied by 10^18)
     * @param owner Address that will own the contract
     * @param _canMint Whether minting is allowed
     * @param _canBurn Whether burning is allowed
     * @param _canPause Whether pausing is allowed
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner,
        bool _canMint,
        bool _canBurn,
        bool _canPause
    ) 
        ERC20(name, symbol) 
        Ownable(owner)
        ERC20Permit(name)
    {
        require(initialSupply > 0, "Initial supply must be greater than 0");
        require(initialSupply * 10**18 <= MAX_SUPPLY, "Initial supply exceeds maximum supply");
        require(owner != address(0), "Owner cannot be zero address");
        
        canMint = _canMint;
        canBurn = _canBurn;
        canPause = _canPause;
        
        _mint(owner, initialSupply * 10**18);
        
        emit MintingEnabled(_canMint);
        emit BurningEnabled(_canBurn);
        emit PausingEnabled(_canPause);
    }
    
    /**
     * @dev Mint new tokens (only if minting is enabled)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint (in wei)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(canMint, "Minting is not enabled for this token");
        require(totalSupply() + amount <= MAX_SUPPLY, "Minting would exceed maximum supply");
        _mint(to, amount);
    }
    
    /**
     * @dev Override burn function to check if burning is enabled
     * @param amount Amount of tokens to burn (in wei)
     */
    function burn(uint256 amount) public override {
        require(canBurn, "Burning is not enabled for this token");
        super.burn(amount);
    }
    
    /**
     * @dev Override burnFrom function to check if burning is enabled
     * @param account Address to burn tokens from
     * @param amount Amount of tokens to burn (in wei)
     */
    function burnFrom(address account, uint256 amount) public override {
        require(canBurn, "Burning is not enabled for this token");
        super.burnFrom(account, amount);
    }
    
    /**
     * @dev Pause token transfers (only if pausing is enabled)
     */
    function pause() public onlyOwner {
        require(canPause, "Pausing is not enabled for this token");
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() public onlyOwner {
        require(canPause, "Pausing is not enabled for this token");
        _unpause();
    }
    
    /**
     * @dev Hook that is called before any transfer of tokens
     * @param from Address tokens are transferred from
     * @param to Address tokens are transferred to
     * @param amount Amount of tokens being transferred
     */
    function _update(address from, address to, uint256 amount) 
        internal 
        override 
        whenNotPaused 
    {
        super._update(from, to, amount);
    }
    
    /**
     * @dev Returns token metadata
     */
    function getTokenInfo() public view returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        uint256 tokenTotalSupply,
        bool mintingEnabled,
        bool burningEnabled,
        bool pausingEnabled,
        bool isPaused,
        address tokenOwner
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            canMint,
            canBurn,
            canPause,
            paused(),
            owner()
        );
    }
}