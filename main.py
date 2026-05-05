import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Brakuje SUPABASE_URL lub SUPABASE_KEY w pliku .env")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Biblioteka API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "https://klantne1-75310.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def fetch_table(
    table_name: str,
    columns: str,
    order_column: str | None = None,
    required: bool = False,
) -> tuple[list[dict[str, Any]], str | None]:
    """
    Pobiera dane z tabeli Supabase.
    Jeśli required=True i pobranie się nie uda, endpoint zwróci błąd 500.
    """
    try:
        query = supabase.table(table_name).select(columns)

        if order_column:
            query = query.order(order_column, desc=False)

        response = query.execute()
        return response.data or [], None

    except Exception as error:
        error_message = str(error)

        if required:
            raise HTTPException(
                status_code=500,
                detail=f'Nie udało się pobrać tabeli "{table_name}": {error_message}',
            )

        return [], error_message


def build_books_response() -> dict[str, Any]:
    books, books_error = fetch_table(
        "ksiazki",
        "id, tytul, rok_wydania",
        order_column="id",
        required=True,
    )

    authors, authors_error = fetch_table(
        "autorzy",
        "id, imie, nazwisko",
        order_column="id",
    )

    genres, genres_error = fetch_table(
        "gatunki",
        "id, nazwa",
        order_column="id",
    )

    publishers, publishers_error = fetch_table(
        "wydawcy",
        "id, nazwa",
        order_column="id",
    )

    book_authors, book_authors_error = fetch_table(
        "ksiazki_autorzy",
        "ksiazka_id, autor_id",
    )

    book_genres, book_genres_error = fetch_table(
        "ksiazki_gatunki",
        "ksiazka_id, gatunek_id",
    )

    book_publishers, book_publishers_error = fetch_table(
        "ksiazki_wydawcy",
        "ksiazka_id, wydawca_id",
    )

    warnings = []

    if books_error:
        warnings.append("ksiazki")
    if authors_error:
        warnings.append("autorzy")
    if genres_error:
        warnings.append("gatunki")
    if publishers_error:
        warnings.append("wydawcy")
    if book_authors_error:
        warnings.append("ksiazki_autorzy")
    if book_genres_error:
        warnings.append("ksiazki_gatunki")
    if book_publishers_error:
        warnings.append("ksiazki_wydawcy")

    authors_map = {
        author["id"]: f'{author.get("imie", "")} {author.get("nazwisko", "")}'.strip()
        for author in authors
    }

    genres_map = {
        genre["id"]: genre.get("nazwa", "")
        for genre in genres
    }

    publishers_map = {
        publisher["id"]: publisher.get("nazwa", "")
        for publisher in publishers
    }

    authors_by_book: dict[int, list[str]] = {}
    genres_by_book: dict[int, list[str]] = {}
    publishers_by_book: dict[int, list[str]] = {}

    for row in book_authors:
        book_id = row.get("ksiazka_id")
        author_id = row.get("autor_id")
        author_name = authors_map.get(author_id)

        if book_id is not None and author_name:
            authors_by_book.setdefault(book_id, []).append(author_name)

    for row in book_genres:
        book_id = row.get("ksiazka_id")
        genre_id = row.get("gatunek_id")
        genre_name = genres_map.get(genre_id)

        if book_id is not None and genre_name:
            genres_by_book.setdefault(book_id, []).append(genre_name)

    for row in book_publishers:
        book_id = row.get("ksiazka_id")
        publisher_id = row.get("wydawca_id")
        publisher_name = publishers_map.get(publisher_id)

        if book_id is not None and publisher_name:
            publishers_by_book.setdefault(book_id, []).append(publisher_name)

    formatted_books = []

    for book in books:
        book_id = book.get("id")

        formatted_books.append(
            {
                "id": book_id,
                "title": book.get("tytul"),
                "year": book.get("rok_wydania"),
                "authors": sorted(set(authors_by_book.get(book_id, []))),
                "genres": sorted(set(genres_by_book.get(book_id, []))),
                "publishers": sorted(set(publishers_by_book.get(book_id, []))),
            }
        )

    return {
        "books": formatted_books,
        "stats": {
            "books": len(books),
            "authors": len(authors),
            "genres": len(genres),
            "publishers": len(publishers),
        },
        "warnings": warnings,
    }


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Backend działa na PythonAnywhere",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
    }


@app.get("/api/books")
def get_books():
    return build_books_response()


@app.get("/api/books/{book_id}")
def get_book(book_id: int):
    response = build_books_response()

    for book in response["books"]:
        if book["id"] == book_id:
            return book

    raise HTTPException(
        status_code=404,
        detail="Nie znaleziono książki.",
    )
