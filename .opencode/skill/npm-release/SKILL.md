---
name: npm-release
description: Release a new version to npm and GitHub. Use when the user wants to publish a release, bump version, or create a new npm package version. Triggers on "release", "publish to npm", "new version", "bump version".
---

# npm Release

## Workflow

1. **Ask for version bump type** using the question tool:
   - patch (0.0.x) - bug fixes
   - minor (0.x.0) - new features, backward compatible
   - major (x.0.0) - breaking changes

2. **Read current version** from package.json

3. **Calculate new version** based on bump type

4. **Update package.json** with new version

5. **Commit the version bump**:

   ```bash
   git add package.json
   git commit -m "chore: bump version to <new-version>"
   ```

6. **Create git tag**:

   ```bash
   git tag v<new-version>
   ```

7. **Ask for npm OTP** using the question tool (user selects "Other" to enter code)

8. **Build and publish to npm**:

   ```bash
   bun run build
   npm publish --otp <otp-code>
   ```

9. **Push commit and tag**:

   ```bash
   git push && git push --tags
   ```

10. **Generate release notes**:
    - Run `git log <previous-tag>..HEAD --oneline` to get commits since last release
    - Summarize the changes into human-readable release notes
    - Group by type (features, fixes, docs, etc.) if applicable
    - Keep it concise
    - For each commit/PR, include a link and the author:
      - For PRs: `#123 by @username`
      - For commits: `abc1234 by @username`
    - Get commit authors with: `git log <previous-tag>..HEAD --format="%h %s (%an)"`

11. **Create GitHub release**:

    ```bash
    gh release create v<new-version> --notes "<generated-notes>"
    ```

12. **Confirm success** and provide links to:
    - GitHub release page
    - npm package page
