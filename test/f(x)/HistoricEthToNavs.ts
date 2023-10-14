/* eslint-disable node/no-missing-import */
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { LeveragedToken, FractionalToken, Treasury, WETH9, MockFxPriceOracle } from "@types";
import { ZeroAddress } from "ethers";

import * as fs from 'fs';
import * as rd from 'readline';


const PRECISION = 10n ** 18n;

describe("HistoricEthToNavs", async () => {
  let deployer: SignerWithAddress;
  let market: SignerWithAddress;
  let signer: SignerWithAddress;

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

  beforeEach(async () => {
    [deployer, market, signer] = await ethers.getSigners();

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

    await fToken.initialize(treasuryAddress, "Fractional ETH", "fETH");
    await xToken.initialize(treasuryAddress, fTokenAddress, "Leveraged ETH", "xETH");

    await treasury.initialize(
      market.address,
      wethAddress,
      fTokenAddress,
      xTokenAddress,
      oracleAddress,
      ethers.parseEther("0.1"),
      ethers.parseEther("1000"),
      ZeroAddress
    );

    await weth.deposit({ value: ethers.parseEther("100") });
    await weth.transfer(treasuryAddress, ethers.parseEther("100"));

});


  context("navsvprice", async () => {

    it("run historic prices for each day and print the navs", async () => {

      console.log("Date, fToken NAV, xToken NAV");
      var data: Array<{ day: string; price: bigint}> = [];

      var reader = rd.createInterface(fs.createReadStream("ethprices.txt"))
      reader.on("line", (l: string) => {
        var tokens = l.split('\t');
        var date = tokens[0];
        var price= ethers.parseEther(tokens[1]);
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
            await treasury.connect(market).mint(ethers.parseEther("1"), deployer.address, 0);
          } else {
            var navs = await treasury.getCurrentNav();
            console.log("%s, %s, %s", element.day, ethers.formatEther(navs._fNav), ethers.formatEther(navs._xNav));
          }
        }}
      );
    });
  });
});
