#!/bin/bash
# Start the backend server, binding to 0.0.0.0 so it is accessible from the local network (e.g. mobile devices)
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
