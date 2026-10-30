import io
import uuid
import datetime
from typing import Tuple, Dict, Any
from fastapi import UploadFile, HTTPException
import filetype
from PIL import Image, ImageOps

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}

def validate_image_file(file_bytes: bytes) -> str:
    """
    Validates file size, real file signature (magic numbers), and MIME type.
    Returns the detected MIME type if valid.
    """
    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    kind = filetype.guess(file_bytes)
    if kind is None:
        raise HTTPException(status_code=415, detail="Unsupported media type or invalid file.")

    if kind.mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {kind.mime}. Allowed: JPEG, PNG, WEBP.")

    return kind.mime

def process_image(file_bytes: bytes) -> Tuple[bytes, bytes, Dict[str, Any]]:
    """
    Processes the image:
    1. Corrects orientation based on EXIF.
    2. Strips EXIF by recreating the image (or by just not saving it).
    3. Resizes keeping aspect ratio (max dimension 1280px).
    4. Generates a thumbnail (max dimension 256px).
    5. Converts both to WebP format.
    
    Returns: (standard_webp_bytes, thumbnail_webp_bytes, metadata_dict)
    """
    try:
        # Load image
        img = Image.open(io.BytesIO(file_bytes))
        
        # 1. Correct orientation
        img = ImageOps.exif_transpose(img)
        
        # Strip EXIF by converting to RGB (if needed) and saving without EXIF arg
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
            
        # 3. Resize standard (max 1280px)
        img.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
        width, height = img.size
        
        # Convert to WebP standard
        standard_io = io.BytesIO()
        img.save(standard_io, format="WEBP", quality=85)
        standard_bytes = standard_io.getvalue()
        
        # 4. Generate thumbnail (max 256px)
        thumb_img = img.copy()
        thumb_img.thumbnail((256, 256), Image.Resampling.LANCZOS)
        
        # Convert to WebP thumbnail
        thumb_io = io.BytesIO()
        thumb_img.save(thumb_io, format="WEBP", quality=80)
        thumb_bytes = thumb_io.getvalue()
        
        metadata = {
            "width": width,
            "height": height,
            "content_type": "image/webp",
            "size_bytes": len(standard_bytes)
        }
        
        return standard_bytes, thumb_bytes, metadata
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

def generate_object_keys(user_id: str) -> Tuple[str, str]:
    """
    Generates UUID-based object keys for predictable S3 folder structure.
    users/{userId}/meals/{year}/{month}/{uuid}.webp
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    year = now.strftime("%Y")
    month = now.strftime("%m")
    unique_id = uuid.uuid4().hex
    
    base_path = f"users/{user_id}/meals/{year}/{month}/{unique_id}"
    standard_key = f"{base_path}.webp"
    thumbnail_key = f"{base_path}_thumb.webp"
    
    return standard_key, thumbnail_key
