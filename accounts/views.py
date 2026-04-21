import json
import secrets
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import ActivityLog, DocumentType, OfficeDepartment, OutgoingDocument, UserRoleConfig

_TRUSTED_LOGIN_PREFIXES = (
    'http://localhost:5173/',
    'http://127.0.0.1:5173/',
    'http://localhost:8000/',
    'http://127.0.0.1:8000/',
)
_TRUSTED_LOGIN_ORIGINS = {p.rstrip('/') for p in _TRUSTED_LOGIN_PREFIXES}
ALLOWED_DOCUMENT_STATES = {'FORWARDED', 'RECEIVED', 'COMPLETED'}


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
        _record_activity(request, 'AUTH_LOGIN_BLOCKED', target='auth', details='Origin not allowed')
        return JsonResponse({'error': 'Request not allowed.'}, status=403)
    try:
        body = json.loads(request.body.decode())
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    identifier = (body.get('username') or '').strip()
    password = body.get('password') or ''

    if not identifier or not password:
        _record_activity(request, 'AUTH_LOGIN_FAILED', target=identifier, details='Missing credentials')
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
            _record_activity(request, 'AUTH_LOGIN_FAILED', target=identifier, details='Invalid credentials')
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
            _record_activity(request, 'AUTH_LOGIN_FAILED', target=identifier, details='Auth backend reject')
            return JsonResponse({'error': 'Invalid username or password.'}, status=401)

    login(request, user)
    _record_activity(request, 'AUTH_LOGIN_SUCCESS', target=user.username, details='User logged in')

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
    username = request.user.username if request.user.is_authenticated else ''
    _record_activity(request, 'AUTH_LOGOUT', target=username, details='User logged out')
    logout(request)
    return JsonResponse({'ok': True, 'redirect': '/'})


@csrf_exempt
@require_http_methods(['POST'])
def auth_change_username(request):
    unauthorized = _require_authenticated(request)
    if unauthorized:
        return unauthorized

    payload = _parse_json(request)
    if payload is None:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    current_username = (payload.get('current_username') or '').strip()
    new_username = (payload.get('new_username') or '').strip()
    confirm_username = (payload.get('confirm_username') or '').strip()

    if not current_username or not new_username or not confirm_username:
        return JsonResponse({'error': 'Please complete all username fields.'}, status=400)
    if new_username != confirm_username:
        return JsonResponse({'error': 'New Username and Confirm Username do not match.'}, status=400)

    existing_role = UserRoleConfig.objects.filter(
        username__iexact=request.user.username,
        is_active=True,
    ).first()
    expected_current_username = (
        (existing_role.username if existing_role else request.user.username) or ''
    ).strip()
    if current_username.lower() != expected_current_username.lower():
        return JsonResponse({'error': 'Current Username is incorrect.'}, status=400)

    username_taken_in_django = User.objects.filter(
        username__iexact=new_username,
    ).exclude(pk=request.user.pk).exists()
    username_taken_in_roles = UserRoleConfig.objects.filter(
        username__iexact=new_username,
    ).exclude(pk=existing_role.pk if existing_role else None).exists()
    if username_taken_in_django or username_taken_in_roles:
        return JsonResponse({'error': 'That username is already in use.'}, status=400)

    request.user.username = new_username
    request.user.save(update_fields=['username'])
    if existing_role:
        existing_role.username = new_username
        existing_role.save(update_fields=['username', 'updated_at'])
    _record_activity(request, 'AUTH_CHANGE_USERNAME', target=new_username, details=f'Changed from {current_username}')

    return JsonResponse({
        'ok': True,
        'message': 'Username updated successfully.',
        'username': request.user.username,
    })


@csrf_exempt
@require_http_methods(['POST'])
def auth_change_password(request):
    unauthorized = _require_authenticated(request)
    if unauthorized:
        return unauthorized

    payload = _parse_json(request)
    if payload is None:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    current_password = payload.get('current_password') or ''
    new_password = payload.get('new_password') or ''
    confirm_password = payload.get('confirm_password') or ''

    if not current_password or not new_password or not confirm_password:
        return JsonResponse({'error': 'Please complete all password fields.'}, status=400)
    if new_password != confirm_password:
        return JsonResponse({'error': 'New Password and Confirm Password do not match.'}, status=400)
    if len(new_password) < 8:
        return JsonResponse({'error': 'New Password must be at least 8 characters.'}, status=400)

    existing_role = UserRoleConfig.objects.filter(
        username__iexact=request.user.username,
        is_active=True,
    ).first()
    role_password_matches = bool(existing_role and existing_role.password == current_password)
    if not (request.user.check_password(current_password) or role_password_matches):
        return JsonResponse({'error': 'Current Password is incorrect.'}, status=400)

    request.user.set_password(new_password)
    request.user.save(update_fields=['password'])
    update_session_auth_hash(request, request.user)

    if existing_role:
        existing_role.password = new_password
        existing_role.save(update_fields=['password', 'updated_at'])
    _record_activity(request, 'AUTH_CHANGE_PASSWORD', target=request.user.username, details='Password updated')

    return JsonResponse({
        'ok': True,
        'message': 'Password updated successfully.',
    })


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


def _request_ip_address(request):
    forwarded_for = (request.META.get('HTTP_X_FORWARDED_FOR') or '').strip()
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return (request.META.get('REMOTE_ADDR') or '').strip()


def _record_activity(request, action, *, target='', details='', source='BACKEND'):
    actor_username = ''
    if getattr(request, 'user', None) and request.user.is_authenticated:
        actor_username = request.user.username or ''
    elif isinstance(request, dict):
        actor_username = str(request.get('username') or '').strip()

    resolved_source = str(source or 'BACKEND').strip()[:30] or 'BACKEND'
    if hasattr(request, 'headers'):
        resolved_source = (
            request.headers.get('X-Activity-Source')
            or request.headers.get('x-activity-source')
            or resolved_source
        )[:30]
    header_action = ''
    if hasattr(request, 'headers'):
        header_action = (
            request.headers.get('X-Activity-Action')
            or request.headers.get('x-activity-action')
            or ''
        ).strip()
    final_action = str(action or '').strip()[:120] or header_action[:120] or 'SYSTEM_EVENT'

    ActivityLog.objects.create(
        actor_username=actor_username,
        action=final_action,
        target=str(target or '').strip()[:255],
        details=str(details or ''),
        source=resolved_source,
        ip_address=_request_ip_address(request) if hasattr(request, 'META') else '',
        user_agent=((request.headers.get('User-Agent') or '') if hasattr(request, 'headers') else ''),
    )


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
            'can_mark_complete': obj.can_mark_complete,
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
        obj.can_mark_complete = bool(payload.get('can_mark_complete'))
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
    _record_activity(
        request,
        f'SYSTEM_CONFIG_CREATE_{tab_name.upper()}',
        target=str(obj.pk),
        details=f'Created new entry in {tab_name}',
    )
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
    _record_activity(
        request,
        f'SYSTEM_CONFIG_UPDATE_{tab_name.upper()}',
        target=str(item_id),
        details=f'Updated entry in {tab_name}',
    )
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
    _record_activity(
        request,
        f'SYSTEM_CONFIG_DISABLE_{tab_name.upper()}',
        target=str(item_id),
        details=f'Disabled entry in {tab_name}',
    )
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
    _record_activity(
        request,
        f'SYSTEM_CONFIG_ENABLE_{tab_name.upper()}',
        target=str(item_id),
        details=f'Enabled entry in {tab_name}',
    )
    return JsonResponse({'row': _serialize_item(tab_name, obj)})


def _generate_outgoing_control_number():
    """Eight random digits as ####-#### (e.g. 8656-8664)."""
    return f'{secrets.randbelow(10000):04d}-{secrets.randbelow(10000):04d}'


def _assign_unique_control_number(obj):
    for _ in range(64):
        candidate = _generate_outgoing_control_number()
        if not OutgoingDocument.objects.filter(control_number=candidate).exists():
            obj.control_number = candidate
            return
    raise RuntimeError('Could not assign a unique control number.')


def _serialize_outgoing_document(obj):
    return {
        'id': obj.id,
        'control_number': obj.control_number or '',
        'document_code': obj.document_code,
        'document_state': obj.document_state,
        'office_name': obj.office_name or '',
        'date_created': obj.created_at.strftime('%b %d, %Y'),
        'subject': obj.subject,
        'category': obj.category,
        'prepared_by': obj.prepared_by,
        'recipient_name': obj.recipient_name or '',
        'recipient_department': obj.recipient_department or '',
        'carrier': obj.carrier or '',
        'remarks': obj.remarks or '',
        'forwarder_history': obj.forwarder_history or '',
        'description': obj.description or '',
        'received_by': obj.received_by or '',
        'received_date': obj.received_at.strftime('%b %d, %Y') if obj.received_at else '',
    }


def _normalize_token(value):
    return str(value or '').strip().lower()


def _normalize_document_state(value, default='FORWARDED'):
    state = str(value or '').strip().upper() or default
    if state not in ALLOWED_DOCUMENT_STATES:
        return None
    return state


def _append_forwarder_history(existing, *tokens):
    existing_tokens = [t.strip() for t in str(existing or '').split('\n') if t.strip()]
    normalized_existing = {_normalize_token(t) for t in existing_tokens}
    merged = list(existing_tokens)
    for token in tokens:
        clean = str(token or '').strip()
        if not clean:
            continue
        normalized = _normalize_token(clean)
        if normalized in normalized_existing:
            continue
        merged.append(clean)
        normalized_existing.add(normalized)
    return '\n'.join(merged)


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


def _user_can_forward_outgoing(request, obj):
    """Recipient must have received the document before they can forward it."""
    if _normalize_token(obj.document_state) != 'received':
        return False
    return _recipient_matches_authenticated_user(request, obj)


def _current_user_office_department(request):
    role_user = UserRoleConfig.objects.filter(
        username__iexact=request.user.username,
        is_active=True,
    ).first()
    return ((role_user.office_department if role_user else '') or '').strip()


def _recipient_matches_authenticated_user(request, obj):
    recipient_department = _normalize_token(obj.recipient_department)
    if recipient_department:
        user_department = _normalize_token(_current_user_office_department(request))
        if user_department and recipient_department == user_department:
            return True

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

    state = _normalize_document_state(payload.get('document_state'), default='FORWARDED')
    if state is None:
        return JsonResponse(
            {'error': 'Document state must be FORWARDED, RECEIVED, or COMPLETED.'},
            status=400,
        )

    obj = OutgoingDocument(
        document_code=document_code,
        document_state=state,
        category=(payload.get('category') or '').strip(),
        subject=subject,
        description=(payload.get('description') or '').strip(),
        prepared_by=(payload.get('prepared_by') or '').strip(),
        recipient_name=(payload.get('recipient_name') or '').strip(),
        recipient_department=(payload.get('recipient_department') or '').strip(),
        carrier=(payload.get('carrier') or '').strip(),
        remarks=(payload.get('remarks') or '').strip(),
        office_name=(payload.get('office_name') or '').strip(),
    )
    if request.user.is_authenticated:
        obj.created_by = request.user

    _assign_unique_control_number(obj)

    try:
        obj.save()
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    _record_activity(
        request,
        'OUTGOING_DOCUMENT_CREATE',
        target=obj.control_number or str(obj.pk),
        details=f'Document "{obj.subject}" created with state {obj.document_state}',
    )

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
        action = (payload.get('action') or '').strip().lower()
        if action == 'forward':
            if not _user_can_forward_outgoing(request, obj):
                return JsonResponse(
                    {'error': 'Only the recipient who received this document can forward it.'},
                    status=403,
                )
            new_recipient = (payload.get('recipient_name') or '').strip()
            if not new_recipient:
                return JsonResponse({'error': 'Recipient name is required.'}, status=400)
            obj.recipient_name = new_recipient
            obj.recipient_department = (payload.get('recipient_department') or '').strip()
            obj.carrier = (payload.get('carrier') or '').strip()
            obj.forwarder_history = _append_forwarder_history(
                obj.forwarder_history,
                _user_display_name(request),
                request.user.username,
            )
            obj.document_state = 'FORWARDED'
            obj.save()
            _record_activity(
                request,
                'OUTGOING_DOCUMENT_FORWARD',
                target=obj.control_number or str(obj.pk),
                details=f'Forwarded to {obj.recipient_name} ({obj.recipient_department})',
            )
            return JsonResponse({'row': _serialize_outgoing_document(obj)})

        new_state = (payload.get('document_state') or '').strip().upper()
        if new_state not in {'RECEIVED', 'COMPLETED'}:
            return JsonResponse(
                {'error': 'Only RECEIVED or COMPLETED state update is allowed.'},
                status=400,
            )
        if not _recipient_matches_authenticated_user(request, obj):
            return JsonResponse({'error': 'Only the intended receiver can receive this document.'}, status=403)

        obj.document_state = new_state
        if new_state == 'RECEIVED':
            obj.received_by = _user_display_name(request)
            obj.office_name = _current_user_office_department(request)
            obj.received_at = timezone.now()
            obj.save(update_fields=['document_state', 'received_by', 'office_name', 'received_at', 'updated_at'])
            _record_activity(
                request,
                'OUTGOING_DOCUMENT_RECEIVE',
                target=obj.control_number or str(obj.pk),
                details=f'Received by {obj.received_by}',
            )
        else:
            obj.save(update_fields=['document_state', 'updated_at'])
            _record_activity(
                request,
                'OUTGOING_DOCUMENT_COMPLETE',
                target=obj.control_number or str(obj.pk),
                details='Document marked as COMPLETED',
            )
        return JsonResponse({'row': _serialize_outgoing_document(obj)})

    return JsonResponse({'row': _serialize_outgoing_document(obj)})


@require_http_methods(['GET'])
def activity_logs_collection(request):
    auth_error = _require_authenticated(request)
    if auth_error:
        return auth_error

    rows = list(ActivityLog.objects.all()[:1000])
    usernames = {row.actor_username for row in rows if row.actor_username}
    role_rows = UserRoleConfig.objects.filter(
        username__in=usernames,
        is_active=True,
    ).values('username', 'position_role', 'first_name', 'middle_name', 'last_name', 'name_extension')
    user_meta_by_username = {}
    for item in role_rows:
        key = str(item['username'] or '').strip().lower()
        first_name = (item.get('first_name') or '').strip()
        middle_name = (item.get('middle_name') or '').strip()
        last_name = (item.get('last_name') or '').strip()
        name_extension = (item.get('name_extension') or '').strip()
        full_name_parts = [first_name, middle_name, last_name, name_extension]
        full_name = ' '.join(part for part in full_name_parts if part).strip()
        user_meta_by_username[key] = {
            'role': (item.get('position_role') or '').strip(),
            'full_name': full_name,
        }

    def _role_and_name_for_username(actor_username):
        key = str(actor_username or '').strip().lower()
        if not key:
            return '', ''
        meta = user_meta_by_username.get(key)
        if meta:
            return meta.get('role', ''), meta.get('full_name', '')
        # Admin/Django-auth users not present in UserRoleConfig.
        return 'Admin', 'System Administrator'

    data = []
    for row in rows:
        actor_role, actor_full_name = _role_and_name_for_username(row.actor_username)
        data.append({
            'id': row.activity_log_id,
            'actor_username': row.actor_username,
            'actor_role': actor_role,
            'actor_full_name': actor_full_name,
            'action': row.action,
            'target': row.target,
            'details': row.details,
            'source': row.source,
            'ip_address': row.ip_address,
            'user_agent': row.user_agent,
            'created_at': row.created_at.isoformat(),
        })
    return JsonResponse({'rows': data})
