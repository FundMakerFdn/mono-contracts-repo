import { IJsFixConfig, ISessionDescription } from "jspurefix";

export interface IExtendedFixConfig extends IJsFixConfig {
  description: ISessionDescription & {
    walletId?: number;
  };
}
