export interface PreparedReaderFont<Provider> {
  readonly fontProvider: Provider;
  readonly fontFamily: string;
  readonly providerKey: string;
  readonly bookFontFamilyNames?: Readonly<Record<string, string>>;
  readonly error?: string;
}

interface ReaderFontTransitionInput<Provider> {
  readonly prepared?: PreparedReaderFont<Provider>;
  readonly previous?: PreparedReaderFont<Provider>;
  readonly fallback?: PreparedReaderFont<Provider>;
  readonly loading: boolean;
}

export interface ReaderFontTransition<Provider> {
  readonly active?: PreparedReaderFont<Provider>;
  readonly loading: boolean;
  readonly error?: string;
}

export function resolveReaderFontTransition<Provider>({
  prepared,
  previous,
  fallback,
  loading,
}: ReaderFontTransitionInput<Provider>): ReaderFontTransition<Provider> {
  const active = prepared ?? previous ?? fallback;
  return {
    ...(active ? { active } : {}),
    loading,
    ...(!loading && prepared?.error ? { error: prepared.error } : {}),
  };
}
