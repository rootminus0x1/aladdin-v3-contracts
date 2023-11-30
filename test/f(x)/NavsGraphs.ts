/* eslint-disable node/no-missing-import */
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
//import { expect } from "chai";
import { ethers } from "hardhat";
import { LeveragedToken, FractionalToken, Treasury, Market, WETH9, MockFxPriceOracle } from "@types";
import { ZeroAddress, parseEther, formatEther, MaxUint256, BaseContract } from "ethers";

import * as fs from "fs";
import * as rd from "readline";
import { erc20 } from "typechain-types/@openzeppelin/contracts/token";

enum MintOption {
  Both,
  FToken,
  XToken,
}

type ContractWithAddress<T extends BaseContract> = T & { address: string; };

 /*
  return Object.assign(
    contract,
    { address: address }
  ) as unknown as ContractWithAddress<Contract>;

  return {
    ...contract,
    address: address,
   } as unknown as ContractWithAddress<Contract>;

    */

async function deploy<T extends BaseContract> (factoryName: string,
  deployer: SignerWithAddress /*HardhatEthersSigner*/,
  ...deployArgs: any[]): Promise<ContractWithAddress<T>> {
  const contractFactory = await ethers.getContractFactory(factoryName, deployer);
  const contract = await contractFactory.deploy(...deployArgs);
  await contract.waitForDeployment();

  return Object.assign(
    contract as T,
    { address: await contract.getAddress() },
    )as ContractWithAddress<T>;
}

const PRECISION = 10n ** 18n;

describe("NavsGraphs", async () => {
  let deployer: SignerWithAddress; // deploys all the contracts
  let platform: SignerWithAddress; // accepts fees from market
  let signer: SignerWithAddress; //

  let weth: ContractWithAddress<WETH9>;
  let oracle: ContractWithAddress<MockFxPriceOracle>;
  let fToken: ContractWithAddress<FractionalToken>;
  let xToken: ContractWithAddress<LeveragedToken>;
  let treasury: ContractWithAddress<Treasury>;
  let market: ContractWithAddress<Market>;

  let beta = parseEther("0.1");
  let baseTokenCap = parseEther("1000");
  let initialCollateral = parseEther("100");
  let additionalCollateral = (baseTokenCap - initialCollateral) / 100n;

  beforeEach(async () => {
    [deployer, platform, signer] = await ethers.getSigners();

    weth = await deploy("WETH9", deployer);
    oracle = await deploy("MockFxPriceOracle", deployer);

    fToken = await deploy("FractionalToken", deployer);
    xToken = await deploy("LeveragedToken", deployer);

    // TODO: upgradeable and constructors are incompatible (right?), so the constructor should be removed
    // and the ratio passed into the initialise function, or maybe the Market.mint() function?
    // both of these functions only get called once (check this), although the market can be changed so
    // could be called on each market... seems like an arbitrary thing that should maybe be designed out?
    treasury = await deploy("Treasury", deployer, parseEther("0.5")); // 50/50 split between f & x tokens

    market = await deploy("Market", deployer);

    await fToken.initialize(treasury.address, "Fractional ETH", "fETH");
    await xToken.initialize(treasury.address, fToken.address, "Leveraged ETH", "xETH");

    console.log("treasury.initialize");
    await treasury.initialize(
      market.address,
      weth.address,
      fToken.address,
      xToken.address,
      oracle.address,
      beta,
      baseTokenCap,
      ZeroAddress, // rate provider - used to convert between wrapped and unwrapped, 0 address means 1:1 ratio
    );

    await market.initialize(treasury.address, platform.address);
    await market.updateMarketConfig(
      ethers.parseEther("1.3"),
      ethers.parseEther("1.2"),
      ethers.parseEther("1.14"),
      ethers.parseEther("1"),
    );
    console.log("weth.deposit");
    await weth.deposit({ value: initialCollateral * 1000n });
    //await weth.transfer(deployer.address, initialCollateral * 10n);
    console.log("weth.approve");
    await weth.approve(market.address, MaxUint256);
    console.log("done.");
  });

  context("navsby", async () => {
    it("xcollateral", async () => {
      // here we increase the collateral by minting equal amounts of f and x tokens

      let price = parseEther("1000"); // a grand per eth
      await oracle.setPrice(price);
      console.log("treasury=%s (addr=%s)", treasury, treasury.address)
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


/*

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
