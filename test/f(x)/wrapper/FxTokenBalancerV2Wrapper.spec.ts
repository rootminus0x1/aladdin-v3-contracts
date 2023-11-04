/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { TOKENS } from "@/utils/tokens";
import { FxTokenBalancerV2Wrapper, MockERC20, WETH9 } from "@types";
// eslint-disable-next-line camelcase
import { createFork, impersonateAccounts } from "test/network";
import { AbiCoder, MaxUint256 } from "ethers";

const FORK_HEIGHT = 17796350;

const BALANCER_POOL_FACTORY = "0x8E9aa87E45e92bad84D5F8DD1bff34Fb92637dE9";
const BALANCER_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
const DEPLOYER = "0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf";

describe("FxTokenBalancerV2Wrapper.spec", async () => {
  let deployer: SignerWithAddress;

  let weth: WETH9;
  let wethAddress: string;
  let src: MockERC20;
  let srcAddress: string;
  let dst: MockERC20;
  let dstAddress: string;
  let wrapper: FxTokenBalancerV2Wrapper;
  let wrapperAddress: string;

  beforeEach(async () => {
    await createFork(FORK_HEIGHT);

    deployer = await ethers.getSigner(DEPLOYER);
    await impersonateAccounts([deployer.address]);

    weth = await ethers.getContractAt("WETH9", TOKENS.WETH.address, deployer);
    wethAddress = TOKENS.WETH.address;

    const balancer = await ethers.getContractAt("IBalancerVault", BALANCER_VAULT, deployer);
    const balancerAddress = BALANCER_VAULT;

    const factory = await ethers.getContractAt("IBalancerWeightedPoolFactory", BALANCER_POOL_FACTORY, deployer);

    const MockERC20 = await ethers.getContractFactory("MockERC20", deployer);
    src = await MockERC20.deploy("FX", "FX", 18);
    await src.waitForDeployment();
    srcAddress = await src.getAddress();

    const poolAddress = await factory.create.staticCall(
      "X",
      "Y",
      srcAddress.toLowerCase() < wethAddress.toLowerCase() ? [srcAddress, wethAddress] : [wethAddress, srcAddress],
      srcAddress.toLowerCase() < wethAddress.toLowerCase()
        ? [ethers.parseEther("0.80"), ethers.parseEther("0.20")]
        : [ethers.parseEther("0.20"), ethers.parseEther("0.80")],
      1e12,
      deployer.address,
    );
    await factory.create(
      "X",
      "Y",
      srcAddress.toLowerCase() < wethAddress.toLowerCase() ? [srcAddress, wethAddress] : [wethAddress, srcAddress],
      srcAddress.toLowerCase() < wethAddress.toLowerCase()
        ? [ethers.parseEther("0.80"), ethers.parseEther("0.20")]
        : [ethers.parseEther("0.20"), ethers.parseEther("0.80")],
      1e12,
      deployer.address,
    );
    dst = await ethers.getContractAt("MockERC20", poolAddress, deployer);
    dstAddress = poolAddress;
    const pool = await ethers.getContractAt("IBalancerPool", poolAddress, deployer);
    const poolId = await pool.getPoolId();

    await src.approve(balancerAddress, MaxUint256);
    await weth.approve(balancerAddress, MaxUint256);
    await src.mint(deployer.address, ethers.parseEther("80"));
    await weth.deposit({ value: ethers.parseEther("20") });
    await balancer.joinPool(poolId, deployer.address, deployer.address, {
      assets:
        srcAddress.toLowerCase() < wethAddress.toLowerCase() ? [srcAddress, wethAddress] : [wethAddress, srcAddress],
      maxAmountsIn: [MaxUint256, MaxUint256],
      userData: AbiCoder.defaultAbiCoder().encode(
        ["uint8", "uint256[]"],
        [
          0,
          srcAddress.toLowerCase() < wethAddress.toLowerCase()
            ? [ethers.parseEther("80"), ethers.parseEther("20")]
            : [ethers.parseEther("20"), ethers.parseEther("80")],
        ],
      ),
      fromInternalBalance: false,
    });

    const FxTokenBalancerV2Wrapper = await ethers.getContractFactory("FxTokenBalancerV2Wrapper", deployer);
    wrapper = await FxTokenBalancerV2Wrapper.deploy(srcAddress, dstAddress);
    await wrapper.waitForDeployment();
    wrapperAddress = await wrapper.getAddress();
  });

  it("should succeed when wrap", async () => {
    await src.mint(wrapperAddress, ethers.parseEther("10"));
    const before = await dst.balanceOf(deployer.address);
    await wrapper.wrap(ethers.parseEther("10"));
    const after = await dst.balanceOf(deployer.address);
    expect(after).to.gt(before);
  });

  it("should succeed when unwrap", async () => {
    await dst.transfer(wrapperAddress, ethers.parseEther("1"));
    const before = await src.balanceOf(deployer.address);
    await wrapper.unwrap(ethers.parseEther("1"));
    const after = await src.balanceOf(deployer.address);
    expect(after).to.gt(before);
  });

  it("should fail when wrap with insufficient balance", async () => {
    await expect(wrapper.wrap(ethers.parseEther("100"))).to.be.revertedWith("ERC20: transfer amount exceeds balance");
  });
});
