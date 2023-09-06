const { networkConfig } = require("../helper-hardhat-config");
const { network, ethers } = require("hardhat");
const {
  developmentChain,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deployer } = await getNamedAccounts();
  const { deploy, log } = deployments;
  const chainId = network.config.chainId;

  const args = [];

  const DecentralisedStableCoin = await deploy("DecentralisedStableCoin", {
    from: deployer,
    // in this contract, we can choose our initial price since it is a mock
    args: args, // --> constructor args
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  if (
    !developmentChain.includes(network.name) &&
    process.env.PolygonScan_API_KEY
  ) {
    await verify(DecentralisedStableCoin.address, args);
  }
  log("deploying the contract on the test network!!!!!");
  log("---------------------------------------------------");

  log("----------------------------------------------");
  log("DecentralisedStableCoin Deployed!!!!!!!");
  log("-----------------------------------------------");
};

module.exports.tags = ["all", "DSC"];
