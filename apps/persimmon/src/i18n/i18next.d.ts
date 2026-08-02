import "i18next";

import type { zhHans } from "./locales/zh-Hans";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    returnNull: false;
    resources: {
      translation: typeof zhHans;
    };
  }
}
