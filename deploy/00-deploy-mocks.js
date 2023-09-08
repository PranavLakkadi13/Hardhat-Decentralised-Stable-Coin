const { networkConfig } = require("../helper-hardhat-config");
const { network, ethers } = require("hardhat");
const {
  developmentChain,
  initialAnswer,
  decimals,
} = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deployer } = await getNamedAccounts();
  const { deploy, log } = deployments;
  const chainId = network.config.chainId;

  if (developmentChain.includes(network.name)) {
    log("Local network detected!!!!");
    log("Deploying mocks ---> ");
    await deploy("MockV3Aggregator", {
      from: deployer,
      // in this contract we can choose our inital price since it is a mock
      args: [decimals, initialAnswer], // --> constructor args
      log: true,
    });
    log("----------------------------------------------");
    log("Mockv3Aggregator -- ETH Price Feed  Deployed!!!!!!!");
    log("-----------------------------------------------");

    log("Local network detected!!!!");
    log("Deploying mocks ---> ");
    const MockV3Aggregator2 = await deploy("MockV3Aggregator", {
      from: deployer,
      // in this contract we can choose our inital price since it is a mock
      args: [8, 20000_00000000], // --> constructor args
      log: true,
    });
    console.log(MockV3Aggregator2.address);
    log("----------------------------------------------");
    log("Mockv3Aggregator2 -- BTC price Feed Deployed!!!!!!!");
    log("-----------------------------------------------");

    const totalsupply = ethers.utils.parseEther("100000");

    log("Local network detected!!!!");
    log("Deploying mocks ---> ");
    await deploy("ETHToken", {
      from: deployer,
      // in this contract we can choose our inital price since it is a mock
      args: [totalsupply], // --> constructor args
      log: true,
    });
    log("----------------------------------------------");
    log("ETHToken Mocks Deployed!!!!!!!");
    log("-----------------------------------------------");

    log("Local network detected!!!!");
    log("Deploying mocks ---> ");
    await deploy("BTCToken", {
      from: deployer,
      // in this contract we can choose our inital price since it is a mock
      args: [totalsupply], // --> constructor args
      log: true,
    });
    log("----------------------------------------------");
    log("BTCToken Mocks Deployed!!!!!!!");
    log("-----------------------------------------------");
  }
};

module.exports.tags = ["all", "mocks"];
