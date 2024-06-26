export interface ConcentratorStakeDAODeployment {
  StakeDAOLockerProxy: {
    proxy: string;
    implementation: string;
  };
  VeSDTDelegation: {
    proxy: string;
    implementation: string;
  };
  StakeDAOCRVVault: {
    proxy: string;
    implementation: string;
  };
  AladdinSdCRV: {
    proxy: string;
    implementation: string;
  };
  ConcentratorVault: {
    proxy: string;
    implementation: string;
  };
  SdCRVBribeBurner: string;
}
