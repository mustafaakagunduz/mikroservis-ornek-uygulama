import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
