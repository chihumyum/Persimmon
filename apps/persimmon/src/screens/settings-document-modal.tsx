import { Column, Host, ScrollView, Text } from "@expo/ui";
import type { ReaderTheme } from "@persimmon/reader-skia";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { LegalDocument } from "../legal/legal-content";

export function SettingsDocumentSurface({
  document,
  theme,
}: {
  readonly document: LegalDocument;
  readonly theme: ReaderTheme;
}) {
  const [viewportHeight, setViewportHeight] = useState(0);

  return (
    <View
      style={styles.viewport}
      onLayout={({ nativeEvent }) => {
        const nextHeight = Math.round(nativeEvent.layout.height);
        setViewportHeight((currentHeight) =>
          currentHeight === nextHeight ? currentHeight : nextHeight,
        );
      }}
    >
      {viewportHeight > 0 ? (
        <Host
          colorScheme={theme.colorScheme}
          seedColor={theme.accent}
          style={{ height: viewportHeight, width: "100%" }}
          useViewportSizeMeasurement
        >
          <ScrollView
            showsIndicators={false}
            style={{
              backgroundColor: theme.panel,
              height: viewportHeight,
              paddingBottom: 32,
              paddingHorizontal: 22,
              paddingTop: 14,
            }}
          >
            <Column spacing={20}>
              {document.updatedAt ? (
                <Text
                  textStyle={{
                    color: theme.secondaryText,
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  {document.updatedAt}
                </Text>
              ) : null}
              <Text
                textStyle={{
                  color: theme.controlText,
                  fontSize: 16,
                  lineHeight: 25,
                }}
              >
                {document.intro}
              </Text>
              {document.sections.map((section) => (
                <Column key={section.heading} spacing={10}>
                  <Text
                    textStyle={{
                      color: theme.text,
                      fontSize: 19,
                      fontWeight: "700",
                      lineHeight: 25,
                    }}
                  >
                    {section.heading}
                  </Text>
                  {section.paragraphs?.map((paragraph) => (
                    <Text
                      key={paragraph}
                      textStyle={{
                        color: theme.controlText,
                        fontSize: 16,
                        lineHeight: 25,
                      }}
                    >
                      {paragraph}
                    </Text>
                  ))}
                  {section.items?.map((item) => (
                    <Text
                      key={item}
                      textStyle={{
                        color: theme.controlText,
                        fontSize: 16,
                        lineHeight: 25,
                      }}
                    >
                      {`•  ${item}`}
                    </Text>
                  ))}
                </Column>
              ))}
            </Column>
          </ScrollView>
        </Host>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, width: "100%" },
});
