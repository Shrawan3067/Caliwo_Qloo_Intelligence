import os
import logging
import uuid
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
import datetime
from pgvector.sqlalchemy import Vector

logger = logging.getLogger(__name__)

from models import UserMemory
from ai_client import get_openai_client

async def generate_embedding(text_content: str) -> List[float]:
    """Generate a vector embedding for the given text using text-embedding-3-small."""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip("\"' \t\r\n")
    if not api_key or api_key.startswith("dummy"):
        return []
    try:
        response = await get_openai_client().embeddings.create(
            input=text_content,
            model="text-embedding-3-small"
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        return []

async def store_memory(session: AsyncSession, user_id: str, content: str):
    """Embed and store a new permanent memory for a user."""
    embedding = await generate_embedding(content)
    if not embedding:
        return None
    
    memory_id = "mem_" + uuid.uuid4().hex[:12]
    new_memory = UserMemory(
        id=memory_id,
        user_id=user_id,
        content=content,
        embedding=embedding
    )
    
    session.add(new_memory)
    await session.commit()
    return new_memory

async def retrieve_relevant_context(session: AsyncSession, user_id: str, query: str, limit: int = 5) -> str:
    """
    Search the user's permanent memory using vector cosine distance.
    Returns a formatted string of the most relevant memories.
    """
    try:
        query_embedding = await generate_embedding(query)
        if not query_embedding:
            return ""

        stmt = (
            select(UserMemory)
            .where(UserMemory.user_id == user_id)
            .order_by(UserMemory.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )

        result = await session.execute(stmt)
        memories = result.scalars().all()

        if not memories:
            return ""

        context = "Retrieved Context (User's Permanent Memory):\n"
        for m in memories:
            context += f"- {m.content}\n"

        return context
    except Exception as e:
        logger.error(f"Error retrieving relevant context: {e}")
        return ""
