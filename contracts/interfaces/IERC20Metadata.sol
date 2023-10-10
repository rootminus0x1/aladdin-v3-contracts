// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IERC20Metadata {
  function decimals() external view returns (uint8);

  function symbol() external view returns (string memory);

  function name() external view returns (string memory);
}
