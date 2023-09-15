const { networkConfig } = require("../helper-hardhat-config");
const { network, ethers } = require("hardhat");
const { developmentChain } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");
// const { address } = require("./00-deploy-mocks");


module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deployer } = await getNamedAccounts();
  const { deploy, log } = deployments;
  const chainId = network.config.chainId;

  const mockV3Aggregator = await deployments.get("MockV3Aggregator1");
  const mockERC20 = await deployments.get("ETHToken");
  const mockERC202 = await deployments.get("BTCToken");
  const DSC = await deployments.get("DecentralisedStableCoin");
  const mockV3Aggregator2 = await deployments.get("MockV3Aggregator2",deployer);

  const priceFeedAddress = [mockV3Aggregator.address, mockV3Aggregator2.address];
  const tokencontracts = [mockERC20.address, mockERC202.address];

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
