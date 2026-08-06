import type { ReaderTheme } from "@persimmon/reader-skia";
import { Children, Fragment, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { uiRadius, uiSize } from "./ui-tokens";

export function SettingsCard({
  children,
  theme,
}: {
  readonly children: ReactNode;
  readonly theme: ReaderTheme;
}) {
  const rows = Children.toArray(children);
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.panelRaised,
          borderColor: theme.border,
        },
      ]}
    >
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
          ) : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: uiRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: uiSize.dividerHorizontalInset,
  },
});
