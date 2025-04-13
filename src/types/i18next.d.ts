import { resources } from "../rest-server";

declare module "i18next" {
  interface CustomTypeOptions {
    resources: (typeof resources)["de"];
  }
}
