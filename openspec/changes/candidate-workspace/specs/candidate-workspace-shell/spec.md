## ADDED Requirements

### Requirement: Authenticated Access Only
The workspace SHALL only render candidate data for an authenticated candidate. An unauthenticated visitor SHALL be redirected to a login route instead of the workspace loading.

#### Scenario: Unauthenticated visitor is redirected
- **WHEN** a visitor with no active session navigates to the workspace
- **THEN** the system redirects them to the login route and does not render any workspace content

#### Scenario: Authenticated candidate reaches the workspace
- **WHEN** a candidate with an active session navigates to the workspace
- **THEN** the system renders the workspace shell with that candidate's context

### Requirement: Persistent Navigation Across Four Sections
The workspace SHALL present a persistent navigation exposing exactly four sections: Upload, Chat, Analysis Results, and Action Plan.

#### Scenario: All four sections are visible
- **WHEN** an authenticated candidate views the workspace
- **THEN** the navigation shows Upload, Chat, Analysis Results, and Action Plan

### Requirement: Not-Yet-Built Sections Are Clearly Disabled, Not Broken
Chat, Analysis Results, and Action Plan SHALL be visibly present in the navigation but SHALL NOT be reachable, and SHALL be clearly marked as unavailable rather than appearing broken or dead.

#### Scenario: Disabled section does not navigate
- **WHEN** an authenticated candidate interacts with the Chat, Analysis Results, or Action Plan navigation item
- **THEN** the system does not navigate to a broken or empty route, and the item is visibly marked as not yet available

#### Scenario: Upload is the only live section
- **WHEN** an authenticated candidate views the navigation
- **THEN** Upload is the only section that navigates to functional content
