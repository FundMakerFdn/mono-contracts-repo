import { SessionLauncher as BaseLauncher, IJsFixConfig } from "jspurefix";
import { IExtendedFixConfig } from "./types";
import { EngineFactory } from "jspurefix";

export abstract class SessionLauncher extends BaseLauncher {
  protected abstract makeFactory(config: IJsFixConfig): EngineFactory;
}
