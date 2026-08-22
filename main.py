from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Annotated

from fastapi import Cookie, FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
DATA_DIR = Path("/data") if Path("/data").is_dir() else ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "coastways.db"
ADMIN_PASSWORD_HASH = (
    "9cd967acab3ef06901d3cc4cf00b62c9:"
    "896509e70a6f228338c09e822cb7f53a1c47c1fc306391afbb23d9d019eab84d"
)
SESSION_TOKEN = secrets.token_urlsafe(32)

app = FastAPI(title="دروب الساحل للسفر")
app.mount("/static", StaticFiles(directory=STATIC), name="static")


DEFAULT_PRICES = [
    ("مطار اللاذقية", "اللاذقية", "تكسي", 1, 4, 25),
    ("مطار اللاذقية", "طرطوس", "تكسي", 1, 4, 55),
    ("مطار دمشق", "اللاذقية", "تكسي", 1, 4, 100),
    ("مطار دمشق", "طرطوس", "تكسي", 1, 4, 90),
    ("مطار دمشق", "اللاذقية", "فان", 5, 8, 145),
    ("مطار حلب", "اللاذقية", "تكسي", 1, 4, 85),
    ("مطار حلب", "اللاذقية", "فان", 5, 8, 125),
    ("مطار بيروت", "اللاذقية", "تكسي", 1, 4, 140),
    ("مطار بيروت", "طرطوس", "تكسي", 1, 4, 110),
    ("مطار بيروت", "اللاذقية", "فان", 5, 8, 185),
]


class LoginRequest(BaseModel):
    password: str


class PriceInput(BaseModel):
    airport: str = Field(min_length=2, max_length=80)
    destination: str = Field(min_length=2, max_length=80)
    vehicle: str = Field(min_length=2, max_length=40)
    min_passengers: int = Field(ge=1, le=50)
    max_passengers: int = Field(ge=1, le=50)
    price: float = Field(gt=0, le=10000)


class SettingsInput(BaseModel):
    whatsapp: str = Field(pattern=r"^\d{8,15}$")


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with closing(connect()) as database:
        database.executescript(
            """
            CREATE TABLE IF NOT EXISTS prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                airport TEXT NOT NULL,
                destination TEXT NOT NULL,
                vehicle TEXT NOT NULL,
                min_passengers INTEGER NOT NULL,
                max_passengers INTEGER NOT NULL,
                price REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )
        count = database.execute("SELECT COUNT(*) FROM prices").fetchone()[0]
        if count == 0:
            database.executemany(
                """
                INSERT INTO prices
                    (airport, destination, vehicle, min_passengers, max_passengers, price)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                DEFAULT_PRICES,
            )
        database.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('whatsapp', '963999597094')"
        )
        database.commit()


def is_admin(session: str | None) -> bool:
    return bool(session and hmac.compare_digest(session, SESSION_TOKEN))


def require_admin(session: str | None) -> None:
    if not is_admin(session):
        raise HTTPException(status_code=401, detail="يلزم تسجيل دخول المدير")


def verify_password(password: str) -> bool:
    salt, expected = ADMIN_PASSWORD_HASH.split(":", 1)
    actual = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), 260_000
    ).hex()
    return hmac.compare_digest(actual, expected)


@app.on_event("startup")
def startup() -> None:
    initialize_database()


@app.get("/", include_in_schema=False)
def home() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.get("/manager", include_in_schema=False)
def manager() -> FileResponse:
    return FileResponse(STATIC / "admin.html")


@app.get("/api/catalog")
def catalog() -> dict[str, object]:
    with closing(connect()) as database:
        rows = database.execute(
            """
            SELECT id, airport, destination, vehicle, min_passengers,
                   max_passengers, price
            FROM prices
            ORDER BY airport, destination, min_passengers
            """
        ).fetchall()
        whatsapp = database.execute(
            "SELECT value FROM settings WHERE key = 'whatsapp'"
        ).fetchone()["value"]
    return {"prices": [dict(row) for row in rows], "whatsapp": whatsapp}


@app.post("/api/admin/login")
def login(payload: LoginRequest, response: Response) -> dict[str, bool]:
    if not verify_password(payload.password):
        raise HTTPException(status_code=401, detail="كلمة المرور غير صحيحة")
    response.set_cookie(
        "coastways_admin",
        SESSION_TOKEN,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=60 * 60 * 8,
    )
    return {"ok": True}


@app.get("/api/admin/session")
def session_status(
    coastways_admin: Annotated[str | None, Cookie()] = None,
) -> dict[str, bool]:
    return {"authenticated": is_admin(coastways_admin)}


@app.post("/api/admin/logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie("coastways_admin")
    return {"ok": True}


@app.post("/api/admin/prices")
def create_price(
    payload: PriceInput,
    coastways_admin: Annotated[str | None, Cookie()] = None,
) -> dict[str, int]:
    require_admin(coastways_admin)
    if payload.max_passengers < payload.min_passengers:
        raise HTTPException(status_code=422, detail="الحد الأعلى أقل من الحد الأدنى")
    with closing(connect()) as database:
        cursor = database.execute(
            """
            INSERT INTO prices
                (airport, destination, vehicle, min_passengers, max_passengers, price)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload.airport.strip(),
                payload.destination.strip(),
                payload.vehicle.strip(),
                payload.min_passengers,
                payload.max_passengers,
                payload.price,
            ),
        )
        database.commit()
        return {"id": cursor.lastrowid}


@app.put("/api/admin/prices/{price_id}")
def update_price(
    price_id: int,
    payload: PriceInput,
    coastways_admin: Annotated[str | None, Cookie()] = None,
) -> dict[str, bool]:
    require_admin(coastways_admin)
    if payload.max_passengers < payload.min_passengers:
        raise HTTPException(status_code=422, detail="الحد الأعلى أقل من الحد الأدنى")
    with closing(connect()) as database:
        cursor = database.execute(
            """
            UPDATE prices
            SET airport = ?, destination = ?, vehicle = ?,
                min_passengers = ?, max_passengers = ?, price = ?
            WHERE id = ?
            """,
            (
                payload.airport.strip(),
                payload.destination.strip(),
                payload.vehicle.strip(),
                payload.min_passengers,
                payload.max_passengers,
                payload.price,
                price_id,
            ),
        )
        database.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="السعر غير موجود")
    return {"ok": True}


@app.delete("/api/admin/prices/{price_id}")
def delete_price(
    price_id: int,
    coastways_admin: Annotated[str | None, Cookie()] = None,
) -> dict[str, bool]:
    require_admin(coastways_admin)
    with closing(connect()) as database:
        database.execute("DELETE FROM prices WHERE id = ?", (price_id,))
        database.commit()
    return {"ok": True}


@app.put("/api/admin/settings")
def update_settings(
    payload: SettingsInput,
    coastways_admin: Annotated[str | None, Cookie()] = None,
) -> dict[str, bool]:
    require_admin(coastways_admin)
    with closing(connect()) as database:
        database.execute(
            "UPDATE settings SET value = ? WHERE key = 'whatsapp'",
            (payload.whatsapp,),
        )
        database.commit()
    return {"ok": True}
