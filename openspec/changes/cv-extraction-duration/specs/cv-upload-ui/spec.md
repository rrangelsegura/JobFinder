## MODIFIED Requirements

### Requirement: Completion Reflected Without Manual Refresh
Once the extraction job completes, the UI SHALL reflect success without requiring the candidate to reload the page or manually re-check. The success state SHALL display how long the extraction took, in human-readable form.

#### Scenario: Job completes while the candidate is on the page
- **WHEN** the tracked job's status transitions to `completed`
- **THEN** the UI updates to a success state automatically, without a page reload

#### Scenario: Success state shows the elapsed time
- **WHEN** the tracked job's status transitions to `completed` with a `durationMs` value
- **THEN** the UI displays that duration in human-readable form (e.g. seconds, or minutes and seconds) alongside the success message
