// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IRebalancePool } from "../interfaces/IRebalancePool.sol";

contract RebalanceWithBonusToken is Ownable {
  using SafeERC20 for IERC20;

  address public immutable stabilityPool;

  address public immutable bonusToken;

  uint256 public bonus;

  constructor(address _stabilityPool, address _bonusToken) Ownable(_msgSender()){
    stabilityPool = _stabilityPool;
    bonusToken = _bonusToken;
  }

  function liquidate(uint256 _minBaseOut) external {
    IRebalancePool(stabilityPool).liquidate(type(uint256).max, _minBaseOut);

    IERC20(bonusToken).safeTransfer(_msgSender(), bonus);
  }

  function updateBonus(uint256 _bonus) external onlyOwner {
    bonus = _bonus;
  }
}
