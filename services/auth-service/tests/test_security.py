"""
Unit testler — security.py

Dış bağımlılık yok: DB yok, Redis yok, network yok.
Sadece saf fonksiyonları test eder.
Bu testler her ortamda milisaniyeler içinde çalışır.
"""
import pytest
from jose import JWTError

# sys.path'e gerek yok — pytest.ini veya conftest ile hallediliyor
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from security import hash_password, verify_password, create_access_token, decode_token


class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        """Şifre hash'lendikten sonra orijinali ile aynı olmamalı."""
        hashed = hash_password("gizlisifre123")
        assert hashed != "gizlisifre123"

    def test_verify_correct_password(self):
        """Doğru şifre verify'ı geçmeli."""
        hashed = hash_password("gizlisifre123")
        assert verify_password("gizlisifre123", hashed) is True

    def test_verify_wrong_password(self):
        """Yanlış şifre verify'ı geçmemeli."""
        hashed = hash_password("gizlisifre123")
        assert verify_password("yanlis", hashed) is False

    def test_same_password_produces_different_hashes(self):
        """
        bcrypt her seferinde farklı salt kullanır.
        Aynı şifrenin iki hash'i birbirine eşit olmamalı.
        Bu önemli: DB sızıntısında rainbow table saldırısını engeller.
        """
        hash1 = hash_password("ayni_sifre")
        hash2 = hash_password("ayni_sifre")
        assert hash1 != hash2
        # Ama ikisi de verify'ı geçmeli
        assert verify_password("ayni_sifre", hash1) is True
        assert verify_password("ayni_sifre", hash2) is True


class TestJWT:
    def test_create_and_decode_roundtrip(self):
        """Oluşturulan token decode edilebilmeli, veri kayıpsız olmalı."""
        payload = {"sub": "user-123", "email": "test@example.com"}
        token = create_access_token(payload)
        decoded = decode_token(token)

        assert decoded["sub"] == "user-123"
        assert decoded["email"] == "test@example.com"

    def test_token_contains_expiry(self):
        """Token'da exp (expiry) claim'i olmalı."""
        token = create_access_token({"sub": "user-123"})
        decoded = decode_token(token)
        assert "exp" in decoded

    def test_tampered_token_raises(self):
        """
        Token içeriği değiştirildikten sonra decode edilememeli.
        Bu JWT'nin temel güvenlik garantisi.
        """
        token = create_access_token({"sub": "user-123"})
        tampered = token[:-5] + "XXXXX"  # son 5 karakteri boz

        with pytest.raises(JWTError):
            decode_token(tampered)

    def test_random_string_raises(self):
        """Rastgele string token olarak kabul edilmemeli."""
        with pytest.raises(JWTError):
            decode_token("bu.gecersiz.birtoken")
