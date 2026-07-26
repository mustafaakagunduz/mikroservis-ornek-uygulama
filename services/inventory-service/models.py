from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from database import Base

class InventoryItem(Base):
    __tablename__ = "inventory"

    product_id: Mapped[str] = mapped_column(String, primary_key=True)
    reserved: Mapped[int] = mapped_column(Integer, default=0)   # siparişte bekleyen
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
