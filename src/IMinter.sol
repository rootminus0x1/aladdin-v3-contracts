pragma solidity =0.8.25

interface IMinter {

    /**********
   * Events *
   **********/

  /// @notice Emitted when pToken is minted.
  /// @param owner The address of base token owner.
  /// @param recipient The address of receiver for pToken or lToken.
  /// @param baseTokenIn The amount of base token deposited.
  /// @param pTokenOut The amount of pToken minted.
  /// @param mintFee The amount of mint fee charged.
  event MintPToken(
    address indexed owner,
    address indexed recipient,
    uint256 baseTokenIn,
    uint256 pTokenOut,
    uint256 mintFee
  );

  /// @notice Emitted when lToken is minted.
  /// @param owner The address of base token owner.
  /// @param recipient The address of receiver for pToken or lToken.
  /// @param baseTokenIn The amount of base token deposited.
  /// @param lTokenOut The amount of lToken minted.
  /// @param bonus The amount of base token as bonus.
  /// @param mintFee The amount of mint fee charged.
  event MintLToken(
    address indexed owner,
    address indexed recipient,
    uint256 baseTokenIn,
    uint256 lTokenOut,
    uint256 bonus,
    uint256 mintFee
  );

  /// @notice Emitted when someone redeem base token with pToken or lToken.
  /// @param owner The address of pToken and lToken owner.
  /// @param recipient The address of receiver for base token.
  /// @param pTokenBurned The amount of pToken burned.
  /// @param baseTokenOut The amount of base token redeemed.
  /// @param bonus The amount of base token as bonus.
  /// @param redeemFee The amount of redeem fee charged.
  event RedeemPToken(
    address indexed owner,
    address indexed recipient,
    uint256 pTokenBurned,
    uint256 baseTokenOut,
    uint256 bonus,
    uint256 redeemFee
  );

  /// @notice Emitted when someone redeem base token with pToken or lToken.
  /// @param owner The address of pToken and lToken owner.
  /// @param recipient The address of receiver for base token.
  /// @param lTokenBurned The amount of lToken burned.
  /// @param baseTokenOut The amount of base token redeemed.
  /// @param redeemFee The amount of redeem fee charged.
  event RedeemLToken(
    address indexed owner,
    address indexed recipient,
    uint256 lTokenBurned,
    uint256 baseTokenOut,
    uint256 redeemFee
  );

  /**********
   * Errors *
   **********/


  /*************************
   * Public View Functions *
   *************************/

  /// @notice Return the address of the collateral (base) token
  function collateralToken() external view returns (address);

  /// @notice Return the address of the pegged token.
  function pToken() external view returns (address);

  /// @notice Return the address of the leveraged token.
  function lToken() external view returns (address);

  /// @notice Return the current collateral ratio of the pToken to the collateral token, multipled by 1e18.
  function collateralRatio() external view returns (uint256);

  /// @notice Mint pToken with some collateral token.
  /// @param baseIn The amount of underlying value of base token deposited. use `uint256(-1)` to supply all base token.
  /// @param recipient The address of receiver.
  /// @return pTokenOut The amount of pToken minted.
  function mintPToken(uint256 baseIn, address recipient, uint256 minPTokenMinted) external returns (uint256 pTokenOut);

  /// @notice Mint lToken with some base token.
  /// @param baseIn The amount of underlying value of base token deposited.
  /// @param recipient The address of receiver.
  /// @return lTokenOut The amount of lToken minted.
  function mintLToken(uint256 baseIn, address recipient) external returns (uint256 lTokenOut);

  /// @notice Redeem pToken and lToken to base tokne.
  /// @param pTokenIn The amount of pToken to redeem.
  /// @param lTokenIn The amount of lToken to redeem.
  /// @param owner The owner of the pToken or lToken.
  /// @param baseOut The amount of underlying value of base token redeemed.

/****************************
   * Public Mutated Functions *
   ****************************/

  /// @notice Mint some fToken with some base token.
  /// @param baseIn The amount of wrapped value of base token supplied, use `uint256(-1)` to supply all base token.
  /// @param recipient The address of receiver for fToken.
  /// @param minFTokenMinted The minimum amount of fToken should be received.
  /// @return fTokenMinted The amount of fToken should be received.
  function mintPToken(
    uint256 baseIn,
    address recipient,
    uint256 minFTokenMinted
  ) external returns (uint256 fTokenMinted);

  /// @notice Mint some lToken with some base token.
  /// @param baseIn The amount of wrapped value of base token supplied, use `uint256(-1)` to supply all base token.
  /// @param recipient The address of receiver for lToken.
  /// @param minXTokenMinted The minimum amount of lToken should be received.
  /// @return lTokenMinted The amount of lToken should be received.
  /// @return bonus The amount of wrapped value of base token as bonus.
  function mintLToken(
    uint256 baseIn,
    address recipient,
    uint256 minXTokenMinted
  ) external returns (uint256 lTokenMinted, uint256 bonus);

  /// @notice Redeem base token with fToken.
  /// @param fTokenIn the amount of fToken to redeem, use `uint256(-1)` to redeem all fToken.
  /// @param recipient The address of receiver for base token.
  /// @param minBaseOut The minimum amount of wrapped value of base token should be received.
  /// @return baseOut The amount of wrapped value of base token should be received.
  /// @return bonus The amount of wrapped value of base token as bonus.
  function redeemPToken(
    uint256 fTokenIn,
    address recipient,
    uint256 minBaseOut
  ) external returns (uint256 baseOut, uint256 bonus);

  /// @notice Redeem base token with lToken.
  /// @param lTokenIn the amount of lToken to redeem, use `uint256(-1)` to redeem all lToken.
  /// @param recipient The address of receiver for base token.
  /// @param minBaseOut The minimum amount of wrapped value of base token should be received.
  /// @return baseOut The amount of wrapped value of base token should be received.
  function redeemLToken(
    uint256 lTokenIn,
    address recipient,
    uint256 minBaseOut
  ) external returns (uint256 baseOut);
}
