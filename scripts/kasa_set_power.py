#!/usr/bin/env python3
"""
Turn a TP-Link Kasa / Tapo smart plug on or off via python-kasa (KLAP + legacy).
Used when Node tplink-smarthome-api cannot connect (e.g. port 9999 refused).

Install: pip3 install python-kasa
"""
from __future__ import annotations

import asyncio
import sys


async def _set_power(host: str, on: bool) -> None:
    try:
        from kasa import Discover
    except ImportError as e:
        raise RuntimeError(
            "python-kasa is not installed. On the Pi: pip3 install python-kasa"
        ) from e

    # discover_single works for most current Kasa/Tapo devices on the LAN.
    dev = await Discover.discover_single(host)
    await dev.update()
    if on:
        await dev.turn_on()
    else:
        await dev.turn_off()


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: kasa_set_power.py <host> <on|off>", file=sys.stderr)
        sys.exit(2)
    host = sys.argv[1].strip()
    arg = sys.argv[2].strip().lower()
    on = arg in ("1", "on", "true", "yes")
    try:
        asyncio.run(_set_power(host, on))
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
