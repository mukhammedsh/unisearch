"""Shared FastAPI path and query parameter annotations for routers."""

from typing import Annotated

from app.schemas import UniversityFilterQuery
from fastapi import Depends, Path, Query

UniversityIdPath = Annotated[
    str,
    Path(min_length=1, max_length=128, pattern=r"^[a-zA-Z0-9_-]+$"),
]
LangQuery = Annotated[str | None, Query(max_length=16)]
UniversityFilterDep = Annotated[UniversityFilterQuery, Depends()]
