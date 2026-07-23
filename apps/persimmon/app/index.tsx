import { StatusBar, StyleSheet, Text, View } from "react-native";

export default function Page() {
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mark}>
        <Text style={styles.markText}>柿</Text>
      </View>
      <Text style={styles.title}>Persimmon</Text>
      <Text style={styles.subtitle}>一本轻快、安静的 EPUB 阅读器</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: "#f7f1e8",
    flex: 1,
    justifyContent: "center",
  },
  mark: {
    alignItems: "center",
    backgroundColor: "#e85d2a",
    borderRadius: 28,
    height: 88,
    justifyContent: "center",
    marginBottom: 24,
    width: 88,
  },
  markText: {
    color: "#fffaf2",
    fontSize: 44,
    fontWeight: "700",
  },
  title: {
    color: "#2d2924",
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -1,
  },
  subtitle: {
    color: "#746b61",
    fontSize: 16,
    marginTop: 10,
  },
});
