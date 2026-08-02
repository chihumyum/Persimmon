import { useEffect } from "react";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";

import { syncSystemLanguage } from "./system-language";

void syncSystemLanguage();

export function useSystemLanguage(): void {
  useTranslation();

  useEffect(() => {
    void syncSystemLanguage();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncSystemLanguage();
      }
    });
    return () => subscription.remove();
  }, []);
}
