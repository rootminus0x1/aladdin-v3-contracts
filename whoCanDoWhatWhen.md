# Introduction

There are two kinds of constraints operated in the f(x) world:

- who the caller is
- what the various parameterisations for enabling stability constraints and incentives

## Who the caller is

The caller can be:

- **admin of `Market`**
- **liquidator of `RebalancePool`**
- **owner of `RebalancePool`**

## Stability parameterisation

These are captured in the `Market` and `RebalancePool` contracts.

There are three kinds of stability maintenance.

Firstly, whether something is paused or not (`Market` contract):

- **minting** - set by the `pauseMint(boolean)` call
- **redeeming** - set by the `pauseRedeem(boolean)` call
- **minting f tokens in system stability mode** - set by `pauseFTokenMintInSystemStabilityMode(boolean)` call
- **redeeming x tokens in system stability mode** - set by `redeemXTokenMintInSystemStabilityMode(boolean)` call

Secondly, what the collateral ratio is.

In f(x) there are 4 levels containted in the market config in the `Market` contract:

- **stability ratio**, the start collateral ratio to enter **system stability mode**, e.g. 130%
- **liquidation ratio**, the start collateral ratio to enter **incentivized user liquidation mode**, e.g. 120%
- **self liquidation ratio**, the start collateral ratio to enter **self liquidation mode**, e.g. 114%
- **recapitalisation ratio**, the start collateral ratio to enter **recapitalisation mode**, e.g. 100%

these are changed by a call to the `Market` contracts `updateMarketConfig()` call and must be in strict decending order.

in the `RebalancePool` there is:

- **liquidatable collateral ratio**, the maximum collateral ratio to call liquidate

Lastly, there are the incentives

- **stability incentive ratio**, the incentive ratio for system stability mode to update, e.g. 30%, must be greater than 0
- **liquidation incentive ratio**, the incentive ratio for incentivised user liquidation mode to update, e.g. 20%, must not be less than **self liquidation incentive ratio**
- **self liquidation incentive ratio**, the incentive ratio for self liquidation mode to update, e.g. 10%, must be greater than 0. (this doesn't appear to be used directly, other than setting a lower bound to the **liquidation incentive ratio**)

# `Market` contract

## `Market.mintFToken()`

anyone can call this but

- requires **minting** not paused
- altered by **minting f tokens in system stability mode** TODO: in what way?
- altered by **stability ratio**, limiting the amount of base tokens that can be converted to f tokens to the maximum before the collateral ratio would exceed the **stability ratio**.

## `Market.mintXToken()`

anyone can call this but

- requires **minting** not paused
- altered by **stability ratio** and **stability incentive ratio**, limiting the amount of base tokens that can be converted to x tokens to the maximum before the collateral ratio would exceed the **stability ratio**. TODO: how can this limit the xToken minting, as x tokens only reduce collateral ratio?

## `Market.addBaseToken()`

anyone can call this but

- requires **minting** not paused
- altered by **stability ratio** and **stability incentive ratio**, limiting the amount of base tokens that can be converted to x tokens to the maximum before the collateral ratio would exceed the **stability ratio**. TODO: how can this limit the xToken minting, as x tokens only reduce collateral ratio?

## `Market.redeem()`

anyone can call this but

- requires **redeeming** not paused
- altered by altered by **redeeming x tokens in system stability mode** when redeeming x tokens TODO: in what way?
- altered by **stability ratio**, limiting the amount of f or x tokens (only one type can be redeemed at a time) that can be converted to base tokens to the maximum before the collateral ratio would exceed the **stability ratio**.

## `Market.liquidate()`

anyone can call this but

- requires **redeeming** not paused
- requires **recapitalisation ratio** <= collateral ratio < **liquidation ratio**
- altered by **self liquidation incentive ratio**, limiting the amount of f tokens that can be liquidated before the collateral ratio would exceed the **liquidation ratio**.

## `Market.updateMarketConfig()`

caller must be **admin of `Market`**

## `Market.updateIncentiveConfig()`

caller must be **admin of `Market`**

# `RebalancePool` contract

## `RebalancePool.liquidate()`

caller must be **liquidator** and

- requires collateral ration < **liquidatable collateral ratio**

## `RebalancePool.updateLiquidator()`

caller must be **owner of `RebalancePool`**

## `RebalancePool.updateLiquidatableCollateralRatio()`

caller must be **owner of `RebalancePool`**

# ReservePool

TODO: write up the fees (in another file)
