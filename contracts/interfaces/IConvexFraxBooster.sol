// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IConvexFraxBooster {
  function createVault(uint256 _pid) external returns (address);
}
