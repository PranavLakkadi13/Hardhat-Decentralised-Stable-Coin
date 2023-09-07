const { assert, expect } = require("chai");
const { deployments, getNamedAccounts, ethers, network } = require("hardhat");
const { developmentChain } = require("../../helper-hardhat-config");

!developmentChain.includes(network.name)
  ? describe.skip
  : describe("DSCEngine", () => {
      let mockERC20;
      let MockV3Aggregator;
      let DSC;
      let DSCEngine;
      let deployer;
      beforeEach(async () => {
          deployer = (await getNamedAccounts()).deployer

          await deployments.fixture(["all"]);

          MockV3Aggregator = await ethers.getContract("MockV3Aggregator",deployer);
          mockERC20 = await ethers.getContract("ETHToken", deployer);
          DSC = await ethers.getContract("DecentralisedStableCoin", deployer);
          DSCEngine = await ethers.getContract("DSCEngine", deployer);
      });

      describe('Constructor', () => {
          it("Sets the constructor variables tokens", async () => {
              const colateral = await DSCEngine.getCollateralTokens(0);
              assert.equal(colateral, mockERC20.address)
          });
          it("sets the priceFeeds addresses", async () => {
              const priceFeed = await DSCEngine.getPriceFeedAddress(
                  DSCEngine.getCollateralTokens(0)
              );
              assert.equal(priceFeed, MockV3Aggregator.address);
          });
          it("sets the DSC address", async () => {
              const DSc = await DSCEngine.getDSCContractAddress();
              assert.equal(DSc, DSC.address);
          })
      

          describe("checks the deposit in usd", () => {
              it("The value in USd ", async () => {
                  const x = ethers.utils.parseEther("1");
                  const y = await DSCEngine.getUSDValue(mockERC20.address, x);
                  assert.equal(y.toString(), "2000000000000000000000");
              });
          });

          describe('Gets the collateral value in USD', () => {
              it("colateral value", async () => {
                
              })
          })
      

          describe("Deposit Collateral", () => {
              it("Fails to deposit when deposit amount is 0", async () => {
                  const x = ethers.utils.parseEther("1");
                  await expect(
                      DSCEngine.depositCollateral(mockERC20.address, 0)
                  ).to.be.revertedWith(
                      "DSCEngine__NeedsMoreThanZero"
                  );
              });
              it("Fails when the collateral token is not in allowed list", async () => {
                  const x = ethers.utils.parseEther("1");
                  await expect(
                      DSCEngine.depositCollateral(DSC.address, x)
                  ).to.be.revertedWith("DSCEngine__TokenNotAllowed");
              })
              it("Deposits the collaterral", async () => {
                  const x = ethers.utils.parseEther("1");
                  await mockERC20.approve(DSCEngine.address, x);
                  await expect(await DSCEngine.depositCollateral(mockERC20.address, x));
              });
              it("Emits an event", async () => {
                  const x = ethers.utils.parseEther("1");
                  await mockERC20.approve(DSCEngine.address, x);
                  await expect(
                      await DSCEngine.depositCollateral(mockERC20.address, x)
                  ).to.emit(DSCEngine, "CollateralDeposited");
              });
          });
      });
});

