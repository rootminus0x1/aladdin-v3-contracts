// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract MockERC20 is ERC20 {
  // switch logging on and off at runtime
  bool public logging = false;

  function setLogging(bool newValue) external returns (bool oldValue) {
    oldValue = logging;
    logging = newValue;
  }

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals
  ) ERC20(_name, _symbol) {
    _setupDecimals(_decimals);
  }

  // expose the mint functionality for external tweeking
  function mint(address _recipient, uint256 _amount) external {
    _mint(_recipient, _amount);
  }

  // log mint(0, x), burns(x, 0) & transfers(x, y)
  function _beforeTokenTransfer(address from, address to, uint256 amount) internal view override {
    if (logging) {
      console.log("%s:", msg.sender);
      console.log("  MockERC20._beforeTokenTransfer(%s, %s, %s)", from, to, amount);
    }
  }

  // log approvals
  function approve(address spender, uint256 amount) public virtual override returns (bool) {
    if (logging) {
      console.log("%s:", msg.sender);
      console.log("  MockERC20.approve(%s, %s)", spender, amount);
    }
    _approve(_msgSender(), spender, amount);
    return true;
  }

}
