import pytest
from storage import storage_provider, LocalStorageProvider, local_storage_provider


def test_storage_provider_default_export():
    assert storage_provider is not None
    assert isinstance(storage_provider, LocalStorageProvider)


def test_local_storage_generate_url():
    url = storage_provider.generate_url("test_meal.webp")
    assert url == "/media/test_meal.webp"


@pytest.mark.asyncio
async def test_local_storage_upload_and_delete(tmp_path):
    provider = LocalStorageProvider(media_dir=str(tmp_path))
    content = b"fake-image-bytes"
    key = "user123/meal456.jpg"

    # Upload
    ok = await provider.upload_file(content, key, "image/jpeg")
    assert ok is True
    assert (tmp_path / key).exists()
    assert (tmp_path / key).read_bytes() == content

    # Delete
    del_ok = await provider.delete_file(key)
    assert del_ok is True
    assert not (tmp_path / key).exists()
