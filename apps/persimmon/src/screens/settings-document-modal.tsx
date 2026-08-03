import type { ReaderTheme } from "@persimmon/reader-skia";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { UiButton } from "../components/ui-button";
import { UiModalSurface } from "../components/ui-modal-surface";
import { UiText as Text } from "../components/ui-text";
import { uiSpace } from "../components/ui-tokens";
import type { LegalDocument } from "../legal/legal-content";

export function SettingsDocumentSurface({
  document,
  theme,
  onClose,
}: {
  readonly document: LegalDocument;
  readonly theme: ReaderTheme;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <UiModalSurface maxHeight="92%" maxWidth={620} theme={theme}>
      <View style={styles.header}>
        <Text variant="modalTitle" style={{ color: theme.text }}>
          {document.title}
        </Text>
        <UiButton
          compact
          label={t("common.done")}
          onPress={onClose}
          textTone="accent"
          theme={theme}
          variant="ghost"
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        scrollsChildToFocus={false}
        showsVerticalScrollIndicator={false}
      >
        {document.updatedAt ? (
          <Text
            selectable
            style={[styles.updatedAt, { color: theme.secondaryText }]}
          >
            {document.updatedAt}
          </Text>
        ) : null}
        <Text selectable style={[styles.intro, { color: theme.controlText }]}>
          {document.intro}
        </Text>
        {document.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text
              selectable
              style={[styles.sectionTitle, { color: theme.text }]}
            >
              {section.heading}
            </Text>
            {section.paragraphs?.map((paragraph) => (
              <Text
                key={paragraph}
                selectable
                style={[styles.body, { color: theme.controlText }]}
              >
                {paragraph}
              </Text>
            ))}
            {section.items?.map((item) => (
              <View key={item} style={styles.itemRow}>
                <Text style={[styles.bullet, { color: theme.accentStrong }]}>
                  •
                </Text>
                <Text
                  selectable
                  style={[styles.item, { color: theme.controlText }]}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </UiModalSurface>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 13,
    lineHeight: 21,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 21,
    width: 12,
  },
  content: {
    gap: uiSpace.lg,
    paddingBottom: 6,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: uiSpace.lg,
  },
  intro: {
    fontSize: 13,
    lineHeight: 21,
  },
  item: {
    flex: 1,
    fontSize: 13,
    lineHeight: 21,
  },
  itemRow: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  updatedAt: {
    fontSize: 11,
    lineHeight: 16,
  },
});
