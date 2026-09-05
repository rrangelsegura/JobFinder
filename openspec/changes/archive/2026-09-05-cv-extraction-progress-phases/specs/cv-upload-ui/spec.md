## MODIFIED Requirements

### Requirement: Processing State Visibility
While the extraction job is processing, the UI SHALL reflect a "processing" state rather than a blank screen or a state indistinguishable from success or failure. When the backend reports a `phase` (`queued`, `extracting`, or `saving`), the UI SHALL show phase-specific copy rather than a single generic message. If no `phase` is present, the UI SHALL fall back to a generic processing message rather than failing to render.

#### Scenario: Job still processing shows a processing indicator
- **WHEN** the tracked job's status is `processing`
- **THEN** the UI displays a visible processing indicator and does not display success or failure content

#### Scenario: Queued phase shows queued-specific copy
- **WHEN** the tracked job's status is `processing` with `phase: "queued"`
- **THEN** the UI displays copy indicating the job is waiting to start

#### Scenario: Extracting phase shows extracting-specific copy
- **WHEN** the tracked job's status is `processing` with `phase: "extracting"`
- **THEN** the UI displays copy indicating the CV is being analyzed, setting the expectation that this can take a few minutes

#### Scenario: Saving phase shows saving-specific copy
- **WHEN** the tracked job's status is `processing` with `phase: "saving"`
- **THEN** the UI displays copy indicating the results are being saved

#### Scenario: Missing phase falls back to generic processing copy
- **WHEN** the tracked job's status is `processing` with no `phase` present
- **THEN** the UI displays the generic "processing" message rather than an empty or broken state
