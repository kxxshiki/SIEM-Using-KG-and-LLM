import logging
import os
from typing import Optional, List, Dict, Any

import certifi
from neo4j import GraphDatabase, basic_auth
from neo4j.exceptions import Neo4jError

from app.config import settings

# Configure certificates for secure Neo4j Aura connections.
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

logger = logging.getLogger("siem.graph")

_driver = None
_driver_init_attempted = False

AURA_DATABASE = getattr(settings, "NEO4J_DATABASE", None) or "neo4j"


def get_driver():
    """
    Return a cached Neo4j driver after verifying connectivity.
    Return None if configuration or connection is unavailable.
    """
    global _driver, _driver_init_attempted

    if _driver is not None:
        return _driver

    if _driver_init_attempted:
        return None

    _driver_init_attempted = True

    uri = settings.NEO4J_URI
    username = settings.NEO4J_USER
    password = settings.NEO4J_PASSWORD

    if not all((uri, username, password)):
        logger.warning(
            "Neo4j settings are incomplete. Graph features are disabled."
        )
        return None

    driver = None

    try:
        driver = GraphDatabase.driver(
            uri,
            auth=basic_auth(username, password),
            max_connection_pool_size=20,
            connection_acquisition_timeout=10,
        )

        driver.verify_connectivity()

        _driver = driver
        logger.info(
            "Neo4j connection verified successfully. Database: %s",
            AURA_DATABASE,
        )
        return _driver

    except Exception:
        logger.exception("Neo4j connection failed.")

        if driver is not None:
            try:
                driver.close()
            except Exception:
                logger.exception("Failed to close unsuccessful driver.")

        return None


def is_available() -> bool:
    """Return whether a Neo4j connection can be initialized."""
    return get_driver() is not None


def run_write(
    query: str,
    params: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Execute a write query and commit the transaction.

    Returns True on success and False on failure.
    """
    driver = get_driver()

    if driver is None:
        return False

    try:
        with driver.session(database=AURA_DATABASE) as session:
            session.execute_write(
                lambda tx: tx.run(query, params or {}).consume()
            )

        return True

    except Neo4jError:
        logger.exception("Neo4j write query failed.")
        return False
    except Exception:
        logger.exception("Unexpected error during Neo4j write.")
        return False


def run_read(
    query: str,
    params: Optional[Dict[str, Any]] = None,
) -> Optional[List[Dict[str, Any]]]:
    """
    Execute a read query.

    Returns a list of dictionaries, or None on failure.
    An empty list means the query succeeded but returned no records.
    """
    driver = get_driver()

    if driver is None:
        return None

    try:
        with driver.session(database=AURA_DATABASE) as session:
            result = session.execute_read(
                lambda tx: list(tx.run(query, params or {}).data())
            )

        return result

    except Neo4jError:
        logger.exception("Neo4j read query failed.")
        return None
    except Exception:
        logger.exception("Unexpected error during Neo4j read.")
        return None


def close_driver() -> None:
    """Close the cached driver during application shutdown."""
    global _driver, _driver_init_attempted

    driver = _driver
    _driver = None
    _driver_init_attempted = False

    if driver is not None:
        try:
            driver.close()
            logger.info("Neo4j driver closed.")
        except Exception:
            logger.exception("Error while closing Neo4j driver.")