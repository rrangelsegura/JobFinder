## ADDED Requirements

### Requirement: main requires a pull request before merging
The system SHALL prevent any direct push to `main` — all changes SHALL land through a pull request.

#### Scenario: Direct push attempted
- **WHEN** anyone, including the repository owner, runs `git push origin main` with a commit not already on `main`
- **THEN** GitHub rejects the push

#### Scenario: Change lands via pull request
- **WHEN** a branch is pushed and a pull request targeting `main` is opened, reviewed if applicable, and merged through GitHub
- **THEN** the change is accepted onto `main`

### Requirement: main requires the three CI jobs to pass before merging
The system SHALL require the `backend-node`, `backend-python`, and `frontend` status checks to report success before a pull request targeting `main` can be merged.

#### Scenario: A required job is failing
- **WHEN** a pull request has any of `backend-node`, `backend-python`, or `frontend` in a failing or pending state
- **THEN** GitHub blocks the merge button for that pull request

#### Scenario: All required jobs pass
- **WHEN** all three named jobs report success on the pull request's latest commit
- **THEN** the pull request becomes mergeable (subject to being up to date, see next requirement)

### Requirement: main requires branches to be up to date before merging
The system SHALL require a pull request's branch to include the latest commit on `main` before it can be merged (strict status checks).

#### Scenario: Branch is behind main
- **WHEN** a pull request's branch does not contain the current HEAD of `main`, even if its own last CI run passed
- **THEN** GitHub blocks the merge until the branch is updated and CI re-runs against the new base

### Requirement: main branch protection applies to administrators
The system SHALL enforce all of the above rules for every user, including repository administrators, without exception.

#### Scenario: Administrator attempts to bypass
- **WHEN** a user with administrator rights on the repository attempts to push directly to `main` or merge a pull request with a failing/pending required check
- **THEN** GitHub blocks the action the same as it would for any other user

### Requirement: main is protected against force-push and deletion
The system SHALL reject force-pushes to `main` and SHALL prevent `main` from being deleted.

#### Scenario: Force-push attempted
- **WHEN** anyone runs `git push --force origin main`
- **THEN** GitHub rejects the push

#### Scenario: Branch deletion attempted
- **WHEN** anyone attempts to delete the `main` branch via `git push origin --delete main` or the GitHub UI/API
- **THEN** GitHub rejects the deletion
