const { assert, expect } = require("chai");
const { deployments, getNamedAccounts, ethers, network } = require("hardhat");
const { developmentChain } = require("../../helper-hardhat-config");

!developmentChain.includes(network.name)
  ? describe.skip
  : describe("DSCEngine", () => {
    let mockERC20;
    let mockERC20BTC;
    let MockV3Aggregator;
    let MockV3Aggregator2;
    let DSC;
    let DSCEngine;
    let deployer;
    beforeEach(async () => {
      deployer = (await getNamedAccounts()).deployer;

      await deployments.fixture(["all"]);

      MockV3Aggregator = await ethers.getContract(
        "MockV3Aggregator",
        deployer
      );
      MockV3Aggregator2 = await ethers.getContractAt(
        "MockV3Aggregator2",
        deployer
      );
      mockERC20 = await ethers.getContract("ETHToken", deployer);
      DSC = await ethers.getContract("DecentralisedStableCoin", deployer);
      DSCEngine = await ethers.getContract("DSCEngine", deployer);
      mockERC20BTC = await ethers.getContract("BTCToken", deployer);
    });

    describe("Constructor", () => {
      it("Sets the constructor variables tokens", async () => {
        const colateral = await DSCEngine.getCollateralTokens(0);
        assert.equal(colateral, mockERC20.address);
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
      });

      describe("checks the account information", () => {
        it("gets the collateral value", async () => {
          const x = ethers.utils.parseEther("1");
          await mockERC20.approve(DSCEngine.address, x);
          await DSCEngine.depositCollateral(mockERC20.address, x);
          const z = await DSCEngine._getAccountCollateralValue(deployer);
          console.log(z.toString());
        });
      });

      describe("Deposit Collateral", () => {
        it("Fails to deposit when deposit amount is 0", async () => {
          const x = ethers.utils.parseEther("1");
          await expect(
            DSCEngine.depositCollateral(mockERC20.address, 0)
          ).to.be.revertedWith("DSCEngine__NeedsMoreThanZero");
        });
        it("Fails when the collateral token is not in allowed list", async () => {
          const x = ethers.utils.parseEther("1");
          await expect(
            DSCEngine.depositCollateral(DSC.address, x)
          ).to.be.revertedWith("DSCEngine__TokenNotAllowed");
        });
        it("Deposits the collaterral", async () => {
          const x = ethers.utils.parseEther("1");
          await mockERC20.approve(DSCEngine.address, x);
          await expect(
            await DSCEngine.depositCollateral(mockERC20.address, x)
          );
        });
        it("Emits an event", async () => {
          const x = ethers.utils.parseEther("1");
          await mockERC20.approve(DSCEngine.address, x);
          await expect(
            await DSCEngine.depositCollateral(mockERC20.address, x)
          ).to.emit(DSCEngine, "CollateralDeposited");
        });
        it("updates the balance of the DSCEngine contract in ERC20 token balance", async () => {
          const x = ethers.utils.parseEther("1");
          await mockERC20.approve(DSCEngine.address, x);
          await DSCEngine.depositCollateral(mockERC20.address, x);
          const y = await mockERC20.balanceOf(DSCEngine.address);
          assert.equal(y.toString(), x.toString());
        });
      });

      describe("Mint DSC funtion", () => {
        beforeEach(async () => {
          const x = ethers.utils.parseEther("1");
          await mockERC20.approve(DSCEngine.address, x);
          await DSCEngine.depositCollateral(mockERC20.address, x);
        });
        it("should mint only if the tokens to be minted is more than 0", async () => {
          await expect(DSCEngine.mintDSC(0)).to.be.revertedWith(
            "DSCEngine__NeedsMoreThanZero"
          );
        });
        it("Will be reverted when it breaks the health factor", async () => {
          await expect(
            DSCEngine.mintDSC(ethers.utils.parseEther("1"))
          ).to.be.revertedWith("DSCEngine__BreaksHealthFactor");
        });
        it("will mint tokens only if the health factor is not broken", async () => {
          await DSCEngine.mintDSC(ethers.utils.parseEther("0.01"));
          //   ).to.be.revertedWith("DSCEngine__BreaksHealthFactor");
        });
      });

      describe('Checks the state varibles', () => {
        it("checks the pricefeed mapping", async () => {
          const x = await DSCEngine.getPriceFeedAddress(mockERC20.address);
          assert.equal(x, MockV3Aggregator.address);
          const y = await DSCEngine.getPriceFeedAddress(mockERC20BTC.address);
          assert.equal(y.toLowerCase(), MockV3Aggregator2.address.toLowerCase());
        })
      });

      describe("checks the deposit in usd", () => {
        it("The value in USD ", async () => {
          const x = ethers.utils.parseEther("1");
          const y = await DSCEngine.getUSDValue(mockERC20BTC.address, x);
          console.log(y.toString());
          // assert.equal(y.toString(), "30000000000000000000000");
          const z = await DSCEngine.getUSDValue(mockERC20.address, x);
          console.log(z.toString());
        });
      });
      
    });
  });