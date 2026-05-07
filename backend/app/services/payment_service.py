from app.core.config import get_settings


def create_razorpay_order(amount_inr: int, receipt: str) -> dict:
    settings = get_settings()
    amount_paise = amount_inr * 100
    if settings.razorpay_key_id and settings.razorpay_key_secret:
        import requests

        response = requests.post(
            "https://api.razorpay.com/v1/orders",
            auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
            json={"amount": amount_paise, "currency": "INR", "receipt": receipt, "payment_capture": 1},
            timeout=20,
        )
        response.raise_for_status()
        order = response.json()
        order["key_id"] = settings.razorpay_key_id
        return order

    return {
        "id": f"order_demo_{receipt}",
        "amount": amount_paise,
        "currency": "INR",
        "status": "created",
        "key_id": settings.razorpay_key_id or "rzp_test_demo",
    }


def verify_razorpay_payment(order_id: str, payment_id: str, signature: str) -> bool:
    settings = get_settings()
    if not settings.razorpay_key_secret:
        return False

    import hmac
    import hashlib

    payload = f"{order_id}|{payment_id}".encode("utf-8")
    expected = hmac.new(settings.razorpay_key_secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
