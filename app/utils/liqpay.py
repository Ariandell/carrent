"""
LiqPay payment integration utility.
Wraps the LiqPay SDK for generating checkout forms and verifying callbacks.
"""
import base64
import hashlib
import json
import os
from dataclasses import dataclass


from app.config import settings

@dataclass
class LiqPayClient:
    """LiqPay API client for payment processing."""
    
    public_key: str = ""
    private_key: str = ""
    sandbox: bool = True

    def __init__(self):
        self.public_key = settings.LIQPAY_PUBLIC_KEY
        self.private_key = settings.LIQPAY_PRIVATE_KEY
        # Check if we should use sandbox (default to True if not specified or "true")
        self.sandbox = os.getenv("LIQPAY_SANDBOX", "true").lower() == "true"

    def _encode_data(self, data: dict) -> str:
        """Encode data dict to base64 string."""
        json_str = json.dumps(data)
        return base64.b64encode(json_str.encode()).decode()

    def _generate_signature(self, data: str) -> str:
        """Generate signature for data."""
        sign_str = self.private_key + data + self.private_key
        sha1 = hashlib.sha1(sign_str.encode()).digest()
        return base64.b64encode(sha1).decode()

    def get_checkout_params(
        self,
        amount: float,
        currency: str,
        description: str,
        order_id: str,
        result_url: str,
        server_url: str
    ) -> dict:
        """
        Generate checkout parameters for LiqPay form.
        
        Returns dict with 'data' and 'signature' for form submission.
        """
        params = {
            "version": 3,
            "public_key": self.public_key,
            "action": "pay",
            "amount": amount,
            "currency": currency,
            "description": description,
            "order_id": order_id,
            "result_url": result_url,
            "server_url": server_url,
        }
        
        if self.sandbox:
            params["sandbox"] = 1
        
        data = self._encode_data(params)
        signature = self._generate_signature(data)
        
        return {
            "data": data,
            "signature": signature,
            "checkout_url": "https://www.liqpay.ua/api/3/checkout"
        }

    def verify_signature(self, data: str, signature: str) -> bool:
        """Verify callback signature is valid."""
        expected = self._generate_signature(data)
        return expected == signature

    def decode_data(self, data: str) -> dict:
        """Decode base64 data from callback."""
        try:
            json_str = base64.b64decode(data).decode()
            return json.loads(json_str)
        except Exception:
            return {}


# Singleton instance
liqpay = LiqPayClient()
