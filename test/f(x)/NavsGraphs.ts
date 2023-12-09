/* eslint-disable node/no-missing-import */
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
//import { expect } from "chai";
import { ethers } from "hardhat";
import { ZeroAddress, parseEther, formatEther, MaxUint256, dataLength } from "ethers";

import * as fs from "fs";
import * as rd from "readline";
import { erc20 } from "typechain-types/@openzeppelin/contracts/token";

import { LeveragedToken, FractionalToken, Treasury, Market, WETH9, MockFxPriceOracle, RebalancePool } from "@types";
import { ContractWithAddress, UserWithAddress, deploy, getUser } from "test/useful";
import { RegressionSystem, RegressionTest, Variable } from "test/f(x)/regression/RegressionTest";
import { features } from "process";

enum MintOption {
  Both,
  FToken,
  XToken,
}

const PRECISION = 10n ** 18n;

describe("NavsGraphs", async () => {
  let deployer: UserWithAddress; // deploys all the contracts
  let platform: UserWithAddress; // accepts fees from market
  let admin: UserWithAddress; // bao admin
  let fHolderLiquidator: UserWithAddress; // user who mints/liquidates fTokens
  let rebalanceUser: UserWithAddress; // mints fTokens and deposits in rebalancePool
  let liquidator: UserWithAddress; // bot that liquidates the rebalancePool (somehow)
  let fMinter: UserWithAddress; // user who mints fTokens
  let fHolderRedeemer: UserWithAddress; // user who mint/redeems fTokens
  let xMinter: UserWithAddress; // user who mint/redeems xTokens
  let xHolderRedeemer: UserWithAddress; // user who mint/redeems xTokens

  let weth: ContractWithAddress<WETH9>;
  let oracle: ContractWithAddress<MockFxPriceOracle>;
  let fToken: ContractWithAddress<FractionalToken>;
  let xToken: ContractWithAddress<LeveragedToken>;
  let treasury: ContractWithAddress<Treasury>;
  let market: ContractWithAddress<Market>;
  let rebalancePool: ContractWithAddress<RebalancePool>;

  let rs = new RegressionSystem(
    new Map([
      ["FractionalToken", "fToken"],
      ["LeveragedToken", "xToken"],
    ]),
  );

  let beta = rs.defVariable("beta", parseEther("0.1"));
  let baseTokenCap = rs.defVariable("baseTokenCap", parseEther("200"));
  let initialCollateral = rs.defVariable("initialCollateral", parseEther("100"));
  let fees = rs.defVariable("fees", 0n); // 1n to switch them on, 0n to switch them off
  //let additionalCollateral = (baseTokenCap - initialCollateral) / 100n;

  let index = rs.defVariable("index", parseEther("0"));
  let ethPrice = rs.defVariable("ethPrice", parseEther("2000"));

  // stability mode triggers
  let stabilityRatio = rs.defVariable("stabilityRatio", parseEther("1.3"));
  let liquidationRatio = rs.defVariable("liquidationRatio", parseEther("1.2"));
  let selfLiquidationRatio = rs.defVariable("selfLiquidationRatio", parseEther("1.14"));
  let recapRatio = rs.defVariable("recapRatio", parseEther("1"));
  let rebalancePoolliquidatableRatio = rs.defVariable("rebalancePoolliquidatableRatio", parseEther("1.3055"));

  // Fees
  let fTokenMintFeeDefault = rs.defVariable("fTokenMintFeeDefault", parseEther("0.0025"));
  let fTokenMintFeeExtra = rs.defVariable("fTokenMintFeeExtra", parseEther("0"));
  let fTokenRedeemFeeDefault = rs.defVariable("fTokenRedeemFeeDefault", parseEther("0.0025"));
  let fTokenRedeemFeeExtra = rs.defVariable("fTokenRedeemFeeExtra", parseEther("-0.0025"));

  let xTokenMintFeeDefault = rs.defVariable("xTokenMintFeeDefault", parseEther("0.01"));
  let xTokenMintFeeExtra = rs.defVariable("xTokenMintFeeExtra", parseEther("-0.01"));
  let xTokenRedeemFeeDefault = rs.defVariable("xTokenRedeemFeeDefault", parseEther("0.01"));
  let xTokenRedeemFeeExtra = rs.defVariable("xTokenRedeemFeeExtra", parseEther("0.07"));

  let rebalancePoolLiquidation = rs.defAction("rebalancePool.liquidate(-1)", async () => {
    const deposited = await fToken.balanceOf(rebalancePool); // TODO: add a -1 input to liquidate function
    await rebalancePool.connect(liquidator).liquidate(deposited, 0n);
  });
  let fHolderLiquidation = rs.defAction("fHolderLiquidate(-1)", async () => {
    const balance = await fToken.balanceOf(fHolderLiquidator);
    await market.connect(fHolderLiquidator).liquidate(balance, fHolderLiquidator.address, 0n);
  });
  let fMint = rs.defAction("fMinter.mint(100)", async () => {
    // TODO: access the Calculation for this
    let fNav = await treasury.getCurrentNav().then((res) => res._fNav);
    await market.connect(fMinter).mintFToken((fNav * parseEther("100")) / ethPrice.value, fMinter.address, 0n);
  });
  let fRedeem = rs.defAction("fHolderRedeemer.Redeem(100)", async () => {
    await market.connect(fHolderRedeemer).redeem(parseEther("100"), 0n, fHolderRedeemer.address, 0n);
  });
  let xMint = rs.defAction("xMinter.mint(100)", async () => {
    let xNav = await treasury.getCurrentNav().then((res) => res._xNav);
    await market.connect(xMinter).mintXToken((xNav * parseEther("100")) / ethPrice.value, xMinter.address, 0n);
  });
  let xRedeem = rs.defAction("xHolderRedeemer.Redeem(100)", async () => {
    await market.connect(xHolderRedeemer).redeem(0n, parseEther("100"), xHolderRedeemer.address, 0n);
  });

  rs.defCalculation("FractionalToken.nav", async () => {
    return treasury.getCurrentNav().then((res) => res._fNav);
  });
  rs.defCalculation("LeveragedToken.nav", async () => {
    return treasury.getCurrentNav().then((res) => res._xNav);
  });
  /*
  rs.defCalculation("baseTokenNav", async () => {
    return treasury.getCurrentNav().then((res) => res._baseNav);
  });
  */
  rs.defCalculation("treasury.collateralRatio", async () => {
    return treasury.collateralRatio();
  });
  rs.defCalculation("treasury.totalBaseToken", async () => {
    return treasury.totalBaseToken();
  });

  let token = rs.defType("token", [
    {
      name: "supply",
      calc: (token: any) => {
        return token.totalSupply();
      },
    },
  ]);

  let owner = rs.defType("owner");

  beforeEach(async () => {
    deployer = await getUser("deployer");
    platform = await getUser("platform");
    rs.defThing(platform, owner);
    admin = await getUser("admin");
    fHolderLiquidator = await getUser("fHolderLiquidator");
    rs.defThing(fHolderLiquidator, owner);
    rebalanceUser = await getUser("rebalanceUser");
    rs.defThing(rebalanceUser, owner);
    liquidator = await getUser("liquidator");
    fHolderRedeemer = await getUser("fHolderRedeemer");
    rs.defThing(fHolderRedeemer, owner);
    fMinter = await getUser("fMinter");
    rs.defThing(fMinter, owner);
    xHolderRedeemer = await getUser("xHolderRedeemer");
    rs.defThing(xHolderRedeemer, owner);
    xMinter = await getUser("xMinter");
    rs.defThing(xMinter, owner);

    weth = await deploy("WETH9", deployer);
    rs.defThing(weth, token);
    oracle = await deploy("MockFxPriceOracle", deployer);
    fToken = await deploy("FractionalToken", deployer);
    rs.defThing(fToken, token);
    xToken = await deploy("LeveragedToken", deployer);
    rs.defThing(xToken, token);

    // TODO: upgradeable and constructors are incompatible (right?), so the constructor should be removed
    // and the ratio passed into the initialise function, or maybe the Market.mint() function?
    // both of these functions only get called once (check this), although the market can be changed so
    // could be called on each market... seems like an arbitrary thing that should maybe be designed out?
    treasury = await deploy("Treasury", deployer, parseEther("0.5")); // 50/50 split between f & x tokens
    market = await deploy("Market", deployer);
    rebalancePool = await deploy("RebalancePool", deployer);
    rs.defThing(rebalancePool, owner);
    rs.defThing(rebalancePool, token);

    rs.defRelation("owner", "token", [
      {
        name: "has",
        calc: (a: any, b: any) => {
          return b.balanceOf(a);
        },
      },
    ]);

    await fToken.initialize(treasury.address, "Fractional ETH", "fETH");
    await xToken.initialize(treasury.address, fToken.address, "Leveraged ETH", "xETH");

    await treasury.initialize(
      market.address,
      weth.address,
      fToken.address,
      xToken.address,
      oracle.address,
      beta.initialValue,
      baseTokenCap.initialValue,
      ZeroAddress, // rate provider - used to convert between wrapped and unwrapped, 0 address means 1:1 ratio
    );

    await market.initialize(treasury.address, platform.address);
    await market.updateMarketConfig(
      stabilityRatio.initialValue,
      liquidationRatio.initialValue,
      selfLiquidationRatio.initialValue,
      recapRatio.initialValue,
    );

    if (fees.initialValue != 0n) {
      // implement fees
      console.log("including fees");
      await market.updateMintFeeRatio(fTokenMintFeeDefault.initialValue, fTokenMintFeeExtra.initialValue, true);
      await market.updateRedeemFeeRatio(fTokenRedeemFeeDefault.initialValue, fTokenRedeemFeeExtra.initialValue, true);
      await market.updateMintFeeRatio(xTokenMintFeeDefault.initialValue, xTokenMintFeeExtra.initialValue, false);
      await market.updateRedeemFeeRatio(xTokenRedeemFeeDefault.initialValue, xTokenRedeemFeeExtra.initialValue, false);
    }

    // rebalance pool
    await rebalancePool.initialize(treasury, market);
    await rebalancePool.updateLiquidator(liquidator.address);
    await rebalancePool.updateLiquidatableCollateralRatio(rebalancePoolliquidatableRatio.initialValue);

    // reserve pool
    // market.updateReservePool

    rs.initialise();
  });

  context("navsby", async () => {
    it("ethPrice", async () => {
      let rt = new RegressionTest(
        "Aladdin",
        rs,
        [index, ethPrice],
        [fMint, fRedeem, xMint, xRedeem, rebalancePoolLiquidation, fHolderLiquidation],
      );

      await oracle.setPrice(ethPrice.value);
      await treasury.initializePrice();

      // set up the market
      // allow initial mint
      await weth.deposit({ value: initialCollateral.initialValue });
      await weth.approve(market.address, MaxUint256);
      await market.mint(initialCollateral.value, platform.address, 0, 0);

      // fUser and rebalanceUser mintFTokens
      const fTokensEth = initialCollateral.initialValue / 2n;

      // TODO add to actions as an intialiser function
      await weth.connect(rebalanceUser).deposit({ value: fTokensEth / 4n });
      await weth.connect(rebalanceUser).approve(market.address, MaxUint256);
      await market.connect(rebalanceUser).mintFToken(MaxUint256, rebalanceUser.address, 0n);

      await weth.connect(fHolderLiquidator).deposit({ value: fTokensEth / 4n });
      await weth.connect(fHolderLiquidator).approve(market.address, MaxUint256);
      await market.connect(fHolderLiquidator).mintFToken(MaxUint256, fHolderLiquidator.address, 0n);

      await weth.connect(fHolderRedeemer).deposit({ value: fTokensEth / 4n });
      await weth.connect(fHolderRedeemer).approve(market.address, MaxUint256);
      await market.connect(fHolderRedeemer).mintFToken(MaxUint256, fHolderRedeemer.address, 0n);

      await weth.connect(fMinter).deposit({ value: fTokensEth / 4n });
      await weth.connect(fMinter).approve(market.address, MaxUint256);

      await weth.connect(xHolderRedeemer).deposit({ value: fTokensEth / 4n });
      await weth.connect(xHolderRedeemer).approve(market.address, MaxUint256);
      await market.connect(xHolderRedeemer).mintXToken(MaxUint256, xHolderRedeemer.address, 0n);

      await weth.connect(xMinter).deposit({ value: fTokensEth / 4n });
      await weth.connect(xMinter).approve(market.address, MaxUint256);

      // set up rebalance Pool
      await fToken.connect(rebalanceUser).approve(rebalancePool.address, MaxUint256);
      await rebalancePool.connect(rebalanceUser).deposit(MaxUint256, rebalanceUser.address);

      let maxIndex = parseEther("40");
      for (; index.value <= maxIndex; index.value += parseEther("1")) {
        // TODO: make this an action
        ethPrice.value = (ethPrice.initialValue * (maxIndex - index.value)) / maxIndex;
        await oracle.setPrice(ethPrice.value);

        await rt.data();
      }

      await rt.done();
    });
  });

  /*
  context("navsby", async () => {
    it("xcollateral", async () => {
      // here we increase the collateral by minting equal amounts of f and x tokens

      let price = parseEther("1000"); // a grand per eth
      await oracle.setPrice(price);
      await treasury.initializePrice();

      await market.mint(initialCollateral, signer.address, 0, 0);

      console.log("Collateral, fTokens, fToken NAV, xTokens, xToken NAV");
      for (let collateral = initialCollateral; collateral < baseTokenCap; collateral += additionalCollateral) {
        await market.mintXToken(additionalCollateral, signer.address, 0);
        let xTokens = await xToken.balanceOf(signer.address);
        let fTokens = await fToken.balanceOf(signer.address);
        var navs = await treasury.getCurrentNav();
        console.log(
          "%s, %s, %s, %s, %s",
          formatEther(collateral),
          formatEther(fTokens),
          formatEther(navs._fNav),
          formatEther(xTokens),
          formatEther(navs._xNav),
        );
      }
    });
  });

  context("historic", async () => {
    it("run historic prices for each day and print the navs", async () => {
      console.log("Date, fToken NAV, xToken NAV");
      var data: Array<{ day: string; price: bigint }> = [];

      var reader = rd.createInterface(fs.createReadStream("ethprices.txt"));
      reader.on("line", (l: string) => {
        var tokens = l.split("\t");
        var date = tokens[0];
        var price = parseEther(tokens[1]);
        data.push({ day: date, price: price });
      });
      reader.on("close", async () => {
        console.log("Data has been read %s", data.length);
        var first = true;
        for (let element of data) {
          await oracle.setPrice(element.price);
          if (first) {
            first = false;
            await treasury.initializePrice();
            await market.mint(parseEther("1"), signer.address, 0, 0);
          } else {
            var navs = await treasury.getCurrentNav();
            console.log("%s, %s, %s", element.day, formatEther(navs._fNav), formatEther(navs._xNav));
          }
        }
      });
    });
  });

  context("navsby", async () => {
    it("xcollateral", async () => {
      // here we increase the collateral by minting equal amounts of f and x tokens

      let price = parseEther("1000"); // a grand per eth
      await oracle.setPrice(price);
      await treasury.initializePrice();

      await market.mint(initialCollateral, signer.address, 0, 0);

      console.log("Collateral, fTokens, fToken NAV, xTokens, xToken NAV");
      for (let collateral = initialCollateral; collateral < baseTokenCap; collateral += additionalCollateral) {
        await market.mintXToken(additionalCollateral, signer.address, 0);
        let xTokens = await xToken.balanceOf(signer.address);
        let fTokens = await fToken.balanceOf(signer.address);
        var navs = await treasury.getCurrentNav();
        console.log(
          "%s, %s, %s, %s, %s",
          formatEther(collateral),
          formatEther(fTokens),
          formatEther(navs._fNav),
          formatEther(xTokens),
          formatEther(navs._xNav),
        );
      }
    });

    it("fcollateral", async () => {
      // here we increase the collateral by minting equal amounts of f and x tokens

      let price = parseEther("1000"); // a grand per eth
      await oracle.setPrice(price);
      await treasury.initializePrice();

      await market.mint(initialCollateral, signer.address, 0, 0);

      console.log("Collateral, fTokens, fToken NAV, xTokens, xToken NAV");
      for (let collateral = initialCollateral; collateral < baseTokenCap; collateral += additionalCollateral) {
        await market.mintFToken(additionalCollateral, signer.address, 0);
        let xTokens = await xToken.balanceOf(signer.address);
        let fTokens = await fToken.balanceOf(signer.address);
        var navs = await treasury.getCurrentNav();
        console.log(
          "%s, %s, %s, %s, %s",
          formatEther(collateral),
          formatEther(fTokens),
          formatEther(navs._fNav),
          formatEther(xTokens),
          formatEther(navs._xNav),
        );
      }
    });

    it("price", async () => {
      // here we increase the collateral by minting equal amounts of f and x tokens

      let initialPrice = parseEther("1000"); // a grand per eth
      await oracle.setPrice(initialPrice);
      await treasury.initializePrice();

      await market.mint(initialCollateral, signer.address, 0, 0);

      console.log("price, fToken NAV, xToken NAV, CR");
      /*
      for (let price = parseEther("100"); // 500 passes
        price < initialPrice * 2n;
        price += (initialPrice / 50n)) {

      for (let price = initialPrice; price > 0n; price -= initialPrice / 500n) {
        await oracle.setPrice(price);
        //let xTokens = await xToken.balanceOf(signer.address);
        //let fTokens = await fToken.balanceOf(signer.address);
        var cr = await treasury.collateralRatio();
        var navs = await treasury.getCurrentNav();
        console.log(
          "%s, %s, %s, %s",
          formatEther(price),
          formatEther(navs._fNav),
          formatEther(navs._xNav),
          formatEther(cr),
        );
      }
    });
  });
  */
});
