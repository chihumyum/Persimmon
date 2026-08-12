# Page-turn library integration

Persimmon consumes the private `chihumyum/react-native-skia-page-turn`
repository as a pinned Git submodule. The public-package boundary is the source
of truth for normalized paper geometry, gesture worklets, Skia mesh rendering,
shaders, and generic page surface contracts.

The private Persimmon repository continues to own EPUB parsing and pagination,
page capture and caching, scheduling, the native pager compositor, and the
patched React Native Skia backend.

## Clone setup

Initialize the library after cloning Persimmon:

```bash
git submodule update --init
pnpm install --frozen-lockfile
```

The submodule is pinned to a reviewed commit. Do not configure it to follow a
moving branch during application builds.

## Updating the library

Develop and verify changes in the library repository first:

```bash
cd vendor/react-native-skia-page-turn
git switch main
git pull --ff-only
pnpm check
```

After pushing the library commit, return to Persimmon, stage the updated
submodule pointer together with any integration changes, and run `pnpm verify`.

## Legacy rollback copy

`packages/page-turn-core` remains in this integration branch as an unreferenced
rollback copy. `@persimmon/reader-skia` does not depend on it: all runtime core
imports resolve to `@chihumyum/page-turn-core`, and the fallback Skia mesh/frame
path resolves to `@chihumyum/react-native-skia-page-turn`.

Remove the legacy package only after remote installation acceptance and a
separate explicit cleanup decision.

## CI access

The new repository has a read-only deploy key named
`Persimmon Actions read-only`. Its private half is stored only as the
`PAGE_TURN_DEPLOY_KEY` Actions secret in the Persimmon repository. The Verify
and Android APK publishing workflows use it only while initializing this
submodule.
