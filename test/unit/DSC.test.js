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
    let User;
    let accounts;
    beforeEach(async () => {
      deployer = (await getNamedAccounts()).deployer;

      await deployments.fixture(["all"]);

      MockV3Aggregator = await ethers.getContract(
        "MockV3Aggregator1",
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

      accounts = await ethers.getSigners();
      User = accounts[1];
      
      mockERC20.transfer(User.address, ethers.utils.parseEther("1000"));
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
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateral(mockERC20.address, x);
        const z = await DSCEngine._getAccountCollateralValue(deployer);
        assert.equal(z.toString(), "20000000000000000000000");
      });
    });

    describe("Deposit Collateral Funtion", () => {
      it("Fails to deposit when deposit amount is 0", async () => {
        const x = ethers.utils.parseEther("10");
        await expect(
          DSCEngine.depositCollateral(mockERC20.address, 0)
        ).to.be.revertedWith("DSCEngine__NeedsMoreThanZero");
      });
      it("Fails when the collateral token is not in allowed list", async () => {
        const x = ethers.utils.parseEther("10");
        await expect(
          DSCEngine.depositCollateral(DSC.address, x)
        ).to.be.revertedWith("DSCEngine__TokenNotAllowed");
      });
      it("Deposits the collaterral", async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await expect(
          await DSCEngine.depositCollateral(mockERC20.address, x)
        );
      });
      
      it("Emits an event", async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await expect(
          await DSCEngine.depositCollateral(mockERC20.address, x)
        ).to.emit(DSCEngine, "CollateralDeposited");
      });
      
      it("updates the balance of the DSCEngine contract in ERC20 token balance", async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateral(mockERC20.address, x);
        const y = await mockERC20.balanceOf(DSCEngine.address);
        assert.equal(y.toString(), x.toString());
      });
    });

    describe("MintDSC Funtion", () => {
      beforeEach(async () => {
        const x = ethers.utils.parseEther("10");
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
      it('fails if the amounts are 0', async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await expect(
          DSCEngine.depositCollateralAndMintDSC(
            mockERC20.address,
            0,
            ethers.utils.parseEther("10")
          )
        ).to.be.revertedWith("DSCEngine__NeedsMoreThanZero");
        await expect(
          DSCEngine.depositCollateralAndMintDSC(
            mockERC20.address,
            ethers.utils.parseEther("10"),
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
            ethers.utils.parseEther("10")
          )
        ).to.be.revertedWith("DSCEngine__NeedsMoreThanZero");
        await expect(
          DSCEngine.depositCollateralAndMintDSC(
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("10"),
            ethers.utils.parseEther("10")
          )
        ).to.be.revertedWith("DSCEngine__TokenNotAllowed");
      });
      
      it("deposits and mints DSC", async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateralAndMintDSC(
          mockERC20.address,
          ethers.utils.parseEther("10"),
          ethers.utils.parseEther("0.00000001")
        );
      });

      it("Emits an Event", async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await expect(
          DSCEngine.depositCollateralAndMintDSC(
            mockERC20.address,
            ethers.utils.parseEther("10"),
            ethers.utils.parseEther("0.00000001")
          )
        ).to.emit(DSCEngine, "CollateralDeposited");
      });

      it("checks  the updated deposited collateral and minted dsc token balance", async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateralAndMintDSC(
          mockERC20.address,
          ethers.utils.parseEther("10"),
          ethers.utils.parseEther("0.00000001")
        );
        const collateral = await DSCEngine.getCollateralDepositedAmount(deployer, mockERC20.address);
        const DScMinted = await DSCEngine.getDSCMint(deployer);
        const DSCTokens = await DSC.balanceOf(deployer);
        assert.equal(collateral.toString(), ethers.utils.parseEther("10"));
        assert.equal(
          DScMinted.toString(),
          ethers.utils.parseEther("0.00000001")
        );
        assert.equal(
          DSCTokens.toString(),
          ethers.utils.parseEther("0.00000001")
        );
      });
    });

    describe('Burn function', () => {
      beforeEach(async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateralAndMintDSC(
          mockERC20.address,
          ethers.utils.parseEther("10"),
          ethers.utils.parseEther("0.00000001")
        );
        await DSC.approve(
          DSCEngine.address,
          ethers.utils.parseEther("0.00000001")
        );
      });
      
      it("It fails if the amount to burn isnt greater than 0", async () => {
        await expect(
          DSCEngine.burnDSC(0)
        ).to.be.revertedWith("DSCEngine__NeedsMoreThanZero");
      });
      
      it("Fails if the DSC Burn amount is greater than the minted DSC", async () => {
        // Since it has built in underflow protection it is fine 
        await expect(
          DSCEngine.burnDSC(ethers.utils.parseEther("0.0000001"))
        ).to.be.revertedWith("panic code 0x11");
      });
      
      it("burns the DSC token fully or either partially", async () => {
        const x = await DSC.balanceOf(deployer);
        assert(await
          DSCEngine.burnDSC(ethers.utils.parseEther("0.000000001"))
        );
        const y = await DSC.balanceOf(deployer);
        assert(x.toString() != y.toString());
      });

      it("updates the global variable", async () => {
        const x = await DSCEngine.getDSCMint(deployer);
        await DSCEngine.burnDSC(ethers.utils.parseEther("0.000000008"));
        const y = await DSCEngine.getDSCMint(deployer);
        assert(x.toString != y.toString());
      });
    });

    describe('Redeem Function', () => {
      beforeEach(async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateralAndMintDSC(
          mockERC20.address,
          ethers.utils.parseEther("10"),
          ethers.utils.parseEther("0.00000001")
        );
        await DSC.approve(
          DSCEngine.address,
          ethers.utils.parseEther("0.00000001")
        );
      });

      it("Redeem function fails if the token contract address isn't correct", async () => {
        await expect(
          DSCEngine.redeemCollateral(
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("1")
          )
        ).to.be.revertedWith("DSCEngine__TokenNotAllowed");
      });

      it("Redeem function fails if the Redeeming amount is 0", async () => {
        await expect(
          DSCEngine.redeemCollateral(
            "0x0000000000000000000000000000000000000000",
            0
          )
        ).to.be.revertedWith("DSCEngine__NeedsMoreThanZero");
      });

      it("fails if the Redeeming amount is effecting the user Health factor to reach 1", async () => {
        // since the amount borrowed is w.r.t to deposited 10 ether and since the whole amount
        // was given we cant withdraw more than 50% of the deposit
        await expect(
          DSCEngine.redeemCollateral(
            mockERC20.address,
            ethers.utils.parseEther("6")
          )
        ).to.be.revertedWith("DSCEngine__BreaksHealthFactor");
      });

      it("Redeem possible only if the health factor is not Compromised", async () => {
        const x = await DSCEngine.getHealthFactor(deployer);
        await expect(
          DSCEngine.redeemCollateral(
            mockERC20.address,
            ethers.utils.parseEther("3")
          ));
        const y = await DSCEngine.getHealthFactor(deployer);
        assert(x.toString() != y.toString());
      });

      it("Updates the State variable", async () => {
        const x = await DSCEngine.getCollateralDepositedAmount(deployer, mockERC20.address);
        await expect(
          DSCEngine.redeemCollateral(
            mockERC20.address,
            ethers.utils.parseEther("3")
          )
        );
        const y = await DSCEngine.getCollateralDepositedAmount(
          deployer,
          mockERC20.address
        );
        assert(x.toString() != y.toString());
      });

      it("Repays the entire collateral and reddeems the entire amount", async () => {
        const x = await DSC.balanceOf(deployer);
        assert(await DSCEngine.burnDSC(ethers.utils.parseEther("0.00000001")));
        const y = await DSC.balanceOf(deployer);
        assert(x.toString() != y.toString());
        await expect(
          DSCEngine.redeemCollateral(
            mockERC20.address,
            ethers.utils.parseEther("10")
          )
        );
      });
    
      it("Emits an Event", async () => {
        await expect(
          DSCEngine.redeemCollateral(
            mockERC20.address,
            ethers.utils.parseEther("3")
          )
        ).to.emit(DSCEngine, "CollateralRedeemed");
      });

      it("checks if the token tranfer is successful", async () => {
        const x = await mockERC20.balanceOf(DSCEngine.address);
        await DSCEngine.redeemCollateral(
          mockERC20.address,
          ethers.utils.parseEther("3")
        );
        const y = await mockERC20.balanceOf(DSCEngine.address);
        assert(x.toString() != y.toString());
      })

    });


    describe('RedeemAndBurnCollateralForDSC Function', () => {
      beforeEach(async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateralAndMintDSC(
          mockERC20.address,
          ethers.utils.parseEther("10"),
          ethers.utils.parseEther("0.00000001")
        );
        await DSC.approve(
          DSCEngine.address,
          ethers.utils.parseEther("0.00000001")
        );
      });

      it("reverts when the zero amount is entered", async () => {
        await expect(
          DSCEngine.redeemCollateralForDSC(
            mockERC20.address,
            ethers.utils.parseEther("10"),
            0
          )
        ).to.be.revertedWith("DSCEngine__NeedsMoreThanZero");
        await expect(
          DSCEngine.redeemCollateralForDSC(
            mockERC20.address, 0,
            ethers.utils.parseEther("0")
          )
        ).to.be.revertedWith("DSCEngine__NeedsMoreThanZero");
      });

      it("reverts when address is a null address", async () => {
        await expect(
          DSCEngine.redeemCollateralForDSC(
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("10"),
            ethers.utils.parseEther("0.00000001")
          )
        ).to.be.revertedWith("DSCEngine__TokenNotAllowed");
      });

      it("Redeems the collateral and burns the DSC", async () => {
        const collateral = await mockERC20.balanceOf(DSCEngine.address);
        assert.equal(collateral.toString(), ethers.utils.parseEther("10"));
        const DSCBal = await DSC.totalSupply();
        assert.equal(DSCBal.toString(), ethers.utils.parseEther("0.00000001"));
        await DSCEngine.redeemCollateralForDSC(
          mockERC20.address,
          ethers.utils.parseEther("10"),
          ethers.utils.parseEther("0.00000001")
        );
        const DSCBalance = await DSC.totalSupply();
        const collateral2 = await mockERC20.balanceOf(DSCEngine.address);
        assert(DSCBal.toString() > DSCBalance.toString());
        assert.equal(collateral2.toString(), 0);
      });

      it("If more tokens being burned is more than the minted results in underflow error", async () => {
        await expect(
          DSCEngine.redeemCollateralForDSC(
            mockERC20.address,
            ethers.utils.parseEther("10"),
            ethers.utils.parseEther("0.0000001")
          )
        ).to.be.revertedWith("panic code 0x11");
      });

      it("If more tokens being redeemed than deposited results in underflow error", async () => {
        await expect(
          DSCEngine.redeemCollateralForDSC(
            mockERC20.address,
            ethers.utils.parseEther("11"),
            ethers.utils.parseEther("0.0000001")
          )
        ).to.be.revertedWith("panic code 0x11");
      });

      it("When partially burning tokens for full withdrawal of colateral should throw error", async () => {
        await expect(
          DSCEngine.redeemCollateralForDSC(
            mockERC20.address,
            ethers.utils.parseEther("10"),
            ethers.utils.parseEther("0.000000001")
          )
        ).to.be.revertedWith("DSCEngine__BreaksHealthFactor");
      });

      it("When partially burning tokens for partial withdrawal of should pass untill it breaks health factor", async () => {
        await expect(
          DSCEngine.redeemCollateralForDSC(
            mockERC20.address,
            ethers.utils.parseEther("5"),
            ethers.utils.parseEther("0.000000001")
          )
        );
      });
    });

    describe('Liquidate Function', () => {
      beforeEach(async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateralAndMintDSC(
          mockERC20.address,
          ethers.utils.parseEther("10"),
          ethers.utils.parseEther("0.00000001")
        );
        await mockERC20.connect(User).approve(DSCEngine.address, ethers.utils.parseEther("100"));
        await DSCEngine.connect(User).depositCollateralAndMintDSC(
          mockERC20.address,
          ethers.utils.parseEther("100"),
          ethers.utils.parseEther("0.000000001")
        );
        await DSC.approve(
          DSCEngine.address,
          ethers.utils.parseEther("0.000000001")
        );
        await DSC.connect(User).approve(
          DSCEngine.address,
          ethers.utils.parseEther("0.000000001")
        );
      });

      it("Should fail if the user address to liquidate is nulladdress", async () => {
        await expect(
          DSCEngine.liquidate(
            mockERC20.address,
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("0.00000001")
          )
        ).to.be.revertedWith("DSCEngine__TokenAddressZero");
      });

      it("should fail if the token address is not correct", async () => {
        await expect(
          DSCEngine.liquidate(
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("0.00000001")
          )
        ).to.be.revertedWith("DSCEngine__TokenNotAllowed");
      });

      it("fails if the maount is 0", async () => {
        await expect(
          DSCEngine.liquidate(
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            0
          )
        ).to.be.revertedWith("DSCEngine__NeedsMoreThanZero");
      });

      it("fails if the user health factor is ok", async () => {
        await expect(
          DSCEngine.connect(User).liquidate(
            mockERC20.address,
            deployer,
            ethers.utils.parseEther("0.00000001")
          )
        ).to.be.revertedWith("DSCEngine__HealthFactorOk");
      });

      it("Should fail if the health factor didnt improve of the user that is being liquidated", async () => {
        console.log(User);
        console.log(deployer);
        await MockV3Aggregator.updateAnswer(1000_00000000);
        await expect(
          DSCEngine.connect(User).liquidate(
            mockERC20.address,
            deployer,
            ethers.utils.parseEther("0.0000000001")
          )
        ).to.be.revertedWith("DSCEngine__HealthFactorNotImproved");
      })
    })
    
  
    describe("checks the other function", () => {
      it("The value in USD ", async () => {
        const x = ethers.utils.parseEther("10");
        const y = await DSCEngine.getUSDValue(mockERC20BTC.address, x);
        assert.equal(y.toString(), "300000000000000000000000");
        const z = await DSCEngine.getUSDValue(mockERC20.address, x);
        assert.equal(z.toString(), "20000000000000000000000");
      });
      
      it("checks the total deposited value in USD", async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await mockERC20.connect(User).approve(DSCEngine.address, ethers.utils.parseEther("100"));
        await DSCEngine.depositCollateral(mockERC20.address, x);
        await DSCEngine.connect(User).depositCollateral(
          mockERC20.address,
          ethers.utils.parseEther("100"),
        );
        const y = await DSCEngine._getAccountCollateralValue(deployer);
        assert.equal(y.toString(), "20000000000000000000000");
      });

      it("checks the deposited value if the price form the oracle changes", async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await mockERC20
          .connect(User)
          .approve(DSCEngine.address, ethers.utils.parseEther("100"));
        await DSCEngine.depositCollateral(mockERC20.address, x);
        await DSCEngine.connect(User).depositCollateral(
          mockERC20.address,
          ethers.utils.parseEther("100")
        );
        const y = await DSCEngine._getAccountCollateralValue(deployer);
        const z = await DSCEngine._getAccountCollateralValue(User.address);
        await MockV3Aggregator.updateAnswer(1520_00000000);
        const a = await DSCEngine._getAccountCollateralValue(deployer);
        const b = await DSCEngine._getAccountCollateralValue(User.address);
        assert(y.toString() > a.toString());
        assert(z.toString() > b.toString());
      })

      it("checks The collateral value in USD and the minted DSc value in DSC", async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateral(mockERC20.address, x);
        const y = await DSCEngine._getAccountCollateralValue(deployer);
        console.log(y.toString());
        await DSCEngine.mintDSC(ethers.utils.parseEther("0.000000011"))
        const z = await DSCEngine.getDSCMint(deployer);
        console.log(z.toString());
      });

      it("checks the health factor", async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateral(mockERC20.address, x);
        const y = await DSCEngine.getHealthFactor(deployer);
        console.log(y.toString());
      });

      it("checks the health factor after the price difference", async () => {
        const x = ethers.utils.parseEther("10");
        await mockERC20.approve(DSCEngine.address, x);
        await DSCEngine.depositCollateral(mockERC20.address, x);
        await MockV3Aggregator.updateAnswer(100_00000000);
        const y = await DSCEngine.getHealthFactor(deployer);
        console.log(y.toString());
      })
    });

  });