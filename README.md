# JobFinder

> An AI-powered multi-agent platform designed to maximize a candidate's probability of finding employment through intelligent automation.

---

# Overview

JobFinder is a modular multi-agent platform that assists job seekers throughout their entire employment journey.

Instead of focusing only on resume generation, JobFinder provides end-to-end support including:

* Candidate profile management
* CV parsing and analysis
* Job opportunity discovery
* Intelligent job matching
* Resume optimization
* Cover letter generation
* Interview preparation
* Career guidance
* Application tracking

The platform follows a **Spec-Driven Development (SDD)** workflow using OpenSpec and Codex CLI.

---

# Architecture

The solution is built using a hybrid architecture.

```
Frontend
    │
    ▼
Node.js API Gateway
    │
    ▼
Python Agentic Core
    │
    ├── AI Agents
    ├── Document Processing
    ├── RAG
    ├── LLM Integration
    └── Orchestration
```

## Technology Stack

### Frontend

* React
* Next.js
* TypeScript

### Backend

* Node.js
* Express / Fastify
* TypeScript

### AI Core

* Python
* FastAPI

### AI Components

* Multi-Agent Architecture
* RAG
* LLM Integration
* Vector Database

---

# Development Workflow

This project follows a Spec-Driven Development lifecycle.

```
User Story
    ↓
Enriched User Story
    ↓
Proposal
    ↓
Implementation
    ↓
Verification
    ↓
Code Review
    ↓
Ready Feature
    ↓
Archive
    ↓
Pull Request
```

---

# Project Structure

```
JobFinder/

├── .codex/
│   └── skills/
│
├── ai-specs/
│   ├── requests/
│   └── skills/
│
├── docs/
│
├── openspec/
│   ├── changes/
│   └── specs/
│
├── packages/
│
└── README.md
```

---

# Tooling

| Tool       | Purpose                  |
| ---------- | ------------------------ |
| OpenSpec   | Specification Management |
| Codex CLI  | AI Development Assistant |
| Kanboard   | Project Management       |
| Docker     | Local Services           |
| Ollama     | Local LLM Execution      |
| OpenRouter | Remote LLM Provider      |

---

# Continuous Integration

Every pull request targeting `main` and every push to `main` runs an automated pipeline via GitHub Actions (`.github/workflows/ci.yml`) on GitHub-hosted `ubuntu-latest` runners (free and unlimited for this public repo):

| Job              | Runs                                                             |
| ---------------- | ----------------------------------------------------------------- |
| `backend-node`   | TypeScript build + Jest suite (`backend/`)                        |
| `backend-python` | Pytest suite (`backend/`)                                         |
| `frontend`       | ESLint + Prettier check + build + Vitest suite (`frontend/`)       |

`main` is a **protected branch**: all three checks must pass and be up to date with `main` before a pull request can merge, enforced even for the repository admin. Direct pushes, force-pushes, and deletion of `main` are all rejected by GitHub — every change now lands through a pull request. The pipeline intentionally does not start Postgres, Redis, ChromaDB, or Ollama: the existing test suite mocks those dependencies. See `openspec/changes/archive/2026-08-28-ci-pipeline-foundation/` and `openspec/changes/ci-branch-protection/` for the full design, and the latter's proposal for the remaining planned follow-up (e2e-in-CI).

---

# Supported Development Environment

| Component      | Version              |
| -------------- | -------------------- |
| Codex CLI      | **0.120.0 (Pinned)** |
| OpenSpec       | 1.3.1                |
| Docker Desktop | Supported            |
| Kanboard       | Docker Deployment    |

## Notes

Codex CLI **0.120.0** is currently the recommended version for this project.

Newer versions (such as **0.144.1**) present compatibility issues with OpenRouter that prevent normal operation.

---

# Current Status

The project is currently under active development.

Current milestone:

* Establish the development workflow.
* Define the project architecture.
* Build the foundational specifications.
* Implement the first AI capabilities.

---

# License

To be defined.
