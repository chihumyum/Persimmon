import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";

import {
  loadAppLanguagePreference,
  saveAppLanguagePreference,
} from "./language-preference";
import type { AppLanguagePreference } from "./locale";
import { syncAppLanguage } from "./system-language";

void syncAppLanguage("system");

export interface AppLanguageState {
  readonly languagePreference: AppLanguagePreference;
  readonly languageReady: boolean;
  readonly setLanguagePreference: (
    preference: AppLanguagePreference,
  ) => Promise<void>;
}

export function useAppLanguage(): AppLanguageState {
  useTranslation();
  const [languagePreference, setLanguagePreferenceState] =
    useState<AppLanguagePreference>("system");
  const [languageReady, setLanguageReady] = useState(false);
  const preferenceRef = useRef<AppLanguagePreference>("system");
  const changeRevisionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      let preference: AppLanguagePreference = "system";
      try {
        preference = await loadAppLanguagePreference();
      } catch {
        // AsyncStorage can be unavailable during recovery. System language is
        // a safe session-only fallback and does not block app startup.
      }
      if (cancelled) {
        return;
      }
      preferenceRef.current = preference;
      setLanguagePreferenceState(preference);
      try {
        await syncAppLanguage(preference);
      } catch {
        // Translation resources are bundled. If initialization still fails,
        // keep the fallback locale and allow the rest of the app to start.
      } finally {
        if (!cancelled) {
          setLanguageReady(true);
        }
      }
    };

    void hydrate();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncAppLanguage(preferenceRef.current);
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const setLanguagePreference = useCallback(
    async (preference: AppLanguagePreference) => {
      const previous = preferenceRef.current;
      if (preference === previous) {
        await syncAppLanguage(preference);
        return;
      }

      const revision = changeRevisionRef.current + 1;
      changeRevisionRef.current = revision;
      preferenceRef.current = preference;
      setLanguagePreferenceState(preference);

      try {
        await syncAppLanguage(preference);
        await saveAppLanguagePreference(preference);
      } catch (error) {
        if (changeRevisionRef.current === revision) {
          preferenceRef.current = previous;
          setLanguagePreferenceState(previous);
          try {
            await syncAppLanguage(previous);
          } catch {
            // Preserve the original persistence or language-change failure.
          }
        }
        throw error;
      }
    },
    [],
  );

  return { languagePreference, languageReady, setLanguagePreference };
}
