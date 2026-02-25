# Contributing to Coltivio API

Thank you for your interest in contributing! Coltivio is a nonprofit open-source farm management platform.

## Getting started

1. Fork the repository
2. Follow the setup instructions in [README.md](README.md)
3. Create a feature branch from `main`

## Development workflow

```bash
yarn start              # start dev server
yarn test               # run all tests
npx tsc --noEmit        # typecheck
```

## Submitting changes

1. Make sure `npx tsc --noEmit` passes with no errors
2. Make sure all tests pass with `yarn test`
3. Write tests for new features or bug fixes
4. Open a pull request against `main` — don't worry about commit history, we squash merge

## Code style

- TypeScript strict mode, no `any` types
- Zod schemas for all API input/output validation
- All database queries go through the RLS-aware connection (`rlsDb.rls()`)
- Use Drizzle's parameterized queries — never use `sql.raw()` with user input

## Reporting issues

Open an issue on GitHub. For security vulnerabilities, please email the maintainers directly instead of opening a public issue.

## License

By contributing, you agree that your contributions will be licensed under the same [Commons Clause + AGPL-3.0 license](LICENSE) as the project.
