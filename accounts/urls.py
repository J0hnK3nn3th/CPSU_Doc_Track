from django.urls import path

from . import views

urlpatterns = [
    path('auth/csrf/', views.auth_csrf, name='auth_csrf'),
    path('auth/login/', views.auth_login, name='auth_login'),
    path('auth/me/', views.auth_me, name='auth_me'),
    path('system-config/<str:tab_name>/', views.system_config_collection, name='system_config_collection'),
    path('system-config/<str:tab_name>/<int:item_id>/', views.system_config_item, name='system_config_item'),
    path('system-config/<str:tab_name>/<int:item_id>/disable/', views.system_config_disable, name='system_config_disable'),
]
