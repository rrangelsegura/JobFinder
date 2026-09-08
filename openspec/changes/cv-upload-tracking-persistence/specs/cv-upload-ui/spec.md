## MODIFIED Requirements

### Requirement: Completion Reflected Without Manual Refresh
Once the extraction job completes, the UI SHALL reflect success without requiring the candidate to reload the page or manually re-check. The success state SHALL display how long the extraction took, in human-readable form. Tracking of the job SHALL survive the candidate navigating away from the Upload page and back, or reloading the page, within the same browser.

#### Scenario: Job completes while the candidate is on the page
- **WHEN** the tracked job's status transitions to `completed`
- **THEN** the UI updates to a success state automatically, without a page reload

#### Scenario: Success state shows the elapsed time
- **WHEN** the tracked job's status transitions to `completed` with a `durationMs` value
- **THEN** the UI displays that duration in human-readable form (e.g. seconds, or minutes and seconds) alongside the success message

#### Scenario: Returning to the Upload page resumes tracking an in-flight job
- **WHEN** a candidate uploads a CV, navigates away from the Upload page while the job is still processing, and returns to it in the same browser
- **THEN** the UI resumes showing that job's current status (including phase, if still processing) rather than the empty upload form

#### Scenario: Returning to the Upload page after the job finished elsewhere shows the final result
- **WHEN** a candidate uploads a CV, navigates away from the Upload page, the job reaches a terminal state (`completed` or `failed`) while they are away, and they return to the Upload page in the same browser
- **THEN** the UI shows that terminal result immediately, rather than the empty upload form

#### Scenario: A different candidate on the same browser never sees another candidate's tracked job
- **WHEN** candidate A uploads a CV and candidate B subsequently logs in on the same browser and visits the Upload page
- **THEN** candidate B sees the empty upload form, not candidate A's tracked job
