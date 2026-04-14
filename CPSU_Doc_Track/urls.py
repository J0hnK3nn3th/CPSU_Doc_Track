"""
URL configuration for CPSU_Doc_Track project.
"""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path

from .views import frontend_page, frontend_src_asset, index

urlpatterns = [
    path('', index),
    re_path(r'^src/(?P<path>.*)$', frontend_src_asset),
    re_path(r'^(?P<page>admin|incoming|outgoing|system_config|user|uincoming|uoutgoing)\.html$', frontend_page),
    path('health/', lambda request: JsonResponse({'status': 'healthy'})),
    path('admin/', admin.site.urls),
    path('api/', include('accounts.urls')),
]
