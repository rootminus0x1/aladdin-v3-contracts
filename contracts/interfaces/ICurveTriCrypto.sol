// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

// solhint-disable var-name-mixedcase, func-name-mixedcase
interface ICurveTriCrypto {
  function exchange(
    uint256 i,
    uint256 j,
    uint256 dx,
    uint256 min_dy,
    bool use_eth
  ) external;

  function get_dy(
    uint256 i,
    uint256 j,
    uint256 dx
  ) external view returns (uint256);

  function coins(uint256 index) external returns (address);

  function price_oracle(uint256 k) external view returns (uint256);
}
