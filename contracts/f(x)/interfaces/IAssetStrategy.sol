// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IAssetStrategy {
  /// @notice Withdraw assets from strategy to treasury.
  /// @param amount The amount of token to withdraw.
  function withdrawToTreasury(uint256 amount) external;
}
