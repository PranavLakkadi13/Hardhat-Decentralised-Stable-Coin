const { networkConfig } = require("../helper-hardhat-config");
const { network, ethers } = require("hardhat");
const { developmentChain } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");


module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deployer } = await getNamedAccounts();
  const { deploy, log } = deployments;
  const chainId = network.config.chainId;

  const mockV3Aggregator = await deployments.get("MockV3Aggregator");
  const mockERC20 = await deployments.get("ETHToken");
  const DSC = await deployments.get("DecentralisedStableCoin");

  const priceFeedAddress = [mockV3Aggregator.address, mockV3Aggregator.address];
  const tokencontracts = [mockERC20.address, mockERC20.address];

  const args = [tokencontracts, priceFeedAddress, DSC.address];

  log("Local network detected!!!!");
  log("Deploying mocks ---> ");
  const DSCEngine = await deploy("DSCEngine", {
    from: deployer,
    args: args, 
    log: true,
  });

  if (
    !developmentChain.includes(network.name) &&
    process.env.PolygonScan_API_KEY
  ) {
    await verify(DSCEngine.address, args);
  }
  log("deploying the contract on the test network!!!!!");
  log("---------------------------------------------------");

  log("----------------------------------------------");
  log("DSCEngine Deployed!!!!!!!");
  log("-----------------------------------------------");
};

module.exports.tags = ["all", "DSCEngine"];
