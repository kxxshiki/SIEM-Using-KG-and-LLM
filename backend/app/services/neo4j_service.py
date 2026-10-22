
import os

from dotenv import load_dotenv
from neo4j import GraphDatabase
import asyncio

load_dotenv()

NEO4J_URI = os.getenv(
    "NEO4J_URI", "bolt://localhost:7687"
)
NEO4J_USERNAME = os.getenv(
    "NEO4J_USERNAME", "neo4j"
)
NEO4J_PASSWORD = os.environ["NEO4J_PASSWORD"]
NEO4J_DATABASE = os.getenv(
    "NEO4J_DATABASE", "neo4j"
)

driver = GraphDatabase.driver(
    NEO4J_URI,
    auth=(NEO4J_USERNAME, NEO4J_PASSWORD),
)

async def get_graph_context_async(limit: int = 50) -> dict:
    return await asyncio.to_thread(
        get_graph_context,
        limit,
    )

def verify_neo4j():
    driver.verify_connectivity()


def get_graph_context(limit: int = 50) -> dict:
    query = """
    MATCH (a)-[r]->(b)
    RETURN
        labels(a) AS source_labels,
        properties(a) AS source_properties,
        type(r) AS relationship,
        properties(r) AS relationship_properties,
        labels(b) AS target_labels,
        properties(b) AS target_properties
    LIMIT $limit
    """

    with driver.session(database=NEO4J_DATABASE) as session:
        records = session.run(query, limit=limit)
        relationships = [
            record.data() for record in records
        ]

    return {
        "relationship_count": len(relationships),
        "relationships": relationships,
    }


def close_neo4j():
    driver.close()
