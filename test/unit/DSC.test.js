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
      MockV3Aggregator2 = await ethers.getContract(
        "MockV3Aggregator2",
        deployer
      );
      mockERC20 = await ethers.getContract("ETHToken", deployer);
      DSC = await ethers.getContract("DecentralisedStableCoin", deployer);
      DSCEngine = await ethers.getContract("DSCEngine", deployer);
      mockERC20BTC = await ethers.getContract("BTCToken", deployer);
      await DSC.transferOwnership(DSCEngine.address);
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
      it("checks the price feed address for the mock2Aggregtor", async () => {
        const priceaddr = await DSCEngine.getPriceFeedAddress(DSCEngine.getCollateralTokens(1));
        assert.equal(priceaddr.toString(), MockV3Aggregator2.address);
      })
    });

    describe("checks the account information", () => {
      it("gets the collateral value", async () => {
        const x = ethers.utils.parseEther("1");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateral(mockERC20.address, x);
        const z = await DSCEngine._getAccountCollateralValue(deployer);
        assert.equal(z, "2000000000000000000000");
      });
    });

    describe("DepositCollateral Funtion", () => {
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

    describe("MintDSC Funtion", () => {
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
          DSCEngine.mintDSC(ethers.utils.parseEther("1.6"))
        ).to.be.revertedWith("DSCEngine__BreaksHealthFactor");
      });
      it("will mint tokens only if the health factor is not broken", async () => {
        const y = ethers.utils.parseEther("0.000000001");
        await DSCEngine.mintDSC(y);
      });
    });

    describe('DepositAndMintDSC function', () => {
      beforeEach(async () => {
        const x = ethers.utils.parseEther("10")
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateral(mockERC20.address, x);
      })
      it('fails if the amounts are 0', async () => {
        await expect(
          DSCEngine.depositCollateralAndMintDSC(
            mockERC20.address,
            0,
            ethers.utils.parseEther("1")
          )
        ).to.be.revertedWith("DSCEngine__NeedsMoreThanZero");
        await expect(
          DSCEngine.depositCollateralAndMintDSC(
            mockERC20.address,
            ethers.utils.parseEther("1"),
            0
          )
        ).to.be.revertedWith("DSCEngine__NeedsMoreThanZero");
      });
      it("Reverts if the wrong address is entered", async () => {
        // Here we get morethanZero error first bcoz morethanzero modifier is checked before the address chcek
        await expect(
          DSCEngine.depositCollateralAndMintDSC(
            "0x0000000000000000000000000000000000000000",
            0,
            ethers.utils.parseEther("1")
          )
        ).to.be.revertedWith("DSCEngine__NeedsMoreThanZero");
        await expect(
          DSCEngine.depositCollateralAndMintDSC(
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("1"),
            ethers.utils.parseEther("1")
          )
        ).to.be.revertedWith("DSCEngine__TokenAddressZero");
      });
      it("deposits and mints DSC", async () => {
        const y = await DSCEngine.getUSDValue(
          mockERC20.address,
          ethers.utils.parseEther("0.00000001")
        );
        const z = await DSCEngine._getAccountCollateralValue(deployer);
        console.log(z.toString());
        console.log(y.toString());
        await DSCEngine.depositCollateralAndMintDSC(
          mockERC20.address,
          ethers.utils.parseEther("10"),
          ethers.utils.parseEther("0.00000001")
        );
        const x = await DSC.totalSupply();
        console.log(x.toString())
      })
    })
    
    describe("checks the deposit in usd", () => {
      it("The value in USD ", async () => {
        const x = ethers.utils.parseEther("1");
        const y = await DSCEngine.getUSDValue(mockERC20BTC.address, x);
        assert.equal(y.toString(), "30000000000000000000000");
        const z = await DSCEngine.getUSDValue(mockERC20.address, x);
        assert.equal(z.toString(), "2000000000000000000000");
      });
      it("checks the total deposited value in usd", async () => {
        const x = ethers.utils.parseEther("1");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateral(mockERC20.address, x);
        const y = await DSCEngine._getAccountCollateralValue(deployer);
        assert.equal(y, "2000000000000000000000");
      })
    });

  });