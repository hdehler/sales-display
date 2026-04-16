#!/usr/bin/env python3
"""
Turn a TP-Link Kasa / Tapo smart plug on or off via python-kasa (KLAP + legacy).
Used when Node tplink-smarthome-api cannot connect (e.g. port 9999 refused).

Install: pip3 install python-kasa

KLAP devices need the same email + password as the Kasa mobile app:
  export KASA_USERNAME='you@email.com'
  export KASA_PASSWORD='your-tplink-password'
Or set them in .env (loaded by the Node server — subprocess inherits them).
"""
from __future__ import annotations

import asyncio
import os
import sys


def _tp_link_credentials() -> dict[str, str] | None:
    u = (os.environ.get("KASA_USERNAME") or "").strip()
    p = (os.environ.get("KASA_PASSWORD") or "").strip()
    if u and p:
        return {"username": u, "password": p}
    return None


def _cred_print_suffix(creds: dict[str, str] | None) -> str:
    return " (with Kasa cloud credentials)" if creds else ""


async def _connect(host: str):
    """Prefer Device.connect; pass TP-Link app credentials for KLAP (challenge) auth."""
    try:
        from kasa import Device, DeviceConfig, Discover
        from kasa.credentials import Credentials
    except ImportError as e:
        raise RuntimeError(
            "python-kasa is not installed. On the Pi: pip3 install python-kasa"
        ) from e

    creds = _tp_link_credentials()
    cred_kw = (
        {"username": creds["username"], "password": creds["password"]}
        if creds
        else {}
    )

    errors: list[str] = []

    async def device_connect_with_creds() -> object:
        if creds:
            cfg = DeviceConfig(
                host=host,
                credentials=Credentials(
                    username=creds["username"],
                    password=creds["password"],
                ),
            )
            return await Device.connect(config=cfg)
        return await Device.connect(host=host)

    try:
        dev = await device_connect_with_creds()
        print(
            f"[kasa_set_power] connected via Device.connect({host}){_cred_print_suffix(creds)}",
            file=sys.stderr,
        )
        return dev
    except Exception as e:
        errors.append(f"Device.connect: {e!s}")

    try_connect_all = getattr(Discover, "try_connect_all", None)
    if try_connect_all is not None:
        try:
            dev = await try_connect_all(host, timeout=15, **cred_kw)
            if dev is not None:
                print(
                    f"[kasa_set_power] connected via try_connect_all({host}){_cred_print_suffix(creds)}",
                    file=sys.stderr,
                )
                return dev
            errors.append("try_connect_all: returned None")
        except Exception as e:
            errors.append(f"try_connect_all: {e!s}")

    try:
        dev = await Discover.discover_single(
            host,
            discovery_timeout=10,
            **cred_kw,
        )
        if dev is not None:
            print(
                f"[kasa_set_power] connected via discover_single({host}){_cred_print_suffix(creds)}",
                file=sys.stderr,
            )
            return dev
        errors.append("discover_single: returned None")
    except Exception as e:
        errors.append(f"discover_single: {e!s}")

    hint = ""
    if creds is None:
        hint = (
            " For KLAP devices set KASA_USERNAME + KASA_PASSWORD (Kasa app login), "
            "then retry."
        )
    raise RuntimeError("Could not connect: " + "; ".join(errors) + hint)


async def _set_power(host: str, on: bool) -> None:
    dev = await _connect(host)
    try:
        await dev.update()
        if on:
            await dev.turn_on()
        else:
            await dev.turn_off()
    finally:
        disconnect = getattr(dev, "disconnect", None)
        if disconnect is not None:
            try:
                await disconnect()
            except Exception:
                pass


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
        msg = str(e)
        print(msg, file=sys.stderr)
        if "challenge" in msg.lower() or "e-mail" in msg.lower():
            print(
                "Hint: set KASA_USERNAME and KASA_PASSWORD to your Kasa app email and password.",
                file=sys.stderr,
            )
        sys.exit(1)


if __name__ == "__main__":
    main()
