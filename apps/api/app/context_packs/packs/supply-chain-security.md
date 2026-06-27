# Software Supply Chain Security

Use this pack for dependency, build, package and deployment review.

## Review Rubric

- Check lockfiles, pinned versions and repeatable builds.
- Check dependency update process, vulnerability triage, provenance and ownership.
- Check secret scanning, dependency review, package audit and container image scanning.
- Check CI permissions, branch protections, release signing and artifact integrity where relevant.
- Check whether generated code, scripts and package lifecycle hooks are trusted.
- Check deployment images for minimal base images, non-root users and unnecessary exposed services.

## Output Requirements

- Separate vulnerable dependency findings from supply-chain process gaps.
- Flag unpinned production dependencies and unaudited release paths.
