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
  let fUser: UserWithAddress; // user who mints/liquidates fTokens
  let rebalanceUser: UserWithAddress; // mints fTokens and deposits in rebalancePool
  let liquidator: UserWithAddress; // bot that liquidates the rebalancePool (somehow)
  let xUser: UserWithAddress; // user who mints/redeems xTokens

  let weth: ContractWithAddress<WETH9>;
  let oracle: ContractWithAddress<MockFxPriceOracle>;
  let fToken: ContractWithAddress<FractionalToken>;
  let xToken: ContractWithAddress<LeveragedToken>;
  let treasury: ContractWithAddress<Treasury>;
  let market: ContractWithAddress<Market>;
  let rebalancePool: ContractWithAddress<RebalancePool>;

  let rs = new RegressionSystem();

  let beta = rs.defVariable("beta", parseEther("0.1"));
  let baseTokenCap = rs.defVariable("baseTokenCap", parseEther("200"));
  let initialCollateral = rs.defVariable("initialCollateral", parseEther("100"));
  //let additionalCollateral = (baseTokenCap - initialCollateral) / 100n;

  let index = rs.defVariable("index", parseEther("0"));
  let ethPrice = rs.defVariable("ethPrice", parseEther("2000"));

  let stabilityRatio = rs.defVariable("stabilityRatio", parseEther("1.3"));
  let liquidationRatio = rs.defVariable("liquidationRatio", parseEther("1.2"));
  let selfLiquidationRatio = rs.defVariable("selfLiquidationRatio", parseEther("1.14"));
  let recapRatio = rs.defVariable("recapRatio", parseEther("1"));
  // TODO: why is this not just liquidationRatio: review the rebalance pool / market interactions
  let rebalancePoolliquidatableRatio = rs.defVariable("rebalancePoolliquidatableRatio", parseEther("1.3"));

  let rebalancePoolLiquidation = rs.defAction("rebalancePoolLiquidation", async () => {
    const deposited = await fToken.balanceOf(rebalancePool); // TODO: add a -1 input to liquidate function
    await rebalancePool.connect(liquidator).liquidate(deposited, 0n);
  });
  let fUserLiquidation = rs.defAction("fUserLiquidation", async () => {
    const balance = await fToken.balanceOf(fUser);
    await market.connect(fUser).liquidate(balance, fUser.address, 0n);
  });

  rs.defCalculation("fTokenNav", async () => {
    return treasury.getCurrentNav().then((res) => res._fNav);
  });
  rs.defCalculation("xTokenNav", async () => {
    return treasury.getCurrentNav().then((res) => res._xNav);
  });
  rs.defCalculation("baseTokenNav", async () => {
    return treasury.getCurrentNav().then((res) => res._baseNav);
  });
  rs.defCalculation("collateralRatio", async () => {
    return treasury.collateralRatio();
  });

  let token = rs.defType("token", [
    {
      name: "supply",
      instanceCalculation: (token: any) => {
        return token.totalSupply();
      },
    },
  ]);

  /*

  let fTokenSupply = new Calculation(rs, "fTokenSupply", async () => {
    return fToken.totalSupply();
  });
  let fUserFTokens = new Calculation(rs, "fUserFTokens", async () => {
    return fToken.balanceOf(fUser.address);
  });
  let rebalanceUserFTokens = new Calculation(rs, "rebalanceUserFTokens", async () => {
    return fToken.balanceOf(rebalanceUser.address);
  });
  let rebalanceUserPoolTokens = new Calculation(rs, "rebalanceUserPoolTokens", async () => {
    return rebalancePool.balanceOf(rebalanceUser.address);
  });
  let rebalanceUserPoolBalance = new Calculation(rs, "rebalanceUserPoolTokens", async () => {
    return rebalancePool.balanceOf(rebalanceUser.address);
  });

  let rebalancePoolFTokens = new Calculation(rs, "rebalancePoolFTokens", async () => {
    return rebalancePool.totalSupply();
  });

  let rebalancePoolLiquidatableCollateralRatio = new Calculation(
    rs,
    "rebalancePoolLiquidatableCollateralRatio",
    async () => {
      return rebalancePool.liquidatableCollateralRatio();
    },
  );

  let xTokenSupply = new Calculation(rs, "xTokenSupply", async () => {
    return xToken.totalSupply();
  });
  let xUserXTokens = new Calculation(rs, "xUserXTokens", async () => {
    return xToken.balanceOf(xUser.address);
  });

  let deployerBaseTokens = new Calculation(rs, "deployerBaseTokens", async () => {
    return weth.balanceOf(deployer.address);
  });
  let platformBaseTokens = new Calculation(rs, "platformBaseTokens", async () => {
    return weth.balanceOf(platform.address);
  });
  let treasuryBaseTokens = new Calculation(rs, "treasuryBaseTokens", async () => {
    return weth.balanceOf(treasury.address);
  });
  let marketBaseTokens = new Calculation(rs, "marketBaseTokens", async () => {
    return weth.balanceOf(market.address);
  });
  let rebalanceUserBaseTokens = new Calculation(rs, "rebalanceUserBaseTokens", async () => {
    return weth.balanceOf(rebalanceUser.address);
  });
  let liquidatorBaseTokens = new Calculation(rs, "liquidatorBaseTokens", async () => {
    return weth.balanceOf(liquidator.address);
  });
  let rebalancePoolBaseTokens = new Calculation(rs, "rebalancePoolBaseTokens", async () => {
    return weth.balanceOf(rebalancePool.address);
  });

  */

  beforeEach(async () => {
    deployer = await getUser("deployer");
    platform = await getUser("playform");
    admin = await getUser("admin");
    fUser = await getUser("fUser");
    rebalanceUser = await getUser("rebalanceUser");
    liquidator = await getUser("liquidator");
    xUser = await getUser("xUser");

    /*
    console.log("%s = deployer", deployer.address);
    console.log("%s = platform", platform.address);
    console.log("%s = admin", admin.address);
    console.log("%s = fUser", fUser.address);
    console.log("%s = rebalanceUser", rebalanceUser.address);
    console.log("%s = liquidator", liquidator.address);
    console.log("%s = xUser", xUser.address);
    */
    weth = await deploy("WETH9", deployer);
    // rt.defToken(weth.name, weth.address);
    oracle = await deploy("MockFxPriceOracle", deployer);
    fToken = await deploy("FractionalToken", deployer);
    //rs.defToken(fToken.name, fToken.address);
    xToken = await deploy("LeveragedToken", deployer);
    //rs.defToken(xToken.name, xToken.address);

    // TODO: upgradeable and constructors are incompatible (right?), so the constructor should be removed
    // and the ratio passed into the initialise function, or maybe the Market.mint() function?
    // both of these functions only get called once (check this), although the market can be changed so
    // could be called on each market... seems like an arbitrary thing that should maybe be designed out?
    treasury = await deploy("Treasury", deployer, parseEther("0.5")); // 50/50 split between f & x tokens
    //rs.defContract(treasury.name, treasury.address);
    market = await deploy("Market", deployer);
    //rs.defContract(market.name, market.address);
    rebalancePool = await deploy("RebalancePool", deployer);
    //rs.defContract(rebalancePool.name, rebalancePool.address);

    /*
    console.log("%s = weth", weth.address);
    console.log("%s = oracle", oracle.address);
    console.log("%s = fToken", fToken.address);
    console.log("%s = xToken", xToken.address);
    console.log("%s = treasury", treasury.address);
    console.log("%s = market", market.address);
    console.log("%s = rebalancePool", rebalancePool.address);
    */

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

    await rebalancePool.initialize(treasury, market);
    await rebalancePool.updateLiquidator(liquidator.address);
    await rebalancePool.updateLiquidatableCollateralRatio(rebalancePoolliquidatableRatio.initialValue);

    rs.initialise();
  });

  context("navsby", async () => {
    it("ethPrice", async () => {
      // TODO: move this into the before each and split out the constructor parameters
      // TODO: consider merging some of Regression test and regression system, so we don't have this
      // chronology coupling
      // regression test for the definition of the actual test tro run, variables, actions and calcs
      // regrression system for the definition of all thos actions and calcs, etc.
      let rt = new RegressionTest(rs, [index, ethPrice], [rebalancePoolLiquidation, fUserLiquidation]);
      rt.defThing(fToken, token); // TODO: this could go in before each if regression test was visible there

      await oracle.setPrice(ethPrice.value);
      await treasury.initializePrice();

      // set up the market
      // allow initial mint
      await weth.deposit({ value: initialCollateral.initialValue });
      await weth.approve(market.address, MaxUint256);
      await market.mint(initialCollateral.value, deployer.address, 0, 0);

      // TODO: all the initialisations should be part of the Actors, but only executed once
      // some actors may need initialisation of another - like a dependency tree :-/
      // TODO: actors are execised one at a time so data should take the actor as input
      // TODO: actors produce tw columns "Act", which has the name of the actor and
      // result - either "success" or an error message
      //await rt.data();

      // fUser and rebalanceUser mintFTokens
      const fTokensEth = initialCollateral.initialValue / 2n;

      await weth.connect(rebalanceUser).deposit({ value: fTokensEth / 2n });
      await weth.connect(rebalanceUser).approve(market.address, MaxUint256);
      await market.connect(rebalanceUser).mintFToken(MaxUint256, rebalanceUser.address, 0n);

      await weth.connect(fUser).deposit({ value: fTokensEth / 2n });
      await weth.connect(fUser).approve(market.address, MaxUint256);
      await market.connect(fUser).mintFToken(MaxUint256, fUser.address, 0n);

      //await rt.data();

      // set up rebalance Pool
      await fToken.connect(rebalanceUser).approve(rebalancePool.address, MaxUint256);
      await rebalancePool.connect(rebalanceUser).deposit(MaxUint256, rebalanceUser.address);

      //await rt.data();

      let maxIndex = parseEther("40");
      for (; index.value <= maxIndex; index.value += parseEther("1")) {
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
