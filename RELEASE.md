# Release Process

This document describes the release process for TokenForge.

## Semantic Versioning

We follow [Semantic Versioning](https://semver.org/) (SemVer):

- **MAJOR** version (1.0.0 → 2.0.0): Incompatible API changes
- **MINOR** version (1.0.0 → 1.1.0): New functionality in a backwards compatible manner
- **PATCH** version (1.0.0 → 1.0.1): Backwards compatible bug fixes

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature (triggers MINOR release)
- `fix:` Bug fix (triggers PATCH release)
- `docs:` Documentation only changes
- `style:` Code style changes (formatting, etc)
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Adding or updating tests
- `build:` Build system changes
- `ci:` CI configuration changes
- `chore:` Other changes that don't modify src or test files

**Breaking changes**: Add `BREAKING CHANGE:` in the commit body or `!` after the type (triggers MAJOR release)

## Release Commands

```bash
# Automatic versioning based on commits
npm run release

# Manual version bumps
npm run release:patch  # 1.0.0 → 1.0.1
npm run release:minor  # 1.0.0 → 1.1.0
npm run release:major  # 1.0.0 → 2.0.0

# First release (if starting from 0.x.x)
npm run release:first
```

## Release Process

1. **Ensure all tests pass**
   ```bash
   npm run test:run
   npm run lint
   ```

2. **Create release**
   ```bash
   npm run release
   ```
   This will:
   - Analyze commits since last release
   - Bump version in package.json
   - Update CHANGELOG.md
   - Create a git commit and tag

3. **Push changes**
   ```bash
   git push --follow-tags origin main
   ```

4. **Create GitHub Release**
   - Go to GitHub releases page
   - Click "Create release from tag"
   - Copy the relevant section from CHANGELOG.md
   - Publish release

## Examples

### Feature Release
```bash
git commit -m "feat: add support for Polygon blockchain"
npm run release  # Bumps to 1.1.0
```

### Bug Fix Release
```bash
git commit -m "fix: correct gas estimation for BSC"
npm run release  # Bumps to 1.0.1
```

### Breaking Change
```bash
git commit -m "feat!: redesign token creation API

BREAKING CHANGE: The createToken function now requires a config object instead of individual parameters"
npm run release  # Bumps to 2.0.0
```

## Pre-release Versions

For alpha/beta releases:
```bash
npm run release -- --prerelease alpha  # 1.0.0 → 1.0.1-alpha.0
npm run release -- --prerelease beta   # 1.0.0 → 1.0.1-beta.0
```