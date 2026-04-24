from pathlib import Path

from django.http import Http404
from django.shortcuts import render
from django.views.static import serve

FRONTEND_DIR = Path(__file__).resolve().parent.parent / 'Frontend'
FRONTEND_SRC_DIR = FRONTEND_DIR / 'src'
ALLOWED_PAGES = {
    'admin',
    'cuser',
    'incoming',
    'logs',
    'outgoing',
    'reports',
    'system_config',
    'ucreports',
    'uclogs',
    'ucincoming',
    'ulogs',
    'ucoutgoing',
    'ureports',
    'user',
    'uincoming',
    'uoutgoing',
}


def index(request):
    return render(request, 'index.html')


def frontend_page(request, page):
    if page not in ALLOWED_PAGES:
        raise Http404('Page not found')
    return render(request, f'{page}.html')


def frontend_src_asset(request, path):
    return serve(request, path, document_root=str(FRONTEND_SRC_DIR))
