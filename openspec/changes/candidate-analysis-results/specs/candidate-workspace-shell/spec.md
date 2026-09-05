## MODIFIED Requirements

### Requirement: Not-Yet-Built Sections Are Clearly Disabled, Not Broken
Chat and Action Plan SHALL be visibly present in the navigation but SHALL NOT be reachable, and SHALL be clearly marked as unavailable rather than appearing broken or dead. Analysis Results SHALL NOT be part of this disabled set — it is live navigation (see `candidate-analysis-results`).

#### Scenario: Disabled section does not navigate
- **WHEN** an authenticated candidate interacts with the Chat or Action Plan navigation item
- **THEN** the system does not navigate to a broken or empty route, and the item is visibly marked as not yet available

#### Scenario: Upload and Analysis Results are the live sections
- **WHEN** an authenticated candidate views the navigation
- **THEN** Upload and Analysis Results both navigate to functional content, while Chat and Action Plan remain visibly disabled
