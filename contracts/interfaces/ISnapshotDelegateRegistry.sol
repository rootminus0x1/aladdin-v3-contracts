// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface ISnapshotDelegateRegistry {
  function setDelegate(bytes32 id, address delegate) external;
}
