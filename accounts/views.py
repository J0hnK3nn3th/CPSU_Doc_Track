import json
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import DocumentType, OfficeDepartment, OutgoingDocument, UserRoleConfig

_TRUSTED_LOGIN_PREFIXES = (
    'http://localhost:5173/',
    'http://127.0.0.1:5173/',
    'http://localhost:8000/',
    'http://127.0.0.1:8000/',
)
_TRUSTED_LOGIN_ORIGINS = {p.rstrip('/') for p in _TRUSTED_LOGIN_PREFIXES}


def _origin_from_url(value):
    """Return normalized origin from full URL/header value."""
    if not value:
        return ''
    try:
        parsed = urlsplit(value.strip())
    except ValueError:
        return ''
    if not parsed.scheme or not parsed.netloc:
        return ''
    return f'{parsed.scheme}://{parsed.netloc}'.rstrip('/')


def _login_request_allowed(request):
    """Narrow allowlist for CSRF-exempt JSON login (SPA / dev servers)."""
    allowed_origins = set(_TRUSTED_LOGIN_ORIGINS)
    allowed_origins.update(
        _origin_from_url(origin) for origin in getattr(settings, 'CSRF_TRUSTED_ORIGINS', [])
    )
    allowed_origins.discard('')

    current_origin = _origin_from_url(f'{request.scheme}://{request.get_host()}')
    if current_origin:
        allowed_origins.add(current_origin)

    origin = _origin_from_url(request.headers.get('Origin') or '')
    if origin and origin in allowed_origins:
        return True
    referer_origin = _origin_from_url(request.headers.get('Referer') or '')
    if referer_origin and referer_origin in allowed_origins:
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

    # Try Django auth user first (supports username/email login).
    user = User.objects.filter(
        Q(username__iexact=identifier) | Q(email__iexact=identifier),
    ).first()
    if user is not None:
        user = authenticate(request, username=user.username, password=password)

    # Fallback: allow login from UserRoleConfig credentials.
    if user is None:
        role_user = UserRoleConfig.objects.filter(
            username__iexact=identifier,
            is_active=True,
        ).first()
        if role_user is None or role_user.password != password:
            return JsonResponse({'error': 'Invalid username or password.'}, status=401)

        # Ensure a matching Django auth user exists so session auth works.
        user = User.objects.filter(username__iexact=role_user.username).first()
        if user is None:
            user = User(
                username=role_user.username,
                first_name=role_user.first_name or '',
                last_name=role_user.last_name or '',
            )
        else:
            user.first_name = role_user.first_name or ''
            user.last_name = role_user.last_name or ''

        # Keep Django password in sync with role config password.
        user.set_password(password)
        user.save()

        user = authenticate(request, username=user.username, password=password)
        if user is None:
            return JsonResponse({'error': 'Invalid username or password.'}, status=401)

    login(request, user)

    # Send role-based landing page:
    # users listed in accounts_userroleconfig go to user page.
    user_has_role_config = UserRoleConfig.objects.filter(
        username__iexact=user.username
    ).exists()

    redirect_target = '/user.html' if user_has_role_config else '/admin.html'
    return JsonResponse({
        'ok': True,
        'redirect': redirect_target,
        'user': {
            'username': user.username,
            'email': user.email or '',
        },
    })


@require_http_methods(['GET', 'HEAD'])
def auth_me(request):
    if request.user.is_authenticated:
        role_user = UserRoleConfig.objects.filter(
            username__iexact=request.user.username,
            is_active=True,
        ).first()
        first_name = (
            (role_user.first_name if role_user else request.user.first_name) or ''
        )
        last_name = (
            (role_user.last_name if role_user else request.user.last_name) or ''
        )
        middle_name = (role_user.middle_name if role_user else '') or ''
        office_department = (role_user.office_department if role_user else '') or ''
        position_role = (role_user.position_role if role_user else '') or ''
        return JsonResponse({
            'authenticated': True,
            'username': request.user.username,
            'email': request.user.email or '',
            'first_name': first_name,
            'middle_name': middle_name,
            'last_name': last_name,
            'office_department': office_department,
            'position_role': position_role,
        })
    return JsonResponse({'authenticated': False}, status=401)


@csrf_exempt
@require_http_methods(['POST'])
def auth_logout(request):
    logout(request)
    return JsonResponse({'ok': True, 'redirect': '/'})


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
            'id': obj.pk,
            'document_type_id': obj.pk,
            'code': obj.code,
            'name': obj.name,
            'description': obj.description,
            'status': 'Active' if obj.is_active else 'Disabled',
        }
    if tab_name == 'offices':
        return {
            'id': obj.pk,
            'office_department_id': obj.pk,
            'code': obj.code,
            'name': obj.name,
            'head': obj.head,
            'status': 'Active' if obj.is_active else 'Disabled',
        }
    return {
        'id': obj.pk,
        'user_role_id': obj.pk,
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


def _apply_payload(tab_name, obj, payload, *, is_update=False):
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

    username = (payload.get('username') or '').strip()
    password = payload.get('password') or ''
    if username:
        obj.username = username
    if password:
        obj.password = password

    if is_update:
        return obj.first_name and obj.last_name and obj.office_department and obj.position_role
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
    if not _apply_payload(tab_name, obj, payload, is_update=False):
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
    if not _apply_payload(tab_name, obj, payload, is_update=True):
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


@csrf_exempt
@require_http_methods(['PATCH'])
def system_config_enable(request, tab_name, item_id):
    auth_error = _require_authenticated(request)
    if auth_error:
        return auth_error

    model = _tab_model(tab_name)
    if model is None:
        return JsonResponse({'error': 'Invalid tab.'}, status=404)

    obj = get_object_or_404(model, pk=item_id)
    obj.is_active = True
    obj.save(update_fields=['is_active', 'updated_at'])
    return JsonResponse({'row': _serialize_item(tab_name, obj)})


def _serialize_outgoing_document(obj):
    return {
        'id': obj.id,
        'document_code': obj.document_code,
        'document_state': obj.document_state,
        'office_name': obj.office_name or '',
        'date_created': obj.created_at.strftime('%b %d, %Y'),
        'subject': obj.subject,
        'category': obj.category,
        'prepared_by': obj.prepared_by,
        'recipient_name': obj.recipient_name or '',
        'recipient_department': obj.recipient_department or '',
        'remarks': obj.remarks or '',
        'description': obj.description or '',
        'received_by': obj.received_by or '',
        'received_date': obj.received_at.strftime('%b %d, %Y') if obj.received_at else '',
    }


def _normalize_token(value):
    return str(value or '').strip().lower()


def _user_display_name(request):
    role_user = UserRoleConfig.objects.filter(
        username__iexact=request.user.username,
        is_active=True,
    ).first()
    first_name = ((role_user.first_name if role_user else request.user.first_name) or '').strip()
    middle_name = ((role_user.middle_name if role_user else '') or '').strip()
    last_name = ((role_user.last_name if role_user else request.user.last_name) or '').strip()
    middle_initial = f'{middle_name[:1].upper()}.' if middle_name else ''
    display_name = ' '.join(p for p in [first_name, middle_initial, last_name] if p).strip()
    return display_name or request.user.username


def _recipient_matches_authenticated_user(request, obj):
    recipient = _normalize_token(obj.recipient_name)
    if not recipient:
        return False
    role_user = UserRoleConfig.objects.filter(
        username__iexact=request.user.username,
        is_active=True,
    ).first()
    first_name = ((role_user.first_name if role_user else request.user.first_name) or '').strip()
    middle_name = ((role_user.middle_name if role_user else '') or '').strip()
    last_name = ((role_user.last_name if role_user else request.user.last_name) or '').strip()
    middle_initial = middle_name[:1].upper() if middle_name else ''

    aliases = {
        _normalize_token(request.user.username),
        _normalize_token(f'{first_name} {last_name}'),
        _normalize_token(f'{first_name} {middle_name} {last_name}'),
        _normalize_token(f'{first_name} {middle_initial}. {last_name}'),
    }
    aliases.discard('')
    return recipient in aliases


@csrf_exempt
@require_http_methods(['GET', 'HEAD', 'POST'])
def outgoing_documents_collection(request):
    auth_error = _require_authenticated(request)
    if auth_error:
        return auth_error

    if request.method != 'POST':
        rows = [_serialize_outgoing_document(obj) for obj in OutgoingDocument.objects.all()]
        return JsonResponse({'rows': rows})

    payload = _parse_json(request)
    if payload is None:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    document_code = (payload.get('document_code') or '').strip()
    subject = (payload.get('subject') or '').strip()
    if not document_code or not subject:
        return JsonResponse(
            {'error': 'Document code and subject are required.'},
            status=400,
        )

    obj = OutgoingDocument(
        document_code=document_code,
        document_state=(payload.get('document_state') or 'NEW').strip() or 'NEW',
        category=(payload.get('category') or '').strip(),
        subject=subject,
        description=(payload.get('description') or '').strip(),
        prepared_by=(payload.get('prepared_by') or '').strip(),
        recipient_name=(payload.get('recipient_name') or '').strip(),
        recipient_department=(payload.get('recipient_department') or '').strip(),
        remarks=(payload.get('remarks') or '').strip(),
        office_name=(payload.get('office_name') or '').strip(),
    )
    if request.user.is_authenticated:
        obj.created_by = request.user

    try:
        obj.save()
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=400)

    return JsonResponse({'row': _serialize_outgoing_document(obj)}, status=201)


@csrf_exempt
@require_http_methods(['GET', 'HEAD', 'PATCH'])
def outgoing_document_detail(request, pk):
    auth_error = _require_authenticated(request)
    if auth_error:
        return auth_error

    obj = get_object_or_404(OutgoingDocument, pk=pk)
    if request.method == 'PATCH':
        payload = _parse_json(request)
        if payload is None:
            return JsonResponse({'error': 'Invalid JSON.'}, status=400)
        new_state = (payload.get('document_state') or '').strip().upper()
        if new_state != 'RECEIVED':
            return JsonResponse({'error': 'Only RECEIVED state update is allowed.'}, status=400)
        if not _recipient_matches_authenticated_user(request, obj):
            return JsonResponse({'error': 'Only the intended receiver can receive this document.'}, status=403)

        obj.document_state = 'RECEIVED'
        obj.received_by = _user_display_name(request)
        obj.received_at = timezone.now()
        obj.save(update_fields=['document_state', 'received_by', 'received_at', 'updated_at'])
        return JsonResponse({'row': _serialize_outgoing_document(obj)})

    return JsonResponse({'row': _serialize_outgoing_document(obj)})
