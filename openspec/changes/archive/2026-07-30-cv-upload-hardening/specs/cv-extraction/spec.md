## MODIFIED Requirements

### Requirement: Structured LLM Extraction
The system SHALL prompt a local LLM to produce candidate data validated against a Pydantic schema. Free-form, unvalidated JSON output SHALL NOT be accepted as a successful extraction result. The prompt SHALL reinforce the required structured shape (e.g. each skill/language as an object, not a string) regardless of how many items a given list contains, and the retry prompt SHALL stay within the model's usable context budget rather than unconditionally concatenating the full resume text, the full previous output, and the full validation error list.

#### Scenario: LLM output passes schema validation
- **WHEN** the LLM returns output that validates against the extraction Pydantic schema
- **THEN** the system accepts the output and proceeds to persistence

#### Scenario: LLM output fails schema validation and is retried
- **WHEN** the LLM's first output fails schema validation
- **THEN** the system retries once with a refined prompt that stays within the model's context budget

#### Scenario: Long lists still produce the required structured shape
- **WHEN** a resume contains many skills or languages (more items than the prompt's worked example shows)
- **THEN** the extraction prompt still requires each item as a structured object, not a flat string, regardless of list length

#### Scenario: LLM output fails validation after retry
- **WHEN** the LLM's output fails schema validation on the retry attempt as well
- **THEN** the system marks the job `failed` with a user-facing reason and does not persist partial data
