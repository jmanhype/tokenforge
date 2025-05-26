const { ethers, expect } = require("./setup.cjs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("MemeCoin", function () {
  // Fixture to deploy contract with standard parameters
  async function deployMemeCoinFixture() {
    const [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    const MemeCoin = await ethers.getContractFactory("MemeCoin");
    const memeCoin = await MemeCoin.deploy(
      "Test Meme Coin",
      "TMC",
      1000000, // 1M tokens (in whole tokens, contract will multiply by 10^18)
      owner.address,
      true, // canMint
      true, // canBurn
      false // canPause
    );

    return { memeCoin, owner, addr1, addr2, addrs };
  }

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      const { memeCoin } = await loadFixture(deployMemeCoinFixture);

      expect(await memeCoin.name()).to.equal("Test Meme Coin");
      expect(await memeCoin.symbol()).to.equal("TMC");
    });

    it("Should mint initial supply to owner", async function () {
      const { memeCoin, owner } = await loadFixture(deployMemeCoinFixture);

      const ownerBalance = await memeCoin.balanceOf(owner.address);
      expect(ownerBalance).to.equal(ethers.parseEther("1000000"));
    });

    it("Should set the correct total supply", async function () {
      const { memeCoin } = await loadFixture(deployMemeCoinFixture);

      const totalSupply = await memeCoin.totalSupply();
      expect(totalSupply).to.equal(ethers.parseEther("1000000"));
    });

    it("Should set feature flags correctly", async function () {
      const { memeCoin } = await loadFixture(deployMemeCoinFixture);

      expect(await memeCoin.canMint()).to.equal(true);
      expect(await memeCoin.canBurn()).to.equal(true);
      expect(await memeCoin.canPause()).to.equal(false);
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const { memeCoin, owner, addr1, addr2 } = await loadFixture(deployMemeCoinFixture);

      // Transfer 50 tokens from owner to addr1
      await expect(
        memeCoin.transfer(addr1.address, ethers.parseEther("50"))
      ).to.changeTokenBalances(
        memeCoin,
        [owner, addr1],
        [ethers.parseEther("-50"), ethers.parseEther("50")]
      );

      // Transfer 50 tokens from addr1 to addr2
      await expect(
        memeCoin.connect(addr1).transfer(addr2.address, ethers.parseEther("50"))
      ).to.changeTokenBalances(
        memeCoin,
        [addr1, addr2],
        [ethers.parseEther("-50"), ethers.parseEther("50")]
      );
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const { memeCoin, owner, addr1 } = await loadFixture(deployMemeCoinFixture);

      const initialOwnerBalance = await memeCoin.balanceOf(owner.address);

      // Try to send more than balance
      await expect(
        memeCoin.connect(addr1).transfer(owner.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(memeCoin, "ERC20InsufficientBalance");

      // Owner balance shouldn't have changed
      expect(await memeCoin.balanceOf(owner.address)).to.equal(
        initialOwnerBalance
      );
    });

    it("Should emit Transfer event", async function () {
      const { memeCoin, owner, addr1 } = await loadFixture(deployMemeCoinFixture);

      await expect(memeCoin.transfer(addr1.address, ethers.parseEther("100")))
        .to.emit(memeCoin, "Transfer")
        .withArgs(owner.address, addr1.address, ethers.parseEther("100"));
    });
  });

  describe("Allowances", function () {
    it("Should approve and transferFrom", async function () {
      const { memeCoin, owner, addr1, addr2 } = await loadFixture(deployMemeCoinFixture);

      // Approve addr1 to spend 100 tokens
      await memeCoin.approve(addr1.address, ethers.parseEther("100"));
      expect(await memeCoin.allowance(owner.address, addr1.address)).to.equal(
        ethers.parseEther("100")
      );

      // Transfer from owner to addr2 using addr1
      await expect(
        memeCoin.connect(addr1).transferFrom(
          owner.address,
          addr2.address,
          ethers.parseEther("50")
        )
      ).to.changeTokenBalances(
        memeCoin,
        [owner, addr2],
        [ethers.parseEther("-50"), ethers.parseEther("50")]
      );

      // Check remaining allowance
      expect(await memeCoin.allowance(owner.address, addr1.address)).to.equal(
        ethers.parseEther("50")
      );
    });

    it("Should fail transferFrom if allowance exceeded", async function () {
      const { memeCoin, owner, addr1, addr2 } = await loadFixture(deployMemeCoinFixture);

      // Approve only 50 tokens
      await memeCoin.approve(addr1.address, ethers.parseEther("50"));

      // Try to transfer 100 tokens
      await expect(
        memeCoin.connect(addr1).transferFrom(
          owner.address,
          addr2.address,
          ethers.parseEther("100")
        )
      ).to.be.revertedWithCustomError(memeCoin, "ERC20InsufficientAllowance");
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint if canMint is true", async function () {
      const { memeCoin, owner, addr1 } = await loadFixture(deployMemeCoinFixture);

      const initialSupply = await memeCoin.totalSupply();
      await memeCoin.mint(addr1.address, ethers.parseEther("1000"));

      expect(await memeCoin.balanceOf(addr1.address)).to.equal(ethers.parseEther("1000"));
      expect(await memeCoin.totalSupply()).to.equal(
        initialSupply + ethers.parseEther("1000")
      );
    });

    it("Should fail to mint if not owner", async function () {
      const { memeCoin, addr1 } = await loadFixture(deployMemeCoinFixture);

      await expect(
        memeCoin.connect(addr1).mint(addr1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(memeCoin, "OwnableUnauthorizedAccount");
    });

    it("Should fail to mint if canMint is false", async function () {
      const [owner] = await ethers.getSigners();
      const MemeCoin = await ethers.getContractFactory("MemeCoin");
      const memeCoin = await MemeCoin.deploy(
        "No Mint Coin",
        "NMC",
        1000000,
        owner.address,
        false, // canMint
        true,
        false
      );

      await expect(
        memeCoin.mint(owner.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Minting is not enabled for this token");
    });
  });

  describe("Burning", function () {
    it("Should allow token holders to burn if canBurn is true", async function () {
      const { memeCoin, owner } = await loadFixture(deployMemeCoinFixture);

      const initialBalance = await memeCoin.balanceOf(owner.address);
      const initialSupply = await memeCoin.totalSupply();

      await memeCoin.burn(ethers.parseEther("1000"));

      expect(await memeCoin.balanceOf(owner.address)).to.equal(
        initialBalance - ethers.parseEther("1000")
      );
      expect(await memeCoin.totalSupply()).to.equal(
        initialSupply - ethers.parseEther("1000")
      );
    });

    it("Should fail to burn more than balance", async function () {
      const { memeCoin, addr1 } = await loadFixture(deployMemeCoinFixture);

      await expect(
        memeCoin.connect(addr1).burn(ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(memeCoin, "ERC20InsufficientBalance");
    });

    it("Should fail to burn if canBurn is false", async function () {
      const [owner] = await ethers.getSigners();
      const MemeCoin = await ethers.getContractFactory("MemeCoin");
      const memeCoin = await MemeCoin.deploy(
        "No Burn Coin",
        "NBC",
        1000000,
        owner.address,
        true,
        false, // canBurn
        false
      );

      await expect(
        memeCoin.burn(ethers.parseEther("1000"))
      ).to.be.revertedWith("Burning is not enabled for this token");
    });
  });

  describe("Pausable", function () {
    it("Should fail all pause operations if canPause is false", async function () {
      const { memeCoin, owner } = await loadFixture(deployMemeCoinFixture);

      await expect(memeCoin.pause()).to.be.revertedWith("Pausing is not enabled for this token");
      await expect(memeCoin.unpause()).to.be.revertedWith("Pausing is not enabled for this token");
    });

    it("Should allow pause/unpause if canPause is true", async function () {
      const [owner] = await ethers.getSigners();
      const MemeCoin = await ethers.getContractFactory("MemeCoin");
      const memeCoin = await MemeCoin.deploy(
        "Pausable Coin",
        "PC",
        1000000,
        owner.address,
        true,
        true,
        true // canPause
      );

      // Should start unpaused
      expect(await memeCoin.paused()).to.equal(false);

      // Pause
      await memeCoin.pause();
      expect(await memeCoin.paused()).to.equal(true);

      // Unpause
      await memeCoin.unpause();
      expect(await memeCoin.paused()).to.equal(false);
    });

    it("Should block transfers when paused", async function () {
      const [owner, addr1] = await ethers.getSigners();
      const MemeCoin = await ethers.getContractFactory("MemeCoin");
      const memeCoin = await MemeCoin.deploy(
        "Pausable Coin",
        "PC",
        1000000,
        owner.address,
        true,
        true,
        true // canPause
      );

      await memeCoin.pause();

      await expect(
        memeCoin.transfer(addr1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(memeCoin, "EnforcedPause");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero transfers", async function () {
      const { memeCoin, owner, addr1 } = await loadFixture(deployMemeCoinFixture);

      await expect(
        memeCoin.transfer(addr1.address, 0)
      ).to.not.be.reverted;

      await expect(
        memeCoin.transfer(addr1.address, 0)
      ).to.emit(memeCoin, "Transfer")
        .withArgs(owner.address, addr1.address, 0);
    });

    it("Should handle maximum supply correctly", async function () {
      const [owner] = await ethers.getSigners();
      const MemeCoin = await ethers.getContractFactory("MemeCoin");
      
      // Deploy with maximum allowed supply (1 trillion tokens)
      const maxSupply = 1000000000000; // 1 trillion tokens
      const memeCoin = await MemeCoin.deploy(
        "Max Supply Coin",
        "MSC",
        maxSupply,
        owner.address,
        true,
        true,
        false
      );

      const expectedSupply = ethers.parseEther(maxSupply.toString());
      expect(await memeCoin.totalSupply()).to.equal(expectedSupply);
      expect(await memeCoin.balanceOf(owner.address)).to.equal(expectedSupply);

      // Should fail to mint more (would exceed MAX_SUPPLY)
      await expect(
        memeCoin.mint(owner.address, 1)
      ).to.be.revertedWith("Minting would exceed maximum supply");
    });
  });
});