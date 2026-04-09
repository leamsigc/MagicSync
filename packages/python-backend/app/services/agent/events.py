import logging
from dataclasses import dataclass, field
from enum import Enum
import asyncio

logger = logging.getLogger(__name__)


class DeepModeStatus(str, Enum):
    IDLE = "idle"
    PLANNING = "planning"
    EXECUTING = "executing"
    WAITING = "waiting"
    COMPLETE = "complete"
    ERROR = "error"


@dataclass
class DeepModeEvent:
    type: str
    status: DeepModeStatus
    data: dict = field(default_factory=dict)
    timestamp: int = 0


class DeepModeEventEmitter:
    """SSE event emitter for deep mode status updates."""
    
    def __init__(self):
        self._subscribers: dict[str, list[asyncio.Queue]] = {}
        self._current_status: dict[str, DeepModeStatus] = {}
    
    def subscribe(self, thread_id: str) -> asyncio.Queue:
        """Subscribe to events for a thread."""
        if thread_id not in self._subscribers:
            self._subscribers[thread_id] = []
        queue = asyncio.Queue()
        self._subscribers[thread_id].append(queue)
        return queue
    
    def unsubscribe(self, thread_id: str, queue: asyncio.Queue):
        """Unsubscribe from events."""
        if thread_id in self._subscribers:
            try:
                self._subscribers[thread_id].remove(queue)
            except ValueError:
                pass
    
    async def emit(self, thread_id: str, event: DeepModeEvent):
        """Emit an event to all subscribers."""
        if thread_id not in self._subscribers:
            return
        
        self._current_status[thread_id] = event.status
        
        for queue in self._subscribers[thread_id]:
            await queue.put(event)
    
    def get_status(self, thread_id: str) -> DeepModeStatus:
        """Get current status for a thread."""
        return self._current_status.get(thread_id, DeepModeStatus.IDLE)
    
    async def emit_status(self, thread_id: str, status: DeepModeStatus, data: dict = None):
        """Convenience method to emit a status update."""
        import time
        event = DeepModeEvent(
            type="status",
            status=status,
            data=data or {},
            timestamp=int(time.time())
        )
        await self.emit(thread_id, event)
    
    async def emit_todo_update(self, thread_id: str, todos: list):
        """Emit todo list update."""
        await self.emit(thread_id, DeepModeEvent(
            type="todos",
            status=self.get_status(thread_id),
            data={"todos": todos}
        ))
    
    async def emit_file_update(self, thread_id: str, files: list):
        """Emit file list update."""
        await self.emit(thread_id, DeepModeEvent(
            type="files",
            status=self.get_status(thread_id),
            data={"files": files}
        ))
    
    async def emit_phase_update(self, thread_id: str, phase: int, phase_name: str, status: str):
        """Emit harness phase update."""
        await self.emit(thread_id, DeepModeEvent(
            type="phase",
            status=self.get_status(thread_id),
            data={"phase": phase, "phase_name": phase_name, "status": status}
        ))


deep_mode_events = DeepModeEventEmitter()
