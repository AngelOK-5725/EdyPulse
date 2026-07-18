#!/usr/bin/env python3
"""
Telegram Mini App initData HMAC validator — completely standalone.

Usage:
    python validate_initdata.py <bot_token> <init_data>

Example:
    python validate_initdata.py "123456:ABC-DEF1234ghIkl..." \
        "query_id=AAHd...&user=%7B%22id%22%3A...%7D&auth_date=...&hash=deeb3ca7..."

Output:
    received_hash  = <hash from init_data>
    computed_raw   = <HMAC over URL-encoded values>
    computed_decoded = <HMAC over URL-decoded values>
    match_raw      = True / False
    match_decoded  = True / False
"""

import hashlib
import hmac
import sys
from urllib.parse import unquote


def hmac_sha256(key: bytes, msg: bytes) -> bytes:
    """HMAC-SHA256."""
    return hmac.new(key, msg, hashlib.sha256).digest()


def parse_raw_pairs(init_data: str) -> dict[str, str]:
    """Parse initData into key=value pairs WITHOUT URL-decoding."""
    result = {}
    for pair in init_data.split("&"):
        if "=" not in pair:
            continue
        key, value = pair.split("=", 1)
        result[key] = value  # Keep raw — no unquote!
    return result


def validate_core(
    init_data: str, bot_token: str
) -> dict:
    """
    Validate Telegram initData — the core algorithm, independent of any framework.

    Returns a dict with:
      - received_hash
      - raw_data_check_string
      - computed_raw_hash (HMAC over raw values)
      - decoded_data_check_string
      - computed_decoded_hash (HMAC over decoded values)
      - match_raw
      - match_decoded
    """
    raw_pairs = parse_raw_pairs(init_data)

    received_hash = raw_pairs.pop("hash", None)
    if not received_hash:
        return {"error": "No 'hash' field found in init_data"}

    # Remove non-standard 'signature' field if present
    raw_pairs.pop("signature", None)

    # ---- Variant A: RAW (URL-encoded) values ----
    raw_data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(raw_pairs.items())
    )

    # Telegram spec: secret_key = HMAC-SHA256(key=bot_token, msg="WebAppData")
    secret_key = hmac_sha256(
        bot_token.encode(), "WebAppData".encode()
    )
    computed_raw_hash = hmac_sha256(
        secret_key, raw_data_check_string.encode()
    ).hex()

    # ---- Variant B: URL-decoded values ----
    decoded_pairs = {k: unquote(v) for k, v in raw_pairs.items()}
    decoded_data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(decoded_pairs.items())
    )
    computed_decoded_hash = hmac_sha256(
        secret_key, decoded_data_check_string.encode()
    ).hex()

    return {
        "received_hash": received_hash,
        "raw_data_check_string": raw_data_check_string,
        "computed_raw_hash": computed_raw_hash,
        "decoded_data_check_string": decoded_data_check_string,
        "computed_decoded_hash": computed_decoded_hash,
        "match_raw": computed_raw_hash == received_hash,
        "match_decoded": computed_decoded_hash == received_hash,
    }


def main():
    # --- Parse CLI arguments ---
    bot_token = None
    init_data = None

    args = sys.argv[1:]
    if not args:
        print("Usage:", file=sys.stderr)
        print("  python validate_initdata.py <bot_token> <init_data>", file=sys.stderr)
        print("  python validate_initdata.py <bot_token> --file <path.txt>", file=sys.stderr)
        sys.exit(1)

    bot_token = args[0].strip()

    if len(args) >= 3 and args[1] == "--file":
        with open(args[2], "r", encoding="utf-8") as f:
            init_data = f.read().strip()
    elif len(args) >= 2:
        init_data = args[1]
    else:
        print("ERROR: missing init_data argument", file=sys.stderr)
        sys.exit(1)

    result = validate_core(init_data, bot_token)

    if "error" in result:
        print(f"ERROR: {result['error']}")
        sys.exit(1)

    print(f"received_hash        = {result['received_hash']}")
    print(f"computed_raw_hash    = {result['computed_raw_hash']}")
    print(f"computed_decoded_hash= {result['computed_decoded_hash']}")
    print()
    print(f"match_raw            = {result['match_raw']}")
    print(f"match_decoded        = {result['match_decoded']}")
    print()
    print("— raw_data_check_string (repr) —")
    print(repr(result['raw_data_check_string']))
    print()
    print("— decoded_data_check_string (repr) —")
    print(repr(result['decoded_data_check_string']))


if __name__ == "__main__":
    main()
