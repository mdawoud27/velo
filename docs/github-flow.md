# GitHub Flow & Collaboration Guidelines

This document outlines the standard Git and GitHub workflow for the Velo project repository.

---

## 1. Create an Issue (optional)

```bash
WITH ANY FORMAT

# Examples
[FIX]: Fix auth flow
Implement CV upload
```

## 2. Branching Strategy

We follow a modified GitHub Flow centered around standard feature branches and main production environment integration:

- **`main`**: Production-ready code. Always stable and deployable.
- **`dev`**: Active integration branch for feature development.
- **`feat/<feature-name>`**: Feature branches for new functionality (e.g. `feat/auth-2fa`, `feat/bulk-invites`).
- **`fix/<bug-name>`**: Bug fix branches (e.g. `fix/project-authorization-gap`).
- **`refactor/<topic>`**: Code cleanup and structural improvements.

---

## 3. Commit Message Conventions

Commit messages MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat: <short description>` for new feature or capability
- `fix: <short description>` for bug fix or error correction
- `docs: <short description>` for documentation updates
- `refactor: <short description>` for code changes that neither fix a bug nor add a feature
- `test: <short description>` for adding or updating test cases
- `chore: <short description>` for build scripts, tooling, or dependency updates

Available commit types:

| Type       | When to use                                         |
| ---------- | --------------------------------------------------- |
| `feat`     | New feature                                         |
| `fix`      | Bug fix                                             |
| `docs`     | Documentation only                                  |
| `chore`    | Maintenance tasks (e.g. updating dependencies)      |
| `style`    | Code style changes (formatting, missing semicolons) |
| `refactor` | Code restructuring without changing behaviour       |
| `test`     | Adding or updating tests                            |
| `build`    | Changes to build scripts or dependencies            |
| `perf`     | Performance improvements                            |
| `ci`       | CI/CD configuration changes                         |
| `revert`   | Reverting a previous commit                         |

**Example:**

```bash
git commit -m "feat: add 2FA TOTP verification and backup codes"
```

---

## 4. Pull Request (PR) Workflow

1. **Create a Topic Branch**:

   ```bash
   git switch -c feat/my-enhancement
   ```

   **If we create a branch from an issue we should add the issue number and we should fetch the branch first**

   ```bash
   git fetch origin
   git switch feat/<issue-number>/<branch-name>
   ```

2. **Commit and Push**:

   ```bash
   git add .
   git commit -m "feat: implement my enhancement"
   git push origin feat/<issue-number>/<branch-name>
   ```

3. **Open Pull Request**:
   - PR title must start with a valid prefix (`feat`, `fix`, `build`, `chore`, `refactor`, `docs`, `perf`, `test`) followed by a colon and a space and must end with a user story ID (e.g., " - [AUTH-01]")
   - Use `.github/PULL_REQUEST_TEMPLATE.md` to format your pull request.
   - Specify issue reference or task code (e.g., `Closes #123`).
   - Describe changes made and testing verification steps.

4. **CI/CD Checks**:
   - Pre-push hooks (`husky`), linting (`eslint`), and automated tests must pass.
   - At least one code review approval is required before merging into `dev` / `main`.

---

## 5. Release Tagging

Tag releases using Semantic Versioning (`vX.Y.Z`):

```bash
git tag -a v0.11.0 -m "Release v0.11.0"
git push origin v0.11.0
```
