# Contributing

Thanks for wanting to contribute! This guide walks you through the whole process, from picking an issue to getting your pull request merged.

## 1. Pick an issue

- Browse the [open issues](../../issues).
- Comment on the issue to say you'd like to work on it, and **wait to be assigned** before starting. This avoids two people working on the same thing.
- If you want to work on something that has no issue yet, open one first so we can discuss it.

## 2. Set up the project

Fork the repository on GitHub, then clone your fork and add the original repo as `upstream`:

```bash
# pwd: the folder where you keep your projects
git clone https://github.com/<your-username>/jeu-de-piste-2026.git
cd jeu-de-piste-2026

# pwd: jeu-de-piste-2026/
git remote add upstream https://github.com/ehosta/jeu-de-piste-2026.git
```

Then follow the setup steps in the [README](README.md) to install dependencies and run the project locally.

## 3. Work on your branch

Create one branch per issue, starting from an up-to-date `main`:

```bash
# pwd: jeu-de-piste-2026/
git fetch upstream
git checkout -b <type>/<issue-number>-<short-description> upstream/main
```

Branch name examples:

- `feat/12-add-hint-system`
- `fix/34-timer-reset`
- `docs/40-update-setup-guide`

Keep your changes focused on the issue. If you spot something unrelated that needs fixing, open a separate issue.

## 4. Stay up to date with `main`

Before opening your PR, and whenever `main` moves on while your PR is open, **rebase** your branch on `upstream/main`:

```bash
# pwd: jeu-de-piste-2026/
git fetch upstream
git rebase upstream/main
```

If there are conflicts, Git stops at each conflicting commit. Fix the files, then:

```bash
# pwd: jeu-de-piste-2026/
git add <fixed-files>
git rebase --continue
```

(`git rebase --abort` brings you back to where you were if things go wrong.)

Since rebasing rewrites your commits, push with:

```bash
# pwd: <repo>/
git push --force-with-lease
```

Use `--force-with-lease`, never plain `--force`: it refuses to overwrite commits on the remote that you don't have locally.

## 5. Open your pull request

- Open the PR from your branch to `main` of the original repository.
- Fill in the PR template: link the issue (`Closes #12`), describe what changed, and **explain how you tested it**.
- Make sure there are no conflicts and that tests pass.

A PR without testing details will be asked for them before review.

## 6. Review

- A maintainer will review your PR. Be patient, everyone here is a student too.
- To address feedback, push new commits to the same branch. Don't open a new PR.
- Once approved and up to date with `main`, your PR will be merged. 🎉

## Questions?

If you're stuck at any step, ask in the issue or in your PR. There are no stupid questions.
