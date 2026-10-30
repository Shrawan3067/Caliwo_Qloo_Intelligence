"""
AI Provider Abstraction Layer.

Supports:
  - OpenAI (GPT-4o, GPT-4o-mini)
  - Anthropic (Claude)

Configured via environment variables:
  AI_PROVIDER=openai|anthropic
  AI_MODEL=gpt-4o|claude-3-5-sonnet-20240620|...
  AI_API_KEY=...
"""

import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

AI_PROVIDER = os.environ.get("AI_PROVIDER", "openai").lower()
AI_MODEL = os.environ.get("AI_MODEL", "gpt-4o")


async def chat_completion(
    messages: list[dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.7,
    max_tokens: int = 2000,
    json_mode: bool = False,
    tools: Optional[list[dict]] = None,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> dict[str, Any]:
    """
    Unified chat completion interface.
    Returns: {"content": str, "tool_calls": list[dict] | None}
    """
    # H3/M7: Circuit breaker — fail fast if AI services are down
    from ai_client import ai_circuit_breaker
    if not ai_circuit_breaker.allow_request():
        logger.warning("AI circuit breaker is active (circuit open). Triggering fallback.")
        raise RuntimeError("AI services are temporarily unavailable (circuit breaker open).")

    provider = (provider or os.environ.get("AI_PROVIDER", AI_PROVIDER)).lower()
    model = model or os.environ.get("AI_MODEL", AI_MODEL)

    try:
        if provider == "openai":
            result = await _openai_completion(messages, system_prompt, temperature, max_tokens, json_mode, tools, model)
        elif provider == "anthropic":
            ant_key = os.environ.get("ANTHROPIC_API_KEY", "")
            if not ant_key or ant_key.startswith("dummy") or ant_key.startswith("sk-ant-demo"):
                logger.info("Anthropic key is demo/dummy. Routing completion to OpenAI provider.")
                result = await _openai_completion(messages, system_prompt, temperature, max_tokens, json_mode, tools, os.environ.get("AI_MODEL", "gpt-4o"))
            else:
                result = await _anthropic_completion(messages, system_prompt, temperature, max_tokens, json_mode, tools, model)
        else:
            raise ValueError(f"Unknown AI provider: {provider}")
        ai_circuit_breaker.record_success()
        return result
    except Exception as e:
        ai_circuit_breaker.record_failure()
        logger.error("AI chat_completion failed (%s/%s): %s", provider, model, e)
        raise


async def _openai_completion(
    messages: list[dict],
    system_prompt: str,
    temperature: float,
    max_tokens: int,
    json_mode: bool,
    tools: Optional[list[dict]],
    model: str,
) -> dict[str, Any]:
    from ai_client import get_openai_client

    client = get_openai_client()

    formatted_messages = []
    if system_prompt:
        formatted_messages.append({"role": "system", "content": system_prompt})

    for m in messages:
        if m.get("role") == "assistant" and m.get("tool_calls"):
            formatted_messages.append({
                "role": "assistant",
                "content": m.get("content") or None,
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc.get("name") or tc.get("function", {}).get("name", ""),
                            "arguments": json.dumps(tc["arguments"]) if isinstance(tc.get("arguments"), dict) else str(tc.get("arguments", "{}")),
                        },
                    }
                    if "type" not in tc else tc
                    for tc in m["tool_calls"]
                ],
            })
        else:
            formatted_messages.append(m)

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": formatted_messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    response = await client.chat.completions.create(**kwargs)
    choice = response.choices[0]

    result: dict[str, Any] = {
        "content": choice.message.content or "",
        "tool_calls": None,
        "model_used": model,
    }

    if choice.message.tool_calls:
        parsed_calls = []
        for tc in choice.message.tool_calls:
            try:
                args = json.loads(tc.function.arguments) if tc.function.arguments else {}
            except Exception:
                args = {}
            parsed_calls.append({
                "id": tc.id,
                "name": tc.function.name,
                "arguments": args,
            })
        result["tool_calls"] = parsed_calls

    return result


async def _anthropic_completion(
    messages: list[dict],
    system_prompt: str,
    temperature: float,
    max_tokens: int,
    json_mode: bool,
    tools: Optional[list[dict]],
    model: str,
) -> dict[str, Any]:
    from ai_client import get_anthropic_client

    client = get_anthropic_client()

    formatted_messages = []
    for m in messages:
        role = m.get("role", "user")
        if role == "tool":
            formatted_messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": m.get("tool_call_id", ""),
                        "content": str(m.get("content", "")),
                    }
                ],
            })
        elif role == "assistant" and m.get("tool_calls"):
            content_blocks = []
            if m.get("content"):
                content_blocks.append({"type": "text", "text": str(m["content"])})
            for tc in m["tool_calls"]:
                content_blocks.append({
                    "type": "tool_use",
                    "id": tc.get("id", ""),
                    "name": tc.get("name", ""),
                    "input": tc.get("arguments", {}),
                })
            formatted_messages.append({"role": "assistant", "content": content_blocks})
        else:
            formatted_messages.append({
                "role": "assistant" if role == "assistant" else "user",
                "content": str(m.get("content", "")),
            })

    kwargs: dict[str, Any] = {
        "model": model or "claude-3-5-sonnet-20240620",
        "max_tokens": max_tokens,
        "messages": formatted_messages,
    }

    if system_prompt:
        kwargs["system"] = system_prompt

    if tools:
        ant_tools = []
        for t in tools:
            if "function" in t:
                ant_tools.append({
                    "name": t["function"]["name"],
                    "description": t["function"].get("description", ""),
                    "input_schema": t["function"].get("parameters", {"type": "object", "properties": {}}),
                })
            else:
                ant_tools.append(t)
        kwargs["tools"] = ant_tools

    response = await client.messages.create(**kwargs)
    text_content = ""
    parsed_calls = []
    if response.content:
        for block in response.content:
            b_type = getattr(block, "type", "")
            if b_type == "text":
                text_content += getattr(block, "text", "")
            elif b_type == "tool_use":
                parsed_calls.append({
                    "id": getattr(block, "id", ""),
                    "name": getattr(block, "name", ""),
                    "arguments": getattr(block, "input", {}) if isinstance(getattr(block, "input", None), dict) else {},
                })

    return {
        "content": text_content,
        "tool_calls": parsed_calls if parsed_calls else None,
        "model_used": model,
    }


