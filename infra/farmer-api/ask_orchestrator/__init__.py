"""Cloud-grounded Ask Mkulima orchestrator.

Groq is the reasoning layer. This package supplies selective farmer context,
agricultural knowledge, live tools, structured output and safety validation.
The phone remains the offline fallback — not the primary brain.
"""

from .orchestrate import run_ask

__all__ = ["run_ask"]
