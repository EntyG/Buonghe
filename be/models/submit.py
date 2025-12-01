from enum import Enum
from typing import List, Optional, Union
from pydantic import BaseModel, Field

class Task(str, Enum):
    KIS = "KIS"
    QA = "QA"
    TRAKE = "TRAKE"

class KISAnswerItem(BaseModel):
    media_item_name: str = Field(..., description="Name of the media item")
    start: float = Field(..., description="Start time of the answer")
    end: float = Field(..., description="End time of the answer")

class QAAnswerItem(BaseModel):
    text: str = Field(..., description="Text of the answer")

class TRAKEAnswerItem(BaseModel):
    text: str = Field(..., description="Text of the answer")

AnswerItem = Union[KISAnswerItem, QAAnswerItem, TRAKEAnswerItem]

class AnswerSet(BaseModel):
    answers: List[AnswerItem] = Field(..., description="Answers to the questions")

class SubmitRequest(BaseModel):
    task: Task = Field(..., description="Task to submit")
    answer_sets: List[AnswerSet] = Field(..., description="Answer sets")