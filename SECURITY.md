# 🔒 Security Policy

## Reporting a vulnerability

Please do not report security issues in a public issue.

Use GitHub's private vulnerability reporting instead:
**[Report a vulnerability](https://github.com/vgorte/react-native-nitro-h3/security/advisories/new)**.
The report stays private between you and the maintainer until a fix is published.

Useful in a report:

- the package version, the platform (iOS or Android) and the React Native version
- the smallest input or call sequence that triggers the problem
- what an attacker gains: a crash, a read outside the buffer, an unbounded allocation

This is a single-maintainer project. Reports are answered as quickly as circumstances allow, and you
will hear back either way rather than being left waiting.

## Supported versions

Fixes go into the next release from `main`. The package is pre-1.0 and older minor releases are not
patched, so an upgrade is part of every fix.

## Scope

The published npm package is in scope: the TypeScript wrapper, the C++ binding and shapes layer, the
iOS and Android build glue, and the H3 C library vendored under
`packages/react-native-nitro-h3/third_party/h3` as it is compiled here.

The package converts JavaScript input into C++ memory operations, so memory safety is the interesting
surface: out-of-bounds reads or writes, integer overflow while sizing an allocation, or an allocation
that grows without bound from ordinary API arguments. Reports of that kind are welcome even when the
input looks unrealistic.

Out of scope: the example app under `apps/example`, which is never published; vulnerabilities in
React Native or Nitro Modules themselves, which belong with their maintainers; and H3 results that
are merely surprising rather than unsafe.

If the flaw turns out to be in upstream H3 rather than in this binding, report it here anyway.
Upstream has no security policy of its own, and coordinating with
[uber/h3](https://github.com/uber/h3) is then the maintainer's job, not yours.
