
from fastapi import APIRouter

from app.api.v1 import alerts
from app.api.v1 import auth
from app.api.v1 import dashboard
from app.api.v1 import graph
from app.api.v1 import logs
from app.api.v1 import mitre
from app.api.v1 import ml
from app.api.v1 import oauth

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(alerts.router)
api_router.include_router(dashboard.router)
api_router.include_router(graph.router)
api_router.include_router(logs.router)
api_router.include_router(mitre.router)
api_router.include_router(ml.router)
api_router.include_router(oauth.router)
