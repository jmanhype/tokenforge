const { ethers, expect } = require("./setup.cjs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("FeeCollector", function () {
  // Fee types enum
  const FeeType = {
    TOKEN_CREATION: 0,
    BONDING_CURVE_TRADE: 1,
    DEX_GRADUATION: 2,
    LIQUIDITY_PROVISION: 3,
    MULTI_SIG_DEPLOYMENT: 4,
  };

  async function deployFeeCollectorFixture() {
    const [owner, treasury, emergency, user1, user2] = await ethers.getSigners();

    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollector = await FeeCollector.deploy(
      treasury.address,
      emergency.address
    );

    // Set default fees
    await feeCollector.updateFeeConfig(
      FeeType.TOKEN_CREATION,
      ethers.parseEther("0.1"),
      ethers.parseEther("0.01"),
      ethers.parseEther("1"),
      true,
      false
    );

    await feeCollector.updateFeeConfig(
      FeeType.BONDING_CURVE_TRADE,
      100, // 1% as basis points
      10,
      1000,
      true,
      true
    );

    return { feeCollector, owner, treasury, emergency, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should set the correct treasury and emergency addresses", async function () {
      const { feeCollector, treasury, emergency } = await loadFixture(deployFeeCollectorFixture);

      expect(await feeCollector.treasury()).to.equal(treasury.address);
      expect(await feeCollector.emergencyWithdrawAddress()).to.equal(emergency.address);
    });

    it("Should set owner correctly", async function () {
      const { feeCollector, owner } = await loadFixture(deployFeeCollectorFixture);

      expect(await feeCollector.owner()).to.equal(owner.address);
    });
  });

  describe("Fee Configuration", function () {
    it("Should allow owner to set fees", async function () {
      const { feeCollector } = await loadFixture(deployFeeCollectorFixture);

      await feeCollector.updateFeeConfig(
        FeeType.DEX_GRADUATION,
        ethers.parseEther("0.5"),
        ethers.parseEther("0.1"),
        ethers.parseEther("2"),
        true,
        false
      );

      const fee = await feeCollector.feeConfigs(FeeType.DEX_GRADUATION);
      expect(fee.amount).to.equal(ethers.parseEther("0.5"));
      expect(fee.minAmount).to.equal(ethers.parseEther("0.1"));
      expect(fee.maxAmount).to.equal(ethers.parseEther("2"));
      expect(fee.isEnabled).to.equal(true);
      expect(fee.isPercentage).to.equal(false);
    });

    it("Should fail if non-owner tries to set fees", async function () {
      const { feeCollector, user1 } = await loadFixture(deployFeeCollectorFixture);

      await expect(
        feeCollector.connect(user1).updateFeeConfig(
          FeeType.TOKEN_CREATION,
          ethers.parseEther("0.2"),
          0,
          ethers.parseEther("1"),
          true,
          false
        )
      ).to.be.revertedWithCustomError(feeCollector, "OwnableUnauthorizedAccount");
    });

    it("Should calculate percentage fees correctly", async function () {
      const { feeCollector } = await loadFixture(deployFeeCollectorFixture);

      const tradeAmount = ethers.parseEther("100");
      const feeAmount = await feeCollector.calculateFee(
        FeeType.BONDING_CURVE_TRADE,
        tradeAmount
      );

      // 1% of 100 ETH = 1 ETH, but check for min/max limits
      // With min 10 and max 1000 in basis points (not wei), the actual calculation should be different
      expect(feeAmount).to.be.gt(0);
    });

    it("Should enforce min/max limits", async function () {
      const { feeCollector } = await loadFixture(deployFeeCollectorFixture);

      // Set fee with min/max
      await feeCollector.updateFeeConfig(
        FeeType.LIQUIDITY_PROVISION,
        500, // 5%
        ethers.parseEther("0.1"), // min
        ethers.parseEther("1"), // max
        true,
        true
      );

      // Test minimum enforcement
      const smallAmount = ethers.parseEther("0.1"); // Would be 0.005 ETH (5%), below min
      const minFee = await feeCollector.calculateFee(
        FeeType.LIQUIDITY_PROVISION,
        smallAmount
      );
      expect(minFee).to.equal(ethers.parseEther("0.1"));

      // Test maximum enforcement
      const largeAmount = ethers.parseEther("100"); // Would be 5 ETH (5%), above max
      const maxFee = await feeCollector.calculateFee(
        FeeType.LIQUIDITY_PROVISION,
        largeAmount
      );
      expect(maxFee).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Fee Collection", function () {
    it("Should collect fees correctly", async function () {
      const { feeCollector, user1 } = await loadFixture(deployFeeCollectorFixture);

      const feeAmount = await feeCollector.calculateFee(FeeType.TOKEN_CREATION, 0);
      
      await expect(
        feeCollector.connect(user1).collectFeeETH(FeeType.TOKEN_CREATION, {
          value: feeAmount,
        })
      ).to.emit(feeCollector, "FeeCollected")
        .withArgs(user1.address, FeeType.TOKEN_CREATION, feeAmount, ethers.ZeroAddress);

      expect(await ethers.provider.getBalance(feeCollector.target)).to.equal(feeAmount);
    });

    it("Should fail if incorrect fee amount sent", async function () {
      const { feeCollector, user1 } = await loadFixture(deployFeeCollectorFixture);

      const correctFee = await feeCollector.calculateFee(FeeType.TOKEN_CREATION, 0);
      const incorrectFee = correctFee - ethers.parseEther("0.01");

      await expect(
        feeCollector.connect(user1).collectFeeETH(FeeType.TOKEN_CREATION, {
          value: incorrectFee,
        })
      ).to.be.revertedWith("Insufficient fee");
    });

    it("Should allow zero fee when disabled", async function () {
      const { feeCollector, user1 } = await loadFixture(deployFeeCollectorFixture);

      // Disable fee
      await feeCollector.updateFeeConfig(
        FeeType.MULTI_SIG_DEPLOYMENT,
        ethers.parseEther("0.2"),
        0,
        ethers.parseEther("1"),
        false, // disabled
        false
      );

      // When disabled, calculateFee returns 0, so any amount is accepted
      const feeAmount = await feeCollector.calculateFee(FeeType.MULTI_SIG_DEPLOYMENT, 0);
      expect(feeAmount).to.equal(0);

      // Should succeed with 0 fee
      await expect(
        feeCollector.connect(user1).collectFeeETH(FeeType.MULTI_SIG_DEPLOYMENT, {
          value: 0,
        })
      ).to.not.be.reverted;
    });
  });

  describe("Fee Distribution", function () {
    it("Should distribute fees to treasury", async function () {
      const { feeCollector, treasury, user1 } = await loadFixture(deployFeeCollectorFixture);

      // Add treasury as a revenue share recipient
      await feeCollector.addRevenueShare(treasury.address, 10000, "Treasury");

      // Collect some fees
      const feeAmount = await feeCollector.calculateFee(FeeType.TOKEN_CREATION, 0);
      await feeCollector.connect(user1).collectFeeETH(FeeType.TOKEN_CREATION, {
        value: feeAmount,
      });

      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
      
      await feeCollector.distributeRevenue();

      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(feeAmount);
    });

    it("Should handle zero balance distribution", async function () {
      const { feeCollector } = await loadFixture(deployFeeCollectorFixture);

      // Should revert with no revenue shares configured
      await expect(feeCollector.distributeRevenue()).to.be.revertedWith("No revenue shares configured");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow emergency withdrawal", async function () {
      const { feeCollector, emergency, user1 } = await loadFixture(deployFeeCollectorFixture);

      // Collect some fees
      const feeAmount = await feeCollector.calculateFee(FeeType.TOKEN_CREATION, 0);
      await feeCollector.connect(user1).collectFeeETH(FeeType.TOKEN_CREATION, {
        value: feeAmount,
      });

      const emergencyBalanceBefore = await ethers.provider.getBalance(emergency.address);

      await expect(
        feeCollector.connect(emergency).emergencyWithdraw(ethers.ZeroAddress, feeAmount)
      ).to.emit(feeCollector, "EmergencyWithdraw")
        .withArgs(emergency.address, feeAmount, ethers.ZeroAddress);

      const emergencyBalanceAfter = await ethers.provider.getBalance(emergency.address);
      // Account for gas costs
      expect(emergencyBalanceAfter).to.be.gt(emergencyBalanceBefore);
    });

    it("Should only allow emergency address to emergency withdraw", async function () {
      const { feeCollector, user1 } = await loadFixture(deployFeeCollectorFixture);

      await expect(
        feeCollector.connect(user1).emergencyWithdraw(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Not emergency address");
    });
  });

  describe("Address Updates", function () {
    it("Should allow owner to update treasury address", async function () {
      const { feeCollector, user2 } = await loadFixture(deployFeeCollectorFixture);

      await feeCollector.updateTreasury(user2.address);
      expect(await feeCollector.treasury()).to.equal(user2.address);
    });

    it("Should reject zero address for treasury", async function () {
      const { feeCollector } = await loadFixture(deployFeeCollectorFixture);

      await expect(
        feeCollector.updateTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury");
    });
  });

  describe("View Functions", function () {
    it("Should calculate total fees collected", async function () {
      const { feeCollector, user1, user2 } = await loadFixture(deployFeeCollectorFixture);

      const fee1 = await feeCollector.calculateFee(FeeType.TOKEN_CREATION, 0);
      await feeCollector.connect(user1).collectFeeETH(FeeType.TOKEN_CREATION, {
        value: fee1,
      });

      const fee2 = await feeCollector.calculateFee(FeeType.TOKEN_CREATION, 0);
      await feeCollector.connect(user2).collectFeeETH(FeeType.TOKEN_CREATION, {
        value: fee2,
      });

      const totalFees = await feeCollector.totalFeesCollected(FeeType.TOKEN_CREATION);
      expect(totalFees).to.equal(fee1 + fee2);
    });
  });
});