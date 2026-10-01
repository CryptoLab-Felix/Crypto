"""Download and verify Binance USD-M futures trades using only Python's stdlib."""

import argparse
import csv
import hashlib
import io
import json
import re
import shutil
import time
import urllib.error
import urllib.request
import zipfile
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_ROOT / "data"
BASE_URL = "https://data.binance.vision/data/futures/um/daily/trades"
UTC = timezone.utc
TIMEZONES = {"UTC": UTC, "Asia/Shanghai": timezone(timedelta(hours=8))}
COLUMNS = ["id", "price", "qty", "quote_qty", "time", "is_buyer_maker"]


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def save_json(path, payload):
    temporary = path.with_name(path.name + ".part")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def download(url, destination):
    """Use atomic replacement so interrupted downloads cannot look complete."""
    temporary = destination.with_name(destination.name + ".part")
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Crypto-history-downloader/1.0"})
            with urllib.request.urlopen(request, timeout=30) as response, temporary.open("wb") as output:
                shutil.copyfileobj(response, output, length=1024 * 1024)
            return temporary
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            temporary.unlink(missing_ok=True)
            if isinstance(error, urllib.error.HTTPError) and error.code in (403, 404):
                raise RuntimeError(f"Official archive unavailable (HTTP {error.code}): {url}") from error
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def get_archive(symbol, day):
    filename = f"{symbol}-trades-{day.isoformat()}.zip"
    directory = DATA_ROOT / "raw" / "binance" / "futures" / "um" / "trades" / symbol / day.strftime("%Y/%m/%d")
    directory.mkdir(parents=True, exist_ok=True)
    archive = directory / filename
    checksum = directory / (filename + ".CHECKSUM")
    url = f"{BASE_URL}/{symbol}/{filename}"
    checksum_temp = download(url + ".CHECKSUM", checksum)
    parts = checksum_temp.read_text(encoding="utf-8-sig").strip().split()
    if len(parts) != 2 or not re.fullmatch(r"[0-9a-fA-F]{64}", parts[0]) or parts[1].lstrip("*") != filename:
        checksum_temp.unlink(missing_ok=True)
        raise ValueError(f"Unexpected official checksum format: {url}.CHECKSUM")
    expected = parts[0].lower()
    if archive.exists() and sha256_file(archive) == expected:
        print(f"Already verified: {filename}", flush=True)
    else:
        print(f"Downloading: {url}", flush=True)
        archive_temp = download(url, archive)
        actual = sha256_file(archive_temp)
        if actual != expected:
            archive_temp.unlink(missing_ok=True)
            checksum_temp.unlink(missing_ok=True)
            raise ValueError(f"SHA-256 mismatch: {filename}")
        archive_temp.replace(archive)
    checksum_temp.replace(checksum)
    metadata = {
        "source_url": url,
        "checksum_url": url + ".CHECKSUM",
        "archive_date": day.isoformat(),
        "archive_timezone": "UTC",
        "sha256": expected,
        "size_bytes": archive.stat().st_size,
        "verified_at_utc": datetime.now(UTC).isoformat(),
    }
    save_json(directory / "metadata.json", metadata)
    return archive, metadata


def utc_text(timestamp_ms):
    return (datetime(1970, 1, 1, tzinfo=UTC) + timedelta(milliseconds=timestamp_ms)).isoformat(timespec="milliseconds")


def build_dataset(symbol, requested_day, timezone_name, archives):
    start = datetime.combine(requested_day, datetime.min.time(), TIMEZONES[timezone_name]).astimezone(UTC)
    end = start + timedelta(days=1)
    start_ms, end_ms = int(start.timestamp()) * 1000, int(end.timestamp()) * 1000
    directory = DATA_ROOT / "processed" / "binance" / "futures" / "um" / "trades" / symbol / timezone_name.replace("/", "_") / requested_day.strftime("%Y/%m/%d")
    directory.mkdir(parents=True, exist_ok=True)
    output = directory / f"{symbol}-trades-{requested_day.isoformat()}.csv"
    temporary = output.with_name(output.name + ".part")
    count, gap_count, missing_ids = 0, 0, 0
    first_trade = last_trade = previous_id = None
    source_metadata = []
    try:
        with temporary.open("w", newline="", encoding="utf-8") as destination:
            writer = csv.writer(destination, lineterminator="\n")
            writer.writerow(COLUMNS)
            for archive, metadata in archives:
                source_day = date.fromisoformat(metadata["archive_date"])
                day_start = int(datetime.combine(source_day, datetime.min.time(), UTC).timestamp()) * 1000
                day_end = day_start + 86_400_000
                source_count = 0
                with zipfile.ZipFile(archive) as zipped:
                    member_name = archive.stem + ".csv"
                    if zipped.namelist() != [member_name]:
                        raise ValueError(f"Unexpected archive contents: {archive.name}")
                    with zipped.open(member_name) as member, io.TextIOWrapper(member, encoding="utf-8-sig", newline="") as text:
                        reader = csv.reader(text)
                        for row_number, row in enumerate(reader, start=1):
                            if row_number == 1 and row == COLUMNS:
                                continue
                            if len(row) != len(COLUMNS):
                                raise ValueError(f"Unexpected columns in {archive.name}, row {row_number}")
                            trade_id, timestamp_ms = int(row[0]), int(row[4])
                            if not day_start <= timestamp_ms < day_end:
                                raise ValueError(f"Timestamp outside UTC archive date, or unexpected unit: {archive.name}, row {row_number}")
                            if previous_id is not None and trade_id <= previous_id:
                                raise ValueError(f"Duplicate or unordered trade ID: {trade_id}")
                            previous_id = trade_id
                            source_count += 1
                            if not start_ms <= timestamp_ms < end_ms:
                                continue
                            for column in (1, 2, 3):
                                value = Decimal(row[column])
                                if not value.is_finite() or value < 0 or (column in (1, 2) and value == 0):
                                    raise ValueError(f"Invalid price or quantity for trade {trade_id}")
                            if row[5].lower() not in ("true", "false"):
                                raise ValueError(f"Invalid maker flag for trade {trade_id}")
                            if last_trade is not None:
                                if timestamp_ms < last_trade["timestamp_ms"]:
                                    raise ValueError(f"Trade timestamps out of order: {trade_id}")
                                gap = trade_id - last_trade["id"] - 1
                                gap_count += int(gap > 0)
                                missing_ids += gap
                            record = {"id": trade_id, "timestamp_ms": timestamp_ms, "time_utc": utc_text(timestamp_ms)}
                            if first_trade is None:
                                first_trade = record
                            last_trade = record
                            writer.writerow(row)
                            count += 1
                            if count % 500_000 == 0:
                                print(f"Validated {count:,} selected trades", flush=True)
                if source_count == 0:
                    raise ValueError(f"Empty source archive: {archive.name}")
                source_metadata.append({**metadata, "path": archive.relative_to(PROJECT_ROOT).as_posix(), "rows": source_count, "zip_crc_verified": True})
                print(f"Read {source_count:,} trades from {archive.name}", flush=True)
        if count == 0:
            raise ValueError("No trades in the requested date interval")
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    metadata = {
        "exchange": "binance",
        "market": "futures/um",
        "symbol": symbol,
        "dataset": "trades",
        "date": requested_day.isoformat(),
        "timezone": timezone_name,
        "interval_start_utc_inclusive": start.isoformat(),
        "interval_end_utc_exclusive": end.isoformat(),
        "columns": COLUMNS,
        "timestamp_unit": "milliseconds",
        "price_and_quantity_encoding": "Original decimal text; no floating-point conversion",
        "rows": count,
        "first_trade": first_trade,
        "last_trade": last_trade,
        "validation": {"duplicate_ids": 0, "trade_id_gap_count": gap_count, "missing_ids_between_observed_trades": missing_ids},
        "csv": output.name,
        "sha256": sha256_file(output),
        "size_bytes": output.stat().st_size,
        "sources": source_metadata,
        "created_at_utc": datetime.now(UTC).isoformat(),
    }
    save_json(directory / "metadata.json", metadata)
    print(json.dumps({"file": str(output), "rows": count, "size_bytes": metadata["size_bytes"], "validation": metadata["validation"]}, ensure_ascii=False, indent=2), flush=True)
    return output


def main():
    parser = argparse.ArgumentParser(description="Download official Binance USD-M futures trades and select one calendar day.")
    parser.add_argument("--symbol", default="ETHUSDT", help="USD-M futures symbol, e.g. ETHUSDT or BTCUSDT")
    parser.add_argument("--date", required=True, type=date.fromisoformat, help="Calendar date YYYY-MM-DD in --timezone")
    parser.add_argument("--timezone", choices=TIMEZONES, default="Asia/Shanghai")
    args = parser.parse_args()
    symbol = args.symbol.upper()
    if not re.fullmatch(r"[A-Z0-9_]+", symbol):
        parser.error("Invalid symbol")
    start = datetime.combine(args.date, datetime.min.time(), TIMEZONES[args.timezone]).astimezone(UTC)
    end = start + timedelta(days=1)
    day, final_day = start.date(), (end - timedelta(microseconds=1)).date()
    archives = []
    while day <= final_day:
        archives.append(get_archive(symbol, day))
        day += timedelta(days=1)
    build_dataset(symbol, args.date, args.timezone, archives)


if __name__ == "__main__":
    main()
