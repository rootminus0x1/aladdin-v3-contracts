// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;

import { IFxPriceOracle } from "contracts/f(x)/interfaces/IFxPriceOracle.sol";

contract MockFxPriceOracle is IFxPriceOracle {
  uint256 public price;

  function setPrice(uint256 _price) external {
    price = _price;
  }

  function getPrice()
    external
    view
    override
    returns (bool isValid, uint256 _safePrice, uint256 _minUnsafePrice, uint256 _maxUnsafePrice)
  {
    isValid = true;
    _safePrice = price;
    _minUnsafePrice = price;
    _maxUnsafePrice = price;
  }
}
