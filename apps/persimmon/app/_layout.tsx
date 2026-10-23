import { Slot } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DuoLayoutProvider } from "../modules/persimmon-duo-layout";

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DuoLayoutProvider>
          <Slot />
        </DuoLayoutProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
