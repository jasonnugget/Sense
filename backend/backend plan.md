Techk Stack: 
Python
FastAPI
OpenCV
YOLO inference runtime
PostgreSQL
Docker
pytest
Git/Github Actions


BACKEND PROJECT STRUCTURE: 
sense/backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app creation + startup
│   ├── config.py            # Settings (loaded from .env)
│   │
│   ├── schemas/             # Pydantic models (your data contracts)
│   │   ├── __init__.py
│   │   ├── detection.py     # BBox, Detection
│   │   └── incident.py      # Incident, IncidentStatusUpdate
│   │
│   ├── routes/              # API endpoint definitions
│   │   ├── __init__.py
│   │   ├── health.py        # GET /health, GET /version
│   │   ├── camera.py        # POST /camera/start, /camera/stop
│   │   ├── incidents.py     # GET/PATCH /incidents
│   │   └── stream.py        # GET /api/stream/alerts (SSE)
│   │
│   ├── services/            # Business logic (the brains)
│   │   ├── __init__.py
│   │   ├── frame_reader.py  # OpenCV camera/video ingestion
│   │   ├── detector.py      # YOLO model loading + inference
│   │   ├── risk_engine.py   # Rule-based alerting + state machine
│   │   ├── incident_manager.py  # CRUD for incidents + status transitions
│   │   └── llm_summary.py   # OpenAI summary service
│   │
│   ├── db/                  # Database layer (Phase 3+)
│   │   ├── __init__.py
│   │   ├── database.py      # Connection setup
│   │   ├── models.py        # SQLAlchemy table definitions
│   │   └── migrations/      # Alembic migrations
│   │
│   └── core/                # Shared utilities
│       ├── __init__.py
│       ├── events.py        # SSE event bus (asyncio.Queue)
│       └── logging.py       # Logging configuration
│
├── tests/                   # pytest tests
│   ├── __init__.py
│   ├── test_health.py
│   ├── test_schemas.py
│   ├── test_risk_engine.py
│   └── test_incidents.py
│
├── .env                     # Environment variables (never commit this)
├── .gitignore
├── requirements.txt         # Python dependencies
├── Dockerfile
├── docker-compose.yml
└── README.md