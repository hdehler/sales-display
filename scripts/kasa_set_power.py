#!/usr/bin/env python3
"""
Turn a TP-Link Kasa / Tapo smart plug on or off via python-kasa (KLAP + legacy).
Used when Node tplink-smarthome-api cannot connect (e.g. port 9999 refused).

Install: pip3 install python-kasa
"""
from __future__ import annotations

import asyncio
import sys


async def _connect(host: str):
    """Prefer direct TCP connect; UDP discovery is flaky on some LANs (docs recommend Device.connect)."""
    try:
        from kasa import Device, Discover
    except ImportError as e:
        raise RuntimeError(
            "python-kasa is not installed. On the Pi: pip3 install python-kasa"
        ) from e

    errors: list[str] = []

    try:
        dev = await Device.connect(host=host)
        print(f"[kasa_set_power] connected via Device.connect({host})", file=sys.stderr)
        return dev
    except Exception as e:
        errors.append(f"Device.connect: {e!s}")

    try_connect_all = getattr(Discover, "try_connect_all", None)
    if try_connect_all is not None:
        try:
            dev = await try_connect_all(host, timeout=15)
            if dev is not None:
                print(
                    f"[kasa_set_power] connected via try_connect_all({host})",
                    file=sys.stderr,
                )
                return dev
            errors.append("try_connect_all: returned None")
        except Exception as e:
            errors.append(f"try_connect_all: {e!s}")

    try:
        dev = await Discover.discover_single(host, discovery_timeout=10)
        if dev is not None:
            print(
                f"[kasa_set_power] connected via discover_single({host})",
                file=sys.stderr,
            )
            return dev
        errors.append("discover_single: returned None")
    except Exception as e:
        errors.append(f"discover_single: {e!s}")

    raise RuntimeError("Could not connect: " + "; ".join(errors))


async def _set_power(host: str, on: bool) -> None:
    dev = await _connect(host)
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
