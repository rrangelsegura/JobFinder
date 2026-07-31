---
name: enrich-us
description: Analyze and enhance user stories with complete, implementation-ready technical detail from direct ticket input or Jira.
author: LIDR.co
version: 1.0.0
---
# enrich-us Skill

Use it when this workflow is required in the project.

## Instructions

Please analyze and enrich the ticket: $ARGUMENTS.

Follow these steps:

1. Determine the ticket input source:
   - **Direct input mode (default when ticket text is provided):** Use the ticket content shared by the user in the prompt/chat.
   - **Jira mode (optional):** If the user provides a Jira id/key, or asks to use Jira (including references like "the one in progress"), use Jira MCP to fetch the ticket details.
   - **Project folder mode (optional):** If the user provides a key and does not mention that is a Jira key, or asks to find the Spec file (including references like "the one in progress"), locate the corresponding Markdown file (by default in  <project_root>\ai-specs\requests\) to fetch the ticket details.
2. Act as a product expert with technical knowledge.
3. Understand the problem described in the ticket.
4. Decide whether or not the User Story is completely detailed according to product best practices. Validate that it includes:
   - Full functionality description
   - Comprehensive list of fields to update
   - Required endpoints structure and URLs
   - Files/modules to modify according to architecture and best practices
   - Definition of done (implementation and delivery steps)
   - Documentation and unit test updates
   - Non-functional requirements (security, performance, observability, etc.)
5. If the story lacks enough technical detail for autonomous implementation, provide an improved version that is clearer, more specific, and concise, aligned with step 4. Use project technical context from `@documentation`. Return the result in markdown.
6. Output format must always include:
   - `## Original`
   - `## Enhanced`
7. User Story write-back only applies in Jira and Project folder mode:
   - **Jira mode:**
     1. Update the Jira ticket by appending the enhanced content after the original content, with clear `h2` sections `[original]` and `[enhanced]` and readable formatting (lists/code snippets when useful).
     2. If ticket status is `To refine`, move it to `Pending refinement validation`.
   - **Projec folder mode:**
     1. Locate the corresponding User Story file under:
        <project_root>/ai-specs/requests/
     2. Read the file.
     3. Generate the enhanced User Story.
     4. Edit the same file in place.
     5. Preserve the original content.
     6. Append:
        ## Original
        ...
        ## Enhanced
        ...
     7. Save the file.
     8. Report only:
        ✓ Updated: ai-specs/requests/<ticket>.md
  
## Notes

- Do not require Jira or spec file when the user already provided full ticket content directly.
- If input is ambiguous (for example, user gives a short reference without content), ask whether to resolve via Jira or request the full ticket text.
