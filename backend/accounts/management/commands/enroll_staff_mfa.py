from getpass import getpass

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django_otp.plugins.otp_static.models import StaticDevice, StaticToken
from django_otp.plugins.otp_totp.models import TOTPDevice


class Command(BaseCommand):
    help = "Locally enroll an existing staff account in TOTP; treats displayed URI/codes as secrets."

    def add_arguments(self, parser):
        parser.add_argument("username")

    def handle(self, username, **options):
        user = get_user_model().objects.filter(username=username.lower(), is_staff=True, is_active=True).first()
        if not user or not user.check_password(getpass("Current staff password: ")):
            raise CommandError("Staff account authentication failed.")
        device, created = TOTPDevice.objects.get_or_create(user=user, name="primary", defaults={"confirmed": False})
        if not created and device.confirmed:
            raise CommandError("A confirmed device already exists. Use your recovery process; do not silently replace it.")
        self.stdout.write("Add this private URI to your authenticator (do not save it in logs):")
        self.stdout.write(device.config_url)
        if not device.verify_token(input("Authenticator code: ").strip()):
            raise CommandError("Code was not accepted; enrollment remains unconfirmed.")
        device.confirmed = True
        device.save()
        recovery, _ = StaticDevice.objects.get_or_create(user=user, name="recovery")
        self.stdout.write("Store these one-use recovery codes privately:")
        for _ in range(8):
            token = StaticToken.random_token()
            StaticToken.objects.create(device=recovery, token=token)
            self.stdout.write(token)
