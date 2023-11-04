// SPDX-License-Identifier: UNLICENSED
pragma experimental ABIEncoderV2;
pragma solidity >=0.7.1;

import { console2 as console } from "forge-std/console2.sol";
import { Test, Vm } from "forge-std/Test.sol";

import "contracts/f(x)/StableCoinMath.sol";

contract TestStableCoinMath is Test {
  function test_basics() public {
    console.log("hello world");

    /*

    const state = {
        baseSupply: 100,
        baseNav: 2000 * 1e18,
        fMultiple: 1e18,
        fSupply: 100000,
        fNav: 1e18,
        xSupply: 100000,
        xNav: 1e18,
      }

      //let maxBaseIn: bigint;
      //let maxFTokenMintable: bigint;

      //let [maxBaseIn, maxFTokenMintable] = await scm.maxMintableFToken(state, ethers.parseEther("2"));
      //console.log("about to call maxMintableFToken");
      //await scm.maxMintableFToken(state, ethers.parseEther("2"));
      //console.log("called maxMintableFToken");

      {
        console.log("about to call return1");
        let result = await scm.return1();
        console.log("called return1");
        expect(result).to.be.eq(1);
      }
      {
        console.log("about to call returnit");
        let result = await scm.returnit(2);
        console.log("called returnit");
        expect(result).to.be.eq(2);
      }
      {
        console.log("about to call basesupply");
        let result = await scm.basesupply(state);
        console.log("called basesupply");
        expect(result).to.be.eq(100);
      }

      //expect(maxBaseIn[0]).to.be.eq(2, "expected maxBaseIn to be 2!");
    });

    function maxMintableFToken(SwapState state, uint256 _newCollateralRatio)
    returns (uint256 _maxBaseIn, uint256 _maxFTokenMintable)

    function maxMintableXToken(SwapState state, uint256 _newCollateralRatio)
    returns (uint256 _maxBaseIn, uint256 _maxXTokenMintable)

    function maxMintableXTokenWithIncentive(SwapState state, uint256 _newCollateralRatio, uint256 _incentiveRatio)
    returns (uint256 _maxBaseIn, uint256 _maxXTokenMintable)

    function maxRedeemableFToken(SwapState state, uint256 _newCollateralRatio)
    returns (uint256 _maxBaseOut, uint256 _maxFTokenRedeemable)

    function maxRedeemableXToken(SwapState state, uint256 _newCollateralRatio)
    returns (uint256 _maxBaseOut, uint256 _maxXTokenRedeemable)

    function maxLiquidatable(SwapState state, uint256 _newCollateralRatio, uint256 _incentiveRatio)
    returns (uint256 _maxBaseOut, uint256 _maxFTokenLiquidatable)

    function mint(SwapState state, uint256 _baseIn)
    returns (uint256 _fTokenOut, uint256 _xTokenOut)

    function mintFToken(SwapState state, uint256 _baseIn)
    returns (uint256 _fTokenOut)

    function mintXToken(SwapState state, uint256 _baseIn)
    returns (uint256 _xTokenOut)

    function mintXToken(SwapState state, uint256 _baseIn, uint256 _incentiveRatio)
    returns (uint256 _xTokenOut, uint256 _fDeltaNav) {

    function redeem(SwapState state, uint256 _fTokenIn, uint256 _xTokenIn)
    returns (uint256 _baseOut)

    function liquidateWithIncentive(SwapState state, uint256 _fTokenIn, uint256 _incentiveRatio)
    returns (uint256 _baseOut, uint256 _fDeltaNav)
    */
  }
}
