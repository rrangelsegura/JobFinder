---
description: Frontend development standards, best practices, and conventions for the JobFinder AI-First interface. Includes React, TypeScript, Tailwind CSS, Shadcn/UI, and patterns for Agentic User Experiences (Agentic UI).
globs: ["frontend/src/**/*.{ts,tsx}", "frontend/vite.config.ts", "frontend/package.json"]
alwaysApply: true
---

# JobFinder: Frontend Project Standards & Best Practices

## Overview
JobFinder is an AI-driven platform. The frontend is not just a data entry tool but an **Agentic Interface** that allows users to interact with a Multi-Agent System (MAS). We follow **Spec Driven Development (SDD)**, where UI components and user flows are derived from validated specifications in the \`/docs\` folder.

## Technology Stack

### Core Technologies
- **React 18+**: Functional components with Hooks.
- **TypeScript**: Strict mode for end-to-end type safety.
- **Vite**: Modern build tool and development server (replacing CRA for performance).
- **React Router DOM 6+**: Client-side routing.

### UI & Styling (Modern AI Stack)
- **Tailwind CSS**: Utility-first CSS for rapid, consistent styling.
- **Shadcn/UI**: High-quality, accessible components built on Radix UI.
- **Lucide React**: Consistent and clean iconography.
- **Recharts**: For professional job-seeking statistics and effectiveness dashboards.
- **Framer Motion**: For smooth transitions between agent states and reasoning steps.

### State Management & Data Flow
- **Zustand**: Lightweight state management for global app state (user preferences, agent session).
- **TanStack Query (React Query)**: Server-state management, caching, and asynchronous agent request handling.
- **Axios**: HTTP client for communication with the Node.js API Gateway.

---

## Agentic UI Patterns
Since JobFinder is powered by non-deterministic agents, the UI must handle **asynchronicity** and **transparency**.

### 1. Reasoning & Traceability
- **Step-by-Step Disclosure**: Use "Accordions" or "Step-Lists" to show the orchestrator's reasoning process (e.g., "Agent Matchmaker is analyzing CV...").
- **Streaming Responses**: Implement typing effects and real-time updates for agent-generated content.
- **Confidence Indicators**: Visual cues (progress bars, color-coded badges) for match scores (0-10).

### 2. Interaction Models
- **Command Interface**: A central input for directing the Orchestrator Agent.
- **Interactive Documents**: CVs and Action Plans should be rendered in a way that allows users to request specific refactors of sections (connecting the UI directly to the CV Analyst agent).
- **Candidate Journey Map**: A visual timeline showing the state of the application process (Pre-app $\rightarrow$ Interview $\rightarrow$ Follow-up).

---

## Coding Standards

### Component Architecture
- **Atomic Design**: Divide components into Atoms, Molecules, Organisms, and Pages.
- **Compound Components**: Use the compound component pattern for complex UI elements like Agent Dialogs.
- **Naming**: PascalCase for components, camelCase for hooks and utilities.

### Type Safety
- **Shared Schemas**: Use Zod to validate API responses from the Node.js Gateway, ensuring the UI never crashes due to LLM hallucinations in the backend.
- **Strict Props**: Avoid `any`. Every component prop must be explicitly typed.

---

## UI/UX Standards

### Aesthetics
- **Clean & Utilitarian**: Avoid decorative clutter. Use a professional, focus-oriented palette (Slate/Zinc/Indigo).
- **Information Density**: Prioritize scannable data (tables, grids) for job offers, and immersive views for career coaching.
- **Responsive Design**: Full compatibility across desktop and mobile, ensuring the "Candidate Journey" is manageable on the go.

### Accessibility (a11y)
- Use **Radix UI** primitives via Shadcn for keyboard navigation and screen reader support.
- Maintain high color contrast and semantic HTML.

---

## Testing Standards

### End-to-End (E2E) Testing
- **Playwright**: Preferred for testing complex agent flows (e.g., uploading a CV $\rightarrow$ waiting for agent analysis $\rightarrow$ verifying the generated Action Plan).
- **User Centric**: Test workflows, not implementation details.

### Component Testing
- **Vitest + React Testing Library**: For unit testing business logic in hooks and UI components.

---

## Development Workflow

### SDD Integration
1. **UI Spec**: Every new view must have a wireframe or flow description in \`/docs\`.
2. **Component Locking**: Component APIs (props) must be defined in the spec before implementation.
3. **Verification**: Visual QA against the specification.

### Git & Quality
- **Feature Branches**: \`feature/<change-name>\` (matches this project's OpenSpec change names, e.g. \`feature/candidate-workspace-frontend\`).
- **Linters**: ESLint + Prettier for consistent formatting.
- **Build Check**: Ensure \`npm run build\` passes without TS errors before merging.

## Performance Best Practices
- **Code Splitting**: Route-based lazy loading using \`React.lazy\`.
- **Image Optimization**: Use WebP and modern loading strategies for CV previews.
- **Optimistic Updates**: Use TanStack Query to update the UI instantly while the agent processes in the background.
