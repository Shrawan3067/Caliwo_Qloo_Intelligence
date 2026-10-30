import os
from .provider import StorageProvider
from .local import local_storage_provider, LocalStorageProvider

# Default storage provider for EC2 Docker deployments is LocalStorageProvider
storage_provider = local_storage_provider

__all__ = [
    "StorageProvider", 
    "storage_provider", 
    "LocalStorageProvider",
    "local_storage_provider"
]
