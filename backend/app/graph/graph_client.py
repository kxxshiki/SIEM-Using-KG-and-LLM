"""
Neo4j AuraDB connection layer. Every function here is BEST-EFFORT: if
Neo4j is unreachable, misconfigured, or credentials are blank, functions
return a safe default (None/False) instead of raising. This is the single
piece of code that makes the "Neo4j failure never breaks anything else"
requirement true — every other graph file, and everything outside the
graph package, relies on this contract.

DESIGN NOTE: if the first connection attempt fails, we don't retry on
every subsequent call (that would slow down every request while Neo4j is
down). It stays "disabled" until the process restarts. For a dev/final-
year project this is a reasonable tradeoff — a production system would
add periodic reconnect attempts instead.
"""
import logging
from typing import Optional, List, Dict, Any

from neo4j import GraphDatabase, basic_auth

from app.config import settings

logger = logging.getLogger("siem.graph")

_driver = None
_driver_init_attempted = False

AURA_DATABASE = settings.NEO4J_DATABASE  # AuraDB Free/Pro tier's default (and only) database name


def get_driver():
    """Lazily creates and caches the driver. Returns None if unavailable for any reason."""
    global _driver, _driver_init_attempted
    if _driver is not None:
        return _driver
    if _driver_init_attempted:
        return None  # already tried and failed once this process lifetime

    _driver_init_attempted = True

    if not (settings.NEO4J_URI and settings.NEO4J_USER and settings.NEO4J_PASSWORD):
        logger.warning("Neo4j credentials not configured (.env) — graph features disabled, everything else unaffected.")
        return None

    try:
        driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=basic_auth(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )
        driver.verify_connectivity()
        _driver = driver
        logger.info("Connected to Neo4j AuraDB successfully.")
        return _driver
    except Exception:
        logger.exception("Could not connect to Neo4j AuraDB — graph features disabled, everything else unaffected.")
        return None


def is_available() -> bool:
    return get_driver() is not None


def run_write(query: str, params: Optional[Dict[str, Any]] = None) -> bool:
    """Executes a write query. Returns True on success, False on ANY failure — never raises."""
    driver = get_driver()
    if driver is None:
        return False
    try:
        with driver.session(database=AURA_DATABASE) as session:
            session.run(query, params or {})
        return True
    except Exception:
        logger.exception("Neo4j write failed — continuing without graph sync for this operation.")
        return False


def run_read(query: str, params: Optional[Dict[str, Any]] = None) -> Optional[List[Dict[str, Any]]]:
    """Executes a read query. Returns a list of record dicts, or None on ANY failure — never raises."""
    driver = get_driver()
    if driver is None:
        return None
    try:
        with driver.session(database=AURA_DATABASE) as session:
            result = session.run(query, params or {})
            return [record.data() for record in result]
    except Exception:
        logger.exception("Neo4j read failed.")
        return None


def close_driver() -> None:
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None