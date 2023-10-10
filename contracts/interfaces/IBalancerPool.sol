// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IBalancerPool {
  function getPoolId() external view returns (bytes32);
}
