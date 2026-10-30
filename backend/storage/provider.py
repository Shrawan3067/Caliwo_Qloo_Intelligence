from abc import ABC, abstractmethod
from typing import Optional


class StorageProvider(ABC):
    """
    Abstract interface for object storage providers (e.g. AWS S3, GCS, Cloudflare R2).
    """

    @abstractmethod
    async def upload_file(self, file_content: bytes, object_key: str, content_type: str) -> bool:
        """
        Uploads a file to the storage provider.
        :param file_content: The raw bytes of the file.
        :param object_key: The destination key/path in the storage.
        :param content_type: The MIME type of the file.
        :return: True if successful, raises an exception otherwise.
        """
        pass

    @abstractmethod
    async def delete_file(self, object_key: str) -> bool:
        """
        Deletes a file from the storage provider.
        :param object_key: The key/path in the storage to delete.
        :return: True if successful.
        """
        pass

    @abstractmethod
    def generate_url(self, object_key: str, expires_in: int = 3600) -> str:
        """
        Generates a URL for the object. This could be a Signed URL or a CDN URL.
        :param object_key: The key/path of the object.
        :param expires_in: Expiration time in seconds for signed URLs.
        :return: The generated URL.
        """
        pass
