const { expect } = require("chai");
const { ethers } = require("hardhat");
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
    await feeCollector.setFee(
      FeeType.TOKEN_CREATION,
      ethers.parseEther("0.1"),
      ethers.parseEther("0.01"),
      ethers.parseEther("1"),
      true,
      false
    );

    await feeCollector.setFee(
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

      expect(await feeCollector.treasuryAddress()).to.equal(treasury.address);
      expect(await feeCollector.emergencyAddress()).to.equal(emergency.address);
    });

    it("Should set owner correctly", async function () {
      const { feeCollector, owner } = await loadFixture(deployFeeCollectorFixture);

      expect(await feeCollector.owner()).to.equal(owner.address);
    });
  });

  describe("Fee Configuration", function () {
    it("Should allow owner to set fees", async function () {
      const { feeCollector } = await loadFixture(deployFeeCollectorFixture);

      await feeCollector.setFee(
        FeeType.DEX_GRADUATION,
        ethers.parseEther("0.5"),
        ethers.parseEther("0.1"),
        ethers.parseEther("2"),
        true,
        false
      );

      const fee = await feeCollector.getFee(FeeType.DEX_GRADUATION);
      expect(fee.amount).to.equal(ethers.parseEther("0.5"));
      expect(fee.minAmount).to.equal(ethers.parseEther("0.1"));
      expect(fee.maxAmount).to.equal(ethers.parseEther("2"));
      expect(fee.isEnabled).to.equal(true);
      expect(fee.isPercentage).to.equal(false);
    });

    it("Should fail if non-owner tries to set fees", async function () {
      const { feeCollector, user1 } = await loadFixture(deployFeeCollectorFixture);

      await expect(
        feeCollector.connect(user1).setFee(
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

      // 1% of 100 ETH = 1 ETH
      expect(feeAmount).to.equal(ethers.parseEther("1"));
    });

    it("Should enforce min/max limits", async function () {
      const { feeCollector } = await loadFixture(deployFeeCollectorFixture);

      // Set fee with min/max
      await feeCollector.setFee(
        FeeType.LIQUIDITY_PROVISION,
        500, // 5%
        ethers.parseEther("0.1"), // min
        ethers.parseEther("1"), // max
        true,
        true
      );

      // Test below minimum
      const smallAmount = ethers.parseEther("1"); // 5% = 0.05 ETH < 0.1 min
      const smallFee = await feeCollector.calculateFee(
        FeeType.LIQUIDITY_PROVISION,
        smallAmount
      );
      expect(smallFee).to.equal(ethers.parseEther("0.1")); // Should be min

      // Test above maximum
      const largeAmount = ethers.parseEther("100"); // 5% = 5 ETH > 1 max
      const largeFee = await feeCollector.calculateFee(
        FeeType.LIQUIDITY_PROVISION,
        largeAmount
      );
      expect(largeFee).to.equal(ethers.parseEther("1")); // Should be max
    });
  });

  describe("Fee Collection", function () {
    it("Should collect fees correctly", async function () {
      const { feeCollector, user1 } = await loadFixture(deployFeeCollectorFixture);

      const feeAmount = await feeCollector.calculateFee(FeeType.TOKEN_CREATION, 0);
      
      await expect(
        feeCollector.connect(user1).collectFee(FeeType.TOKEN_CREATION, {
          value: feeAmount,
        })
      ).to.emit(feeCollector, "FeeCollected")
        .withArgs(user1.address, FeeType.TOKEN_CREATION, feeAmount);

      expect(await ethers.provider.getBalance(feeCollector.target)).to.equal(feeAmount);
    });

    it("Should fail if incorrect fee amount sent", async function () {
      const { feeCollector, user1 } = await loadFixture(deployFeeCollectorFixture);

      const correctFee = await feeCollector.calculateFee(FeeType.TOKEN_CREATION, 0);
      const incorrectFee = correctFee - ethers.parseEther("0.01");

      await expect(
        feeCollector.connect(user1).collectFee(FeeType.TOKEN_CREATION, {
          value: incorrectFee,
        })
      ).to.be.revertedWith("Incorrect fee amount");
    });

    it("Should fail if fee is disabled", async function () {
      const { feeCollector, user1 } = await loadFixture(deployFeeCollectorFixture);

      // Disable fee
      await feeCollector.setFee(
        FeeType.MULTI_SIG_DEPLOYMENT,
        ethers.parseEther("0.2"),
        0,
        ethers.parseEther("1"),
        false, // disabled
        false
      );

      await expect(
        feeCollector.connect(user1).collectFee(FeeType.MULTI_SIG_DEPLOYMENT, {
          value: ethers.parseEther("0.2"),
        })
      ).to.be.revertedWith("Fee type is disabled");
    });
  });

  describe("Fee Distribution", function () {
    it("Should distribute fees to treasury", async function () {
      const { feeCollector, treasury, user1 } = await loadFixture(deployFeeCollectorFixture);

      // Collect some fees
      const feeAmount = await feeCollector.calculateFee(FeeType.TOKEN_CREATION, 0);
      await feeCollector.connect(user1).collectFee(FeeType.TOKEN_CREATION, {
        value: feeAmount,
      });

      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
      
      await expect(
        feeCollector.distributeFees()
      ).to.emit(feeCollector, "FeesDistributed")
        .withArgs(treasury.address, feeAmount);

      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(feeAmount);
    });

    it("Should handle zero balance distribution", async function () {
      const { feeCollector } = await loadFixture(deployFeeCollectorFixture);

      // Should not revert even with zero balance
      await expect(feeCollector.distributeFees()).to.not.be.reverted;
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow emergency withdrawal", async function () {
      const { feeCollector, emergency, user1 } = await loadFixture(deployFeeCollectorFixture);

      // Collect some fees
      const feeAmount = await feeCollector.calculateFee(FeeType.TOKEN_CREATION, 0);
      await feeCollector.connect(user1).collectFee(FeeType.TOKEN_CREATION, {
        value: feeAmount,
      });

      const emergencyBalanceBefore = await ethers.provider.getBalance(emergency.address);

      await expect(
        feeCollector.emergencyWithdraw()
      ).to.emit(feeCollector, "EmergencyWithdraw")
        .withArgs(emergency.address, feeAmount);

      const emergencyBalanceAfter = await ethers.provider.getBalance(emergency.address);
      expect(emergencyBalanceAfter - emergencyBalanceBefore).to.equal(feeAmount);
    });

    it("Should only allow owner to emergency withdraw", async function () {
      const { feeCollector, user1 } = await loadFixture(deployFeeCollectorFixture);

      await expect(
        feeCollector.connect(user1).emergencyWithdraw()
      ).to.be.revertedWithCustomError(feeCollector, "OwnableUnauthorizedAccount");
    });
  });

  describe("Address Updates", function () {
    it("Should allow owner to update treasury address", async function () {
      const { feeCollector, user2 } = await loadFixture(deployFeeCollectorFixture);

      await feeCollector.setTreasuryAddress(user2.address);
      expect(await feeCollector.treasuryAddress()).to.equal(user2.address);
    });

    it("Should allow owner to update emergency address", async function () {
      const { feeCollector, user2 } = await loadFixture(deployFeeCollectorFixture);

      await feeCollector.setEmergencyAddress(user2.address);
      expect(await feeCollector.emergencyAddress()).to.equal(user2.address);
    });

    it("Should reject zero address for treasury", async function () {
      const { feeCollector } = await loadFixture(deployFeeCollectorFixture);

      await expect(
        feeCollector.setTreasuryAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury address");
    });
  });

  describe("Batch Operations", function () {
    it("Should configure multiple fees at once", async function () {
      const { feeCollector } = await loadFixture(deployFeeCollectorFixture);

      const feeTypes = [0, 1, 2, 3, 4];
      const amounts = [
        ethers.parseEther("0.1"),
        100, // 1% in basis points
        ethers.parseEther("0.5"),
        ethers.parseEther("0.05"),
        ethers.parseEther("0.2"),
      ];
      const enabled = [true, true, true, true, true];

      await feeCollector.configureFees(feeTypes, amounts, enabled);

      // Verify all fees were set
      for (let i = 0; i < feeTypes.length; i++) {
        const fee = await feeCollector.getFee(feeTypes[i]);
        expect(fee.isEnabled).to.equal(true);
      }
    });
  });

  describe("View Functions", function () {
    it("Should return all fee configurations", async function () {
      const { feeCollector } = await loadFixture(deployFeeCollectorFixture);

      const configs = await feeCollector.getAllFeeConfigurations();
      
      // Should have configurations for all fee types that were set
      expect(configs.length).to.be.greaterThan(0);
      expect(configs[0].feeType).to.equal(FeeType.TOKEN_CREATION);
      expect(configs[0].amount).to.equal(ethers.parseEther("0.1"));
    });

    it("Should calculate total fees collected", async function () {
      const { feeCollector, user1, user2 } = await loadFixture(deployFeeCollectorFixture);

      const fee1 = await feeCollector.calculateFee(FeeType.TOKEN_CREATION, 0);
      await feeCollector.connect(user1).collectFee(FeeType.TOKEN_CREATION, {
        value: fee1,
      });

      const fee2 = await feeCollector.calculateFee(FeeType.TOKEN_CREATION, 0);
      await feeCollector.connect(user2).collectFee(FeeType.TOKEN_CREATION, {
        value: fee2,
      });

      const totalFees = await feeCollector.totalFeesCollected();
      expect(totalFees).to.equal(fee1 + fee2);
    });
  });
});