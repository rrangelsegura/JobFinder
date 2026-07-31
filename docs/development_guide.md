# JobFinder Development Guide

This guide provides step‑by‑step instructions for setting up the development environment and running tests for the **JobFinder** project.

## ⚙️ Setup Instructions

### Prerequisites

Ensure the following are installed on your workstation:
- **Node.js** (v20 or higher) – the API gateway uses modern ECMAScript features.
- **npm** (v9 or higher) – package manager for the Node layer.
- **Python** (3.11+) – core agentic logic.
- **poetry** – dependency management for Python.
- **Docker** and **Docker Compose** – optional for local PostgreSQL.
- **Git** – source control.

### 1. Clone the Repository

```bash
git clone https://github.com/rrangelsegura/JobFinder.git
cd JobFinder
```

### 2. Environment Configuration

Create environment files for both the backend (Node) and the agentic core (Python).  Values that are not yet known are left empty for later completion.

**Backend Environment** (`backend/.env`):
```env
# Database configuration (to be filled when DB is added)
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=

# Application configuration
PORT=3000
NODE_ENV=development

# Prisma database URL (placeholder)
DATABASE_URL=""
```

**Python Agentic Core Environment** (`agentic/.env`):
```env
# Add any required variables for the Python agents here.
# Currently none are mandatory.
```

**Frontend Environment** (`frontend/.env`):
```env
# URL of the API gateway – will be set when the backend is running.
REACT_APP_API_URL=
```

### 3. (Optional) Database Setup

The project currently does **not** include a database configuration. When a PostgreSQL instance is added, you can spin it up with Docker Compose:
```bash
docker-compose -f infra/docker-compose.yml up -d postgres
```
Leave the connection variables above empty until the schema is defined.

### 4. Backend Setup (Node.js API Gateway)

```bash
cd backend
npm install            # install dependencies
npm run dev             # start the development server (http://localhost:3000)
```

### 5. Agentic Core Setup (Python)

```bash
cd agentic
poetry install          # install Python dependencies
poetry run python -m app   # run the core service (adjust the entry‑point as needed)
```

### 6. Frontend Setup (React)

```bash
cd frontend
npm install
npm start               # starts the dev server (http://localhost:3001)
```

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test                # run Jest/Mocha test suite
npm run test:watch      # watch mode
npm run test:coverage   # coverage report
```

### Frontend Tests

```bash
cd frontend
npm test                # unit tests (Jest)
npm run cypress:run      # end‑to‑end Cypress tests (headless)
npm run cypress:open     # interactive Cypress UI
```

### Python Agent Tests

```bash
cd agentic
poetry run pytest      # run pytest suite
poetry run pytest -s    # show stdout during tests
```

## 📦 Deployment

Deployment details will be added once the CI/CD pipeline is defined. For now, the project can be run locally using the commands above.

---
*This document will be updated as the architecture evolves and concrete services (database, CI/CD, front‑end URL, etc.) become available.*
