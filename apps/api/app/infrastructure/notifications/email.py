from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import Settings


class NullEmailSender:
    def send(self, recipient: str, subject: str, body: str) -> None:
        del recipient, subject, body


class SmtpEmailSender:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def send(self, recipient: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["From"] = self.settings.mail_from
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)
        with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=10) as client:
            if self.settings.smtp_starttls:
                client.starttls(context=ssl.create_default_context())
            if self.settings.smtp_username:
                client.login(self.settings.smtp_username, self.settings.smtp_password)
            client.send_message(message)
