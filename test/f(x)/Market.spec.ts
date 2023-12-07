/* eslint-disable node/no-missing-import */
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { LeveragedToken, FractionalToken, Treasury, WETH9, MockFxPriceOracle, Market } from "@types";
import { ZeroAddress, MaxUint256 } from "ethers";

// TODO: check the -1 for baseIn values below
// TODO: test liquidate

const PRECISION = 10n ** 18n;

describe("Market.spec", async () => {
  let deployer: SignerWithAddress;
  let signer: SignerWithAddress;
  let platform: SignerWithAddress;

  let weth: WETH9;
  let wethAddress: string;
  let oracle: MockFxPriceOracle;
  let oracleAddress: string;
  let fToken: FractionalToken;
  let fTokenAddress: string;
  let xToken: LeveragedToken;
  let xTokenAddress: string;
  let treasury: Treasury;
  let treasuryAddress: string;
  let market: Market;
  let marketAddress: string;

  beforeEach(async () => {
    [deployer, signer, platform] = await ethers.getSigners();

    const WETH9 = await ethers.getContractFactory("WETH9", deployer);
    weth = await WETH9.deploy();
    await weth.waitForDeployment();
    wethAddress = await weth.getAddress();

    const MockFxPriceOracle = await ethers.getContractFactory("MockFxPriceOracle", deployer);
    oracle = await MockFxPriceOracle.deploy();
    await oracle.waitForDeployment();
    oracleAddress = await oracle.getAddress();

    const FractionalToken = await ethers.getContractFactory("FractionalToken", deployer);
    fToken = await FractionalToken.deploy();
    await fToken.waitForDeployment();
    fTokenAddress = await fToken.getAddress();

    const LeveragedToken = await ethers.getContractFactory("LeveragedToken", deployer);
    xToken = await LeveragedToken.deploy();
    await xToken.waitForDeployment();
    xTokenAddress = await xToken.getAddress();

    const Treasury = await ethers.getContractFactory("Treasury", deployer);
    treasury = await Treasury.deploy(ethers.parseEther("0.5"));
    await treasury.waitForDeployment();
    treasuryAddress = await treasury.getAddress();

    const Market = await ethers.getContractFactory("Market", deployer);
    market = await Market.deploy();
    await market.waitForDeployment();
    marketAddress = await market.getAddress();

    await fToken.initialize(treasuryAddress, "Fractional ETH", "fETH");
    await xToken.initialize(treasuryAddress, fTokenAddress, "Leveraged ETH", "xETH");

    await treasury.initialize(
      marketAddress,
      wethAddress,
      fTokenAddress,
      xTokenAddress,
      oracleAddress,
      ethers.parseEther("0.1"),
      ethers.parseEther("1000"),
      ZeroAddress,
    );

    await market.initialize(treasuryAddress, platform.address);
    await market.updateMarketConfig(
      ethers.parseEther("1.3"),
      ethers.parseEther("1.2"),
      ethers.parseEther("1.14"),
      ethers.parseEther("1"),
    );
  });

  context("auth", async () => {
    it("should revert, when intialize again", async () => {
      await expect(market.initialize(treasuryAddress, platform.address)).to.revertedWith(
        "Initializable: contract is already initialized",
      );
    });

    it("should initialize correctly", async () => {
      expect(await market.treasury()).to.eq(treasuryAddress);
      expect(await market.platform()).to.eq(platform.address);
      expect(await market.fToken()).to.eq(fTokenAddress);
      expect(await market.xToken()).to.eq(xTokenAddress);
      expect(await market.baseToken()).to.eq(wethAddress);
    });

    context("#updateRedeemFeeRatio", async () => {
      it("should revert, when non-owner call", async () => {
        await expect(market.connect(signer).updateRedeemFeeRatio(0, 0, false)).to.revertedWith("only Admin");
        await expect(market.connect(signer).updateRedeemFeeRatio(0, 0, true)).to.revertedWith("only Admin");
      });

      it("should revert, when default fee too large", async () => {
        await expect(market.updateRedeemFeeRatio(PRECISION + BigInt(1), 0, false)).to.revertedWith(
          "default fee ratio too large",
        );
        await expect(market.updateRedeemFeeRatio(PRECISION + BigInt(1), 0, true)).to.revertedWith(
          "default fee ratio too large",
        );
      });

      it("should revert, when delta fee too small", async () => {
        await expect(market.updateRedeemFeeRatio(2, -3, false)).to.revertedWith("delta fee too small");
        await expect(market.updateRedeemFeeRatio(2, -3, true)).to.revertedWith("delta fee too small");
      });

      it("should revert, when total fee too large", async () => {
        await expect(market.updateRedeemFeeRatio(PRECISION, 1, false)).to.revertedWith("total fee too large");
        await expect(market.updateRedeemFeeRatio(PRECISION, 1, true)).to.revertedWith("total fee too large");
      });

      it("should succeed when update for fToken", async () => {
        await expect(market.updateRedeemFeeRatio(1, 2, true))
          .to.emit(market, "UpdateRedeemFeeRatioFToken")
          .withArgs(1, 2);

        expect((await market.fTokenRedeemFeeRatio()).defaultFeeRatio).to.eq(1);
        expect((await market.fTokenRedeemFeeRatio()).extraFeeRatio).to.eq(2);
        expect((await market.xTokenRedeemFeeRatio()).defaultFeeRatio).to.eq(0);
        expect((await market.xTokenRedeemFeeRatio()).extraFeeRatio).to.eq(0);
      });

      it("should succeed when update for xToken", async () => {
        await expect(market.updateRedeemFeeRatio(1, 2, false))
          .to.emit(market, "UpdateRedeemFeeRatioXToken")
          .withArgs(1, 2);

        expect((await market.fTokenRedeemFeeRatio()).defaultFeeRatio).to.eq(0);
        expect((await market.fTokenRedeemFeeRatio()).extraFeeRatio).to.eq(0);
        expect((await market.xTokenRedeemFeeRatio()).defaultFeeRatio).to.eq(1);
        expect((await market.xTokenRedeemFeeRatio()).extraFeeRatio).to.eq(2);
      });
    });

    context("#updateMintFeeRatio", async () => {
      it("should revert, when non-owner call", async () => {
        await expect(market.connect(signer).updateMintFeeRatio(0, 0, false)).to.revertedWith("only Admin");
        await expect(market.connect(signer).updateMintFeeRatio(0, 0, true)).to.revertedWith("only Admin");
      });

      it("should revert, when default fee too large", async () => {
        await expect(market.updateMintFeeRatio(PRECISION + BigInt(1), 0, false)).to.revertedWith(
          "default fee ratio too large",
        );
        await expect(market.updateMintFeeRatio(PRECISION + BigInt(1), 0, true)).to.revertedWith(
          "default fee ratio too large",
        );
      });

      it("should revert, when delta fee too small", async () => {
        await expect(market.updateMintFeeRatio(2, -3, false)).to.revertedWith("delta fee too small");
        await expect(market.updateMintFeeRatio(2, -3, true)).to.revertedWith("delta fee too small");
      });

      it("should revert, when total fee too large", async () => {
        await expect(market.updateMintFeeRatio(PRECISION, 1, false)).to.revertedWith("total fee too large");
        await expect(market.updateMintFeeRatio(PRECISION, 1, true)).to.revertedWith("total fee too large");
      });

      it("should succeed when update for fToken", async () => {
        await expect(market.updateMintFeeRatio(1, 2, true)).to.emit(market, "UpdateMintFeeRatioFToken").withArgs(1, 2);

        expect((await market.fTokenMintFeeRatio()).defaultFeeRatio).to.eq(1);
        expect((await market.fTokenMintFeeRatio()).extraFeeRatio).to.eq(2);
        expect((await market.xTokenMintFeeRatio()).defaultFeeRatio).to.eq(0);
        expect((await market.xTokenMintFeeRatio()).extraFeeRatio).to.eq(0);
      });

      it("should succeed when update for xToken", async () => {
        await expect(market.updateMintFeeRatio(1, 2, false)).to.emit(market, "UpdateMintFeeRatioXToken").withArgs(1, 2);

        expect((await market.fTokenMintFeeRatio()).defaultFeeRatio).to.eq(0);
        expect((await market.fTokenMintFeeRatio()).extraFeeRatio).to.eq(0);
        expect((await market.xTokenMintFeeRatio()).defaultFeeRatio).to.eq(1);
        expect((await market.xTokenMintFeeRatio()).extraFeeRatio).to.eq(2);
      });
    });

    context("#updateMarketConfig", async () => {
      it("should revert, when non-owner call", async () => {
        await expect(market.connect(signer).updateMarketConfig(1, 2, 3, 4)).to.revertedWith("only Admin");
      });

      it("should revert, when invalid param", async () => {
        await expect(market.updateMarketConfig(1, 2, 3, 4)).to.revertedWith("invalid market config");
        await expect(market.updateMarketConfig(1000, 2, 3, 4)).to.revertedWith("invalid market config");
        await expect(market.updateMarketConfig(9000, 8000, 3, 4)).to.revertedWith("invalid market config");
        await expect(market.updateMarketConfig(9000, 8000, 7000, 4)).to.revertedWith("invalid market config");
        await expect(market.updateMarketConfig(9000, 8000, 7000, 6000)).to.revertedWith("invalid market config");
      });

      it("should succeed", async () => {
        expect((await market.marketConfig()).stabilityRatio).to.eq(ethers.parseEther("1.3"));
        expect((await market.marketConfig()).liquidationRatio).to.eq(ethers.parseEther("1.2"));
        expect((await market.marketConfig()).selfLiquidationRatio).to.eq(ethers.parseEther("1.14"));
        expect((await market.marketConfig()).recapRatio).to.eq(ethers.parseEther("1"));
        await expect(
          market.updateMarketConfig(
            ethers.parseEther("1.5"),
            ethers.parseEther("1.4"),
            ethers.parseEther("1.3"),
            ethers.parseEther("1.2"),
          ),
        )
          .to.emit(market, "UpdateMarketConfig")
          .withArgs(
            ethers.parseEther("1.5"),
            ethers.parseEther("1.4"),
            ethers.parseEther("1.3"),
            ethers.parseEther("1.2"),
          );
        expect((await market.marketConfig()).stabilityRatio).to.eq(ethers.parseEther("1.5"));
        expect((await market.marketConfig()).liquidationRatio).to.eq(ethers.parseEther("1.4"));
        expect((await market.marketConfig()).selfLiquidationRatio).to.eq(ethers.parseEther("1.3"));
        expect((await market.marketConfig()).recapRatio).to.eq(ethers.parseEther("1.2"));
      });
    });

    context("#updateIncentiveConfig", async () => {
      it("should revert, when non-owner call", async () => {
        await expect(market.connect(signer).updateIncentiveConfig(1, 2, 3)).to.revertedWith("only Admin");
      });

      it("should revert, when incentive too small", async () => {
        await expect(market.updateIncentiveConfig(0, 1, 2)).to.revertedWith("incentive too small");
        await expect(market.updateIncentiveConfig(1, 1, 0)).to.revertedWith("incentive too small");
      });

      it("should revert, when invalid incentive config", async () => {
        await expect(market.updateIncentiveConfig(1000, 2, 3)).to.revertedWith("invalid incentive config");
      });

      it("should succeed", async () => {
        expect((await market.incentiveConfig()).stabilityIncentiveRatio).to.eq(0);
        expect((await market.incentiveConfig()).liquidationIncentiveRatio).to.eq(0);
        expect((await market.incentiveConfig()).selfLiquidationIncentiveRatio).to.eq(0);
        await expect(
          market.updateIncentiveConfig(ethers.parseEther("0.3"), ethers.parseEther("0.2"), ethers.parseEther("0.1")),
        )
          .to.emit(market, "UpdateIncentiveConfig")
          .withArgs(ethers.parseEther("0.3"), ethers.parseEther("0.2"), ethers.parseEther("0.1"));
        expect((await market.incentiveConfig()).stabilityIncentiveRatio).to.eq(ethers.parseEther("0.3"));
        expect((await market.incentiveConfig()).liquidationIncentiveRatio).to.eq(ethers.parseEther("0.2"));
        expect((await market.incentiveConfig()).selfLiquidationIncentiveRatio).to.eq(ethers.parseEther("0.1"));
      });
    });

    context("#updatePlatform", async () => {
      it("should revert, when non-owner call", async () => {
        await expect(market.connect(signer).updatePlatform(ZeroAddress)).to.revertedWith("only Admin");
      });

      it("should succeed", async () => {
        expect(await market.platform()).to.eq(platform.address);
        await expect(market.updatePlatform(deployer.address))
          .to.emit(market, "UpdatePlatform")
          .withArgs(deployer.address);
        expect(await market.platform()).to.eq(deployer.address);
      });
    });

    context("#updateLiquidationWhitelist", async () => {
      it("should revert, when non-owner call", async () => {
        await expect(market.connect(signer).updateLiquidationWhitelist(ZeroAddress, false)).to.revertedWith(
          "only Admin",
        );
      });

      it("should succeed", async () => {
        expect(await market.liquidationWhitelist(deployer.address)).to.eq(false);
        await expect(market.updateLiquidationWhitelist(deployer.address, true))
          .to.emit(market, "UpdateLiquidationWhitelist")
          .withArgs(deployer.address, true);
        expect(await market.liquidationWhitelist(deployer.address)).to.eq(true);
        await expect(market.updateLiquidationWhitelist(deployer.address, false))
          .to.emit(market, "UpdateLiquidationWhitelist")
          .withArgs(deployer.address, false);
        expect(await market.liquidationWhitelist(deployer.address)).to.eq(false);
      });
    });

    context("#pauseMint", async () => {
      it("should revert, when non-owner call", async () => {
        await expect(market.connect(signer).pauseMint(false)).to.revertedWith("only Emergency DAO");
        await expect(market.connect(signer).pauseMint(true)).to.revertedWith("only Emergency DAO");
      });

      it("should succeed", async () => {
        await market.grantRole(await market.EMERGENCY_DAO_ROLE(), deployer.address);

        expect(await market.mintPaused()).to.eq(false);
        await expect(market.pauseMint(true)).to.emit(market, "PauseMint").withArgs(true);
        expect(await market.mintPaused()).to.eq(true);
        await expect(market.pauseMint(false)).to.emit(market, "PauseMint").withArgs(false);
        expect(await market.mintPaused()).to.eq(false);
      });
    });

    context("#pauseRedeem", async () => {
      it("should revert, when non-owner call", async () => {
        await expect(market.connect(signer).pauseRedeem(false)).to.revertedWith("only Emergency DAO");
        await expect(market.connect(signer).pauseRedeem(true)).to.revertedWith("only Emergency DAO");
      });

      it("should succeed", async () => {
        await market.grantRole(await market.EMERGENCY_DAO_ROLE(), deployer.address);

        expect(await market.redeemPaused()).to.eq(false);
        await expect(market.pauseRedeem(true)).to.emit(market, "PauseRedeem").withArgs(true);
        expect(await market.redeemPaused()).to.eq(true);
        await expect(market.pauseRedeem(false)).to.emit(market, "PauseRedeem").withArgs(false);
        expect(await market.redeemPaused()).to.eq(false);
      });
    });

    context("#pauseFTokenMintInSystemStabilityMode", async () => {
      it("should revert, when non-owner call", async () => {
        await expect(market.connect(signer).pauseFTokenMintInSystemStabilityMode(false)).to.revertedWith(
          "only Emergency DAO",
        );
        await expect(market.connect(signer).pauseFTokenMintInSystemStabilityMode(true)).to.revertedWith(
          "only Emergency DAO",
        );
      });

      it("should succeed", async () => {
        await market.grantRole(await market.EMERGENCY_DAO_ROLE(), deployer.address);

        expect(await market.fTokenMintInSystemStabilityModePaused()).to.eq(false);
        await expect(market.pauseFTokenMintInSystemStabilityMode(true))
          .to.emit(market, "PauseFTokenMintInSystemStabilityMode")
          .withArgs(true);
        expect(await market.fTokenMintInSystemStabilityModePaused()).to.eq(true);
        await expect(market.pauseFTokenMintInSystemStabilityMode(false))
          .to.emit(market, "PauseFTokenMintInSystemStabilityMode")
          .withArgs(false);
        expect(await market.fTokenMintInSystemStabilityModePaused()).to.eq(false);
      });
    });

    context("#pauseXTokenRedeemInSystemStabilityMode", async () => {
      it("should revert, when non-owner call", async () => {
        await expect(market.connect(signer).pauseXTokenRedeemInSystemStabilityMode(false)).to.revertedWith(
          "only Emergency DAO",
        );
        await expect(market.connect(signer).pauseXTokenRedeemInSystemStabilityMode(true)).to.revertedWith(
          "only Emergency DAO",
        );
      });

      it("should succeed", async () => {
        await market.grantRole(await market.EMERGENCY_DAO_ROLE(), deployer.address);

        expect(await market.xTokenRedeemInSystemStabilityModePaused()).to.eq(false);
        await expect(market.pauseXTokenRedeemInSystemStabilityMode(true))
          .to.emit(market, "PauseXTokenRedeemInSystemStabilityMode")
          .withArgs(true);
        expect(await market.xTokenRedeemInSystemStabilityModePaused()).to.eq(true);
        await expect(market.pauseXTokenRedeemInSystemStabilityMode(false))
          .to.emit(market, "PauseXTokenRedeemInSystemStabilityMode")
          .withArgs(false);
        expect(await market.xTokenRedeemInSystemStabilityModePaused()).to.eq(false);
      });
    });
  });

  context("mint both", async () => {
    beforeEach(async () => {
      await oracle.setPrice(ethers.parseEther("1000"));
      await treasury.initializePrice();
      await weth.deposit({ value: ethers.parseEther("10") });

      await weth.approve(marketAddress, MaxUint256);
    });

    it("should revert, when mint zero amount", async () => {
      await expect(market.mint(ethers.parseEther("0"), signer.address, 0, 0)).to.revertedWith("mint zero amount");
    });

    it("should revert, when initialize multiple times", async () => {
      await market.mint(ethers.parseEther("1"), signer.address, 0, 0);

      await expect(market.mint(ethers.parseEther("1"), signer.address, 0, 0)).to.revertedWith("only initialize once");
    });

    it("should succeed", async () => {
      await expect(market.mint(ethers.parseEther("1"), signer.address, 0, 0))
        .to.emit(market, "Mint")
        .withArgs(
          deployer.address,
          signer.address,
          ethers.parseEther("1"),
          ethers.parseEther("500"),
          ethers.parseEther("500"),
          0n,
        );
      expect(await treasury.totalBaseToken()).to.eq(ethers.parseEther("1"));
      expect(await weth.balanceOf(treasuryAddress)).to.eq(ethers.parseEther("1"));
      expect(await xToken.balanceOf(signer.address)).to.eq(ethers.parseEther("500"));
      expect(await fToken.balanceOf(signer.address)).to.eq(ethers.parseEther("500"));
      expect(await weth.balanceOf(platform.address)).to.eq(0n, "erc20 platform now has some fees");
    });
  });

  context("mint fToken", async () => {
    beforeEach(async () => {
      await oracle.setPrice(ethers.parseEther("1000"));
      await treasury.initializePrice();
      await weth.deposit({ value: ethers.parseEther("10") });

      await weth.approve(marketAddress, MaxUint256);
      // TODO: check that this mint is necessary
      // if it is, why is it, and if it isn't why not allow more than one mint() call  (see above tests)?
      // await market.mint(ethers.parseEther("1"), deployer.address, 0, 0);
    });

    it("should revert, when mint zero amount", async () => {
      await expect(market.mintFToken(ZeroAddress, signer.address, 0)).to.revertedWith("mint zero amount");
    });

    it("should revert, when mint paused", async () => {
      await market.grantRole(await market.EMERGENCY_DAO_ROLE(), deployer.address);
      await market.pauseMint(true);
      await expect(market.mintFToken(1, signer.address, 0)).to.revertedWith("mint is paused");
    });

    it("should succeed", async () => {
      await expect(market.mintFToken(ethers.parseEther("1"), signer.address, 0))
        .to.emit(market, "Mint")
        .withArgs(deployer.address, signer.address, ethers.parseEther("1"), ethers.parseEther("1000"), 0, 0);
      expect(await fToken.balanceOf(signer.address)).to.eq(ethers.parseEther("1000"));
      expect(await treasury.totalBaseToken()).to.eq(ethers.parseEther("1"), "treasure should have 1 eth");
      expect(await weth.balanceOf(treasuryAddress)).to.eq(ethers.parseEther("1"), "erc20 treasury now has 1 eth");
      expect(await xToken.balanceOf(signer.address)).to.eq(ethers.parseEther("0"));
      expect(await fToken.balanceOf(signer.address)).to.eq(ethers.parseEther("1000"));
      expect(await weth.balanceOf(platform.address)).to.eq(0n, "erc20 platform now has some fees");
    });
  });

  context("mint xToken", async () => {
    let ethusd = ethers.parseEther("1701");
    let initialCollateral = ethers.parseEther("1");
    beforeEach(async () => {
      await oracle.setPrice(ethusd);
      await treasury.initializePrice();
      await weth.deposit({ value: initialCollateral * 10n });

      await weth.approve(marketAddress, MaxUint256);
      await market.mint(initialCollateral, deployer.address, 0, 0); // get a /0 error if you leave this out
    });

    it("should revert, when mint zero amount", async () => {
      await expect(market.mintXToken(0, signer.address, 0)).to.revertedWith("mint zero amount");
    });

    it("should revert, when mint paused", async () => {
      await market.grantRole(await market.EMERGENCY_DAO_ROLE(), deployer.address);
      await market.pauseMint(true);
      await expect(market.mintXToken(1, signer.address, 0)).to.revertedWith("mint is paused");
    });

    it("should succeed", async () => {
      let additionalCollateral = ethers.parseEther("1.1");
      let expectedXCount = ethers.parseEther("1871.1"); // get a bit more
      await expect(market.mintXToken(additionalCollateral, signer.address, 0), "event emitted")
        .to.emit(market, "Mint")
        .withArgs(deployer.address, signer.address, additionalCollateral, 0, expectedXCount, 0);
      expect(await treasury.totalBaseToken()).to.eq(
        initialCollateral + additionalCollateral,
        "treasure should have added some eth",
      );
      expect(await weth.balanceOf(treasuryAddress)).to.eq(
        initialCollateral + additionalCollateral,
        "erc20 treasury now has more eth",
      );
      expect(await xToken.balanceOf(signer.address)).to.eq(expectedXCount, "signer got the collateral value of xToken");
      expect(await fToken.balanceOf(signer.address)).to.eq(0n, "signer got no fToken");
      expect(await weth.balanceOf(platform.address)).to.eq(0n, "erc20 platform now has some fees");
    });
  });

  context("add base token", async () => {
    let ethusd1 = ethers.parseEther("1702");
    let ethusd2 = ethers.parseEther("1001");
    let initialCollateral = ethers.parseEther("1");
    let cap = ethers.parseEther("0.059675324675324675"); // also includes fee

    beforeEach(async () => {
      await oracle.setPrice(ethusd1);
      await treasury.initializePrice();
      await weth.deposit({ value: ethers.parseEther("10") });

      await weth.approve(marketAddress, MaxUint256);
      await market.mint(initialCollateral, deployer.address, 0, 0);
    });

    it("should revert, when not in stability mode", async () => {
      await expect(market.addBaseToken(1, signer.address, 0)).to.revertedWith("Not system stability mode");
    });

    // TODO: make this pass
    // it("should revert, when mint zero amount", async () => {
    //  await oracle.setPrice(ethusd / 2n);
    //  await expect(market.addBaseToken(0, signer.address, 0)).to.revertedWith("mint zero amount");
    //});

    it("should revert, when mint paused", async () => {
      await market.grantRole(await market.EMERGENCY_DAO_ROLE(), deployer.address);
      await market.pauseMint(true);
      await expect(market.addBaseToken(1, signer.address, 0)).to.revertedWith("mint is paused");
    });

    it("should revert, when mint paused, even in stability mode", async () => {
      await oracle.setPrice(ethusd2);
      1;
      await market.grantRole(await market.EMERGENCY_DAO_ROLE(), deployer.address);
      await market.pauseMint(true);
      await expect(market.addBaseToken(1, signer.address, 0)).to.revertedWith("mint is paused");
    });

    it("should cap adding collateral", async () => {
      await oracle.setPrice(ethusd2);
      let attemptedCollateral = ethers.parseEther("1.5");
      await expect(market.addBaseToken(attemptedCollateral, signer.address, 0), "event emitted")
        .to.emit(market, "AddCollateral")
        .withArgs(deployer.address, signer.address, cap, 274706754931099701911n);
      expect(await treasury.totalBaseToken()).to.eq(initialCollateral + cap, "treasure should have added some eth");
      expect(await weth.balanceOf(treasuryAddress)).to.eq(initialCollateral + cap, "erc20 treasury now has more eth");
      expect(await xToken.balanceOf(signer.address)).to.eq(
        274706754931099701911n,
        "signer got the collateral value of xToken",
      );
      expect(await fToken.balanceOf(signer.address)).to.eq(0n, "signer got no fToken");

      // TODO: add bonus
      expect(await weth.balanceOf(platform.address)).to.eq(0n, "erc20 platform now has some fees");
    });

    it("should succeed", async () => {
      await oracle.setPrice(ethusd2);
      let attemptedCollateral = ethers.parseEther("0.05");
      await expect(market.addBaseToken(attemptedCollateral, signer.address, 0))
        .to.emit(market, "AddCollateral")
        .withArgs(deployer.address, signer.address, attemptedCollateral, 230167792488516617652n);
      expect(await treasury.totalBaseToken()).to.eq(
        initialCollateral + attemptedCollateral,
        "treasure should have added some eth",
      );
      expect(await weth.balanceOf(treasuryAddress)).to.eq(
        initialCollateral + attemptedCollateral,
        "erc20 treasury now has more eth",
      );
      expect(await xToken.balanceOf(signer.address)).to.eq(
        230167792488516617652n,
        "signer got the collateral value of xToken",
      );
      expect(await fToken.balanceOf(signer.address)).to.eq(0n, "signer got no fToken");

      // TODO: add bonus
      expect(await weth.balanceOf(platform.address)).to.eq(0n, "erc20 platform now has some fees");
    });

    // TODO: check that the fee is paid to platform
  });
});
