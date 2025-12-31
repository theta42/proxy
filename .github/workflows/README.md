# CI/CD Workflows

## Pull Request Testing

The `pr-tests.yml` workflow automatically runs on every pull request to the `master` branch.

### What it does:

1. **Multi-version testing**: Tests run on Node.js 18.x, 20.x, and 22.x
2. **Comprehensive coverage**: Runs unit tests, integration tests, and full test suite
3. **Blocks merging**: PRs cannot be merged until all tests pass on all Node versions

### Workflow triggers:

- Opening a pull request to `master`
- Pushing new commits to an existing PR
- Updates to PR branches

### Test jobs:

1. **Unit tests** - Tests isolated components (callback queue, host lookup, unix socket)
2. **Integration tests** - Tests DNS provider contracts
3. **Full test suite** - Complete test coverage

### Branch protection:

The `master` branch is protected and requires:
- All tests must pass before merging
- Status check: `test` job must succeed
- Applies to all contributors (admins can override)

## Running tests locally:

Before creating a PR, run tests locally to catch issues early:

```bash
cd nodejs
npm run test:unit         # Run unit tests only
npm run test:integration  # Run integration tests only
npm test                  # Run all tests
npm run test:watch        # Watch mode for development
```

## Adding new workflows:

To add new CI/CD workflows:

1. Create a new `.yml` file in `.github/workflows/`
2. Define triggers, jobs, and steps
3. Test the workflow by creating a PR
4. Add status check to branch protection if required for merging

## Troubleshooting:

**Tests pass locally but fail in CI:**
- Check Node.js version compatibility (workflow tests 18.x, 20.x, 22.x)
- Verify all dependencies are in package.json (not installed globally)
- Check for environment-specific issues (paths, permissions)

**Branch protection preventing merge:**
- Ensure all required status checks pass
- Check workflow logs for detailed error messages
- Re-run failed jobs if transient failures occurred

**Modifying branch protection:**

```bash
# View current protection settings
gh api repos/theta42/proxy/branches/master/protection

# Update required status checks
gh api repos/theta42/proxy/branches/master/protection \
  -X PUT \
  -F required_status_checks[contexts][]=test \
  -F required_status_checks[contexts][]=your-new-check
```

## Workflow status:

View workflow runs and status:
- GitHub UI: https://github.com/theta42/proxy/actions
- CLI: `gh run list`
- PR checks: Automatically shown on PR page
