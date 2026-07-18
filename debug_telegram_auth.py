#!/usr/bin/env python3
"""
Telegram Mini App initData — ПОЛНЫЙ ДИАГНОСТИЧЕСКИЙ СКРИПТ.

Перебирает ВСЕ возможные варианты HMAC-валидации, чтобы найти,
какая комбинация параметров даёт совпадение с `received_hash`.

Запуск:
    python debug_telegram_auth.py <bot_token> <init_data>
    python debug_telegram_auth.py <bot_token> --file <path.txt>

Описание вариантов:
  - HMAC_ORDER:     (key=WebAppData, msg=bot_token)  или  (key=bot_token, msg=WebAppData)
  - VALUE_ENCODING: RAW (URL-encoded)  или  DECODED (URL-decoded)
  - SEPARATOR:      \\n (LF)  или  \\r\\n (CRLF)
  - KEY_METHOD:     HMAC-SHA256 (правильный Mini App)  или  SHA256 direct (Login Widget)
"""

import hashlib
import hmac
import json
import sys
from urllib.parse import unquote


# ═══════════════════════════════════════════════════════════════════════════
# Базовые криптографические функции
# ═══════════════════════════════════════════════════════════════════════════

def hmac_sha256(key: bytes, msg: bytes) -> bytes:
    """HMAC-SHA256: hmac.new(key, msg, sha256).digest()"""
    return hmac.new(key, msg, hashlib.sha256).digest()


def sha256_direct(data: bytes) -> bytes:
    """SHA256 direct hash."""
    return hashlib.sha256(data).digest()


# ═══════════════════════════════════════════════════════════════════════════
# Парсинг init_data
# ═══════════════════════════════════════════════════════════════════════════

def parse_raw_pairs(init_data: str) -> dict[str, str]:
    """Парсинг init_data WITHOUT URL-decoding."""
    result = {}
    for pair in init_data.split("&"):
        if "=" not in pair:
            continue
        key, value = pair.split("=", 1)
        result[key] = value
    return result


# ═══════════════════════════════════════════════════════════════════════════
# Варианты вычисления secret_key
# ═══════════════════════════════════════════════════════════════════════════

def compute_secret_key_variants(bot_token: str) -> dict[str, bytes]:
    """
    Возвращает словарь {variant_name: secret_key_bytes}.
    
    Варианты:
      - hmac_wa_tok  = HMAC(key="WebAppData", msg=bot_token)         [Telegram spec]
      - hmac_tok_wa  = HMAC(key=bot_token,    msg="WebAppData")      [swap]
      - sha256_tok   = SHA256(bot_token)                              [Login Widget old style]
    """
    return {
        "hmac_wa_tok": hmac_sha256(b"WebAppData", bot_token.encode()),
        "hmac_tok_wa": hmac_sha256(bot_token.encode(), b"WebAppData"),
        "sha256_tok":  sha256_direct(bot_token.encode()),
    }


# ═══════════════════════════════════════════════════════════════════════════
# Варианты data_check_string
# ═══════════════════════════════════════════════════════════════════════════

def compute_data_check_string_variants(
    raw_pairs: dict[str, str]
) -> dict[str, str]:
    """
    Возвращает словарь {variant_name: data_check_string}.
    
    Варианты:
      - raw_lf     = RAW (URL-encoded) значения, \n разделитель
      - raw_crlf   = RAW (URL-encoded) значения, \r\n разделитель
      - dec_lf     = DECODED значения, \n разделитель
      - dec_crlf   = DECODED значения, \r\n разделитель
    
    Также проверяем вариант с signature (не удаляем).
    """
    # Копируем, удаляем hash (signature пока оставляем для теста)
    pairs_with_signature = dict(raw_pairs)  # всё, включая signature
    pairs_with_signature.pop("hash", None)
    
    pairs_without_signature = dict(raw_pairs)
    pairs_without_signature.pop("hash", None)
    pairs_without_signature.pop("signature", None)
    
    # Decoded версии
    dec_with_sig = {k: unquote(v) for k, v in pairs_with_signature.items()}
    dec_without_sig = {k: unquote(v) for k, v in pairs_without_signature.items()}
    
    results = {}
    
    def build_dcs(data: dict, sep: str) -> str:
        return sep.join(f"{k}={v}" for k, v in sorted(data.items()))
    
    # RAW + LF
    results["raw_lf_sig"]   = build_dcs(pairs_with_signature, "\n")
    results["raw_lf_nosig"] = build_dcs(pairs_without_signature, "\n")
    # RAW + CRLF
    results["raw_crlf_sig"]   = build_dcs(pairs_with_signature, "\r\n")
    results["raw_crlf_nosig"] = build_dcs(pairs_without_signature, "\r\n")
    # DECODED + LF
    results["dec_lf_sig"]   = build_dcs(dec_with_sig, "\n")
    results["dec_lf_nosig"] = build_dcs(dec_without_sig, "\n")
    # DECODED + CRLF
    results["dec_crlf_sig"]   = build_dcs(dec_with_sig, "\r\n")
    results["dec_crlf_nosig"] = build_dcs(dec_without_sig, "\r\n")
    
    return results


# ═══════════════════════════════════════════════════════════════════════════
# Полный перебор вариантов
# ═══════════════════════════════════════════════════════════════════════════

def try_all_variants(init_data: str, bot_token: str) -> list[dict]:
    """Перебирает ВСЕ комбинации и возвращает результаты."""
    
    raw_pairs = parse_raw_pairs(init_data)
    received_hash = raw_pairs.pop("hash", None)
    
    if not received_hash:
        return [{"error": "No 'hash' field found in init_data"}]
    
    # Показываем, что получили
    print("=" * 70)
    print("📥 ПАРСИНГ INIT_DATA")
    print("=" * 70)
    print(f"Ключи (sorted): {sorted(raw_pairs.keys())}")
    for k, v in sorted(raw_pairs.items()):
        print(f"  {k}: len={len(v)} | repr={v[:100]!r}...")
    print(f"\nreceived_hash: {received_hash}")
    print()
    
    # Получаем варианты secret_key
    secret_keys = compute_secret_key_variants(bot_token)
    
    # Показываем ID бота и пользователя для диагностики
    bot_id = bot_token.split(":")[0] if ":" in bot_token else "???"
    print(f"  🤖 ID бота: {bot_id}")
    user_id_in_token = _extract_user_id_from_raw(raw_pairs)
    if user_id_in_token:
        print(f"  👤 ID пользователя в initData: {user_id_in_token}")
        if user_id_in_token == bot_id:
            print("  ⚠️  ID пользователя совпадает с ID бота — это странно!")
    print()
    print("=" * 70)
    print("🔑 ВАРИАНТЫ SECRET_KEY")
    print("=" * 70)
    for name, key in secret_keys.items():
        print(f"  {name}: {key.hex()}")
    print()
    
    # Получаем варианты data_check_string
    dcs_variants = compute_data_check_string_variants(raw_pairs)
    print("=" * 70)
    print("📄 ВАРИАНТЫ DATA_CHECK_STRING (первые 200 символов)")
    print("=" * 70)
    for name, dcs in dcs_variants.items():
        print(f"\n--- {name} ---")
        print(f"  length={len(dcs)} | repr={dcs[:200]!r}...")
    print()
    
    # Перебираем ВСЕ комбинации
    results = []
    for sk_name, sk_bytes in secret_keys.items():
        for dcs_name, dcs_str in dcs_variants.items():
            computed = hmac_sha256(sk_bytes, dcs_str.encode()).hex()
            match = computed == received_hash
            results.append({
                "secret_key": sk_name,
                "dcs_variant": dcs_name,
                "computed_hash": computed,
                "match": match,
                "secret_key_hex": sk_bytes.hex(),
            })
    
    return received_hash, results


def _extract_user_id_from_raw(raw_pairs: dict[str, str]) -> str | None:
    """Извлекает ID пользователя из URL-encoded JSON поля 'user'."""
    user_raw = raw_pairs.get("user", "")
    if not user_raw:
        return None
    try:
        import json
        user_data = json.loads(unquote(user_raw))
        return str(user_data.get("id", ""))
    except (json.JSONDecodeError, Exception):
        return None


def _extract_user_id_from_initdata(init_data: str) -> str | None:
    """Извлекает ID пользователя из initData без предварительного парсинга."""
    try:
        from urllib.parse import parse_qs, unquote
        parsed = parse_qs(init_data)
        user_raw = parsed.get("user", [""])[0]
        if not user_raw:
            return None
        import json
        user_data = json.loads(unquote(user_raw))
        return str(user_data.get("id", ""))
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════════════════
# Дополнительная диагностика: что если initData пришла с URL-декодингом?
# ═══════════════════════════════════════════════════════════════════════════

def check_double_encoding(init_data: str) -> None:
    """
    Проверяет, не могла ли initData быть дважды URL-encoded.
    Если init_data содержит %25 (кодированный %), значит она 
    была передана через decodeURIComponent() лишний раз.
    """
    has_double_encoding = "%25" in init_data or "%253" in init_data
    print("=" * 70)
    print("🔍 ПРОВЕРКА НА DOUBLE-ENCODING")
    print("=" * 70)
    if has_double_encoding:
        print("⚠️  Обнаружены признаки double-encoding (%%25, %%253)!")
        print("   Возможно initData была лишний раз URL-декодирована.")
    else:
        print("✅ Признаков double-encoding не обнаружено.")
    print()


def check_bot_token_format(bot_token: str) -> None:
    """
    Проверяет формат bot_token.
    Telegram токен: <digits>:<alphanumeric>
    Типичная длина: 46 символов.
    """
    print("=" * 70)
    print("🔍 ПРОВЕРКА BOT_TOKEN")
    print("=" * 70)
    print(f"  длина: {len(bot_token)}")
    print(f"  repr: {bot_token[:15]!r}...{bot_token[-5:]!r}")
    
    has_colon = ":" in bot_token
    print(f"  содержит ':': {has_colon}")
    
    # Проверяем на невидимые символы
    non_ascii = [c for c in bot_token if ord(c) > 127 or (ord(c) < 32 and c not in '\n\r\t')]
    if non_ascii:
        print(f"⚠️  Найдены не-ASCII символы: {[hex(ord(c)) for c in non_ascii]}")
    else:
        print("✅ Не-ASCII символов не найдено.")
    
    # Проверяем на невидимые пробельные символы внутри (не по краям)
    stripped = bot_token.strip()
    if stripped != bot_token:
        print(f"⚠️  ВНИМАНИЕ: токен содержит пробельные символы по краям!")
        print(f"   После strip() длина: {len(stripped)}")
    else:
        print(f"✅ Пробельных символов по краям нет.")
    print()


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

def main():
    # Парсинг аргументов
    args = sys.argv[1:]
    if not args:
        print("Usage:")
        print("  python debug_telegram_auth.py <bot_token> <init_data>")
        print("  python debug_telegram_auth.py <bot_token> --file <path.txt>")
        sys.exit(1)
    
    bot_token = args[0].strip()
    
    if len(args) >= 3 and args[1] == "--file":
        with open(args[2], "r", encoding="utf-8") as f:
            init_data = f.read().strip()
    elif len(args) >= 2:
        init_data = args[1]
    else:
        print("ERROR: missing init_data argument")
        sys.exit(1)
    
    print()
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║   TELEGRAM MINI APP INITDATA — ПОЛНАЯ ДИАГНОСТИКА          ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()
    
    # Проверка токена
    check_bot_token_format(bot_token)
    
    # Проверка double-encoding
    check_double_encoding(init_data)
    
    # Перебор всех вариантов
    received_hash, results = try_all_variants(init_data, bot_token)
    
    if results and "error" in results[0]:
        print(f"ERROR: {results[0]['error']}")
        sys.exit(1)
    
    # Вывод результатов
    print("=" * 70)
    print("📊 РЕЗУЛЬТАТЫ — ВСЕ ВАРИАНТЫ")
    print("=" * 70)
    
    matches = [r for r in results if r["match"]]
    non_matches = [r for r in results if not r["match"]]
    
    print(f"\nВсего комбинаций: {len(results)}")
    print(f"Совпадений:       {len(matches)}")
    print(f"Не совпало:       {len(non_matches)}")
    print()
    
    if matches:
        print("✅ НАЙДЕНЫ СОВПАДАЮЩИЕ ВАРИАНТЫ!")
        print("-" * 70)
        for m in matches:
            print(f"  [MATCH] secret_key={m['secret_key']} | dcs_variant={m['dcs_variant']}")
            print(f"          hash={m['computed_hash']}")
        print()
        print("💡 ВАЖНО: Не забудьте обновить TELEGRAM_BOT_TOKEN в бэкенде,")
        print("   если он отличается от токена, которым подписана initData!")
        print("   Проверьте: ./backend/.env или Render Dashboard → Environment Variables")
    else:
        print("❌ НИ ОДИН ВАРИАНТ НЕ СОВПАЛ!")
        print()
        print("Возможные причины:")
        print("  1. TELEGRAM_BOT_TOKEN не соответствует токену бота, которым подписана initData")
        print(f"     🔑 Ваш токен:        {bot_token[:15]}...{bot_token[-5:]}")
        print(f"     🔐 ID бота из токена: {bot_token.split(':')[0] if ':' in bot_token else '???'}")
        print(f"     👤 ID пользователя:   {_extract_user_id_from_initdata(init_data) or '???'}")
        print("  2. initData была изменена при передаче (фронтенд изменил строку)")
        print("  3. Telegram использует другой алгоритм для вашего клиента")
        print("  4. Проблема с кодировкой символов (не-ASCII в токене)")
        print()
        print("💡 Совет: Если вы перевыпустили токен в BotFather —")
        print("   откройте Mini App ЗАНОВО и скопируйте свежий initData из Telegram.WebApp.initData.")
        print()
        
        # Показываем топ-3 "ближайших" варианта (по первым символам)
        print("Ближайшие варианты (по первым символам хеша):")
        sorted_results = sorted(results, key=lambda r: (
            sum(1 for a, b in zip(r["computed_hash"], received_hash) if a == b)
            if not r["match"] else 999
        ), reverse=True)
        
        for r in sorted_results[:3]:
            common = sum(1 for a, b in zip(r["computed_hash"], received_hash) if a == b)
            print(f"  [{common}/64 совпадений] {r['secret_key']} + {r['dcs_variant']}")
            print(f"    computed: {r['computed_hash']}")
    
    print()
    print("=" * 70)
    
    # Справка по вариантам
    print("\n📖 ЛЕГЕНДА:")
    print("  secret_key:")
    print("    hmac_wa_tok  = HMAC(key='WebAppData', msg=bot_token)     [Telegram Mini App spec]")
    print("    hmac_tok_wa  = HMAC(key=bot_token,    msg='WebAppData')  [swapped]")
    print("    sha256_tok   = SHA256(bot_token)                         [Login Widget old style]")
    print("  dcs_variant:")
    print("    raw_*       = URL-encoded values (as-is from query string)")
    print("    dec_*       = URL-decoded values (via unquote)")
    print("    *_lf        = \\n separator (LF)")
    print("    *_crlf      = \\r\\n separator (CRLF)")
    print("    *_sig       = WITH 'signature' field")
    print("    *_nosig     = WITHOUT 'signature' field")
    print()


if __name__ == "__main__":
    # На Windows консоль часто cp1252 — символы рамки (╔═║) не проходят.
    # Принудительно переключаем stdout на UTF-8.
    import sys as _sys
    import io as _io
    if hasattr(_sys.stdout, "buffer"):
        _sys.stdout = _io.TextIOWrapper(
            _sys.stdout.buffer,
            encoding="utf-8",
            errors="replace",
            line_buffering=True,
        )
    main()
