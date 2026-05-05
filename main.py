import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client


SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Brakuje SUPABASE_URL lub SUPABASE_KEY w zmiennych środowiskowych.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Biblioteka API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "https://twoj-frontend.netlify.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReviewCreate(BaseModel):
    book_id: int
    user_name: str = Field(min_length=2, max_length=80)
    rating: int = Field(ge=1, le=10)
    content: str = Field(min_length=3, max_length=1000)


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Biblioteka API działa"
    }


@app.get("/api/books")
def get_books(
    search: Optional[str] = Query(default=None),
    year_from: Optional[int] = Query(default=None),
    year_to: Optional[int] = Query(default=None)
):
    query = supabase.table("books").select("*")

    if search:
        query = query.ilike("title", f"%{search}%")

    if year_from:
        query = query.gte("publication_year", year_from)

    if year_to:
        query = query.lt("publication_year", year_to)

    response = query.execute()

    return response.data


@app.get("/api/books/{book_id}")
def get_book(book_id: int):
    response = (
        supabase
        .table("books")
        .select("*")
        .eq("id", book_id)
        .single()
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Nie znaleziono książki.")

    return response.data


@app.get("/api/authors")
def get_authors():
    response = supabase.table("authors").select("*").execute()
    return response.data


@app.get("/api/genres")
def get_genres():
    response = supabase.table("genres").select("*").execute()
    return response.data


@app.get("/api/reviews")
def get_reviews(book_id: int):
    response = (
        supabase
        .table("reviews")
        .select("*")
        .eq("book_id", book_id)
        .order("created_at", desc=True)
        .execute()
    )

    return response.data


@app.post("/api/reviews")
def create_review(review: ReviewCreate):
    response = (
        supabase
        .table("reviews")
        .insert({
            "book_id": review.book_id,
            "user_name": review.user_name,
            "rating": review.rating,
            "content": review.content
        })
        .execute()
    )

    return response.data
