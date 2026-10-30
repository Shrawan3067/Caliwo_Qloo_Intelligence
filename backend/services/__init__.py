"""
Caliwo Shared Service Layer.

This package provides the core business logic services used by:
- REST API routers

Services operate directly on the database via SQLAlchemy sessions,
avoiding unnecessary HTTP round-trips between internal components.
"""
