---
description: Backend development standards, best practices, and conventions for the JobFinder Multi-Agent System. Includes the hybrid architecture (Node.js API + Python Agentic Core), Local LLM integration via Ollama, RAG patterns, and Spec Driven Development (SDD) guidelines.
globs: [\
backend/api/**/*.ts\, \backend/agents/**/*.py\, \backend/knowledge_base/**/*.py\, \docs/*.md\]
alwaysApply: true
---

# JobFinder: Backend Project Standards & Best Practices

## Overview
JobFinder is a Multi-Agent System (MAS) designed to maximize employment success. The backend follows a **Hybrid Architecture** and is developed using **Spec Driven Development (SDD)**, meaning all implementation must be preceded by a validated specification in the \/docs\ folder.

## Technology Stack

### 1. API Gateway & Orchestration (Node.js Layer)
- **Runtime**: Node.js (TypeScript)
- **Framework**: Express.js / Fastify
- **Purpose**: User authentication, request validation, session management, and bridging the frontend with the Agentic Core.
- **Database ORM**: Prisma (PostgreSQL) for relational data and user profiles.

### 2. Agentic Core & Data Pipeline (Python Layer)
- **Runtime**: Python 3.10+
- **Framework**: FastAPI
- **Agent Framework**: LangGraph / CrewAI (for non-deterministic orchestration).
- **Local LLM Integration**: 
    - **Inference Server**: Ollama (Local Hosting).
    - **Target Models**: \llama3:8b\, \mistral:7b\, \qwen2:7b\, \phi3:mini\, \gemma4:e2b\, \qwen3.6\.
- **AI Capabilities**: 
    - **RAG**: ChromaDB / Pinecone for vector embeddings and knowledge retrieval.
    - **OCR**: PyTesseract / Amazon Textract for CV and Job Description parsing.
- **Purpose**: Heavy lifting of AI logic, document analysis, and agent-to-agent communication.

---

## Architecture Overview

### Agentic Architecture
JobFinder uses an **Agent-Centric Model** to handle non-deterministic paths:

1. **Orchestrator Agent**: The primary entry point that decides which specialized agent to invoke based on the user's goal.
2. **Specialized Agents**: 
    - *CV Analyst*: Evaluates and refactors \About
Me\ and professional profiles.
    - *Matchmaker*: Calculates match scores (0-10) between candidates and Job Descriptions.
    - *Career Coach*: Manages the \Candidate
Journey\ and action plans.
    - *Document Generator*: Creates customized CVs, letters, and PPTs.
3. **Tool Layer**: Standardized Python functions that agents can call (e.g., \search_job_database\, \send_gmail_invite\, \update_clickup_task\).

### Data Flow (The SDD Pipeline)
\Frontend\ $\rightarrow$ \Node.js API\ $\rightarrow$ \Python Agent Core (FastAPI)\ $\rightarrow$ \Local LLM (Ollama)\ $\rightarrow$ \Tools/Knowledge Base\ $\rightarrow$ \Response\

---

## Spec Driven Development (SDD) Rules
**No code is written without a spec.**

1. **Specification First**: Every feature must have a corresponding \.md\ in \/docs/\ defining:
    - Input/Output schemas.
    - Agent roles involved.
    - Expected logic (Flowcharts/Mermaid).
    - Success criteria.
2. **Validation**: Specifications must be reviewed and \locked\ before implementation starts.
3. **Traceability**: Commits must reference the specification file they implement.

---

## Coding & AI Standards

### Local LLM & Prompt Engineering
- **Model Selection**: Use \llama3:8b\ or \mistral:7b\ for complex reasoning and \phi3:mini\ for simple classification or formatting tasks to optimize local resource usage.
- **Prompt Versioning**: Prompts must be decoupled from logic and versioned.
- **Dynamic Prompting**: Use \Meta-prompting\ where one agent constructs the prompt for another.
- **Structured Output**: Since local models are more prone to hallucinations, all outputs **must** be validated using **Pydantic** (Python) or **Zod** (TypeScript).

### RAG & Knowledge Base
- **Chunking Strategy**: Use semantic chunking for CVs and Job Descriptions.
- **Retrieval**: Implement hybrid search (Keyword + Vector) to ensure precision.
- **Persistence**: Implement a persistent state for the \Candidate
Journey\ to allow agents to recall context across sessions.

### Error Handling in MAS
- **Hallucination Guardrails**: Implement a validation layer that checks if the agent's output matches the requested schema; if not, trigger a retry with a refined prompt.
- **Observability**: All agent traces must be logged to debug non-deterministic paths.

---

## API Design Standards
- **Communication**: Node.js and Python communicate via REST.
- **Asynchronous Processing**: Long-running agent tasks must use a job queue (Redis/BullMQ) and notify the frontend via WebSockets or Polling.
- **Standard Response**:
\\\json
{
  \status\: \success\,
  \data\: { ... },
  \agent_trace_id\: \uuid-1234\,
  \model_used\: \llama3:8b\
}
\\\

## Testing Standards
- **Unit Tests**: Pytest (Python) and Jest (Node.js).
- **Agent Eval**: Use \Golden
Datasets\ to test if the Matchmaker agent provides consistent scores for known pairs of CVs/Jobs.
- **Integration Tests**: End-to-end flow from Frontend $\rightarrow$ API $\rightarrow$ Agent $\rightarrow$ Local LLM $\rightarrow$ Tool.

## Development Workflow
- **Git**: Feature-branch workflow (\codex/feature-name\).
- **Environment**: Use \.env\ for database credentials and Ollama API URLs.
- **Docker**: The entire stack (Node, Python, Postgres, VectorDB, Ollama) must be containerized for consistency.
