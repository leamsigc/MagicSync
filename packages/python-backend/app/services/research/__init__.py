"""Social research capability layer (Agent-Reach inspired).

Glue only: each channel probes its upstream tool and reports health via
doctor(). Agents call the upstream tool directly for reads/searches.
"""

from app.services.research.doctor import check_all, format_report

__all__ = ["check_all", "format_report"]
