// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface ILidoStETH {
  function submit(address _referral) external payable returns (uint256);
}
