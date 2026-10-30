import os
import logging
import asyncio
from .provider import StorageProvider

logger = logging.getLogger(__name__)

class LocalStorageProvider(StorageProvider):
    """
    Local filesystem storage provider for Docker and AWS EC2 deployments.
    Stores files under backend/media directory and serves them via static URLs.
    """
    def __init__(self, media_dir: str = "media", base_url: str = "/media"):
        self.media_dir = os.path.abspath(media_dir)
        self.base_url = base_url.rstrip("/")
        os.makedirs(self.media_dir, exist_ok=True)

    async def upload_file(self, file_content: bytes, object_key: str, content_type: str) -> bool:
        def _write():
            target_path = os.path.join(self.media_dir, object_key)
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            with open(target_path, "wb") as f:
                f.write(file_content)

        try:
            await asyncio.to_thread(_write)
            logger.info(f"LocalStorageProvider successfully stored {object_key}")
            return True
        except Exception as e:
            logger.error(f"LocalStorageProvider failed to store {object_key}: {e}")
            return False

    async def delete_file(self, object_key: str) -> bool:
        def _delete():
            target_path = os.path.join(self.media_dir, object_key)
            if os.path.exists(target_path):
                os.remove(target_path)

        try:
            await asyncio.to_thread(_delete)
            return True
        except Exception as e:
            logger.error(f"LocalStorageProvider failed to delete {object_key}: {e}")
            return False

    def generate_url(self, object_key: str, expires_in: int = 3600) -> str:
        if not object_key:
            return ""
        return f"{self.base_url}/{object_key.lstrip('/')}"

local_storage_provider = LocalStorageProvider()
