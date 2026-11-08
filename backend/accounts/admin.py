from django.contrib import admin
from django_otp.admin import OTPAdminSite

from .models import AuditEvent, User
from learning.models import Artwork, QuizDefinition, RewardEvent


class LikhaAdminSite(OTPAdminSite):
    site_header = "LIKHA administration"
    site_title = "LIKHA staff"
    index_title = "Restricted staff access"


site = LikhaAdminSite(name="likha_admin")


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(User, site=site)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("username", "is_active", "is_staff")
    fields = ("username", "is_active", "is_staff")
    readonly_fields = ("username", "is_staff")
    search_fields = ("username",)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.auth_version += 1
        super().save_model(request, obj, form, change)
        AuditEvent.objects.create(actor=request.user, action="account_status", outcome="ok", target=str(obj.pk), request_id=request.request_id)


@admin.register(AuditEvent, site=site)
class AuditAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "actor_id", "action", "outcome", "target")


@admin.register(RewardEvent, site=site)
class RewardAdmin(ReadOnlyAdmin):
    list_display = ("owner_id", "key", "stars", "growth", "created_at")


# Student drawings are deliberately not exposed to staff without a separate policy.
