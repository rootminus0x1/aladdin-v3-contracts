/* eslint-disable node/no-missing-import */
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { LeveragedToken, FractionalToken, Treasury, Market, WETH9, MockFxPriceOracle } from "@types";
import { ZeroAddress, parseEther, formatEther, MaxUint256 } from "ethers";

import * as fs from 'fs';
import * as rd from 'readline';
import { erc20 } from "typechain-types/@openzeppelin/contracts/token";

enum MintOption {
  Both,
  FToken,
  XToken
}

const PRECISION = 10n ** 18n;

describe("NavsGraphs", async () => {
  let deployer: SignerWithAddress; // deploys all the contracts
  let platform: SignerWithAddress; // accepts fees from market
  let signer: SignerWithAddress;   //

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

  let beta = parseEther("0.1");
  let baseTokenCap = parseEther("1000");
  let initialCollateral = parseEther("100");
  let additionalCollateral = (baseTokenCap - initialCollateral) / 100n;

  beforeEach(async () => {
    [deployer, platform, signer] = await ethers.getSigners();

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
    // TODO: upgradeable and constructors are incompatible (right?), so the constructor should be removed
    // and the ratio passed into the initialise function, or maybe the Market.mint() function?
    // both of these functions only get called once (check this), although the market can be changed so
    // could be called on each market... seems like an arbitrary thing that should maybe be designed out?
    treasury = await Treasury.deploy(parseEther("0.5")); // 50/50 split between f & x tokens
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
      beta,
      baseTokenCap,
      ZeroAddress // rate provider - used to convert between wrapped and unwrapped, 0 address means 1:1 ratio
    );

    await market.initialize(treasuryAddress, platform.address);
    await market.updateMarketConfig(
      ethers.parseEther("1.3"),
      ethers.parseEther("1.2"),
      ethers.parseEther("1.14"),
      ethers.parseEther("1")
    );

    await weth.deposit({ value: initialCollateral * 1000n });
    //await weth.transfer(deployer.address, initialCollateral * 10n);
    await weth.approve(marketAddress, MaxUint256);

});


  context("historic", async () => {

    it("run historic prices for each day and print the navs", async () => {

      console.log("Date, fToken NAV, xToken NAV");
      var data: Array<{ day: string; price: bigint}> = [];

      var reader = rd.createInterface(fs.createReadStream("ethprices.txt"))
      reader.on("line", (l: string) => {
        var tokens = l.split('\t');
        var date = tokens[0];
        var price= parseEther(tokens[1]);
        data.push({day: date, price: price});
      })
      reader.on("close", async ()=> {
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
        }}
      );
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
      for (let collateral = initialCollateral;
        collateral < baseTokenCap;
        collateral += additionalCollateral) {
        await market.mintXToken(additionalCollateral, signer.address, 0);
        let xTokens = await xToken.balanceOf(signer.address);
        let fTokens = await fToken.balanceOf(signer.address);
        var navs = await treasury.getCurrentNav();
        console.log("%s, %s, %s, %s, %s", formatEther(collateral), formatEther(fTokens), formatEther(navs._fNav), formatEther(xTokens), formatEther(navs._xNav));
      }
    });

    it("fcollateral", async () => {
      // here we increase the collateral by minting equal amounts of f and x tokens

      let price = parseEther("1000"); // a grand per eth
      await oracle.setPrice(price);
      await treasury.initializePrice();

      await market.mint(initialCollateral, signer.address, 0, 0);

      console.log("Collateral, fTokens, fToken NAV, xTokens, xToken NAV");
      for (let collateral = initialCollateral;
        collateral < baseTokenCap;
        collateral += additionalCollateral) {
        await market.mintFToken(additionalCollateral, signer.address, 0);
        let xTokens = await xToken.balanceOf(signer.address);
        let fTokens = await fToken.balanceOf(signer.address);
        var navs = await treasury.getCurrentNav();
        console.log("%s, %s, %s, %s, %s", formatEther(collateral), formatEther(fTokens), formatEther(navs._fNav), formatEther(xTokens), formatEther(navs._xNav));
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
*/
      for (let price = initialPrice; price > 0n; price -= (initialPrice / 500n)) {
        await oracle.setPrice(price);
        //let xTokens = await xToken.balanceOf(signer.address);
        //let fTokens = await fToken.balanceOf(signer.address);
        var cr = await treasury.collateralRatio();
        var navs = await treasury.getCurrentNav();
        console.log("%s, %s, %s, %s", formatEther(price), formatEther(navs._fNav), formatEther(navs._xNav), formatEther(cr));
      }
    });

  });

});
