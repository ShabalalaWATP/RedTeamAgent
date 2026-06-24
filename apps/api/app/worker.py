from __future__ import annotations

import signal
import time

_running = True


def _request_shutdown(_signum: int, _frame: object) -> None:
    global _running
    _running = False


def main() -> None:
    signal.signal(signal.SIGINT, _request_shutdown)
    signal.signal(signal.SIGTERM, _request_shutdown)
    print("RedTeamAgent worker ready. Stage 1 local workflow runs in-process.", flush=True)
    while _running:
        time.sleep(5)
    print("RedTeamAgent worker stopped.", flush=True)


if __name__ == "__main__":
    main()
