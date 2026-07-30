from fastapi import FastAPI

from agents.cv_analyst.router import router as cv_analyst_router

app = FastAPI(title="JobFinder Agentic Core")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(cv_analyst_router)
