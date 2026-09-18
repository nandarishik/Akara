from __future__ import annotations
import logging
from app.domain.intelligence.analyst_agent import run_analyst
from app.domain.intelligence.decision_agent import generate_candidate_recommendations
from app.domain.intelligence.reviewer_agent import review_recommendations
logger = logging.getLogger(__name__)

def run_decision_engine() -> dict:
    logger.info("decision engine stub")
    return {"ok": True, "inserted": 0}
