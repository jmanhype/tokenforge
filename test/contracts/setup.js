const { ethers } = require("hardhat");

// Re-export ethers for tests
module.exports = {
  ethers,
  expect: require("chai").expect
};