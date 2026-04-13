import json

from django.conf import settings
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.shortcuts import get_object_or_404

from .models import DocumentType, OfficeDepartment, UserRoleConfig

_TRUSTED_LOGIN_PREFIXES = (
    'http://localhost:5173/',
    'http://127.0.0.1:5173/',
    'http://localhost:8000/',
    'http://127.0.0.1:8000/',
)
_TRUSTED_LOGIN_ORIGINS = {p.rstrip('/') for p in _TRUSTED_LOGIN_PREFIXES}


def _login_request_allowed(request):
    """Narrow allowlist for CSRF-exempt JSON login (SPA / dev servers)."""
    origin = (request.headers.get('Origin') or '').strip().rstrip('/')
    if origin and origin in _TRUSTED_LOGIN_ORIGINS:
        return True
    referer = (request.headers.get('Referer') or '').strip()
    if any(referer.startswith(p) for p in _TRUSTED_LOGIN_PREFIXES):
        return True
    if settings.DEBUG:
        addr = (request.META.get('REMOTE_ADDR') or '').replace('::ffff:', '')
        if addr in ('127.0.0.1', '::1'):
            return True
    return False


@ensure_csrf_cookie
@require_http_methods(['GET', 'HEAD'])
def auth_csrf(request):
    return JsonResponse({'detail': 'ok'})


@csrf_exempt
@require_http_methods(['POST'])
def auth_login(request):
    if not _login_request_allowed(request):
        return JsonResponse({'error': 'Request not allowed.'}, status=403)
    try:
        body = json.loads(request.body.decode())
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    identifier = (body.get('username') or '').strip()
    password = body.get('password') or ''

    if not identifier or not password:
        return JsonResponse({'error': 'Please enter your username and password.'}, status=400)

    user = User.objects.filter(
        Q(username__iexact=identifier) | Q(email__iexact=identifier),
    ).first()

    if user is None:
        return JsonResponse({'error': 'Invalid username or password.'}, status=401)

    user = authenticate(request, username=user.username, password=password)
    if user is None:
        return JsonResponse({'error': 'Invalid username or password.'}, status=401)

    login(request, user)
    return JsonResponse({
        'ok': True,
        'redirect': '/admin.html',
        'user': {
            'username': user.username,
            'email': user.email or '',
        },
    })


@require_http_methods(['GET', 'HEAD'])
def auth_me(request):
    if request.user.is_authenticated:
        return JsonResponse({
            'authenticated': True,
            'username': request.user.username,
            'email': request.user.email or '',
        })
    return JsonResponse({'authenticated': False}, status=401)


def _require_authenticated(request):
    if request.user.is_authenticated:
        return None
    return JsonResponse({'error': 'Unauthorized'}, status=401)


def _tab_model(tab_name):
    mapping = {
        'categories': DocumentType,
        'offices': OfficeDepartment,
        'usersRoles': UserRoleConfig,
    }
    return mapping.get(tab_name)


def _parse_json(request):
    try:
        return json.loads(request.body.decode())
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _serialize_item(tab_name, obj):
    if tab_name == 'categories':
        return {
            'id': obj.id,
            'code': obj.code,
            'name': obj.name,
            'description': obj.description,
            'status': 'Active' if obj.is_active else 'Disabled',
        }
    if tab_name == 'offices':
        return {
            'id': obj.id,
            'code': obj.code,
            'name': obj.name,
            'head': obj.head,
            'status': 'Active' if obj.is_active else 'Disabled',
        }
    return {
        'id': obj.id,
        'username': obj.username,
        'full_name': f'{obj.first_name} {obj.last_name}'.strip(),
        'office_department': obj.office_department,
        'position_role': obj.position_role,
        'status': 'Active' if obj.is_active else 'Disabled',
        'first_name': obj.first_name,
        'last_name': obj.last_name,
        'middle_name': obj.middle_name,
        'name_extension': obj.name_extension,
        'password': obj.password,
    }


def _apply_payload(tab_name, obj, payload):
    if tab_name == 'categories':
        obj.code = (payload.get('code') or '').strip()
        obj.name = (payload.get('name') or '').strip()
        obj.description = (payload.get('description') or '').strip()
        return obj.code and obj.name
    if tab_name == 'offices':
        obj.code = (payload.get('code') or '').strip()
        obj.name = (payload.get('name') or '').strip()
        obj.head = (payload.get('head') or '').strip()
        obj.description = (payload.get('description') or '').strip()
        return obj.code and obj.name
    obj.first_name = (payload.get('first_name') or '').strip()
    obj.last_name = (payload.get('last_name') or '').strip()
    obj.middle_name = (payload.get('middle_name') or '').strip()
    obj.name_extension = (payload.get('name_extension') or '').strip()
    obj.office_department = (payload.get('office_department') or '').strip()
    obj.position_role = (payload.get('position_role') or '').strip()
    obj.username = (payload.get('username') or '').strip()
    obj.password = payload.get('password') or obj.password
    return obj.first_name and obj.last_name and obj.office_department and obj.position_role and obj.username and obj.password


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def system_config_collection(request, tab_name):
    auth_error = _require_authenticated(request)
    if auth_error:
        return auth_error

    model = _tab_model(tab_name)
    if model is None:
        return JsonResponse({'error': 'Invalid tab.'}, status=404)

    if request.method == 'GET':
        items = [_serialize_item(tab_name, item) for item in model.objects.all()]
        return JsonResponse({'rows': items})

    payload = _parse_json(request)
    if payload is None:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    obj = model()
    if not _apply_payload(tab_name, obj, payload):
        return JsonResponse({'error': 'Please fill in required fields.'}, status=400)
    try:
        obj.save()
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    return JsonResponse({'row': _serialize_item(tab_name, obj)}, status=201)


@csrf_exempt
@require_http_methods(['PUT'])
def system_config_item(request, tab_name, item_id):
    auth_error = _require_authenticated(request)
    if auth_error:
        return auth_error

    model = _tab_model(tab_name)
    if model is None:
        return JsonResponse({'error': 'Invalid tab.'}, status=404)

    payload = _parse_json(request)
    if payload is None:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    obj = get_object_or_404(model, pk=item_id)
    if not _apply_payload(tab_name, obj, payload):
        return JsonResponse({'error': 'Please fill in required fields.'}, status=400)
    try:
        obj.save()
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    return JsonResponse({'row': _serialize_item(tab_name, obj)})


@csrf_exempt
@require_http_methods(['PATCH'])
def system_config_disable(request, tab_name, item_id):
    auth_error = _require_authenticated(request)
    if auth_error:
        return auth_error

    model = _tab_model(tab_name)
    if model is None:
        return JsonResponse({'error': 'Invalid tab.'}, status=404)

    obj = get_object_or_404(model, pk=item_id)
    obj.is_active = False
    obj.save(update_fields=['is_active', 'updated_at'])
    return JsonResponse({'row': _serialize_item(tab_name, obj)})
